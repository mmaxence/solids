// Canvas exposes only a subset of CSS typography; detect each optional property.
export function applyTypography(ctx, style) {
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const stretches = { "50%": "ultra-condensed", "62.5%": "extra-condensed", "75%": "condensed", "87.5%": "semi-condensed", "100%": "normal", "112.5%": "semi-expanded", "125%": "expanded", "150%": "extra-expanded", "200%": "ultra-expanded" };
  for (const key of ["fontKerning", "fontStretch", "fontVariantCaps", "textRendering", "direction"]) {
    if (key in ctx && style[key]) ctx[key] = key === "fontStretch" ? stretches[style[key]] ?? style[key] : style[key];
  }
  let positioned = false;
  for (const key of ["letterSpacing", "wordSpacing"]) {
    const value = style[key] === "normal" ? "0px" : style[key] || "0px";
    if (key in ctx) ctx[key] = value;
    else if (parseFloat(value) !== 0) positioned = true;
  }
  // DOM-positioned graphemes must not receive Canvas spacing a second time.
  if (positioned) for (const key of ["letterSpacing", "wordSpacing"]) if (key in ctx) ctx[key] = "0px";
  return positioned;
}
// Browser layout remains authoritative; this raster is only a decorative twin.
export function rasterize(element, host, dpr = 1) {
  const box = host.getBoundingClientRect();
  const raster = document.createElement("canvas");
  raster.width = Math.max(1, Math.round(box.width * dpr));
  raster.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = raster.getContext("2d", { willReadFrequently: true }),
    style = getComputedStyle(element);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "white";
  const positionedGlyphs = applyTypography(ctx, style);
  const node = element.firstChild;
  if (node?.nodeType === Node.TEXT_NODE) {
    const lines = [];
    const segments = new Intl.Segmenter(element.lang || undefined, {
      granularity: "grapheme",
    }).segment(node.textContent);
    for (const part of segments) {
      const range = document.createRange();
      range.setStart(node, part.index);
      range.setEnd(node, part.index + part.segment.length);
      const b = range.getBoundingClientRect();
      if (!b.width) continue;
      let line = lines.find((l) => Math.abs(l.top - b.top) < 2);
      if (!line) {
        line = { top: b.top, left: b.left, height: b.height, text: "", glyphs: [] };
        lines.push(line);
      }
      line.glyphs.push({ text: part.segment, left: b.left });
      line.text += part.segment;
      line.left = Math.min(line.left, b.left);
    }
    for (const line of lines) {
      const metrics = ctx.measureText(line.text);
      const ascent =
        metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
      const descent =
        metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * 0.2;
      const baseline = line.top - box.top + (line.height - ascent - descent) / 2 + ascent;
      if (positionedGlyphs) {
        for (const glyph of line.glyphs) ctx.fillText(glyph.text, glyph.left - box.left, baseline);
      } else ctx.fillText(line.text, line.left - box.left, baseline);
    }
  }
  return raster;
}
