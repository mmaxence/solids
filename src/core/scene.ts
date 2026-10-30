import { createGL, initState, program, setUniforms, drawQuad, clearCache, type Program, type ColorSpace } from './gl';
import { createFBO, resizeFBO, deleteFBO, type FBO } from './fbo';
import { interactions, effects, shades, resolveShade, effectAttrs, effectParam, interactionAttrs, interactionParam, shadeAttrs, shadeParam, type Pointer } from './registry';
import { SdObject, reducedMotion } from './object';
import copyFrag from './copy.glsl';

export class SdScene extends HTMLElement {
  static get observedAttributes() { return ['interaction', 'effect', 'shading', 'theme', 'paused', 'dpr', ...effectAttrs(), ...interactionAttrs(), ...shadeAttrs()]; }
  canvas!: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null = null;
  colorSpace: ColorSpace = 'srgb';   // the drawing buffer's space; object colors are parsed into it
  objects = new Set<SdObject>();
  pointer: Pointer = { x: 0, y: 0, inside: false, down: false, tap: null };
  private press: { id: number; x: number; y: number; t: number } | null = null; // the current press, for tap detection
  interactionNames: string[] = [];
  effectNames: string[] = [];
  shadeName = 'auto';                     // `shading` attribute: default shade for children whose own is unset
  shadeParams: Record<string, Record<string, number>> = {};
  effectParams: Record<string, Record<string, number>> = {};
  interactionParams: Record<string, Record<string, number>> = {};
  theme: 'auto' | 'dark' | 'light' = 'auto';
  pixelRatio = 1; maxDpr = 2; width = 0; height = 0;
  /** ms spent in `frame()` (EMA, alpha 0.1): the CPU side of one frame. */
  frameTime = 0;
  /** Frames per second from the rAF loop (EMA). */
  fps = 0;
  private gpuMs: number | null = null;
  private gpuOn = false;
  private query: WebGLQuery | null = null;   // one timer query in flight at a time
  private raf = 0; private last = 0;
  private visible = false; private paused = false;   // unseen until the IntersectionObserver says otherwise, so offscreen scenes compile nothing
  private dirty = false;                   // objects attached since the last sort and measure
  private frames = 0;
  private failed = new Set<string>();     // effect names whose shader failed on this context: passed through, logged once
  private maxTex = 8192;
  private lose: WEBGL_lose_context | null = null; // cached: getExtension returns null once the context is lost
  private fields = new Map<SdObject, { tex: WebGLTexture; v: number }>(); // uploaded field textures, by object
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private fbos: { scene: FBO | null; a: FBO | null; b: FBO | null; pool: Map<string, [FBO, FBO, number]>; used: Set<string> } | null = null;
  private clock = 0;   // shader time; stops advancing under reduced motion
  /** The scene clock in seconds: shader time, paused with the scene. */
  get time() { return this.clock; }

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
      else { this.maxTex = Math.min(8192, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)); this.lose = this.gl.getExtension('WEBGL_lose_context'); }
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); this.dataset.fallback = ''; if (this.isConnected) this.lose?.restoreContext(); }); // a release that raced a re-insert comes straight back
      this.canvas.addEventListener('webglcontextrestored', () => {
        clearCache(this.gl!); this.fbos = null; this.query = null; this.failed.clear(); this.fields.clear(); initState(this.gl!);
        for (const o of this.objects) o.broken = false;
        delete this.dataset.fallback;
        this.start();
      });
    } else if (this.gl.isContextLost()) this.lose?.restoreContext(); // released on disconnect, see below
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
    // Start only if on screen now; the observer takes over from its first report (offscreen scenes then compile nothing on load).
    const r = this.getBoundingClientRect();
    this.visible = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    this.io = new IntersectionObserver((es) => { this.visible = es[es.length - 1].isIntersecting; this.visible ? this.start() : this.stop(); });
    this.io.observe(this);
    this.addEventListener('pointermove', this.onPointer);
    this.addEventListener('pointerleave', this.onLeave);
    this.addEventListener('pointerdown', this.onPress);
    this.addEventListener('pointerup', this.onRelease);
    this.addEventListener('pointercancel', this.onCancelPress);
    document.addEventListener('visibilitychange', this.onVis);
    for (const el of this.querySelectorAll('*')) if (el instanceof SdObject && el.closest('sd-scene, sd-universe') === this) this.attach(el);
    for (const o of this.objects) this.ro.observe(o);
    this.measure();
    this.start();
  }
  disconnectedCallback() {
    this.stop();
    this.ro?.disconnect(); this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    // Browsers keep about 16 live contexts: give this one back unless the scene is only being moved.
    queueMicrotask(() => { if (!this.isConnected && this.gl && !this.gl.isContextLost()) this.lose?.loseContext(); });
  }
  attributeChangedCallback(name: string, _o: string | null, v: string | null) {
    const val = v ?? '';
    if (name === 'interaction') { this.interactionNames = val.split(/\s+/).filter(Boolean); this.interactionNames.forEach((n) => interactions.get(n)?.setup?.(this)); }
    else if (name === 'effect') this.effectNames = val.split(/\s+/).filter(Boolean);
    else if (name === 'shading') this.shadeName = val.trim() || 'auto';
    else if (name === 'theme') this.theme = (val as typeof this.theme) || 'auto';
    else if (name === 'dpr') { const n = Number(val); this.maxDpr = val && !isNaN(n) && n > 0 ? n : 2; this.measure(); }
    else if (name === 'paused') { this.paused = v !== null; this.paused ? this.stop() : this.start(); }
    else if (!effectParam(name, v, this.effectParams) && !shadeParam(name, v, this.shadeParams)) interactionParam(name, v, this.interactionParams);
  }

  attach(o: SdObject) {
    if (this.objects.has(o)) return;
    this.objects.add(o); o.scene = this; o.recolor();
    if (this.isConnected && !this.gl) o.dataset.fallback = '';
    this.ro?.observe(o);
    this.dirty = true; // sorted and measured once, at the next frame: a universe appends 120 at a time
  }
  /** Keep DOM order ("first center wins", draw-order ties follow the markup) and measure, once per batch of attaches. */
  private settle() {
    this.dirty = false;
    this.objects = new Set([...this.objects].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)));
    this.measure();
  }
  detach(o: SdObject) {
    this.objects.delete(o); o.scene = null; this.ro?.unobserve(o); this.dirty = true; // siblings re-measure at the next frame, once per batch
    const f = this.fields.get(o); if (f) { this.gl?.deleteTexture(f.tex); this.fields.delete(o); }
  }

  get themeValue(): number {
    if (this.theme === 'dark') return 0;
    if (this.theme === 'light') return 1;
    return (lightMq ??= matchMedia('(prefers-color-scheme: light)')).matches ? 1 : 0;
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.getBoundingClientRect();
    this.pointer.x = e.clientX - r.left; this.pointer.y = e.clientY - r.top; this.pointer.inside = true; // mutate: tap and down survive a move
  };
  private onLeave = () => { this.pointer.inside = false; this.pointer.down = false; };
  /** The scene this event belongs to: a nested scene keeps its presses and taps to itself. */
  private mine = (e: Event) => (e.target as Element).closest?.('sd-scene, sd-universe') === this;
  private onPress = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || !this.mine(e)) return;
    this.onPointer(e); // a finger has no move before its press
    this.pointer.down = true;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  private onRelease = (e: PointerEvent) => {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    this.press = null; this.pointer.down = false;
    if (!this.mine(e)) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8 && e.timeStamp - p.t < 400) { const r = this.getBoundingClientRect(); this.tap(e.clientX - r.left, e.clientY - r.top); }
  };
  private onCancelPress = () => { this.press = null; this.pointer.down = false; }; // a scroll flick on a phone: never a tap
  /** Tap the scene by hand at scene px: tap rules answer as if a finger had pressed there. */
  tap(x: number, y: number) { this.pointer.tap = { x, y }; }
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
    if (this.last) this.fps = ema(this.fps, 1000 / Math.max(now - this.last, 1));
    const dt = this.last ? Math.min(now - this.last, 100) : 16;
    this.last = now;
    this.frame(this.clock + dt / 1000, dt); // shader time is the scene clock, so pausing or hiding does not jump it
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Advance one frame and draw. Public so tests and tools can render synchronously. */
  frame(t: number, dt: number) {
    const gl = this.gl;
    if (this.dirty) this.settle(); // before the size is read: a measure may resize the canvas
    const W = this.canvas.width, H = this.canvas.height;
    if (!gl || gl.isContextLost() || W === 0 || H === 0) return;
    const start = performance.now();
    const timer = this.gpuOn ? this.gpuBegin(gl) : null;
    try { this.render(gl, W, H, t, dt); }
    finally {
      if (timer) gl.endQuery(timer.TIME_ELAPSED_EXT);
      if (this.frames++ > 0) this.frameTime = ema(this.frameTime, performance.now() - start); // the first frame compiles every program
    }
  }

  /** GPU ms per frame (EMA) from EXT_disjoint_timer_query_webgl2, or null where the browser lacks it. Reading it opts the scene in. */
  get gpuTime(): number | null { this.gpuOn = true; return this.gpuMs; }

  /** Collect the finished query, if any, then start the next one. Null when unsupported or the last one is still pending. */
  private gpuBegin(gl: WebGL2RenderingContext) {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return null;
    if (this.query) {
      if (!gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)) return null;
      const ns = gl.getQueryParameter(this.query, gl.QUERY_RESULT);
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && Number.isFinite(ns)) this.gpuMs = ema(this.gpuMs ?? 0, ns / 1e6);
    }
    gl.beginQuery(ext.TIME_ELAPSED_EXT, (this.query ??= gl.createQuery()));
    return ext;
  }

  private render(gl: WebGL2RenderingContext, W: number, H: number, t: number, dt: number) {
    if (!reducedMotion()) this.clock = t;
    t = this.clock;
    for (const o of this.objects) o.update(dt);
    this.step(dt);
    for (const n of this.interactionNames) interactions.get(n)?.frame(this, dt, this.pointer);
    const f = this.fbos ??= { scene: null, a: null, b: null, pool: new Map(), used: new Set() };
    const theme = this.themeValue;
    const chain = this.effectNames.filter((n) => effects.has(n));
    // Full-size buffers only when a scene effect needs them; otherwise objects go straight to the canvas (bit-identical, no copy).
    if (chain.length) { f.scene ??= createFBO(gl, W, H); f.a ??= createFBO(gl, W, H); f.b ??= createFBO(gl, W, H); resizeFBO(gl, f.scene, W, H); resizeFBO(gl, f.a, W, H); resizeFBO(gl, f.b, W, H); }
    else if (f.scene) { deleteFBO(gl, f.scene); deleteFBO(gl, f.a!); deleteFBO(gl, f.b!); f.scene = f.a = f.b = null; }
    const target = chain.length ? f.scene : null;

    // 1. Objects into the scene buffer, or the canvas.
    this.bind(gl, target, 0, 0, W, H, true);
    const sorted = [...this.objects].filter((o) => o.rect && !o.broken).sort((a, b) => (a.anim.z || 0) - (b.anim.z || 0));
    for (const o of sorted) this.draw(gl, o, t, theme, f, target);

    // 2. Scene effect chain, ping-pong, then blit to the canvas.
    if (chain.length) {
      let src = f.scene!;
      for (const name of chain) {
        const dst = src === f.a ? f.b! : f.a!;
        this.bind(gl, dst, 0, 0, W, H, true);
        this.pass(gl, name, src, this.effectParams[name], [W, H], t, theme);
        src = dst;
      }
      this.bind(gl, null, 0, 0, W, H, true);
      this.blit(gl, src);
    }
    // Drop per-object buffers for sizes unused for 60 frames: quads change size as objects scale, so a size that
    // skipped a few frames usually comes back, and reallocating it every time would stall the GPU.
    for (const [key, p] of f.pool) { if (f.used.has(key)) p[2] = 0; else if (++p[2] > 60) { deleteFBO(gl, p[0]); deleteFBO(gl, p[1]); f.pool.delete(key); } }
    f.used.clear();
  }

  /** Hook for subclasses: runs each frame after the objects update and before the interactions. */
  protected step(_dt: number) {}

  private bind(gl: WebGL2RenderingContext, fbo: FBO | null, x: number, y: number, w: number, h: number, clear: boolean) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo?.fb ?? null);
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h); // scissor test and clear color are set once in initState
    if (clear) gl.clear(gl.COLOR_BUFFER_BIT);
  }
  private blit(gl: WebGL2RenderingContext, src: FBO) {
    const p = program(gl, copyFrag, 'effect');
    gl.useProgram(p.prog);
    gl.bindTexture(gl.TEXTURE_2D, src.tex); // texture unit 0 is active for good
    setUniforms(gl, p, { uScene: [0] });
    drawQuad(gl);
  }
  private pass(gl: WebGL2RenderingContext, name: string, src: FBO, params: Record<string, number> | undefined, res: [number, number], t: number, theme: number) {
    const e = effects.get(name)!;
    if (this.failed.has(name)) return this.blit(gl, src);
    let p: Program;
    try { p = program(gl, e.frag, 'effect'); }
    catch (err) { this.failed.add(name); console.error(`[solids] effect "${name}" shader failed:\n${(err as Error).message}`); this.blit(gl, src); return; }
    gl.useProgram(p.prog);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    const defaults: Record<string, number> = {};
    for (const d of e.manifest.params) defaults[d.name] = d.default as number;
    setUniforms(gl, p, { uScene: [0], uResolution: res, uTime: t, uTheme: theme, uMix: params?.mix ?? 1, ...defaults, ...params });
    drawQuad(gl);
  }

  private draw(gl: WebGL2RenderingContext, o: SdObject, t: number, theme: number, f: NonNullable<typeof this.fbos>, target: FBO | null, W = this.canvas.width, H = this.canvas.height) {
    const r = o.rect!;
    const [cx, cy] = o.drawCenter();
    o.drawn = [cx, cy];
    // The quad follows the object's box and scale, in 8 device px steps so the buffer pool keys stay few; unit space is the box's short
    // side and uScale keeps the shape at exactly rect × scale. Squares render as before; a wide or tall box gets a matching quad.
    const sw = r.width * o.anim.scale * this.pixelRatio, sh = r.height * o.anim.scale * this.pixelRatio, sz = Math.min(sw, sh);
    const w = Math.ceil((sw * BLEED) / 8) * 8, h = Math.ceil((sh * BLEED) / 8) * 8;
    if (!(sz > 0) || w > this.maxTex || h > this.maxTex) return;
    const x = Math.round(cx * this.pixelRatio - w / 2), y = Math.round((this.height - cy) * this.pixelRatio - h / 2);
    if (x >= W || y >= H || x + w <= 0 || y + h <= 0) return; // off the canvas
    // Shade: the object's own `shading`, else the scene's, else auto (glass in dark, the light default in light).
    const shadeName = resolveShade(o.hasAttribute('shading') ? o.shadeName : this.shadeName, theme), shade = shades.get(shadeName)!;
    const shadeUniforms: Record<string, number> = {};
    for (const d of shade.manifest.params) shadeUniforms[d.name] = o.shadeParams[shadeName]?.[d.name] ?? this.shadeParams[shadeName]?.[d.name] ?? (d.default as number);
    let p: Program;
    try { p = program(gl, o.frag, 'object', { name: shadeName, frag: shade.frag }); }
    catch (e) { o.broken = true; console.error(`[solids] <${o.manifest.tag}> shader failed:\n${(e as Error).message}`); return; }
    const chain = o.effectNames.filter((n) => effects.has(n));
    if (o.blurPx >= 0.5 && !chain.includes('defocus')) chain.push('defocus'); // depth of field set by a universe this frame
    // With its own effects the object renders into a quad-sized buffer first.
    // Per-object buffers are pooled by size so a crowd of differently sized objects does not reallocate every frame.
    let pair: [FBO, FBO, number] | undefined;
    if (chain.length) {
      const key = w + 'x' + h;
      pair = f.pool.get(key);
      if (!pair) f.pool.set(key, (pair = [createFBO(gl, w, h), createFBO(gl, w, h), 0]));
      f.used.add(key);
      this.bind(gl, pair[0], 0, 0, w, h, true);
    }
    else this.bind(gl, target, x, y, w, h, false);
    gl.useProgram(p.prog);
    // A field texture (text): uploaded once per version, bound on unit 1; unit 0 stays the effect passes' uScene.
    if (o.field) {
      let f = this.fields.get(o);
      if (!f) { const tex = gl.createTexture()!; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.fields.set(o, (f = { tex, v: -1 })); }
      else { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, f.tex); }
      if (f.v !== o.field.version) { gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, o.field.width, o.field.height, 0, gl.RED, gl.UNSIGNED_BYTE, o.field.data); f.v = o.field.version; }
      gl.activeTexture(gl.TEXTURE0);
    }
    setUniforms(gl, p, {
      uTime: t, uResolution: [w, h], uRotation: o.anim.rotation,
      uScale: sz / Math.min(w, h), uBound: 1.6 * Math.max(sw, sh) / sz, uState: Math.min(1, Math.max(0, o.stateValue + o.anim.state)), uTheme: theme, uColor: o.rgb,
      ...(o.field ? { uField: [1], uFieldSize: [o.field.width, o.field.height], uFieldRange: o.field.range } : {}),
      ...shadeUniforms, ...o.uniforms,
    });
    drawQuad(gl);
    if (!chain.length) return;
    let src = pair![0];
    for (const name of chain) {
      const dst = src === pair![0] ? pair![1] : pair![0];
      this.bind(gl, dst, 0, 0, w, h, true);
      // Params merge the scene's under the object's, like shade params; a universe's blur sets the defocus radius.
      const params = { ...this.effectParams[name], ...o.effectParams[name], ...(name === 'defocus' && o.blurPx >= 0.5 ? { radius: o.blurPx } : {}) };
      this.pass(gl, name, src, params, [w, h], t, theme);
      src = dst;
    }
    this.bind(gl, target, x, y, w, h, false);
    this.blit(gl, src);
  }
}

let lightMq: MediaQueryList | null = null;
const BLEED = 1.5; // the quad is this much larger than the element box so halos can spill; the halo reaches about 1.5x
/** Exponential moving average, alpha 0.1; the first sample seeds it. */
const ema = (prev: number, x: number) => (prev ? prev + (x - prev) * 0.1 : x);
