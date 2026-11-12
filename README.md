# Living Object

Part of **Living Things — Libraries for a living web**. Formerly **Solids**. Existing repository URLs, package names, imports and APIs remain unchanged.


Lightweight 3D objects for the web. Zero dependencies, about 27 KB gzipped for the whole library.

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

## Delivery status

Living Object is distributed as browser ES modules from this repository and the site. The local package is private; **`npm install solids` installs an unrelated package**, not Living Object. No npm release or ownership of that registry name is claimed.

## Local package and TypeScript

Build and pack from the checkout (packing also builds fresh JS and declarations):

```sh
npm ci
npm pack
# In a separate browser application; use the tarball path printed above:
npm install /absolute/path/to/solids-0.1.0.tgz
```

This installs a local artifact, not the unrelated registry package. The manifest stays `private: true` while registry identity and publication are unresolved.

```ts
import { SdScene, SdObject, registry } from 'solids';
// Existing explicit package path also works:
import { defineObject } from 'solids/dist/solids.js';

const scene: SdScene = document.createElement('sd-scene');
const orb: SdObject = document.createElement('sd-orb');
orb.setAttribute('animation', 'spin');
scene.append(orb);
document.body.append(scene);
// Disconnecting releases observers, scheduling and the WebGL context:
scene.remove();
```

Native browser imports still use a served module URL or an import map; a browser does not resolve npm names by itself. Hosted `solids.js`/`core.js` URLs and `sd-*` tags are unchanged. Runtime modules require browser DOM APIs; these entry points are not SSR renderers.

| Import | Runtime | Types and registration |
| --- | --- | --- |
| `solids` | `dist/solids.js` | Emitted declarations; full shape/text element registration |
| `solids/core` | `dist/core.js` | Emitted core declarations; scene/universe only, no shape catalogue |
| `solids/dist/solids.js` | Same full file | Compatible explicit import with the same types |
| `solids/dist/core.js` | Same core file | Compatible explicit core import with the same types |

Full and core are alternative entry bundles with separate registries; choose one per application realm rather than mixing them. The core entry is for custom registration with `defineObject`; its empty object registry is intentional. Custom dynamic tags and reflected attributes use `setAttribute` or explicit consumer types. Known `document.createElement` tags are typed for the entry that actually registers them. Shape parameters remain attributes, not invented constructor options.

The tarball contains the built JS/source maps, emitted declaration graph, README, MIT license, integration guide and extension guide. It excludes the site, scratch pages, internal plans, source/build scripts and tests. Custom-shape development uses the repository and [extension guide](docs/SKILL.md); copying the tarball alone is not a shader-source development checkout.

`npm run check:package` builds and packs, installs into a fresh temporary project, checks contents, typechecks NodeNext and Bundler consumers, then checks bundled browser registration for root/core and explicit paths. It requires Chrome (`CHROME` can select it). This contract is validated locally; it does not claim authenticated registry ownership, a registry release, or broad browser/device certification.

## Integration and lifecycle

The current alpha contains **12 shapes**. Start with the [integration guide](docs/integration.md) for client-only imports, connection/disconnection, pause, reduced-motion limits, mobile/static alternatives and rendering costs. Run the [static-first lifecycle example](examples/lifecycle/index.html) after building and serving the checkout. Its application helpers are not runtime APIs.

Visible reduced-motion scenes can still request animation frames; reduced preference is not equivalent to `paused`. A fully static alternative must be authored by the application. Removing an owned scene releases its observers/scheduling and queues context release; no `destroy()` controller is provided. Root/core local tarball imports and declarations work as described above; registry identity and public availability remain separate.

## Five layers

| Layer | What it is | Set with |
|---|---|---|
| Objects | orb, ring, crystal, coil, blob, cube, knot, prism, capsule, star, shell, disc | the tag: `<sd-orb>` |
| Animations | idle, spin, pulse, breathe, float | `animation="spin breathe"` |
| Effects | glow, beam, rgb-split, pixelate, dither, scanlines, halftone, outline, grain, vignette, chroma, ripple, defocus | `effect="glow"` on an object or a scene |
| Shades | glass, matte, cel, clay, metal | `shading="cel"` on an object or a scene |
| Interactions | gravity, pointer-follow, hover-lift, repel, magnet, shockwave, poke, pull, collide, scroll | `interaction="gravity shockwave"` on a scene |

`<sd-text><h1>Solids</h1></sd-text>` lifts an HTML heading into 3D in its own font, with depth, a pixel mode and every shade and interaction (see the [Text page](https://mmaxence.github.io/solids/text.html)). Tap or click a scene with `shockwave`, `poke` or `pull` listed and the shapes answer.

Objects outside a scene work on their own. Inside a scene they share one canvas and can react to each other: mark one `gravity="center"` and the rest orbit it on rings, farther rings turning slower.

`<sd-universe count="36" seed="1" collide>` fills its box with a seeded cloud of shapes in 3D: a camera that spins, drags and tilts toward the pointer, a depth of field around its `focus` plane, and elastic bounces.

## Develop

```sh
npm ci
npm run dev     # builds, generates the site, serves it on http://127.0.0.1:4110
npm run check   # manifests, shader compile, pixel smoke tests, size budgets, site pages
npm run check:package  # local tarball, exports/declarations, browser registration
npm run check:docs     # current guide/example/build mirrors
npm run check:examples # source/built/installed lifecycle and static alternatives
```

`check` needs Chrome for the shader and smoke tests. It looks at `$CHROME`, then the macOS app path, then `google-chrome` and `chromium` on the PATH. Without Chrome it validates manifests and sizes and warns about the rest.

## License

MIT

The website loads DM Sans from Google Fonts; font binaries are not bundled and retain their own license.

The current Object wordmark uses CSS motion. Earlier Materia animation code and its MIT license remain retained in `site/src/brand/`; the site does not load that animation script.
