# blob

A soft sphere whose surface wobbles like liquid. It animates on its own through time, so it needs no `animation` to feel alive.

- `wobble` (0 to 1, default 0.5): amplitude of the surface displacement.
- `rim` (0 to 2, default 1.2): fresnel edge brightness.

```html
<sd-scene>
  <sd-blob color="color(display-p3 0.55 0.85 1)" wobble="0.7"></sd-blob>
</sd-scene>
```
