import { animations as registry, type Animation } from '../core/registry';
import { idle } from './idle';
import { spin } from './spin';
import { pulse } from './pulse';
import { breathe } from './breathe';
import { float } from './float';

export const animations: Animation[] = [idle, spin, pulse, breathe, float];
for (const a of animations) registry.set(a.meta.name, a);
