# solids v9: a calmer hero, cleaner text, text treated apart

Date: 2026-10-30. Builds on v8. Max's notes after using v8:

- The Tweak panel should blur what is behind it and close on a click outside; the select carets stick to the right edge of their fields.
- The pixel text is low-key; it renders better at 0; smooth curves and anti-aliasing could be cleaner, or a different approach.
- Rework the hero composition: nothing in the middle, shapes floating around, with defocus; the text centered and a bit smaller.
- Scene effects work less well on text than on shapes; treat text differently if possible.

## Decisions

- **Tweak panel.** Rendered as a sibling of the dock (not inside it), so its backdrop blur sees the scene (a backdrop filter inside
  another backdrop-filtered element blurs nothing). Open state stays on the `<details>`; the panel shows through
  `.hero-full:has(.tweak[open])`. A click or tap outside the panel and the Tweak button closes it; Escape closes it.
- **Selects** get a drawn chevron: `appearance: none`, right padding for it, an inline SVG chevron 12 px from the right edge, in every
  dock and panel.
- **Smooth text.** The smooth raster goes from 96 to 160 texels per em and seeds the distance transform from coverage (a texel with
  partial alpha starts at a sub-texel distance), so curves lose their staircase; the quarter-texel bias goes. Pixel mode is unchanged
  and stays available; the hero wordmark uses pixel 0.
- **Text apart from scene effects.** An object whose `effect` list holds the token `none` is exempt from the scene's effect chain: it is
  drawn after the chain onto the canvas, in its own draw order, with its own per-object effects if any. The hero wordmark carries
  `effect="none"`; moods that want the word to glow give it its own effect. Documented in SKILL.md under effects.
- **Hero.** Twelve shapes float around the word (`animation="float"` with varied speed and phase, sizes 56 to 110 px at 6.5 vmin), none
  in the middle; four of the far ones carry `effect="defocus" defocus-radius="4..9"` and `state="off"` so they sit back; the orb keeps
  the gravity center role for the Orbit mood but sits off center (left third). The wordmark is `14vmin` (9 on phones), pixel 0,
  `effect="none"`. Default rules: `pointer-follow hover-lift shockwave poke` (no gravity). Moods: Float (default), Orbit (gravity on,
  orb center, strength 0.35), Neon (glow on the scene, glow on the word too), Ink (outline, cel), Storm. Pixel mood goes.

## Checks

Site: the panel is not a descendant of the dock; a click on the stage closes an open panel (browser probe); the select rule has
`appearance: none` and a background image; hero default interaction has no gravity; at least eight hero children float; at least
three carry defocus; the wordmark has `pixel="0"` or no pixel attribute and `effect="none"`; five pills Float, Orbit, Neon, Ink, Storm.
Core: a scene with `effect="pixelate"` draws an `effect="none"` object byte for byte as without the scene effect while another object
changes; the exempt object still takes its own per-object effect; draw order keeps exempt objects above the chained ones. Text: the
smooth field is 160 texels tall plus padding; a smooth raster of an "O" at 96 px has at least 2 distinct alpha values along a row
through its edge in the field (coverage seeding), and the smooth text still passes the v8 text checks.
