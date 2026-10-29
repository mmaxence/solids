import type { Interaction } from '../core/registry';
import { num } from '../core/registry';
import type { SdObject } from '../core/object';
import { reducedMotion } from '../core/object';
import type { SdScene } from '../core/scene';
import { lerp } from '../core/math';

type Body = { angle: number; r: number; center: SdObject | null; offset: [number, number]; from: [number, number]; k: number };
const bodies = new WeakMap<SdObject, Body>();
const mid = (o: SdObject): [number, number] => [o.rect!.x + o.rect!.width / 2, o.rect!.y + o.rect!.height / 2];
const smooth = (k: number) => k * k * (3 - 2 * k);

export const gravity: Interaction = {
  meta: {
    name: 'gravity',
    description: 'One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.',
    params: [
      { name: 'strength', type: 'float', default: 0.6, min: 0, max: 1, step: 0.01, label: 'Strength (scene attribute gravity-strength)' },
      { name: 'gap', type: 'float', default: 24, min: 0, max: 200, step: 1, label: 'Fall gap in px (object attribute gravity-gap)' },
    ],
  },
  frame(scene: SdScene, dt) {
    const objs = [...scene.objects].filter((o) => o.rect);
    const center = objs.find((o) => o.getAttribute('gravity') === 'center') ?? null;
    const strength = num(scene.getAttribute('gravity-strength'), 0.6);
    const c = center ? mid(center) : null;
    const frozen = reducedMotion();
    for (const o of objs) {
      const mode = o.getAttribute('gravity');
      const active = !!c && o !== center && mode !== 'none';
      let b = bodies.get(o);
      if (!b && !active) continue;
      if (!b) bodies.set(o, (b = { angle: 0, r: 0, center: null, offset: [0, 0], from: [0, 0], k: 1 }));
      let target: [number, number] = [0, 0];
      let z = 0;
      if (active) {
        const rest = mid(o);
        if (b.center !== center) {
          // New center: blend from where the object is now onto its new path, which starts at its rest position.
          b.from = [b.offset[0], b.offset[1]]; b.k = 0; b.center = center;
          b.angle = Math.atan2(rest[1] - c![1], rest[0] - c![0]);
          b.r = Math.hypot(rest[0] - c![0], rest[1] - c![1]);
        }
        if (mode === 'fall') {
          const stop = num(o.getAttribute('gravity-gap'), 24) + (center!.rect!.width + o.rect!.width) / 4;
          if (!frozen) b.r += (stop - b.r) * (1 - Math.exp(-dt / 700)) * (0.3 + strength);
        } else {
          if (!frozen) b.angle += (dt / 1000) * 0.25 * strength;
          z = Math.sin(b.angle);
        }
        target = [c![0] + Math.cos(b.angle) * b.r - rest[0], c![1] + Math.sin(b.angle) * b.r - rest[1]];
      } else if (b.center) {
        // Lost its center (it became the center, opted out, or the scene has none): ease home.
        b.from = [b.offset[0], b.offset[1]]; b.k = 0; b.center = null;
      }
      if (b.k < 1) {
        b.k = Math.min(1, b.k + dt / 800);
        const s = smooth(b.k);
        target = [lerp(b.from[0], target[0], s), lerp(b.from[1], target[1], s)];
      }
      b.offset = target;
      o.anim.offset[0] += target[0];
      o.anim.offset[1] += target[1];
      o.anim.z = z;
      o.anim.scale *= 1 + 0.06 * z;
    }
  },
};
