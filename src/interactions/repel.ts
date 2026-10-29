import type { Interaction } from '../core/registry';
import { interactionValue } from '../core/registry';
import type { SdObject } from '../core/object';

type Spring = { x: number; y: number; vx: number; vy: number };
const springs = new WeakMap<SdObject, Spring>();

// Pointer-driven, so it keeps responding under reduced motion, like pointer-follow.
export const repel: Interaction = {
  meta: {
    name: 'repel',
    description: 'Objects near the pointer are pushed away from it and spring back when it leaves.',
    params: [
      { name: 'radius', type: 'float', default: 140, min: 20, max: 400, step: 1, label: 'Reach around the pointer (px)' },
      { name: 'strength', type: 'float', default: 0.6, min: 0, max: 1, step: 0.01, label: 'Push strength' },
    ],
  },
  frame(scene, dt, pointer) {
    const radius = interactionValue(scene, 'repel', 'radius'), strength = interactionValue(scene, 'repel', 'strength');
    const steps = Math.max(1, Math.round(dt / 16));
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const s = springs.get(o) ?? springs.set(o, { x: 0, y: 0, vx: 0, vy: 0 }).get(o)!;
      let tx = 0, ty = 0;
      if (pointer.inside) {
        const dx = o.rect.x + o.rect.width / 2 + o.anim.offset[0] - pointer.x, dy = o.rect.y + o.rect.height / 2 + o.anim.offset[1] - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < radius) {
          // Strongest right under the pointer (half the radius at full strength), nothing at the edge.
          const push = (1 - d / radius) * radius * 0.5 * strength;
          tx = d > 1e-3 ? (dx / d) * push : 0;
          ty = d > 1e-3 ? (dy / d) * push : -push;
        }
      }
      for (let i = 0; i < steps; i++) {
        s.vx = (s.vx + (tx - s.x) * 0.08) * 0.8; s.x += s.vx;
        s.vy = (s.vy + (ty - s.y) * 0.08) * 0.8; s.y += s.vy;
      }
      o.anim.offset[0] += s.x;
      o.anim.offset[1] += s.y;
    }
  },
};
