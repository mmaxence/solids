# Performance

What solids costs, in bytes and in milliseconds. The sizes come from the build. Every timing on this page is measured in your browser, on your device, when you open it or press the button. Nothing is uploaded and nothing leaves the page.

## Sizes

Gzipped bytes of the two bundles, written by the build to `dist/sizes.json` and checked against the budgets (18 KB for the core, 60 KB for everything) on every push. The core is the engine alone: scene, object base, animations and interactions. The full bundle is what the script tag loads.

## Live meter

The scene below reports its own numbers while it runs. Frame (CPU) is the time the scene spends in JavaScript issuing one frame. Frame (GPU) is how long the graphics card takes to draw it, read from the GPU timer query (`EXT_disjoint_timer_query_webgl2`) where the browser exposes it, and unavailable elsewhere. Try a scene effect and watch them move.

## Benchmark

Run benchmark draws each object alone at 200 px, then each effect over an orb, 60 frames each in one hidden scene, and reports the median per frame. CPU ms is wall-clock time per frame measured in JavaScript, waiting until the frame is drawn, so it includes the GPU work even where the GPU timer is unavailable. GPU ms comes from the timer query when there is one. The demo scene above pauses during the run, and each benchmark scene frees its graphics context when done. The numbers are yours: they depend on your screen's pixel ratio, your graphics card and what else the machine is doing, and they stay in this tab.
