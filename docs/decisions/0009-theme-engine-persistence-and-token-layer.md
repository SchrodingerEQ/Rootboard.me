# 0009 — Theme engine: config-file persistence and a single token layer
Date: 2026-09-22
Status: accepted

Design spec: `docs/plans/theme-system/THEME-ENGINE-SPEC.md`.

## Persist the active theme in `data/config/dashboard.json`, not `/api/state`

The theme plan (2026-07-18) locked `/api/state` as the store. That
predates the shell's human-editable config file, which now exists and is
the better fit for a shell-level setting:

- **SSH-recoverable.** If a theme ever renders the settings menu
  unreadable on an unattended kiosk, the fix is editing one JSON line.
  The SQLite value would need the `sqlite3` CLI, which the Pi may not
  even have.
- **No extra boot request.** The shell already fetches and polls the
  config; the theme rides along, so there is no second load gate.
- **Write path exists.** The optimistic write helper (rollback + toast)
  is already built for this file.

Cost: a schema-invalid config file falls back to defaults wholesale,
which would also reset the widget layout. Mitigated by making the field
lenient (`.optional().catch(undefined)`): a malformed theme id becomes
"no theme" without invalidating the rest of the document. Both stores
survive browser resets and auto-updates, so durability did not decide it.

## Alias the shadcn tokens onto the Rootboard `--rb-*` tokens

Two live palettes (shadcn tokens inside the UI primitives; `--rb-*`
everywhere else) would force every theme to declare ~100 values in two
vocabularies and keep them consistent. Instead `:root` defines each
shadcn token as `var(--rb-…)`, and a theme declares one palette.

The stylesheet's hex comments were approximate, so this is *visually*
rather than *byte*-identical for Default (deltas of 1–5 per channel,
documented in the spec). One new token, `--rb-ink-tertiary`, carries the
exact former `--muted-foreground` value because no existing token was
close enough for text. `--primary` moves to the app's existing info blue
(a small visible shift, primitives-only, unifying one blue).

Rejected: declaring both layers in the manifest (double authoring);
aliasing without minting (would lighten muted text and cut contrast).

## Bundle built-in themes as TypeScript modules

Not a served `/themes` folder (as the plan's text suggested). No
discovery endpoint, no boot fetch, no flash for bundled themes. The
manifest schema lives in `shared/` so a later folder-drop phase reuses
it unchanged.
