# Accessibility

The objects are decorative. They carry no text and are not announced by screen readers. Put real content next to them, not inside them.

## Motion

Reduced preference freezes the shader clock and samples animations at rest time, but visible scenes can still request frames and some easing or person-driven interactions can change output. Preference changes do not universally wake a sleeping scene. This is not the same as paused or a fully static image. For a strict static policy, keep authored HTML/CSS and remove the owned scene, as the [lifecycle example](examples/lifecycle/index.html) does. See the [integration guide](integration.html).

## Keyboard and focus

Objects are not focusable. If an object is the visual for a control, make the control itself a button or a link and keep the object inside it. The site's own controls are plain form elements with visible focus.

## Contrast

Objects render on a transparent canvas over your own background. The default colors are tuned for near-black and near-white backgrounds. On mid-tone backgrounds, pick a shade with a contrasting edge (`cel` with its outline, or `matte` in the light theme) or add the `glow` effect so the silhouette stays legible.

## Performance

A scene pauses when it leaves the viewport and when the tab is hidden. Device pixel ratio is capped at 2, or lower when a scene sets `dpr`, as the home page hero does with `dpr="1.5"`. Each object marches at most 64 steps per pixel. On a low-end phone, prefer fewer and smaller objects over scene-wide effects. Each scene, and each lone object outside a scene, owns one WebGL context, and browser context limits vary. Group related objects into a scene; sixteen is not a safe allocation budget. Software-renderer checks do not establish physical mobile FPS, battery or assistive-technology support.
