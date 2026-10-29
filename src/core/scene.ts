import { createGL, initState, program, setUniforms, drawQuad, clearCache, type Program, type ColorSpace } from './gl';
import { createFBO, resizeFBO, type FBO } from './fbo';
import { interactions, effects, effectAttrs, effectParam, interactionAttrs, interactionParam, type Pointer } from './registry';
import { SdObject, reducedMotion } from './object';
import copyFrag from './copy.glsl';

export class SdScene extends HTMLElement {
  static get observedAttributes() { return ['interaction', 'effect', 'theme', 'paused', 'dpr', ...effectAttrs(), ...interactionAttrs()]; }
  canvas!: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null = null;
  colorSpace: ColorSpace = 'srgb';   // the drawing buffer's space; object colors are parsed into it
  objects = new Set<SdObject>();
  pointer: Pointer = { x: 0, y: 0, inside: false };
  interactionNames: string[] = [];
  effectNames: string[] = [];
  effectParams: Record<string, Record<string, number>> = {};
  interactionParams: Record<string, Record<string, number>> = {};
  theme: 'auto' | 'dark' | 'light' = 'auto';
  pixelRatio = 1; maxDpr = 2; width = 0; height = 0;
  private raf = 0; private last = 0; private t0 = 0;
  private visible = true; private paused = false;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private fbos: { scene: FBO; a: FBO; b: FBO; oa: FBO; ob: FBO } | null = null;
  private clock = 0;   // shader time; stops advancing under reduced motion

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>`;
    this.canvas = root.querySelector('canvas')!;
  }

  connectedCallback() {
    if (!this.gl) {
      const g = createGL(this.canvas);
      this.gl = g?.gl ?? null; this.colorSpace = g?.colorSpace ?? 'srgb';
      if (!this.gl) { this.dataset.fallback = ''; for (const o of this.objects) o.dataset.fallback = ''; }
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); });
      this.canvas.addEventListener('webglcontextrestored', () => {
        clearCache(this.gl!); this.fbos = null; initState(this.gl!);
        for (const o of this.objects) o.broken = false;
        this.start();
      });
    }
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.visible ? this.start() : this.stop(); });
    this.io.observe(this);
    this.addEventListener('pointermove', this.onPointer);
    this.addEventListener('pointerleave', this.onLeave);
    document.addEventListener('visibilitychange', this.onVis);
    for (const el of this.querySelectorAll('*')) if (el instanceof SdObject) this.attach(el);
    for (const o of this.objects) this.ro.observe(o);
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
    else if (name === 'dpr') { const n = Number(val); this.maxDpr = val && !isNaN(n) && n > 0 ? n : 2; this.measure(); }
    else if (name === 'paused') { this.paused = v !== null; this.paused ? this.stop() : this.start(); }
    else if (!effectParam(name, v, this.effectParams)) interactionParam(name, v, this.interactionParams);
  }

  attach(o: SdObject) {
    if (this.objects.has(o)) return;
    this.objects.add(o); o.scene = this; o.recolor();
    // Keep DOM order: "first center wins" and draw-order ties follow the markup.
    this.objects = new Set([...this.objects].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)));
    if (this.isConnected && !this.gl) o.dataset.fallback = '';
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
    this.pixelRatio = Math.min(devicePixelRatio || 1, this.maxDpr);
    this.width = host.width; this.height = host.height;
    const w = Math.round(host.width * this.pixelRatio), h = Math.round(host.height * this.pixelRatio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    for (const o of this.objects) {
      const r = o.getBoundingClientRect();
      o.rect = new DOMRect(r.left - host.left, r.top - host.top, r.width, r.height);
    }
  }

  start() {
    if (this.raf || !this.gl || this.gl.isContextLost() || !this.isConnected || this.paused || !this.visible || document.hidden) return;
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
    const W = this.canvas.width, H = this.canvas.height;
    if (!gl || W === 0 || H === 0) return;
    if (!reducedMotion()) this.clock = t;
    t = this.clock;
    for (const o of this.objects) o.update(dt);
    for (const n of this.interactionNames) interactions.get(n)?.frame(this, dt, this.pointer);
    const f = this.fbos ??= { scene: createFBO(gl, W, H), a: createFBO(gl, W, H), b: createFBO(gl, W, H), oa: createFBO(gl, 1, 1), ob: createFBO(gl, 1, 1) };
    resizeFBO(gl, f.scene, W, H); resizeFBO(gl, f.a, W, H); resizeFBO(gl, f.b, W, H);
    const theme = this.themeValue;

    // 1. Objects into the scene buffer.
    this.bind(gl, f.scene, 0, 0, W, H, true);
    const sorted = [...this.objects].filter((o) => o.rect && !o.broken).sort((a, b) => a.anim.z - b.anim.z);
    for (const o of sorted) this.draw(gl, o, t, theme, f);

    // 2. Scene effect chain, ping-pong, then blit to the canvas.
    let src = f.scene;
    const chain = this.effectNames.filter((n) => effects.has(n));
    for (const name of chain) {
      const dst = src === f.a ? f.b : f.a;
      this.bind(gl, dst, 0, 0, W, H, true);
      this.pass(gl, name, src, this.effectParams[name], [W, H], t, theme);
      src = dst;
    }
    this.bind(gl, null, 0, 0, W, H, true);
    this.blit(gl, src);
  }

  private bind(gl: WebGL2RenderingContext, fbo: FBO | null, x: number, y: number, w: number, h: number, clear: boolean) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo?.fb ?? null);
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.enable(gl.SCISSOR_TEST);
    if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  private blit(gl: WebGL2RenderingContext, src: FBO) {
    const p = program(gl, copyFrag, 'effect');
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
    setUniforms(gl, p, { uScene: [0] });
    drawQuad(gl);
  }
  private pass(gl: WebGL2RenderingContext, name: string, src: FBO, params: Record<string, number> | undefined, res: [number, number], t: number, theme: number) {
    const e = effects.get(name)!;
    let p: Program;
    try { p = program(gl, e.frag, 'effect'); }
    catch (err) { console.error(`[solids] effect "${name}" shader failed:\n${(err as Error).message}`); this.blit(gl, src); return; }
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
    const defaults: Record<string, number> = {};
    for (const d of e.manifest.params) defaults[d.name] = d.default as number;
    setUniforms(gl, p, { uScene: [0], uResolution: res, uTime: t, uTheme: theme, uMix: params?.mix ?? 1, ...defaults, ...params });
    drawQuad(gl);
  }

  private draw(gl: WebGL2RenderingContext, o: SdObject, t: number, theme: number, f: NonNullable<typeof this.fbos>) {
    const r = o.rect!;
    const bleed = o.manifest.bleed ?? 1.5;
    const cx = r.x + r.width / 2 + o.anim.offset[0], cy = r.y + r.height / 2 + o.anim.offset[1];
    const qw = r.width * bleed, qh = r.height * bleed;
    const x = Math.round((cx - qw / 2) * this.pixelRatio), y = Math.round((this.height - cy - qh / 2) * this.pixelRatio);
    const w = Math.round(qw * this.pixelRatio), h = Math.round(qh * this.pixelRatio);
    if (w <= 0 || h <= 0) return;
    let p: Program;
    try { p = program(gl, o.frag); }
    catch (e) { o.broken = true; console.error(`[solids] <${o.manifest.tag}> shader failed:\n${(e as Error).message}`); return; }
    const chain = o.effectNames.filter((n) => effects.has(n));
    // With its own effects the object renders into a quad-sized buffer first.
    if (chain.length) { resizeFBO(gl, f.oa, w, h); resizeFBO(gl, f.ob, w, h); this.bind(gl, f.oa, 0, 0, w, h, true); }
    else this.bind(gl, f.scene, x, y, w, h, false);
    gl.useProgram(p.prog);
    const px = this.pointer.inside ? [((this.pointer.x - cx) / qw) * 2, -((this.pointer.y - cy) / qh) * 2] : [0, 0];
    setUniforms(gl, p, {
      uTime: t, uResolution: [w, h], uPointer: px, uRotation: o.anim.rotation,
      uScale: o.anim.scale / bleed, uState: Math.min(1, Math.max(0, o.stateValue + o.anim.state)), uTheme: theme, uColor: o.rgb,
      ...o.uniforms,
    });
    drawQuad(gl);
    if (!chain.length) return;
    let src = f.oa;
    for (const name of chain) {
      const dst = src === f.oa ? f.ob : f.oa;
      this.bind(gl, dst, 0, 0, w, h, true);
      this.pass(gl, name, src, o.effectParams[name], [w, h], t, theme);
      src = dst;
    }
    this.bind(gl, f.scene, x, y, w, h, false);
    this.blit(gl, src);
  }
}
