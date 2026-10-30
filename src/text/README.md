# text

Your HTML text as a solid. `<sd-text>` reads the text it wraps (its own text, or an element inside it such as an `<h1>`), rasterizes it with that element's computed CSS font, turns the raster into a signed distance field, and draws an extruded, shaded twin exactly over the HTML. The HTML stays in the page for layout, screen readers and search; only its color is made transparent. Every shade, effect, animation and interaction applies to the word like to any object.

- `depth` (0.02 to 1, default 0.35): half the thickness of the extrusion.
- `bevel` (0 to 1, default 0.25): rounding of the edges.
- `pixel` (0 to 24, default 0): rasterize at that cell size in px for a pixel-font look from any monospace. 0 keeps the glyphs smooth.

The font, size and spacing come from CSS (`font-size` rules; `size` does nothing here). One line of text.

```html
<sd-scene interaction="pointer-follow poke">
  <sd-text pixel="6" depth="0.5" color="color(display-p3 0.55 0.85 1)" style="font: 700 96px ui-monospace, Menlo, monospace"><h1>Solids</h1></sd-text>
</sd-scene>
```
