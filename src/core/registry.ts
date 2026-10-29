import type { SdObject } from './object';
import type { SdScene } from './scene';

export type UniformDef = {
  name: string;
  type: 'float' | 'vec3' | 'color';
  default: number | number[] | string;
  min?: number; max?: number; step?: number;
  label: string;
};
export type Manifest = {
  name: string; tag: string; description: string;
  bleed?: number;
  uniforms: UniformDef[];
  tags?: string[];
};
export type Meta = { name: string; description: string; params: UniformDef[] };

export type AnimResult = Partial<{ rotation: [number, number, number]; offset: [number, number]; scale: number; uniforms: Record<string, number> }>;
export type Animation = { meta: Meta; fn: (t: number, speed: number, o: SdObject) => AnimResult };
export type EffectDef = { manifest: Meta; frag: string };
export type Pointer = { x: number; y: number; inside: boolean };
export type Interaction = { meta: Meta; setup?(scene: SdScene): void; frame(scene: SdScene, dt: number, pointer: Pointer): void };

export const objects = new Map<string, { manifest: Manifest; frag: string }>();
export const animations = new Map<string, Animation>();
export const effects = new Map<string, EffectDef>();
export const interactions = new Map<string, Interaction>();
