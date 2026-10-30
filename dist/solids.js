var ar=Object.defineProperty;var nr=(t,i)=>{for(var e in i)ar(t,e,{get:i[e],enumerable:!0})};var be=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var P=(t,i,e)=>Math.min(e,Math.max(i,t)),L=(t,i,e)=>t+(i-t)*e,E=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),ve=new Float32Array([1,0,0,0,1,0,0,0,1]);function O(t,i,e){let r=Math.cos(t),a=Math.sin(t),s=Math.cos(i),n=Math.sin(i),o=Math.cos(e),l=Math.sin(e);return new Float32Array([s*o,s*l,-n,a*n*o-r*l,a*n*l+r*o,a*s,r*n*o+a*l,r*n*l-a*o,r*s])}function B(t,i){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let a=0;a<3;a++)e[r*3+a]=t[a]*i[r*3]+t[3+a]*i[r*3+1]+t[6+a]*i[r*3+2];return e}var ge=null,V=new Map;function K(t,i="srgb"){if(t=t.trim(),i==="srgb"){let n=t.match(/^#([0-9a-f]{3})$/i);if(n)return[...n[1]].map(o=>parseInt(o+o,16)/255);if(n=t.match(/^#([0-9a-f]{6})$/i),n)return[0,2,4].map(o=>parseInt(n[1].slice(o,o+2),16)/255)}let e=i+t;if(V.has(e))return V.get(e);let r=ge??(ge=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!r)return null;r.fillStyle="#000",r.fillStyle=t;let a=r.fillStyle;r.fillStyle="#fff",r.fillStyle=t;let s=null;if(a===r.fillStyle){r.clearRect(0,0,1,1),r.fillRect(0,0,1,1);let n=r.getImageData(0,0,1,1,{colorSpace:i}).data;s=[n[0]/255,n[1]/255,n[2]/255]}return V.size>256&&V.clear(),V.set(e,s),s}var W=null;function ye(){if(W!==null)return W;try{let t=K("#ff0000","display-p3");W=!!t&&t[1]>.05}catch{W=!1}return W}var xe=`#version 300 es
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
`;var we=`#version 300 es
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
`;var oe=new WeakMap;function Se(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(ie(i),{gl:i,colorSpace:i.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function ie(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=ye()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function Me(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function ee(t,i,e="object"){let r=oe.get(t);r||oe.set(t,r=new Map);let a=e[0]+i,s=r.get(a);if(s)return s;let n=(e==="object"?xe:we)+`
`+i,o=t.createProgram();if(t.attachShader(o,Me(t,t.VERTEX_SHADER,be)),t.attachShader(o,Me(t,t.FRAGMENT_SHADER,n)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let l=new Map,f=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let d=0;d<f;d++){let c=t.getActiveUniform(o,d);l.set(c.name,t.getUniformLocation(o,c.name))}let p={prog:o,loc:l};return r.set(a,p),p}function Re(t){oe.delete(t)}function te(t,i,e){for(let[r,a]of Object.entries(e)){let s=i.loc.get(r);s!==void 0&&(typeof a=="number"?t.uniform1f(s,a):a.length===1?t.uniform1i(s,a[0]):a.length===2?t.uniform2f(s,a[0],a[1]):a.length===3?t.uniform3f(s,a[0],a[1],a[2]):a.length===4?t.uniform4f(s,a[0],a[1],a[2],a[3]):a.length===9&&t.uniformMatrix3fv(s,!1,a))}}function re(t){t.drawArrays(t.TRIANGLES,0,3)}function q(t,i,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let a=t.createFramebuffer(),s={fb:a,tex:r,w:0,h:0};return X(t,s,i,e),t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),s}function X(t,i,e,r){e=Math.max(1,e),r=Math.max(1,r),!(i.w===e&&i.h===r)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=r)}function ce(t,i){t.deleteFramebuffer(i.fb),t.deleteTexture(i.tex)}var Ce={};nr(Ce,{animations:()=>Y,effectAttrs:()=>Q,effectParam:()=>$,effects:()=>z,interactionAttrs:()=>le,interactionParam:()=>me,interactionValue:()=>A,interactions:()=>I,kebab:()=>G,num:()=>R,objects:()=>H});var H=new Map,Y=new Map,z=new Map,I=new Map,ke=()=>[...z.values()].map(t=>t.manifest),Ee=()=>[...I.values()].map(t=>t.meta),Te=t=>t.flatMap(i=>i.params.map(e=>`${i.name}-${G(e.name)}`)),Q=()=>Te(ke()),le=()=>Te(Ee()),G=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function Ae(t,i,e,r){var a;for(let s of t){let n=s.name+"-";if(!i.startsWith(n))continue;let o=s.params.find(l=>G(l.name)===i.slice(n.length));if(o)return(r[a=s.name]??(r[a]={}))[o.name]=R(e,o.default),!0}return!1}var $=(t,i,e)=>Ae(ke(),t,i,e),me=(t,i,e)=>Ae(Ee(),t,i,e),A=(t,i,e)=>t.interactionParams[i]?.[e]??I.get(i).meta.params.find(r=>r.name===e).default,R=(t,i)=>{if(t==null||t==="")return i;let e=Number(t);return isNaN(e)?i:e};var cr={off:0,idle:.25,busy:.6,active:1},lr=["animation","speed","effect","state","color","size","phase","gravity","gravity-gap"],Pe=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),U=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(ve),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.z=0;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=je(r.default,r.type)??0}static get observedAttributes(){return[...lr,...this.manifest.uniforms.map(e=>G(e.name)),...Q()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let a=document.createElement("sd-scene");this.shadowRoot.append(a),a.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,a){let s=a??"";switch(e){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(s);this.speedValue=s===""||isNaN(o)?1:o;return}case"state":this.stateTarget=cr[s]??.25;return;case"color":this.recolor(s||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=s?`:host{width:${s}}`:"";return;case"phase":this.phaseOffset=R(s,0);return;case"gravity":case"gravity-gap":return}if($(e,a,this.effectParams))return;let n=this.manifest.uniforms.find(o=>G(o.name)===e);if(n){let o=je(a===null||a===""?n.default:a,n.type);o!==null&&(this.uniforms[n.name]=o)}}recolor(e=this.colorSrc){let r=e?K(e,this.scene?.colorSpace):null;r&&(this.rgb=r,this.colorSrc=e)}update(e){this.stateValue=E(this.stateValue,this.stateTarget,e,150),C()||(this.clock+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let n=Y.get(s)?.fn(this.clock+this.phaseOffset,this.speedValue,this);if(n){if(n.rotation)for(let o=0;o<3;o++)r.rotation[o]+=n.rotation[o];n.offset&&(r.offset[0]+=n.offset[0],r.offset[1]+=n.offset[1]),n.scale!==void 0&&(r.scale*=n.scale),n.state!==void 0&&(r.state+=n.state),n.uniforms&&Object.assign(this.uniforms,n.uniforms)}}let a=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),n=this.prevPose;a={rotation:[0,1,2].map(o=>mr(n.rotation[o],r.rotation[o],s)),offset:[L(n.offset[0],r.offset[0],s),L(n.offset[1],r.offset[1],s)],scale:L(n.scale,r.scale,s),state:L(n.state,r.state,s)}}this.pose=a,this.anim.rotation=O(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=this.z}};function mr(t,i,e){let r=((i-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function je(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:K(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var fe=null;function C(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(fe??(fe=matchMedia("(prefers-reduced-motion: reduce)")),fe.matches)}function fr(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,Pe(e))||Object.defineProperty(t,Pe(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function k(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;H.set(t.name,{manifest:t,frag:i});let e=(r=class extends U{},r.manifest=t,r.frag=i,r);fr(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var Fe=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var N=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e),this.last&&(this.fps=pe(this.fps,1e3/Math.max(e-this.last,1)));let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...Q(),...le()]}connectedCallback(){if(!this.gl){let e=Se(this.canvas);if(this.gl=e?.gl??null,this.colorSpace=e?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{Re(this.gl),this.fbos=null,this.query=null,ie(this.gl);for(let r of this.objects)r.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof U&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,a){let s=a??"";if(e==="interaction")this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(n=>I.get(n)?.setup?.(this));else if(e==="effect")this.effectNames=s.split(/\s+/).filter(Boolean);else if(e==="theme")this.theme=s||"auto";else if(e==="dpr"){let n=Number(s);this.maxDpr=s&&!isNaN(n)&&n>0?n:2,this.measure()}else e==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):$(e,a,this.effectParams)||me(e,a,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.objects=new Set([...this.objects].sort((r,a)=>r.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.pixelRatio),a=Math.round(e.height*this.pixelRatio);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let s of this.objects){let n=s.getBoundingClientRect();s.rect=new DOMRect(n.left-e.left,n.top-e.top,n.width,n.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let a=this.gl,s=this.canvas.width,n=this.canvas.height;if(!a||s===0||n===0)return;let o=performance.now(),l=this.gpuOn?this.gpuBegin(a):null;try{this.render(a,s,n,e,r)}finally{l&&a.endQuery(l.TIME_ELAPSED_EXT),this.frameTime=pe(this.frameTime,performance.now()-o)}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let r=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!r)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let a=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(r.GPU_DISJOINT_EXT)&&Number.isFinite(a)&&(this.gpuMs=pe(this.gpuMs??0,a/1e6))}return e.beginQuery(r.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),r}render(e,r,a,s,n){C()||(this.clock=s),s=this.clock;for(let c of this.objects)c.update(n);this.step(n);for(let c of this.interactionNames)I.get(c)?.frame(this,n,this.pointer);let o=this.fbos??(this.fbos={scene:q(e,r,a),a:q(e,r,a),b:q(e,r,a),pool:new Map,used:new Set});X(e,o.scene,r,a),X(e,o.a,r,a),X(e,o.b,r,a);let l=this.themeValue;this.bind(e,o.scene,0,0,r,a,!0);let f=[...this.objects].filter(c=>c.rect&&!c.broken).sort((c,u)=>c.anim.z-u.anim.z);for(let c of f)this.draw(e,c,s,l,o);let p=o.scene,d=this.effectNames.filter(c=>z.has(c));for(let c of d){let u=p===o.a?o.b:o.a;this.bind(e,u,0,0,r,a,!0),this.pass(e,c,p,this.effectParams[c],[r,a],s,l),p=u}this.bind(e,null,0,0,r,a,!0),this.blit(e,p);for(let[c,u]of o.pool)o.used.has(c)?u[2]=0:++u[2]>60&&(ce(e,u[0]),ce(e,u[1]),o.pool.delete(c));o.used.clear()}step(e){}bind(e,r,a,s,n,o,l){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(a,s,n,o),e.scissor(a,s,n,o),e.enable(e.SCISSOR_TEST),l&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let a=ee(e,Fe,"effect");e.useProgram(a.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),te(e,a,{uScene:[0]}),re(e)}pass(e,r,a,s,n,o,l){let f=z.get(r),p;try{p=ee(e,f.frag,"effect")}catch(c){console.error(`[solids] effect "${r}" shader failed:
${c.message}`),this.blit(e,a);return}e.useProgram(p.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex);let d={};for(let c of f.manifest.params)d[c.name]=c.default;te(e,p,{uScene:[0],uResolution:n,uTime:o,uTheme:l,uMix:s?.mix??1,...d,...s}),re(e)}draw(e,r,a,s,n,o=this.canvas.width,l=this.canvas.height){let f=r.rect,p=r.manifest.bleed??1.5,d=f.x+f.width/2+r.anim.offset[0],c=f.y+f.height/2+r.anim.offset[1],u=f.width*r.anim.scale*this.pixelRatio,h=Math.ceil(u*p/8)*8,m=h;if(!(u>0)||h>8192)return;let g=Math.round(d*this.pixelRatio-h/2),x=Math.round((this.height-c)*this.pixelRatio-m/2);if(g>=o||x>=l||g+h<=0||x+m<=0)return;let w=h/this.pixelRatio,v=m/this.pixelRatio,j;try{j=ee(e,r.frag)}catch(y){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${y.message}`);return}let _=r.effectNames.filter(y=>z.has(y)),T;if(_.length){let y=h+"x"+m;T=n.pool.get(y),T||n.pool.set(y,T=[q(e,h,m),q(e,h,m),0]),n.used.add(y),this.bind(e,T[0],0,0,h,m,!0)}else this.bind(e,n.scene,g,x,h,m,!1);e.useProgram(j.prog);let b=this.pointer.inside?[(this.pointer.x-d)/w*2,-((this.pointer.y-c)/v)*2]:[0,0];if(te(e,j,{uTime:a,uResolution:[h,m],uPointer:b,uRotation:r.anim.rotation,uScale:u/h,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:s,uColor:r.rgb,...r.uniforms}),re(e),!_.length)return;let S=T[0];for(let y of _){let M=S===T[0]?T[1]:T[0];this.bind(e,M,0,0,h,m,!0),this.pass(e,y,S,r.effectParams[y],[h,m],a,s),S=M}this.bind(e,n.scene,g,x,h,m,!1),this.blit(e,S)}},pe=(t,i)=>t?t+(i-t)*.1:i;var ur=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],dr=["idle","float","spin"],Le=["count","seed","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],hr=["count","seed","shapes","palette"],Oe=640,D=Math.PI/180,ze=()=>new Set([...H.values()].map(t=>t.manifest.tag)),Z=t=>Math.hypot(t[0],t[1],t[2]),Ie=(t,i)=>[t[0]-i[0],t[1]-i[1],t[2]-i[2]],Ue=t=>{let i=Z(t)||1;return[t[0]/i,t[1]/i,t[2]/i]};function De(t){return()=>{t=t+1831565813|0;let i=Math.imul(t^t>>>15,1|t);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296}}var ae=class extends N{constructor(){super();this.yaw=0;this.pitch=0;this.bodies=[];this.ready=!1;this.time=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary||e.button!==0||this.drag)){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{let r=this.drag;if(!r||e.pointerId!==r.id)return;if(e.buttons===0)return this.onUp(e);let a=Math.max(8,e.timeStamp-r.t),s=(e.clientX-r.x)*.006,n=(e.clientY-r.y)*.006;this.yaw+=s,this.pitch=P(this.pitch+n,-60*D,60*D),this.vel=[s/a,n/a],this.drag={id:r.id,x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=e=>{let r=this.drag;!r||e.pointerId!==r.id&&e.type!=="lostpointercapture"||(this.drag=null,this.classList.remove("sd-dragging"),(C()||e.timeStamp-r.t>80)&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("lostpointercapture",this.onUp)}static get observedAttributes(){return[...N.observedAttributes,...Le]}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=ze();[...this.children].some(r=>e.has(r.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,r,a){if(!Le.includes(e))return super.attributeChangedCallback(e,r,a);this.ready&&hr.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof U)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let c of this.kids())c.remove();let e=ze(),r=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(c=>c.startsWith("sd-")?c:"sd-"+c),a=(r.length?r:[...e]).filter(c=>e.has(c)),s=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??ur,n=a.length?P(Math.round(R(this.getAttribute("count"),24)),0,120):0,o=De(R(this.getAttribute("seed"),1)),l=c=>c[Math.floor(o()*c.length)],f=()=>{for(;;){let c=[o()*2-1,o()*2-1,o()*2-1];if(Z(c)<=1)return c}},p=[];for(let c=0;c<n;c++){let u=8*Math.round((40+100*o())/8),h=u/Oe,m=f(),g=-1/0;for(let x=0;x<8;x++){let w=f(),v=2;for(let j of p)v=Math.min(v,Z(Ie(w,j.p))-h-j.r);v>g&&(g=v,m=w)}p.push({tag:l(a),p:m,r:h,size:u,color:l(s),anim:l(dr),speed:.6+o()*.8,phase:o()*20})}let d=document.createDocumentFragment();for(let c of p){let u=document.createElement(c.tag);u.dataset.pos=c.p.map(h=>h.toFixed(2)).join(" "),u.setAttribute("size",c.size+"px"),u.setAttribute("color",c.color),u.setAttribute("animation",c.anim),u.setAttribute("speed",c.speed.toFixed(2)),u.setAttribute("phase",c.phase.toFixed(1)),d.append(u)}this.append(d),this.adopt()}adopt(){let e=De(R(this.getAttribute("seed"),1)*7919+17),r=this.kids(),a=r.map(s=>R((s.getAttribute("size")??"").replace("px",""),80));this.bodies=r.map((s,n)=>{let o=(s.dataset.pos??"").split(/\s+/).map(Number),l=o.length===3&&o.every(d=>!isNaN(d))?[o[0],o[1],o[2]]:Ue([e()-.5,e()-.5,e()-.5]).map(d=>d*e()),f=Ue([e()-.5,e()-.5,e()-.5]).map(d=>d*(.02+e()*.04)),p=[];for(let d=0;d<3;d++)p.push(.05+e()*.1,e()*2*Math.PI,.02+e()*.03);return{el:s,p:l,v:f,r:a[n]/Oe,tilt:O((e()-.5)*70*D,0,(e()-.5)*70*D),wob:p}})}step(e){var T;let r=this.width,a=this.height;if(!r||!a)return;let s=C(),n=this.cam(),o=Math.max(0,R(this.getAttribute("speed"),1)),l=s?0:P(R(this.getAttribute("drift"),.5),0,1),f=P(R(this.getAttribute("depth"),.5),0,1),p=P(R(this.getAttribute("focus"),0),-1,1),d=1.6/P(R(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),n.has("spin")&&!s&&(this.yaw+=e/1e3*(2*Math.PI/90)*o*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=P(this.pitch+this.vel[1]*e,-60*D,60*D);let b=Math.exp(-e/600);this.vel[0]*=b,this.vel[1]*=b}let c=n.has("pointer")&&this.pointer.inside;this.tilt[0]=E(this.tilt[0],c?(this.pointer.x/r*2-1)*12*D:0,e,150),this.tilt[1]=E(this.tilt[1],c?(this.pointer.y/a*2-1)*8*D:0,e,150);let u=this.yaw+this.tilt[0],h=this.pitch+this.tilt[1],m=Math.cos(u),g=Math.sin(u),x=Math.cos(h),w=Math.sin(h),v=r/2*.95,j=a/2*.95*(d-.6)/d;s||(this.time+=e/1e3);let _=this.bodies.filter(b=>b.el.scene===this);if(l>0)for(let b of _){for(let y=0;y<3;y++)b.p[y]+=b.v[y]*(e/1e3)*l;let S=Z(b.p);if(S>1){let y=(b.p[0]*b.v[0]+b.p[1]*b.v[1]+b.p[2]*b.v[2])/S;if(y>0)for(let M=0;M<3;M++)b.v[M]-=2*y*b.p[M]/S;for(let M=0;M<3;M++)b.p[M]/=S}}this.hasAttribute("collide")&&this.collide(_);for(let b of _){let S=b.el.anim,y=b.wob,M=[b.p[0],b.p[1],b.p[2]];if(l>0)for(let F=0;F<3;F++)M[F]+=Math.sin(2*Math.PI*y[F*3]*this.time+y[F*3+1])*y[F*3+2]*l;let tr=M[0]*m+M[2]*g,de=-M[0]*g+M[2]*m,rr=M[1]*x-de*w,J=M[1]*w+de*x,ne=P(d/(d-J),.3,3);S.offset[0]+=tr*ne*v,S.offset[1]-=rr*ne*j,S.scale*=ne,S.z=J,S.rotation=B(b.tilt,S.rotation);let he=Math.min(24,f*Math.abs(J-p)*14),se=b.el.effectNames.filter(F=>F!=="defocus");he>=.5?(b.el.effectNames=[...se,"defocus"],((T=b.el.effectParams).defocus??(T.defocus={})).radius=he):se.length!==b.el.effectNames.length&&(b.el.effectNames=se),S.state-=.75*f*Math.max(0,p-J)}}collide(e){for(let r=0;r<4;r++)for(let a=0;a<e.length;a++)for(let s=a+1;s<e.length;s++){let n=e[a],o=e[s],l=Ie(o.p,n.p),f=Z(l),p=n.r+o.r;if(f>=p)continue;let d=f<1e-6?[1,0,0]:[l[0]/f,l[1]/f,l[2]/f];f=f||0;let c=1/(n.r*n.r*n.r),u=1/(o.r*o.r*o.r),h=c+u;for(let v=0;v<3;v++)n.p[v]-=d[v]*(p-f)*(c/h),o.p[v]+=d[v]*(p-f)*(u/h);let m=n.v,g=o.v,x=(g[0]-m[0])*d[0]+(g[1]-m[1])*d[1]+(g[2]-m[2])*d[2];if(x>=0)continue;let w=-2*x/h;for(let v=0;v<3;v++)n.v[v]-=d[v]*w*c,o.v[v]+=d[v]*w*u}}};var _e=Math.PI/180,Ne={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*_e,Math.sin(t*2*Math.PI/6)*8*_e,0]})};var Be={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var qe={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Ge={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var Ve={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var br=[Ne,Be,qe,Ge,Ve];for(let t of br)Y.set(t.meta.name,t);var We={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var Xe=`uniform float threshold;
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
`;var He={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Ye=`uniform float angle;
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
`;var Qe={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var $e=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Ze={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Je=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var Ke={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var et=`uniform float levels;
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
`;var tt={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var rt=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var at={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var nt=`uniform float size;
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
`;var st={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var ot=`uniform float width;
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
`;var it={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var ct=`uniform float amount;
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
`;var lt={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var mt=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var ft={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var pt=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var ut={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var dt=`uniform float amplitude;
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
`;var ht={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var bt=`uniform float radius;

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
`;var Gr=[{manifest:We,frag:Xe},{manifest:He,frag:Ye},{manifest:Qe,frag:$e},{manifest:Ze,frag:Je},{manifest:Ke,frag:et},{manifest:tt,frag:rt},{manifest:at,frag:nt},{manifest:st,frag:ot},{manifest:it,frag:ct},{manifest:lt,frag:mt},{manifest:ft,frag:pt},{manifest:ut,frag:dt},{manifest:ht,frag:bt}],Vr={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of Gr)t.manifest.params.some(i=>i.name==="mix")||t.manifest.params.push(Vr),z.set(t.manifest.name,t);var gt=new WeakMap,vt=20*Math.PI/180,yt={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,i,e){let s=Math.max(1,Math.round(i/16));for(let n of t.objects){if(!n.rect)continue;let o=gt.get(n)??gt.set(n,{rx:0,ry:0,vx:0,vy:0}).get(n),l=0,f=0;if(e.inside){let p=n.rect.x+n.rect.width/2+n.anim.offset[0],d=n.rect.y+n.rect.height/2+n.anim.offset[1],c=(e.x-p)/Math.max(t.width,1),u=(e.y-d)/Math.max(t.height,1);f=Math.max(-1,Math.min(1,c*2))*vt,l=Math.max(-1,Math.min(1,u*2))*vt}for(let p=0;p<s;p++)o.vx=(o.vx+(l-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(f-o.ry)*.08)*.8,o.ry+=o.vy;n.anim.rotation=B(O(o.rx,o.ry,0),n.anim.rotation)}}};var xt=new WeakMap,wt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,i,e){for(let r of t.objects){if(!r.rect)continue;let a=r.rect.x+r.rect.width/2+r.anim.offset[0],s=r.rect.y+r.rect.height/2+r.anim.offset[1],n=e.inside&&Math.abs(e.x-a)<=r.rect.width/2&&Math.abs(e.y-s)<=r.rect.height/2,o=E(xt.get(r)??0,n?1:0,i,160);xt.set(r,o),r.anim.scale*=1+.08*o,r.anim.state+=o*(1-r.stateValue)}}};var Mt=new WeakMap,ue=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],Wr=t=>t*t*(3-2*t),St={meta:{name:"gravity",description:"One object is the center. The others orbit it on rings, farther rings turning slower like real orbits, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,i){let e=[...t.objects].filter(c=>c.rect),r=e.find(c=>c.getAttribute("gravity")==="center")??null,a=R(t.getAttribute("gravity-strength"),.6),s=r?ue(r):null,n=C(),o=c=>{let u=c.getAttribute("gravity");return!s||c===r||u==="none"?"none":u==="fall"?"fall":"orbit"},l=e.filter(c=>o(c)==="orbit").map(c=>{let u=ue(c);return{o:c,d:Math.hypot(u[0]-s[0],u[1]-s[1])}}).sort((c,u)=>c.d-u.d),f=l.length?Math.max(l[0].d,(r.rect.width+l[0].o.rect.width)/4+24):0,p=l.length?Math.max(l[l.length-1].d,f):0,d=c=>{let u=l.findIndex(m=>m.o===c),h=l.length;return h>1?f+(p-f)*u/(h-1):f};for(let c of e){let u=o(c),h=u!=="none",m=Mt.get(c);if(!m&&!h)continue;m||Mt.set(c,m={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let g=[0,0],x=0;if(h){let w=ue(c);if(m.center!==r&&(m.from=[m.offset[0],m.offset[1]],m.k=0,m.center=r,m.angle=Math.atan2(w[1]-s[1],w[0]-s[0]),m.r=Math.hypot(w[0]-s[0],w[1]-s[1])),u==="fall"){let v=R(c.getAttribute("gravity-gap"),24)+(r.rect.width+c.rect.width)/4;n||(m.r+=(v-m.r)*(1-Math.exp(-i/700))*(.3+a))}else m.r=n||m.k===0?d(c):E(m.r,d(c),i,300),n||(m.angle+=i/1e3*.3*a*Math.pow(p/m.r,1.5)),x=Math.sin(m.angle)*(m.r/p);g=[s[0]+Math.cos(m.angle)*m.r-w[0],s[1]+Math.sin(m.angle)*m.r-w[1]]}else m.center&&(m.from=[m.offset[0],m.offset[1]],m.k=0,m.center=null);if(m.k<1){m.k=n?1:Math.min(1,m.k+i/800);let w=Wr(m.k);g=[L(m.from[0],g[0],w),L(m.from[1],g[1],w)]}m.offset=g,c.anim.offset[0]+=g[0],c.anim.offset[1]+=g[1],c.anim.z+=x,c.anim.scale*=1+.06*x}}};var Rt=new WeakMap,kt={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,i,e){let r=A(t,"repel","radius"),a=A(t,"repel","strength"),s=Math.max(1,Math.round(i/16));for(let n of t.objects){if(!n.rect)continue;let o=Rt.get(n)??Rt.set(n,{x:0,y:0,vx:0,vy:0}).get(n),l=0,f=0;if(e.inside){let p=n.rect.x+n.rect.width/2+n.anim.offset[0]-e.x,d=n.rect.y+n.rect.height/2+n.anim.offset[1]-e.y,c=Math.hypot(p,d);if(c<r){let u=(1-c/r)*r*.5*a;l=c>.001?p/c*u:0,f=c>.001?d/c*u:-u}}for(let p=0;p<s;p++)o.vx=(o.vx+(l-o.x)*.08)*.8,o.x+=o.vx,o.vy=(o.vy+(f-o.y)*.08)*.8,o.y+=o.vy;n.anim.offset[0]+=o.x,n.anim.offset[1]+=o.y}}};var Et=new WeakMap,Tt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,i,e){let r=A(t,"magnet","reach"),a=A(t,"magnet","strength");for(let s of t.objects){if(!s.rect)continue;let n=Et.get(s)??[0,0],o=0,l=0;if(e.inside){o=(e.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*a,l=(e.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*a;let p=Math.hypot(o,l);p>r&&(o*=r/p,l*=r/p)}let f=[E(n[0],o,i,250),E(n[1],l,i,250)];Et.set(s,f),s.anim.offset[0]+=f[0],s.anim.offset[1]+=f[1]}}};var At=new WeakMap,Ct={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,i){let e=A(t,"collide","gap"),r=[...t.objects].filter(l=>l.rect),a=r.map(l=>[l.rect.x+l.rect.width/2+l.anim.offset[0],l.rect.y+l.rect.height/2+l.anim.offset[1]]),s=a.map(l=>[...l]),n=r.map(l=>l.getAttribute("gravity")==="center"?0:1);for(let l=0;l<4;l++)for(let f=0;f<r.length;f++)for(let p=f+1;p<r.length;p++){let d=s[p][0]-s[f][0],c=s[p][1]-s[f][1],u=Math.hypot(d,c),h=(r[f].rect.width+r[p].rect.width)/2+e,m=n[f]+n[p];if(u>=h||!m)continue;u<.001?(d=1,c=0):(d/=u,c/=u);let g=(h-u)*n[f]/m,x=(h-u)*n[p]/m;s[f][0]-=d*g,s[f][1]-=c*g,s[p][0]+=d*x,s[p][1]+=c*x}let o=C()?1:1-Math.exp(-i/120);r.forEach((l,f)=>{let p=At.get(l)??[0,0],d=[p[0]+(s[f][0]-a[f][0]-p[0])*o,p[1]+(s[f][1]-a[f][1]-p[1])*o];At.set(l,d),l.anim.offset[0]+=d[0],l.anim.offset[1]+=d[1]})}};var Pt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let i=t.getBoundingClientRect(),e=innerHeight,r=Math.min(1,Math.max(0,(e-i.top)/Math.max(e+i.height,1))),a=O(0,(r-.5)*A(t,"scroll","turns")*2*Math.PI,0);for(let s of t.objects)s.anim.rotation=B(a,s.anim.rotation)}};var Xr=[yt,wt,St,kt,Tt,Ct,Pt];for(let t of Xr)I.set(t.meta.name,t);var jt={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Ft=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var Lt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Ot=`uniform float thickness;
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
`;var zt={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var It=`uniform float facets;
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
`;var Ut={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var Dt=`uniform float turns;
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
`;var _t={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var Nt=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Bt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var qt=`uniform float radius;
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
`;var Gt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var Vt=`uniform float twist;
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
`;var Wt={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var Xt=`uniform float sides;
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
`;var Ht={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var Yt=`uniform float span;
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
`;var Qt={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var $t=`uniform float points;
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
`;var Zt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var Jt=`uniform float turns;
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
`;var Kt={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var er=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",N);k(jt,Ft);k(Lt,Ot);k(zt,It);k(Ut,Dt);k(_t,Nt);k(Bt,qt);k(Gt,Vt);k(Wt,Xt);k(Ht,Yt);k(Qt,$t);k(Zt,Jt);k(Kt,er);customElements.get("sd-universe")||customElements.define("sd-universe",ae);export{U as SdObject,N as SdScene,ae as SdUniverse,k as defineObject,Ce as registry};
//# sourceMappingURL=solids.js.map
