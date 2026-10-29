import type { Interaction } from '../core/registry';
import { interactionValue } from '../core/registry';
import { mul3, rotXYZ } from '../core/math';

// Driven by the reader's scroll, so it keeps running under reduced motion.
export const scroll: Interaction = {
  meta: {
    name: 'scroll',
    description: 'Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.',
    params: [{ name: 'turns', type: 'float', default: 1, min: -3, max: 3, step: 0.05, label: 'Turns while the scene crosses the screen' }],
  },
  frame(scene) {
    const r = scene.getBoundingClientRect(), h = innerHeight;
    // 0 when the scene's top enters at the bottom of the screen, 1 when its bottom leaves at the top.
    const p = Math.min(1, Math.max(0, (h - r.top) / Math.max(h + r.height, 1)));
    const m = rotXYZ(0, (p - 0.5) * interactionValue(scene, 'scroll', 'turns') * 2 * Math.PI, 0);
    for (const o of scene.objects) o.anim.rotation = mul3(m, o.anim.rotation);
  },
};
