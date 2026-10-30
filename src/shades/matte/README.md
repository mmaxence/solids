# matte

An opaque, softly lit surface. Diffuse light wraps around the shape with a firm terminator, a faint sky light comes from above, and one broad highlight sits where the key light reflects. On a light background the edges darken slightly so the silhouette holds; on a dark one a faint rim keeps it off black.

- `light` (0 to 360, default 120): where the key light comes from, around the view. 0 is from the right, 90 from the top.
- `softness` (0 to 1, default 0.5): how far the light wraps past the terminator.

```html
<sd-scene shading="matte" matte-light="300">
  <sd-knot color="color(display-p3 0.78 0.66 1)"></sd-knot>
</sd-scene>
```
