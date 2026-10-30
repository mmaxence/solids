import type { Interaction } from '../core/registry';
import { interactionValue } from '../core/registry';
import { ease } from '../core/math';
import type { SdObject } from '../core/object';

const pulls = new WeakMap<SdObject, [number, number]>();

// Pointer-driven, so it keeps responding under reduced motion, like pointer-follow.
export const magnet: Interaction = {
  meta: {
    name: 'magnet',
    description: 'Objects drift toward the pointer, each held within a short reach of its place.',
    params: [
      { name: 'reach', type: 'float', default: 40, min: 0, max: 200, step: 1, label: 'Farthest drift from rest (px)' },
      { name: 'strength', type: 'float', default: 0.3, min: 0, max: 1, step: 0.01, label: 'Pull strength' },
    ],
  },
  frame(scene, dt, pointer) {
    const reach = interactionValue(scene, 'magnet', 'reach'), strength = interactionValue(scene, 'magnet', 'strength');
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const cur = pulls.get(o) ?? [0, 0];
      let tx = 0, ty = 0;
      if (pointer.inside) {
        const [cx, cy] = o.drawCenter();
        tx = (pointer.x - cx) * strength;
        ty = (pointer.y - cy) * strength;
        const m = Math.hypot(tx, ty);
        if (m > reach) { tx *= reach / m; ty *= reach / m; }
      }
      const next: [number, number] = [ease(cur[0], tx, dt, 250), ease(cur[1], ty, dt, 250)];
      pulls.set(o, next);
      o.anim.offset[0] += next[0];
      o.anim.offset[1] += next[1];
    }
  },
};
