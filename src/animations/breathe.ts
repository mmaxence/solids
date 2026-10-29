import type { Animation } from '../core/registry';
export const breathe: Animation = {
  meta: { name: 'breathe', description: 'A slow swell in scale and brightness, one breath every 4 seconds.', params: [] },
  fn: (t) => { const s = Math.sin(t * 2 * Math.PI * 0.25); return { scale: 1 + 0.03 * s, state: 0.1 * s }; },
};
