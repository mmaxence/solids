## Built for agents

solids is made to be extended by a coding agent. Every object follows one short contract, a manifest, a shader with a `map()` function and a README, so an agent that reads it can add a shape that fits the family. The new object gets its own page here, with the shared controls.

1. Clone the repo and give your agent [skill.md](skill.md), the contract.
2. Describe the shape you want in a sentence or two.
3. Run `npm run check`. When it prints `ok`, the object compiles, draws and fits the size budget.

```text
Read https://mmaxence.github.io/solids/skill.md, then add an object to solids:
a pebble, a flattened stone with a soft edge, with one parameter for how flat it is.
Run npm run check until it prints ok.
```

Agents that browse can start from [llms.txt](llms.txt), a plain index of every page. Each page has a Copy prompt button that hands over its markup and options.

## Install

Add one script tag, then use the tags anywhere in your markup.

```html
<script type="module" src="https://mmaxence.github.io/solids/solids.js"></script>

<sd-scene interaction="gravity" effect="glow">
  <sd-orb gravity="center" animation="breathe" color="#9bd1ff"></sd-orb>
  <sd-ring animation="spin" color="#c9b3ff"></sd-ring>
  <sd-crystal animation="float" color="#ff9bd1"></sd-crystal>
</sd-scene>
```

## Four layers

Four layers compose on any object. Each one is a single attribute, and each name links to its page.

## Universe

One element fills its box with a seeded cloud of shapes in three dimensions. Drag it to turn it, or let it spin; the largest shape holds the others in orbit, the free ones drift and bounce, and a depth of field blurs them away from the focal plane. Tune every knob on the [Universe page](universe.html), or paste the markup and edit it by hand.

## Catalogue

Every object, effect and interaction has a page with a live preview, its options and the markup to copy.

## Performance

One script and no dependencies. A scene draws all of its objects on one canvas, and pauses when it leaves the screen. The [Performance page](performance.html) has a live meter and a benchmark that runs in your browser.

## Details

### Sizing and placement

An object is an inline block, 160 px square by default. Set `size` or the `--sd-size` custom property to change it, and place objects with normal CSS. A scene owns one canvas that covers its own box, so give the scene a size and the objects can move anywhere inside it. A scene's `dpr` attribute caps the device pixel ratio it renders at (default 2).

### Color

`color` takes any CSS color: hex, `rgb()`, `oklch()`, or `color(display-p3 r g b)`. Where the browser supports it, the canvas draws in Display P3, so a P3 color outside sRGB shows at full strength on a wide-gamut screen. Elsewhere it shows the closest sRGB color.

### Fallback

Without WebGL2 the elements keep their box, draw nothing, and get a `data-fallback` attribute you can style.

### Accessibility

Objects are decorative, freeze under reduced motion, and pause off screen. Read [Accessibility](accessibility.html) for focus, contrast and the context limit.
