import { SdScene } from './core/scene.js';
import { SdObject, defineObject, reflect } from './core/object.js';
import { SdUniverse, PALETTE } from './core/universe.js';
import * as registry from './core/registry.js';
import './animations/index.js';
import './effects/index.js';
import './shades/index.js';
import './interactions/index.js';
import './text/index.js';
export { SdScene, SdUniverse, SdObject, defineObject, reflect, registry, PALETTE };

// Registration is a side effect of the full entry only; core does not register shapes.
declare global {
  interface HTMLElementTagNameMap {
    'sd-scene': SdScene;
    'sd-universe': SdUniverse;
    'sd-text': import('./text/index.js').SdText;
    'sd-blob': SdObject;
    'sd-capsule': SdObject;
    'sd-coil': SdObject;
    'sd-crystal': SdObject;
    'sd-cube': SdObject;
    'sd-disc': SdObject;
    'sd-knot': SdObject;
    'sd-orb': SdObject;
    'sd-prism': SdObject;
    'sd-ring': SdObject;
    'sd-shell': SdObject;
    'sd-star': SdObject;
  }
}
