import { effects, type EffectDef, type Meta } from '../core/registry';
import glow from './glow/manifest.json';
import glowFrag from './glow/frag.glsl';
import beam from './beam/manifest.json';
import beamFrag from './beam/frag.glsl';
import rgbSplit from './rgb-split/manifest.json';
import rgbSplitFrag from './rgb-split/frag.glsl';
import pixelate from './pixelate/manifest.json';
import pixelateFrag from './pixelate/frag.glsl';
import dither from './dither/manifest.json';
import ditherFrag from './dither/frag.glsl';
import scanlines from './scanlines/manifest.json';
import scanlinesFrag from './scanlines/frag.glsl';

export const all: EffectDef[] = [
  { manifest: glow as Meta, frag: glowFrag },
  { manifest: beam as Meta, frag: beamFrag },
  { manifest: rgbSplit as Meta, frag: rgbSplitFrag },
  { manifest: pixelate as Meta, frag: pixelateFrag },
  { manifest: dither as Meta, frag: ditherFrag },
  { manifest: scanlines as Meta, frag: scanlinesFrag },
];
for (const e of all) effects.set(e.manifest.name, e);
