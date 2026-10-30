# solids v8: taps, text, and a hero that invites play

Date: 2026-10-30. Builds on v7. Source: a judged design round (three independent designs, three judges); this
spec is the merge the judges recommended, with the owner's note on light and dark backgrounds folded in.

## Intent

Max: the hero configuration module feels cluttered and complex, and wants a more attractive setup; add
interactions driven by tap and click (explosions, shockwaves, attraction); add text, including grabbing an
HTML element and giving it 3D properties, with "Solids" over the hero in 3D, centered, in a monospace or
pixel font; and handle light and dark backgrounds cleanly for the font.

## Decisions

- **Taps ride on the pointer.** No new registry kind. `Pointer` gains `down` and `tap`; a tap is a press
  and release that moved under 8 px within 400 ms (a scroll flick cancels, a drag is not a tap). `tap` is
  a fresh object per press and is never cleared; a rule keeps the last tap it saw and compares by identity,
  then counts the tap's age with `dt` itself (frame-rate independent, deterministic under `scene.frame`,
  alive under reduced motion). `scene.tap(x, y)` is public so pages and checks fire taps without events.
  A nested scene's tap does not reach the outer one. `onPointer` mutates the pointer object.
- **Core budget measures the engine.** The core build stubs `src/interactions` like objects and effects
  (an interaction is registry content); core is then about 14.3 KB of 18 and the lone-object smoke page
  still renders. Text and the three rules live in the full bundle only.
- **Three tap rules**, registered before `collide`, each with `input: 'tap'` on its meta so the site can
  group them: `shockwave` (a ring travels out from the tap; shapes it crosses are shoved outward, flash
  and spring back; stateless over the tap's age), `poke` (the shape under the tap turns once around its
  vertical axis and pops; tapping the word shows its extrusion), `pull` (while the finger or button is
  held, every shape gathers toward the press on the shared spring, capped by `reach`; release lets go).
  Pinned shapes (a gravity center or orbiter) take a third of a shove or pull. Under reduced motion the
  rules still answer the person's own tap, without the flash and scale pop.
- **Non-square quads and a field texture in the core**, both general: `draw()` sizes the quad from the
  rect's width and height (`uScale = min(sw, sh) / min(w, h)`, square objects byte-identical), a
  `uBound` uniform replaces the 1.6 constant in the cull and the far limit becomes `3.0 + uBound`
  (4.6 for squares); an object may set `field = { data, width, height, range, version }` (R8, 0.5 is
  the edge, signed distance in texels up to `range`) and the core uploads it once per version and binds
  it on unit 1 with `uField`, `uFieldSize`, `uFieldRange`, ignored by programs that lack them.
  `hover-lift` tests the rect's half extents; `drawRadius()` stays half the width.
- **`<sd-text>`** in `src/text/` (not an objects folder, not in the objects registry, so the universe and
  catalogue stay shapes), stubbed out of the core, registered by a side-effect import. The light DOM is
  the text: `<sd-text>Solids</sd-text>` or `<sd-text><h1>Solids</h1></sd-text>`. The host is
  `display: inline-block`, keeps the wrapped element's layout box and accessibility node, and makes its
  text transparent while the 3D twin paints over it; without WebGL (`data-fallback`) the text shows as
  is. The font is the computed CSS font of the wrapped element (longhands, Firefox returns an empty
  shorthand); `pixel` (0 to 24 px, default 0) rasterizes at that cell size for the pixel-font look from any
  monospace. Uniforms: `depth` (0.02 to 1, default 0.35, half thickness in unit space times 0.3) and
  `bevel` (0 to 1, default 0.25). `size` is a no-op on text; `font-size` rules. One line of text.
  Rebuild (rAF-coalesced) on text change, font ready, `pixel` change and box resize; the raster is
  independent of the CSS size except in pixel mode. Shader: an extruded 2D distance field with a rounded
  edge, a true lower bound, through `sdRender`, so every shade, effect, animation and interaction applies.
- **Light and dark.** The text draws through the shade system like every object: glass in dark, the
  light default in light. The hero wordmark uses the accent color; a check pins legibility on both
  themes: painted text pixels have mean luminance below 0.75 in light and above 0.2 in dark, and the
  light-theme word differs from the page background by more than 0.25 in luminance at its edge pixels.
  No effect is required for the word to read.
- **Hero.** The wordmark `<sd-text id="mark" pixel="6" depth="0.5" gravity="none" animation="float"
  speed="0.6"><h1>Solids</h1></sd-text>` is the last child of the hero scene, centered, in a bold
  monospace at `clamp(56px, 18vmin, 180px)`; the old title becomes the lede top-left ("Lightweight 3D
  objects for the web. One script tag, no dependencies, about N KB. Tap the scene, pick a mood, copy the
  code."). The orb stays the gravity center behind the word. Default interactions
  `gravity pointer-follow hover-lift shockwave poke`.
- **Dock.** One glass pill: five mood pills (`Orbit` default, `Neon`, `Ink`, `Pixel`, `Storm`), a
  `Tweak` disclosure (native `<details>`), and `Copy code`. Tweak opens upward with the grouped
  fieldsets the inner pages use: Scene (Center, Gravity), Rules (every interaction as a chip, tap rules
  first), Look (Shading, Effect), Text (Depth, Pixel on the wordmark), and `Copy prompt`. A preset is a
  record of control values applied through the existing controls (Copy code stays the only serializer);
  any manual change clears the active pill. Phones: the pill row scrolls sideways with the last pill cut
  as the affordance, Tweak is a sheet above the pill capped at 55 vh, nothing is hidden any more.

| Pill | center | effect | shading | gravity | interaction |
|---|---|---|---|---|---|
| Orbit | orb | none | auto | 0.35 | gravity pointer-follow hover-lift shockwave poke |
| Neon | orb | glow | glass | 0.5 | gravity pointer-follow hover-lift shockwave poke |
| Ink | orb | outline | cel | 0.35 | gravity pointer-follow hover-lift poke |
| Pixel | orb | pixelate dither | matte | 0.35 | gravity pointer-follow shockwave |
| Storm | orb | none | metal | 0 | repel shockwave poke pull collide |

## Non-goals

- Multitouch, double tap, long press as inputs; a visible ring effect at the tap (candidate: a `uTap`
  effect uniform); multi-line text; per-letter objects; rasterizing images or boxes inside `<sd-text>`;
  a CSS-transform bridge for non-text HTML.

## Checks (pinned per task in the plan)

Tap detection (press and release taps, a 20 px drag does not, cancel does not, a second press is a new
object, `pointer.down` tracks, `scene.tap()` works, a nested scene gets one tap); each rule moves a shape
within 10 frames and settles under 0.5 px within 4 s of frames, pinned shapes move a third, shockwave
leaves an untouched scene at zero, poke is one full turn (identity within 1e-3) and the pop returns, pull
holds while down and releases on up, all three answer under reduced motion; square objects render byte
for byte as before the quad change under every shade (the Z.march wrapper now restores `t > 7.0` from
`t > 3.0 + uBound` and the cull from `uBound`); a 2:1 box draws its full width; a field uploads once per
version; `<sd-text>Solids</sd-text>` draws more than 2000 px, pixel 8 differs from 0, depth and bevel min
versus max differ, a wrapped h1 keeps its text and transparent color, a lone text renders, a text change
rebuilds, legibility on both themes; the hero markup carries the word and Copy code reproduces it; five
pills, Storm sets the interaction order `repel shockwave poke pull collide` and gravity 0, a manual
change clears the pill, Tweak holds Copy prompt and the four legends, no overflow at 500 px, the h1
bottom stays above the dock.
