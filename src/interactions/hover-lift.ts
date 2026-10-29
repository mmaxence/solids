import type { Interaction } from '../core/registry';
import { ease } from '../core/math';
import type { SdObject } from '../core/object';

const lift = new WeakMap<SdObject, number>();

export const hoverLift: Interaction = {
  meta: { name: 'hover-lift', description: 'The object under the pointer grows a little and brightens to its active state.', params: [] },
  frame(scene, dt, pointer) {
    for (const o of scene.objects) {
      if (!o.rect) continue;
      const cx = o.rect.x + o.rect.width / 2 + o.anim.offset[0], cy = o.rect.y + o.rect.height / 2 + o.anim.offset[1];
      const hit = pointer.inside && Math.abs(pointer.x - cx) <= o.rect.width / 2 && Math.abs(pointer.y - cy) <= o.rect.height / 2;
      const l = ease(lift.get(o) ?? 0, hit ? 1 : 0, dt, 160);
      lift.set(o, l);
      o.anim.scale *= 1 + 0.08 * l;
      o.anim.state += l * (1 - o.stateValue);
    }
  },
};
