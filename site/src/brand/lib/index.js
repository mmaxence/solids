import { resolveColor } from "./internal/color.js";
import { boundedNumber } from "./internal/renderer-utils.js";
// Import-safe on the server. Family modules own renderer and shader dependencies.
const mounted = new WeakMap();
const hosts = new WeakMap();
function acquireHost(host) {
  let state = hosts.get(host);
  if (!state) {
    state = {
      count: 0,
      position: host.style.getPropertyValue("position"),
      priority: host.style.getPropertyPriority("position"),
      changed: getComputedStyle(host).position === "static",
    };
    hosts.set(host, state);
    if (state.changed) host.style.setProperty("position", "relative");
  }
  state.count++;
  return () => {
    if (--state.count) return;
    if (state.changed && host.style.position === "relative") {
      if (state.position)
        host.style.setProperty("position", state.position, state.priority);
      else host.style.removeProperty("position");
    }
    hosts.delete(host);
  };
}
export function createTextEffect(element, options = {}) {
  if (typeof document === "undefined")
    throw new Error("Create text effects only after mounting in a browser.");
  if (!element || element.nodeType !== 1 || !element.isConnected)
    throw new TypeError("Expected a connected text element.");
  if (element.children.length)
    throw new TypeError(
      "Use a plain-text element; nested markup is not supported yet.",
    );
  if (mounted.has(element))
    throw new Error(
      "This element already has an effect. Destroy it before attaching another.",
    );
  if (typeof options.effect?.mount !== "function")
    throw new TypeError("Import an effect from a Materia family entry.");
  const host = options.host ?? element.parentElement;
  if (!host || host === element || !host.contains(element))
    throw new TypeError("host must be an ancestor of the text element.");
  const color = resolveColor(typeof options.color === "string" && options.color.trim().toLowerCase() === "currentcolor"
    ? getComputedStyle(element).color : options.color ?? getComputedStyle(element).color);
  const originalSpacing = element.style.getPropertyValue("letter-spacing");
  const spacingPriority = element.style.getPropertyPriority("letter-spacing");
  let ownsSpacing = false;
  function applySpacing(value) {
    const css = typeof value === "number" && Number.isFinite(value) ? `${value}px` : value;
    if (typeof css !== "string" || !CSS.supports("letter-spacing", css))
      throw new TypeError("letterSpacing must be a CSS length, normal, or a finite pixel value.");
    element.style.setProperty("letter-spacing", css);
    ownsSpacing = true;
  }
  function restoreSpacing() {
    if (!ownsSpacing) return;
    if (originalSpacing) element.style.setProperty("letter-spacing", originalSpacing, spacingPriority);
    else element.style.removeProperty("letter-spacing");
  }
  if (options.letterSpacing !== undefined) applySpacing(options.letterSpacing);
  const releaseHost = acquireHost(host);
  let renderer;
  try {
    renderer = options.effect.mount(element, {
      ...options,
      host,
      color,
      intensity: options.strength ?? 0.7,
      detail: options.scale ?? 10,
    });
  } catch (error) {
    releaseHost();
    restoreSpacing();
    throw error;
  }
  let disposed = false,
    queued = false;
  const safe =
    (fn) =>
    (...args) => {
      if (!disposed) return fn(...args);
    };
  const refresh = safe(() => renderer.refresh());
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      refresh();
    });
  });
  observer.observe(element, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  const controller = {
    get supported() {
      return renderer.supported;
    },
    refresh,
    setLetterSpacing: safe((value) => { applySpacing(value); refresh(); }),
    setLayer: safe((index, changes) => {
      if (!renderer.setLayer)
        throw new Error("setLayer requires a stack effect.");
      renderer.setLayer(index, changes);
    }),
    pulse: safe(() => renderer.pulse()),
    setStrength: safe((v) => {
      strength = boundedNumber(v, 0, 1, strength);
      renderer.setIntensity(strength);
      if (options.effect.kind === "signal")
        renderer.setFinish(options.effect.mode, strength, signalScale);
    }),
    setScale: safe((v) => {
      renderer.setDetail(v);
      if (options.effect.kind === "signal") {
        signalScale = boundedNumber(v, 1, 24, signalScale);
        renderer.setFinish(options.effect.mode, strength, signalScale);
      }
    }),
    setAuto: safe((v) => renderer.setFlow(Boolean(v))),
    setFrozen: safe((v) => renderer.setFrozen(Boolean(v))),
    setWaterline: safe((v) => renderer.setWaterline?.(boundedNumber(v, .4, .95, .65))),
    setConsumptionProgress: safe((v) => renderer.setConsumptionProgress?.(v === null ? null : boundedNumber(v, 0, 1, 0))),
    setConsumed: safe((v) => renderer.setConsumed?.(Boolean(v))),
    setSignal: safe((amount, scale = signalScale) => {
      if (!options.signal && options.effect.kind !== "signal")
        throw new Error("Attach a signal before calling setSignal.");
      signalScale = boundedNumber(scale, 1, 24, signalScale);
      renderer.setFinish?.(
        (options.signal ?? options.effect).mode,
        amount,
        signalScale,
      );
    }),
    destroy() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.destroy();
      releaseHost();
      restoreSpacing();
      mounted.delete(element);
    },
  };
  let strength = options.strength ?? 0.7,
    signalScale = options.signalScale ?? options.scale ?? 10;
  renderer.setIntensity(strength);
  renderer.setDetail(options.scale ?? 10);
  renderer.setFlow(options.auto ?? false);
  renderer.setFrozen(options.frozen ?? false);
  mounted.set(element, controller);
  return controller;
}
