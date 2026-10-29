# shell

A spiral shell made of glass beads that grow along a logarithmic spiral, the curve of a nautilus. It is the most detailed object in the set and holds up at large sizes.

- `turns` (1 to 4, default 2.5): how many times the spiral winds in.
- `growth` (0.1 to 0.26, default 0.18): how fast the beads grow from the center out. Low values give many tight turns, high values a fast flare.

```html
<sd-scene>
  <sd-shell color="#ff9bd1" animation="idle"></sd-shell>
</sd-scene>
```
