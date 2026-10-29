# Lightweight 3D objects for the web

solids is a small library of glassy 3D objects you drop into HTML. Each object is a web component drawn by a fragment shader, so a page can hold a handful of them for a few kilobytes and no dependencies. Objects can sit still, run an animation, respond to the pointer, and interact with each other inside a scene.

## Install

Add one script tag, then use the tags anywhere in your markup.

```html
<script type="module" src="https://mmaxence.github.io/solids/solids.js"></script>

<sd-scene interaction="gravity" effect="glow">
  <sd-orb gravity="center" animation="breathe" color="#9bd1ff"></sd-orb>
  <sd-ring animation="spin" color="#c9b3ff"></sd-ring>
  <sd-crystal animation="float" color="#ff9bd1"></sd-crystal>
</sd-scene>
```

The whole bundle, with every object and effect, is about 11 KB gzipped. There is no build step and nothing to configure.

## How it fits together

Four layers compose on any object. The object is the shape. An animation moves it on its own. An effect is a post pass over the rendered image. An interaction is a rule at the scene level that reacts to the pointer or to other objects.

## Sizing and placement

An object is an inline block, 160 px square by default. Set `size` or the `--sd-size` custom property to change it, and place objects with normal CSS. A scene owns one canvas that covers its own box, so give the scene a size and the objects can move anywhere inside it.

## Fallback

Without WebGL2 the elements keep their box and draw nothing, and get a `data-fallback` attribute you can style.

## Adding your own object

An object is one folder with a manifest, a fragment shader, and a short README. The contract is written for coding agents in [SKILL.md](https://github.com/mmaxence/solids/blob/main/docs/SKILL.md). Copy it into your agent's context, describe the shape you want, and it can add one that shows up here with the shared controls.
