import { interactions as registry, type Interaction } from '../core/registry';
import { pointerFollow } from './pointer-follow';
import { hoverLift } from './hover-lift';
import { gravity } from './gravity';

export const interactions: Interaction[] = [pointerFollow, hoverLift, gravity];
for (const i of interactions) registry.set(i.meta.name, i);
