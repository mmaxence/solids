# cube

A rounded glass cube. It sits still well, which makes it a natural center of gravity, and `idle` gives it a slow, deliberate turn.

- `radius` (0 to 0.5, default 0.08): corner rounding. 0.5 turns it into a sphere.
- `bevel` (0 to 1, default 0.3): how much the edges are chamfered.

```html
<sd-scene interaction="gravity">
  <sd-cube gravity="center" animation="idle"></sd-cube>
  <sd-orb size="80px"></sd-orb>
</sd-scene>
```
