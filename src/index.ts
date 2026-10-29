import { SdScene } from './core/scene';
import { SdObject, defineObject } from './core/object';
import * as registry from './core/registry';
import './animations';
import './effects';

import orbManifest from './objects/orb/manifest.json';
import orbFrag from './objects/orb/frag.glsl';
import ringManifest from './objects/ring/manifest.json';
import ringFrag from './objects/ring/frag.glsl';
import crystalManifest from './objects/crystal/manifest.json';
import crystalFrag from './objects/crystal/frag.glsl';
import coilManifest from './objects/coil/manifest.json';
import coilFrag from './objects/coil/frag.glsl';
import blobManifest from './objects/blob/manifest.json';
import blobFrag from './objects/blob/frag.glsl';
import cubeManifest from './objects/cube/manifest.json';
import cubeFrag from './objects/cube/frag.glsl';

if (!customElements.get('sd-scene')) customElements.define('sd-scene', SdScene);
defineObject(orbManifest as registry.Manifest, orbFrag);
defineObject(ringManifest as registry.Manifest, ringFrag);
defineObject(crystalManifest as registry.Manifest, crystalFrag);
defineObject(coilManifest as registry.Manifest, coilFrag);
defineObject(blobManifest as registry.Manifest, blobFrag);
defineObject(cubeManifest as registry.Manifest, cubeFrag);

export { SdScene, SdObject, defineObject, registry };
