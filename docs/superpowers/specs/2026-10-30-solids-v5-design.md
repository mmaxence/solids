# solids v5: real orbits, a lighter universe, the cost of a shape

Date: 2026-10-30. Builds on v4 (`2026-10-29-solids-v4-design.md`).

## Intent

Max's brief, after using v4: the orbit inside the universe feels weird, it leaves a single object
with no translation. So the universe stops doing orbits and does two things only: it beautifully and
randomly animates n shapes in a container, and it adds a depth of field. Orbits move to where they
read well, the scene's `gravity` interaction, and get layers: every orbiter sits on its own ring at
its own distance, and a farther ring has a larger diameter and a slower round trip, the way real
systems work.

Second brief: on the landing, next to the catalogue, estimate what it costs in tokens for an agent
(Claude or Codex) to build another shape following the contract, so visitors see that extending the
library is easy and cheap.

## Goals

- `<sd-universe>` has no `gravity`: no pinned center, no orbiters, no `gravity="center"` child.
  Collisions treat every body as free. Everything else from v4 stays (camera, drift, collide, depth).
- Scene `gravity` interaction: orbiters are sorted by their rest distance from the center and placed
  on concentric rings. Ring radii are spread evenly between the innermost and outermost rest
  distance (one orbiter keeps its own rest distance). Angular speed follows Kepler's third law
  relative to the outermost ring: `w = 0.3 * strength * (r_out / r)^1.5` rad/s, so the outer ring
  turns at roughly today's pace and inner rings turn faster. All orbiters turn the same way.
- The innermost ring never overlaps the center: its radius is at least the center's half size plus
  the orbiter's half size plus the `fall` gap default (24 px).
- Switching the center, or an orbiter leaving or joining, still eases over 800 ms (the v1 blend).
- `fall` and `none` roles are unchanged.
- Landing: a line under the catalogue, computed at build time from the real files, with the token
  budget of adding a shape and what it costs at list price.

## Non-goals

- Elliptical orbits, orbital inclination in the 2D scene, or n-body gravitation.
- Explicit ring assignment (`gravity-layer` attribute). Layout order decides. Add when a hand-placed
  scene needs two shapes on one ring.
- Migrating v4 universe markup that carries `gravity="center"`: the attribute is ignored in a
  universe (the body is free like the others).

## The cost estimate

Counted at site build time from the files an agent actually reads and writes:

- Reads: `docs/SKILL.md` (the contract), `src/core/prelude.glsl` (the SDF helpers it builds on) and
  one reference object (the three files of `src/objects/knot`, the largest object).
- Writes: the three files of a new object, taken as the mean size of the twelve existing ones.
- Overhead: an agent session re-reads its context every turn and runs `npm run check` at least
  twice. The estimate multiplies the reading budget by 4 turns and adds 2 KB of check output per run,
  stated as the assumption on the page.

Tokens are bytes / 4 (the usual English and code average; the page says "about"). Price at Claude
Opus 5.5 list rates, $4 per million input and $20 per million output, from the claude-api skill
cached 2026-10-06; the page names the model and the date, and says Codex or another agent lands in
the same range because the inputs are the same files. The copy is one sentence plus one figure, no
table, no chart: "Adding a shape costs an agent about N K tokens, around $X at Claude Opus 5.5 list
prices." Rounded to the nearest 1 K tokens and nearest cent.

## Side menu

Today the side nav is one flat list of 42 links under five same-looking headings; on a page deep in
the catalogue it reads as a wall. New structure, native and light:

- Two tiers. "Guide" (Introduction, Accessibility, Scene and gravity, Universe, Performance) always
  expanded, plain links. Then "Catalogue" as a tier label with four collapsible groups, Objects (12),
  Animations (5), Effects (13), Interactions (7), each a `<details>` whose `<summary>` is the group
  name with its count. The group that holds the current page is `open`; the others are closed. On the
  guide pages every group is closed, so the menu is about 12 lines tall instead of 42.
- A group's summary and its items differ visibly: summary in the foreground color at the body size with
  the count muted, items indented under a hairline (a left border on the list), muted until hover or
  current. The current page keeps the glass background and also sets `aria-current`.
- Open and closed state is per page load (no storage); the current group being open is enough.
- Under 900 px the menu keeps the same markup: the guide links wrap as chips, the four groups stay
  as collapsed `<details>` in a row, each opening its items as wrapped chips. No JS needed.

## Site and docs

- Universe page: Gravity control and option row removed; prose, prompt, and description no longer
  mention gravity or orbits; the landing band loses `gravity`.
- Scene page: the Gravity section explains rings and Kepler speed in one sentence; the `gravity`
  option row description says "the others orbit on rings, farther is slower".
- `docs/SKILL.md`, `README.md`, `site/src/intro.md`, llms.txt: universe copy without gravity; scene
  copy mentions rings.

## Checks

- Universe: `gravity` attribute present changes nothing (same signature and same first frame as
  without); no child carries `gravity="center"`; `bodies` have no `orbit` or `pinned`; the energy
  check runs with collide only.
- Gravity interaction: with three orbiters at rest distances 60, 100 and 180 px, their ring radii
  are evenly spaced (60, 120, 180) and the angular speed of the inner one over the outer one is
  within 2% of 3^1.5; the single-orbiter case keeps its rest distance (existing case O at 100 px);
  an orbiter whose rest position is 10 px from the center sits at least half-sizes plus 24 px out.
- Site: every page's side nav has exactly four `<details>` with counts (12, 5, 13, 7); on an object
  page only the Objects group is open; on the Introduction none is; the current link has `aria-current`.
- Site: the catalogue band has the cost sentence with a K-token figure and a dollar figure; the
  index band regex no longer requires `gravity`.

## Builder-check rulings

Settled by the author after a fresh builder read the document; none changes what gets built.

- Ring radii: clamp the innermost ring first (half sizes plus 24 px), then spread evenly from it to
  the outermost rest distance, with the outermost forced to be at least the innermost.
- Rings are recomputed every frame from rest positions, like the v1 radius, so a resize re-spreads
  them. Two orbiters whose rest distances cross on a layout change swap rings without a blend; rare,
  accepted.
- No version bump, changelog or warning: `gravity` on a universe is silently ignored. The package
  stays 0.1.0.
- Token arithmetic: input tokens = 4 × (SKILL.md + prelude.glsl + the three knot files) + 2 × 2 KB of
  check output; output tokens = the mean size of an object's three files, once. Bytes / 4 throughout.
  Prices from the spec verbatim (Claude Opus 5.5, $4 in / $20 out per million, list price as of
  2026-10-06); the page shows the date.
- The cost sentence is a paragraph inside the catalogue band, after the grid.
- Mobile menu: the current page's group is open there too; an open group takes the full row width.
- The universe's gravity-less generation path is untouched, so the existing `sig()` helper in the
  check compares a universe with `gravity` against one without.
