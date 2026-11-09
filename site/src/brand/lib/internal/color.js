// Let the browser convert CSS color spaces to the renderer's sRGB channels.
export function resolveColor(value) {
  if (Array.isArray(value)) {
    if (value.length !== 3 || value.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1))
      throw new TypeError("RGB channels must be three finite numbers between 0 and 1.");
    return [...value];
  }
  if (typeof value !== "string") throw new TypeError("Expected a CSS color or RGB array.");
  value = value.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map(v => v + v).join("") : hex[1];
    return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16) / 255);
  }
  const rgb = /^rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/.exec(value);
  if (rgb) return rgb.slice(1, 4).map(channel => Math.min(255, Number(channel)) / 255);
  if (typeof value !== "string" || !CSS.supports("color", value))
    throw new TypeError("color must be a CSS color or an RGB channel array.");
  // Contextual CSS values are not meaningful on a detached drawing surface.
  if (/var\(|currentcolor|^(inherit|initial|unset|revert(?:-layer)?)$/i.test(value))
    throw new TypeError("Resolve contextual colors through the heading's CSS before mounting.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas color conversion is unavailable.");
  // CSS.supports can accept syntax that this browser's Canvas parser cannot.
  ctx.fillStyle = "#010203";
  ctx.fillStyle = value;
  const first = ctx.fillStyle;
  ctx.fillStyle = "#040506";
  ctx.fillStyle = value;
  if (ctx.fillStyle !== first) throw new TypeError("This browser cannot render the supplied color.");
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3), channel => channel / 255);
}
