export function nativeFallback(canvas) {
  canvas.remove();
  const noop = () => {};
  return {
    supported: false,
    refresh: noop,
    pulse: noop,
    setDetail: noop,
    setMode: noop,
    setConsumed: noop,
    setFinish: noop,
    setFlow: noop,
    setFrozen: noop,
    setIntensity: noop,
    destroy: noop,
  };
}

// Repeated font/resize notifications must not regenerate expensive glyph masks.
export function layoutKey(element, host) {
  const box = host.getBoundingClientRect(),
    style = getComputedStyle(element);
  return [
    element.textContent,
    element.lang,
    box.width,
    box.height,
    devicePixelRatio,
    style.fontFamily,
    style.fontSize,
    style.fontWeight,
    style.fontStyle,
    style.lineHeight,
    style.letterSpacing,
    style.wordSpacing,
    style.fontKerning,
    style.fontStretch,
    style.fontVariantCaps,
    style.textRendering,
    style.direction,
    style.textAlign,
    style.whiteSpace,
  ].join("|");
}

export function boundedNumber(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

// Own only our presentation changes; preserve the source text and inline styling.
export function sourcePresentation(element) {
  const color = element.style.getPropertyValue("color"),
    priority = element.style.getPropertyPriority("color"),
    hadClass = element.classList.contains("material-source");
  let hidden = false;
  return {
    hide() {
      hidden = true;
      element.classList.add("material-source");
      element.style.setProperty("color", "transparent", "important");
    },
    restore() {
      if (!hidden) return;
      hidden = false;
      if (color) element.style.setProperty("color", color, priority);
      else element.style.removeProperty("color");
      if (!hadClass) element.classList.remove("material-source");
    },
  };
}
