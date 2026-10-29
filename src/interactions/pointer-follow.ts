import type { Interaction } from '../core/registry';
import { mul3, rotXYZ } from '../core/math';
import type { SdObject } from '../core/object';

type Spring = { rx: number; ry: number; vx: number; vy: number };
const springs = new WeakMap<SdObject, Spring>();
const MAX = (20 * Math.PI) / 180;

export const pointerFollow: Interaction = {
  meta: { name: 'pointer-follow', description: 'Every object tilts toward the pointer on a soft spring.', params: [] },
  frame(scene, dt, pointer) {
    const k = 0.08, damp = 0.8, steps = Math.max(1, Math.round(dt / 16));
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const s = springs.get(o) ?? springs.set(o, { rx: 0, ry: 0, vx: 0, vy: 0 }).get(o)!;
      let tx = 0, ty = 0;
      if (pointer.inside) {
        const cx = o.rect.x + o.rect.width / 2 + o.anim.offset[0], cy = o.rect.y + o.rect.height / 2 + o.anim.offset[1];
        const dx = (pointer.x - cx) / Math.max(scene.width, 1), dy = (pointer.y - cy) / Math.max(scene.height, 1);
        ty = Math.max(-1, Math.min(1, dx * 2)) * MAX;
        tx = Math.max(-1, Math.min(1, dy * 2)) * MAX;
      }
      for (let i = 0; i < steps; i++) {
        s.vx = (s.vx + (tx - s.rx) * k) * damp; s.rx += s.vx;
        s.vy = (s.vy + (ty - s.ry) * k) * damp; s.ry += s.vy;
      }
      o.anim.rotation = mul3(rotXYZ(s.rx, s.ry, 0), o.anim.rotation);
    }
  },
};
