import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppStateClient, LOAD_RETRY_MS, PERSIST_DEBOUNCE_MS } from "./app-state-client";

// A minimal fetch stub: each test queues an ordered list of response
// promises (a Response-shaped resolution, or a rejection for a network
// error). Each call to fetchImpl shifts the next one off the queue.
function makeFetch(responses: Array<Promise<Response>>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) {
      throw new Error("makeFetch: no response queued for call " + calls.length);
    }
    return next;
  });
  return { fn, calls };
}

function okJson(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function fail(status = 500): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("server error"),
  } as Response);
}

function networkError(): Promise<Response> {
  return Promise.reject(new Error("network down"));
}

describe("AppStateClient", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  describe("load()", () => {
    test("retries every 15s on failure, then resolves the value on success", async () => {
      const { fn, calls } = makeFetch([networkError(), okJson({ key: "k", value: { a: 1 } })]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);

      const loadPromise = client.load();
      // Let the first (failing) attempt's microtasks resolve.
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Not yet retried before 15s.
      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS - 1);
      expect(fn).toHaveBeenCalledTimes(1);

      // Retry fires at +15s and succeeds.
      await vi.advanceTimersByTimeAsync(1);
      const result = await loadPromise;

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ a: 1 });
      expect(calls[0].url).toBe("/api/state/k");
      expect(calls[0].init?.credentials).toBe("include");
    });

    test("resolves null when the server has no stored value", async () => {
      const { fn } = makeFetch([okJson({ key: "k", value: null })]);
      const client = new AppStateClient("k", fn as unknown as typeof fetch);

      const result = await client.load();
      expect(result).toBeNull();
    });

    test("is safe to call more than once — returns the same promise", async () => {
      const { fn } = makeFetch([okJson({ key: "k", value: { a: 1 } })]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);

      const p1 = client.load();
      const p2 = client.load();
      expect(p1).toBe(p2);
      await p1;
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("a non-ok HTTP response is treated as a load failure and retried", async () => {
      const { fn } = makeFetch([fail(500), okJson({ key: "k", value: { a: 2 } })]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);

      const loadPromise = client.load();
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS);
      const result = await loadPromise;
      expect(result).toEqual({ a: 2 });
    });
  });

  describe("set() before load success", () => {
    test("never calls fetch and logs a console.error", async () => {
      const { fn } = makeFetch([]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);

      client.set({ a: 1 });
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS + 1000);

      expect(fn).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("set() after load success — debounce", () => {
    test("three set()s within 600ms coalesce into exactly one PUT with the last value", async () => {
      const { fn, calls } = makeFetch([
        okJson({ key: "k", value: { a: 0 } }),
        okJson({}),
      ]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 1 });
      await vi.advanceTimersByTimeAsync(200);
      client.set({ a: 2 });
      await vi.advanceTimersByTimeAsync(200);
      client.set({ a: 3 });

      // Still within 600ms of the last set — no PUT yet.
      await vi.advanceTimersByTimeAsync(500);
      expect(fn).toHaveBeenCalledTimes(1); // only the GET so far

      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(2); // exactly one PUT

      const putCall = calls[1];
      expect(putCall.init?.method).toBe("PUT");
      expect(putCall.url).toBe("/api/state/k");
      expect(JSON.parse(putCall.init!.body as string)).toEqual({ value: { a: 3 } });
      expect(putCall.init?.credentials).toBe("include");
      expect((putCall.init?.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
    });
  });

  describe("failed PUT retry", () => {
    test("schedules a 15s retry, and the retry PUTs the CURRENT latest value", async () => {
      const { fn, calls } = makeFetch([
        okJson({ key: "k", value: { a: 0 } }), // load
        fail(500), // first PUT fails
        okJson({}), // retry PUT succeeds
      ]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 1 });
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
      // First PUT attempt fired and failed.
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Newer value set AFTER the failed PUT but BEFORE the retry fires.
      // Advance past debounce so it doesn't schedule its own separate PUT
      // (the retry timer supersedes / this models "latest value at fire time").
      client.set({ a: 99 });

      // Retry fires at +15s from the failure, using the latest value (99),
      // not the value (1) that was in flight when it failed.
      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS);

      const retryPutCalls = calls.filter((c) => c.init?.method === "PUT");
      const lastPut = retryPutCalls[retryPutCalls.length - 1];
      expect(JSON.parse(lastPut.init!.body as string)).toEqual({ value: { a: 99 } });
    });
  });

  describe("newer set() cancels a pending failed-PUT retry", () => {
    test("no duplicate/stale PUT fires from the superseded retry", async () => {
      const { fn, calls } = makeFetch([
        okJson({ key: "k", value: { a: 0 } }), // load
        fail(500), // first PUT fails
        okJson({}), // the debounced PUT from the second set()
      ]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 1 });
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(2); // GET + failed PUT
      expect(fn).toHaveBeenCalledTimes(2);

      // A fresh set() should cancel the pending 15s retry and schedule its
      // own debounced PUT instead.
      client.set({ a: 2 });
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
      expect(fn).toHaveBeenCalledTimes(3); // GET + failed PUT + new debounced PUT

      // Advancing well past the original retry's 15s deadline must NOT
      // produce an extra PUT call — it was cancelled.
      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS + 1000);
      expect(fn).toHaveBeenCalledTimes(3);

      const putCalls = calls.filter((c) => c.init?.method === "PUT");
      expect(putCalls).toHaveLength(2);
      expect(JSON.parse(putCalls[1].init!.body as string)).toEqual({ value: { a: 2 } });
    });
  });

  describe("flush()", () => {
    test("immediately PUTs a pending debounced value", async () => {
      const { fn, calls } = makeFetch([
        okJson({ key: "k", value: { a: 0 } }),
        okJson({}),
      ]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 5 });
      expect(fn).toHaveBeenCalledTimes(1); // just the GET; debounce hasn't fired

      client.flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(2);
      const putCall = calls[1];
      expect(JSON.parse(putCall.init!.body as string)).toEqual({ value: { a: 5 } });

      // Advancing past the original debounce window must not double-PUT.
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS + 100);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("is a no-op when nothing is pending", async () => {
      const { fn } = makeFetch([okJson({ key: "k", value: { a: 0 } })]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1); // still just the GET
    });
  });

  describe("dispose()", () => {
    test("cancels pending debounce and pending load retry; no fetch after dispose", async () => {
      const { fn } = makeFetch([networkError()]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);

      // Kick off a load that fails and schedules a 15s retry.
      client.load().catch(() => {});
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      client.dispose();

      // The load retry must never fire.
      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS * 3);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("cancels a pending debounced persist after a successful load", async () => {
      const { fn } = makeFetch([okJson({ key: "k", value: { a: 0 } })]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 1 });
      client.dispose();

      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS + LOAD_RETRY_MS * 2);
      expect(fn).toHaveBeenCalledTimes(1); // only the GET, ever
    });

    test("cancels a pending failed-PUT retry", async () => {
      const { fn } = makeFetch([okJson({ key: "k", value: { a: 0 } }), fail(500)]);
      const client = new AppStateClient<{ a: number }>("k", fn as unknown as typeof fetch);
      await client.load();

      client.set({ a: 1 });
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(2); // GET + failed PUT

      client.dispose();

      await vi.advanceTimersByTimeAsync(LOAD_RETRY_MS * 3);
      expect(fn).toHaveBeenCalledTimes(2); // retry never fires
    });
  });

  describe("value round-trip", () => {
    test("PUT body is {value}, GET response {key, value} is unwrapped", async () => {
      const { fn, calls } = makeFetch([
        okJson({ key: "k", value: { nested: { list: [1, 2, 3] } } }),
        okJson({}),
      ]);
      const client = new AppStateClient<{ nested: { list: number[] } }>(
        "k",
        fn as unknown as typeof fetch,
      );
      const loaded = await client.load();
      expect(loaded).toEqual({ nested: { list: [1, 2, 3] } });

      client.set({ nested: { list: [4, 5] } });
      client.flush();
      await vi.advanceTimersByTimeAsync(0);

      const putCall = calls[1];
      expect(JSON.parse(putCall.init!.body as string)).toEqual({
        value: { nested: { list: [4, 5] } },
      });
    });
  });
});
