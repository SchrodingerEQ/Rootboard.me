export const PERSIST_DEBOUNCE_MS = 600;
export const LOAD_RETRY_MS = 15_000;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Framework-free, imperative reproduction of the hardened persistence
 * semantics in client/src/hooks/use-app-state.ts (that hook documents the
 * WHY for each guard below; this class must preserve every one of those
 * properties without React). One instance is owned per widget by the widget
 * host, which calls `load()` once, `set()` on every local mutation, and
 * `flush()`/`dispose()` around unmount.
 *
 * This drives a 24/7 kiosk with nobody around to click "retry" — a
 * transient failure of the initial GET must NEVER be allowed to result in a
 * PUT that overwrites the family's real stored data with empty/default
 * state. `loadSucceeded` is the single source of truth for "safe to
 * persist"; `set()` is a hard no-op until it flips. On failure we keep
 * retrying the GET on an interval instead of ever falling through to
 * "loaded".
 */
export class AppStateClient<T = unknown> {
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  private loadSucceeded = false;
  private loadPromise: Promise<T | null> | null = null;
  private loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private putRetryTimer: ReturnType<typeof setTimeout> | null = null;
  // Always the latest value passed to set(), so a PUT retry firing later
  // persists what's current, not a stale closure from when it was scheduled.
  private latestValue: T | undefined;
  // The value a debounced persist (or flush) is currently about to send /
  // has in flight — used by flush() to know what to send immediately.
  private pendingValue: T | undefined;
  private hasPendingPersist = false;

  constructor(key: string, fetchImpl: typeof fetch = fetch) {
    this.key = key;
    this.fetchImpl = fetchImpl;
  }

  /**
   * GET /api/state/:key, retrying every 15s forever until it succeeds —
   * there's no user on a kiosk to retry manually, and we must never treat a
   * failed load as "loaded" (that would let set() start overwriting real
   * data). Safe to call more than once; subsequent calls return the same
   * promise as the first.
   */
  load(): Promise<T | null> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<T | null>((resolve) => {
      const attempt = async () => {
        if (this.disposed) return;
        try {
          const res = await this.fetchImpl(`/api/state/${this.key}`, {
            credentials: "include",
          });
          if (!res.ok) throw new Error(`Failed to load ${this.key} state: ${res.status}`);
          const body = (await res.json()) as { key: string; value: unknown };
          if (this.disposed) return;
          const value = (body.value === null || body.value === undefined
            ? null
            : (body.value as T)) as T | null;
          this.loadSucceeded = true;
          if (value !== null) this.latestValue = value;
          resolve(value);
        } catch (err) {
          console.error(`Failed to load ${this.key} state:`, err);
          if (!this.disposed) {
            this.loadRetryTimer = setTimeout(() => {
              this.loadRetryTimer = null;
              attempt();
            }, LOAD_RETRY_MS);
          }
        }
      };
      attempt();
    });

    return this.loadPromise;
  }

  /**
   * Rejected (console.error, no-op) until a load has actually succeeded —
   * otherwise a widget mounting before its data has loaded could persist
   * placeholder/default state over the family's real stored data. Once
   * loaded, debounces 600ms before PUTting the latest value; a failed PUT
   * schedules a 15s retry that re-reads the latest value at fire time (a
   * wifi blip must not silently drop a mutation), and any newer set()
   * supersedes/cancels that pending retry so we never race a stale retry
   * against a fresh debounced PUT.
   */
  set(value: T): void {
    if (this.disposed) return;
    if (!this.loadSucceeded) {
      console.error(
        `AppStateClient(${this.key}): set() called before load() succeeded — ignoring to avoid overwriting stored data`,
      );
      return;
    }

    this.latestValue = value;
    this.pendingValue = value;
    this.hasPendingPersist = true;

    // A newer mutation supersedes any retry left over from an earlier
    // failed PUT — the fresh debounced PUT below will carry this value (and
    // any later one) instead.
    this.clearPutRetry();

    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.firePersist();
    }, PERSIST_DEBOUNCE_MS);
  }

  /** Immediately fires a pending debounced (or retry-scheduled) persist. */
  flush(): void {
    if (this.disposed) return;
    if (!this.hasPendingPersist) return;

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.clearPutRetry();
    this.firePersist();
  }

  /** Cancels all timers. No GET/PUT may fire after this. */
  dispose(): void {
    this.disposed = true;
    if (this.loadRetryTimer) {
      clearTimeout(this.loadRetryTimer);
      this.loadRetryTimer = null;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.clearPutRetry();
  }

  private clearPutRetry(): void {
    if (this.putRetryTimer) {
      clearTimeout(this.putRetryTimer);
      this.putRetryTimer = null;
    }
  }

  private firePersist(): void {
    this.hasPendingPersist = false;
    this.persistNow(this.latestValue as T);
  }

  private persistNow(value: T): void {
    if (this.disposed) return;
    this.fetchImpl(`/api/state/${this.key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
      credentials: "include",
    })
      .then(async (res) => {
        await throwIfResNotOk(res);
      })
      .catch((err) => {
        console.error(`Failed to persist ${this.key} state:`, err);
        if (this.disposed) return;
        this.putRetryTimer = setTimeout(() => {
          this.putRetryTimer = null;
          this.persistNow(this.latestValue as T);
        }, LOAD_RETRY_MS);
      });
  }
}
