import { SdScene } from './scene.js';
import { SdObject } from './object.js';
import { type Mat3 } from './math.js';
type V3 = [number, number, number];
/** One shape in the universe: position and velocity in world units (a unit ball), radius from its px size. */
export type Body = {
    el: SdObject;
    p: V3;
    v: V3;
    r: number;
    tilt: Mat3;
    wob: number[];
};
export declare const PALETTE: string[];
/**
 * A scene that fills its box with seeded shapes in a 3D ball, seen through a perspective camera that spins,
 * drags and tilts toward the pointer. Children are plain light-DOM objects with a `data-pos`, so the markup
 * it leaves behind is a universe you can copy and hand-edit.
 */
export declare class SdUniverse extends SdScene {
    static get observedAttributes(): string[];
    /** Camera angles in radians: yaw around the vertical axis, pitch around the horizontal one. */
    yaw: number;
    pitch: number;
    private body;
    private rnd;
    /** The bodies made so far, in DOM order (reading this creates none; step() does, in sorted order). */
    get bodies(): Body[];
    private ready;
    private simTime;
    private drag;
    private vel;
    private spinGain;
    private tilt;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(name: string, o: string | null, v: string | null): void;
    kids(): SdObject[];
    private cam;
    /** Replace the object children with a fresh seeded set. */
    generate(): void;
    /** Reset the seeded motion stream; bodies are made per child on first sight (`bodyOf`), so late children get one too. */
    adopt(): void;
    /** The body of a child: `data-pos` (or a seeded spot), size, and seeded drift, wobble and tilt. */
    private bodyOf;
    private onDown;
    private onMove;
    private onUp;
    /** Per frame: move the camera and the bodies, resolve collisions, then place every child on screen. */
    protected step(dt: number): void;
    /** Elastic sphere collisions: separate overlapping pairs and swap the normal velocity, four passes. Mass is the cubed radius. Scalar math, no allocation per pair. */
    private collide;
}
export {};
