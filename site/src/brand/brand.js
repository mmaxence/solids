import { createTextEffect } from "./lib/index.js";
import { gpuEffect } from "./lib/internal/gpu-effect.js";

// One travelling crest crosses the word, followed by a quiet readable hold.
const wordWave = gpuEffect(
  "wordWave",
  74,
  `
 if(energy<.001)return vec4(color,original);
 float phase=mod(time,6.5);
 float travel=phase/2.6;
 float center=mix(-.3,1.3,clamp(travel,0.,1.));
 float envelope=1.-smoothstep(2.5,3.,phase);
 float wave=exp(-pow((p.x-center)*7.,2.))*envelope;
 q.y-=sin((p.x-center)*13.)*wave*3.5/size.y;
 q.x+=wave*sin((p.x-center)*8.)*1.5/size.x;
 vec2 split=vec2(2.2*wave/size.x,0.);
 vec3 rgb=vec3(glyph(q+split),glyph(q),glyph(q-split));
 float alpha=max(rgb.r,max(rgb.g,rgb.b));
 return vec4(color*rgb/max(alpha,.001),alpha);
`,
);
const brand = document.querySelector(".brand");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const motion = document.querySelector("#showcase-motion");
let fx,
  visible = false;
const paused = () => motion?.getAttribute("aria-pressed") === "true";
function stop() {
  fx?.destroy();
  fx = undefined;
}
function sync() {
  if (!visible || reduced.matches) {
    stop();
    return;
  }
  if (!fx) {
    fx = createTextEffect(brand.querySelector(".brand-word"), {
      effect: wordWave,
      auto: true,
      frozen: paused(),
    });
  }
  fx.setFrozen(paused());
}
const observer = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  sync();
});
observer.observe(brand);
reduced.addEventListener("change", sync);
motion?.addEventListener("click", () => queueMicrotask(sync));
window.addEventListener("pagehide", stop);
window.addEventListener("pageshow", sync);
