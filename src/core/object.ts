import { ease, lerp, rotXYZ, IDENTITY, parseColor, type Mat3 } from './math';
import { objects, animations, effectAttrs, effectParam, kebab, type Manifest, type AnimResult } from './registry';
import type { SdScene } from './scene';

const STATES: Record<string, number> = { off: 0, idle: 0.25, busy: 0.6, active: 1 };
const CORE_ATTRS = ['animation', 'speed', 'effect', 'state', 'color', 'size', 'gravity', 'gravity-gap'];
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export type Pose = { rotation: [number, number, number]; offset: [number, number]; scale: number; state: number };

export class SdObject extends HTMLElement {
  static manifest: Manifest;
  static frag: string;
  static get observedAttributes() { return [...CORE_ATTRS, ...this.manifest.uniforms.map((u) => kebab(u.name)), ...effectAttrs()]; }

  get manifest(): Manifest { return (this.constructor as typeof SdObject).manifest; }
  get frag(): string { return (this.constructor as typeof SdObject).frag; }

  scene: SdScene | null = null;
  rect: DOMRect | null = null;           // layout rect relative to the scene, px
  uniforms: Record<string, number | number[]> = {};
  rgb: [number, number, number] = [0.61, 0.82, 1];
  colorSrc = '#9bd1ff';                   // last accepted `color`, re-parsed once the scene's color space is known
  stateValue = 0.25; stateTarget = 0.25;
  speedValue = 1;
  animNames: string[] = [];
  effectNames: string[] = [];
  effectParams: Record<string, Record<string, number>> = {};
  anim = { rotation: new Float32Array(IDENTITY) as Mat3, offset: [0, 0] as [number, number], scale: 1, z: 0, state: 0 };
  pose: Pose | null = null;               // last composed animation pose
  broken = false;                         // shader failed to compile; skip drawing
  private phase = 0;                      // animation time, advanced by dt × speed
  private prevPose: Pose | null = null;   // pose at the moment `animation` changed, for the cross-fade
  private blend = 1;                      // 0 → 1 over 400 ms after a change

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>`;
    for (const u of this.manifest.uniforms) this.uniforms[u.name] = coerce(u.default, u.type) ?? 0;
  }

  connectedCallback() {
    const outer = this.closest('sd-scene') as SdScene | null;
    const inner = this.shadowRoot!.querySelector('sd-scene') as SdScene | null;
    if (outer) {
      if (inner) { inner.detach(this); inner.remove(); }
      outer.attach?.(this);
    } else if (inner) {
      inner.attach(this);
    } else {
      // Lone object: host a one-object scene in the shadow root so the page layout is untouched.
      const scene = document.createElement('sd-scene') as SdScene;
      this.shadowRoot!.append(scene);
      scene.attach(this);
    }
  }
  disconnectedCallback() { this.scene?.detach(this); }

  attributeChangedCallback(name: string, _old: string | null, v: string | null) {
    const val = v ?? '';
    switch (name) {
      case 'animation':
        this.animNames = val.split(/\s+/).filter(Boolean);
        if (this.pose) { this.prevPose = this.pose; this.blend = 0; }
        return;
      case 'effect': this.effectNames = val.split(/\s+/).filter(Boolean); return;
      case 'speed': { const n = Number(val); this.speedValue = val === '' || isNaN(n) ? 1 : n; return; }
      case 'state': this.stateTarget = STATES[val] ?? 0.25; return;
      case 'color': this.recolor(val); return;
      case 'size': this.style.setProperty('--sd-size', val); return;
      case 'gravity': case 'gravity-gap': return; // read by the gravity interaction
    }
    if (effectParam(name, v, this.effectParams)) return;
    const u = this.manifest.uniforms.find((u) => kebab(u.name) === name);
    if (u) {
      const c = coerce(v === null || v === '' ? u.default : v, u.type);
      if (c !== null) this.uniforms[u.name] = c;
    }
  }

  /** Parse `s` in the scene's color space (sRGB until attached). An unparseable string keeps the current color. */
  recolor(s = this.colorSrc) {
    const c = s ? parseColor(s, this.scene?.colorSpace) : null;
    if (c) { this.rgb = c; this.colorSrc = s; }
  }

  /** Per-frame: ease state, advance the animation phase, run animations, cross-fade after an `animation` change. */
  update(dt: number) {
    this.stateValue = ease(this.stateValue, this.stateTarget, dt, 150);
    if (!reducedMotion()) this.phase += (dt / 1000) * this.speedValue;
    const pose: Pose = { rotation: [0, 0, 0], offset: [0, 0], scale: 1, state: 0 };
    for (const name of this.animNames) {
      const r: AnimResult | undefined = animations.get(name)?.fn(this.phase, this.speedValue, this);
      if (!r) continue;
      if (r.rotation) for (let i = 0; i < 3; i++) pose.rotation[i] += r.rotation[i];
      if (r.offset) { pose.offset[0] += r.offset[0]; pose.offset[1] += r.offset[1]; }
      if (r.scale !== undefined) pose.scale *= r.scale;
      if (r.state !== undefined) pose.state += r.state;
      if (r.uniforms) Object.assign(this.uniforms, r.uniforms);
    }
    let out = pose;
    if (this.prevPose && this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 400);
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      const p = this.prevPose;
      out = {
        rotation: [0, 1, 2].map((i) => lerpAngle(p.rotation[i], pose.rotation[i], k)) as Pose['rotation'],
        offset: [lerp(p.offset[0], pose.offset[0], k), lerp(p.offset[1], pose.offset[1], k)],
        scale: lerp(p.scale, pose.scale, k), state: lerp(p.state, pose.state, k),
      };
    }
    this.pose = out;
    this.anim.rotation = rotXYZ(out.rotation[0], out.rotation[1], out.rotation[2]);
    this.anim.offset = [out.offset[0], out.offset[1]];
    this.anim.scale = out.scale;
    this.anim.state = out.state;
    this.anim.z = 0;
  }
}

/** Interpolate angles along the short way round, so a long-running spin never unwinds. */
function lerpAngle(a: number, b: number, k: number) {
  const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * k;
}

function coerce(v: unknown, type: 'float' | 'vec3' | 'color'): number | number[] | null {
  if (type === 'float') { const n = typeof v === 'number' ? v : Number(v); return isNaN(n) ? null : n; }
  if (type === 'color') { if (Array.isArray(v)) return v; const c = parseColor(String(v)); return c; }
  if (Array.isArray(v)) return v;
  const parts = String(v).split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? parts : null;
}

let rmq: MediaQueryList | null = null;
export function reducedMotion() {
  if ((window as any).__SD_REDUCED !== undefined) return !!(window as any).__SD_REDUCED;
  rmq ??= matchMedia('(prefers-reduced-motion: reduce)');
  return rmq.matches;
}

// Every observed attribute is also a property (camelCase), reflecting to the attribute.
export function reflect(proto: object, attrs: string[]) {
  for (const a of attrs) {
    if (Object.getOwnPropertyDescriptor(proto, camel(a))) continue;
    Object.defineProperty(proto, camel(a), {
      get(this: HTMLElement) { return this.getAttribute(a); },
      set(this: HTMLElement, v: unknown) { v == null ? this.removeAttribute(a) : this.setAttribute(a, String(v)); },
    });
  }
}

export function defineObject(manifest: Manifest, frag: string) {
  if (!manifest?.tag || customElements.get(manifest.tag)) return;
  objects.set(manifest.name, { manifest, frag });
  const El = class extends SdObject { static manifest = manifest; static frag = frag; };
  reflect(El.prototype, El.observedAttributes);
  customElements.define(manifest.tag, El);
}
