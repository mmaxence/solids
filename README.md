# solids

Lightweight 3D objects for the web. Zero dependencies, about 17 KB gzipped for the whole library.

## Built for agents

solids is made to be extended by a coding agent. Every object follows one short contract (a manifest, a fragment shader with a `map()` function, and a README), so an agent that reads it can add a shape that fits the family, and the site gives it a page with the shared controls.

1. Clone the repo and give your agent [docs/SKILL.md](docs/SKILL.md), the contract. The site serves the same file at https://mmaxence.github.io/solids/skill.md.
2. Describe the shape you want in a sentence or two.
3. Run `npm run check`. When it prints `ok`, the object compiles, draws, and fits the size budget.

```text
Read https://mmaxence.github.io/solids/skill.md, then add an object to solids:
a pebble, a flattened stone with a soft edge, with one parameter for how flat it is.
Run npm run check until it prints ok.
```

Agents that browse can start from https://mmaxence.github.io/solids/llms.txt, a plain index of every page. Every page on the site has a Copy prompt button that hands over its markup and options. See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR flow.

## Install

Each object is a web component drawn by a fragment shader. Add one script tag, then use the tags anywhere in your markup. Site and live demos: https://mmaxence.github.io/solids/

```html
<script type="module" src="https://mmaxence.github.io/solids/solids.js"></script>

<sd-scene interaction="gravity" effect="glow">
  <sd-orb gravity="center" animation="breathe" color="#9bd1ff"></sd-orb>
  <sd-ring animation="spin" color="#c9b3ff"></sd-ring>
  <sd-crystal animation="float" color="#ff9bd1"></sd-crystal>
</sd-scene>
```

## Four layers

| Layer | What it is | Set with |
|---|---|---|
| Objects | orb, ring, crystal, coil, blob, cube, knot, prism, capsule, star, shell, disc | the tag: `<sd-orb>` |
| Animations | idle, spin, pulse, breathe, float | `animation="spin breathe"` |
| Effects | glow, beam, rgb-split, pixelate, dither, scanlines, halftone, outline, grain, vignette, chroma, ripple | `effect="glow"` on an object or a scene |
| Interactions | pointer-follow, hover-lift, gravity, repel, magnet, collide, scroll | `interaction="gravity"` on a scene |

Objects outside a scene work on their own. Inside a scene they share one canvas and can react to each other: mark one `gravity="center"` and the rest orbit it.

## Develop

```sh
npm install
npm run dev     # builds, generates the site, serves it on http://127.0.0.1:4110
npm run check   # manifests, shader compile, pixel smoke tests, size budgets, site pages
```

`check` needs Chrome for the shader and smoke tests. It looks at `$CHROME`, then the macOS app path, then `google-chrome` and `chromium` on the PATH. Without Chrome it validates manifests and sizes and warns about the rest.

## License

MIT
