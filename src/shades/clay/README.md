# clay

The look of a clay render: the color is pulled toward a warm putty, light wraps softly around the shape, a warm glow shows through at the back and on thin edges, and creases darken with a cheap occlusion along the normal.

- `light` (0 to 360, default 120): where the key light comes from, around the view.
- `warmth` (0 to 1, default 0.5): how much warm light shows through the material.

```html
<sd-scene shading="clay">
  <sd-shell color="color(display-p3 1 0.8 0.5)"></sd-shell>
</sd-scene>
```
