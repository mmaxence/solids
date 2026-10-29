var jt=Object.defineProperty;var Lt=(t,i)=>{for(var e in i)jt(t,e,{get:i[e],enumerable:!0})};var K=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var x=(t,i,e)=>t+(i-t)*e,M=(t,i,e,a)=>t+(i-t)*(1-Math.exp(-e/Math.max(a,1))),te=new Float32Array([1,0,0,0,1,0,0,0,1]);function k(t,i,e){let a=Math.cos(t),r=Math.sin(t),s=Math.cos(i),o=Math.sin(i),n=Math.cos(e),c=Math.sin(e);return new Float32Array([s*n,s*c,-o,r*o*n-a*c,r*o*c+a*n,r*s,a*o*n+r*c,a*o*c-r*n,a*s])}function _(t,i){let e=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)e[a*3+r]=t[r]*i[a*3]+t[3+r]*i[a*3+1]+t[6+r]*i[a*3+2];return e}var ee=null,F=new Map;function D(t,i="srgb"){if(t=t.trim(),i==="srgb"){let o=t.match(/^#([0-9a-f]{3})$/i);if(o)return[...o[1]].map(n=>parseInt(n+n,16)/255);if(o=t.match(/^#([0-9a-f]{6})$/i),o)return[0,2,4].map(n=>parseInt(o[1].slice(n,n+2),16)/255)}let e=i+t;if(F.has(e))return F.get(e);let a=ee??(ee=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=t;let r=a.fillStyle;a.fillStyle="#fff",a.fillStyle=t;let s=null;if(r===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let o=a.getImageData(0,0,1,1,{colorSpace:i}).data;s=[o[0]/255,o[1]/255,o[2]/255]}return F.size>256&&F.clear(),F.set(e,s),s}var j=null;function ae(){if(j!==null)return j;try{let t=D("#ff0000","display-p3");j=!!t&&t[1]>.05}catch{j=!1}return j}var re=`#version 300 es
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
`;var ne=`#version 300 es
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
  o.rgb = min(o.rgb, vec3(o.a));
  fragColor = o;
}
`;var W=new WeakMap;function se(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(X(i),{gl:i,colorSpace:i.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function X(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=ae()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function oe(t,i,e){let a=t.createShader(i);if(t.shaderSource(a,e),t.compileShader(a),!t.getShaderParameter(a,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(a)||"shader compile failed");return a}function q(t,i,e="object"){let a=W.get(t);a||W.set(t,a=new Map);let r=e[0]+i,s=a.get(r);if(s)return s;let o=(e==="object"?re:ne)+`
`+i,n=t.createProgram();if(t.attachShader(n,oe(t,t.VERTEX_SHADER,K)),t.attachShader(n,oe(t,t.FRAGMENT_SHADER,o)),t.linkProgram(n),!t.getProgramParameter(n,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(n)||"link failed");let c=new Map,f=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let p=0;p<f;p++){let m=t.getActiveUniform(n,p);c.set(m.name,t.getUniformLocation(n,m.name))}let l={prog:n,loc:c};return a.set(r,l),l}function ie(t){W.delete(t)}function N(t,i,e){for(let[a,r]of Object.entries(e)){let s=i.loc.get(a);s!==void 0&&(typeof r=="number"?t.uniform1f(s,r):r.length===1?t.uniform1i(s,r[0]):r.length===2?t.uniform2f(s,r[0],r[1]):r.length===3?t.uniform3f(s,r[0],r[1],r[2]):r.length===4?t.uniform4f(s,r[0],r[1],r[2],r[3]):r.length===9&&t.uniformMatrix3fv(s,!1,r))}}function B(t){t.drawArrays(t.TRIANGLES,0,3)}function A(t,i,e){let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let r=t.createFramebuffer(),s={fb:r,tex:a,w:0,h:0};return R(t,s,i,e),t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0),s}function R(t,i,e,a){e=Math.max(1,e),a=Math.max(1,a),!(i.w===e&&i.h===a)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,a,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=a)}var pe={};Lt(pe,{animations:()=>L,effectAttrs:()=>O,effectParam:()=>z,effects:()=>v,interactionAttrs:()=>Q,interactionParam:()=>Y,interactionValue:()=>g,interactions:()=>w,kebab:()=>C,num:()=>U,objects:()=>H});var H=new Map,L=new Map,v=new Map,w=new Map,le=()=>[...v.values()].map(t=>t.manifest),ce=()=>[...w.values()].map(t=>t.meta),me=t=>t.flatMap(i=>i.params.map(e=>`${i.name}-${C(e.name)}`)),O=()=>me(le()),Q=()=>me(ce()),C=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function fe(t,i,e,a){var r;for(let s of t){let o=s.name+"-";if(!i.startsWith(o))continue;let n=s.params.find(c=>C(c.name)===i.slice(o.length));if(n)return(a[r=s.name]??(a[r]={}))[n.name]=U(e,n.default),!0}return!1}var z=(t,i,e)=>fe(le(),t,i,e),Y=(t,i,e)=>fe(ce(),t,i,e),g=(t,i,e)=>t.interactionParams[i]?.[e]??w.get(i).meta.params.find(a=>a.name===e).default,U=(t,i)=>{if(t==null||t==="")return i;let e=Number(t);return isNaN(e)?i:e};var It={off:0,idle:.25,busy:.6,active:1},_t=["animation","speed","effect","state","color","size","gravity","gravity-gap"],ue=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),P=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(te),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=de(a.default,a.type)??0}static get observedAttributes(){return[..._t,...this.manifest.uniforms.map(e=>C(e.name)),...O()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene"),a=this.shadowRoot.querySelector("sd-scene");if(e)a&&(a.detach(this),a.remove()),e.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,a,r){let s=r??"";switch(e){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let n=Number(s);this.speedValue=s===""||isNaN(n)?1:n;return}case"state":this.stateTarget=It[s]??.25;return;case"color":this.recolor(s||"#9bd1ff");return;case"size":this.style.setProperty("--sd-size",s);return;case"gravity":case"gravity-gap":return}if(z(e,r,this.effectParams))return;let o=this.manifest.uniforms.find(n=>C(n.name)===e);if(o){let n=de(r===null||r===""?o.default:r,o.type);n!==null&&(this.uniforms[o.name]=n)}}recolor(e=this.colorSrc){let a=e?D(e,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=e)}update(e){this.stateValue=M(this.stateValue,this.stateTarget,e,150),S()||(this.phase+=e/1e3*this.speedValue);let a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let o=L.get(s)?.fn(this.phase,this.speedValue,this);if(o){if(o.rotation)for(let n=0;n<3;n++)a.rotation[n]+=o.rotation[n];o.offset&&(a.offset[0]+=o.offset[0],a.offset[1]+=o.offset[1]),o.scale!==void 0&&(a.scale*=o.scale),o.state!==void 0&&(a.state+=o.state),o.uniforms&&Object.assign(this.uniforms,o.uniforms)}}let r=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),o=this.prevPose;r={rotation:[0,1,2].map(n=>Dt(o.rotation[n],a.rotation[n],s)),offset:[x(o.offset[0],a.offset[0],s),x(o.offset[1],a.offset[1],s)],scale:x(o.scale,a.scale,s),state:x(o.state,a.state,s)}}this.pose=r,this.anim.rotation=k(r.rotation[0],r.rotation[1],r.rotation[2]),this.anim.offset=[r.offset[0],r.offset[1]],this.anim.scale=r.scale,this.anim.state=r.state,this.anim.z=0}};function Dt(t,i,e){let a=((i-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+a*e}function de(t,i){if(i==="float"){let a=typeof t=="number"?t:Number(t);return isNaN(a)?null:a}if(i==="color")return Array.isArray(t)?t:D(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(a=>!isNaN(a))?e:null}var $=null;function S(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:($??($=matchMedia("(prefers-reduced-motion: reduce)")),$.matches)}function qt(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,ue(e))||Object.defineProperty(t,ue(e),{get(){return this.getAttribute(e)},set(a){a==null?this.removeAttribute(e):this.setAttribute(e,String(a))}})}function h(t,i){var a;if(!t?.tag||customElements.get(t.tag))return;H.set(t.name,{manifest:t,frag:i});let e=(a=class extends P{},a.manifest=t,a.frag=i,a);qt(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var he=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var G=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let a=this.getBoundingClientRect();this.pointer={x:e.clientX-a.left,y:e.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e),this.last&&(this.fps=Z(this.fps,1e3/Math.max(e-this.last,1)));let a=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,a),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...O(),...Q()]}connectedCallback(){if(!this.gl){let e=se(this.canvas);if(this.gl=e?.gl??null,this.colorSpace=e?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let a of this.objects)a.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",a=>{a.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{ie(this.gl),this.fbos=null,this.query=null,X(this.gl);for(let a of this.objects)a.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof P&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,a,r){let s=r??"";if(e==="interaction")this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>w.get(o)?.setup?.(this));else if(e==="effect")this.effectNames=s.split(/\s+/).filter(Boolean);else if(e==="theme")this.theme=s||"auto";else if(e==="dpr"){let o=Number(s);this.maxDpr=s&&!isNaN(o)&&o>0?o:2,this.measure()}else e==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):z(e,r,this.effectParams)||Y(e,r,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.objects=new Set([...this.objects].sort((a,r)=>a.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let a=Math.round(e.width*this.pixelRatio),r=Math.round(e.height*this.pixelRatio);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let s of this.objects){let o=s.getBoundingClientRect();s.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,a){let r=this.gl,s=this.canvas.width,o=this.canvas.height;if(!r||s===0||o===0)return;let n=performance.now(),c=this.gpuOn?this.gpuBegin(r):null;try{this.render(r,s,o,e,a)}finally{c&&r.endQuery(c.TIME_ELAPSED_EXT),this.frameTime=Z(this.frameTime,performance.now()-n)}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let a=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!a)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let r=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(a.GPU_DISJOINT_EXT)&&Number.isFinite(r)&&(this.gpuMs=Z(this.gpuMs??0,r/1e6))}return e.beginQuery(a.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),a}render(e,a,r,s,o){S()||(this.clock=s),s=this.clock;for(let m of this.objects)m.update(o);for(let m of this.interactionNames)w.get(m)?.frame(this,o,this.pointer);let n=this.fbos??(this.fbos={scene:A(e,a,r),a:A(e,a,r),b:A(e,a,r),oa:A(e,1,1),ob:A(e,1,1)});R(e,n.scene,a,r),R(e,n.a,a,r),R(e,n.b,a,r);let c=this.themeValue;this.bind(e,n.scene,0,0,a,r,!0);let f=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,u)=>m.anim.z-u.anim.z);for(let m of f)this.draw(e,m,s,c,n);let l=n.scene,p=this.effectNames.filter(m=>v.has(m));for(let m of p){let u=l===n.a?n.b:n.a;this.bind(e,u,0,0,a,r,!0),this.pass(e,m,l,this.effectParams[m],[a,r],s,c),l=u}this.bind(e,null,0,0,a,r,!0),this.blit(e,l)}bind(e,a,r,s,o,n,c){e.bindFramebuffer(e.FRAMEBUFFER,a?.fb??null),e.viewport(r,s,o,n),e.scissor(r,s,o,n),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,a){let r=q(e,he,"effect");e.useProgram(r.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex),N(e,r,{uScene:[0]}),B(e)}pass(e,a,r,s,o,n,c){let f=v.get(a),l;try{l=q(e,f.frag,"effect")}catch(m){console.error(`[solids] effect "${a}" shader failed:
${m.message}`),this.blit(e,r);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex);let p={};for(let m of f.manifest.params)p[m.name]=m.default;N(e,l,{uScene:[0],uResolution:o,uTime:n,uTheme:c,uMix:s?.mix??1,...p,...s}),B(e)}draw(e,a,r,s,o){let n=a.rect,c=a.manifest.bleed??1.5,f=n.x+n.width/2+a.anim.offset[0],l=n.y+n.height/2+a.anim.offset[1],p=n.width*c,m=n.height*c,u=Math.round((f-p/2)*this.pixelRatio),y=Math.round((this.height-l-m/2)*this.pixelRatio),d=Math.round(p*this.pixelRatio),b=Math.round(m*this.pixelRatio);if(d<=0||b<=0)return;let E;try{E=q(e,a.frag)}catch(T){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${T.message}`);return}let V=a.effectNames.filter(T=>v.has(T));V.length?(R(e,o.oa,d,b),R(e,o.ob,d,b),this.bind(e,o.oa,0,0,d,b,!0)):this.bind(e,o.scene,u,y,d,b,!1),e.useProgram(E.prog);let Ft=this.pointer.inside?[(this.pointer.x-f)/p*2,-((this.pointer.y-l)/m)*2]:[0,0];if(N(e,E,{uTime:r,uResolution:[d,b],uPointer:Ft,uRotation:a.anim.rotation,uScale:a.anim.scale/c,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:s,uColor:a.rgb,...a.uniforms}),B(e),!V.length)return;let I=o.oa;for(let T of V){let J=I===o.oa?o.ob:o.oa;this.bind(e,J,0,0,d,b,!0),this.pass(e,T,I,a.effectParams[T],[d,b],r,s),I=J}this.bind(e,o.scene,u,y,d,b,!1),this.blit(e,I)}},Z=(t,i)=>t?t+(i-t)*.1:i;var be=Math.PI/180,ge={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*be,Math.sin(t*2*Math.PI/6)*8*be,0]})};var ye={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var xe={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ve={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var we={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Bt=[ge,ye,xe,ve,we];for(let t of Bt)L.set(t.meta.name,t);var Me={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var Re=`uniform float threshold;
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
`;var Se={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Ee=`uniform float angle;
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
`;var Te={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ke=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Ae={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Ce=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var Pe={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Fe=`uniform float levels;
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
`;var je={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var Le=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var Oe={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var ze=`uniform float size;
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
`;var Ue={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var Ie=`uniform float width;
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
`;var _e={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var De=`uniform float amount;
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
`;var qe={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var Ne=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var Be={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var Ge=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var Ve={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var We=`uniform float amplitude;
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
`;var ua=[{manifest:Me,frag:Re},{manifest:Se,frag:Ee},{manifest:Te,frag:ke},{manifest:Ae,frag:Ce},{manifest:Pe,frag:Fe},{manifest:je,frag:Le},{manifest:Oe,frag:ze},{manifest:Ue,frag:Ie},{manifest:_e,frag:De},{manifest:qe,frag:Ne},{manifest:Be,frag:Ge},{manifest:Ve,frag:We}],da={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of ua)t.manifest.params.some(i=>i.name==="mix")||t.manifest.params.push(da),v.set(t.manifest.name,t);var Xe=new WeakMap,He=20*Math.PI/180,Qe={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,i,e){let s=Math.max(1,Math.round(i/16));for(let o of t.objects){if(!o.rect)continue;let n=Xe.get(o)??Xe.set(o,{rx:0,ry:0,vx:0,vy:0}).get(o),c=0,f=0;if(e.inside){let l=o.rect.x+o.rect.width/2+o.anim.offset[0],p=o.rect.y+o.rect.height/2+o.anim.offset[1],m=(e.x-l)/Math.max(t.width,1),u=(e.y-p)/Math.max(t.height,1);f=Math.max(-1,Math.min(1,m*2))*He,c=Math.max(-1,Math.min(1,u*2))*He}for(let l=0;l<s;l++)n.vx=(n.vx+(c-n.rx)*.08)*.8,n.rx+=n.vx,n.vy=(n.vy+(f-n.ry)*.08)*.8,n.ry+=n.vy;o.anim.rotation=_(k(n.rx,n.ry,0),o.anim.rotation)}}};var Ye=new WeakMap,$e={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,i,e){for(let a of t.objects){if(!a.rect)continue;let r=a.rect.x+a.rect.width/2+a.anim.offset[0],s=a.rect.y+a.rect.height/2+a.anim.offset[1],o=e.inside&&Math.abs(e.x-r)<=a.rect.width/2&&Math.abs(e.y-s)<=a.rect.height/2,n=M(Ye.get(a)??0,o?1:0,i,160);Ye.set(a,n),a.anim.scale*=1+.08*n,a.anim.state+=n*(1-a.stateValue)}}};var Ze=new WeakMap,Je=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],ha=t=>t*t*(3-2*t),Ke={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,i){let e=[...t.objects].filter(n=>n.rect),a=e.find(n=>n.getAttribute("gravity")==="center")??null,r=U(t.getAttribute("gravity-strength"),.6),s=a?Je(a):null,o=S();for(let n of e){let c=n.getAttribute("gravity"),f=!!s&&n!==a&&c!=="none",l=Ze.get(n);if(!l&&!f)continue;l||Ze.set(n,l={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let p=[0,0],m=0;if(f){let u=Je(n);if(l.center!==a&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=a,l.angle=Math.atan2(u[1]-s[1],u[0]-s[0]),l.r=Math.hypot(u[0]-s[0],u[1]-s[1])),c==="fall"){let y=U(n.getAttribute("gravity-gap"),24)+(a.rect.width+n.rect.width)/4;o||(l.r+=(y-l.r)*(1-Math.exp(-i/700))*(.3+r))}else o||(l.angle+=i/1e3*.25*r),l.r=Math.hypot(u[0]-s[0],u[1]-s[1]),m=Math.sin(l.angle);p=[s[0]+Math.cos(l.angle)*l.r-u[0],s[1]+Math.sin(l.angle)*l.r-u[1]]}else l.center&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=null);if(l.k<1){l.k=Math.min(1,l.k+i/800);let u=ha(l.k);p=[x(l.from[0],p[0],u),x(l.from[1],p[1],u)]}l.offset=p,n.anim.offset[0]+=p[0],n.anim.offset[1]+=p[1],n.anim.z=m,n.anim.scale*=1+.06*m}}};var et=new WeakMap,tt={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,i,e){let a=g(t,"repel","radius"),r=g(t,"repel","strength"),s=Math.max(1,Math.round(i/16));for(let o of t.objects){if(!o.rect)continue;let n=et.get(o)??et.set(o,{x:0,y:0,vx:0,vy:0}).get(o),c=0,f=0;if(e.inside){let l=o.rect.x+o.rect.width/2+o.anim.offset[0]-e.x,p=o.rect.y+o.rect.height/2+o.anim.offset[1]-e.y,m=Math.hypot(l,p);if(m<a){let u=(1-m/a)*a*.5*r;c=m>.001?l/m*u:0,f=m>.001?p/m*u:-u}}for(let l=0;l<s;l++)n.vx=(n.vx+(c-n.x)*.08)*.8,n.x+=n.vx,n.vy=(n.vy+(f-n.y)*.08)*.8,n.y+=n.vy;o.anim.offset[0]+=n.x,o.anim.offset[1]+=n.y}}};var at=new WeakMap,rt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,i,e){let a=g(t,"magnet","reach"),r=g(t,"magnet","strength");for(let s of t.objects){if(!s.rect)continue;let o=at.get(s)??[0,0],n=0,c=0;if(e.inside){n=(e.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*r,c=(e.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*r;let l=Math.hypot(n,c);l>a&&(n*=a/l,c*=a/l)}let f=[M(o[0],n,i,250),M(o[1],c,i,250)];at.set(s,f),s.anim.offset[0]+=f[0],s.anim.offset[1]+=f[1]}}};var nt=new WeakMap,ot={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,i){let e=g(t,"collide","gap"),a=[...t.objects].filter(c=>c.rect),r=a.map(c=>[c.rect.x+c.rect.width/2+c.anim.offset[0],c.rect.y+c.rect.height/2+c.anim.offset[1]]),s=r.map(c=>[...c]),o=a.map(c=>c.getAttribute("gravity")==="center"?0:1);for(let c=0;c<4;c++)for(let f=0;f<a.length;f++)for(let l=f+1;l<a.length;l++){let p=s[l][0]-s[f][0],m=s[l][1]-s[f][1],u=Math.hypot(p,m),y=(a[f].rect.width+a[l].rect.width)/2+e,d=o[f]+o[l];if(u>=y||!d)continue;u<.001?(p=1,m=0):(p/=u,m/=u);let b=(y-u)*o[f]/d,E=(y-u)*o[l]/d;s[f][0]-=p*b,s[f][1]-=m*b,s[l][0]+=p*E,s[l][1]+=m*E}let n=S()?1:1-Math.exp(-i/120);a.forEach((c,f)=>{let l=nt.get(c)??[0,0],p=[l[0]+(s[f][0]-r[f][0]-l[0])*n,l[1]+(s[f][1]-r[f][1]-l[1])*n];nt.set(c,p),c.anim.offset[0]+=p[0],c.anim.offset[1]+=p[1]})}};var st={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let i=t.getBoundingClientRect(),e=innerHeight,a=Math.min(1,Math.max(0,(e-i.top)/Math.max(e+i.height,1))),r=k(0,(a-.5)*g(t,"scroll","turns")*2*Math.PI,0);for(let s of t.objects)s.anim.rotation=_(r,s.anim.rotation)}};var ba=[Qe,$e,Ke,tt,rt,ot,st];for(let t of ba)w.set(t.meta.name,t);var it={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var lt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var ct={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var mt=`uniform float thickness;
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
`;var ft={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var pt=`uniform float facets;
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
`;var ut={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var dt=`uniform float turns;
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
`;var ht={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var bt=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var gt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var yt=`uniform float radius;
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
`;var xt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var vt=`uniform float twist;
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
`;var wt={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var Mt=`uniform float sides;
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
`;var Rt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var St=`uniform float span;
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
`;var Et={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var Tt=`uniform float points;
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
`;var kt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var At=`uniform float turns;
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
`;var Ct={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var Pt=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",G);h(it,lt);h(ct,mt);h(ft,pt);h(ut,dt);h(ht,bt);h(gt,yt);h(xt,vt);h(wt,Mt);h(Rt,St);h(Et,Tt);h(kt,At);h(Ct,Pt);export{P as SdObject,G as SdScene,h as defineObject,pe as registry};
//# sourceMappingURL=solids.js.map
