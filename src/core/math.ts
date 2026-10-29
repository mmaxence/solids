export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Exponential smoothing toward target; tau in ms. */
export const ease = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / Math.max(tau, 1)));

export type Mat3 = Float32Array;
export const IDENTITY: Mat3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Column-major mat3 from XYZ Euler angles (radians). */
export function rotXYZ(rx: number, ry: number, rz: number): Mat3 {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx
  return new Float32Array([
    cy * cz, cy * sz, -sy,
    sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy,
    cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy,
  ]);
}

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const o = new Float32Array(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++)
    o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
}

type Rgb = [number, number, number];
let ctx: CanvasRenderingContext2D | null = null;
const parsed = new Map<string, Rgb | null>();

/**
 * Any CSS color → [0..1, 0..1, 0..1] in `space`; null when the browser rejects it.
 * sRGB hex and rgb() take a fast path; everything else is painted on a 1×1 canvas and read back in `space`.
 */
export function parseColor(s: string, space: 'display-p3' | 'srgb' = 'srgb'): Rgb | null {
  s = s.trim();
  if (space === 'srgb') {
    let m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map((c) => parseInt(c + c, 16) / 255) as Rgb;
    m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16) / 255) as Rgb;
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) { const p = m[1].split(/[\s,\/]+/).map(Number); if (p.length >= 3 && p.every((n) => !isNaN(n))) return [p[0] / 255, p[1] / 255, p[2] / 255]; }
  }
  const key = space + s;
  if (parsed.has(key)) return parsed.get(key)!;
  // A P3 canvas keeps wide colors for a P3 read; browsers without colorSpace ignore both options and stay sRGB.
  const c = (ctx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { colorSpace: 'display-p3', willReadFrequently: true }));
  if (!c) return null;
  // A rejected string leaves fillStyle as it was, so two different starting values end up different.
  c.fillStyle = '#000'; c.fillStyle = s; const a = c.fillStyle;
  c.fillStyle = '#fff'; c.fillStyle = s;
  let rgb: Rgb | null = null;
  if (a === c.fillStyle) {
    c.clearRect(0, 0, 1, 1); c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1, { colorSpace: space }).data;
    rgb = [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  if (parsed.size > 256) parsed.clear(); // ponytail: wipe, not LRU; a color picker drag adds one entry per value
  parsed.set(key, rgb);
  return rgb;
}
