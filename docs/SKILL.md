---
name: solids-object
description: Add a new 3D object or effect to the solids library (a zero-dependency WebGL2 web-component library). Use when asked to create, tune, or fix an sd-* object, its shader, or an effect.
---

# Adding an object to solids

solids renders every object as a signed distance field (SDF) raymarched in a fragment shader on a quad. You never touch the renderer. You add one folder and the build picks it up: the element, the site page, and the controls all come from the manifest.

## The contract

```
src/objects/<name>/
  manifest.json   name, tag, description, bleed, uniforms, tags
  frag.glsl       uniforms + float map(vec3 p) + void main()
  README.md       one paragraph, a bullet per parameter, one html snippet
```

Then register it in `src/index.ts` (two imports and one `defineObject` call, copy the orb lines) and run:

```sh
npm run build   # bundles src into dist/solids.js
npm run check   # validates the manifest, compiles the shader headlessly, draws it, checks size budgets
npm run site    # regenerates the site pages
```

`check` must print `ok`. It fails on an invalid manifest, a shader that does not compile, a uniform declared in the manifest but missing from the shader, an object that draws nothing, or a bundle over budget (60 KB gzipped for everything).

### manifest.json

```json
{
  "name": "pebble",
  "tag": "sd-pebble",
  "description": "A flattened stone with a soft edge.",
  "bleed": 1.5,
  "uniforms": [
    { "name": "flatness", "type": "float", "default": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Flatness" }
  ],
  "tags": ["organic"]
}
```

- `name` equals the folder name. `tag` is `sd-` plus the name.
- `bleed` is how much larger than the element box the drawing quad is, so halos can spill. 1.5 is right for most shapes.
- `uniforms` become attributes (kebab-case) and site controls. Types: `float` (needs `min` and `max`), `vec3`, `color`. Keep to two or three; the core already provides `color`, `size`, `state`, `speed`, `animation`, `effect`.

### frag.glsl

The core prepends a prelude. You write only the uniforms, `map`, and `main`:

```glsl
uniform float flatness;

float map(vec3 p) {
  p.y /= mix(1.0, 0.45, flatness);
  return (length(p) - 0.6) * mix(1.0, 0.45, flatness);
}

void main() {
  fragColor = sdRender(1.0, 0.4);   // (rim brightness, halo strength)
}
```

Rules for `map`:
- Unit space: the object should fit in a sphere of radius about 0.8 around the origin. The quad spans a little more than that at scale 1.
- Return a true or conservative distance. Scaled or domain-warped SDFs must be divided by their scale factor or the march overshoots.
- `map` is called about 64 times per pixel plus 6 for the normal, so keep it cheap: a few primitives, no loops over many items.
- Use `uTime` for motion that belongs to the object itself (a wobble, a ripple). Turning, bobbing, and scaling are animations and come for free.

What the prelude gives you:

| Name | Meaning |
|---|---|
| `uTime` | seconds since the scene started |
| `uResolution` | quad size in device px |
| `uPointer` | pointer in quad space, -1..1, y up, (0,0) when outside |
| `uRotation` | mat3 from animations and interactions. `sdRay` already applies it |
| `uScale` | object scale, already applied in `sdCoord` and `sdRay` |
| `uState` | 0..1 eased state (off, idle, busy, active) plus animation modulation |
| `uTheme` | 0 dark, 1 light |
| `uColor` | the accent color, 0..1, in the canvas color space (see Color below) |
| `sdCoord()` | aspect-correct quad coordinate |
| `sdRay(ro, rd)` | camera ray for this pixel, rotated by `uRotation` |
| `sdMarch(ro, rd, minD)` | hit distance or -1; `minD` is the closest approach |
| `sdNormal(p)` | normal from `map` |
| `sdGlass(p, n, rd, rim)` | the house shading: tinted body, fresnel rim, one specular, premultiplied alpha |
| `sdRender(rim, glow)` | march, shade, soft edge, halo on miss. Most objects just call this |

Output is premultiplied RGBA. If you write your own `main`, multiply rgb by alpha before writing `fragColor`.

**Color.** The canvas draws in Display P3 where the browser supports it and in sRGB elsewhere. The core parses the `color` attribute (any CSS color) into that space before it reaches `uColor`, so a shader treats `uColor` as plain 0..1 primaries and never converts. README snippets use the site palette, written as `color(display-p3 r g b)`, for example `color(display-p3 0.55 0.85 1)`.

### The look

Every object must read as the same family on the site:
- Glassy: a tinted body, a bright fresnel rim, one specular highlight. Use `sdGlass` or start from it.
- High contrast on near-black and on near-white (`uTheme`). No flat gray bodies, no muddy mid-tones.
- One accent: the object is tinted by `uColor` only. Do not hardcode colors.
- A soft silhouette: edges are anti-aliased by `sdRender` using the closest-approach distance.
- Still by default. An object with no `animation` should look at rest, not frozen mid-motion. If it needs an angle to read as 3D, bake that rest rotation into `map` (see the cube).

### README.md

```
# pebble

One paragraph: what it is and when to use it.

- `flatness` (0 to 1, default 0.5): what it does.

```html
<sd-scene>
  <sd-pebble color="color(display-p3 0.55 0.85 1)" animation="idle"></sd-pebble>
</sd-scene>
```
```

Plain sentences, no em dashes, no marketing. The README is shown on the object's page and inside the Copy prompt text.

## Adding an effect

Same shape under `src/effects/<name>/` with `manifest.json` (`name`, `description`, `params`, all floats with min and max) and `frag.glsl`. Register it in `src/effects/index.ts`. An effect is one fullscreen pass. Define `vec4 sdEffect()` and return the premultiplied color; do not write `main` or `fragColor`, the core does:

```glsl
uniform float amount;
vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  return vec4(c.rgb * amount, c.a);
}
```

It receives `uScene` (the previous pass, premultiplied), `uResolution`, `uTime`, `uTheme`, `sdLuma(rgb)`, and `sdBayer(px)` for jittering sparse kernels. Params become `<effect>-<param>` attributes on a scene or an object.

Every effect also gets a `mix` param (0 to 2, default 1) without declaring it: the core blends your result with the incoming scene, `mix(scene, sdEffect(), mix)`, and clamps to valid premultiplied color (`a` in 0..1, `rgb` at most `a`). 0 is a plain copy, 1 is the effect as designed, 2 pushes it further. Return the look as designed and let `<effect>-mix` dial it. Keep to one pass; sample at most a few dozen taps.

## The universe

`<sd-universe>` is a scene that fills its box with seeded copies of every registered object in a 3D ball behind a perspective camera, so a new object shows up there with no extra work: check that it still reads at 40 px, blurred, and at a third of its size in the distance. Attributes: `count` (0 to 120), `seed`, `gravity` (present: the largest shape is pinned at the center, the closest third orbit it on their own planes), `collide` (elastic bounces), `camera` (tokens `spin`, `drag`, `pointer`; default all three; empty for a fixed view), `speed` (spin and orbit rate), `drift` (0 to 1, how much free shapes float), `perspective` (0.05 to 1, camera distance `1.6 / perspective`), `depth` (0 to 1, depth of field strength), `focus` (-1 back to 1 front, in camera space), `shapes` and `palette` (space separated). The children are plain light-DOM objects centered on the box with a `data-pos="x y z"` in a unit ball, a `size`, `color`, `animation`, `speed` and `phase`; the universe places them every frame through its `step(dt)` hook (projection added to `anim.offset`, perspective multiplied into `anim.scale`, camera depth in `anim.z`) and gives each the `defocus` effect at `depth * |z - focus| * 14` px with far ones dimmed. Changing `count`, `seed`, `shapes`, `palette` or `gravity` regenerates them; everything else applies live. A body's world radius is `size / 640`.

## Checklist before a PR

- `npm run check` prints `ok`.
- The object looks right in `npm run dev` on both themes, still and with `spin`.
- Two or three uniforms, each with a label a person would understand.
- README written, no em dashes.
