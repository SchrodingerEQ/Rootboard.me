# Rootboard Widget Contract — apiVersion 1

**Status:** DRAFT — spec design complete, not yet implemented.
**Parent decision:** [0006 — Community-buildable widget system](../../decisions/0006-community-widget-system.md)
**Shape decisions:** [0007 — Widget contract shape](../../decisions/0007-widget-contract-shape.md)
**Plan:** [WIDGET-SYSTEM-PLAN.md](WIDGET-SYSTEM-PLAN.md)

This document is the single source of truth for what a widget is, what it
may touch, and what the host guarantees. First-party widgets follow it
with zero exceptions — there are no privileged internal widgets.

---

## 1. What a widget is

A widget is a **folder** containing a manifest and one self-contained
ESM entry module:

```
my-widget/
  widget.json     # manifest — Zod-validated on load
  index.js        # ESM bundle, default-exports the widget object
  icon.svg        # optional nav icon (sanitized before render)
```

In v1 a widget occupies the **full content area** as a section, selected
from the nav rail (the `"section"` slot). Manifests declare a `slots`
array so future slot types (tiles, strips) can be added without a
contract break.

## 2. Manifest — `widget.json`

Validated by a Zod schema in `shared/widget-manifest.ts` (shared between
server-side discovery and client-side built-in registration).

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | `^[a-z0-9][a-z0-9-]{1,40}$`; must equal the folder name; unique across installed widgets |
| `name` | string | yes | 1–40 chars; shown in nav rail + layout picker |
| `version` | string | yes | semver `MAJOR.MINOR.PATCH` |
| `apiVersion` | integer | yes | contract version the widget targets; host rejects values greater than its own `WIDGET_API_VERSION` |
| `entry` | string | yes | relative path to the ESM entry, no `..` segments (default convention: `index.js`) |
| `slots` | string[] | yes | v1: must include `"section"`; unknown slot names are ignored (forward-compat) |
| `description` | string | no | ≤200 chars, shown in the layout picker |
| `icon` | string | no | relative path to an SVG/PNG in the folder; SVG is sanitized (scripts stripped) before render |
| `refresh` | object | no | `{ intervalSeconds: number ≥ 30 }` — host calls `refresh()` on this cadence while the widget is visible and the screen is awake |
| `settings` | array | no | field descriptors driving the host's settings editor (below) |

**Settings descriptors** (v1 types only): each entry is
`{ key, label, type, default?, options? }` with
`type ∈ { "string", "number", "boolean", "select" }`; `options`
(`{value,label}[]`) required iff `type === "select"`. The host renders
these in its settings UI and persists values in the dashboard config
file — widgets never write their own settings.

Example:

```json
{
  "id": "grocery-list",
  "name": "Grocery List",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "index.js",
  "slots": ["section"],
  "refresh": { "intervalSeconds": 300 },
  "settings": [
    { "key": "sortMode", "label": "Sort", "type": "select",
      "default": "manual",
      "options": [
        { "value": "manual", "label": "Manual" },
        { "value": "alpha", "label": "A–Z" }
      ] }
  ]
}
```

## 3. Entry module and lifecycle

The entry module is **self-contained ESM**: it bundles all of its own
dependencies (vanilla DOM, Preact, bundled React — the widget's choice).
The host exposes no framework, no import map, and no shared runtime
besides the DOM and the `WidgetHost` object.

```ts
// Default export of the entry module
interface RootboardWidget {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance;
}

interface WidgetInstance {
  unmount(): void;
  refresh?(): void | Promise<void>;
  onVisibilityChange?(visible: boolean): void;
}
```

**Lifecycle guarantees (host side):**

- **Keep-alive mounting.** The host mounts every enabled widget once at
  startup and keeps instances alive across section switches — hidden
  widgets are display-hidden, not unmounted. (This preserves the
  behavior today's hoisting invariant provides: live nav badges,
  debounce timers, in-memory cooldowns. See `docs/SPEC.md` §3.1.)
- `unmount()` is called only when a widget is disabled in settings, its
  folder is removed, or the app shuts down. Widgets must clear their own
  timers/listeners in `unmount()`.
- `refresh()` is invoked by the host on the manifest cadence, and only
  while the widget is visible, the app is online, and the screensaver is
  not active. Widgets should not run their own polling loops for
  refreshable data; the app's rule of "all cadence is client timers,
  owned centrally" extends to the host.
- `onVisibilityChange(visible)` fires when the widget's section is
  shown/hidden and when the screensaver dims/wakes (dim ⇒ `false`).
  Optional; widgets that keep private timers should pause on `false`.

## 4. Host services — `WidgetHost`

Deliberately minimal: only what the first-party widgets were measured to
need (coupling audit, 2026-08-19). Growing this surface is a contract
change and bumps `WIDGET_API_VERSION`.

```ts
interface WidgetHost {
  readonly apiVersion: 1;
  readonly appVersion: string;   // from shared/version.ts
  readonly widgetId: string;

  /** One persistent JSON blob per widget, server-side (survives browser
   *  resets). Serialized size ≤ 64,000 chars — writes above the cap are
   *  rejected. Backed by app_state key `widget:<id>` with the hardened
   *  debounce/retry semantics of use-app-state (600 ms debounced PUT,
   *  15 s retry, never-overwrite-before-first-successful-load). */
  storage: {
    get<T>(): Promise<T | null>;
    set<T>(value: T): void;      // debounced, fire-and-forget like today
  };

  /** Read-only view of this widget instance's settings values (as
   *  declared in the manifest, edited in the host UI, persisted in the
   *  dashboard config file). */
  settings: {
    get(): Record<string, unknown>;
    subscribe(cb: (next: Record<string, unknown>) => void): () => void;
  };

  /** Theme tokens are ambient CSS custom properties (--rb-*) inherited
   *  by the container; style with var(--rb-…) and theming is free.
   *  getToken resolves a computed value for canvas/JS use. */
  theme: {
    getToken(name: string): string;   // e.g. getToken("--rb-accent")
    subscribe(cb: () => void): () => void;  // fires on theme switch
  };

  /** Plain fetch — full network access per the v1 trust model. Also the
   *  path to same-origin /api/* if a widget legitimately needs it. */
  fetch: typeof fetch;

  ui: {
    /** Numeric badge on this widget's nav-rail button (null clears). */
    setBadge(count: number | null): void;

    /** Requests the shell's power-saving overlay (screensaver) immediately,
     *  as if the kiosk had gone idle. The overlay itself is shell-owned —
     *  this only triggers it; the widget has no control over dimming,
     *  timing, or exit. */
    sleep(): void;
  };
}
```

**Traceability — why exactly these services** (from the coupling audit):
chores/dinner need `storage` (today: `app_state` blobs) and `setBadge`
(today: hoisted hook feeding the rail badge); calendar and any
weather-like widget need `fetch` and refresh cadence; theming needs the
CSS variables; per-widget options need `settings`; `ui.sleep()` was added
by founder ratification because all three first-party widgets (calendar,
chores, dinner) carry an explicit Sleep button that puts the kiosk into
its power-saving overlay on demand — the overlay itself remains entirely
shell-owned (widgets cannot dim, time, or dismiss it themselves; `sleep()`
only requests that the shell start it, exactly as an idle timeout would).
Nothing else first-party needs more, so nothing more is exposed.

**Storage key mapping:** community widgets use `app_state` key
`widget:<id>` (server whitelist becomes the legacy set `{chores,
dinner}` plus the pattern `^widget:[a-z0-9][a-z0-9-]{1,40}$`). Built-in
widgets keep their **legacy keys** (`chores`, `dinner`) via a host-level
alias map so existing kiosk data survives the migration untouched
(value-only-accrues: a migration must never lose family data).

## 5. Dashboard config — the source of truth

Full dashboard state lives in a human-readable JSON file; the
touchscreen UI is an editor over it. Location: `data/config/dashboard.json`
(`data/` is already on the updater's preserve list).

```json
{
  "configVersion": 1,
  "defaultWidget": "calendar",
  "widgets": [
    { "id": "calendar", "enabled": true, "settings": {} },
    { "id": "chores",   "enabled": true, "settings": {} },
    { "id": "dinner",   "enabled": true, "settings": {} }
  ]
}
```

- Array order = nav-rail order.
- Zod-validated (`shared/dashboard-config.ts`); unknown widget ids are
  kept but shown as unavailable (the folder may be re-added later).
- Server API: `GET/PUT /api/config/dashboard`. The file is re-read on
  GET (hand-edits over SSH are picked up without a restart on the next
  poll) and written atomically (temp file + rename).
- Missing/corrupt file degrades to the built-in default (the three
  first-party widgets, calendar first) — never a crash on a kiosk.
- Last-active section remains ephemeral localStorage; `defaultWidget`
  is what survives a browser reset.

## 6. Discovery, validation, loading

- Community widgets live in `/widgets/<id>/` at the app root
  (sideloaded via SD card or SSH). **`widgets/` must be on the
  auto-updater preserve lists** — both `PRESERVE_PATHS` in
  `server/services/updateService.ts` and the `case` list in
  `scripts/start.sh` — or updates delete installed widgets.
- Server: `GET /api/widgets` scans `widgets/*/widget.json`, validates
  each with the shared Zod schema, and returns
  `{ widgets: [...manifests], invalid: [{folder, errors}] }`. Invalid
  widgets are skipped, never fatal; the layout picker surfaces the
  error so a sideloading user isn't debugging blind.
- Static serving: `express.static("widgets")` mounted at `/widgets`
  **inside `registerRoutes`** so it precedes both the prod SPA
  catch-all and the dev Vite middleware.
- Client loads a community widget with dynamic
  `import(/* @vite-ignore */ `/widgets/${id}/${entry}`)`.
- **apiVersion gate:** host constant `WIDGET_API_VERSION = 1` in
  `shared/widget-manifest.ts`. A manifest with `apiVersion >
  WIDGET_API_VERSION` is listed but not loadable, with the message
  "built for a newer Rootboard" (mirrors the theme manifest's
  `engineVersion` policy).
- Built-in widgets ship in `client/src/widgets/<id>/` (manifest imported
  as JSON + a TS entry), registered through a static registry that runs
  the **same** Zod validation at startup. Same contract, different
  transport.

## 7. Trust model (v1 — stated plainly)

**There is no sandbox.** A widget's entry module runs with full access
to the page, the DOM, the network, and the same-origin API — the same
access the app itself has. Rootboard is a local kiosk appliance:
**install only widgets you trust**, exactly as you would when installing
software on any computer. A permission system is explicitly out of scope
for v1; if one ever lands it will arrive as an `apiVersion` bump, not a
silent behavior change. This statement must appear verbatim (or
stronger) in the contribution guide and the widget tutorial.

## 8. Widget author rules

- Touch only `container`, `host`, and your own bundled code. Do not
  reach into the host DOM outside your container; do not depend on
  host globals, CSS classes, or React internals — none are contract.
- Style with `var(--rb-*)` tokens wherever possible so themes apply.
- Respect the kiosk: minimum 48 px touch targets (56 px on ≥1920 px
  screens); no hover-only affordances; assume no physical keyboard —
  eligible text inputs get the app's on-screen keyboard automatically
  (it is global chrome and works inside widget DOM).
- Assume the network can be down for hours; render something useful
  from `storage` when `fetch` fails.
- No remote code: the entry bundle must be complete at install time.
  Fetching *data* is fine; `import()`ing remote *code* is not.
