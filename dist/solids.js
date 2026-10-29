var Bt=Object.defineProperty;var Nt=(t,i)=>{for(var e in i)Bt(t,e,{get:i[e],enumerable:!0})};var ae=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var M=(t,i,e)=>t+(i-t)*e,E=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),oe=new Float32Array([1,0,0,0,1,0,0,0,1]);function F(t,i,e){let r=Math.cos(t),n=Math.sin(t),s=Math.cos(i),o=Math.sin(i),a=Math.cos(e),f=Math.sin(e);return new Float32Array([s*a,s*f,-o,n*o*a-r*f,n*o*f+r*a,n*s,r*o*a+n*f,r*o*f-n*a,r*s])}function N(t,i){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let n=0;n<3;n++)e[r*3+n]=t[n]*i[r*3]+t[3+n]*i[r*3+1]+t[6+n]*i[r*3+2];return e}var ne=null,z=new Map;function q(t,i="srgb"){if(t=t.trim(),i==="srgb"){let o=t.match(/^#([0-9a-f]{3})$/i);if(o)return[...o[1]].map(a=>parseInt(a+a,16)/255);if(o=t.match(/^#([0-9a-f]{6})$/i),o)return[0,2,4].map(a=>parseInt(o[1].slice(a,a+2),16)/255)}let e=i+t;if(z.has(e))return z.get(e);let r=ne??(ne=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!r)return null;r.fillStyle="#000",r.fillStyle=t;let n=r.fillStyle;r.fillStyle="#fff",r.fillStyle=t;let s=null;if(n===r.fillStyle){r.clearRect(0,0,1,1),r.fillRect(0,0,1,1);let o=r.getImageData(0,0,1,1,{colorSpace:i}).data;s=[o[0]/255,o[1]/255,o[2]/255]}return z.size>256&&z.clear(),z.set(e,s),s}var O=null;function se(){if(O!==null)return O;try{let t=q("#ff0000","display-p3");O=!!t&&t[1]>.05}catch{O=!1}return O}var ie=`#version 300 es
precision highp float;
// Core uniforms, set every frame by <sd-scene>.
uniform float uTime;       // seconds
uniform vec2  uResolution; // quad size in device px
uniform vec2  uPointer;    // quad-local, -1..1, y up
uniform mat3  uRotation;   // object rotation from animations and interactions
uniform float uScale;      // object scale (already divided by bleed)
uniform float uState;      // 0..1 eased state
uniform float uTheme;      // 0 dark, 1 light
uniform vec3  uColor;      // accent, linear-ish 0..1
in vec2 vUv;
out vec4 fragColor;

// An object implements \`float map(vec3 p)\`; everything below is shared.
float map(vec3 p);

// Quad-local coordinate: aspect-correct, scaled so the object fits in |p| < 0.8 at uScale 1.
vec2 sdCoord() {
  return (vUv * 2.0 - 1.0) * uResolution / min(uResolution.x, uResolution.y) / uScale;
}
void sdRay(out vec3 ro, out vec3 rd) {
  vec2 p = sdCoord();
  ro = vec3(p * 0.7, 3.0);
  rd = normalize(vec3(p * 0.1, -1.0));
  mat3 inv = transpose(uRotation);
  ro = inv * ro; rd = inv * rd;
}
vec3 sdNormal(vec3 p) {
  vec2 e = vec2(2e-3, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
// Returns hit distance or -1; minD is the closest approach (for soft edges and halos).
float sdMarch(vec3 ro, vec3 rd, out float minD) {
  float t = 0.0; minD = 1e9;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    minD = min(minD, d);
    if (d < 1e-3) return t;
    if (t > 7.0) break;
    t += d * 0.9;
  }
  return -1.0;
}
// Glassy shading: tinted body, fresnel rim, one specular, premultiplied alpha.
vec4 sdGlass(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = normalize(vec3(-0.55, 0.85, 0.9));
  float diff = max(dot(n, l), 0.0);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 60.0);
  float back = max(dot(n, normalize(vec3(0.6, -0.5, -0.4))), 0.0);
  vec3 body = uColor * (0.26 + 0.6 * diff + 0.22 * back) * (0.8 + 0.4 * uState);
  vec3 col = body + uColor * fres * rim * 1.1 + vec3(1.0) * (spec * 0.9 + fres * 0.22);
  // Light theme: pale tinted glass with a darker rim instead of a dark body.
  vec3 light = uColor * (0.5 + 0.3 * diff) + vec3(0.3) * (1.0 - 0.6 * fres) + vec3(1.0) * spec * 0.5 - uColor * fres * 0.35;
  col = mix(col, light, uTheme);
  float a = clamp(0.72 + 0.28 * fres + 0.3 * spec, 0.0, 1.0);
  return vec4(col * a, a);
}
// Default renderer: march, shade, soft edge, optional halo on miss.
vec4 sdRender(float rim, float glow) {
  vec3 ro, rd; sdRay(ro, rd);
  float minD; float t = sdMarch(ro, rd, minD);
  float px = 2.5 / min(uResolution.x, uResolution.y) / uScale;
  if (t < 0.0) {
    float edge = 1.0 - smoothstep(0.0, px * 2.0, minD);
    float halo = glow * exp(-minD * 7.0) * 0.35 * (0.6 + 0.4 * uState);
    vec3 c = uColor * (edge * 0.9 + halo);
    float a = clamp(edge * 0.9 + halo, 0.0, 1.0);
    return vec4(c, a);
  }
  vec3 p = ro + rd * t;
  return sdGlass(p, sdNormal(p), rd, rim);
}
`;var le=`#version 300 es
precision highp float;
// Effect pass: reads the previous pass, writes premultiplied color.
uniform sampler2D uScene;
uniform vec2  uResolution; // pass size in device px
uniform float uTime;
uniform float uTheme;
in vec2 vUv;
out vec4 fragColor;
float sdLuma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// 4x4 ordered pattern, 0..1, from a pixel position. Use it to jitter sparse kernels.
float sdBayer(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int x = i.x, y = i.y;
  int v = ((x ^ y) & 1) * 8 + ((y & 1) * 4) + (((x >> 1) ^ (y >> 1)) & 1) * 2 + ((y >> 1) & 1);
  return float(v) / 16.0;
}
// The effect defines sdEffect(); main blends it with the scene by uMix (0 copy, 1 as designed, 2 accentuated),
// then clamps to valid premultiplied color. Calling a prototyped function defined later is plain GLSL.
uniform float uMix;
vec4 sdEffect();
void main() {
  vec4 r = sdEffect();
  vec4 s = texture(uScene, vUv);
  vec4 o = mix(s, r, uMix);
  o.a = clamp(o.a, 0.0, 1.0);
  // Keep premultiplied validity without flattening glass highlights: rgb may exceed alpha where an input already did.
  o.rgb = min(o.rgb, max(vec3(o.a), max(s.rgb, r.rgb)));
  fragColor = o;
}
`;var Q=new WeakMap;function fe(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?($(i),{gl:i,colorSpace:i.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function $(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=se()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function ce(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function G(t,i,e="object"){let r=Q.get(t);r||Q.set(t,r=new Map);let n=e[0]+i,s=r.get(n);if(s)return s;let o=(e==="object"?ie:le)+`
`+i,a=t.createProgram();if(t.attachShader(a,ce(t,t.VERTEX_SHADER,ae)),t.attachShader(a,ce(t,t.FRAGMENT_SHADER,o)),t.linkProgram(a),!t.getProgramParameter(a,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(a)||"link failed");let f=new Map,u=t.getProgramParameter(a,t.ACTIVE_UNIFORMS);for(let c=0;c<u;c++){let m=t.getActiveUniform(a,c);f.set(m.name,t.getUniformLocation(a,m.name))}let l={prog:a,loc:f};return r.set(n,l),l}function me(t){Q.delete(t)}function W(t,i,e){for(let[r,n]of Object.entries(e)){let s=i.loc.get(r);s!==void 0&&(typeof n=="number"?t.uniform1f(s,n):n.length===1?t.uniform1i(s,n[0]):n.length===2?t.uniform2f(s,n[0],n[1]):n.length===3?t.uniform3f(s,n[0],n[1],n[2]):n.length===4?t.uniform4f(s,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(s,!1,n))}}function V(t){t.drawArrays(t.TRIANGLES,0,3)}function P(t,i,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let n=t.createFramebuffer(),s={fb:n,tex:r,w:0,h:0};return L(t,s,i,e),t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),s}function L(t,i,e,r){e=Math.max(1,e),r=Math.max(1,r),!(i.w===e&&i.h===r)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=r)}function Y(t,i){t.deleteFramebuffer(i.fb),t.deleteTexture(i.tex)}var be={};Nt(be,{animations:()=>D,effectAttrs:()=>I,effectParam:()=>_,effects:()=>S,interactionAttrs:()=>Z,interactionParam:()=>J,interactionValue:()=>y,interactions:()=>R,kebab:()=>j,num:()=>x,objects:()=>U});var U=new Map,D=new Map,S=new Map,R=new Map,pe=()=>[...S.values()].map(t=>t.manifest),ue=()=>[...R.values()].map(t=>t.meta),de=t=>t.flatMap(i=>i.params.map(e=>`${i.name}-${j(e.name)}`)),I=()=>de(pe()),Z=()=>de(ue()),j=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function he(t,i,e,r){var n;for(let s of t){let o=s.name+"-";if(!i.startsWith(o))continue;let a=s.params.find(f=>j(f.name)===i.slice(o.length));if(a)return(r[n=s.name]??(r[n]={}))[a.name]=x(e,a.default),!0}return!1}var _=(t,i,e)=>he(pe(),t,i,e),J=(t,i,e)=>he(ue(),t,i,e),y=(t,i,e)=>t.interactionParams[i]?.[e]??R.get(i).meta.params.find(r=>r.name===e).default,x=(t,i)=>{if(t==null||t==="")return i;let e=Number(t);return isNaN(e)?i:e};var Vt={off:0,idle:.25,busy:.6,active:1},Xt=["animation","speed","effect","state","color","size","gravity","gravity-gap"],ge=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),k=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(oe),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.z=0;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=ye(r.default,r.type)??0}static get observedAttributes(){return[...Xt,...this.manifest.uniforms.map(e=>j(e.name)),...I()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let n=document.createElement("sd-scene");this.shadowRoot.append(n),n.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,n){let s=n??"";switch(e){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let a=Number(s);this.speedValue=s===""||isNaN(a)?1:a;return}case"state":this.stateTarget=Vt[s]??.25;return;case"color":this.recolor(s||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=s?`:host{width:${s}}`:"";return;case"gravity":case"gravity-gap":return}if(_(e,n,this.effectParams))return;let o=this.manifest.uniforms.find(a=>j(a.name)===e);if(o){let a=ye(n===null||n===""?o.default:n,o.type);a!==null&&(this.uniforms[o.name]=a)}}recolor(e=this.colorSrc){let r=e?q(e,this.scene?.colorSpace):null;r&&(this.rgb=r,this.colorSrc=e)}update(e){this.stateValue=E(this.stateValue,this.stateTarget,e,150),A()||(this.phase+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let o=D.get(s)?.fn(this.phase,this.speedValue,this);if(o){if(o.rotation)for(let a=0;a<3;a++)r.rotation[a]+=o.rotation[a];o.offset&&(r.offset[0]+=o.offset[0],r.offset[1]+=o.offset[1]),o.scale!==void 0&&(r.scale*=o.scale),o.state!==void 0&&(r.state+=o.state),o.uniforms&&Object.assign(this.uniforms,o.uniforms)}}let n=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),o=this.prevPose;n={rotation:[0,1,2].map(a=>Ht(o.rotation[a],r.rotation[a],s)),offset:[M(o.offset[0],r.offset[0],s),M(o.offset[1],r.offset[1],s)],scale:M(o.scale,r.scale,s),state:M(o.state,r.state,s)}}this.pose=n,this.anim.rotation=F(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=this.z}};function Ht(t,i,e){let r=((i-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function ye(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:q(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var K=null;function A(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(K??(K=matchMedia("(prefers-reduced-motion: reduce)")),K.matches)}function Qt(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,ge(e))||Object.defineProperty(t,ge(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function g(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;U.set(t.name,{manifest:t,frag:i});let e=(r=class extends k{},r.manifest=t,r.frag=i,r);Qt(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var xe=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var T=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e),this.last&&(this.fps=ee(this.fps,1e3/Math.max(e-this.last,1)));let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...I(),...Z()]}connectedCallback(){if(!this.gl){let e=fe(this.canvas);if(this.gl=e?.gl??null,this.colorSpace=e?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{me(this.gl),this.fbos=null,this.query=null,$(this.gl);for(let r of this.objects)r.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof k&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let s=n??"";if(e==="interaction")this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>R.get(o)?.setup?.(this));else if(e==="effect")this.effectNames=s.split(/\s+/).filter(Boolean);else if(e==="theme")this.theme=s||"auto";else if(e==="dpr"){let o=Number(s);this.maxDpr=s&&!isNaN(o)&&o>0?o:2,this.measure()}else e==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):_(e,n,this.effectParams)||J(e,n,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.objects=new Set([...this.objects].sort((r,n)=>r.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.pixelRatio),n=Math.round(e.height*this.pixelRatio);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let s of this.objects){let o=s.getBoundingClientRect();s.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl,s=this.canvas.width,o=this.canvas.height;if(!n||s===0||o===0)return;let a=performance.now(),f=this.gpuOn?this.gpuBegin(n):null;try{this.render(n,s,o,e,r)}finally{f&&n.endQuery(f.TIME_ELAPSED_EXT),this.frameTime=ee(this.frameTime,performance.now()-a)}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let r=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!r)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let n=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(r.GPU_DISJOINT_EXT)&&Number.isFinite(n)&&(this.gpuMs=ee(this.gpuMs??0,n/1e6))}return e.beginQuery(r.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),r}render(e,r,n,s,o){A()||(this.clock=s),s=this.clock;for(let m of this.objects)m.update(o);for(let m of this.interactionNames)R.get(m)?.frame(this,o,this.pointer);let a=this.fbos??(this.fbos={scene:P(e,r,n),a:P(e,r,n),b:P(e,r,n),pool:new Map,used:new Set});L(e,a.scene,r,n),L(e,a.a,r,n),L(e,a.b,r,n);let f=this.themeValue;this.bind(e,a.scene,0,0,r,n,!0);let u=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,p)=>m.anim.z-p.anim.z);for(let m of u)this.draw(e,m,s,f,a);let l=a.scene,c=this.effectNames.filter(m=>S.has(m));for(let m of c){let p=l===a.a?a.b:a.a;this.bind(e,p,0,0,r,n,!0),this.pass(e,m,l,this.effectParams[m],[r,n],s,f),l=p}this.bind(e,null,0,0,r,n,!0),this.blit(e,l);for(let[m,p]of a.pool)a.used.has(m)||(Y(e,p[0]),Y(e,p[1]),a.pool.delete(m));a.used.clear()}bind(e,r,n,s,o,a,f){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(n,s,o,a),e.scissor(n,s,o,a),e.enable(e.SCISSOR_TEST),f&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let n=G(e,xe,"effect");e.useProgram(n.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),W(e,n,{uScene:[0]}),V(e)}pass(e,r,n,s,o,a,f){let u=S.get(r),l;try{l=G(e,u.frag,"effect")}catch(m){console.error(`[solids] effect "${r}" shader failed:
${m.message}`),this.blit(e,n);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.tex);let c={};for(let m of u.manifest.params)c[m.name]=m.default;W(e,l,{uScene:[0],uResolution:o,uTime:a,uTheme:f,uMix:s?.mix??1,...c,...s}),V(e)}draw(e,r,n,s,o){let a=r.rect,f=r.manifest.bleed??1.5,u=a.x+a.width/2+r.anim.offset[0],l=a.y+a.height/2+r.anim.offset[1],c=a.width*f,m=a.height*f,p=Math.round((u-c/2)*this.pixelRatio),d=Math.round((this.height-l-m/2)*this.pixelRatio),h=Math.round(c*this.pixelRatio),b=Math.round(m*this.pixelRatio);if(h<=0||b<=0)return;let C;try{C=G(e,r.frag)}catch(v){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${v.message}`);return}let H=r.effectNames.filter(v=>S.has(v)),w;if(H.length){let v=h+"x"+b;w=o.pool.get(v),w||o.pool.set(v,w=[P(e,h,b),P(e,h,b)]),o.used.add(v),this.bind(e,w[0],0,0,h,b,!0)}else this.bind(e,o.scene,p,d,h,b,!1);e.useProgram(C.prog);let _t=this.pointer.inside?[(this.pointer.x-u)/c*2,-((this.pointer.y-l)/m)*2]:[0,0];if(W(e,C,{uTime:n,uResolution:[h,b],uPointer:_t,uRotation:r.anim.rotation,uScale:r.anim.scale/f,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:s,uColor:r.rgb,...r.uniforms}),V(e),!H.length)return;let B=w[0];for(let v of H){let re=B===w[0]?w[1]:w[0];this.bind(e,re,0,0,h,b,!0),this.pass(e,v,B,r.effectParams[v],[h,b],n,s),B=re}this.bind(e,o.scene,p,d,h,b,!1),this.blit(e,B)}},ee=(t,i)=>t?t+(i-t)*.1:i;var Yt=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],Zt=["idle","float","spin"],ve=["count","seed","gravity","depth","focus","shapes","palette"],te=(t,i,e)=>Math.min(e,Math.max(i,t)),we=()=>new Set([...U.values()].map(t=>t.manifest.tag));function Jt(t){return()=>{t=t+1831565813|0;let i=Math.imul(t^t>>>15,1|t);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296}}var X=class extends T{constructor(){super();this.ready=!1;this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px}"}))}static get observedAttributes(){return[...T.observedAttributes,...ve]}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=we();[...this.children].some(r=>e.has(r.localName))?queueMicrotask(()=>this.applyDepth()):this.generate()}attributeChangedCallback(e,r,n){if(e==="interaction"||e==="gravity")super.attributeChangedCallback("interaction",r,this.getAttribute("interaction")),this.hasAttribute("gravity")&&!this.interactionNames.includes("gravity")&&this.interactionNames.unshift("gravity");else if(!ve.includes(e))return super.attributeChangedCallback(e,r,n);!this.ready||e==="interaction"||(e==="depth"||e==="focus"?this.applyDepth():this.generate())}kids(){return[...this.children].filter(e=>e instanceof k)}generate(){for(let c of this.kids())c.remove();let e=we(),r=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(c=>c.startsWith("sd-")?c:"sd-"+c),n=(r.length?r:[...e]).filter(c=>e.has(c)),s=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??Yt,o=n.length?te(Math.round(x(this.getAttribute("count"),24)),0,120):0,a=Jt(x(this.getAttribute("seed"),1)),f=c=>c[Math.floor(a()*c.length)],u=Array.from({length:o},()=>{let c=a()*2-1;return{tag:f(n),x:6+a()*88,y:6+a()*88,z:c,size:8*Math.round((40+100*(.55*a()+.225*(c+1)))/8),color:f(s),anim:f(Zt),speed:.2+a()*.3,role:""}});if(this.hasAttribute("gravity")&&o){let c=u.reduce((p,d)=>d.size>p.size?d:p),m=u.filter(p=>p!==c).sort((p,d)=>d.z-p.z).slice(0,Math.round((o-1)/3));for(let p of u)p.role=p===c?"center":m.includes(p)?"orbit":"none";c.x=c.y=50,m.length&&(c.z=m.reduce((p,d)=>p+d.z,0)/m.length)}let l=document.createDocumentFragment();for(let c of u.sort((m,p)=>m.z-p.z)){let m=document.createElement(c.tag);m.dataset.z=c.z.toFixed(2),m.setAttribute("size",c.size+"px"),m.setAttribute("color",c.color),m.setAttribute("animation",c.anim),c.anim==="spin"&&m.setAttribute("speed",c.speed.toFixed(1)),c.role&&m.setAttribute("gravity",c.role),m.style.cssText=`position:absolute;left:${c.x.toFixed(1)}%;top:${c.y.toFixed(1)}%;translate:-50% -50%`,l.append(m)}this.append(l),this.applyDepth()}applyDepth(){let e=te(x(this.getAttribute("depth"),.5),0,1),r=te(x(this.getAttribute("focus"),0),-1,1);for(let n of this.kids()){let s=x(n.dataset.z,0),o=Math.min(24,Math.round(e*Math.abs(s-r)*140)/10);n.z=s;let a=(n.getAttribute("effect")??"").split(/\s+/).filter(f=>f&&f!=="defocus");o>=.5?(a.push("defocus"),n.setAttribute("defocus-radius",String(o))):n.removeAttribute("defocus-radius"),a.length?n.setAttribute("effect",a.join(" ")):n.removeAttribute("effect"),n.setAttribute("state",e>0&&s<r?"idle":"active")}}};var Me=Math.PI/180,Se={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*Me,Math.sin(t*2*Math.PI/6)*8*Me,0]})};var Re={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var ke={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Ee={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var Ae={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Kt=[Se,Re,ke,Ee,Ae];for(let t of Kt)D.set(t.meta.name,t);var Te={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var Ce=`uniform float threshold;
uniform float radius;
uniform float strength;

vec4 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return c * smoothstep(threshold, threshold + 0.3, sdLuma(c.rgb));
}

vec4 sdEffect() {
  vec4 base = texture(uScene, vUv);
  vec2 px = radius / uResolution;
  // Four rings of 8 taps, each ring rotated by a per-pixel jitter so the rings never show.
  float j = sdBayer(gl_FragCoord.xy) * 0.7853982;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int r = 1; r <= 4; r++) {
    float fr = float(r) / 4.0;
    float w = 1.0 - fr * 0.75;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + j + float(r) * 0.3;
      acc += bright(vUv + vec2(cos(a), sin(a)) * px * fr) * w;
      wsum += w;
    }
  }
  return base + acc / wsum * strength * 1.6;
}
`;var Fe={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Pe=`uniform float angle;
uniform float reach;
uniform float strength;

vec4 sdEffect() {
  vec4 base = texture(uScene, vUv);
  float a = radians(angle);
  vec2 dir = vec2(cos(a), sin(a)) * reach / uResolution;
  // Jitter the start of the walk per pixel so thin edges smear instead of echoing.
  float j = (sdBayer(gl_FragCoord.xy) - 0.5) / 16.0;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -16; i <= 16; i++) {
    float f = float(i) / 16.0 + j;
    float w = max(1.0 - abs(f), 0.0);
    w *= w;
    vec4 c = texture(uScene, vUv + dir * f);
    acc += c * smoothstep(0.25, 0.7, sdLuma(c.rgb)) * w;
    wsum += w;
  }
  return base + acc / wsum * strength;
}
`;var je={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ze=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Oe={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Le=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var Ue={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var De=`uniform float levels;
uniform float scale;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  if (c.a < 0.004) return vec4(0.0);
  vec3 straight = c.rgb / c.a;
  float t = sdBayer(gl_FragCoord.xy / scale) - 0.5;
  float n = levels - 1.0;
  vec3 q = floor(straight * n + t + 0.5) / n;
  return vec4(clamp(q, 0.0, 1.0) * c.a, c.a);
}
`;var Ie={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var _e=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var Be={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var Ne=`uniform float size;
uniform float angle;

vec4 sdEffect() {
  float a = radians(angle);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 g = r * gl_FragCoord.xy / size;               // position in the rotated dot grid
  vec2 cell = floor(g) + 0.5;
  vec4 c = texture(uScene, transpose(r) * cell * size / uResolution);
  // Dot area follows brightness on dark pages and opacity on light ones, where pale glass is the ink.
  float v = mix(max(c.r, max(c.g, c.b)), c.a, uTheme);
  v = max(v - 0.06, 0.0) / 0.94;                     // the faint halo prints no dots
  float cov = clamp((sqrt(v) * 0.62 - length(g - cell)) * size + 0.5, 0.0, 1.0) * step(1e-4, v);
  return vec4(c.rgb / max(c.a, 1e-3), 1.0) * cov * step(0.004, c.a);
}
`;var qe={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var Ge=`uniform float width;
uniform float strength;

vec4 at(float x, float y) { return texture(uScene, vUv + vec2(x, y) * width / uResolution); }
float k(vec4 s) { return sdLuma(s.rgb) * 0.5 + s.a * 0.5; }

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  vec4 l = at(-1.0, 0.0), r = at(1.0, 0.0), b = at(0.0, -1.0), t = at(0.0, 1.0);
  float tl = k(at(-1.0, 1.0)), tr = k(at(1.0, 1.0)), bl = k(at(-1.0, -1.0)), br = k(at(1.0, -1.0));
  // Sobel on luma plus opacity, so silhouettes and inner edges both draw.
  float gx = tr + 2.0 * k(r) + br - tl - 2.0 * k(l) - bl;
  float gy = tl + 2.0 * k(t) + tr - bl - 2.0 * k(b) - br;
  // Thresholded so the faint falloff of a halo draws no line.
  float e = smoothstep(0.06, 0.5, length(vec2(gx, gy))) * strength;
  // Line color: the neighborhood's own hue at full brightness, deeper on light pages.
  vec4 m = max(max(l, r), max(b, t));
  vec3 tint = m.rgb / max(max(m.r, max(m.g, m.b)), 1e-3);
  tint *= mix(1.0, 0.6, uTheme);
  // Premultiplied scaling: the body darkens on dark pages and pales on light ones.
  return vec4(tint, 1.0) * e + c * (1.0 - 0.7 * strength) * (1.0 - e);
}
`;var We={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var Ve=`uniform float amount;
uniform float size;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // A new pattern 24 times a second, cycling so the hash input stays small. Frozen with the clock under reduced motion.
  float f = floor(mod(uTime * 24.0, 64.0));
  float n = hash(floor(gl_FragCoord.xy / size) + f * vec2(37.0, 17.0)) - 0.5;
  return vec4(clamp(c.rgb + n * amount * c.a, 0.0, c.a), c.a);
}
`;var Xe={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var He=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var Qe={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var $e=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var Ye={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var Ze=`uniform float amplitude;
uniform float frequency;
uniform float speed;

vec4 sdEffect() {
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float r = length(p);
  // Push along the radius; fade to nothing at the very center where the direction is undefined.
  float w = sin((r * frequency - uTime * speed) * 6.2831853) * smoothstep(0.0, 0.06, r);
  vec2 dir = p / max(r, 1e-4);
  return texture(uScene, vUv + dir * w * amplitude / uResolution);
}
`;var Je={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var Ke=`uniform float radius;

// 32 taps on a golden-angle disc (uniform area). Two decorrelated Bayer values per pixel rotate the
// spiral and stratify its radii, so the sparse kernel reads as fine grain instead of rings or copies.
// 16 taps showed grain from about 8 px up. Averaging premultiplied color keeps it valid.
vec4 sdEffect() {
  if (radius < 0.5) return texture(uScene, vUv);
  vec2 px = radius / uResolution;
  float j = sdBayer(gl_FragCoord.xy) * 6.2831853;
  float k = sdBayer(gl_FragCoord.yx + vec2(1.0, 2.0));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float a = float(i) * 2.3999632 + j;
    acc += texture(uScene, vUv + vec2(cos(a), sin(a)) * sqrt((float(i) + k) / 32.0) * px);
  }
  return acc / 32.0;
}
`;var Er=[{manifest:Te,frag:Ce},{manifest:Fe,frag:Pe},{manifest:je,frag:ze},{manifest:Oe,frag:Le},{manifest:Ue,frag:De},{manifest:Ie,frag:_e},{manifest:Be,frag:Ne},{manifest:qe,frag:Ge},{manifest:We,frag:Ve},{manifest:Xe,frag:He},{manifest:Qe,frag:$e},{manifest:Ye,frag:Ze},{manifest:Je,frag:Ke}],Ar={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of Er)t.manifest.params.some(i=>i.name==="mix")||t.manifest.params.push(Ar),S.set(t.manifest.name,t);var et=new WeakMap,tt=20*Math.PI/180,rt={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,i,e){let s=Math.max(1,Math.round(i/16));for(let o of t.objects){if(!o.rect)continue;let a=et.get(o)??et.set(o,{rx:0,ry:0,vx:0,vy:0}).get(o),f=0,u=0;if(e.inside){let l=o.rect.x+o.rect.width/2+o.anim.offset[0],c=o.rect.y+o.rect.height/2+o.anim.offset[1],m=(e.x-l)/Math.max(t.width,1),p=(e.y-c)/Math.max(t.height,1);u=Math.max(-1,Math.min(1,m*2))*tt,f=Math.max(-1,Math.min(1,p*2))*tt}for(let l=0;l<s;l++)a.vx=(a.vx+(f-a.rx)*.08)*.8,a.rx+=a.vx,a.vy=(a.vy+(u-a.ry)*.08)*.8,a.ry+=a.vy;o.anim.rotation=N(F(a.rx,a.ry,0),o.anim.rotation)}}};var at=new WeakMap,nt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,i,e){for(let r of t.objects){if(!r.rect)continue;let n=r.rect.x+r.rect.width/2+r.anim.offset[0],s=r.rect.y+r.rect.height/2+r.anim.offset[1],o=e.inside&&Math.abs(e.x-n)<=r.rect.width/2&&Math.abs(e.y-s)<=r.rect.height/2,a=E(at.get(r)??0,o?1:0,i,160);at.set(r,a),r.anim.scale*=1+.08*a,r.anim.state+=a*(1-r.stateValue)}}};var ot=new WeakMap,st=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],Tr=t=>t*t*(3-2*t),it={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,i){let e=[...t.objects].filter(a=>a.rect),r=e.find(a=>a.getAttribute("gravity")==="center")??null,n=x(t.getAttribute("gravity-strength"),.6),s=r?st(r):null,o=A();for(let a of e){let f=a.getAttribute("gravity"),u=!!s&&a!==r&&f!=="none",l=ot.get(a);if(!l&&!u)continue;l||ot.set(a,l={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let c=[0,0],m=0;if(u){let p=st(a);if(l.center!==r&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=r,l.angle=Math.atan2(p[1]-s[1],p[0]-s[0]),l.r=Math.hypot(p[0]-s[0],p[1]-s[1])),f==="fall"){let d=x(a.getAttribute("gravity-gap"),24)+(r.rect.width+a.rect.width)/4;o||(l.r+=(d-l.r)*(1-Math.exp(-i/700))*(.3+n))}else o||(l.angle+=i/1e3*.25*n),l.r=Math.hypot(p[0]-s[0],p[1]-s[1]),m=Math.sin(l.angle);c=[s[0]+Math.cos(l.angle)*l.r-p[0],s[1]+Math.sin(l.angle)*l.r-p[1]]}else l.center&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=null);if(l.k<1){l.k=Math.min(1,l.k+i/800);let p=Tr(l.k);c=[M(l.from[0],c[0],p),M(l.from[1],c[1],p)]}l.offset=c,a.anim.offset[0]+=c[0],a.anim.offset[1]+=c[1],a.anim.z+=m,a.anim.scale*=1+.06*m}}};var lt=new WeakMap,ct={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,i,e){let r=y(t,"repel","radius"),n=y(t,"repel","strength"),s=Math.max(1,Math.round(i/16));for(let o of t.objects){if(!o.rect)continue;let a=lt.get(o)??lt.set(o,{x:0,y:0,vx:0,vy:0}).get(o),f=0,u=0;if(e.inside){let l=o.rect.x+o.rect.width/2+o.anim.offset[0]-e.x,c=o.rect.y+o.rect.height/2+o.anim.offset[1]-e.y,m=Math.hypot(l,c);if(m<r){let p=(1-m/r)*r*.5*n;f=m>.001?l/m*p:0,u=m>.001?c/m*p:-p}}for(let l=0;l<s;l++)a.vx=(a.vx+(f-a.x)*.08)*.8,a.x+=a.vx,a.vy=(a.vy+(u-a.y)*.08)*.8,a.y+=a.vy;o.anim.offset[0]+=a.x,o.anim.offset[1]+=a.y}}};var ft=new WeakMap,mt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,i,e){let r=y(t,"magnet","reach"),n=y(t,"magnet","strength");for(let s of t.objects){if(!s.rect)continue;let o=ft.get(s)??[0,0],a=0,f=0;if(e.inside){a=(e.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*n,f=(e.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*n;let l=Math.hypot(a,f);l>r&&(a*=r/l,f*=r/l)}let u=[E(o[0],a,i,250),E(o[1],f,i,250)];ft.set(s,u),s.anim.offset[0]+=u[0],s.anim.offset[1]+=u[1]}}};var pt=new WeakMap,ut={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,i){let e=y(t,"collide","gap"),r=[...t.objects].filter(f=>f.rect),n=r.map(f=>[f.rect.x+f.rect.width/2+f.anim.offset[0],f.rect.y+f.rect.height/2+f.anim.offset[1]]),s=n.map(f=>[...f]),o=r.map(f=>f.getAttribute("gravity")==="center"?0:1);for(let f=0;f<4;f++)for(let u=0;u<r.length;u++)for(let l=u+1;l<r.length;l++){let c=s[l][0]-s[u][0],m=s[l][1]-s[u][1],p=Math.hypot(c,m),d=(r[u].rect.width+r[l].rect.width)/2+e,h=o[u]+o[l];if(p>=d||!h)continue;p<.001?(c=1,m=0):(c/=p,m/=p);let b=(d-p)*o[u]/h,C=(d-p)*o[l]/h;s[u][0]-=c*b,s[u][1]-=m*b,s[l][0]+=c*C,s[l][1]+=m*C}let a=A()?1:1-Math.exp(-i/120);r.forEach((f,u)=>{let l=pt.get(f)??[0,0],c=[l[0]+(s[u][0]-n[u][0]-l[0])*a,l[1]+(s[u][1]-n[u][1]-l[1])*a];pt.set(f,c),f.anim.offset[0]+=c[0],f.anim.offset[1]+=c[1]})}};var dt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let i=t.getBoundingClientRect(),e=innerHeight,r=Math.min(1,Math.max(0,(e-i.top)/Math.max(e+i.height,1))),n=F(0,(r-.5)*y(t,"scroll","turns")*2*Math.PI,0);for(let s of t.objects)s.anim.rotation=N(n,s.anim.rotation)}};var Cr=[rt,nt,it,ct,mt,ut,dt];for(let t of Cr)R.set(t.meta.name,t);var ht={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var bt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var gt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var yt=`uniform float thickness;
uniform float tilt;
uniform float rim;

float map(vec3 p) {
  float a = tilt * 1.25;
  float c = cos(a), s = sin(a);
  p.yz = mat2(c, -s, s, c) * p.yz;
  vec2 q = vec2(length(p.xz) - 0.55, p.y);
  return length(q) - thickness;
}

void main() {
  fragColor = sdRender(rim, 0.35);
}
`;var xt={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var vt=`uniform float facets;
uniform float clarity;
uniform float stretch;

float sdOcta(vec3 p, float s) { return (abs(p.x) + abs(p.y) + abs(p.z) - s) * 0.57735; }
float sdBox(vec3 p, float b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

float map(vec3 p) {
  p.y /= stretch;
  float d = sdOcta(p, 0.72);
  // Each facet cut trims the corners a little more.
  float cut = 0.72 * (1.0 - 0.14 * facets);
  d = max(d, sdBox(p, cut));
  return d * min(stretch, 1.0);
}

void main() {
  vec4 c = sdRender(1.3, 0.3);
  // Low clarity reads as frosted: lift the body toward white.
  c.rgb += (1.0 - clarity) * 0.12 * c.a;
  fragColor = c;
}
`;var wt={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var Mt=`uniform float turns;
uniform float thickness;
uniform float radius;

float map(vec3 p) {
  float H = 1.25;
  float pitch = H / turns;
  float a = atan(p.z, p.x);
  float y = p.y - a * pitch / 6.2831853;
  float ym = mod(y + pitch * 0.5, pitch) - pitch * 0.5;
  float d = length(vec2(length(p.xz) - radius, ym)) - thickness;
  // Trim the helix to its height.
  return max(d, abs(p.y) - H * 0.5);
}

void main() {
  fragColor = sdRender(1.1, 0.3);
}
`;var St={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var Rt=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var kt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var Et=`uniform float radius;
uniform float bevel;

float map(vec3 p) {
  // Rest pose: turned so three faces show.
  p.xz = mat2(0.866, -0.5, 0.5, 0.866) * p.xz;
  p.yz = mat2(0.94, -0.342, 0.342, 0.94) * p.yz;
  float b = 0.44 - radius;
  vec3 q = abs(p) - b;
  float d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - radius;
  // Bevel: chamfer the corners with an octahedron.
  float oct = (abs(p.x) + abs(p.y) + abs(p.z) - 0.44 * (3.0 - 1.35 * bevel)) * 0.57735;
  return max(d, oct);
}

void main() {
  fragColor = sdRender(0.9, 0.3);
}
`;var At={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var Tt=`uniform float twist;
uniform float thickness;

// The (2, q) torus knot: around the ring twice while winding q times around its tube. Returns the point, dc the tangent.
vec3 knot(float s, float q, out vec3 dc) {
  float b = s * q * 0.5, cb = cos(b), sb = sin(b), cs = cos(s), ss = sin(s);
  float rho = 0.45 + 0.18 * cb, drho = -0.09 * q * sb;
  dc = vec3(drho * cs - rho * ss, 0.09 * q * cb, drho * ss + rho * cs);
  return vec3(rho * cs, 0.18 * sb, rho * ss);
}

float map(vec3 p) {
  // Rest pose: facing the viewer, tipped back so the crossings read.
  p.yz = mat2(0.342, -0.94, 0.94, 0.342) * p.yz;
  float q = 2.0 * floor(twist * 0.5) + 1.0, a = atan(p.z, p.x), d = 1e9; // odd only: even values would unknot into one loop
  vec3 dc;
  // The tube passes this point's angle twice; from each pass, one Newton step onto the nearest curve point.
  for (int i = 0; i < 2; i++) {
    float s = a + 6.2831853 * float(i);
    for (int n = 0; n < 1; n++) { vec3 e = knot(s, q, dc) - p; s -= dot(e, dc) / dot(dc, dc); }
    d = min(d, length(knot(s, q, dc) - p));
  }
  return (d - thickness) * 0.9;
}

void main() {
  fragColor = sdRender(1.1, 0.3);
}
`;var Ct={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var Ft=`uniform float sides;
uniform float height;

float map(vec3 p) {
  // Rest pose: tipped toward the viewer so the top face shows, turned so an edge leads.
  p.yz = mat2(0.906, -0.423, 0.423, 0.906) * p.yz;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  float n = floor(sides + 0.5);
  float sector = 6.2831853 / n;
  float a = mod(atan(p.x, p.z) + sector * 0.5, sector) - sector * 0.5;
  // Distance to the nearest side plane, then extrude along y with slightly rounded edges.
  vec2 w = vec2(length(p.xz) * cos(a) - 0.52 * cos(sector * 0.5), abs(p.y) - height * 0.5) + 0.025;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.025;
}

void main() {
  fragColor = sdRender(1.0, 0.3);
}
`;var Pt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var jt=`uniform float span;
uniform float radius;

float map(vec3 p) {
  // Rest pose: lying on a diagonal, turned a little so it reads round.
  p.xy = mat2(0.819, 0.574, -0.574, 0.819) * p.xy;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  p.x -= clamp(p.x, -span * 0.5, span * 0.5);
  return length(p) - radius;
}

void main() {
  fragColor = sdRender(1.0, 0.4);
}
`;var zt={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var Ot=`uniform float points;
uniform float depth;

// Star outline (after Inigo Quilez): n points, outer radius r, m sets the spike sharpness (2 is a polygon, n the sharpest).
float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.141593 / n, en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float map(vec3 p) {
  // Rest pose: turned a little so the bevels catch the light.
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  p.yz = mat2(0.985, -0.174, 0.174, 0.985) * p.yz;
  float n = floor(points + 0.5);
  float s = sdStar(p.xy, 0.72, n, 0.4 * n + 0.6);
  vec2 w = vec2(s, abs(p.z) - depth * 0.5);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  // 45 degree bevel around the outline.
  return max(d, (w.x + w.y + depth * 0.4) * 0.7071);
}

void main() {
  fragColor = sdRender(1.1, 0.35);
}
`;var Lt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var Ut=`uniform float turns;
uniform float growth;

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

// Beads on a logarithmic spiral: center radius 0.56 e^(growth t), bead radius 0.48 of that, t from -2 pi turns to 0.
float map(vec3 p) {
  // Rest pose: tipped back so the coil shows depth, shifted so the spiral's bulk sits on the origin.
  p.yz = mat2(0.94, -0.342, 0.342, 0.94) * p.yz;
  p.xy += vec2(0.16, -0.11);
  float g = growth, t0 = -6.2831853 * turns, gap = 0.5;
  float phi = atan(p.y, p.x);
  // Which winding this point is nearest to, from the inverse of the spiral.
  float n0 = floor((phi - log(max(length(p.xy), 1e-3) / 0.56) / g) / 6.2831853 + 0.5);
  float d = 1e9;
  for (int i = -1; i <= 1; i++) {
    float t = phi - 6.2831853 * (n0 + float(i));
    float j = floor(t / gap);
    for (int k = 0; k < 2; k++) {
      float tb = clamp((j + float(k)) * gap, t0, 0.0);
      float R = 0.56 * exp(g * tb);
      d = smin(d, length(p - R * vec3(cos(tb), sin(tb), 0.0)) - 0.48 * R, 0.04);
    }
  }
  return d * 0.9;
}

void main() {
  fragColor = sdRender(1.1, 0.3);
}
`;var Dt={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var It=`uniform float thickness;
uniform float bevel;

float map(vec3 p) {
  // Rest pose: tipped back and turned so the face and the edge both show.
  p.yz = mat2(0.819, 0.574, -0.574, 0.819) * p.yz;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  float r = length(p.xy), h = thickness * 0.5;
  // Faces bulge a little toward the middle so the light slides across them.
  vec2 w = vec2(r - 0.62, abs(p.z) - h - 0.05 * (1.0 - r * r / 0.3844));
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  return max(d, (w.x + w.y + bevel * h) * 0.7071) * 0.9;
}

void main() {
  fragColor = sdRender(1.0, 0.3);
}
`;customElements.get("sd-scene")||customElements.define("sd-scene",T);g(ht,bt);g(gt,yt);g(xt,vt);g(wt,Mt);g(St,Rt);g(kt,Et);g(At,Tt);g(Ct,Ft);g(Pt,jt);g(zt,Ot);g(Lt,Ut);g(Dt,It);customElements.get("sd-universe")||customElements.define("sd-universe",X);export{k as SdObject,T as SdScene,X as SdUniverse,g as defineObject,be as registry};
//# sourceMappingURL=solids.js.map
