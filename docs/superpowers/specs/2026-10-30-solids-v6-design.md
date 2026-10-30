# solids v6: shades as a layer, fps on every stage

Date: 2026-10-30. Builds on v5 (`2026-10-30-solids-v5-design.md`).

## Intent

Max: the dark theme looks good across effects, but on a white background most objects feel off (flat,
pastel, sticker-like). The cause is one shared function, `sdGlass` in the prelude, that every object
shades through, with a light-theme branch that is nearly flat. Max wants several shades to compare
and refine (cel-shading and matte came up), one of them to become the light default once he has seen
them, and asked whether shades should be another kind of parameter. They should: a fifth layer with
the same contract as effects, so agents can add shades too.

Second: every preview frame on the site shows its frames per second, in a more visible way than the
hero's small grey readout, consistently in the same place and format.

## Goals

- Shades are a registry layer like effects: `src/shades/<name>/{manifest.json, frag.glsl, README.md}`,
  registered in `src/shades/index.ts`, with a `shading` attribute on objects and scenes, parameters
  as `<shade>-<param>` attributes, a site page per shade, a comparison page, a catalogue row, a
  dock select, and a SKILL.md section.
- Five shades ship, each tuned for both themes: `glass` (today's look, unchanged in dark), `matte`,
  `cel`, `clay`, `metal`.
- `shading="auto"` (the default) resolves to `glass` in dark and to the light default in light. The
  light default is a single constant in the core, `matte` until Max picks.
- An fps badge on every stage.

## Non-goals

- Per-object light rigs or shadows between objects. A shade sees one object.
- Changing any object's `map()`. Objects do not know which shade draws them.
- Picking the light default. Max decides after seeing the comparison page.

## The shade contract

A shade is GLSL appended between the prelude and the object's fragment, so the two compile into one
program per (object, shade) pair, cached by the program cache. It defines two functions:

```glsl
uniform float light;   // params are floats declared as uniforms, like effects
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim);   // premultiplied color of a surface hit
vec3 sdEdge();                                       // tint of the soft edge and halo on a miss
```

The prelude declares both, calls `sdShade` from `sdRender` and uses `sdEdge()` for the miss branch.
`sdGlass` leaves the prelude and becomes the `glass` shade; no object called it directly. The prelude
gains `vec3 sdLightDir(float azimuthDeg)`: a key light at that azimuth around the view (0 from the
right, 90 from the top) and 45 degrees of elevation, used by the new shades; `glass` keeps its
hardcoded light vector so dark renders stay pixel-identical.

Resolution at draw time, in this order: the object's `shading` attribute, else its scene's, else
`auto`. `auto` is `glass` when `uTheme` is 0 and the light default when 1. An unknown name falls back
to `auto` (and is reported once in the console like a bad effect name). Parameters merge scene under
object: `{...scene.shadeParams[name], ...object.shadeParams[name]}`, defaults from the manifest.

The five shades, both themes:
- `glass`: the current `sdGlass`, including its light branch. Params: none.
- `matte`: half-lambert diffuse with a firm terminator, sky ambient, one broad soft highlight,
  opaque. Dark: lifted floor and a faint rim so the silhouette stays off black. Light: the edge
  darkens 30% for definition on white. Params: `light` (0 to 360, default 120), `softness`
  (0 to 1, default 0.5, wraps the terminator).
- `cel`: quantized diffuse bands, a hard highlight dot, an ink rim at grazing angles and an ink edge
  on the miss branch. Dark: the ink is a lighter tint of the color; light: 32% of the color. Params:
  `light`, `bands` (2 to 5, default 3), `ink` (0 to 1, default 0.8).
- `clay`: matte with the color desaturated toward a warm putty, a warm subsurface term at the back
  and at thin edges, and a two-sample occlusion along the normal (`map(p + n * d)`) that darkens
  creases. Params: `light`, `warmth` (0 to 1, default 0.5).
- `metal`: a reflection vector into a studio environment (a vertical gradient with a horizon stripe,
  tinted by the color), a tight highlight, fresnel brightening. Dark environment in dark, pale in
  light. Params: `light`, `roughness` (0 to 1, default 0.25, widens the highlight and fades the
  stripe).

Core build: shades are not stubbed out of `dist/core.js` (objects need one to compile); the five
GLSL strings cost about 1 KB gzipped against the 18 KB core budget.

## Attributes

| Attribute | On | Values | Notes |
|---|---|---|---|
| `shading` | object, scene | `auto`, `glass`, `matte`, `cel`, `clay`, `metal` | object wins over scene; default `auto` |
| `<shade>-<param>` | object, scene | float | e.g. `cel-bands="4"`, `matte-light="300"` |

## Site

- Shade pages at `shades/<name>.html`: the effect-page layout (an orb at 220 px, an Object select,
  the shade's params as ranges, a Shading select on the scene). Prompt text as for effects.
- Comparison page `shades.html` ("Shades"): one row per shade, each row one `<sd-scene>` with the
  twelve objects at 96 px (five contexts), the page's Theme toggle switches all rows. Lede says which
  shade is the light default today.
- Catalogue band: a Shades chip row between Effects and Interactions. "Four layers" becomes "Five
  layers" on the landing, in README and intro.md; the layers band gets a Shades card with a cel orb.
- Every dock (object, effect, interaction, scene, universe, hero) gets a Shading select on the
  object (object pages) or the scene (scene pages), listing `auto` plus the five.
- Side menu: a Shades group (5) in the Catalogue tier. llms.txt lists the shade pages and
  `shades.html`.
- SKILL.md: an "Adding a shade" section mirroring "Adding an effect", with the two-function
  contract and the `sdLightDir` helper; "The look" section says the family look is the shade's job
  and objects stay shade-agnostic.

## The fps badge

One component in every stage, including the landing bands and the hero: a pill in the top-right
corner of the stage, `60 fps` in tabular figures at 20 px with `0.13 ms` beside it at 12 px, muted
glass background, pointer-events none. Fed by the stage's own scene at 4 Hz. Color: foreground at
50 fps and above, amber below 50, red below 30. The hero's `.readout` goes away. Stages are the
`.stage` divs and the landing's `.row` and `.band-universe` scenes (the generator wraps those in a
`.stage`-like container so the badge has a corner). Under reduced motion the badge still updates;
when the scene is paused or offscreen it shows the last value.

## Checks

- Manifests: `src/shades/*` validated like effects (name equals folder, description, float params
  with min, max, label, declared as uniforms); `manifests ok` prints the shade count.
- Shaders: every object compiles with every shade (12 × 5 programs), reported as `shaders ok (60)`.
- Pixels: `shading="matte"` and `shading="glass"` on the same orb differ; `cel-bands="2"` differs
  from `cel-bands="5"`; a scene `shading="cel"` is inherited by a child and an object
  `shading="metal"` overrides it; `shading="auto"` under `theme="light"` matches the light default
  shade and differs from `glass`; an unknown shade name draws (falls back) and logs once.
- Core bundle still under budget; `dist/core.js` renders an orb (the smoke page already does).
- Site: five shade pages, `shades.html` with five scenes and 60 objects, the catalogue band has a
  Shades row, every `.stage` has exactly one `.fps` badge, the hero has none of the old `.readout`,
  `index.html` sections read `Five layers`, the side menu has a Shades group with count 5, llms.txt
  lists every shade page, docs/SKILL.md mentions `sdShade` and `sdEdge`.

## Builder-check rulings

Settled by the author after a fresh builder read the document; none changes what gets built.

- Each shade branches on `uTheme` inline (`mix(dark, light, uTheme)`); the prelude does not adjust.
- The fps badge is site-side only (`site.js` reads the existing `fps` and `frameTime`); the core is
  untouched by Task 4.
- Landing rows and the universe band are wrapped in a bare `<div class="band-stage">`
  (position relative, no stage styling); the badge check covers `.stage` and `.band-stage`.
- `glass` keeps its hardcoded light vector; `sdLightDir` serves the four new shades.
- `manifests()` fails if a shade param name equals any object uniform name (today's object
  uniforms share none of light, softness, bands, ink, warmth, roughness).
- Unknown shade names are reported with `console.warn` once per name (a module Set), then draw as
  `auto`. Effects stay silent as today.
- The universe inherits `shading` through `SdScene.observedAttributes`.
- Dock Shading selects are generated from the registry: an empty option (auto) plus every shade.
- The Shades card in the layers band is a child of the existing layers scene (no new context).
- Core headroom is 4 KB (14.0 of 18 KB); the shades fit without raising the cap.
- `crystal` lifts the frost on the rendered alpha, so under opaque shades its frost reads
  differently; accepted, objects stay shade-agnostic.
