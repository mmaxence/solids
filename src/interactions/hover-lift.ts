import type { Interaction } from '../core/registry';
import { ease } from '../core/math';
import type { SdObject } from '../core/object';

const lift = new WeakMap<SdObject, number>();

export const hoverLift: Interaction = {
  meta: { name: 'hover-lift', description: 'The object under the pointer grows a little and brightens to its active state.', params: [] },
  frame(scene, dt, pointer) {
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const [cx, cy] = o.drawCenter(), hw = (o.rect.width / 2) * o.anim.scale, hh = (o.rect.height / 2) * o.anim.scale; // the box's half extents, so a word lifts on its letters only
      const hit = pointer.inside && Math.abs(pointer.x - cx) <= hw && Math.abs(pointer.y - cy) <= hh;
      const l = ease(lift.get(o) ?? 0, hit ? 1 : 0, dt, 160);
      lift.set(o, l);
      o.anim.scale *= 1 + 0.08 * l;
      o.anim.state += l * (1 - o.stateValue);
    }
  },
};
