export declare const clamp: (v: number, a: number, b: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
/** Exponential smoothing toward target; tau in ms. */
export declare const ease: (cur: number, target: number, dt: number, tau: number) => number;
export type Spring = {
    x: number;
    y: number;
    vx: number;
    vy: number;
};
/** A soft spring toward a target, stepped in 16 ms units with a fractional last step, so 120 Hz and 60 Hz settle alike. */
export declare function spring(s: Spring, tx: number, ty: number, dt: number, k?: number, damp?: number): void;
export type Mat3 = Float32Array;
export declare const IDENTITY: Mat3;
/** Column-major mat3 from XYZ Euler angles (radians). */
export declare function rotXYZ(rx: number, ry: number, rz: number): Mat3;
export declare function mul3(a: Mat3, b: Mat3): Mat3;
type Rgb = [number, number, number];
/**
 * Any CSS color → [0..1, 0..1, 0..1] in `space`; null when the browser rejects it.
 * sRGB hex takes a fast path; everything else is painted on a 1×1 canvas and read back in `space`.
 */
export declare function parseColor(s: string, space?: 'display-p3' | 'srgb'): Rgb | null;
/** True when the 2D canvas can paint and read back in Display P3 (sRGB red reads with a non-zero green channel). */
export declare function canvasSupportsP3(): boolean;
export {};
