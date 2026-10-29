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

- **Every object is an SDF raymarched in a fragment shader on a camera-facing quad.** No
  mesh geometry in v1 (the `geometry` field is dropped; coil, blob and crystal are SDFs).
  One shared quad vertex shader lives in core, so an object folder has only `frag.glsl`.
- Space is **2D screen space in CSS pixels**: the scene's canvas covers the scene's own
  box (absolutely positioned, DPR capped at 2). Each object's quad is its layout rect
  enlarged by a `bleed` factor from its manifest (default 1.5) so glow and beams can spill
  past the box; objects are clipped at the scene's edge, which the author sizes. Rects
  are re-read on ResizeObserver and scroll, not every frame.
- Core-provided uniforms: `uTime`, `uResolution` (quad px), `uPointer` (quad-local,
  -1..1), `uRotation` (mat3, from animations and interactions), `uScale`, `uState`
  (0..1 eased), `uTheme` (0 dark, 1 light), `uColor` (vec3), plus manifest uniforms.
- Draw order: objects sorted by their interaction-provided z (gravity gives orbiting
  objects a small z for depth cue), painter's algorithm with premultiplied alpha. No depth
  buffer.
- **Effects:** an object with its own `effect` list renders into its own quad-sized FBO,
  runs its chain there, and is composited; objects without effects draw straight into the
  scene FBO. The scene's chain runs last over the whole scene FBO at half resolution, then
  blits. Effects are fullscreen frag passes reading `uScene`, ping-pong.
- Transparent canvas by default so objects sit on the host page's background.
- Implicit scene: an `<sd-*>` with no `<sd-scene>` ancestor runs as a one-object scene
  inside its own shadow root (own canvas, no DOM wrapper inserted, so the author's layout
  is untouched). Scene-level interactions are no-ops there.

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
  is an inline-block box; the scene renders each object centered in its layout rect.
  Interactions may offset the rendered position (in CSS px) without touching layout.
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

Pure functions `(t, params, object) → { rotation, offset, scale, uniforms }` applied
before the object's uniforms are set. Each animation and interaction module exports a
`meta` object (name, description, params with defaults and ranges); the site generator
imports the built bundle and reads `meta` to produce selects, option tables and pages. Composable: `animation="spin breathe"`. Easing
between animation changes over ~400 ms, same for `state`.

### Effects

Each effect is a folder with `manifest.json` (params) and `frag.glsl` reading `uScene`
(previous pass) and writing color. v1 set: `glow` (bloom-ish: threshold + blur + add),
`beam` (directional streak, voice-ring like), `rgb-split`, `pixelate`, `dither`
(ordered Bayer, retro), `scanlines`. Six effects, scanlines included. Chain order is
attribute order.

### Agent contract (SKILL.md)

An object is exactly:

```
src/objects/<name>/
  manifest.json   { name, tag, description, geometry, detail, uniforms:[{name,type,default,min,max,label}], tags:[] }
  vert.glsl       may be omitted → core default (MVP transform, passes normal/uv)
  frag.glsl       required; receives core uniforms + manifest uniforms
  README.md       one paragraph: what it is, what each param does, one html snippet
```

`npm run check` validates manifests, compiles every shader headlessly, and fails on
unknown uniforms. Shader compile uses `chrome --headless=new --dump-dom` on a generated
page that compiles each program and writes results into the DOM (no dependency; locally,
if Chrome is not found, the compile step is skipped with a warning). CI runs `check`
before deploy. `check` also takes a screenshot of the Scene demo page and fails if the
canvas is blank or the console has errors. `npm run site` regenerates a
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
  `scripts/check.mjs` is the test (manifest schema, shader compile, bundle size budget,
  demo smoke screenshot). GLSL and JSON are inlined into the bundle with esbuild loaders.
- Size budget, measured by `check`: core (renderer, scene, base object, registries,
  animations, interactions) under 15 KB gzipped; the full `dist/solids.js` with all six
  objects and six effects under 40 KB gzipped. One bundle, no lazy loading.
- Performance bar: 60 fps on an Apple-silicon laptop with six objects, gravity and glow
  on; raymarch capped at 64 steps; scene effects at half resolution.
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
- All v1 objects are SDF raymarched on quads; no mesh pipeline. Screen-space 2D layout
  with a z depth cue; no real camera.
- Per-object effects via per-object FBO; scene chain runs last at half resolution.
- Single bundle, two size budgets (core 15 KB, full 40 KB gzipped).
- Shader compile check via headless Chrome `--dump-dom`; CI gates deploy on `check`.
- Lone objects run as one-object scenes in their own shadow root.

## Left to the builder

- Spring constants, easing curves, default colors (tune by eye against voice-ring).
- How effects compose when set on both scene and object (scene chain runs last).
- Headless shader-compile approach for `npm run check`.
