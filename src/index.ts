import { SdScene } from './core/scene';
import { SdObject, defineObject } from './core/object';
import * as registry from './core/registry';
import './animations';

import orbManifest from './objects/orb/manifest.json';
import orbFrag from './objects/orb/frag.glsl';

if (!customElements.get('sd-scene')) customElements.define('sd-scene', SdScene);
defineObject(orbManifest as registry.Manifest, orbFrag);

export { SdScene, SdObject, defineObject, registry };
