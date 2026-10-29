import { createGL, program, setUniforms, drawQuad, clearCache } from './gl';
import { interactions, type Pointer } from './registry';
import { SdObject } from './object';

export class SdScene extends HTMLElement {
  static get observedAttributes() { return ['interaction', 'effect', 'theme', 'paused', 'gravity-strength']; }
  canvas!: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null = null;
  objects = new Set<SdObject>();
  pointer: Pointer = { x: 0, y: 0, inside: false };
  interactionNames: string[] = [];
  effectNames: string[] = [];
  theme: 'auto' | 'dark' | 'light' = 'auto';
  dpr = 1; width = 0; height = 0;
  private raf = 0; private last = 0; private t0 = 0;
  private visible = true; private paused = false;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>`;
    this.canvas = root.querySelector('canvas')!;
  }

  connectedCallback() {
    if (!this.gl) {
      this.gl = createGL(this.canvas);
      if (!this.gl) { this.dataset.fallback = ''; }
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); });
      this.canvas.addEventListener('webglcontextrestored', () => { clearCache(this.gl!); this.start(); });
    }
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.visible ? this.start() : this.stop(); });
    this.io.observe(this);
    this.addEventListener('pointermove', this.onPointer);
    this.addEventListener('pointerleave', this.onLeave);
    document.addEventListener('visibilitychange', this.onVis);
    for (const el of this.querySelectorAll('*')) if (el instanceof SdObject) this.attach(el);
    this.measure();
    this.start();
  }
  disconnectedCallback() {
    this.stop();
    this.ro?.disconnect(); this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
  }
  attributeChangedCallback(name: string, _o: string | null, v: string | null) {
    const val = v ?? '';
    if (name === 'interaction') { this.interactionNames = val.split(/\s+/).filter(Boolean); this.interactionNames.forEach((n) => interactions.get(n)?.setup?.(this)); }
    else if (name === 'effect') this.effectNames = val.split(/\s+/).filter(Boolean);
    else if (name === 'theme') this.theme = (val as typeof this.theme) || 'auto';
    else if (name === 'paused') { this.paused = v !== null; this.paused ? this.stop() : this.start(); }
  }

  attach(o: SdObject) {
    if (this.objects.has(o)) return;
    this.objects.add(o); o.scene = this;
    this.ro?.observe(o);
    this.measure();
  }
  detach(o: SdObject) { this.objects.delete(o); o.scene = null; this.ro?.unobserve(o); }

  get themeValue(): number {
    if (this.theme === 'dark') return 0;
    if (this.theme === 'light') return 1;
    return matchMedia('(prefers-color-scheme: light)').matches ? 1 : 0;
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
  };
  private onLeave = () => { this.pointer.inside = false; };
  private onVis = () => { document.hidden ? this.stop() : this.start(); };

  measure() {
    const host = this.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = host.width; this.height = host.height;
    const w = Math.round(host.width * this.dpr), h = Math.round(host.height * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    for (const o of this.objects) {
      const r = o.getBoundingClientRect();
      o.rect = new DOMRect(r.left - host.left, r.top - host.top, r.width, r.height);
    }
  }

  start() {
    if (this.raf || !this.gl || !this.isConnected || this.paused || !this.visible || document.hidden) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.t0) this.t0 = now;
    const dt = this.last ? Math.min(now - this.last, 100) : 16;
    this.last = now;
    this.frame((now - this.t0) / 1000, dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Advance one frame and draw. Public so tests and tools can render synchronously. */
  frame(t: number, dt: number) {
    const gl = this.gl;
    if (!gl || this.width === 0 || this.height === 0) return;
    for (const o of this.objects) o.update(t, dt);
    for (const n of this.interactionNames) interactions.get(n)?.frame(this, dt, this.pointer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    const theme = this.themeValue;
    const sorted = [...this.objects].filter((o) => o.rect && !o.broken).sort((a, b) => a.anim.z - b.anim.z);
    for (const o of sorted) this.draw(gl, o, t, theme);
    gl.disable(gl.SCISSOR_TEST);
  }

  private draw(gl: WebGL2RenderingContext, o: SdObject, t: number, theme: number) {
    const r = o.rect!;
    const bleed = o.manifest.bleed ?? 1.5;
    const cx = r.x + r.width / 2 + o.anim.offset[0], cy = r.y + r.height / 2 + o.anim.offset[1];
    const qw = r.width * bleed, qh = r.height * bleed;
    const x = Math.round((cx - qw / 2) * this.dpr), y = Math.round((this.height - cy - qh / 2) * this.dpr);
    const w = Math.round(qw * this.dpr), h = Math.round(qh * this.dpr);
    if (w <= 0 || h <= 0) return;
    let p;
    try { p = program(gl, o.frag); }
    catch (e) { o.broken = true; console.error(`[solids] <${o.manifest.tag}> shader failed:\n${(e as Error).message}`); return; }
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.useProgram(p.prog);
    const px = this.pointer.inside ? [((this.pointer.x - cx) / qw) * 2, -((this.pointer.y - cy) / qh) * 2] : [0, 0];
    setUniforms(gl, p, {
      uTime: t, uResolution: [w, h], uPointer: px, uRotation: o.anim.rotation,
      uScale: o.anim.scale / bleed, uState: o.state, uTheme: theme, uColor: o.color,
      ...o.uniforms,
    });
    drawQuad(gl);
  }
}
