import type { Animation } from '../core/registry';
export const pulse: Animation = {
  meta: { name: 'pulse', description: 'A quick heartbeat in scale, 1.2 beats per second.', params: [] },
  fn: (t) => ({ scale: 1 + 0.06 * Math.sin(t * 2 * Math.PI * 1.2) }),
};
