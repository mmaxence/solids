# solids v7: hardening, speed, simplicity, and a page pass

Date: 2026-10-30. Builds on v6. Sources: three read-only audits run on main at 353f787 (architecture, code
quality and simplicity, performance), each with file-level findings; this spec is the subset worth
doing now, in the order a solo maintainer gets value.

## Intent

Max asked for a design-architecture pass, a code review, a code simplicity and quality pass, a
performance pass, then one more page UI pass since many things were added. Plus one feature: cel's
outline can be removed (shipped on this branch as `cel-outline`, 0 removes it). The light theme stays
as it is.

## Decisions

- **Spaces and rules wait.** The architecture audit confirmed the diagnosis (the universe owns
  physics that interactions should own) but found the payoff today is one shared rule (collide) and
  the cost about 300 lines against 2 KB of core headroom. v7 does the three preparatory fixes instead:
  bodies synced with children, gravity on the interaction contract, scale-aware centers and radii.
- **No structural rewrites this round**: the check page stays one template literal, the three index
  files stay hand-written, one WebGL context per scene stays, shader compiles stay blocking. Each is
  recorded as a candidate for a later round.

## Correctness (all with a failing check first)

- Parameters are finite and clamped at parse time: `num()` rejects non-finite; `param()` clamps to
  the manifest range and deletes the entry on unset, empty or unparseable; object uniforms clamp the
  same way; the draw-time shade clamp goes. Gravity reads `strength` through `interactionValue`;
  `gravity-gap` on an object overrides the scene param.
- A zero-size universe body gets radius `max(size, 1) / 640`.
- Reduced motion evaluates animations at t = 0 (the rest pose), whatever `phase` says.
- GL contexts are released on disconnect (microtask, only if still disconnected) and restored on
  reconnect; a lost context sets `data-fallback`; the frame loop skips a lost context.
- A failing effect shader is remembered per scene and passed through, with one console error.
- Shader time is the scene clock (pauses with the scene), not wall time since creation.
- The IntersectionObserver reads the latest entry. `state` ignores prototype keys.
- Pointer-follow and repel share one frame-rate-independent spring in math.ts.
- Universe bodies live in a WeakMap keyed by child, created on first sight (a child appended later
  gets a body and its projection); the depth-of-field blur is a field on the object (`blur`, px) that
  draw() turns into a defocus pass, so `effectNames` is never rewritten and a child moved elsewhere
  carries no blur. Children are projected from the box center regardless of author CSS. The pointer
  tilt clamps while dragging outside the box.
- Gravity: `setup` clears its body map (toggling gravity off and on eases instead of snapping);
  `o.pinned` (reset each update) marks the center and the orbiters for collide, which stops reading
  the gravity attribute.
- `center(o)` and `radius(o)` on the object (rect center plus offset; half width times scale) replace
  the seven inline copies; hover-lift and collide become scale-aware.
- The draw-order comparator is NaN-safe. A nested scene's objects attach to the nearest scene only.
  Quads cap at MAX_TEXTURE_SIZE. Copy code escapes attribute values. `theme` on a lone object reaches
  its implicit scene.
- Reflection guard: core attributes that would shadow an HTMLElement property or an own field are
  skipped with a warning; a check walks every object's observed attributes.

## Performance (pixel-identical unless stated)

- March far limit 7.0 to 4.6 and a bounding-sphere reject before the march: a check restores 7.0
  through a `shaderSource` wrapper and requires byte-identical renders of every object.
- Scenes start invisible until the IntersectionObserver reports, so offscreen scenes compile nothing
  on load.
- Defocus: 16 taps under 6 px, trig hoisted to one rotation per tap; glow hoists the same way.
  Pinned by the existing blur checks and a screenshot.
- No scene buffers and no final blit when the scene has no effect chain (bit-identical).
- attach() marks the scene dirty; sort and measure once at the next render.
- Collide without per-pair allocations (squared-distance reject); nested program cache map; GL state
  set once in initState; cached media queries for theme and reduced motion.
- frameTime averages from the second frame; the benchmark column reads "ms per frame (GPU included)".

## Simplification and docs

- `npm run check` builds and generates the site first; CI runs it then diffs dist. Chrome profiles
  are removed on exit. Catalogue counts in the check come from the folders. PR builds no longer cancel
  a main deploy.
- Removed: manifest `tags` and `bleed` (constant 1.5), `dist/sizes.json` (gen-site gzips the bundles),
  `vec3` and `color` uniform types, `uPointer`, `AnimResult.uniforms`, dead CSS, duplicate helpers in
  the check, the stale `z` field. `PALETTE` is exported from the universe and used by the site.
- Effect params merge scene under object like shade params. A cross-layer name uniqueness check.
- Docs: SKILL.md (contract rows, run order, the removed fields, 47 degrees, interaction and animation
  sections), CONTRIBUTING.md mentions shades, accessibility.md's rim note, README size from the build.
- Checks: `differ` is NaN when nothing is painted, every shade draws > 1000 px, every object uniform
  changes the image between min and max, `gravity="fall"` runs, leaked scenes are freed, duplicate
  assertions dropped.

## Page pass

- Docks are grouped: object pages in Shape (the object's own parameters), Motion (animation, speed,
  state) and Look (color, shading, effect); scene pages in Scene (center, strength, universe knobs),
  Interactions (as a chip row, like the hero) and Look (effect, shading); the hero keeps its single
  row. Groups are fieldsets with a small legend; a group with one control still gets its legend.
- The live markup scrolls horizontally instead of being cut, and the copy buttons never overlap it.
- The Shades comparison page is in the Guide list and linked from the catalogue's Shades row.
- The fps badge skips unchanged writes and is 20 px as specified.

## Checks (summary; each task's plan lists the exact assertions)

Everything above with a `first` pin is a RED then GREEN case in scripts/check.mjs; the site pass adds
assertions for the fieldset legends, the Shades menu link and the code bar's overflow rule.
