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

// Registry order is the chip order on the site, which rebuilds a scene's interaction attribute (the frame order) in this order:
// gravity first (it sets depth the others read), tap rules before collide (collide sees where a tap moved things).
export const interactions: Interaction[] = [gravity, pointerFollow, hoverLift, repel, magnet, shockwave, poke, pull, collide, scroll];
for (const i of interactions) registry.set(i.meta.name, i);
