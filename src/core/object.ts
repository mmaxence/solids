import { ease, lerp, rotXYZ, IDENTITY, parseColor, type Mat3 } from './math';
import { objects, animations, effectAttrs, effectParam, shadeAttrs, shadeParam, kebab, num, clampTo, type Manifest, type AnimResult } from './registry';
import type { SdScene } from './scene';

const STATES = new Map([['off', 0], ['idle', 0.25], ['busy', 0.6], ['active', 1]]);
const CORE_ATTRS = ['animation', 'speed', 'effect', 'shading', 'state', 'color', 'size', 'phase', 'theme', 'gravity', 'gravity-gap'];
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export type Pose = { rotation: [number, number, number]; offset: [number, number]; scale: number; state: number };
/** A distance field the shader may sample as `uField` (R8: 0.5 is the edge, signed distance in texels up to `range`, positive outside,
 * rows top down). The core uploads it once per `version` and binds it on texture unit 1 with `uFieldSize` and `uFieldRange`. */
export type Field = { data: Uint8Array; width: number; height: number; range: number; version: number };

export class SdObject extends HTMLElement {
  static manifest: Manifest;
  static frag: string;
  static get observedAttributes() { return [...CORE_ATTRS, ...this.manifest.uniforms.map((u) => kebab(u.name)), ...effectAttrs(), ...shadeAttrs()]; }

  get manifest(): Manifest { return (this.constructor as typeof SdObject).manifest; }
  get frag(): string { return (this.constructor as typeof SdObject).frag; }

  scene: SdScene | null = null;
  rect: DOMRect | null = null;           // layout rect relative to the scene, px
  uniforms: Record<string, number> = {};
  rgb: [number, number, number] = [0.61, 0.82, 1];
  colorSrc = '#9bd1ff';                   // last accepted `color`, re-parsed once the scene's color space is known
  stateValue = 0.25; stateTarget = 0.25;
  speedValue = 1;
  animNames: string[] = [];
  effectNames: string[] = [];
  effectParams: Record<string, Record<string, number>> = {};
  shadeName = 'auto';                     // `shading` attribute (reflected as .shading); auto follows the scene, then the theme
  shadeParams: Record<string, Record<string, number>> = {};
  anim = { rotation: new Float32Array(IDENTITY) as Mat3, offset: [0, 0] as [number, number], scale: 1, z: 0, state: 0 };
  pose: Pose | null = null;               // last composed animation pose
  pinned = false;                         // held in place this frame (a gravity center or orbiter); collide treats it as a wall
  blurPx = 0;                             // depth-of-field blur for this frame (a universe sets it); draw adds a defocus pass. Not `blur`: HTMLElement has one
  field: Field | null = null;             // an optional distance-field texture for the shader (text uses it)
  broken = false;                         // shader failed to compile; skip drawing
  private clock = 0;                      // animation time, advanced by dt × speed
  phaseOffset = 0;                        // `phase` attribute: seconds added to the animation clock, so siblings never line up
  private prevPose: Pose | null = null;   // pose at the moment `animation` changed, for the cross-fade
  private blend = 1;                      // 0 → 1 over 400 ms after a change

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>`;
    for (const u of this.manifest.uniforms) this.uniforms[u.name] = clampTo(num(String(u.default), 0), u);
  }

  connectedCallback() {
    const outer = this.closest('sd-scene, sd-universe') as SdScene | null;
    const inner = this.shadowRoot!.querySelector('sd-scene') as SdScene | null;
    if (outer) {
      if (inner) { inner.detach(this); inner.remove(); }
      outer.attach?.(this);
    } else if (inner) {
      inner.attach(this);
    } else {
      // Lone object: host a one-object scene in the shadow root so the page layout is untouched.
      const scene = document.createElement('sd-scene') as SdScene;
      if (this.hasAttribute('theme')) scene.setAttribute('theme', this.getAttribute('theme')!);
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
      case 'shading': this.shadeName = val.trim() || 'auto'; return;
      case 'speed': this.speedValue = num(val, 1); return;
      case 'state': this.stateTarget = STATES.get(val) ?? 0.25; return;
      case 'theme': this.shadowRoot!.querySelector('sd-scene')?.setAttribute('theme', val); return; // a lone object's own scene
      case 'color': this.recolor(val || '#9bd1ff'); return;
      case 'size': // in the shadow stylesheet, so a framework rewriting the inline style cannot wipe it
        (this.shadowRoot!.querySelectorAll('style')[1] as HTMLStyleElement).textContent = val ? `:host{width:${val}}` : '';
        return;
      case 'phase': this.phaseOffset = num(val, 0); return;
      case 'gravity': case 'gravity-gap': return; // read by the gravity interaction
    }
    if (effectParam(name, v, this.effectParams) || shadeParam(name, v, this.shadeParams)) return;
    const u = this.manifest.uniforms.find((u) => kebab(u.name) === name);
    if (u) this.uniforms[u.name] = clampTo(num(v, u.default), u);
  }

  /** Parse `s` in the scene's color space (sRGB until attached). An unparseable string keeps the current color. */
  recolor(s = this.colorSrc) {
    const c = s ? parseColor(s, this.scene?.colorSpace) : null;
    if (c) { this.rgb = c; this.colorSrc = s; }
  }

  /** Where the object is drawn this frame: its layout center plus the offsets animations and interactions added so far, in scene px. (Not center() or radius(): uniform names reflect as properties.) */
  drawCenter(): [number, number] { const r = this.rect!; return [r.x + r.width / 2 + this.anim.offset[0], r.y + r.height / 2 + this.anim.offset[1]]; }
  /** Half the drawn size this frame, in scene px. */
  drawRadius(): number { return (this.rect!.width / 2) * this.anim.scale; }

  /** Per-frame: ease state, advance the animation phase, run animations, cross-fade after an `animation` change. */
  update(dt: number) {
    this.stateValue = ease(this.stateValue, this.stateTarget, dt, 150);
    this.pinned = false; this.blurPx = 0;
    const still = reducedMotion();
    if (!still) this.clock += (dt / 1000) * this.speedValue;
    const pose: Pose = { rotation: [0, 0, 0], offset: [0, 0], scale: 1, state: 0 };
    for (const name of this.animNames) {
      // Reduced motion shows the rest pose (t = 0), whatever the phase says.
      const r: AnimResult | undefined = animations.get(name)?.fn(still ? 0 : this.clock + this.phaseOffset, this.speedValue, this);
      if (!r) continue;
      if (r.rotation) for (let i = 0; i < 3; i++) pose.rotation[i] += r.rotation[i];
      if (r.offset) { pose.offset[0] += r.offset[0]; pose.offset[1] += r.offset[1]; }
      if (r.scale !== undefined) pose.scale *= r.scale;
      if (r.state !== undefined) pose.state += r.state;
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
    if (camel(a) in proto) { console.warn(`[solids] attribute "${a}" is not reflected: it would shadow the ${camel(a)} member`); continue; } // HTMLElement's too: proto inherits it
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
