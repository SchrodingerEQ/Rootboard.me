/**
 * The calendar widget <-> shell seam.
 *
 * Two things live here, shared by BOTH sides (the shell renders calendar
 * chrome — the Settings popover — while the calendar itself runs as a
 * contract widget behind `WidgetHostMount`):
 *
 * 1. **The persisted settings shape** (ratified delta 2, PHASE3-EXECUTION.md).
 *    Per-calendar visibility is no longer ephemeral React state in the shell;
 *    it is the calendar widget's `settings` blob in
 *    `data/config/dashboard.json`:
 *
 *      { "hiddenCalendars": [...], "disabledCalendars": [...] }
 *
 *    - `hiddenCalendars` — the Settings popover's per-calendar switch. A
 *      hidden calendar disappears from the header chip row AND its events
 *      are filtered out.
 *    - `disabledCalendars` — the header chip toggle. The chip stays visible
 *      but dimmed; only the events are filtered out.
 *    - Absent/empty = nothing hidden, nothing disabled, i.e. **new calendars
 *      are visible by default**. That is what retires the old
 *      `seenCalendarIds` auto-enable-once ref dance in the shell: with a
 *      hidden-LIST model there is no "have I seen this id before?" question
 *      to answer, so a refetch can never resurrect a calendar the user
 *      deliberately turned off.
 *
 *    Derivations (done widget-side, from the subscribed-calendars query):
 *      visible-in-header = subscribed − hidden
 *      events-on         = subscribed − hidden − disabled
 *
 *    These are deliberately NOT declared as manifest `settings` field
 *    descriptors: the descriptor system (string/number/boolean/select) can't
 *    express "a set of ids drawn from a live server query". The shell's
 *    SettingsMenu + the widget's own chip row ARE the editor for them, and
 *    the values still round-trip through the same `PUT /api/config/dashboard`
 *    every other widget setting uses.
 *
 * 2. **Three page-global CustomEvents** used where props no longer exist.
 *    A widget's container is an opaque `HTMLElement` — the shell cannot pass
 *    React props into it, and `host.settings` is read-only by contract (there
 *    is no `settings.set()` in apiVersion 1). Window events are the same
 *    page-global channel the app already uses for `screensaver-state-change`
 *    / `screensaver-exit`, so this stays consistent with existing practice
 *    rather than inventing a private side-channel. These are FIRST-PARTY
 *    transitional plumbing, not contract surface — a real `host.settings.set()`
 *    (and a shell-owned power-saving signal) is the proper fix in a future
 *    contract revision.
 */

/** Widget id, as it appears in dashboard config and the manifest. */
export const CALENDAR_WIDGET_ID = "calendar";

/** Settings keys (see the settings shape above). */
export const HIDDEN_CALENDARS_KEY = "hiddenCalendars";
export const DISABLED_CALENDARS_KEY = "disabledCalendars";

/**
 * Shell -> widget. The power-saving overlay stays shell-owned (CONTRACT §4),
 * but the calendar still has to suppress its event-form / auth dialogs while
 * the screen is dimmed — behavior it previously got from the
 * `isPowerSavingActive` prop. Fires on every change, including the initial
 * `false` at shell mount.
 *
 * NOTE: this is NOT the same signal as `onVisibilityChange(false)`. That also
 * fires when the user simply navigates to another section, where the original
 * code deliberately kept dialogs open (they are Radix-portaled to
 * document.body and were reachable from any section).
 */
export const POWER_SAVING_CHANGE_EVENT = "rootboard:power-saving-change";
export interface PowerSavingChangeDetail {
  isActive: boolean;
}

/**
 * Shell -> widget. The Settings popover (shell-rendered) subscribes to a new
 * calendar; the widget owns the only `useCalendar()` instance and therefore
 * the only real `manualRefresh` — with its online guard, in-flight guard,
 * `isRefreshing`/LoadingIndicator wiring, throttle bookkeeping and
 * mutation-based error containment. This replaces the old
 * `onRegisterRefresh`/`refreshRef` prop handshake rather than re-deriving
 * that request sequence by hand.
 */
export const CALENDAR_SUBSCRIBE_SUCCESS_EVENT = "rootboard:calendar-subscribe-success";

/**
 * Widget -> shell. `host.settings` is read-only, so the widget's header chip
 * row asks the shell to persist a settings change. The shell owns the single
 * read-merge-PUT-invalidate implementation for dashboard config, so every
 * writer (Settings switches, chips, unsubscribe) goes through one code path
 * and one race domain.
 *
 * The detail is a DELTA — one id's membership in one list — not a whole
 * pre-computed array. Two rapid toggles of DIFFERENT calendars on the same
 * key can otherwise land in the same ~1-2 frame propagation window: if each
 * event carried a full array built from a React state snapshot, the second
 * write's array would be built from state that doesn't yet include the
 * first write's change, and would silently clobber it. Shipping just
 * `{ key, calendarId, present }` lets the shell's handler read the list it
 * is about to patch from the query cache AT WRITE TIME (the same snapshot
 * `updateWidgetSettings` uses for the read-merge-PUT) and derive the new
 * array from THAT — so two toggles fired in the same tick each see the
 * other's effect instead of racing.
 */
export const CALENDAR_SETTINGS_PATCH_EVENT = "rootboard:calendar-settings-patch";
export interface CalendarSettingsPatchDetail {
  /** Which persisted list this toggle targets. */
  key: typeof HIDDEN_CALENDARS_KEY | typeof DISABLED_CALENDARS_KEY;
  /** The calendar id being added to or removed from that list. */
  calendarId: string;
  /** true = add id to the list, false = remove it. */
  present: boolean;
}

/**
 * Coerce a raw settings value into a set of calendar ids. `settings` is
 * `Record<string, unknown>` by schema and `data/config/dashboard.json` is
 * explicitly hand-editable over SSH, so a malformed value must degrade to
 * "nothing hidden/disabled" instead of throwing on a kiosk.
 */
export function toCalendarIdSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((v): v is string => typeof v === "string"));
}

/**
 * Add/remove one id from a settings list, returned sorted so repeated
 * toggles produce a stable `dashboard.json` (it is a file a human reads).
 */
export function withCalendarId(ids: Set<string>, id: string, present: boolean): string[] {
  const next = new Set(ids);
  if (present) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return Array.from(next).sort();
}

export interface CalendarVisibility {
  /** Chip row membership: subscribed − hidden. */
  visibleInHeader: Set<string>;
  /** Calendars whose events are drawn: subscribed − hidden − disabled. */
  eventsOn: Set<string>;
}

/**
 * The whole per-calendar visibility model in one pure function (extracted so
 * it is machine-checkable — the widget that consumes it is React and this
 * repo has no renderer in its test setup).
 *
 * Both results are intersected with `subscribedIds` on purpose: a stale id
 * left in `hiddenCalendars`/`disabledCalendars` after an unsubscribe (or a
 * typo in a hand-edited config) can only ever subtract, never conjure a
 * calendar that isn't subscribed. That also preserves the pre-widget
 * behavior where both Sets were only ever seeded from the calendars query.
 */
export function deriveCalendarVisibility(
  subscribedIds: readonly string[],
  hidden: Set<string>,
  disabled: Set<string>,
): CalendarVisibility {
  return {
    visibleInHeader: new Set(subscribedIds.filter((id) => !hidden.has(id))),
    eventsOn: new Set(subscribedIds.filter((id) => !hidden.has(id) && !disabled.has(id))),
  };
}
