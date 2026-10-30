import type { Interaction } from '../core/registry';
import { interactionValue } from '../core/registry';
import { spring, type Spring } from '../core/math';
import type { SdObject } from '../core/object';

const springs = new WeakMap<SdObject, Spring>();

// Press and hold: every shape gathers toward the press on the shared spring; let go and they spring back.
// Pointer-driven, so it keeps responding under reduced motion, like repel.
export const pull: Interaction = {
  meta: {
    name: 'pull',
    description: 'Press and hold anywhere: shapes gather toward your finger or pointer, then spring back when you let go.',
    input: 'tap',
    params: [
      { name: 'strength', type: 'float', default: 0.6, min: 0, max: 1, step: 0.01, label: 'Pull strength' },
      { name: 'reach', type: 'float', default: 400, min: 0, max: 1000, step: 1, label: 'Farthest travel (px)' },
    ],
  },
  frame(scene, dt, pointer) {
    const strength = interactionValue(scene, 'pull', 'strength'), reach = interactionValue(scene, 'pull', 'reach');
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const s = springs.get(o) ?? springs.set(o, { x: 0, y: 0, vx: 0, vy: 0 }).get(o)!;
      let tx = 0, ty = 0;
      if (pointer.down) {
        const [cx, cy] = o.drawCenter();
        tx = (pointer.x - cx) * strength; ty = (pointer.y - cy) * strength;
        const m = Math.hypot(tx, ty), cap = reach * (o.pinned ? 1 / 3 : 1);
        if (m > cap) { tx *= cap / m; ty *= cap / m; }
      }
      spring(s, tx, ty, dt);
      o.anim.offset[0] += s.x; o.anim.offset[1] += s.y;
    }
  },
};
