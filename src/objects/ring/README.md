# ring

A glassy torus tilted toward the viewer. It reads well spinning on its own, and as a satellite orbiting a center object in a gravity scene.

- `thickness` (0.05 to 0.5, default 0.16): tube radius relative to the ring.
- `tilt` (0 to 1, default 0.55): how far the ring leans toward the viewer. 0 is edge-on, 1 is flat.
- `rim` (0 to 2, default 1): fresnel edge brightness.

```html
<sd-scene>
  <sd-ring color="#c9b3ff" animation="spin" speed="0.6"></sd-ring>
</sd-scene>
```
