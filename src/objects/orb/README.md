# orb

A glassy sphere with a fresnel rim and a soft halo. It is the simplest object in the library and the reference the others are tuned against.

- `glow` (0 to 1, default 0.6): strength of the soft halo around the sphere.
- `rim` (0 to 2, default 1): how bright the fresnel edge gets.

```html
<sd-scene>
  <sd-orb color="color(display-p3 0.55 0.85 1)" glow="0.8" animation="breathe"></sd-orb>
</sd-scene>
```
