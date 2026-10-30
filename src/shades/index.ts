import { shades, type ShadeDef, type Meta } from '../core/registry';
import glass from './glass/manifest.json';
import glassFrag from './glass/frag.glsl';

export const all: ShadeDef[] = [
  { manifest: glass as Meta, frag: glassFrag },
];
for (const s of all) shades.set(s.manifest.name, s);
