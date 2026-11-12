import { type Mat3 } from './math.js';
import { type Manifest } from './registry.js';
import type { SdScene } from './scene.js';
export type Pose = {
    rotation: [number, number, number];
    offset: [number, number];
    scale: number;
    state: number;
};
/** A distance field the shader may sample as `uField` (R8: 0.5 is the edge, signed distance in texels up to `range`, positive outside,
 * rows top down). The core uploads it once per `version` and binds it on texture unit 1 with `uFieldSize` and `uFieldRange`. */
export type Field = {
    data: Uint8Array;
    width: number;
    height: number;
    range: number;
    version: number;
};
export declare class SdObject extends HTMLElement {
    static manifest: Manifest;
    static frag: string;
    static get observedAttributes(): string[];
    get manifest(): Manifest;
    get frag(): string;
    scene: SdScene | null;
    rect: DOMRect | null;
    uniforms: Record<string, number>;
    rgb: [number, number, number];
    colorSrc: string;
    stateValue: number;
    stateTarget: number;
    speedValue: number;
    animNames: string[];
    effectNames: string[];
    effectParams: Record<string, Record<string, number>>;
    shadeName: string;
    shadeParams: Record<string, Record<string, number>>;
    anim: {
        rotation: Mat3;
        offset: [number, number];
        scale: number;
        z: number;
        state: number;
    };
    pose: Pose | null;
    pinned: boolean;
    blurPx: number;
    field: Field | null;
    drawn: [number, number] | null;
    broken: boolean;
    private clock;
    phaseOffset: number;
    private prevPose;
    private blend;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, _old: string | null, v: string | null): void;
    /** Parse `s` in the scene's color space (sRGB until attached). An unparseable string keeps the current color. */
    recolor(s?: string): void;
    /** Where the object is drawn this frame: its layout center plus the offsets animations and interactions added so far, in scene px. (Not center() or radius(): uniform names reflect as properties.) */
    drawCenter(): [number, number];
    /** Half the drawn size this frame, in scene px: the short side, so a wide word collides as a disc of its height. */
    drawRadius(): number;
    /** Per-frame: ease state, advance the animation phase, run animations, cross-fade after an `animation` change. */
    update(dt: number): void;
}
export declare function reducedMotion(): boolean;
export declare function reflect(proto: object, attrs: string[]): void;
export declare function defineObject(manifest: Manifest, frag: string): void;
