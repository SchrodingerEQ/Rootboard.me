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
  // Bound to globalThis: native `fetch` is called elsewhere in this class as
  // `this.fetchImpl(...)`, i.e. as a *method* on the client instance — which
  // sets `this` inside the callee to the client, not to `window`/
  // `globalThis`. Browsers' native fetch implementation is `this`-sensitive
  // (an internal-slot brand check) and throws `TypeError: Illegal
  // invocation` when called with the wrong receiver. Binding here once,
  // regardless of whether the caller passed a custom fetchImpl or we fell
  // back to the global default, makes every call site safe no matter how
  // it's invoked.
  private readonly fetchImpl: typeof fetch;

  private loadSucceeded = false;
  private loadPromise: Promise<T | null> | null = null;
  private loadResolve: ((value: T | null) => void) | null = null;
  private loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private putRetryTimer: ReturnType<typeof setTimeout> | null = null;
  // Always the latest value passed to set(), so a PUT retry firing later
  // persists what's current, not a stale closure from when it was scheduled.
  private latestValue: T | undefined;
  // Bumped on every set(). A persist attempt is only allowed to clear
  // `hasPendingPersist` if the generation it was dispatched for still
  // matches `this.generation` when it succeeds — i.e. no newer set()
  // happened while it was in flight. This is what makes "dirty" durable:
  // the flag survives a failed PUT (and a retry armed for it) all the way
  // until some PUT for the CURRENT value actually succeeds.
  private generation = 0;
  // True whenever there is a mutation that has not yet been confirmed
  // persisted by a successful PUT. Set on every set(); cleared only inside
  // persistNow's success handler, and only when that attempt's generation
  // is still current. This is what flush() checks to decide whether it has
  // anything to send, and it is deliberately NOT cleared just because a PUT
  // attempt was *dispatched* — a failed/in-flight attempt must not make the
  // edit look "safe" to drop (see: unmount racing a failed PUT's retry).
  private hasPendingPersist = false;

  constructor(key: string, fetchImpl: typeof fetch = fetch) {
    this.key = key;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  /**
   * GET /api/state/:key, retrying every 15s forever until it succeeds —
   * there's no user on a kiosk to retry manually, and we must never treat a
   * failed load as "loaded" (that would let set() start overwriting real
   * data). Safe to call more than once; subsequent calls return the same
   * promise as the first.
   *
   * If dispose() is called while a load is outstanding (still retrying, or
   * even mid-flight on the GET itself), the returned promise settles with
   * `null` rather than hanging forever — but `loadSucceeded` is never set
   * in that path, so the set()/persist gate above still holds: a null
   * settled post-dispose can never itself trigger a PUT.
   */
  load(): Promise<T | null> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<T | null>((resolve) => {
      this.loadResolve = resolve;

      const attempt = async () => {
        if (this.disposed) {
          resolve(null);
          this.loadResolve = null;
          return;
        }
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
          this.loadResolve = null;
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
   * loaded, debounces 600ms before PUTting the latest value.
   *
   * `hasPendingPersist` ("dirty") is set here and stays true across a
   * failed PUT and any retry armed for it — it only clears once some PUT
   * for the current value actually succeeds (see `generation` above). A
   * newer set() always cancels a stale failed-PUT retry timer so we never
   * race it against a fresh debounced PUT.
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
    this.generation += 1;
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

  /**
   * Immediately fires a pending persist — whether it's a debounce still
   * counting down OR a 15s failed-PUT retry that's currently armed. Any
   * mutation that hasn't yet been confirmed by a successful PUT counts as
   * "pending" (see `hasPendingPersist`), so a host that calls flush() right
   * after a PUT failure (e.g. on unmount) still gets the edit sent instead
   * of silently dropped until a retry that will never get to fire.
   */
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
    // Unblock a still-pending load() awaiter instead of leaving it hanging
    // forever. Safe: loadSucceeded is never set on this path, and set()'s
    // gate above means this null can never be used to persist over real
    // data.
    if (this.loadResolve) {
      this.loadResolve(null);
      this.loadResolve = null;
    }
  }

  private clearPutRetry(): void {
    if (this.putRetryTimer) {
      clearTimeout(this.putRetryTimer);
      this.putRetryTimer = null;
    }
  }

  private firePersist(): void {
    this.persistNow(this.latestValue as T, this.generation);
  }

  /**
   * Dispatches a PUT for `value`, tagged with the generation it represents.
   * `generation` lets the completion handlers tell a current attempt from a
   * stale/superseded one:
   *  - success only clears `hasPendingPersist` if no newer set() happened
   *    while this PUT was in flight (generation still matches);
   *  - failure only arms a 15s retry if no fresh debounce is already
   *    scheduled to carry a newer value (`persistTimer` is null) — if one
   *    is, that upcoming attempt supersedes this failure, so arming a
   *    parallel retry here would risk a duplicate/stale PUT later.
   *
   * The dispatch itself is wrapped in `Promise.resolve().then(...)` so a
   * *synchronous* throw from fetchImpl (not just a rejected promise) is
   * still caught by the `.catch` below instead of escaping uncaught from a
   * setTimeout callback and silently dropping the mutation.
   */
  private persistNow(value: T, generation: number): void {
    if (this.disposed) return;
    Promise.resolve()
      .then(() =>
        this.fetchImpl(`/api/state/${this.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
          credentials: "include",
        }),
      )
      .then(async (res) => {
        await throwIfResNotOk(res);
        if (this.disposed) return;
        if (generation === this.generation) {
          this.hasPendingPersist = false;
        }
      })
      .catch((err) => {
        console.error(`Failed to persist ${this.key} state:`, err);
        if (this.disposed) return;
        if (this.persistTimer) return;
        this.clearPutRetry();
        this.putRetryTimer = setTimeout(() => {
          this.putRetryTimer = null;
          this.persistNow(this.latestValue as T, this.generation);
        }, LOAD_RETRY_MS);
      });
  }
}
