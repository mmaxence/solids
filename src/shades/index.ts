import { shades, type ShadeDef, type Meta } from '../core/registry';
import glass from './glass/manifest.json';
import glassFrag from './glass/frag.glsl';
import matte from './matte/manifest.json';
import matteFrag from './matte/frag.glsl';
import cel from './cel/manifest.json';
import celFrag from './cel/frag.glsl';
import clay from './clay/manifest.json';
import clayFrag from './clay/frag.glsl';
import metal from './metal/manifest.json';
import metalFrag from './metal/frag.glsl';

export const all: ShadeDef[] = [
  { manifest: glass as Meta, frag: glassFrag },
  { manifest: matte as Meta, frag: matteFrag },
  { manifest: cel as Meta, frag: celFrag },
  { manifest: clay as Meta, frag: clayFrag },
  { manifest: metal as Meta, frag: metalFrag },
];
for (const s of all) shades.set(s.manifest.name, s);
