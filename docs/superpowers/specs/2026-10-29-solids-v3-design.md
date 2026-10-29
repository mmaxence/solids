# solids v3 design

Date: 2026-10-29. Status: approved in conversation by Max (four asks: effect intensity, performance metrics, agent-first emphasis, a universe scene). Builds on the v1 and v2 designs next to this file; everything there still holds.

## Goals

1. **Effect intensity.** Every effect can be reduced or accentuated with one parameter.
2. **Performance metrics.** The site shows what the library costs: bundle size, frame time, and a per-object and per-effect benchmark the visitor runs in their own browser.
3. **Agent first.** The site and README lead with the agent workflow: hand your coding agent the contract, describe a shape, get an object that fits the family.
4. **Universe scene.** A scene that fills its frame with a variable number of shapes at different depths, with optional gravity and a customizable depth of field.

## Non-goals

- Changing the object contract (`map()` + manifest + README) or the effect contract beyond the `mix` footer below.
- Physics beyond the existing interactions. Server-side anything. npm publish.

## Constraints

- Budgets unchanged: core ≤ 18 KB, full ≤ 60 KB gzipped. No dependencies. No em dashes.
- Reduced motion, the 16-context cap, and the `dpr` cap apply to the universe and the benchmark.
- `npm run check` green on every stream branch.

## Stream M: effect mix

- Effect fragments define `vec4 sdEffect()` instead of `void main()`. The core appends a footer:
  `void main() { fragColor = mix(texture(uScene, vUv), sdEffect(), uMix); }`. `uMix` 0 turns the
  pass into a copy, 1 is the effect as designed, values above 1 extrapolate (accentuate). Clamp
  the result to premultiplied validity (`rgb ≤ a`, `a ≤ 1`).
- Every effect gets an implicit `mix` param (0 to 2, step 0.05, default 1, label "Mix") injected
  at registration in `src/effects/index.ts`, so `<effect>-mix` attributes, the site controls and
  the options tables all appear without touching manifests.
- All twelve existing effects migrate to `sdEffect()`. `docs/SKILL.md` effect section updated.
- Check: a scene with `glow glow-mix="0"` matches the same scene with no effect (pixel diff < 1 %);
  `glow-mix="2"` differs from `glow-mix="1"` by more than `glow-mix="1"` differs from 0.

## Stream P: performance

- `scripts/build.mjs` writes `dist/sizes.json` (`{ core, full }` gzipped bytes); `gen-site.mjs`
  reads it for the Performance page and the hero pitch ("about N KB").
- Scene exposes `frameTime` (EMA of ms per `frame()`, measured with `performance.now()` around the
  draw) and `fps` (EMA of 1000 / rAF delta). Opt-in GPU timing through `EXT_disjoint_timer_query_webgl2`
  when available, surfaced as `gpuTime` or null.
- New site page `performance.html` (sidebar: Getting started): the sizes table; a live meter for
  the page's own demo scene (CPU ms, GPU ms when available, fps, device pixel ratio, color space);
  a "Run benchmark" button that, for each object at 200 px and then for each effect on an orb,
  renders 60 frames in one offscreen scene and reports median CPU ms per frame and GPU ms when
  available, in a table with a bar per row. Results are the visitor's; the page says so and never
  uploads anything.
- The hero dock gains a small live readout: `fps` and ms, text only, hidden under 900 px.
- Check: `frameTime` is a finite positive number after ten frames; the Performance page mounts
  and the benchmark function runs on one object without console errors (not the full run).

## Stream G: agent first

- Landing, first section after the hero: "Built for agents". Three short steps: give your agent
  `skill.md`, describe the shape, run `npm run check`. One concrete prompt example in a code block
  and a Copy prompt button in the hero dock (the prompt: the scene markup plus the SKILL link and
  one sentence inviting the agent to add an object).
- The site serves `skill.md` (a copy of `docs/SKILL.md`) and `llms.txt` (title, one-paragraph
  summary, links to skill.md, each object and effect page, and the GitHub repo).
- README reframed: the first section after the one-line pitch is "Built for agents", the install
  snippet follows. No change to the contract itself.
- Check: `site/dist/skill.md` equals `docs/SKILL.md`; `llms.txt` lists every object and effect page.

## Stream U: universe

- `<sd-universe>` extends `SdScene`. Attributes: `count` (default 24, 1 to 120), `seed` (default
  1), `gravity` (absent, or present: the largest shape is the center and the nearest third of the
  shapes orbit it, the rest `none`), `depth` (0 to 1, default 0.5: how strong the depth of field
  is), `focus` (-1 to 1, default 0: the focal plane), `shapes` (space-separated tag list, default
  all registered objects), `palette` (space-separated colors, default the site's six P3 picks).
- On connect, and whenever `count`, `seed` or `shapes` change, it regenerates its children: a
  seeded PRNG (mulberry32) picks tag, position (anywhere in the box, with a margin), size (40 to
  140 px, scaled by depth), color, animation (idle, float, or spin at a slow speed), and depth
  `z` in -1..1. Children get `data-z`, `style="position:absolute; left; top"`, `size`, and an
  object-level `defocus` effect whose amount is `depth × |z − focus| × 14` px, plus a dim toward
  the background for far shapes (`state="idle"` vs `active`). Depth also sets draw order (far
  first).
- New effect `defocus` (`radius` 0 to 24 px): a jittered disc blur, premultiplied-safe. It is a
  normal effect, usable anywhere.
- `depth` and `focus` changes update the per-child defocus amounts without regenerating.
- The universe does not repopulate when the box resizes; positions are percentages so they scale.
- Site: `universe.html` (sidebar: Getting started, after Scene and gravity): a tall stage
  (70vh) with controls Count, Seed, Gravity, Depth, Focus, Scene effect, and Copy code. The landing
  gets a second full-width band under "Built for agents" showing a universe at count 36.
- Check: `<sd-universe count="12" seed="3">` produces exactly 12 children, the same tags and
  positions on two instances with the same seed, different with another seed; `depth="0"` gives
  every child defocus 0; `gravity` marks one center; a 120-count universe draws > 1000 px and
  stays under the 16-context cap (one context).

## Calls (Claude), overridable

- Streams M, P and G run in parallel first; U runs after M merges (it needs `sdEffect()` and
  `mix` for `defocus`). Merge order M, P, G, U.
- `mix` above 1 extrapolates rather than stacking passes; it is cheap and reads as "more".
- Benchmark numbers are CPU-side per frame unless the GPU timer extension exists; the page says
  which it is.
- Universe children are real `<sd-*>` elements in the light DOM, so Copy code reproduces a
  universe as plain markup and a user can hand-edit it.

## Left to the builder

- Defocus kernel, benchmark frame counts, meter smoothing, universe size and color distributions.
