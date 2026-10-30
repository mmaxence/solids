import type { Interaction } from '../core/registry';
import { mul3, rotXYZ, spring, type Spring } from '../core/math';
import type { SdObject } from '../core/object';

const springs = new WeakMap<SdObject, Spring>();
const MAX = (20 * Math.PI) / 180;

export const pointerFollow: Interaction = {
  meta: { name: 'pointer-follow', description: 'Every object tilts toward the pointer on a soft spring.', params: [] },
  frame(scene, dt, pointer) {
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const s = springs.get(o) ?? springs.set(o, { x: 0, y: 0, vx: 0, vy: 0 }).get(o)!;
      let tx = 0, ty = 0;
      if (pointer.inside) {
        const [cx, cy] = o.drawCenter();
        const dx = (pointer.x - cx) / Math.max(scene.width, 1), dy = (pointer.y - cy) / Math.max(scene.height, 1);
        ty = Math.max(-1, Math.min(1, dx * 2)) * MAX;
        tx = Math.max(-1, Math.min(1, dy * 2)) * MAX;
      }
      spring(s, tx, ty, dt);
      o.anim.rotation = mul3(rotXYZ(s.x, s.y, 0), o.anim.rotation);
    }
  },
};
