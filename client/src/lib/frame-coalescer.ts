/**
 * Coalesces a stream of values into at most one `apply(value)` per animation
 * frame, always applying the latest value. Used for the brightness slider:
 * a touch drag delivers pointer moves faster than the kiosk can repaint, and
 * each `document.documentElement.style.filter` write forces a full-page
 * recomposite on the Pi. One write per frame is all the screen can show.
 *
 * `raf` is injectable so the behaviour is unit-testable without a DOM.
 */
export function createFrameCoalescer<T>(
  apply: (value: T) => void,
  raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
): (value: T) => void {
  let pending = false;
  let latest: T;
  return (value: T) => {
    latest = value;
    if (pending) return;
    pending = true;
    raf(() => {
      pending = false;
      apply(latest);
    });
  };
}
