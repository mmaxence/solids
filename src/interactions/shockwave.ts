import type { Interaction } from '../core/registry';
import { interactionValue, type Tap } from '../core/registry';
import { spring, type Spring } from '../core/math';
import { reducedMotion, type SdObject } from '../core/object';
import type { SdScene } from '../core/scene';

type Wave = { tap: Tap | null; x: number; y: number; age: number };
const waves = new WeakMap<SdScene, Wave>();
const springs = new WeakMap<SdObject, Spring>();

// A tap rule: the ring is a function of the tap's age, counted here with dt, so it is frame-rate independent and still runs under
// reduced motion (the person asked for it by tapping; only the flash and the pop are skipped there).
export const shockwave: Interaction = {
  meta: {
    name: 'shockwave',
    description: 'A tap sends a ring out across the scene: shapes it crosses are shoved outward, flash, and spring back.',
    input: 'tap',
    params: [
      { name: 'radius', type: 'float', default: 480, min: 60, max: 1600, step: 1, label: 'How far the ring travels (px)' },
      { name: 'strength', type: 'float', default: 0.7, min: 0, max: 1, step: 0.01, label: 'Shove strength' },
      { name: 'speed', type: 'float', default: 900, min: 100, max: 3000, step: 10, label: 'Ring speed (px per second)' },
    ],
  },
  frame(scene, dt, pointer) {
    const radius = interactionValue(scene, 'shockwave', 'radius'), strength = interactionValue(scene, 'shockwave', 'strength'), speed = interactionValue(scene, 'shockwave', 'speed');
    let w = waves.get(scene);
    if (!w) waves.set(scene, (w = { tap: null, x: 0, y: 0, age: 1e9 }));
    if (pointer.tap && pointer.tap !== w.tap) { w.tap = pointer.tap; w.x = pointer.tap.x; w.y = pointer.tap.y; w.age = 0; }
    w.age += dt / 1000;
    const front = w.age * speed, reach = radius + 120, still = reducedMotion();
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const s = springs.get(o) ?? springs.set(o, { x: 0, y: 0, vx: 0, vy: 0 }).get(o)!;
      let tx = 0, ty = 0, k = 0;
      if (front < reach) {
        const [cx, cy] = o.drawCenter(), dx = cx - w.x, dy = cy - w.y, d = Math.hypot(dx, dy);
        if (d > 1e-3) {
          // A 60 px wide band around the front, fading as it travels; pinned shapes (a gravity center, an orbiter) take a third.
          k = Math.exp(-((d - front) ** 2) / 7200) * (1 - front / reach) * strength * (o.pinned ? 1 / 3 : 1);
          tx = (dx / d) * k * 90; ty = (dy / d) * k * 90;
        }
      }
      spring(s, tx, ty, dt);
      o.anim.offset[0] += s.x; o.anim.offset[1] += s.y;
      if (!still) { o.anim.scale *= 1 + 0.15 * k; o.anim.state += k * (1 - o.stateValue); }
    }
  },
};
