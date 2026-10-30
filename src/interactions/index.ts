import { interactions as registry, type Interaction } from '../core/registry';
import { pointerFollow } from './pointer-follow';
import { hoverLift } from './hover-lift';
import { gravity } from './gravity';
import { repel } from './repel';
import { magnet } from './magnet';
import { collide } from './collide';
import { scroll } from './scroll';
import { shockwave } from './shockwave';
import { poke } from './poke';
import { pull } from './pull';

// Tap rules sit before collide so collide sees where a tap moved things.
export const interactions: Interaction[] = [pointerFollow, hoverLift, gravity, repel, magnet, shockwave, poke, pull, collide, scroll];
for (const i of interactions) registry.set(i.meta.name, i);
