import type { Animation } from '../core/registry';
export const spin: Animation = {
  meta: { name: 'spin', description: 'A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.', params: [] },
  fn: (t) => ({ rotation: [0, t * 2 * Math.PI / 8, 0] }),
};
