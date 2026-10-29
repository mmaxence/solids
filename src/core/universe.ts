import { SdScene } from './scene';
import { SdObject } from './object';
import { objects, num } from './registry';

// The site's six Display P3 picks; browsers without P3 clip them to sRGB.
const PALETTE = ['color(display-p3 0.55 0.85 1)', 'color(display-p3 0.78 0.66 1)', 'color(display-p3 1 0.55 0.8)', 'color(display-p3 0.5 1 0.85)', 'color(display-p3 1 0.8 0.5)', 'color(display-p3 0.55 1 0.6)'];
const ANIMS = ['idle', 'float', 'spin'];
const OWN = ['count', 'seed', 'gravity', 'depth', 'focus', 'shapes', 'palette'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const knownTags = () => new Set([...objects.values()].map((d) => d.manifest.tag));

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A scene that fills its box with seeded shapes at different depths. The children are plain light-DOM
 * objects with inline positions, so the markup it leaves behind is a universe you can copy and hand-edit.
 */
export class SdUniverse extends SdScene {
  static get observedAttributes() { return [...SdScene.observedAttributes, ...OWN]; }
  private ready = false;

  constructor() {
    super();
    // Edge shapes spill past the box by half their size; the canvas clips them anyway, so clip the layout too (no page overflow).
    this.shadowRoot!.append(Object.assign(document.createElement('style'), { textContent: ':host{overflow:hidden}' }));
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.ready) return;
    this.ready = true;
    // First connect: keep object children that came with the markup (a pasted universe), else populate.
    // Inserted together, they upgrade after this callback, so match by tag and refocus once they have.
    const known = knownTags();
    [...this.children].some((c) => known.has(c.localName)) ? queueMicrotask(() => this.applyDepth()) : this.generate();
  }

  attributeChangedCallback(name: string, o: string | null, v: string | null) {
    if (name === 'interaction' || name === 'gravity') {
      super.attributeChangedCallback('interaction', o, this.getAttribute('interaction'));
      if (this.hasAttribute('gravity') && !this.interactionNames.includes('gravity')) this.interactionNames.unshift('gravity');
    } else if (!OWN.includes(name)) return super.attributeChangedCallback(name, o, v);
    if (!this.ready || name === 'interaction') return;
    name === 'depth' || name === 'focus' ? this.applyDepth() : this.generate();
  }

  kids() { return [...this.children].filter((c): c is SdObject => c instanceof SdObject); }

  /** Replace the object children with a fresh seeded set. */
  generate() {
    for (const c of this.kids()) c.remove();
    const known = knownTags();
    const listed = (this.getAttribute('shapes') ?? '').split(/\s+/).filter(Boolean).map((t) => (t.startsWith('sd-') ? t : 'sd-' + t));
    const tags = (listed.length ? listed : [...known]).filter((t) => known.has(t));
    // Space separated, but a color like color(display-p3 1 0.5 0.5) keeps its inner spaces.
    const colors = this.getAttribute('palette')?.match(/[^\s(]+(\([^)]*\))?/g) ?? PALETTE;
    const n = tags.length ? clamp(Math.round(num(this.getAttribute('count'), 24)), 0, 120) : 0;
    const rnd = mulberry32(num(this.getAttribute('seed'), 1));
    const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const specs = Array.from({ length: n }, () => {
      const z = rnd() * 2 - 1;
      // Nearer shapes run larger on average: 40 to 140 px.
      return { tag: pick(tags), x: 6 + rnd() * 88, y: 6 + rnd() * 88, z, size: Math.round(40 + 100 * (0.55 * rnd() + 0.225 * (z + 1))), color: pick(colors), anim: pick(ANIMS), speed: 0.2 + rnd() * 0.3, role: '' };
    });
    if (this.hasAttribute('gravity') && n) {
      // The largest shape is the center, moved to the middle; the nearest third of the rest orbit it.
      const center = specs.reduce((a, b) => (b.size > a.size ? b : a));
      const orbit = specs.filter((s) => s !== center).sort((a, b) => b.z - a.z).slice(0, Math.round((n - 1) / 3));
      for (const s of specs) s.role = s === center ? 'center' : orbit.includes(s) ? 'orbit' : 'none';
      center.x = center.y = 50;
      // Sit the center among its orbiters so they pass both behind and in front of it.
      if (orbit.length) center.z = orbit.reduce((t, s) => t + s.z, 0) / orbit.length;
    }
    const frag = document.createDocumentFragment();
    for (const s of specs.sort((a, b) => a.z - b.z)) {
      const el = document.createElement(s.tag);
      el.dataset.z = s.z.toFixed(2);
      el.setAttribute('size', s.size + 'px');
      el.setAttribute('color', s.color);
      el.setAttribute('animation', s.anim);
      if (s.anim === 'spin') el.setAttribute('speed', s.speed.toFixed(1));
      if (s.role) el.setAttribute('gravity', s.role);
      el.style.cssText = `position:absolute;left:${s.x.toFixed(1)}%;top:${s.y.toFixed(1)}%;translate:-50% -50%`;
      frag.append(el);
    }
    this.append(frag);
    this.applyDepth();
  }

  /** Depth of field from `depth` and `focus` on the existing children: defocus radius, dimming, draw order. */
  applyDepth() {
    const depth = clamp(num(this.getAttribute('depth'), 0.5), 0, 1), focus = clamp(num(this.getAttribute('focus'), 0), -1, 1);
    for (const o of this.kids()) {
      const z = num(o.dataset.z, 0);
      const r = Math.min(24, Math.round(depth * Math.abs(z - focus) * 140) / 10);
      o.z = z;
      const fx = (o.getAttribute('effect') ?? '').split(/\s+/).filter((e) => e && e !== 'defocus');
      // In focus (under the shader's 0.5 px floor): no defocus pass at all, so sharp shapes cost nothing extra.
      if (r >= 0.5) { fx.push('defocus'); o.setAttribute('defocus-radius', String(r)); } else o.removeAttribute('defocus-radius');
      fx.length ? o.setAttribute('effect', fx.join(' ')) : o.removeAttribute('effect');
      o.setAttribute('state', depth > 0 && z < focus ? 'idle' : 'active');
    }
  }
}
