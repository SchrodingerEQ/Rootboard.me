export interface RefreshSchedulerOptions {
  /** Manifest `refresh.intervalSeconds`. Omitted/undefined means the widget
   *  declared no refresh cadence — the scheduler then never fires. */
  intervalSeconds?: number;
  onRefresh: () => void;
  /** Injectable clock for tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Pure (no DOM, no timers of its own) scheduler for widget refresh cadence.
 * The host (WidgetHostMount) owns a single shared 30s interval and calls
 * tick() on every instance; this class only tracks eligibility state and
 * decides whether a refresh is due.
 *
 * Rules (ratified, CONTRACT.md §3):
 *  - refresh() fires when visible && online && awake && an interval is
 *    configured && now - lastRefresh >= intervalSeconds*1000.
 *  - Becoming visible or becoming awake, while the interval is already
 *    overdue, fires immediately as a catch-up (rather than waiting for the
 *    next 30s tick) — coming back online does NOT trigger this catch-up,
 *    only visible/awake transitions do.
 *  - lastRefresh is initialized to construction time: a freshly mounted
 *    widget just loaded its own data, so it must not instantly refresh.
 *  - This class does NOT reset its own clock when onRefresh fires — the
 *    caller (WidgetHostMount) is expected to call noteRefreshed() once the
 *    resulting instance.refresh() (possibly async) has actually completed.
 */
export class RefreshScheduler {
  private readonly intervalMs: number | null;
  private readonly onRefresh: () => void;
  private readonly now: () => number;

  private visible = false;
  private online = false;
  private awake = false;
  private lastRefresh: number;

  constructor(opts: RefreshSchedulerOptions) {
    this.intervalMs =
      opts.intervalSeconds !== undefined ? opts.intervalSeconds * 1000 : null;
    this.onRefresh = opts.onRefresh;
    this.now = opts.now ?? Date.now;
    this.lastRefresh = this.now();
  }

  setVisible(v: boolean): void {
    const wasVisible = this.visible;
    this.visible = v;
    if (v && !wasVisible) this.maybeCatchUp();
  }

  setOnline(v: boolean): void {
    this.online = v;
  }

  setAwake(v: boolean): void {
    const wasAwake = this.awake;
    this.awake = v;
    if (v && !wasAwake) this.maybeCatchUp();
  }

  /** Host calls this on its shared 30s interval. */
  tick(): void {
    if (this.isDue()) this.fire();
  }

  /** Resets the due-clock — call after a refresh (host-driven or
   *  widget-initiated) completes. */
  noteRefreshed(): void {
    this.lastRefresh = this.now();
  }

  private maybeCatchUp(): void {
    if (this.isDue()) this.fire();
  }

  private isDue(): boolean {
    if (this.intervalMs === null) return false;
    if (!this.visible || !this.online || !this.awake) return false;
    return this.now() - this.lastRefresh >= this.intervalMs;
  }

  private fire(): void {
    this.onRefresh();
  }
}
