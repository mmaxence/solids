import type { Interaction } from '../core/registry';
import { interactionValue, type Tap } from '../core/registry';
import { mul3, rotXYZ } from '../core/math';
import { reducedMotion, type SdObject } from '../core/object';
import type { SdScene } from '../core/scene';

const seen = new WeakMap<SdScene, Tap | null>();
const poked = new WeakMap<SdObject, number>();   // seconds since the shape was tapped

// Tap a shape: it turns once around its vertical axis with an ease-out and pops. Tapping a word shows its extrusion.
export const poke: Interaction = {
  meta: {
    name: 'poke',
    description: 'Tap a shape and it turns once around its vertical axis with a little pop.',
    input: 'tap',
    params: [
      { name: 'turns', type: 'float', default: 1, min: -3, max: 3, step: 0.25, label: 'Turns per tap' },
      { name: 'pop', type: 'float', default: 0.18, min: 0, max: 0.5, step: 0.01, label: 'Scale pop' },
    ],
  },
  frame(scene, dt, pointer) {
    const turns = interactionValue(scene, 'poke', 'turns'), pop = interactionValue(scene, 'poke', 'pop'), still = reducedMotion();
    if (!seen.has(scene)) seen.set(scene, pointer.tap); // a tap from before the rule was listed is not ours
    if (pointer.tap && pointer.tap !== seen.get(scene)) {
      seen.set(scene, pointer.tap);
      // The shape drawn on top under the tap: test where each was drawn last frame (after every rule), in draw order, last hit wins.
      let hit: SdObject | null = null;
      for (const o of [...scene.objects].sort((a, b) => (a.anim.z || 0) - (b.anim.z || 0))) {
        if (!o.rect) continue;
        const [cx, cy] = o.drawn ?? o.drawCenter(), hw = (o.rect.width / 2) * o.anim.scale, hh = (o.rect.height / 2) * o.anim.scale;
        if (Math.abs(pointer.tap.x - cx) <= hw && Math.abs(pointer.tap.y - cy) <= hh) hit = o;
      }
      if (hit && !poked.has(hit)) poked.set(hit, 0); // a second tap on a turning shape lets it finish
    }
    for (const o of scene.objects) {
      const age = poked.get(o);
      if (age === undefined) continue;
      const t = Math.min(age / 0.9, 1), k = 1 - (1 - t) ** 3;
      o.anim.rotation = mul3(rotXYZ(0, k * turns * 2 * Math.PI, 0), o.anim.rotation);
      if (!still) o.anim.scale *= 1 + pop * Math.sin(t * Math.PI);
      if (t >= 1) poked.delete(o); else poked.set(o, age + dt / 1000);
    }
  },
};
