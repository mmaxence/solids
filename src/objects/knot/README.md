# knot

A glass tube that runs twice around a ring and winds through itself on the way. With three twists it is a trefoil, the simplest true knot. It rewards a slow `spin`: the crossings slide over each other.

- `twist` (1 to 5, default 3): how many times the tube winds around the ring, which is the number of lobes you see from the front. Odd numbers give a knot, even numbers give two linked loops.
- `thickness` (0.04 to 0.15, default 0.09): tube radius.

```html
<sd-scene>
  <sd-knot color="#c9b3ff" animation="spin" speed="0.4"></sd-knot>
</sd-scene>
```
