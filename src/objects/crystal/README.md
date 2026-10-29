# crystal

A faceted octahedral gem with flat facets and sharp highlights. Facets catch the light as it turns, so it pairs well with `spin` or `idle`.

- `facets` (1 to 3, default 2): how many extra cuts trim the octahedron's corners.
- `clarity` (0 to 1, default 0.7): translucency of the body. Lower reads as frosted.
- `stretch` (0.6 to 2, default 1.4): vertical elongation.

```html
<sd-scene>
  <sd-crystal color="color(display-p3 1 0.55 0.8)" animation="spin idle"></sd-crystal>
</sd-scene>
```
