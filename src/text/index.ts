import { SdObject, reflect } from '../core/object';
import { num, clampTo, type Manifest } from '../core/registry';
import frag from './frag.glsl';

const manifest: Manifest = {
  name: 'text', tag: 'sd-text',
  description: 'Your HTML text as a solid: the letters of the element it wraps, extruded and shaded.',
  uniforms: [
    { name: 'depth', type: 'float', default: 0.35, min: 0.02, max: 1, step: 0.01, label: 'Thickness' },
    { name: 'bevel', type: 'float', default: 0.25, min: 0, max: 1, step: 0.01, label: 'Edge rounding' },
  ],
};

let canvas: HTMLCanvasElement | null = null;

/**
 * `<sd-text>Solids</sd-text>` or `<sd-text><h1>Solids</h1></sd-text>`: the light DOM is the text. The element keeps the wrapped
 * HTML's layout box and accessibility node, makes its text transparent, and draws a 3D twin over it from a signed distance field
 * rasterized with the computed CSS font. `pixel` rasterizes at that cell size for the pixel-font look from any monospace.
 * `size` is a no-op: `font-size` rules. Every shade, effect, animation and interaction applies, like any object.
 */
export class SdText extends SdObject {
  static manifest = manifest;
  static frag = frag;
  static get observedAttributes() { return [...super.observedAttributes, 'pixel']; }
  private cell = 0;                 // `pixel` attribute: raster cell in CSS px, 0 for smooth glyphs
  private version = 0;
  private queued = false;
  private mo: MutationObserver | null = null;
  private sizeWatch: ResizeObserver | null = null;

  constructor() {
    super();
    const root = this.shadowRoot!;
    root.append(Object.assign(document.createElement('style'), { textContent:
      ':host{display:inline-block;width:auto;aspect-ratio:auto;white-space:nowrap;line-height:1;color:transparent;-webkit-text-fill-color:transparent;user-select:none;-webkit-user-select:none}:host([data-fallback]){color:inherit;-webkit-text-fill-color:inherit}slot{display:block}' }),
      document.createElement('slot'));
  }
  connectedCallback() {
    super.connectedCallback();
    this.mo ??= new MutationObserver(() => this.rebuild());
    this.mo.observe(this, { childList: true, characterData: true, subtree: true });
    this.sizeWatch ??= new ResizeObserver(() => { if (this.cell) this.rebuild(); }); // pixel cells follow the CSS size
    this.sizeWatch.observe(this);
    (document as any).fonts?.ready.then(() => this.rebuild());
    this.rebuild();
  }
  disconnectedCallback() { super.disconnectedCallback(); this.mo?.disconnect(); this.sizeWatch?.disconnect(); }
  attributeChangedCallback(name: string, old: string | null, v: string | null) {
    if (name === 'size') return;                                   // the box is the text
    if (name === 'pixel') { this.cell = clampTo(num(v, 0), { min: 0, max: 24 }); this.rebuild(); return; }
    super.attributeChangedCallback(name, old, v);
  }
  /** Re-rasterize at the next frame (coalesced): on text, font, `pixel` or, in pixel mode, size changes. */
  rebuild() {
    if (this.queued || !this.isConnected) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; if (this.isConnected) this.raster(); });
  }
  private raster() {
    const text = (this.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Aa';
    const cs = getComputedStyle(this.firstElementChild ?? this);
    const fontPx = parseFloat(cs.fontSize) || 16;
    const em = this.cell > 0 ? Math.max(4, Math.round(fontPx / this.cell)) : 96; // em height in texels
    const range = this.cell > 0 ? 3 : 16;
    const c = (canvas ??= document.createElement('canvas'));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${em}px ${cs.fontFamily}`;
    const spacing = (parseFloat(cs.letterSpacing) || 0) / fontPx * em;
    const setFont = () => { ctx.font = font; if ('letterSpacing' in ctx) (ctx as any).letterSpacing = spacing + 'px'; };
    setFont();
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent ?? em * 0.8, desc = m.fontBoundingBoxDescent ?? em * 0.2;
    const w = Math.min(2048, Math.ceil(m.width) + 2 * range), h = em + 2 * range;
    c.width = w; c.height = h; setFont();
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, range, range + (asc / (asc + desc)) * em); // the em box holds the glyphs; descenders dip into the padding
    const img = ctx.getImageData(0, 0, w, h).data;
    const inside = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) inside[i] = img[i * 4 + 3] >= 102 ? 1 : 0;
    const data = sdf(inside, w, h, range);
    this.field = { data, width: w, height: h, range, version: ++this.version };
  }
}

/** Exact signed Euclidean distance (texels, positive outside) of a mask, packed to bytes over +-range: 128 is the edge. */
function sdf(inside: Uint8Array, w: number, h: number, range: number): Uint8Array {
  const INF = 1e20, n = w * h;
  const dIn = new Float32Array(n), dOut = new Float32Array(n);
  for (let i = 0; i < n; i++) { dIn[i] = inside[i] ? 0 : INF; dOut[i] = inside[i] ? INF : 0; }
  for (const g of [dIn, dOut]) edt2d(g, w, h);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const d = Math.sqrt(dIn[i]) - Math.sqrt(dOut[i]); out[i] = Math.max(0, Math.min(255, Math.round(128 + (d / range) * 127))); }
  return out;
}
/** Felzenszwalb and Huttenlocher: squared distance transform, rows then columns, in place. */
function edt2d(g: Float32Array, w: number, h: number) {
  const size = Math.max(w, h), f = new Float32Array(size), d = new Float32Array(size), v = new Int32Array(size), z = new Float32Array(size + 1);
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, d, v, z, w); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; }
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, d, v, z, h); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
}
function edt1d(f: Float32Array, d: Float32Array, v: Int32Array, z: Float32Array, n: number) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

if (!customElements.get('sd-text')) { reflect(SdText.prototype, SdText.observedAttributes); customElements.define('sd-text', SdText); }
