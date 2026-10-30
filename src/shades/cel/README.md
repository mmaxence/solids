# cel

Cartoon shading. Light falls in flat bands instead of a gradient, the highlight is one hard dot, and a line of ink runs along the silhouette and the grazing edges. In the dark theme the ink is a bright tint of the color; in the light theme it is a dark one.

- `light` (0 to 360, default 120): where the key light comes from, around the view.
- `bands` (2 to 5, default 3): how many steps of light.
- `ink` (0 to 1, default 0.8): how strong the rim and outline are.

```html
<sd-scene shading="cel" cel-bands="2">
  <sd-star color="color(display-p3 1 0.8 0.5)"></sd-star>
</sd-scene>
```
