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

export type AnimResult = Partial<{ rotation: [number, number, number]; offset: [number, number]; scale: number; state: number; uniforms: Record<string, number> }>;
export type Animation = { meta: Meta; fn: (t: number, speed: number, o: SdObject) => AnimResult };
export type EffectDef = { manifest: Meta; frag: string };
export type Pointer = { x: number; y: number; inside: boolean };
export type Interaction = { meta: Meta; setup?(scene: SdScene): void; frame(scene: SdScene, dt: number, pointer: Pointer): void };

export const objects = new Map<string, { manifest: Manifest; frag: string }>();
export const animations = new Map<string, Animation>();
export const effects = new Map<string, EffectDef>();
export const interactions = new Map<string, Interaction>();

/** Attribute names every element observes for effect params: `<effect>-<param>`. */
export const effectAttrs = () => [...effects.values()].flatMap((e) => e.manifest.params.map((p) => `${e.manifest.name}-${kebab(p.name)}`));
export const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
/** Parse `glow-strength="0.8"` style attributes into { glow: { strength: 0.8 } }. */
export function effectParam(name: string, value: string | null, into: Record<string, Record<string, number>>): boolean {
  for (const e of effects.values()) {
    const prefix = e.manifest.name + '-';
    if (!name.startsWith(prefix)) continue;
    const p = e.manifest.params.find((p) => kebab(p.name) === name.slice(prefix.length));
    if (!p) continue;
    (into[e.manifest.name] ??= {})[p.name] = num(value, p.default as number);
    return true;
  }
  return false;
}
/** Attribute number with a default for missing, empty or unparseable values; 0 is a value. */
export const num = (v: string | null | undefined, d: number) => { if (v == null || v === '') return d; const n = Number(v); return isNaN(n) ? d : n; };
