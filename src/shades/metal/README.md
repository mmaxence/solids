# metal

Polished metal. The surface reflects a studio environment, a vertical gradient with a bright horizon stripe, tinted by the color, with a tight highlight from the key light and brighter edges. The environment is dark in the dark theme and pale in the light one.

- `light` (0 to 360, default 120): where the key light comes from, around the view.
- `roughness` (0 to 1, default 0.25): widens the highlight and fades the horizon stripe.

```html
<sd-scene shading="metal" metal-roughness="0.1">
  <sd-ring color="color(display-p3 0.55 0.85 1)"></sd-ring>
</sd-scene>
```
