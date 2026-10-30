import { SdScene } from './scene';
import { SdObject, reducedMotion } from './object';
import { objects, num } from './registry';
import { clamp, ease, rotXYZ, mul3, type Mat3 } from './math';

type V3 = [number, number, number];
/** One shape in the universe: position and velocity in world units (a unit ball), radius from its px size. */
export type Body = { el: SdObject; p: V3; v: V3; r: number; tilt: Mat3; wob: number[] };

// The site's six Display P3 picks; browsers without P3 clip them to sRGB.
export const PALETTE = ['color(display-p3 0.55 0.85 1)', 'color(display-p3 0.78 0.66 1)', 'color(display-p3 1 0.55 0.8)', 'color(display-p3 0.5 1 0.85)', 'color(display-p3 1 0.8 0.5)', 'color(display-p3 0.55 1 0.6)'];
const ANIMS = ['idle', 'float', 'spin'];
const OWN = ['count', 'seed', 'collide', 'camera', 'speed', 'drift', 'perspective', 'depth', 'focus', 'shapes', 'palette'];
const REGEN = ['count', 'seed', 'shapes', 'palette'];
const REF = 640;                 // px box in which world radius 1 is the half side: a body's world radius is size / REF
const DEG = Math.PI / 180;
const knownTags = () => new Set([...objects.values()].map((d) => d.manifest.tag));
const len = (p: V3) => Math.hypot(p[0], p[1], p[2]);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A scene that fills its box with seeded shapes in a 3D ball, seen through a perspective camera that spins,
 * drags and tilts toward the pointer. Children are plain light-DOM objects with a `data-pos`, so the markup
 * it leaves behind is a universe you can copy and hand-edit.
 */
export class SdUniverse extends SdScene {
  static get observedAttributes() { return [...SdScene.observedAttributes, ...OWN]; }
  /** Camera angles in radians: yaw around the vertical axis, pitch around the horizontal one. */
  yaw = 0; pitch = 0;
  private body = new WeakMap<SdObject, Body>();   // one per child, made on first sight from the seeded stream
  private rnd = mulberry32(1);
  /** The bodies of the current children, in DOM order. */
  get bodies(): Body[] { return [...this.objects].map((o) => this.bodyOf(o)); }
  private ready = false;
  private simTime = 0;                       // sim clock for the wobble (frozen under reduced motion)
  private drag: { id: number; x: number; y: number; t: number } | null = null;
  private vel = [0, 0];                   // drag inertia, rad per ms
  private spinGain = 1;                   // eases out while dragging and back in after
  private tilt = [0, 0];                  // pointer tilt, eased

  constructor() {
    super();
    // Every child sits on the box center; the camera places it. Edge shapes spill past the box; clip the layout too (no page overflow).
    this.shadowRoot!.append(Object.assign(document.createElement('style'), { textContent:
      ':host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}' }));
    this.addEventListener('pointerdown', this.onDown);
    this.addEventListener('pointermove', this.onMove);
    this.addEventListener('pointerup', this.onUp);
    this.addEventListener('pointercancel', this.onUp);
    this.addEventListener('lostpointercapture', this.onUp);
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.ready) return;
    this.ready = true;
    // First connect: keep object children that came with the markup (a pasted universe), else populate.
    // Inserted together, they upgrade after this callback, so match by tag and adopt once they have.
    const known = knownTags();
    [...this.children].some((c) => known.has(c.localName)) ? queueMicrotask(() => this.adopt()) : this.generate();
  }

  attributeChangedCallback(name: string, o: string | null, v: string | null) {
    if (!OWN.includes(name)) return super.attributeChangedCallback(name, o, v);
    if (this.ready && REGEN.includes(name)) this.generate();
  }

  kids() { return [...this.children].filter((c): c is SdObject => c instanceof SdObject); }
  private cam() { return new Set((this.getAttribute('camera') ?? 'spin drag pointer').split(/\s+/)); }

  /** Replace the object children with a fresh seeded set. */
  generate() {
    for (const c of this.kids()) c.remove();
    const known = knownTags();
    const listed = (this.getAttribute('shapes') ?? '').split(/\s+/).filter(Boolean).map((t) => (t.startsWith('sd-') ? t : 'sd-' + t));
    const tags = (listed.length ? listed : [...known]).filter((t) => known.has(t));
    // Space separated, but a color like color(display-p3 1 0.5 0.5) keeps its inner spaces.
    const colors = this.getAttribute('palette')?.match(/[^\s,(]+(\([^)]*\))?/g) ?? PALETTE;
    const n = tags.length ? clamp(Math.round(num(this.getAttribute('count'), 24)), 0, 120) : 0;
    const rnd = mulberry32(num(this.getAttribute('seed'), 1));
    const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const ball = (): V3 => { for (;;) { const p: V3 = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; if (len(p) <= 1) return p; } };
    const specs: { tag: string; p: V3; r: number; size: number; color: string; anim: string; speed: number; phase: number }[] = [];
    for (let i = 0; i < n; i++) {
      const size = 8 * Math.round((40 + 100 * rnd()) / 8), r = size / REF;
      // Best candidate of eight: the one farthest from every placed body, surfaces apart, so the cloud spreads evenly.
      let best: V3 = ball(), bestD = -Infinity;
      for (let k = 0; k < 8; k++) {
        const c = ball(); let d = 2;
        for (const s of specs) d = Math.min(d, len(sub(c, s.p)) - r - s.r);
        if (d > bestD) { bestD = d; best = c; }
      }
      specs.push({ tag: pick(tags), p: best, r, size, color: pick(colors), anim: pick(ANIMS), speed: 0.6 + rnd() * 0.8, phase: rnd() * 20 });
    }
    const frag = document.createDocumentFragment();
    for (const s of specs) {
      const el = document.createElement(s.tag);
      el.dataset.pos = s.p.map((v) => v.toFixed(2)).join(' ');
      el.setAttribute('size', s.size + 'px');
      el.setAttribute('color', s.color);
      el.setAttribute('animation', s.anim);
      el.setAttribute('speed', s.speed.toFixed(2));
      el.setAttribute('phase', s.phase.toFixed(1));
      frag.append(el);
    }
    this.append(frag);
    this.adopt();
  }

  /** Reset the seeded motion stream; bodies are made per child on first sight (`bodyOf`), so late children get one too. */
  adopt() {
    this.rnd = mulberry32(num(this.getAttribute('seed'), 1) * 7919 + 17);
    this.body = new WeakMap();
  }
  /** The body of a child: `data-pos` (or a seeded spot), size, and seeded drift, wobble and tilt. */
  private bodyOf(el: SdObject): Body {
    let b = this.body.get(el);
    if (b) return b;
    const rnd = this.rnd;
    const parts = (el.dataset.pos ?? '').split(/\s+/).map(Number);
    const p: V3 = parts.length === 3 && parts.every((v) => !isNaN(v)) ? [parts[0], parts[1], parts[2]] : norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]).map((v) => v * rnd()) as V3;
    const v = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]).map((x) => x * (0.02 + rnd() * 0.04)) as V3;
    const wob: number[] = []; for (let k = 0; k < 3; k++) wob.push(0.05 + rnd() * 0.1, rnd() * 2 * Math.PI, 0.02 + rnd() * 0.03);
    const size = Math.max(num((el.getAttribute('size') ?? '').replace('px', ''), 80), 1);
    b = { el, p, v, r: size / REF, tilt: rotXYZ((rnd() - 0.5) * 70 * DEG, 0, (rnd() - 0.5) * 70 * DEG), wob };
    this.body.set(el, b);
    return b;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.cam().has('drag') || !e.isPrimary || e.button !== 0 || this.drag) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }; this.vel = [0, 0];
    this.classList.add('sd-dragging');
    try { this.setPointerCapture(e.pointerId); } catch {}
  };
  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (e.buttons === 0) return this.onUp(e); // the release went elsewhere (a context menu, a window switch)
    const dt = Math.max(8, e.timeStamp - d.t), dy = (e.clientX - d.x) * 0.006, dp = (e.clientY - d.y) * 0.006;
    this.yaw += dy; this.pitch = clamp(this.pitch + dp, -60 * DEG, 60 * DEG);
    this.vel = [dy / dt, dp / dt];
    this.drag = { id: d.id, x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || (e.pointerId !== d.id && e.type !== 'lostpointercapture')) return;
    this.drag = null; this.classList.remove('sd-dragging');
    // A fling needs a moving release: a pointer held still for 80 ms lets go of its last velocity.
    if (reducedMotion() || e.timeStamp - d.t > 80) this.vel = [0, 0];
  };

  /** Per frame: move the camera and the bodies, resolve collisions, then place every child on screen. */
  protected step(dt: number) {
    const W = this.width, H = this.height;
    if (!W || !H) return;
    const still = reducedMotion(), cam = this.cam();
    const speed = Math.max(0, num(this.getAttribute('speed'), 1)), drift = still ? 0 : clamp(num(this.getAttribute('drift'), 0.5), 0, 1);
    const depth = clamp(num(this.getAttribute('depth'), 0.5), 0, 1), focus = clamp(num(this.getAttribute('focus'), 0), -1, 1);
    const D = 1.6 / clamp(num(this.getAttribute('perspective'), 0.5), 0.05, 1);
    // Camera: spin eases out while dragging and back in after; inertia decays after a release.
    if (this.drag) this.spinGain = Math.max(0, this.spinGain - dt / 300);
    else {
      this.spinGain = Math.min(1, this.spinGain + dt / 2000);
      if (cam.has('spin') && !still) this.yaw += (dt / 1000) * (2 * Math.PI / 90) * speed * this.spinGain;
      this.yaw += this.vel[0] * dt; this.pitch = clamp(this.pitch + this.vel[1] * dt, -60 * DEG, 60 * DEG);
      const k = Math.exp(-dt / 600); this.vel[0] *= k; this.vel[1] *= k;
    }
    const on = cam.has('pointer') && this.pointer.inside;
    this.tilt[0] = ease(this.tilt[0], on ? (clamp(this.pointer.x / W, 0, 1) * 2 - 1) * 12 * DEG : 0, dt, 150); // front shapes move toward the pointer; a captured drag can leave the box
    this.tilt[1] = ease(this.tilt[1], on ? (clamp(this.pointer.y / H, 0, 1) * 2 - 1) * 8 * DEG : 0, dt, 150);
    const yaw = this.yaw + this.tilt[0], pitch = this.pitch + this.tilt[1];
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Sideways the cloud uses the whole half width (rim shapes may pass partly out, the spin brings them back); vertically it stays inside.
    const Ux = (W / 2) * 0.95, Uy = (H / 2) * 0.95 * (D - 0.6) / D;
    if (!still) this.simTime += dt / 1000;
    // Bodies drift and turn back at the edge of the ball.
    const bodies = this.bodies;
    if (drift > 0) for (const b of bodies) {
      for (let k = 0; k < 3; k++) b.p[k] += b.v[k] * (dt / 1000) * drift;
      const l = len(b.p);
      if (l > 1) {
        const rad = (b.p[0] * b.v[0] + b.p[1] * b.v[1] + b.p[2] * b.v[2]) / l;
        if (rad > 0) for (let k = 0; k < 3; k++) b.v[k] -= 2 * rad * b.p[k] / l;
        for (let k = 0; k < 3; k++) b.p[k] /= l;
      }
    }
    if (this.hasAttribute('collide')) this.collide(bodies);
    // Project: yaw about y, pitch about x, then perspective; z toward the camera.
    for (const b of bodies) {
      const o = b.el.anim, w = b.wob;
      const q: V3 = [b.p[0], b.p[1], b.p[2]];
      if (drift > 0) for (let k = 0; k < 3; k++) q[k] += Math.sin(2 * Math.PI * w[k * 3] * this.simTime + w[k * 3 + 1]) * w[k * 3 + 2] * drift;
      const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy;
      const y2 = q[1] * cp - z1 * sp, z2 = q[1] * sp + z1 * cp;
      const rc = b.el.rect; if (!rc) continue; // not measured yet (a step before the first frame)
      const s = clamp(D / (D - z2), 0.3, 3);
      // From the box center, whatever the child's own layout puts it (author CSS, a framework's wrapper).
      o.offset[0] += W / 2 - (rc.x + rc.width / 2) + x1 * s * Ux; o.offset[1] += H / 2 - (rc.y + rc.height / 2) - y2 * s * Uy;
      o.scale *= s; o.z = z2;
      o.rotation = mul3(b.tilt, o.rotation);
      // Depth of field: blur away from the focal plane, dim behind it. The object field is read by draw(); under 0.5 px there is no pass.
      b.el.blurPx = Math.min(24, depth * Math.abs(z2 - focus) * 14);
      o.state -= 0.75 * depth * Math.max(0, focus - z2);
    }
  }

  /** Elastic sphere collisions: separate overlapping pairs and swap the normal velocity, four passes. Mass is the cubed radius. Scalar math, no allocation per pair. */
  private collide(bodies: Body[]) {
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2];
        const min = a.r + b.r, l2 = dx * dx + dy * dy + dz * dz;
        if (l2 >= min * min) continue;
        const l = Math.sqrt(l2);
        const nx = l < 1e-6 ? 1 : dx / l, ny = l < 1e-6 ? 0 : dy / l, nz = l < 1e-6 ? 0 : dz / l;
        const wi = 1 / (a.r * a.r * a.r), wj = 1 / (b.r * b.r * b.r), sum = wi + wj, push = min - l;
        a.p[0] -= nx * push * (wi / sum); a.p[1] -= ny * push * (wi / sum); a.p[2] -= nz * push * (wi / sum);
        b.p[0] += nx * push * (wj / sum); b.p[1] += ny * push * (wj / sum); b.p[2] += nz * push * (wj / sum);
        // Normal velocity exchange, only when approaching.
        const rel = (b.v[0] - a.v[0]) * nx + (b.v[1] - a.v[1]) * ny + (b.v[2] - a.v[2]) * nz;
        if (rel >= 0) continue;
        const jmp = (-2 * rel) / sum;
        a.v[0] -= nx * jmp * wi; a.v[1] -= ny * jmp * wi; a.v[2] -= nz * jmp * wi;
        b.v[0] += nx * jmp * wj; b.v[1] += ny * jmp * wj; b.v[2] += nz * jmp * wj;
      }
    }
  }
}
