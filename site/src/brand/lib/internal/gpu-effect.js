import { attachGPU } from "./gpu.js";
import { shaderBase } from "./shader-base.js";
import { shapePreamble, shapeEnd } from "./shape-preamble.js";
const main = `
void main(){
 vec2 aspect=vec2(size.x/size.y,1.), delta=(uv-pointer)*aspect;
 float field=exp(-dot(delta,delta)*6.)*energy;
 for(int i=0;i<8;i++){vec2 d=(uv-traces[i].xy)*aspect;field=max(field,exp(-dot(d,d)*38.)*traces[i].z*.8);}
 float power=clamp(field*intensity,0.,1.6);
 gl_FragColor=OUTPUT;
}`;
export function gpuEffect(name, mode, body) {
  return Object.freeze({
    name,
    body,
    mode,
    kind: "gpu",
    mount(element, options = {}) {
      const signal = options.signal;
      if (signal && signal.kind !== "signal")
        throw new TypeError(
          "signal must be imported from @materia/text/signal",
        );
      const fragmentSource =
        shaderBase +
        shapePreamble +
        body +
        shapeEnd +
        (signal?.shader ?? "") +
        main.replace(
          "OUTPUT",
          signal ? "compose(uv,power)" : "study(uv,power)",
        );
      const renderer = attachGPU(element, { ...options, mode, fragmentSource });
      if (signal)
        renderer.setFinish(
          signal.mode,
          options.signalStrength ?? 0.7,
          options.signalScale ?? 10,
        );
      return renderer;
    },
  });
}
