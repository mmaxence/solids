# solids v2 — design

Date: 2026-10-29. Status: approved by Max in conversation (three streams, all equal priority, no urgency, built in parallel). Builds on `2026-10-29-solids-design.md`; everything there still holds.

## Intent

v1 proved the model: objects, animations, effects, interactions, one script tag. v2 makes the
landing hit harder, makes color richer on wide-gamut screens, and doubles the catalogue so the
library feels like a library.

## Goals

1. **Landing.** The first screen of the site is one full-viewport scene with every object type in
   it, gravity on, and a slim control dock overlaid inside the scene. Install line and the four
   layers follow on scroll. The rest of the site shape is unchanged.
2. **P3 color.** On browsers that support it, the canvas draws in Display P3 and `color` accepts
   any CSS color (`#hex`, `rgb()`, `oklch()`, `color(display-p3 …)`). Default accents move to
   picks that clip in sRGB. On a P3 screen the same markup looks richer; elsewhere it looks as
   before.
3. **Catalogue.** Six more objects, six more effects, four more interactions.

## Non-goals

- Any change to the agent contract shape (folder, manifest, `map()`, README). New entries follow it.
- Mesh import, physics beyond the listed interactions, npm publish.

## Constraints (in addition to v1)

- Budgets rise: core ≤ 18 KB, full `dist/solids.js` ≤ 60 KB gzipped. Both measured by `check`.
- Reduced motion and the 16-context cap apply to every new interaction and to the hero.
- Writing conventions: no em dashes anywhere.

## Stream A: landing

- `index.html` gets a hero above the sidebar/main frame: full width, height `calc(100vh - header)`,
  min 560 px, one `<sd-scene>` with gravity on and all twelve objects placed by hand (absolute
  positions as percentages, sizes 56 to 200 px, the center object largest, near the middle).
- The page title and one-line pitch sit in the hero's top-left over the scene; the dock sits at
  the bottom, inside the scene box: a glass bar with Center of gravity (select), Scene effect
  (select), interaction toggles (checkboxes), Strength (range), and a Copy code button. The dock
  reuses the `#spec` + `site.js` control machinery; it is the same `preview()` output styled as
  an overlay, not a second system.
- Below the hero: the existing intro content (Install, the four layers, Sizing, Fallback, Adding
  your own object) inside the normal frame with the sidebar.
- Pointer over the hero drives `pointer-follow` and `hover-lift`; objects react before any
  control is touched.
- Phone (≤ 900 px): hero height 70vh, dock collapses to two rows, title stays legible over the
  scene (a soft bottom gradient behind the dock, a soft top gradient behind the title).

## Stream B: P3 color

- `createGL`: if `'drawingBufferColorSpace' in gl`, set it to `'display-p3'`; record
  `scene.colorSpace` as `'display-p3' | 'srgb'`.
- `parseColor(s, space)`: hex and `rgb()` keep the fast path. Any other string is parsed by the
  browser through a 1×1 2D canvas created with `{ colorSpace: 'display-p3' }` when available
  (`getImageData(…, { colorSpace })`), else sRGB. Hex and rgb() are converted to P3 the same way
  when the canvas is P3, so a hex color looks identical on both paths (correct conversion, not a
  re-interpretation). Cache parsed strings in a Map.
- Scene passes `uColor` in the drawing buffer's space. Shaders are unchanged: they already treat
  `uColor` as the working primaries.
- Default accents (site palette, manifest READMEs, hero): six P3 picks that are outside sRGB,
  expressed as `color(display-p3 r g b)` in markup, with the sRGB-clipped look still acceptable.
  Document the syntax on the Introduction page (one short section: "Color") and in SKILL.md.
- `check` gains a case: `color="color(display-p3 1 0.2 0.2)"` parses to finite rgb, and on a P3
  context the red channel exceeds what `#ff3333` gives (proves the wide path is live), and a
  case that `oklch(70% 0.2 30)` parses.

## Stream C: catalogue

Objects (SDFs, same contract; two or three uniforms each; bake a rest rotation where needed):
- `knot`: torus knot (p=2, q=3 default; `twist`, `thickness`).
- `prism`: triangular or hexagonal prism (`sides` 3..8, `height`).
- `capsule`: pill (`length`, `radius`).
- `star`: five-point star extruded (`points` 4..8, `depth`).
- `shell`: spiral shell, a logarithmic spiral of spheres (`turns`, `growth`).
- `disc`: coin with a beveled edge (`thickness`, `bevel`).

Effects (one pass each, same prelude; `sdBayer` for jitter):
- `halftone`: dot screen (`size`, `angle`).
- `outline`: luma-edge detect, draws a tinted edge, body darkened (`width`, `strength`).
- `grain`: animated film grain (`amount`, `size`).
- `vignette`: radial darkening of the scene (`radius`, `softness`).
- `chroma`: hue rotation over time (`speed`, `range`).
- `ripple`: sinusoidal uv distortion radiating from the center (`amplitude`, `frequency`, `speed`).

Interactions (scene rules, per-object state in WeakMaps, eased, reduced-motion aware):
- `repel`: objects within `radius` px of the pointer are pushed away, spring back (`radius`, `strength`).
- `magnet`: objects drift toward the pointer, capped at `reach` px from rest (`reach`, `strength`).
- `collide`: siblings keep at least the sum of their half-sizes plus `gap` px apart; pairwise, eased, no velocity (`gap`).
- `scroll`: the scene's progress through the viewport (0 at bottom edge, 1 at top) drives an additive y rotation of `turns` turns (`turns`), and under reduced motion still works because it is user-driven.

Site: every new entry gets its page automatically. The Scene page's default set includes a knot and a prism.

## Calls (Claude), overridable

- Streams run as three agents in three git worktrees off `main`, merged in the order B, C, A
  (B changes `gl.ts`/`math.ts`/`object.ts`/`scene.ts`; C adds folders and registrations; A changes
  `site/src` and `gen-site.mjs`). Conflicts are expected only in `src/index.ts` (C) vs none, and
  `site/src/intro.md` (A, B both add a section); resolved at merge.
- Each stream extends `scripts/check.mjs` with its own cases and leaves the suite green.
- Hero positions are hand-tuned by screenshot, not computed.

## Left to the builder

- Exact SDFs, parameter ranges, effect kernels, spring constants.
- Hero composition and dock styling details, within the v1 register.
