var Ut=Object.defineProperty;var It=(e,i)=>{for(var t in i)Ut(e,t,{get:i[t],enumerable:!0})};var ee=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var v=(e,i,t)=>e+(i-e)*t,R=(e,i,t,a)=>e+(i-e)*(1-Math.exp(-t/Math.max(a,1))),ae=new Float32Array([1,0,0,0,1,0,0,0,1]);function F(e,i,t){let a=Math.cos(e),r=Math.sin(e),s=Math.cos(i),o=Math.sin(i),n=Math.cos(t),f=Math.sin(t);return new Float32Array([s*n,s*f,-o,r*o*n-a*f,r*o*f+a*n,r*s,a*o*n+r*f,a*o*f-r*n,a*s])}function _(e,i){let t=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)t[a*3+r]=e[r]*i[a*3]+e[3+r]*i[a*3+1]+e[6+r]*i[a*3+2];return t}var te=null,P=new Map;function B(e,i="srgb"){if(e=e.trim(),i==="srgb"){let o=e.match(/^#([0-9a-f]{3})$/i);if(o)return[...o[1]].map(n=>parseInt(n+n,16)/255);if(o=e.match(/^#([0-9a-f]{6})$/i),o)return[0,2,4].map(n=>parseInt(o[1].slice(n,n+2),16)/255)}let t=i+e;if(P.has(t))return P.get(t);let a=te??(te=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=e;let r=a.fillStyle;a.fillStyle="#fff",a.fillStyle=e;let s=null;if(r===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let o=a.getImageData(0,0,1,1,{colorSpace:i}).data;s=[o[0]/255,o[1]/255,o[2]/255]}return P.size>256&&P.clear(),P.set(t,s),s}var O=null;function re(){if(O!==null)return O;try{let e=B("#ff0000","display-p3");O=!!e&&e[1]>.05}catch{O=!1}return O}var oe=`#version 300 es
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
`;var H=new WeakMap;function ie(e){let i=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?($(i),{gl:i,colorSpace:i.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function $(e){"drawingBufferColorSpace"in e&&(e.drawingBufferColorSpace=re()?"display-p3":"srgb"),e.bindVertexArray(e.createVertexArray()),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)}function se(e,i,t){let a=e.createShader(i);if(e.shaderSource(a,t),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(a)||"shader compile failed");return a}function q(e,i,t="object"){let a=H.get(e);a||H.set(e,a=new Map);let r=t[0]+i,s=a.get(r);if(s)return s;let o=(t==="object"?oe:ne)+`
`+i,n=e.createProgram();if(e.attachShader(n,se(e,e.VERTEX_SHADER,ee)),e.attachShader(n,se(e,e.FRAGMENT_SHADER,o)),e.linkProgram(n),!e.getProgramParameter(n,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(n)||"link failed");let f=new Map,u=e.getProgramParameter(n,e.ACTIVE_UNIFORMS);for(let l=0;l<u;l++){let m=e.getActiveUniform(n,l);f.set(m.name,e.getUniformLocation(n,m.name))}let c={prog:n,loc:f};return a.set(r,c),c}function ce(e){H.delete(e)}function G(e,i,t){for(let[a,r]of Object.entries(t)){let s=i.loc.get(a);s!==void 0&&(typeof r=="number"?e.uniform1f(s,r):r.length===1?e.uniform1i(s,r[0]):r.length===2?e.uniform2f(s,r[0],r[1]):r.length===3?e.uniform3f(s,r[0],r[1],r[2]):r.length===4?e.uniform4f(s,r[0],r[1],r[2],r[3]):r.length===9&&e.uniformMatrix3fv(s,!1,r))}}function W(e){e.drawArrays(e.TRIANGLES,0,3)}function z(e,i,t){let a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let r=e.createFramebuffer(),s={fb:r,tex:a,w:0,h:0};return k(e,s,i,t),e.bindFramebuffer(e.FRAMEBUFFER,r),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0),s}function k(e,i,t,a){t=Math.max(1,t),a=Math.max(1,a),!(i.w===t&&i.h===a)&&(e.bindTexture(e.TEXTURE_2D,i.tex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,a,0,e.RGBA,e.UNSIGNED_BYTE,null),i.w=t,i.h=a)}var ue={};It(ue,{animations:()=>D,effectAttrs:()=>U,effectParam:()=>I,effects:()=>w,interactionAttrs:()=>Y,interactionParam:()=>Q,interactionValue:()=>x,interactions:()=>M,kebab:()=>j,num:()=>y,objects:()=>L});var L=new Map,D=new Map,w=new Map,M=new Map,le=()=>[...w.values()].map(e=>e.manifest),fe=()=>[...M.values()].map(e=>e.meta),me=e=>e.flatMap(i=>i.params.map(t=>`${i.name}-${j(t.name)}`)),U=()=>me(le()),Y=()=>me(fe()),j=e=>e.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function pe(e,i,t,a){var r;for(let s of e){let o=s.name+"-";if(!i.startsWith(o))continue;let n=s.params.find(f=>j(f.name)===i.slice(o.length));if(n)return(a[r=s.name]??(a[r]={}))[n.name]=y(t,n.default),!0}return!1}var I=(e,i,t)=>pe(le(),e,i,t),Q=(e,i,t)=>pe(fe(),e,i,t),x=(e,i,t)=>e.interactionParams[i]?.[t]??M.get(i).meta.params.find(a=>a.name===t).default,y=(e,i)=>{if(e==null||e==="")return i;let t=Number(e);return isNaN(t)?i:t};var qt={off:0,idle:.25,busy:.6,active:1},Gt=["animation","speed","effect","state","color","size","gravity","gravity-gap"],de=e=>e.replace(/-([a-z])/g,(i,t)=>t.toUpperCase()),S=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(ae),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.z=0;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=he(a.default,a.type)??0}static get observedAttributes(){return[...Gt,...this.manifest.uniforms.map(t=>j(t.name)),...U()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let t=this.closest("sd-scene, sd-universe"),a=this.shadowRoot.querySelector("sd-scene");if(t)a&&(a.detach(this),a.remove()),t.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(t,a,r){let s=r??"";switch(t){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let n=Number(s);this.speedValue=s===""||isNaN(n)?1:n;return}case"state":this.stateTarget=qt[s]??.25;return;case"color":this.recolor(s||"#9bd1ff");return;case"size":this.style.setProperty("--sd-size",s);return;case"gravity":case"gravity-gap":return}if(I(t,r,this.effectParams))return;let o=this.manifest.uniforms.find(n=>j(n.name)===t);if(o){let n=he(r===null||r===""?o.default:r,o.type);n!==null&&(this.uniforms[o.name]=n)}}recolor(t=this.colorSrc){let a=t?B(t,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=t)}update(t){this.stateValue=R(this.stateValue,this.stateTarget,t,150),A()||(this.phase+=t/1e3*this.speedValue);let a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let o=D.get(s)?.fn(this.phase,this.speedValue,this);if(o){if(o.rotation)for(let n=0;n<3;n++)a.rotation[n]+=o.rotation[n];o.offset&&(a.offset[0]+=o.offset[0],a.offset[1]+=o.offset[1]),o.scale!==void 0&&(a.scale*=o.scale),o.state!==void 0&&(a.state+=o.state),o.uniforms&&Object.assign(this.uniforms,o.uniforms)}}let r=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+t/400);let s=this.blend*this.blend*(3-2*this.blend),o=this.prevPose;r={rotation:[0,1,2].map(n=>Wt(o.rotation[n],a.rotation[n],s)),offset:[v(o.offset[0],a.offset[0],s),v(o.offset[1],a.offset[1],s)],scale:v(o.scale,a.scale,s),state:v(o.state,a.state,s)}}this.pose=r,this.anim.rotation=F(r.rotation[0],r.rotation[1],r.rotation[2]),this.anim.offset=[r.offset[0],r.offset[1]],this.anim.scale=r.scale,this.anim.state=r.state,this.anim.z=this.z}};function Wt(e,i,t){let a=((i-e+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return e+a*t}function he(e,i){if(i==="float"){let a=typeof e=="number"?e:Number(e);return isNaN(a)?null:a}if(i==="color")return Array.isArray(e)?e:B(String(e));if(Array.isArray(e))return e;let t=String(e).split(/[\s,]+/).map(Number);return t.length===3&&t.every(a=>!isNaN(a))?t:null}var Z=null;function A(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(Z??(Z=matchMedia("(prefers-reduced-motion: reduce)")),Z.matches)}function Vt(e,i){for(let t of i)Object.getOwnPropertyDescriptor(e,de(t))||Object.defineProperty(e,de(t),{get(){return this.getAttribute(t)},set(a){a==null?this.removeAttribute(t):this.setAttribute(t,String(a))}})}function b(e,i){var a;if(!e?.tag||customElements.get(e.tag))return;L.set(e.name,{manifest:e,frag:i});let t=(a=class extends S{},a.manifest=e,a.frag=i,a);Vt(t.prototype,t.observedAttributes),customElements.define(e.tag,t)}var be=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var E=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=t=>{let a=this.getBoundingClientRect();this.pointer={x:t.clientX-a.left,y:t.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=t=>{this.raf=0,this.t0||(this.t0=t);let a=this.last?Math.min(t-this.last,100):16;this.last=t,this.frame((t-this.t0)/1e3,a),this.raf=requestAnimationFrame(this.tick)};let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=t.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...U(),...Y()]}connectedCallback(){if(!this.gl){let t=ie(this.canvas);if(this.gl=t?.gl??null,this.colorSpace=t?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let a of this.objects)a.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",a=>{a.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{ce(this.gl),this.fbos=null,$(this.gl);for(let a of this.objects)a.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([t])=>{this.visible=t.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let t of this.querySelectorAll("*"))t instanceof S&&this.attach(t);for(let t of this.objects)this.ro.observe(t);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(t,a,r){let s=r??"";if(t==="interaction")this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>M.get(o)?.setup?.(this));else if(t==="effect")this.effectNames=s.split(/\s+/).filter(Boolean);else if(t==="theme")this.theme=s||"auto";else if(t==="dpr"){let o=Number(s);this.maxDpr=s&&!isNaN(o)&&o>0?o:2,this.measure()}else t==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):I(t,r,this.effectParams)||Q(t,r,this.interactionParams)}attach(t){this.objects.has(t)||(this.objects.add(t),t.scene=this,t.recolor(),this.objects=new Set([...this.objects].sort((a,r)=>a.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(t.dataset.fallback=""),this.ro?.observe(t),this.measure())}detach(t){this.objects.delete(t),t.scene=null,this.ro?.unobserve(t)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let t=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=t.width,this.height=t.height;let a=Math.round(t.width*this.pixelRatio),r=Math.round(t.height*this.pixelRatio);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let s of this.objects){let o=s.getBoundingClientRect();s.rect=new DOMRect(o.left-t.left,o.top-t.top,o.width,o.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(t,a){let r=this.gl,s=this.canvas.width,o=this.canvas.height;if(!r||s===0||o===0)return;A()||(this.clock=t),t=this.clock;for(let m of this.objects)m.update(a);for(let m of this.interactionNames)M.get(m)?.frame(this,a,this.pointer);let n=this.fbos??(this.fbos={scene:z(r,s,o),a:z(r,s,o),b:z(r,s,o),oa:z(r,1,1),ob:z(r,1,1)});k(r,n.scene,s,o),k(r,n.a,s,o),k(r,n.b,s,o);let f=this.themeValue;this.bind(r,n.scene,0,0,s,o,!0);let u=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,p)=>m.anim.z-p.anim.z);for(let m of u)this.draw(r,m,t,f,n);let c=n.scene,l=this.effectNames.filter(m=>w.has(m));for(let m of l){let p=c===n.a?n.b:n.a;this.bind(r,p,0,0,s,o,!0),this.pass(r,m,c,this.effectParams[m],[s,o],t,f),c=p}this.bind(r,null,0,0,s,o,!0),this.blit(r,c)}bind(t,a,r,s,o,n,f){t.bindFramebuffer(t.FRAMEBUFFER,a?.fb??null),t.viewport(r,s,o,n),t.scissor(r,s,o,n),t.enable(t.SCISSOR_TEST),f&&(t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT))}blit(t,a){let r=q(t,be,"effect");t.useProgram(r.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,a.tex),G(t,r,{uScene:[0]}),W(t)}pass(t,a,r,s,o,n,f){let u=w.get(a),c;try{c=q(t,u.frag,"effect")}catch(m){console.error(`[solids] effect "${a}" shader failed:
${m.message}`),this.blit(t,r);return}t.useProgram(c.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,r.tex);let l={};for(let m of u.manifest.params)l[m.name]=m.default;G(t,c,{uScene:[0],uResolution:o,uTime:n,uTheme:f,uMix:s?.mix??1,...l,...s}),W(t)}draw(t,a,r,s,o){let n=a.rect,f=a.manifest.bleed??1.5,u=n.x+n.width/2+a.anim.offset[0],c=n.y+n.height/2+a.anim.offset[1],l=n.width*f,m=n.height*f,p=Math.round((u-l/2)*this.pixelRatio),d=Math.round((this.height-c-m/2)*this.pixelRatio),h=Math.round(l*this.pixelRatio),g=Math.round(m*this.pixelRatio);if(h<=0||g<=0)return;let T;try{T=q(t,a.frag)}catch(C){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${C.message}`);return}let X=a.effectNames.filter(C=>w.has(C));X.length?(k(t,o.oa,h,g),k(t,o.ob,h,g),this.bind(t,o.oa,0,0,h,g,!0)):this.bind(t,o.scene,p,d,h,g,!1),t.useProgram(T.prog);let Dt=this.pointer.inside?[(this.pointer.x-u)/l*2,-((this.pointer.y-c)/m)*2]:[0,0];if(G(t,T,{uTime:r,uResolution:[h,g],uPointer:Dt,uRotation:a.anim.rotation,uScale:a.anim.scale/f,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:s,uColor:a.rgb,...a.uniforms}),W(t),!X.length)return;let N=o.oa;for(let C of X){let K=N===o.oa?o.ob:o.oa;this.bind(t,K,0,0,h,g,!0),this.pass(t,C,N,a.effectParams[C],[h,g],r,s),N=K}this.bind(t,o.scene,p,d,h,g,!1),this.blit(t,N)}};var Ht=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],$t=["idle","float","spin"],ge=["count","seed","gravity","depth","focus","shapes","palette"],J=(e,i,t)=>Math.min(t,Math.max(i,e)),xe=()=>new Set([...L.values()].map(e=>e.manifest.tag));function Yt(e){return()=>{e=e+1831565813|0;let i=Math.imul(e^e>>>15,1|e);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296}}var V=class extends E{constructor(){super();this.ready=!1;this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden}"}))}static get observedAttributes(){return[...E.observedAttributes,...ge]}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let t=xe();[...this.children].some(a=>t.has(a.localName))?queueMicrotask(()=>this.applyDepth()):this.generate()}attributeChangedCallback(t,a,r){if(t==="interaction"||t==="gravity")super.attributeChangedCallback("interaction",a,this.getAttribute("interaction")),this.hasAttribute("gravity")&&!this.interactionNames.includes("gravity")&&this.interactionNames.unshift("gravity");else if(!ge.includes(t))return super.attributeChangedCallback(t,a,r);!this.ready||t==="interaction"||(t==="depth"||t==="focus"?this.applyDepth():this.generate())}kids(){return[...this.children].filter(t=>t instanceof S)}generate(){for(let l of this.kids())l.remove();let t=xe(),a=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(l=>l.startsWith("sd-")?l:"sd-"+l),r=(a.length?a:[...t]).filter(l=>t.has(l)),s=this.getAttribute("palette")?.match(/[^\s(]+(\([^)]*\))?/g)??Ht,o=r.length?J(Math.round(y(this.getAttribute("count"),24)),0,120):0,n=Yt(y(this.getAttribute("seed"),1)),f=l=>l[Math.floor(n()*l.length)],u=Array.from({length:o},()=>{let l=n()*2-1;return{tag:f(r),x:6+n()*88,y:6+n()*88,z:l,size:Math.round(40+100*(.55*n()+.225*(l+1))),color:f(s),anim:f($t),speed:.2+n()*.3,role:""}});if(this.hasAttribute("gravity")&&o){let l=u.reduce((p,d)=>d.size>p.size?d:p),m=u.filter(p=>p!==l).sort((p,d)=>d.z-p.z).slice(0,Math.round((o-1)/3));for(let p of u)p.role=p===l?"center":m.includes(p)?"orbit":"none";l.x=l.y=50,m.length&&(l.z=m.reduce((p,d)=>p+d.z,0)/m.length)}let c=document.createDocumentFragment();for(let l of u.sort((m,p)=>m.z-p.z)){let m=document.createElement(l.tag);m.dataset.z=l.z.toFixed(2),m.setAttribute("size",l.size+"px"),m.setAttribute("color",l.color),m.setAttribute("animation",l.anim),l.anim==="spin"&&m.setAttribute("speed",l.speed.toFixed(1)),l.role&&m.setAttribute("gravity",l.role),m.style.cssText=`position:absolute;left:${l.x.toFixed(1)}%;top:${l.y.toFixed(1)}%;translate:-50% -50%`,c.append(m)}this.append(c),this.applyDepth()}applyDepth(){let t=J(y(this.getAttribute("depth"),.5),0,1),a=J(y(this.getAttribute("focus"),0),-1,1);for(let r of this.kids()){let s=y(r.dataset.z,0),o=Math.min(24,Math.round(t*Math.abs(s-a)*140)/10);r.z=s;let n=(r.getAttribute("effect")??"").split(/\s+/).filter(f=>f&&f!=="defocus");o>=.5?(n.push("defocus"),r.setAttribute("defocus-radius",String(o))):r.removeAttribute("defocus-radius"),n.length?r.setAttribute("effect",n.join(" ")):r.removeAttribute("effect"),r.setAttribute("state",t>0&&s<a?"idle":"active")}}};var ye=Math.PI/180,ve={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:e=>({rotation:[Math.sin(e*2*Math.PI/9)*4*ye,Math.sin(e*2*Math.PI/6)*8*ye,0]})};var we={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:e=>({rotation:[0,e*2*Math.PI/8,0]})};var Me={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:e=>({scale:1+.06*Math.sin(e*2*Math.PI*1.2)})};var Se={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:e=>{let i=Math.sin(e*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var Re={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:e=>({offset:[Math.sin(e*2*Math.PI*.17)*3,Math.sin(e*2*Math.PI*.4)*6]})};var Qt=[ve,we,Me,Se,Re];for(let e of Qt)D.set(e.meta.name,e);var ke={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var Ae=`uniform float threshold;
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
`;var Ee={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Te=`uniform float angle;
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
`;var Ce={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var Fe=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var ze={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var je=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var Pe={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Oe=`uniform float levels;
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
`;var Le={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var De=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var Ue={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var Ie=`uniform float size;
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
`;var Ne={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var _e=`uniform float width;
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
`;var Be={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var qe=`uniform float amount;
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
`;var Ge={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var We=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var Ve={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var Xe=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var He={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var $e=`uniform float amplitude;
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
`;var Ye={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var Qe=`uniform float radius;

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
`;var Sa=[{manifest:ke,frag:Ae},{manifest:Ee,frag:Te},{manifest:Ce,frag:Fe},{manifest:ze,frag:je},{manifest:Pe,frag:Oe},{manifest:Le,frag:De},{manifest:Ue,frag:Ie},{manifest:Ne,frag:_e},{manifest:Be,frag:qe},{manifest:Ge,frag:We},{manifest:Ve,frag:Xe},{manifest:He,frag:$e},{manifest:Ye,frag:Qe}],Ra={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let e of Sa)e.manifest.params.some(i=>i.name==="mix")||e.manifest.params.push(Ra),w.set(e.manifest.name,e);var Ze=new WeakMap,Je=20*Math.PI/180,Ke={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(e,i,t){let s=Math.max(1,Math.round(i/16));for(let o of e.objects){if(!o.rect)continue;let n=Ze.get(o)??Ze.set(o,{rx:0,ry:0,vx:0,vy:0}).get(o),f=0,u=0;if(t.inside){let c=o.rect.x+o.rect.width/2+o.anim.offset[0],l=o.rect.y+o.rect.height/2+o.anim.offset[1],m=(t.x-c)/Math.max(e.width,1),p=(t.y-l)/Math.max(e.height,1);u=Math.max(-1,Math.min(1,m*2))*Je,f=Math.max(-1,Math.min(1,p*2))*Je}for(let c=0;c<s;c++)n.vx=(n.vx+(f-n.rx)*.08)*.8,n.rx+=n.vx,n.vy=(n.vy+(u-n.ry)*.08)*.8,n.ry+=n.vy;o.anim.rotation=_(F(n.rx,n.ry,0),o.anim.rotation)}}};var et=new WeakMap,tt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(e,i,t){for(let a of e.objects){if(!a.rect)continue;let r=a.rect.x+a.rect.width/2+a.anim.offset[0],s=a.rect.y+a.rect.height/2+a.anim.offset[1],o=t.inside&&Math.abs(t.x-r)<=a.rect.width/2&&Math.abs(t.y-s)<=a.rect.height/2,n=R(et.get(a)??0,o?1:0,i,160);et.set(a,n),a.anim.scale*=1+.08*n,a.anim.state+=n*(1-a.stateValue)}}};var at=new WeakMap,rt=e=>[e.rect.x+e.rect.width/2,e.rect.y+e.rect.height/2],ka=e=>e*e*(3-2*e),ot={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(e,i){let t=[...e.objects].filter(n=>n.rect),a=t.find(n=>n.getAttribute("gravity")==="center")??null,r=y(e.getAttribute("gravity-strength"),.6),s=a?rt(a):null,o=A();for(let n of t){let f=n.getAttribute("gravity"),u=!!s&&n!==a&&f!=="none",c=at.get(n);if(!c&&!u)continue;c||at.set(n,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let l=[0,0],m=0;if(u){let p=rt(n);if(c.center!==a&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=a,c.angle=Math.atan2(p[1]-s[1],p[0]-s[0]),c.r=Math.hypot(p[0]-s[0],p[1]-s[1])),f==="fall"){let d=y(n.getAttribute("gravity-gap"),24)+(a.rect.width+n.rect.width)/4;o||(c.r+=(d-c.r)*(1-Math.exp(-i/700))*(.3+r))}else o||(c.angle+=i/1e3*.25*r),c.r=Math.hypot(p[0]-s[0],p[1]-s[1]),m=Math.sin(c.angle);l=[s[0]+Math.cos(c.angle)*c.r-p[0],s[1]+Math.sin(c.angle)*c.r-p[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+i/800);let p=ka(c.k);l=[v(c.from[0],l[0],p),v(c.from[1],l[1],p)]}c.offset=l,n.anim.offset[0]+=l[0],n.anim.offset[1]+=l[1],n.anim.z+=m,n.anim.scale*=1+.06*m}}};var nt=new WeakMap,st={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(e,i,t){let a=x(e,"repel","radius"),r=x(e,"repel","strength"),s=Math.max(1,Math.round(i/16));for(let o of e.objects){if(!o.rect)continue;let n=nt.get(o)??nt.set(o,{x:0,y:0,vx:0,vy:0}).get(o),f=0,u=0;if(t.inside){let c=o.rect.x+o.rect.width/2+o.anim.offset[0]-t.x,l=o.rect.y+o.rect.height/2+o.anim.offset[1]-t.y,m=Math.hypot(c,l);if(m<a){let p=(1-m/a)*a*.5*r;f=m>.001?c/m*p:0,u=m>.001?l/m*p:-p}}for(let c=0;c<s;c++)n.vx=(n.vx+(f-n.x)*.08)*.8,n.x+=n.vx,n.vy=(n.vy+(u-n.y)*.08)*.8,n.y+=n.vy;o.anim.offset[0]+=n.x,o.anim.offset[1]+=n.y}}};var it=new WeakMap,ct={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(e,i,t){let a=x(e,"magnet","reach"),r=x(e,"magnet","strength");for(let s of e.objects){if(!s.rect)continue;let o=it.get(s)??[0,0],n=0,f=0;if(t.inside){n=(t.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*r,f=(t.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*r;let c=Math.hypot(n,f);c>a&&(n*=a/c,f*=a/c)}let u=[R(o[0],n,i,250),R(o[1],f,i,250)];it.set(s,u),s.anim.offset[0]+=u[0],s.anim.offset[1]+=u[1]}}};var lt=new WeakMap,ft={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(e,i){let t=x(e,"collide","gap"),a=[...e.objects].filter(f=>f.rect),r=a.map(f=>[f.rect.x+f.rect.width/2+f.anim.offset[0],f.rect.y+f.rect.height/2+f.anim.offset[1]]),s=r.map(f=>[...f]),o=a.map(f=>f.getAttribute("gravity")==="center"?0:1);for(let f=0;f<4;f++)for(let u=0;u<a.length;u++)for(let c=u+1;c<a.length;c++){let l=s[c][0]-s[u][0],m=s[c][1]-s[u][1],p=Math.hypot(l,m),d=(a[u].rect.width+a[c].rect.width)/2+t,h=o[u]+o[c];if(p>=d||!h)continue;p<.001?(l=1,m=0):(l/=p,m/=p);let g=(d-p)*o[u]/h,T=(d-p)*o[c]/h;s[u][0]-=l*g,s[u][1]-=m*g,s[c][0]+=l*T,s[c][1]+=m*T}let n=A()?1:1-Math.exp(-i/120);a.forEach((f,u)=>{let c=lt.get(f)??[0,0],l=[c[0]+(s[u][0]-r[u][0]-c[0])*n,c[1]+(s[u][1]-r[u][1]-c[1])*n];lt.set(f,l),f.anim.offset[0]+=l[0],f.anim.offset[1]+=l[1]})}};var mt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(e){let i=e.getBoundingClientRect(),t=innerHeight,a=Math.min(1,Math.max(0,(t-i.top)/Math.max(t+i.height,1))),r=F(0,(a-.5)*x(e,"scroll","turns")*2*Math.PI,0);for(let s of e.objects)s.anim.rotation=_(r,s.anim.rotation)}};var Aa=[Ke,tt,ot,st,ct,ft,mt];for(let e of Aa)M.set(e.meta.name,e);var pt={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var ut=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var dt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var ht=`uniform float thickness;
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
`;var bt={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var gt=`uniform float facets;
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
`;var xt={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var yt=`uniform float turns;
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
`;var vt={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var wt=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Mt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var St=`uniform float radius;
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
`;var Rt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var kt=`uniform float twist;
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
`;var At={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var Et=`uniform float sides;
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
`;var Tt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var Ct=`uniform float span;
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
`;var Ft={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var zt=`uniform float points;
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
`;var jt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var Pt=`uniform float turns;
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
`;var Ot={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var Lt=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",E);b(pt,ut);b(dt,ht);b(bt,gt);b(xt,yt);b(vt,wt);b(Mt,St);b(Rt,kt);b(At,Et);b(Tt,Ct);b(Ft,zt);b(jt,Pt);b(Ot,Lt);customElements.get("sd-universe")||customElements.define("sd-universe",V);export{S as SdObject,E as SdScene,V as SdUniverse,b as defineObject,ue as registry};
//# sourceMappingURL=solids.js.map
