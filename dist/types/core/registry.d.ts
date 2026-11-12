import type { SdObject } from './object.js';
import type { SdScene } from './scene.js';
export type UniformDef = {
    name: string;
    type: 'float';
    default: number;
    min?: number;
    max?: number;
    step?: number;
    label: string;
};
export type Manifest = {
    name: string;
    tag: string;
    description: string;
    uniforms: UniformDef[];
};
export type Meta = {
    name: string;
    description: string;
    params: UniformDef[];
    input?: 'tap';
};
export type AnimResult = Partial<{
    rotation: [number, number, number];
    offset: [number, number];
    scale: number;
    state: number;
}>;
export type Animation = {
    meta: Meta;
    fn: (t: number, speed: number, o: SdObject) => AnimResult;
};
export type EffectDef = {
    manifest: Meta;
    frag: string;
};
export type ShadeDef = {
    manifest: Meta;
    frag: string;
};
/** A tap: a press and release that moved under 8 px within 400 ms, in scene px. A new object each time; rules compare by identity. */
export type Tap = {
    x: number;
    y: number;
};
export type Pointer = {
    x: number;
    y: number;
    inside: boolean;
    down: boolean;
    tap: Tap | null;
};
export type Interaction = {
    meta: Meta;
    setup?(scene: SdScene): void;
    frame(scene: SdScene, dt: number, pointer: Pointer): void;
};
export declare const objects: Map<string, {
    manifest: Manifest;
    frag: string;
}>;
export declare const animations: Map<string, Animation>;
export declare const effects: Map<string, EffectDef>;
export declare const shades: Map<string, ShadeDef>;
/** The shade `auto` resolves to in the light theme; in the dark theme it is always glass. */
export declare const LIGHT_SHADE = "matte";
export declare const interactions: Map<string, Interaction>;
/** Attribute names every element observes for effect params: `<effect>-<param>`. */
export declare const effectAttrs: () => string[];
/** Attribute names a scene observes for interaction params: `<interaction>-<param>`. */
export declare const interactionAttrs: () => string[];
/** Attribute names objects and scenes observe for shade params: `<shade>-<param>`. */
export declare const shadeAttrs: () => string[];
export declare const kebab: (s: string) => string;
export declare const effectParam: (name: string, value: string | null, into: Record<string, Record<string, number>>) => boolean;
export declare const interactionParam: (name: string, value: string | null, into: Record<string, Record<string, number>>) => boolean;
export declare const shadeParam: (name: string, value: string | null, into: Record<string, Record<string, number>>) => boolean;
/** The shade name to draw with: `auto` is glass in dark and LIGHT_SHADE in light; an unknown name warns once and counts as auto. */
export declare function resolveShade(name: string, theme: number): string;
/** An interaction param on a scene: its `<interaction>-<param>` attribute, else the default from the meta. */
export declare const interactionValue: (scene: SdScene, name: string, p: string) => number;
/** Attribute number with a default for missing, empty, unparseable or infinite values; 0 is a value. */
export declare const num: (v: string | null | undefined, d: number) => number;
/** A value held to its manifest range, when the manifest gives one. */
export declare const clampTo: (n: number, d: {
    min?: number;
    max?: number;
}) => number;
