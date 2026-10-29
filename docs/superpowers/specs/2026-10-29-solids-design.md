# solids — design

Date: 2026-10-29. Status: approved by Max in conversation; this document is the written form.

## Intent

A zero-dependency library of lightweight 3D objects for the web. An object is a web
component you drop into HTML. Objects can be static, animated, or interactive, and they
can interact with each other inside a shared scene. The repo is public, the showcase is a
GitHub Pages site, and the whole thing is built so a contributor's coding agent can add a
new object by following a written contract.

Reference for look, feel, and page shape: https://libraries.dev/voice-ring (dark, glassy,
high-contrast, one component per page, Preview / Install tabs, options table, "Copy
prompt" for agents). We copy the register and the page shape, not the tech (it is SwiftUI
+ Metal).

## Goals

- Drop-in: one `<script type="module">` tag, then `<sd-scene><sd-orb></sd-orb></sd-scene>` works.
- Lightweight: no runtime dependency. Core under ~15 KB gzipped; each object a few KB.
- Four composable layers: **objects**, **animations**, **effects**, **interactions**.
- Objects in one scene can interact. First interaction: **gravity** (one object is the
  center, siblings orbit / drift toward it).
- Agent-friendly: a SKILL.md and an object contract such that an agent can add an object
  in one folder and it appears on the site with the shared controls.
- Public GitHub Pages site in the voice-ring register.

## Non-goals (v1)

- GLB / mesh import, texture loading, lighting rigs.
- Physics beyond the gravity rule (no collisions, no rigid bodies).
- React / Vue / Svelte wrappers (web components work in all of them already).
- npm publish (name `solids` is taken; `@mmaxence/solids` is free if needed later).
- Accounts, paid tiers, telemetry.

## Anti-goals

- Pulling in Three.js "just for the camera". If a feature needs it, the feature waits.
- A build step for *users*. Contributors may build; users must not have to.
- Per-object interaction code. Interactions are scene-level rules that work on any object.

## Constraints

- Browser targets: WebGL2 (all evergreen browsers, iOS 15+). Fall back to rendering
  nothing but keep the element's box so layout does not jump; set `data-fallback`.
- Honor `prefers-reduced-motion`: animations freeze at their rest pose, interactions still
  respond to direct pointer input.
- One `<canvas>` per `<sd-scene>`, not per object. Objects outside a scene auto-wrap
  themselves in an implicit scene.
- `requestAnimationFrame` loop pauses when the scene is off-screen (IntersectionObserver)
  and when the tab is hidden.
- The site must build with a plain Node script; no framework. Static HTML + the library
  itself.

## Architecture

### Package layout

```
solids/
  src/
    core/          renderer.ts (WebGL2 context, program cache, FBO ping-pong), scene.ts
                   (<sd-scene>: canvas, loop, child registry, interactions), object.ts
                   (base class for all <sd-*> objects), math.ts (vec/mat, easing),
                   registry.ts (object/anim/effect/interaction registries)
    objects/<name>/  manifest.json, vert.glsl, frag.glsl, README.md   (one folder per object)
    animations/    idle, spin, pulse, breathe, float   (small TS modules: (t, params) → transform/uniform deltas)
    effects/<name>/  manifest.json, frag.glsl           (post passes: glow, beam, rgb-split, pixelate, dither)
    interactions/  pointer-follow, hover-lift, gravity (scene-level rules)
    index.ts       registers everything; the single entry users load
  site/            static site source (index.html, one page per object generated from manifests)
  scripts/         build.mjs (esbuild → dist/solids.js), gen-site.mjs (manifests → pages)
  docs/            design, SKILL.md, CONTRIBUTING.md
  dist/            committed build output for GitHub Pages / jsDelivr
```

### Rendering

- Each object = a vertex shader + fragment shader + a `manifest.json` describing uniforms
  (name, type, default, range, label). Geometry is generated procedurally by the base class
  from a manifest `geometry` field: `sphere`, `torus`, `box`, `plane`, `icosahedron`, with
  a `detail` level. Objects are raymarched or mesh-shaded at the author's choice; the
  contract only fixes the uniform names the core provides.
- Core-provided uniforms: `uTime`, `uResolution`, `uModel`, `uView`, `uProjection`,
  `uPointer` (scene-local, -1..1), `uState` (0..1 eased object state), `uTheme`
  (0 dark, 1 light).
- Scene renders every object into one FBO, then runs the effect chain (each effect a
  fullscreen frag pass, ping-pong), then blits to the canvas. Effects can be set on the
  scene (apply to all) or on an object (rendered in its own FBO then composited; v1 may
  implement object-level effects as a scene-level chain filtered by object id if the
  per-object path proves too heavy; mark it `ponytail:` if so).
- Transparent canvas by default so objects sit on the host page's background.

### Elements and attributes

```html
<script type="module" src="https://mmaxence.github.io/solids/dist/solids.js"></script>

<sd-scene interaction="gravity" effect="glow" theme="auto">
  <sd-orb  gravity="center" animation="breathe" color="#9bd1ff"></sd-orb>
  <sd-ring animation="spin"  speed="0.6"></sd-ring>
  <sd-crystal animation="float" effect="rgb-split"></sd-crystal>
</sd-scene>
```

- `<sd-scene>`: `interaction` (space-separated list), `effect` (space-separated list),
  `theme` (`auto|dark|light`), `paused`. Children are positioned by CSS: each `<sd-*>`
  is an inline-block box; the scene reads each child's layout rect every frame (cheap,
  cached) and renders the object centered in it. Interactions may offset the rendered
  position without touching layout.
- `<sd-*>` (every object): `animation`, `speed`, `effect`, `state` (`idle|active|
  busy|off`, eased), `color`, `size` (CSS size shorthand; default 160px), plus the
  object's own manifest uniforms as attributes (kebab-case). All attributes are also
  properties; changes re-render without re-mounting.
- Gravity: `gravity="center"` marks the attractor. Other children accept
  `gravity="orbit"` (default when a center exists; circular orbit around the center at
  their rest distance), `gravity="fall"` (drift toward the center, ease, stop at
  `gravity-gap`), `gravity="none"`. Scene attribute `gravity-strength` (0..1). Changing
  the center at runtime eases the transition; nothing snaps.
- Pointer follow: objects tilt toward the pointer with a spring. Hover lift: hovered
  object scales up and its `uState` eases to 1.

### Animations

Pure functions `(t, params, object) → { rotation, position, scale, uniforms }` applied
before the object's model matrix is built. Composable: `animation="spin breathe"`. Easing
between animation changes over ~400 ms, same for `state`.

### Effects

Each effect is a folder with `manifest.json` (params) and `frag.glsl` reading `uScene`
(previous pass) and writing color. v1 set: `glow` (bloom-ish: threshold + blur + add),
`beam` (directional streak, voice-ring like), `rgb-split`, `pixelate`, `dither`
(ordered Bayer, retro), `scanlines`. Chain order is attribute order.

### Agent contract (SKILL.md)

An object is exactly:

```
src/objects/<name>/
  manifest.json   { name, tag, description, geometry, detail, uniforms:[{name,type,default,min,max,label}], tags:[] }
  vert.glsl       may be omitted → core default (MVP transform, passes normal/uv)
  frag.glsl       required; receives core uniforms + manifest uniforms
  README.md       one paragraph: what it is, what each param does, one html snippet
```

`npm run check` validates manifests, compiles every shader headlessly (via a tiny
Node+headless-Chrome script, or `glslangValidator` if present; pick the one that needs
no new dependency first), and fails on unknown uniforms. `npm run site` regenerates a
page per object. Nothing else is required: no registration file to edit (the build
globs the folder). The same contract applies to effects. SKILL.md is written for an
agent: the contract, the core uniforms, the look rules (dark glassy, no flat gray, one
accent per object), and the three commands.

The site's **Copy prompt** button copies: the object's README, its attribute table, and
one sentence telling the agent where the SKILL.md lives.

### Site

Static, generated. Shell copies voice-ring's structure: left sidebar (Getting started:
Introduction, Accessibility; Objects: one per manifest; Effects; Interactions), main
column with title, description, Preview / Install tabs, live controls (every manifest
uniform becomes a slider or color input; animation, effect, interaction become selects),
code block that updates live with the current attributes, then Options table, then
License. One dedicated **Scene** page demonstrates gravity with three objects and a
"pick center" control. Dark by default, light theme toggle. Fonts: system stack. Colors:
near-black background, white text, one cool accent, glass panels (translucent white at
~6 %, 1 px border at ~12 %).

Hosting: GitHub Pages from `/site` output on `main` via Actions (`actions/deploy-pages`).
`dist/` is committed so the script tag URL works without a release step.

### Tooling

- TypeScript, esbuild (the one dev dependency besides typescript), no test framework:
  `scripts/check.mjs` is the test (manifest schema, shader compile, bundle size budget).
- `npm run dev`: esbuild serve + site regen on change.
- License: MIT.

## Decisions already made (by Max)

- Zero-dependency WebGL2; no Three.js.
- Objects are abstract shapes (orbs, rings, crystals, coils), not icons or product mockups.
- Gravity is the first scene interaction; one object is the center, siblings gravitate.
- Effects layer: glow, beam, rgb-split, pixelate, retro/dither.
- Look and feel and page shape mirror voice-ring: neat, high-contrast, glassy, dark.
- Public repo + public GitHub Pages.

## Calls made by the builder (Claude), overridable

- Name `solids`, tag prefix `sd-`, GitHub `mmaxence/solids`.
- Web components as the injection mechanism (vs. a JS function).
- One canvas per scene, positions from child layout rects.
- Contributions land in this repo via PR; the contract also works in a user's own project
  by importing the base class.
- v1 objects: `orb`, `ring`, `crystal`, `coil`, `blob`, `cube`. Six, no more.
- Site is hand-written static HTML generated by one Node script; no framework.

## Left to the builder

- Exact raymarch vs. mesh choice per object.
- Spring constants, easing curves, default colors (tune by eye against voice-ring).
- How effects compose when set on both scene and object (scene chain runs last).
- Headless shader-compile approach for `npm run check`.
