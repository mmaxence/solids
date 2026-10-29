import type { Animation } from '../core/registry';
export const float: Animation = {
  meta: { name: 'float', description: 'A gentle bob with a little sideways drift.', params: [] },
  fn: (t) => ({ offset: [Math.sin(t * 2 * Math.PI * 0.17) * 3, Math.sin(t * 2 * Math.PI * 0.4) * 6] }),
};
