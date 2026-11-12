// A renderer returns true while it needs another frame. Sleeping renderers own
// no pending callback; visibility, freeze, and disposal all use the same gate.
export function createFrameLoop(
  draw,
  {
    request = (callback) => requestAnimationFrame(callback),
    cancel = (id) => cancelAnimationFrame(id),
    now = () => performance.now(),
  } = {},
) {
  let pending = null;
  let previous = 0;
  let disposed = false;
  const blocked = new Set();
  function stop() {
    if (pending !== null) cancel(pending);
    pending = null;
  }
  function wake() {
    if (disposed || blocked.size || pending !== null) return;
    previous = now();
    pending = request(tick);
  }
  function tick(time) {
    pending = null;
    if (disposed || blocked.size) return;
    const dt = Math.min(0.032, Math.max(0, (time - previous) / 1000));
    previous = time;
    if (draw(time, dt) && !disposed && !blocked.size && pending === null) {
      pending = request(tick);
    }
  }
  return {
    wake,
    block(reason, value) {
      if (value) {
        blocked.add(reason);
        stop();
      } else {
        blocked.delete(reason);
        wake();
      }
    },
    destroy() {
      disposed = true;
      stop();
    },
  };
}
