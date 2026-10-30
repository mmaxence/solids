var ya=Object.defineProperty;var wa=(t,s)=>{for(var e in s)ya(t,e,{get:s[e],enumerable:!0})};var ke=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var L=(t,s,e)=>Math.min(e,Math.max(s,t)),O=(t,s,e)=>t+(s-t)*e,T=(t,s,e,a)=>t+(s-t)*(1-Math.exp(-e/Math.max(a,1))),Ee=new Float32Array([1,0,0,0,1,0,0,0,1]);function D(t,s,e){let a=Math.cos(t),r=Math.sin(t),n=Math.cos(s),o=Math.sin(s),i=Math.cos(e),c=Math.sin(e);return new Float32Array([n*i,n*c,-o,r*o*i-a*c,r*o*c+a*i,r*n,a*o*i+r*c,a*o*c-r*i,a*n])}function G(t,s){let e=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)e[a*3+r]=t[r]*s[a*3]+t[3+r]*s[a*3+1]+t[6+r]*s[a*3+2];return e}var Re=null,Y=new Map;function oe(t,s="srgb"){if(t=t.trim(),s==="srgb"){let o=t.match(/^#([0-9a-f]{3})$/i);if(o)return[...o[1]].map(i=>parseInt(i+i,16)/255);if(o=t.match(/^#([0-9a-f]{6})$/i),o)return[0,2,4].map(i=>parseInt(o[1].slice(i,i+2),16)/255)}let e=s+t;if(Y.has(e))return Y.get(e);let a=Re??(Re=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=t;let r=a.fillStyle;a.fillStyle="#fff",a.fillStyle=t;let n=null;if(r===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let o=a.getImageData(0,0,1,1,{colorSpace:s}).data;n=[o[0]/255,o[1]/255,o[2]/255]}return Y.size>256&&Y.clear(),Y.set(e,n),n}var Q=null;function Te(){if(Q!==null)return Q;try{let t=oe("#ff0000","display-p3");Q=!!t&&t[1]>.05}catch{Q=!1}return Q}var Ae=`#version 300 es
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
// A key light at \`azimuthDeg\` around the view (0 from the right, 90 from the top), about 47 degrees up toward the viewer.
// Fixed to the view: the object turns under it (p, n and rd are object space, so the direction is brought into that space).
vec3 sdLightDir(float azimuthDeg) {
  float a = radians(azimuthDeg);
  return transpose(uRotation) * normalize(vec3(cos(a) * 0.7, sin(a) * 0.7, 0.75));
}
// A view-space direction from an object-space one (for sky and environment lookups that must not turn with the object).
vec3 sdView(vec3 v) { return uRotation * v; }
// A shade (src/shades/<name>/frag.glsl) defines these two: the color of a surface hit and the tint of the soft edge on a miss.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim);
vec3 sdEdge();
// Default renderer: march, shade, soft edge, optional halo on miss.
vec4 sdRender(float rim, float glow) {
  vec3 ro, rd; sdRay(ro, rd);
  float minD; float t = sdMarch(ro, rd, minD);
  float px = 2.5 / min(uResolution.x, uResolution.y) / uScale;
  if (t < 0.0) {
    float edge = 1.0 - smoothstep(0.0, px * 2.0, minD);
    float halo = glow * exp(-minD * 7.0) * 0.35 * (0.6 + 0.4 * uState);
    vec3 c = sdEdge() * (edge * 0.9 + halo);
    float a = clamp(edge * 0.9 + halo, 0.0, 1.0);
    return vec4(c, a);
  }
  vec3 p = ro + rd * t;
  return sdShade(p, sdNormal(p), rd, rim);
}
`;var Ce=`#version 300 es
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
`;var pe=new WeakMap;function Le(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(de(s),{gl:s,colorSpace:s.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function de(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=Te()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function Pe(t,s,e){let a=t.createShader(s);if(t.shaderSource(a,e),t.compileShader(a),!t.getShaderParameter(a,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(a)||"shader compile failed");return a}function se(t,s,e="object",a){let r=pe.get(t);r||pe.set(t,r=new Map);let n=e[0]+(a?.name??"")+`
`+s,o=r.get(n);if(o)return o;let i=(e==="object"?Ae+`
`+(a?.frag??""):Ce)+`
`+s,c=t.createProgram();if(t.attachShader(c,Pe(t,t.VERTEX_SHADER,ke)),t.attachShader(c,Pe(t,t.FRAGMENT_SHADER,i)),t.linkProgram(c),!t.getProgramParameter(c,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(c)||"link failed");let f=new Map,p=t.getProgramParameter(c,t.ACTIVE_UNIFORMS);for(let l=0;l<p;l++){let d=t.getActiveUniform(c,l);f.set(d.name,t.getUniformLocation(c,d.name))}let u={prog:c,loc:f};return r.set(n,u),u}function Fe(t){pe.delete(t)}function ie(t,s,e){for(let[a,r]of Object.entries(e)){let n=s.loc.get(a);n!==void 0&&(typeof r=="number"?t.uniform1f(n,r):r.length===1?t.uniform1i(n,r[0]):r.length===2?t.uniform2f(n,r[0],r[1]):r.length===3?t.uniform3f(n,r[0],r[1],r[2]):r.length===4?t.uniform4f(n,r[0],r[1],r[2],r[3]):r.length===9&&t.uniformMatrix3fv(n,!1,r))}}function le(t){t.drawArrays(t.TRIANGLES,0,3)}function W(t,s,e){let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let r=t.createFramebuffer(),n={fb:r,tex:a,w:0,h:0};return $(t,n,s,e),t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0),n}function $(t,s,e,a){e=Math.max(1,e),a=Math.max(1,a),!(s.w===e&&s.h===a)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,a,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=a)}function ue(t,s){t.deleteFramebuffer(s.fb),t.deleteTexture(s.tex)}var Ue={};wa(Ue,{LIGHT_SHADE:()=>ze,animations:()=>J,effectAttrs:()=>K,effectParam:()=>te,effects:()=>I,interactionAttrs:()=>ge,interactionParam:()=>ve,interactionValue:()=>A,interactions:()=>U,kebab:()=>X,num:()=>R,objects:()=>Z,resolveShade:()=>xe,shadeAttrs:()=>ee,shadeParam:()=>ae,shades:()=>F});var Z=new Map,J=new Map,I=new Map,F=new Map,ze="matte",U=new Map,Oe=()=>[...I.values()].map(t=>t.manifest),De=()=>[...U.values()].map(t=>t.meta),Ie=()=>[...F.values()].map(t=>t.manifest),he=t=>t.flatMap(s=>s.params.map(e=>`${s.name}-${X(e.name)}`)),K=()=>he(Oe()),ge=()=>he(De()),ee=()=>he(Ie()),X=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function be(t,s,e,a){var r;for(let n of t){let o=n.name+"-";if(!s.startsWith(o))continue;let i=n.params.find(f=>X(f.name)===s.slice(o.length));if(!i)continue;let c=e==null||e===""?NaN:Number(e);return isNaN(c)?delete a[n.name]?.[i.name]:(a[r=n.name]??(a[r]={}))[i.name]=c,!0}return!1}var te=(t,s,e)=>be(Oe(),t,s,e),ve=(t,s,e)=>be(De(),t,s,e),ae=(t,s,e)=>be(Ie(),t,s,e),je=new Set;function xe(t,s){t&&t!=="auto"&&!F.has(t)&&!je.has(t)&&(je.add(t),console.warn(`[solids] unknown shading "${t}", using auto`));let e=F.has(t)?t:s?ze:"glass";return F.has(e)?e:"glass"}var A=(t,s,e)=>t.interactionParams[s]?.[e]??U.get(s).meta.params.find(a=>a.name===e).default,R=(t,s)=>{if(t==null||t==="")return s;let e=Number(t);return isNaN(e)?s:e};var Ra={off:0,idle:.25,busy:.6,active:1},Ea=["animation","speed","effect","shading","state","color","size","phase","gravity","gravity-gap"],Ne=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),N=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.shadeName="auto";this.shadeParams={};this.anim={rotation:new Float32Array(Ee),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.z=0;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=_e(a.default,a.type)??0}static get observedAttributes(){return[...Ea,...this.manifest.uniforms.map(e=>X(e.name)),...K(),...ee()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),a=this.shadowRoot.querySelector("sd-scene");if(e)a&&(a.detach(this),a.remove()),e.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,a,r){let n=r??"";switch(e){case"animation":this.animNames=n.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=n.split(/\s+/).filter(Boolean);return;case"shading":this.shadeName=n.trim()||"auto";return;case"speed":{let i=Number(n);this.speedValue=n===""||isNaN(i)?1:i;return}case"state":this.stateTarget=Ra[n]??.25;return;case"color":this.recolor(n||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=n?`:host{width:${n}}`:"";return;case"phase":this.phaseOffset=R(n,0);return;case"gravity":case"gravity-gap":return}if(te(e,r,this.effectParams)||ae(e,r,this.shadeParams))return;let o=this.manifest.uniforms.find(i=>X(i.name)===e);if(o){let i=_e(r===null||r===""?o.default:r,o.type);i!==null&&(this.uniforms[o.name]=i)}}recolor(e=this.colorSrc){let a=e?oe(e,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=e)}update(e){this.stateValue=T(this.stateValue,this.stateTarget,e,150),C()||(this.clock+=e/1e3*this.speedValue);let a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let n of this.animNames){let o=J.get(n)?.fn(this.clock+this.phaseOffset,this.speedValue,this);if(o){if(o.rotation)for(let i=0;i<3;i++)a.rotation[i]+=o.rotation[i];o.offset&&(a.offset[0]+=o.offset[0],a.offset[1]+=o.offset[1]),o.scale!==void 0&&(a.scale*=o.scale),o.state!==void 0&&(a.state+=o.state),o.uniforms&&Object.assign(this.uniforms,o.uniforms)}}let r=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let n=this.blend*this.blend*(3-2*this.blend),o=this.prevPose;r={rotation:[0,1,2].map(i=>Ta(o.rotation[i],a.rotation[i],n)),offset:[O(o.offset[0],a.offset[0],n),O(o.offset[1],a.offset[1],n)],scale:O(o.scale,a.scale,n),state:O(o.state,a.state,n)}}this.pose=r,this.anim.rotation=D(r.rotation[0],r.rotation[1],r.rotation[2]),this.anim.offset=[r.offset[0],r.offset[1]],this.anim.scale=r.scale,this.anim.state=r.state,this.anim.z=this.z}};function Ta(t,s,e){let a=((s-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+a*e}function _e(t,s){if(s==="float"){let a=typeof t=="number"?t:Number(t);return isNaN(a)?null:a}if(s==="color")return Array.isArray(t)?t:oe(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(a=>!isNaN(a))?e:null}var ye=null;function C(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(ye??(ye=matchMedia("(prefers-reduced-motion: reduce)")),ye.matches)}function Aa(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,Ne(e))||Object.defineProperty(t,Ne(e),{get(){return this.getAttribute(e)},set(a){a==null?this.removeAttribute(e):this.setAttribute(e,String(a))}})}function E(t,s){var a;if(!t?.tag||customElements.get(t.tag))return;Z.set(t.name,{manifest:t,frag:s});let e=(a=class extends N{},a.manifest=t,a.frag=s,a);Aa(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var Be=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var B=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.shadeName="auto";this.shadeParams={};this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let a=this.getBoundingClientRect();this.pointer={x:e.clientX-a.left,y:e.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e),this.last&&(this.fps=we(this.fps,1e3/Math.max(e-this.last,1)));let a=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,a),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","shading","theme","paused","dpr",...K(),...ge(),...ee()]}connectedCallback(){if(!this.gl){let e=Le(this.canvas);if(this.gl=e?.gl??null,this.colorSpace=e?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let a of this.objects)a.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",a=>{a.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{Fe(this.gl),this.fbos=null,this.query=null,de(this.gl);for(let a of this.objects)a.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof N&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,a,r){let n=r??"";if(e==="interaction")this.interactionNames=n.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>U.get(o)?.setup?.(this));else if(e==="effect")this.effectNames=n.split(/\s+/).filter(Boolean);else if(e==="shading")this.shadeName=n.trim()||"auto";else if(e==="theme")this.theme=n||"auto";else if(e==="dpr"){let o=Number(n);this.maxDpr=n&&!isNaN(o)&&o>0?o:2,this.measure()}else e==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):!te(e,r,this.effectParams)&&!ae(e,r,this.shadeParams)&&ve(e,r,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.objects=new Set([...this.objects].sort((a,r)=>a.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let a=Math.round(e.width*this.pixelRatio),r=Math.round(e.height*this.pixelRatio);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let n of this.objects){let o=n.getBoundingClientRect();n.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,a){let r=this.gl,n=this.canvas.width,o=this.canvas.height;if(!r||n===0||o===0)return;let i=performance.now(),c=this.gpuOn?this.gpuBegin(r):null;try{this.render(r,n,o,e,a)}finally{c&&r.endQuery(c.TIME_ELAPSED_EXT),this.frameTime=we(this.frameTime,performance.now()-i)}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let a=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!a)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let r=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(a.GPU_DISJOINT_EXT)&&Number.isFinite(r)&&(this.gpuMs=we(this.gpuMs??0,r/1e6))}return e.beginQuery(a.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),a}render(e,a,r,n,o){C()||(this.clock=n),n=this.clock;for(let l of this.objects)l.update(o);this.step(o);for(let l of this.interactionNames)U.get(l)?.frame(this,o,this.pointer);let i=this.fbos??(this.fbos={scene:W(e,a,r),a:W(e,a,r),b:W(e,a,r),pool:new Map,used:new Set});$(e,i.scene,a,r),$(e,i.a,a,r),$(e,i.b,a,r);let c=this.themeValue;this.bind(e,i.scene,0,0,a,r,!0);let f=[...this.objects].filter(l=>l.rect&&!l.broken).sort((l,d)=>l.anim.z-d.anim.z);for(let l of f)this.draw(e,l,n,c,i);let p=i.scene,u=this.effectNames.filter(l=>I.has(l));for(let l of u){let d=p===i.a?i.b:i.a;this.bind(e,d,0,0,a,r,!0),this.pass(e,l,p,this.effectParams[l],[a,r],n,c),p=d}this.bind(e,null,0,0,a,r,!0),this.blit(e,p);for(let[l,d]of i.pool)i.used.has(l)?d[2]=0:++d[2]>60&&(ue(e,d[0]),ue(e,d[1]),i.pool.delete(l));i.used.clear()}step(e){}bind(e,a,r,n,o,i,c){e.bindFramebuffer(e.FRAMEBUFFER,a?.fb??null),e.viewport(r,n,o,i),e.scissor(r,n,o,i),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,a){let r=se(e,Be,"effect");e.useProgram(r.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex),ie(e,r,{uScene:[0]}),le(e)}pass(e,a,r,n,o,i,c){let f=I.get(a),p;try{p=se(e,f.frag,"effect")}catch(l){console.error(`[solids] effect "${a}" shader failed:
${l.message}`),this.blit(e,r);return}e.useProgram(p.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex);let u={};for(let l of f.manifest.params)u[l.name]=l.default;ie(e,p,{uScene:[0],uResolution:o,uTime:i,uTheme:c,uMix:n?.mix??1,...u,...n}),le(e)}draw(e,a,r,n,o,i=this.canvas.width,c=this.canvas.height){let f=a.rect,p=a.manifest.bleed??1.5,u=f.x+f.width/2+a.anim.offset[0],l=f.y+f.height/2+a.anim.offset[1],d=f.width*a.anim.scale*this.pixelRatio,h=Math.ceil(d*p/8)*8,m=h;if(!(d>0)||h>8192)return;let b=Math.round(u*this.pixelRatio-h/2),x=Math.round((this.height-l)*this.pixelRatio-m/2);if(b>=i||x>=c||b+h<=0||x+m<=0)return;let y=h/this.pixelRatio,v=m/this.pixelRatio,P=xe(a.hasAttribute("shading")?a.shadeName:this.shadeName,n),q=F.get(P),H={};for(let M of q.manifest.params){let j=a.shadeParams[P]?.[M.name]??this.shadeParams[P]?.[M.name]??M.default;H[M.name]=Math.min(M.max??j,Math.max(M.min??j,j))}let g;try{g=se(e,a.frag,"object",{name:P,frag:q.frag})}catch(M){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${M.message}`);return}let k=a.effectNames.filter(M=>I.has(M)),w;if(k.length){let M=h+"x"+m;w=o.pool.get(M),w||o.pool.set(M,w=[W(e,h,m),W(e,h,m),0]),o.used.add(M),this.bind(e,w[0],0,0,h,m,!0)}else this.bind(e,o.scene,b,x,h,m,!1);e.useProgram(g.prog);let S=this.pointer.inside?[(this.pointer.x-u)/y*2,-((this.pointer.y-l)/v)*2]:[0,0];if(ie(e,g,{uTime:r,uResolution:[h,m],uPointer:S,uRotation:a.anim.rotation,uScale:d/h,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:n,uColor:a.rgb,...H,...a.uniforms}),le(e),!k.length)return;let V=w[0];for(let M of k){let j=V===w[0]?w[1]:w[0];this.bind(e,j,0,0,h,m,!0),this.pass(e,M,V,a.effectParams[M],[h,m],r,n),V=j}this.bind(e,o.scene,b,x,h,m,!1),this.blit(e,V)}},we=(t,s)=>t?t+(s-t)*.1:s;var Pa=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],La=["idle","float","spin"],qe=["count","seed","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],Fa=["count","seed","shapes","palette"],Ve=640,_=Math.PI/180,Ge=()=>new Set([...Z.values()].map(t=>t.manifest.tag)),re=t=>Math.hypot(t[0],t[1],t[2]),We=(t,s)=>[t[0]-s[0],t[1]-s[1],t[2]-s[2]],Xe=t=>{let s=re(t)||1;return[t[0]/s,t[1]/s,t[2]/s]};function He(t){return()=>{t=t+1831565813|0;let s=Math.imul(t^t>>>15,1|t);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}var ce=class extends B{constructor(){super();this.yaw=0;this.pitch=0;this.bodies=[];this.ready=!1;this.time=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary||e.button!==0||this.drag)){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{let a=this.drag;if(!a||e.pointerId!==a.id)return;if(e.buttons===0)return this.onUp(e);let r=Math.max(8,e.timeStamp-a.t),n=(e.clientX-a.x)*.006,o=(e.clientY-a.y)*.006;this.yaw+=n,this.pitch=L(this.pitch+o,-60*_,60*_),this.vel=[n/r,o/r],this.drag={id:a.id,x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=e=>{let a=this.drag;!a||e.pointerId!==a.id&&e.type!=="lostpointercapture"||(this.drag=null,this.classList.remove("sd-dragging"),(C()||e.timeStamp-a.t>80)&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("lostpointercapture",this.onUp)}static get observedAttributes(){return[...B.observedAttributes,...qe]}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=Ge();[...this.children].some(a=>e.has(a.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,a,r){if(!qe.includes(e))return super.attributeChangedCallback(e,a,r);this.ready&&Fa.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof N)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let l of this.kids())l.remove();let e=Ge(),a=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(l=>l.startsWith("sd-")?l:"sd-"+l),r=(a.length?a:[...e]).filter(l=>e.has(l)),n=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??Pa,o=r.length?L(Math.round(R(this.getAttribute("count"),24)),0,120):0,i=He(R(this.getAttribute("seed"),1)),c=l=>l[Math.floor(i()*l.length)],f=()=>{for(;;){let l=[i()*2-1,i()*2-1,i()*2-1];if(re(l)<=1)return l}},p=[];for(let l=0;l<o;l++){let d=8*Math.round((40+100*i())/8),h=d/Ve,m=f(),b=-1/0;for(let x=0;x<8;x++){let y=f(),v=2;for(let P of p)v=Math.min(v,re(We(y,P.p))-h-P.r);v>b&&(b=v,m=y)}p.push({tag:c(r),p:m,r:h,size:d,color:c(n),anim:c(La),speed:.6+i()*.8,phase:i()*20})}let u=document.createDocumentFragment();for(let l of p){let d=document.createElement(l.tag);d.dataset.pos=l.p.map(h=>h.toFixed(2)).join(" "),d.setAttribute("size",l.size+"px"),d.setAttribute("color",l.color),d.setAttribute("animation",l.anim),d.setAttribute("speed",l.speed.toFixed(2)),d.setAttribute("phase",l.phase.toFixed(1)),u.append(d)}this.append(u),this.adopt()}adopt(){let e=He(R(this.getAttribute("seed"),1)*7919+17),a=this.kids(),r=a.map(n=>R((n.getAttribute("size")??"").replace("px",""),80));this.bodies=a.map((n,o)=>{let i=(n.dataset.pos??"").split(/\s+/).map(Number),c=i.length===3&&i.every(u=>!isNaN(u))?[i[0],i[1],i[2]]:Xe([e()-.5,e()-.5,e()-.5]).map(u=>u*e()),f=Xe([e()-.5,e()-.5,e()-.5]).map(u=>u*(.02+e()*.04)),p=[];for(let u=0;u<3;u++)p.push(.05+e()*.1,e()*2*Math.PI,.02+e()*.03);return{el:n,p:c,v:f,r:r[o]/Ve,tilt:D((e()-.5)*70*_,0,(e()-.5)*70*_),wob:p}})}step(e){var H;let a=this.width,r=this.height;if(!a||!r)return;let n=C(),o=this.cam(),i=Math.max(0,R(this.getAttribute("speed"),1)),c=n?0:L(R(this.getAttribute("drift"),.5),0,1),f=L(R(this.getAttribute("depth"),.5),0,1),p=L(R(this.getAttribute("focus"),0),-1,1),u=1.6/L(R(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),o.has("spin")&&!n&&(this.yaw+=e/1e3*(2*Math.PI/90)*i*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=L(this.pitch+this.vel[1]*e,-60*_,60*_);let g=Math.exp(-e/600);this.vel[0]*=g,this.vel[1]*=g}let l=o.has("pointer")&&this.pointer.inside;this.tilt[0]=T(this.tilt[0],l?(this.pointer.x/a*2-1)*12*_:0,e,150),this.tilt[1]=T(this.tilt[1],l?(this.pointer.y/r*2-1)*8*_:0,e,150);let d=this.yaw+this.tilt[0],h=this.pitch+this.tilt[1],m=Math.cos(d),b=Math.sin(d),x=Math.cos(h),y=Math.sin(h),v=a/2*.95,P=r/2*.95*(u-.6)/u;n||(this.time+=e/1e3);let q=this.bodies.filter(g=>g.el.scene===this);if(c>0)for(let g of q){for(let w=0;w<3;w++)g.p[w]+=g.v[w]*(e/1e3)*c;let k=re(g.p);if(k>1){let w=(g.p[0]*g.v[0]+g.p[1]*g.v[1]+g.p[2]*g.v[2])/k;if(w>0)for(let S=0;S<3;S++)g.v[S]-=2*w*g.p[S]/k;for(let S=0;S<3;S++)g.p[S]/=k}}this.hasAttribute("collide")&&this.collide(q);for(let g of q){let k=g.el.anim,w=g.wob,S=[g.p[0],g.p[1],g.p[2]];if(c>0)for(let z=0;z<3;z++)S[z]+=Math.sin(2*Math.PI*w[z*3]*this.time+w[z*3+1])*w[z*3+2]*c;let V=S[0]*m+S[2]*b,M=-S[0]*b+S[2]*m,j=S[1]*x-M*y,ne=S[1]*y+M*x,me=L(u/(u-ne),.3,3);k.offset[0]+=V*me*v,k.offset[1]-=j*me*P,k.scale*=me,k.z=ne,k.rotation=G(g.tilt,k.rotation);let Se=Math.min(24,f*Math.abs(ne-p)*14),fe=g.el.effectNames.filter(z=>z!=="defocus");Se>=.5?(g.el.effectNames=[...fe,"defocus"],((H=g.el.effectParams).defocus??(H.defocus={})).radius=Se):fe.length!==g.el.effectNames.length&&(g.el.effectNames=fe),k.state-=.75*f*Math.max(0,p-ne)}}collide(e){for(let a=0;a<4;a++)for(let r=0;r<e.length;r++)for(let n=r+1;n<e.length;n++){let o=e[r],i=e[n],c=We(i.p,o.p),f=re(c),p=o.r+i.r;if(f>=p)continue;let u=f<1e-6?[1,0,0]:[c[0]/f,c[1]/f,c[2]/f];f=f||0;let l=1/(o.r*o.r*o.r),d=1/(i.r*i.r*i.r),h=l+d;for(let v=0;v<3;v++)o.p[v]-=u[v]*(p-f)*(l/h),i.p[v]+=u[v]*(p-f)*(d/h);let m=o.v,b=i.v,x=(b[0]-m[0])*u[0]+(b[1]-m[1])*u[1]+(b[2]-m[2])*u[2];if(x>=0)continue;let y=-2*x/h;for(let v=0;v<3;v++)o.v[v]-=u[v]*y*l,i.v[v]+=u[v]*y*d}}};var Ye=Math.PI/180,Qe={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*Ye,Math.sin(t*2*Math.PI/6)*8*Ye,0]})};var $e={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var Ze={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Je={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var Ke={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var ja=[Qe,$e,Ze,Je,Ke];for(let t of ja)J.set(t.meta.name,t);var et={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var tt=`uniform float threshold;
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
`;var at={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var rt=`uniform float angle;
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
`;var nt={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ot=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var st={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var it=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var lt={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var ct=`uniform float levels;
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
`;var mt={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var ft=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var pt={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var dt=`uniform float size;
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
`;var ut={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var ht=`uniform float width;
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
`;var gt={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var bt=`uniform float amount;
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
`;var vt={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var xt=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var yt={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var wt=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var Mt={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var St=`uniform float amplitude;
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
`;var kt={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var Rt=`uniform float radius;

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
`;var sr=[{manifest:et,frag:tt},{manifest:at,frag:rt},{manifest:nt,frag:ot},{manifest:st,frag:it},{manifest:lt,frag:ct},{manifest:mt,frag:ft},{manifest:pt,frag:dt},{manifest:ut,frag:ht},{manifest:gt,frag:bt},{manifest:vt,frag:xt},{manifest:yt,frag:wt},{manifest:Mt,frag:St},{manifest:kt,frag:Rt}],ir={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of sr)t.manifest.params.some(s=>s.name==="mix")||t.manifest.params.push(ir),I.set(t.manifest.name,t);var Et={name:"glass",description:"Tinted glass with a fresnel rim and one highlight. The original look, and the dark default.",params:[]};var Tt=`// Glassy: tinted body, fresnel rim, one specular, translucent. The dark look of v1; light is pale tinted glass with a darker rim.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
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
vec3 sdEdge() { return uColor; }
`;var At={name:"matte",description:"A soft opaque surface: half-lambert diffuse, a sky ambient, one broad highlight. Reads well on white.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"softness",type:"float",default:.5,min:0,max:1,step:.01,label:"Terminator softness"}]};var Ct=`uniform float light;
uniform float softness;

// Matte: half-lambert diffuse with a firm terminator, a sky ambient from above, one broad soft highlight, opaque.
// Dark: a lifted floor and a faint rim keep the silhouette off black. Light: the edge darkens for definition on white.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float wrap = pow(max(dot(n, l) * 0.5 + 0.5, 0.0), mix(2.4, 1.2, softness));
  float sky = sdView(n).y * 0.5 + 0.5;
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 14.0) * 0.16;
  vec3 col = uColor * (mix(0.3, 0.42, uTheme) + 0.62 * wrap) * (0.9 + 0.1 * sky) + vec3(0.05, 0.06, 0.08) * sky + vec3(spec);
  col *= 1.0 - 0.3 * fres * uTheme;
  col += uColor * fres * rim * 0.35 * (1.0 - uTheme);
  col *= 0.85 + 0.3 * uState;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return uColor * mix(1.0, 0.7, uTheme); }
`;var Pt={name:"cel",description:"Flat bands of light with a hard highlight and an ink rim. The cartoon look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"bands",type:"float",default:3,min:2,max:5,step:1,label:"Light bands"},{name:"outline",type:"float",default:.8,min:0,max:1,step:.01,label:"Outline (0 removes it)"}]};var Lt=`uniform float light;
uniform float bands;
uniform float outline;

// Cel: diffuse quantized into bands, a hard highlight dot, and an ink outline (a rim at grazing angles plus the edge on a miss) that \`outline\` fades to nothing.
// Dark: the ink is a lighter tint of the color. Light: the ink is a third of the color.
vec3 inkColor() { return mix(min(uColor * 1.3 + 0.1, vec3(1.0)), uColor * 0.32, uTheme); }
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float diff = max(dot(n, l), 0.0);
  float nb = clamp(floor(bands + 0.5), 2.0, 5.0);
  float band = min(floor(diff * nb), nb - 1.0) / (nb - 1.0);
  float lvl = mix(0.5, 1.0, band);
  float dot_ = step(0.985, max(dot(reflect(-l, n), -rd), 0.0));
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 col = uColor * lvl * (0.95 + 0.25 * uState) + vec3(1.0) * dot_ * 0.5;
  col = mix(col, inkColor(), smoothstep(0.45, 0.6, fres) * outline);
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return mix(uColor, inkColor(), outline); }
`;var Ft={name:"clay",description:"A warm putty surface with soft light, a little subsurface glow and darker creases. The clay render look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"warmth",type:"float",default:.5,min:0,max:1,step:.01,label:"Subsurface warmth"}]};var jt=`uniform float light;
uniform float warmth;

// Clay: matte with the color pulled toward a warm putty, a warm subsurface term at the back and on thin edges,
// and a two-sample occlusion along the normal that darkens creases.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float wrap = pow(max(dot(n, l) * 0.5 + 0.5, 0.0), 1.4);
  float back = max(dot(n, -l), 0.0);
  float thin = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
  float ao = 0.5 * clamp(map(p + n * 0.08) / 0.08, 0.0, 1.0) + 0.5 * clamp(map(p + n * 0.2) / 0.2, 0.0, 1.0);
  vec3 base = mix(uColor, vec3(0.9, 0.82, 0.72), 0.25);
  vec3 warm = vec3(1.0, 0.55, 0.35) * warmth;
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 8.0) * 0.08;
  vec3 col = base * (mix(0.28, 0.38, uTheme) + 0.6 * wrap) + warm * (0.12 * back + 0.08 * thin) + vec3(spec);
  col *= 0.6 + 0.4 * ao;
  col *= 0.85 + 0.3 * uState;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return mix(uColor, vec3(0.9, 0.82, 0.72), 0.25); }
`;var zt={name:"metal",description:"A polished metal that reflects a studio gradient with a horizon stripe, tinted by the color.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"roughness",type:"float",default:.25,min:0,max:1,step:.01,label:"Roughness"}]};var Ot=`uniform float light;
uniform float roughness;

// Metal: the reflection vector samples a studio environment (a vertical gradient with a horizon stripe) tinted by the color,
// plus a tight highlight and fresnel brightening. The environment is dark in the dark theme and pale in the light one.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  vec3 r = reflect(rd, n);
  float up = clamp(sdView(r).y * 0.5 + 0.5, 0.0, 1.0);
  vec3 envDark = mix(vec3(0.1, 0.11, 0.14), vec3(0.85, 0.9, 1.0), up);
  vec3 envLight = mix(vec3(0.45, 0.46, 0.5), vec3(1.0), up);
  vec3 env = mix(envDark, envLight, uTheme);
  float stripe = smoothstep(0.3, 0.36, up) * (1.0 - smoothstep(0.5, 0.56, up));
  env += stripe * 0.35 * (1.0 - roughness);
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), mix(90.0, 6.0, roughness)) * (1.0 - 0.5 * roughness);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 col = uColor * env * (0.8 + 0.4 * uState) + vec3(spec) + uColor * fres * 0.3;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return uColor; }
`;var vr=[{manifest:Et,frag:Tt},{manifest:At,frag:Ct},{manifest:Pt,frag:Lt},{manifest:Ft,frag:jt},{manifest:zt,frag:Ot}];for(let t of vr)F.set(t.manifest.name,t);var Dt=new WeakMap,It=20*Math.PI/180,Ut={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let n=Math.max(1,Math.round(s/16));for(let o of t.objects){if(!o.rect)continue;let i=Dt.get(o)??Dt.set(o,{rx:0,ry:0,vx:0,vy:0}).get(o),c=0,f=0;if(e.inside){let p=o.rect.x+o.rect.width/2+o.anim.offset[0],u=o.rect.y+o.rect.height/2+o.anim.offset[1],l=(e.x-p)/Math.max(t.width,1),d=(e.y-u)/Math.max(t.height,1);f=Math.max(-1,Math.min(1,l*2))*It,c=Math.max(-1,Math.min(1,d*2))*It}for(let p=0;p<n;p++)i.vx=(i.vx+(c-i.rx)*.08)*.8,i.rx+=i.vx,i.vy=(i.vy+(f-i.ry)*.08)*.8,i.ry+=i.vy;o.anim.rotation=G(D(i.rx,i.ry,0),o.anim.rotation)}}};var Nt=new WeakMap,_t={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let a of t.objects){if(!a.rect)continue;let r=a.rect.x+a.rect.width/2+a.anim.offset[0],n=a.rect.y+a.rect.height/2+a.anim.offset[1],o=e.inside&&Math.abs(e.x-r)<=a.rect.width/2&&Math.abs(e.y-n)<=a.rect.height/2,i=T(Nt.get(a)??0,o?1:0,s,160);Nt.set(a,i),a.anim.scale*=1+.08*i,a.anim.state+=i*(1-a.stateValue)}}};var Bt=new WeakMap,Me=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],xr=t=>t*t*(3-2*t),qt={meta:{name:"gravity",description:"One object is the center. The others orbit it on rings, farther rings turning slower like real orbits, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(l=>l.rect),a=e.find(l=>l.getAttribute("gravity")==="center")??null,r=R(t.getAttribute("gravity-strength"),.6),n=a?Me(a):null,o=C(),i=l=>{let d=l.getAttribute("gravity");return!n||l===a||d==="none"?"none":d==="fall"?"fall":"orbit"},c=e.filter(l=>i(l)==="orbit").map(l=>{let d=Me(l);return{o:l,d:Math.hypot(d[0]-n[0],d[1]-n[1])}}).sort((l,d)=>l.d-d.d),f=c.length?Math.max(c[0].d,(a.rect.width+c[0].o.rect.width)/4+24):0,p=c.length?Math.max(c[c.length-1].d,f):0,u=l=>{let d=c.findIndex(m=>m.o===l),h=c.length;return h>1?f+(p-f)*d/(h-1):f};for(let l of e){let d=i(l),h=d!=="none",m=Bt.get(l);if(!m&&!h)continue;m||Bt.set(l,m={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let b=[0,0],x=0;if(h){let y=Me(l);if(m.center!==a&&(m.from=[m.offset[0],m.offset[1]],m.k=0,m.center=a,m.angle=Math.atan2(y[1]-n[1],y[0]-n[0]),m.r=Math.hypot(y[0]-n[0],y[1]-n[1])),d==="fall"){let v=R(l.getAttribute("gravity-gap"),24)+(a.rect.width+l.rect.width)/4;o||(m.r+=(v-m.r)*(1-Math.exp(-s/700))*(.3+r))}else m.r=o||m.k===0?u(l):T(m.r,u(l),s,300),o||(m.angle+=s/1e3*.3*r*Math.pow(p/m.r,1.5)),x=Math.sin(m.angle)*(m.r/p);b=[n[0]+Math.cos(m.angle)*m.r-y[0],n[1]+Math.sin(m.angle)*m.r-y[1]]}else m.center&&(m.from=[m.offset[0],m.offset[1]],m.k=0,m.center=null);if(m.k<1){m.k=o?1:Math.min(1,m.k+s/800);let y=xr(m.k);b=[O(m.from[0],b[0],y),O(m.from[1],b[1],y)]}m.offset=b,l.anim.offset[0]+=b[0],l.anim.offset[1]+=b[1],l.anim.z+=x,l.anim.scale*=1+.06*x}}};var Vt=new WeakMap,Gt={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,s,e){let a=A(t,"repel","radius"),r=A(t,"repel","strength"),n=Math.max(1,Math.round(s/16));for(let o of t.objects){if(!o.rect)continue;let i=Vt.get(o)??Vt.set(o,{x:0,y:0,vx:0,vy:0}).get(o),c=0,f=0;if(e.inside){let p=o.rect.x+o.rect.width/2+o.anim.offset[0]-e.x,u=o.rect.y+o.rect.height/2+o.anim.offset[1]-e.y,l=Math.hypot(p,u);if(l<a){let d=(1-l/a)*a*.5*r;c=l>.001?p/l*d:0,f=l>.001?u/l*d:-d}}for(let p=0;p<n;p++)i.vx=(i.vx+(c-i.x)*.08)*.8,i.x+=i.vx,i.vy=(i.vy+(f-i.y)*.08)*.8,i.y+=i.vy;o.anim.offset[0]+=i.x,o.anim.offset[1]+=i.y}}};var Wt=new WeakMap,Xt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,s,e){let a=A(t,"magnet","reach"),r=A(t,"magnet","strength");for(let n of t.objects){if(!n.rect)continue;let o=Wt.get(n)??[0,0],i=0,c=0;if(e.inside){i=(e.x-n.rect.x-n.rect.width/2-n.anim.offset[0])*r,c=(e.y-n.rect.y-n.rect.height/2-n.anim.offset[1])*r;let p=Math.hypot(i,c);p>a&&(i*=a/p,c*=a/p)}let f=[T(o[0],i,s,250),T(o[1],c,s,250)];Wt.set(n,f),n.anim.offset[0]+=f[0],n.anim.offset[1]+=f[1]}}};var Ht=new WeakMap,Yt={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,s){let e=A(t,"collide","gap"),a=[...t.objects].filter(c=>c.rect),r=a.map(c=>[c.rect.x+c.rect.width/2+c.anim.offset[0],c.rect.y+c.rect.height/2+c.anim.offset[1]]),n=r.map(c=>[...c]),o=a.map(c=>c.getAttribute("gravity")==="center"?0:1);for(let c=0;c<4;c++)for(let f=0;f<a.length;f++)for(let p=f+1;p<a.length;p++){let u=n[p][0]-n[f][0],l=n[p][1]-n[f][1],d=Math.hypot(u,l),h=(a[f].rect.width+a[p].rect.width)/2+e,m=o[f]+o[p];if(d>=h||!m)continue;d<.001?(u=1,l=0):(u/=d,l/=d);let b=(h-d)*o[f]/m,x=(h-d)*o[p]/m;n[f][0]-=u*b,n[f][1]-=l*b,n[p][0]+=u*x,n[p][1]+=l*x}let i=C()?1:1-Math.exp(-s/120);a.forEach((c,f)=>{let p=Ht.get(c)??[0,0],u=[p[0]+(n[f][0]-r[f][0]-p[0])*i,p[1]+(n[f][1]-r[f][1]-p[1])*i];Ht.set(c,u),c.anim.offset[0]+=u[0],c.anim.offset[1]+=u[1]})}};var Qt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let s=t.getBoundingClientRect(),e=innerHeight,a=Math.min(1,Math.max(0,(e-s.top)/Math.max(e+s.height,1))),r=D(0,(a-.5)*A(t,"scroll","turns")*2*Math.PI,0);for(let n of t.objects)n.anim.rotation=G(r,n.anim.rotation)}};var yr=[Ut,_t,qt,Gt,Xt,Yt,Qt];for(let t of yr)U.set(t.meta.name,t);var $t={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Zt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var Jt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Kt=`uniform float thickness;
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
`;var ea={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var ta=`uniform float facets;
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
`;var aa={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var ra=`uniform float turns;
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
`;var na={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var oa=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var sa={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var ia=`uniform float radius;
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
`;var la={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var ca=`uniform float twist;
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
`;var ma={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var fa=`uniform float sides;
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
`;var pa={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var da=`uniform float span;
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
`;var ua={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var ha=`uniform float points;
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
`;var ga={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var ba=`uniform float turns;
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
`;var va={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var xa=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",B);E($t,Zt);E(Jt,Kt);E(ea,ta);E(aa,ra);E(na,oa);E(sa,ia);E(la,ca);E(ma,fa);E(pa,da);E(ua,ha);E(ga,ba);E(va,xa);customElements.get("sd-universe")||customElements.define("sd-universe",ce);export{N as SdObject,B as SdScene,ce as SdUniverse,E as defineObject,Ue as registry};
//# sourceMappingURL=solids.js.map
