import { interactions as registry, type Interaction } from '../core/registry';
import { pointerFollow } from './pointer-follow';
import { hoverLift } from './hover-lift';
import { gravity } from './gravity';
import { repel } from './repel';
import { magnet } from './magnet';
import { collide } from './collide';
import { scroll } from './scroll';

export const interactions: Interaction[] = [pointerFollow, hoverLift, gravity, repel, magnet, collide, scroll];
for (const i of interactions) registry.set(i.meta.name, i);
