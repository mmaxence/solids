import { SdScene } from './core/scene.js';
import { SdObject, defineObject, reflect } from './core/object.js';
import { SdUniverse, PALETTE } from './core/universe.js';
import * as registry from './core/registry.js';
export { SdScene, SdUniverse, SdObject, defineObject, reflect, registry, PALETTE };
declare global {
  interface HTMLElementTagNameMap {
    'sd-scene': SdScene;
    'sd-universe': SdUniverse;
  }
}
