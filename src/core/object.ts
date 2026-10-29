import { ease, lerp, rotXYZ, IDENTITY, parseColor, type Mat3 } from './math';
import { objects, animations, effectAttrs, effectParam, kebab, type Manifest, type AnimResult } from './registry';
import type { SdScene } from './scene';

const STATES: Record<string, number> = { off: 0, idle: 0.25, busy: 0.6, active: 1 };
const CORE_ATTRS = ['animation', 'speed', 'effect', 'state', 'color', 'size', 'gravity'];
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export class SdObject extends HTMLElement {
  static manifest: Manifest;
  static frag: string;
  static get observedAttributes() { return [...CORE_ATTRS, ...this.manifest.uniforms.map((u) => kebab(u.name)), ...effectAttrs()]; }

  get manifest(): Manifest { return (this.constructor as typeof SdObject).manifest; }
  get frag(): string { return (this.constructor as typeof SdObject).frag; }

  scene: SdScene | null = null;
  rect: DOMRect | null = null;           // layout rect relative to the scene, px
  uniforms: Record<string, number | number[]> = {};
  color: [number, number, number] = [0.61, 0.82, 1];
  state = 0.25; stateTarget = 0.25;
  speed = 1;
  animNames: string[] = [];
  effectNames: string[] = [];
  effectParams: Record<string, Record<string, number>> = {};
  anim = { rotation: new Float32Array(IDENTITY) as Mat3, offset: [0, 0] as [number, number], scale: 1, z: 0, state: 0 };
  private prevPose: Pose | null = null;   // pose at the moment `animation` changed, for the cross-fade
  private blend = 1;                      // 0 → 1 over 400 ms after a change
  broken = false;                         // shader failed to compile; skip drawing

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>`;
    for (const u of this.manifest.uniforms) this.uniforms[u.name] = coerce(u.default, u.type) ?? 0;
  }

  connectedCallback() {
    const scene = this.closest('sd-scene') as SdScene | null;
    if (scene) scene.attach?.(this);
    else this.standalone();
  }
  disconnectedCallback() { this.scene?.detach(this); }
  /** Lone object outside any scene; implemented in a later task. */
  protected standalone() { /* ponytail: filled in by Task 7 */ }

  attributeChangedCallback(name: string, _old: string | null, v: string | null) {
    const val = v ?? '';
    switch (name) {
      case 'animation':
        this.animNames = val.split(/\s+/).filter(Boolean);
        if (this.lastPose) { this.prevPose = this.lastPose; this.blend = 0; }
        return;
      case 'effect': this.effectNames = val.split(/\s+/).filter(Boolean); return;
      case 'speed': this.speed = Number(val) || 1; return;
      case 'state': this.stateTarget = STATES[val] ?? 0.25; return;
      case 'color': { const c = parseColor(val); if (c) this.color = c; return; }
      case 'size': this.style.setProperty('--sd-size', val); return;
      case 'gravity': return; // read by the gravity interaction
    }
    if (effectParam(name, val, this.effectParams)) return;
    const u = this.manifest.uniforms.find((u) => kebab(u.name) === name);
    if (u) {
      const c = coerce(val, u.type);
      if (c !== null) this.uniforms[u.name] = c;
    }
  }

  private lastPose: Pose | null = null;

  /** Per-frame: ease state, run animations, cross-fade after an `animation` change. */
  update(t: number, dt: number) {
    this.state = ease(this.state, this.stateTarget, dt, 150);
    const tt = reducedMotion() ? 0 : t * this.speed;
    const pose: Pose = { rotation: [0, 0, 0], offset: [0, 0], scale: 1, state: 0 };
    for (const name of this.animNames) {
      const r: AnimResult | undefined = animations.get(name)?.fn(tt, this.speed, this);
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
        rotation: [0, 1, 2].map((i) => lerp(p.rotation[i], pose.rotation[i], k)) as Pose['rotation'],
        offset: [lerp(p.offset[0], pose.offset[0], k), lerp(p.offset[1], pose.offset[1], k)],
        scale: lerp(p.scale, pose.scale, k), state: lerp(p.state, pose.state, k),
      };
    }
    this.lastPose = out;
    this.anim.rotation = rotXYZ(out.rotation[0], out.rotation[1], out.rotation[2]);
    this.anim.offset = [out.offset[0], out.offset[1]];
    this.anim.scale = out.scale;
    this.anim.state = out.state;
    this.anim.z = 0;
  }
}

type Pose = { rotation: [number, number, number]; offset: [number, number]; scale: number; state: number };

let rmq: MediaQueryList | null = null;
function reducedMotion() {
  if ((window as any).__SD_REDUCED !== undefined) return !!(window as any).__SD_REDUCED;
  rmq ??= matchMedia('(prefers-reduced-motion: reduce)');
  return rmq.matches;
}

function coerce(v: unknown, type: 'float' | 'vec3' | 'color'): number | number[] | null {
  if (type === 'float') { const n = typeof v === 'number' ? v : Number(v); return isNaN(n) ? null : n; }
  if (type === 'color') { if (Array.isArray(v)) return v; const c = parseColor(String(v)); return c; }
  if (Array.isArray(v)) return v;
  const parts = String(v).split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? parts : null;
}

// Attributes mirror as properties on the prototype (animation, speed, …, and manifest uniforms via defineObject).
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
  reflect(El.prototype, El.observedAttributes.filter((a) => !['color', 'speed', 'state'].includes(a)));
  customElements.define(manifest.tag, El);
}
