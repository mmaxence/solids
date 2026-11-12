import { type ColorSpace } from './gl.js';
import { type Pointer } from './registry.js';
import { SdObject } from './object.js';
export declare class SdScene extends HTMLElement {
    static get observedAttributes(): string[];
    canvas: HTMLCanvasElement;
    gl: WebGL2RenderingContext | null;
    colorSpace: ColorSpace;
    objects: Set<SdObject>;
    pointer: Pointer;
    private press;
    interactionNames: string[];
    effectNames: string[];
    shadeName: string;
    shadeParams: Record<string, Record<string, number>>;
    effectParams: Record<string, Record<string, number>>;
    interactionParams: Record<string, Record<string, number>>;
    theme: 'auto' | 'dark' | 'light';
    pixelRatio: number;
    maxDpr: number;
    width: number;
    height: number;
    /** ms spent in `frame()` (EMA, alpha 0.1): the CPU side of one frame. */
    frameTime: number;
    /** Frames per second from the rAF loop (EMA). */
    fps: number;
    private gpuMs;
    private gpuOn;
    private query;
    private raf;
    private last;
    private visible;
    private paused;
    private dirty;
    private frames;
    private failed;
    private maxTex;
    private lose;
    private fields;
    private ro;
    private io;
    private fbos;
    private clock;
    /** The scene clock in seconds: shader time, paused with the scene. */
    get time(): number;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, _o: string | null, v: string | null): void;
    attach(o: SdObject): void;
    /** Keep DOM order ("first center wins", draw-order ties follow the markup) and measure, once per batch of attaches. */
    private settle;
    detach(o: SdObject): void;
    get themeValue(): number;
    private onPointer;
    private onLeave;
    /** The scene this event belongs to: a nested scene keeps its presses and taps to itself. */
    private mine;
    private onPress;
    private onRelease;
    private onCancelPress;
    /** Tap the scene by hand at scene px: tap rules answer as if a finger had pressed there. */
    tap(x: number, y: number): void;
    private onVis;
    measure(): void;
    start(): void;
    stop(): void;
    private tick;
    /** Advance one frame and draw. Public so tests and tools can render synchronously. */
    frame(t: number, dt: number): void;
    /** GPU ms per frame (EMA) from EXT_disjoint_timer_query_webgl2, or null where the browser lacks it. Reading it opts the scene in. */
    get gpuTime(): number | null;
    /** Collect the finished query, if any, then start the next one. Null when unsupported or the last one is still pending. */
    private gpuBegin;
    private render;
    /** Hook for subclasses: runs each frame after the objects update and before the interactions. */
    protected step(_dt: number): void;
    private bind;
    private blit;
    private pass;
    private draw;
}
