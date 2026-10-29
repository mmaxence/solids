# solids v4: a universe with a camera

Date: 2026-10-29. Builds on the v3 design (`2026-10-29-solids-v3-design.md`, stream U).

## Intent

The v3 universe is a flat scatter: shapes sit at CSS percentages with a depth number, every `float`
shape bobs in lockstep, every orbiter turns at one speed in the page plane, and nothing moves the
view. Max's brief: give it a spin, place shapes better, kill the packs (shapes sharing the exact same
motion), add optional collision physics, let the camera spin optionally and rotate with drag, swipe
or cursor position, and make position, scale and translation feel like one balanced 3D space so the
universe "takes its sense".

## Goals

- Every shape has unique motion: its own drift, wobble, spin axis, speed and animation phase.
- Shapes are placed evenly in a 3D ball (no clumps, no empty corners) and projected with a
  perspective camera, so size, blur, dimming and draw order all come from one depth.
- The camera orbits the center: an optional slow spin, drag or swipe with inertia, and a tilt
  toward the cursor. Each is a token on one attribute.
- Optional collision: shapes bounce off each other elastically and keep their drift.
- Gravity in 3D: orbiters circle the center on their own planes, faster when closer.
- The copied markup still reproduces the universe (positions travel as data attributes).
- Reduced motion: nothing moves on its own; drag and cursor tilt still work.

## Non-goals

- A general 3D scene graph or a camera for `<sd-scene>`. The camera lives in the universe.
- Real gravitation (n-body). Orbits are kinematic circles.
- Collision with the box walls as hard bounces; drift turns back softly at the edge.

## The model

World space is a unit ball centered on the box center. Each child is a body with position `p`
(world units), a base size in px (its `size` attribute, the size at depth 0), and per-body random
parameters from the universe seed and the body's index.

**Placement.** Best-candidate sampling: for each body, draw 8 random points in the ball (rejection
from the cube) and keep the one farthest from every body placed so far, with distances reduced by the
two bodies' radii in world units, so big shapes claim more room. The cloud ends up evenly spread.
Sizes are 40 to 140 px, snapped to 8 px, no longer tied to depth: perspective does that.

**Motion.** Unless an orbiter, each body drifts with its own velocity (random direction, 0.02 to
0.06 world units per second), plus a wobble: a sine on each axis with its own frequency (0.05 to
0.15 Hz), phase and amplitude (0.02 to 0.05). When `|p|` would pass 1, the radial component of the
velocity flips inward (a soft bounce at the edge). The `drift` attribute (0 to 1, default 0.5)
scales velocity and wobble; 0 freezes positions. Each body also gets `phase` (a random animation
time offset in seconds) and its own `speed` for whatever animation it was dealt, so idle, float and
spin never line up across shapes.

**Gravity.** With `gravity`, the largest body is the center, pinned at the origin and marked
`gravity="center"`. The third of the remaining bodies closest to the origin orbit it: each on its own
plane (normal = its position crossed with a random vector, so the orbit passes through where it was
placed), at radius `|p|` (at least the two radii plus a gap), angular speed `0.35 / r^1.5` rad/s
(Kepler-like), random direction. Orbiters do not drift. Nothing else changes for the rest.

**Collision.** With `collide`, after moving, every pair closer than the sum of their world radii is
separated along the line between them (positional correction, split by inverse mass, mass = r³) and
their velocities exchange the normal component elastically. Orbiters and the center are immovable in
collisions (infinite mass); drifting bodies bounce off them. Four relaxation passes, O(n²), fine at
120 bodies.

**Camera.** Yaw and pitch around the origin at distance `D = 1.6 / perspective` (`perspective` 0.05 to 1,
default 0.5, so D = 3.2). Camera space: rotate world by yaw about y, then pitch about x; `z` is toward
the camera. Projection: `s = D / (D - z)`; screen x = `p.x * s * W/2 * 0.92`, screen y = `-p.y * s *
H/2 * 0.92` from the box center. The anisotropic spread fills any box aspect; a wide band shows a
wide cloud. The camera's `camera` attribute lists tokens, default `spin drag pointer`:

- `spin`: yaw advances at one turn per 90 s times the universe `speed` (default 1). While dragging and
  for 2 s after, spin eases out and back in.
- `drag`: pointer down on the universe captures the pointer; moving it adds `dx * 0.006` rad to yaw and
  `dy * 0.006` to pitch (pitch clamped to ±60°). Release keeps the last velocity and decays it with a
  600 ms time constant. `touch-action: pan-y` on the host, so a vertical swipe still scrolls the
  page and a horizontal one rotates.
- `pointer`: with the pointer inside, the view tilts toward it by up to 12° yaw and 8° pitch (eased,
  150 ms), and back when it leaves. Additive to the base yaw and pitch.
- An empty or `none` value: a fixed camera.

**Per frame** (a `step(dt)` hook `SdScene` calls after the objects update and before interactions
run): advance the camera and the bodies, resolve collisions, then for every child: `anim.offset` =
projected screen position, `anim.scale *= s`, `anim.z = z`, the `defocus` radius =
`min(24, depth * |z - focus| * 14)` px written straight into `effectParams` with `defocus` appended
to `effectNames` when the radius is 0.5 px or more, and `anim.state -= 0.75 * depth * max(0, focus
- z)` so shapes behind the focal plane dim. `depth` (0 to 1, default 0.5) and `focus` (-1 to 1,
default 0) keep their meaning, now in camera space.

**Children.** Light-DOM objects, all centered on the box by a `::slotted(*)` rule in the universe's
shadow stylesheet (position absolute, left and top 50%, translate -50% -50%), so they carry no
inline style. Generated children get `data-pos="x y z"` (two decimals), `size`, `color`,
`animation`, `speed`, `phase`, and `gravity="center"` on the center. A pasted universe keeps its
children: bodies come from `data-pos`; a child without one gets a seeded position. Changing `count`,
`seed`, `shapes`, `palette` or `gravity` regenerates; everything else applies live.

**Rendering change in `SdScene.draw`.** The quad is sized from the object's scale, not only its
rect: `q = rect * bleed * anim.scale`, rounded up to 8 device px, with `uScale` set so the shape
stays exactly `rect * anim.scale` px. Near shapes grow without clipping their glow, far shapes cost
fewer fragments, and the per-object buffer pool keys stay few. A quad entirely outside the canvas is
skipped. This applies to every scene (pulse and hover-lift stop clipping at 1.5×); visual output at
scale 1 is unchanged within a pixel.

**Reduced motion.** No spin, drift, wobble, orbit advance or inertia. Drag and cursor tilt respond.

## Attributes (universe)

| Attribute | Default | Range | Effect |
|---|---|---|---|
| count | 24 | 0 to 120 | regenerates |
| seed | 1 | integer | regenerates |
| shapes, palette | all, six P3 | lists | regenerate |
| gravity | absent | present | center + 3D orbiters, regenerates |
| collide | absent | present | elastic collisions, live |
| camera | spin drag pointer | tokens | live |
| speed | 1 | 0 to 4 | spin and orbit rate, live |
| drift | 0.5 | 0 to 1 | drift and wobble amount, live |
| perspective | 0.5 | 0.05 to 1 | camera distance, live |
| depth | 0.5 | 0 to 1 | depth of field strength, live |
| focus | 0 | -1 to 1 | focal plane, live |

Objects gain one core attribute: `phase` (seconds, default 0), an offset on the animation clock.

## Site

- `universe.html`: controls Count, Seed, Gravity, Collide, Spin, Drag, Pointer (three checks on
  `camera`), Speed, Drift, Perspective, Depth, Focus, Scene effect. "How a universe works" rewritten
  for the model above. Options table from the attribute table.
- Landing universe band: `count="36" seed="5" gravity collide` with the default camera, so the band
  shows orbiters and bounces; height 70vh (min 480 px) so the spread is not extreme.
- `docs/SKILL.md` universe section, README line, `llms.txt` description updated.

## Checks (scripts/check.mjs, case U rewritten and extended)

- Same seed, same `data-pos` and sizes on two instances; another seed differs.
- `count="12"` gives 12 children, 12 attached; `count="0"`, unknown shapes and `shapes` filtering
  as before; 120 bodies draw and stay in one context.
- Unique motion: after a second of frames with `camera=""`, no two `float` children share the same
  `anim.offset`; two children with `animation="spin"` have different `anim.rotation`.
- Depth: `depth="0"` gives no defocus; raising depth or moving focus changes radii without replacing
  children; the near child has a larger `anim.scale` than the far one.
- Spin: with `camera="spin"` a child's projected offset changes between frames; with `camera=""`
  and `drift="0"` it does not.
- Drag: synthetic pointerdown, pointermove 80 px, pointerup on a `camera="drag"` universe changes
  yaw; on `camera=""` it does not. Pointer tilt: a pointermove inside a `camera="pointer"`
  universe changes pitch or yaw.
- Collide: two children pasted at `data-pos` 0.05 apart with `collide` end up at least the sum of
  their radii apart after 30 frames; without `collide` they stay.
- Gravity: exactly one `gravity="center"` at offset ~0, orbiters move, their `|p|` stays constant
  over 30 frames (circles, not spirals).
- Reduced motion (`__SD_REDUCED`): with `camera="spin"` and drift, offsets are identical across
  frames.
- Pasted markup `<sd-orb data-pos="0 0 0.8" size="60px">` is kept, attached, and scaled above 1.
- Quad sizing: an object with `effect="glow"` at `anim.scale` 2 (via a `pulse`-like test hook or
  direct assignment before a frame) paints pixels beyond 1.5× its rect; the pool holds at most a
  handful of keys for 40 objects of sizes 20 to 59 px (8 px steps) and 0 after removal.
- Site: `universe.html` live markup has `data-pos=` and ≥ 30 children; landing band has `collide`.

## Rulings (Claude), overridable

- Anisotropic screen spread (x by W/2, y by H/2) over a true isotropic frustum: it fills any box,
  and a spinning cloud stretched sideways still reads as a cloud. Cost if wrong: orbits look
  elliptical in very wide bands; fix by capping the stretch.
- `speed` on the universe scales camera spin and orbits, not drift (`drift` owns that). One knob
  for "how fast it turns", one for "how much it floats".
- Default camera `spin drag pointer`: the landing band and every embed feel alive without
  attributes; `camera="drag"` is one word to calm it down.
- Collision pins orbiters and the center: a bounce that knocks an orbiter off its circle would
  spiral it away; immovable is simpler and still reads as physics.
- The quad-sizing change is core, not universe-only: it removes a known clipping limit for every
  scaled object at the cost of a device-pixel rounding that no check can see.

## Builder-check rulings (Claude, settled 2026-10-29)

- **World radius of a body** is fixed, not measured: `r = size / 640` (a 640 px box is the reference,
  so a 140 px shape has radius 0.22). Placement and collision both use it, so the same seed gives the
  same `data-pos` whatever the box; on screen, touching spheres touch exactly only in a 640 px box.
- **Projection adds to `anim.offset`** (the float bob survives) and multiplies `anim.scale`. The 2D
  `gravity` interaction is not used inside a universe and per-object `gravity="orbit|fall|none"` is
  ignored there; only `gravity="center"` marks the center. Scene interactions that read `rect +
  anim.offset` (all the pointer ones) keep working inside a universe.
- **Spin axis:** each body gets a fixed seeded tilt (±35° about x and z) composed into
  `anim.rotation` in `step`, so `spin` turns about a different axis per shape. Seed-derived, not
  in the markup, like velocities.
- **Spread:** horizontally the cloud uses 0.95 of the half width (rim shapes may pass partly out at
  the sides and the spin brings them back); vertically `0.95 × (D − 0.6) / D` of the half height, so a
  rim shape at camera z ≤ 0.6 stays inside. Corners of the box stay
  emptier than the middle; a rotating ball cannot fill a rectangle and this is accepted.
- **Markup reproduces the initial layout plus seed-derived motion.** Live positions are not written
  back. A pasted child marked `gravity="center"` is the center; with `gravity` and no mark, the
  largest is. Orbiters are recomputed as the closest third. v3 markup (`data-z`, inline `left/top`)
  is not migrated: a child without `data-pos` gets a seeded position.
