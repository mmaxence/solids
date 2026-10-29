import type { Interaction } from '../core/registry';
import { interactionValue } from '../core/registry';
import { reducedMotion, type SdObject } from '../core/object';

const pushes = new WeakMap<SdObject, [number, number]>();

export const collide: Interaction = {
  meta: {
    name: 'collide',
    description: 'Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.',
    params: [{ name: 'gap', type: 'float', default: 8, min: 0, max: 80, step: 1, label: 'Space kept between objects (px)' }],
  },
  frame(scene, dt) {
    const gap = interactionValue(scene, 'collide', 'gap');
    const objs = [...scene.objects].filter((o) => o.rect);
    // Where each object is drawn this frame, before collide.
    const start = objs.map((o) => [o.rect!.x + o.rect!.width / 2 + o.anim.offset[0], o.rect!.y + o.rect!.height / 2 + o.anim.offset[1]]);
    const pos = start.map((p) => [...p]);
    // A gravity center holds still; its neighbors take the whole push.
    const free = objs.map((o) => (o.getAttribute('gravity') === 'center' ? 0 : 1));
    // ponytail: four relaxation passes over all pairs, O(n²); fine for a scene's dozen objects.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
        let dx = pos[j][0] - pos[i][0], dy = pos[j][1] - pos[i][1];
        const d = Math.hypot(dx, dy), min = (objs[i].rect!.width + objs[j].rect!.width) / 2 + gap, w = free[i] + free[j];
        if (d >= min || !w) continue;
        if (d < 1e-3) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
        const a = ((min - d) * free[i]) / w, b = ((min - d) * free[j]) / w;
        pos[i][0] -= dx * a; pos[i][1] -= dy * a;
        pos[j][0] += dx * b; pos[j][1] += dy * b;
      }
    }
    // Ease toward the resolved spot; no velocity. Under reduced motion, place it at once.
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt / 120);
    objs.forEach((o, i) => {
      const cur = pushes.get(o) ?? [0, 0];
      const next: [number, number] = [cur[0] + (pos[i][0] - start[i][0] - cur[0]) * k, cur[1] + (pos[i][1] - start[i][1] - cur[1]) * k];
      pushes.set(o, next);
      o.anim.offset[0] += next[0];
      o.anim.offset[1] += next[1];
    });
  },
};
