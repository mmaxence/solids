# Integrating Living Object

This guide describes the local 0.1.0 alpha contract, formerly Solids. The current catalog contains **12 shapes**, not the planned 210. Shapes, effects, shades, text and universe instances are different concepts; combining them does not add catalog entries. Preserve existing sd-* tags, browser URLs and import paths.

## Choose a delivery

The package remains private. **npm install solids installs an unrelated registry package.** Do not use that command for Living Object, invent a scope, or imply that GitHub ownership proves registry access. Build this checkout with npm ci and npm run build, then npm pack. Install the actual local tarball path into a separate application.

```js
// A browser bundler, after installing the actual local tarball:
import {SdScene, SdObject} from 'solids';
const scene = document.createElement('sd-scene');
const orb = document.createElement('sd-orb');
scene.style.height = '240px';
orb.setAttribute('color', '#9bd1ff');
scene.append(orb);
document.body.append(scene);
// Client unmount cleanup:
scene.remove();
```

The root and solids/dist/solids.js are the same full entry and have declarations. solids/core and solids/dist/core.js are the same core entry: scene/universe and custom registration, without the full shapes/text/effects catalog. Full and core are alternative bundles with independent registries; choose one per browser realm. Registering the full entry after core can retain core custom elements instead of replacing them. Never load both and assume a shared registry.

Native browsers need a real served module URL or an import map, not an unresolved npm name. In a source checkout, serve the repository over HTTP after building:

```html
<script type="module" src="./dist/solids.js"></script>
<sd-scene style="height:240px" aria-hidden="true">
  <sd-orb color="#9bd1ff"></sd-orb>
</sd-scene>
<p>Keep the actual message in ordinary HTML.</p>
```

Existing hosted solids.js/core.js URLs remain valid, but a live bundle can lag a local candidate. Do not treat a local example as deployed evidence. Entries use HTMLElement/customElements and need browser DOM APIs at import time. They are not SSR-safe renderers. In a server-rendered app, dynamically import inside the client mount hook and cancel stale completions before creating nodes after unmount.

## Start with the smallest scene

Run [the lifecycle example](../examples/lifecycle/index.html) from the source checkout or built site. Examples are not shipped in the tarball; this guide is. It starts with a static illustration and semantic text; no library import or canvas is needed until the person opts into 3D. It contains one explicit scene with an orb and ring, dpr=1, no post effects and native controls. Its application-owned static policy removes the scene for reduced motion or a viewport up to 640px. The threshold is an example design choice, not a hardware capability detector.

A standalone sd-orb also works, but creates an internal one-object scene/context. Group related shapes under one explicit sd-scene to share its canvas. Give the scene a nonzero layout size; objects default to 160px square and can use size or --sd-size. Attributes such as animation, color and manifest-specific parameters use setAttribute; do not invent object constructor options. Native styles/control values belong to the application.

## Own connection and cleanup

Connecting a scene creates a WebGL2 context and observers. Children attach to the nearest scene/universe; disconnecting a child detaches it. Removing the scene stops its scheduling and observers and queues context release in a microtask if it remains disconnected. Same-turn moves are different from permanent removal; context release is asynchronous, not proof of immediate physical GPU memory reclamation. A reinserted scene attempts context restoration.

```js
// A connected, visible scene; paused is a presence attribute:
scene.setAttribute('paused', '');  // Even paused="false" means paused.
scene.removeAttribute('paused');  // Resume only when app intent allows it.
// Own your app's listeners, timers, observers and asynchronous imports too.
scene.remove();
```

There is no controller destroy()/dispose()/play() API. Use native disconnection for owned scenes. Example mountExample/disposeExample/snapshotExample helpers are application functions, not library exports. mountExample is idempotent; dispose removes the owned scene and unsubscribes its preference/control listeners. Asynchronous import completions are guarded against unmount. The native project-note field is outside the enhancement and survives repeated teardown.

ResizeObserver measures scene/child boxes and updates the drawing buffer. dpr caps devicePixelRatio (default cap 2); it is not a cross-library DPR option. No universal refresh()/update() controller exists. A paused scene does not continuously redraw changed colors/geometry; resizing a canvas can clear its pixels until it draws again. A fully static presentation should use authored HTML/CSS or an independently cleared asset, rather than assume paused captures a useful rest frame. DPR-only monitor/zoom changes and arbitrary transformed hosts need application validation.

## Motion and visibility are separate

The runtime stops its loop for a hidden document, offscreen scene, paused attribute or disconnection. Hidden/offscreen recovery must not clear explicit user pause. Reduced preference is different: it freezes the shader clock and samples animations at rest time, while state easing/blends and person-driven interactions can still change output. Visible scenes can continue requesting animation frames. The cached preference is sampled during work; a preference change is not a universal wake/redraw event for a sleeping scene.

The example chooses a stricter application policy: remove the enhancement and show static content on compact/reduced preference changes. Its own listeners handle those changes. Opt-in intent is retained across the policy gate; choosing Use static clears it, so changing preferences cannot override that choice. This is not a shared suite scheduler or a new runtime static mode.

## Fallback, controls and accessibility

Without WebGL2, a scene/object exposes data-fallback and keeps its layout box; no replacement 3D renderer is supplied. A script-load failure or disabled JavaScript also needs authored content. The example keeps original HTML/CSS visible until a context exists, and restores it when load/context creation fails. Context loss/restoration has its own runtime lifecycle; context availability alone does not certify every shader rendered successfully. Custom shader errors and later rendering failures need application testing.

Decorative canvases should be hidden from assistive technology; keep headings, values, labels and descriptions in real HTML. Use buttons/selects for meaningful actions, with visible focus and keyboard equivalents. Scene pointer/tap/universe gestures are not keyboard action controls. Do not make every decorative shape focusable. Native controls and scrolling should remain usable on small/touch screens. Software/emulated checks do not certify physical phones or assistive technology.

## Rendering and composition limits

Raymarched shapes are drawn as quads and sorted by depth values; this is not a general mesh renderer or collision-accurate scene graph. More/larger objects, higher DPR and effects increase cost. Scene-wide effects add full-canvas passes; per-object effects and universe depth blur add render targets/passes. Avoid adding many standalone contexts; browser context limits are implementation-dependent, not a safe sixteen-scene budget.

The unchanged current build is about 27.1 KiB gzip full / 15.1 KiB gzip core. These compressed JS sizes exclude page assets, declarations/source maps and rendering/GPU cost. The actual local tarball is larger and includes declarations/maps. Existing headless Chromium/SwiftShader checks cover manifests, shaders, rendering and lifecycle in that environment; they are not physical-device FPS, GPU memory, thermals/battery or Safari/Firefox support claims. Run performance.html on your actual target devices before making such claims.

Pointer coordinates use bounding rectangles, not a general inverse transform for perspective/nested rotation/zoom. A Space parent or another library does not automatically pause children, share textures/contexts or correct pointer projection. Use separate owned hosts, preserve real content, clean up children before parent removal and validate the actual composition. Full pairwise/device qualification remains separate work.

## Validate this candidate

Use Node 22 and local Chrome (CHROME selects its executable). Run npm run check, npm run check:package, npm run check:docs and npm run check:examples after npm run build. The example checker verifies source/built/installed paths, native controls, static/compact/reduced/no-JS/no-WebGL alternatives, pause and repeated cleanup. The site build mirrors this guide and the examples for review; local build success does not publish them.
