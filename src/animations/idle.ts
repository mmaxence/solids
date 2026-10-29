import type { Animation } from '../core/registry';
const D = Math.PI / 180;
export const idle: Animation = {
  meta: { name: 'idle', description: 'A slow sway, as if the object were resting in still air.', params: [] },
  fn: (t) => ({ rotation: [Math.sin(t * 2 * Math.PI / 9) * 4 * D, Math.sin(t * 2 * Math.PI / 6) * 8 * D, 0] }),
};
