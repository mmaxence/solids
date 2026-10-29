# solids

Lightweight 3D objects for the web. Zero dependencies, about 11 KB gzipped for the whole library.

Each object is a web component drawn by a fragment shader. Drop one into any HTML page, give it an animation, an effect, and let it interact with its neighbours inside a scene.

Site and live demos: https://mmaxence.github.io/solids/

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
| Effects | glow, beam, rgb-split, pixelate, dither, scanlines | `effect="glow"` on an object or a scene |
| Interactions | pointer-follow, hover-lift, gravity | `interaction="gravity"` on a scene |

Objects outside a scene work on their own. Inside a scene they share one canvas and can react to each other: mark one `gravity="center"` and the rest orbit it.

## Add your own object

An object is one folder: a manifest, a fragment shader with a `map()` function, and a short README. The contract is written for coding agents in [docs/SKILL.md](docs/SKILL.md). Hand it to your agent, describe the shape, and `npm run check` tells you whether it is valid. See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR flow.

## Develop

```sh
npm install
npm run dev     # builds, generates the site, serves it on http://127.0.0.1:4110
npm run check   # manifests, shader compile, pixel smoke tests, size budgets, site pages
```

`check` needs Chrome for the shader and smoke tests. It looks at `$CHROME`, then the macOS app path, then `google-chrome` and `chromium` on the PATH. Without Chrome it validates manifests and sizes and warns about the rest.

## License

MIT
