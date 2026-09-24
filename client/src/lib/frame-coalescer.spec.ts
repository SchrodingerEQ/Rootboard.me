import { describe, expect, test, vi } from "vitest";
import { createFrameCoalescer } from "./frame-coalescer";

/** A fake requestAnimationFrame that only fires when the test says so. */
function fakeRaf() {
  const queue: FrameRequestCallback[] = [];
  return {
    raf: (cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    },
    frame() {
      const cbs = queue.splice(0);
      for (const cb of cbs) cb(performance.now());
    },
    pending: () => queue.length,
  };
}

describe("createFrameCoalescer", () => {
  test("many sets within one frame produce exactly one apply, with the last value", () => {
    const apply = vi.fn();
    const { raf, frame, pending } = fakeRaf();
    const set = createFrameCoalescer<number>(apply, raf);
    for (let v = 100; v > 40; v--) set(v);
    expect(apply).not.toHaveBeenCalled();
    expect(pending()).toBe(1); // one frame requested, not sixty
    frame();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(41);
  });

  test("a set after the frame fires schedules a new frame", () => {
    const apply = vi.fn();
    const { raf, frame } = fakeRaf();
    const set = createFrameCoalescer<number>(apply, raf);
    set(1);
    frame();
    set(2);
    frame();
    expect(apply.mock.calls).toEqual([[1], [2]]);
  });

  test("a frame with no pending set applies nothing", () => {
    const apply = vi.fn();
    const { raf, frame } = fakeRaf();
    createFrameCoalescer<number>(apply, raf);
    frame();
    expect(apply).not.toHaveBeenCalled();
  });
});
