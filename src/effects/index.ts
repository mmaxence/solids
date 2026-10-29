import { effects, type EffectDef, type Meta, type UniformDef } from '../core/registry';
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
import halftone from './halftone/manifest.json';
import halftoneFrag from './halftone/frag.glsl';
import outline from './outline/manifest.json';
import outlineFrag from './outline/frag.glsl';
import grain from './grain/manifest.json';
import grainFrag from './grain/frag.glsl';
import vignette from './vignette/manifest.json';
import vignetteFrag from './vignette/frag.glsl';
import chroma from './chroma/manifest.json';
import chromaFrag from './chroma/frag.glsl';
import ripple from './ripple/manifest.json';
import rippleFrag from './ripple/frag.glsl';
import defocus from './defocus/manifest.json';
import defocusFrag from './defocus/frag.glsl';

export const all: EffectDef[] = [
  { manifest: glow as Meta, frag: glowFrag },
  { manifest: beam as Meta, frag: beamFrag },
  { manifest: rgbSplit as Meta, frag: rgbSplitFrag },
  { manifest: pixelate as Meta, frag: pixelateFrag },
  { manifest: dither as Meta, frag: ditherFrag },
  { manifest: scanlines as Meta, frag: scanlinesFrag },
  { manifest: halftone as Meta, frag: halftoneFrag },
  { manifest: outline as Meta, frag: outlineFrag },
  { manifest: grain as Meta, frag: grainFrag },
  { manifest: vignette as Meta, frag: vignetteFrag },
  { manifest: chroma as Meta, frag: chromaFrag },
  { manifest: ripple as Meta, frag: rippleFrag },
  { manifest: defocus as Meta, frag: defocusFrag },
];
// Every effect gets a mix param (the core footer blends by it), so `<effect>-mix` and its site control come for free.
const mix: UniformDef = { name: 'mix', type: 'float', default: 1, min: 0, max: 2, step: 0.05, label: 'Mix' };
for (const e of all) {
  if (!e.manifest.params.some((p) => p.name === 'mix')) e.manifest.params.push(mix);
  effects.set(e.manifest.name, e);
}
