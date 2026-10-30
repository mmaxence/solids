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
export type ShadeDef = { manifest: Meta; frag: string };
export type Pointer = { x: number; y: number; inside: boolean };
export type Interaction = { meta: Meta; setup?(scene: SdScene): void; frame(scene: SdScene, dt: number, pointer: Pointer): void };

export const objects = new Map<string, { manifest: Manifest; frag: string }>();
export const animations = new Map<string, Animation>();
export const effects = new Map<string, EffectDef>();
export const shades = new Map<string, ShadeDef>();
/** The shade `auto` resolves to in the light theme; in the dark theme it is always glass. */
export const LIGHT_SHADE = 'matte';
export const interactions = new Map<string, Interaction>();

const effectMetas = () => [...effects.values()].map((e) => e.manifest);
const interactionMetas = () => [...interactions.values()].map((i) => i.meta);
const shadeMetas = () => [...shades.values()].map((s) => s.manifest);
const paramAttrs = (metas: Meta[]) => metas.flatMap((m) => m.params.map((p) => `${m.name}-${kebab(p.name)}`));
/** Attribute names every element observes for effect params: `<effect>-<param>`. */
export const effectAttrs = () => paramAttrs(effectMetas());
/** Attribute names a scene observes for interaction params: `<interaction>-<param>`. */
export const interactionAttrs = () => paramAttrs(interactionMetas());
/** Attribute names objects and scenes observe for shade params: `<shade>-<param>`. */
export const shadeAttrs = () => paramAttrs(shadeMetas());
export const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
/** Parse `glow-strength="0.8"` style attributes into { glow: { strength: 0.8 } }. */
function param(metas: Meta[], name: string, value: string | null, into: Record<string, Record<string, number>>): boolean {
  for (const m of metas) {
    const prefix = m.name + '-';
    if (!name.startsWith(prefix)) continue;
    const p = m.params.find((p) => kebab(p.name) === name.slice(prefix.length));
    if (!p) continue;
    (into[m.name] ??= {})[p.name] = num(value, p.default as number);
    return true;
  }
  return false;
}
export const effectParam = (name: string, value: string | null, into: Record<string, Record<string, number>>) => param(effectMetas(), name, value, into);
export const interactionParam = (name: string, value: string | null, into: Record<string, Record<string, number>>) => param(interactionMetas(), name, value, into);
export const shadeParam = (name: string, value: string | null, into: Record<string, Record<string, number>>) => param(shadeMetas(), name, value, into);
const warned = new Set<string>();
/** The shade name to draw with: `auto` is glass in dark and LIGHT_SHADE in light; an unknown name warns once and counts as auto. */
export function resolveShade(name: string, theme: number): string {
  if (name && name !== 'auto' && !shades.has(name) && !warned.has(name)) { warned.add(name); console.warn(`[solids] unknown shading "${name}", using auto`); }
  const n = shades.has(name) ? name : theme ? LIGHT_SHADE : 'glass';
  return shades.has(n) ? n : 'glass';
}
/** An interaction param on a scene: its `<interaction>-<param>` attribute, else the default from the meta. */
export const interactionValue = (scene: SdScene, name: string, p: string) =>
  scene.interactionParams[name]?.[p] ?? (interactions.get(name)!.meta.params.find((d) => d.name === p)!.default as number);
/** Attribute number with a default for missing, empty or unparseable values; 0 is a value. */
export const num = (v: string | null | undefined, d: number) => { if (v == null || v === '') return d; const n = Number(v); return isNaN(n) ? d : n; };
