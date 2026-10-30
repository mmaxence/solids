# Accessibility

The objects are decorative. They carry no text and are not announced by screen readers. Put real content next to them, not inside them.

## Motion

When the system asks for reduced motion, animations freeze at their rest pose. Interactions that answer a direct pointer movement or scrolling still respond, because the person caused that motion.

## Keyboard and focus

Objects are not focusable. If an object is the visual for a control, make the control itself a button or a link and keep the object inside it. The site's own controls are plain form elements with visible focus.

## Contrast

Objects render on a transparent canvas over your own background. The default colors are tuned for near-black and near-white backgrounds. On mid-tone backgrounds, pick a shade with a darker edge (`cel` with its outline, or `matte`) or add the `glow` effect so the silhouette stays legible.

## Performance

A scene pauses when it leaves the viewport and when the tab is hidden. Device pixel ratio is capped at 2, or lower when a scene sets `dpr`, as the home page hero does with `dpr="1.5"`. Each object marches at most 64 steps per pixel. On a low-end phone, prefer fewer and smaller objects over scene-wide effects. Each scene, and each lone object outside a scene, owns one WebGL context, and browsers keep about sixteen alive per page, so group objects into scenes when a page has many.
