var Ve=Object.defineProperty;var Xe=(e,s)=>{for(var t in s)Ve(e,t,{get:s[t],enumerable:!0})};var H=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var $=`#version 300 es
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
`;var Y=`#version 300 es
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
`;var z=new WeakMap;function Z(e){let s=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(G(s),{gl:s,colorSpace:s.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function G(e){"drawingBufferColorSpace"in e&&(e.drawingBufferColorSpace="display-p3"),e.bindVertexArray(e.createVertexArray()),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)}function Q(e,s,t){let r=e.createShader(s);if(e.shaderSource(r,t),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(r)||"shader compile failed");return r}function j(e,s,t="object"){let r=z.get(e);r||z.set(e,r=new Map);let a=t[0]+s,i=r.get(a);if(i)return i;let n=(t==="object"?$:Y)+`
`+s,o=e.createProgram();if(e.attachShader(o,Q(e,e.VERTEX_SHADER,H)),e.attachShader(o,Q(e,e.FRAGMENT_SHADER,n)),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(o)||"link failed");let m=new Map,p=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let f=0;f<p;f++){let l=e.getActiveUniform(o,f);m.set(l.name,e.getUniformLocation(o,l.name))}let c={prog:o,loc:m};return r.set(a,c),c}function J(e){z.delete(e)}function k(e,s,t){for(let[r,a]of Object.entries(t)){let i=s.loc.get(r);i!==void 0&&(typeof a=="number"?e.uniform1f(i,a):a.length===1?e.uniform1i(i,a[0]):a.length===2?e.uniform2f(i,a[0],a[1]):a.length===3?e.uniform3f(i,a[0],a[1],a[2]):a.length===4?e.uniform4f(i,a[0],a[1],a[2],a[3]):a.length===9&&e.uniformMatrix3fv(i,!1,a))}}function U(e){e.drawArrays(e.TRIANGLES,0,3)}function M(e,s,t){let r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let a=e.createFramebuffer(),i={fb:a,tex:r,w:0,h:0};return v(e,i,s,t),e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r,0),i}function v(e,s,t,r){t=Math.max(1,t),r=Math.max(1,r),!(s.w===t&&s.h===r)&&(e.bindTexture(e.TEXTURE_2D,s.tex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,r,0,e.RGBA,e.UNSIGNED_BYTE,null),s.w=t,s.h=r)}var K={};Xe(K,{animations:()=>E,effectAttrs:()=>T,effectParam:()=>C,effects:()=>b,interactions:()=>S,kebab:()=>w,num:()=>A,objects:()=>W});var W=new Map,E=new Map,b=new Map,S=new Map,T=()=>[...b.values()].flatMap(e=>e.manifest.params.map(s=>`${e.manifest.name}-${w(s.name)}`)),w=e=>e.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function C(e,s,t){var r;for(let a of b.values()){let i=a.manifest.name+"-";if(!e.startsWith(i))continue;let n=a.manifest.params.find(o=>w(o.name)===e.slice(i.length));if(n)return(t[r=a.manifest.name]??(t[r]={}))[n.name]=A(s,n.default),!0}return!1}var A=(e,s)=>{if(e==null||e==="")return s;let t=Number(e);return isNaN(t)?s:t};var g=(e,s,t)=>e+(s-e)*t,I=(e,s,t,r)=>e+(s-e)*(1-Math.exp(-t/Math.max(r,1))),te=new Float32Array([1,0,0,0,1,0,0,0,1]);function D(e,s,t){let r=Math.cos(e),a=Math.sin(e),i=Math.cos(s),n=Math.sin(s),o=Math.cos(t),m=Math.sin(t);return new Float32Array([i*o,i*m,-n,a*n*o-r*m,a*n*m+r*o,a*i,r*n*o+a*m,r*n*m-a*o,r*i])}function re(e,s){let t=new Float32Array(9);for(let r=0;r<3;r++)for(let a=0;a<3;a++)t[r*3+a]=e[a]*s[r*3]+e[3+a]*s[r*3+1]+e[6+a]*s[r*3+2];return t}var ee=null,P=new Map;function q(e,s="srgb"){if(e=e.trim(),s==="srgb"){let n=e.match(/^#([0-9a-f]{3})$/i);if(n)return[...n[1]].map(o=>parseInt(o+o,16)/255);if(n=e.match(/^#([0-9a-f]{6})$/i),n)return[0,2,4].map(o=>parseInt(n[1].slice(o,o+2),16)/255);if(n=e.match(/^rgba?\(([^)]+)\)$/i),n){let o=n[1].split(/[\s,\/]+/).map(Number);if(o.length>=3&&o.every(m=>!isNaN(m)))return[o[0]/255,o[1]/255,o[2]/255]}}let t=s+e;if(P.has(t))return P.get(t);let r=ee??(ee=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!r)return null;r.fillStyle="#000",r.fillStyle=e;let a=r.fillStyle;r.fillStyle="#fff",r.fillStyle=e;let i=null;if(a===r.fillStyle){r.clearRect(0,0,1,1),r.fillRect(0,0,1,1);let n=r.getImageData(0,0,1,1,{colorSpace:s}).data;i=[n[0]/255,n[1]/255,n[2]/255]}return P.size>256&&P.clear(),P.set(t,i),i}var Qe={off:0,idle:.25,busy:.6,active:1},Ze=["animation","speed","effect","state","color","size","gravity","gravity-gap"],ae=e=>e.replace(/-([a-z])/g,(s,t)=>t.toUpperCase()),R=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(te),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=ne(r.default,r.type)??0}static get observedAttributes(){return[...Ze,...this.manifest.uniforms.map(t=>w(t.name)),...T()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let t=this.closest("sd-scene"),r=this.shadowRoot.querySelector("sd-scene");if(t)r&&(r.detach(this),r.remove()),t.attach?.(this);else if(r)r.attach(this);else{let a=document.createElement("sd-scene");this.shadowRoot.append(a),a.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(t,r,a){let i=a??"";switch(t){case"animation":this.animNames=i.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=i.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(i);this.speedValue=i===""||isNaN(o)?1:o;return}case"state":this.stateTarget=Qe[i]??.25;return;case"color":this.recolor(i);return;case"size":this.style.setProperty("--sd-size",i);return;case"gravity":case"gravity-gap":return}if(C(t,a,this.effectParams))return;let n=this.manifest.uniforms.find(o=>w(o.name)===t);if(n){let o=ne(a===null||a===""?n.default:a,n.type);o!==null&&(this.uniforms[n.name]=o)}}recolor(t=this.colorSrc){let r=t?q(t,this.scene?.colorSpace):null;r&&(this.rgb=r,this.colorSrc=t)}update(t){this.stateValue=I(this.stateValue,this.stateTarget,t,150),F()||(this.phase+=t/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let n=E.get(i)?.fn(this.phase,this.speedValue,this);if(n){if(n.rotation)for(let o=0;o<3;o++)r.rotation[o]+=n.rotation[o];n.offset&&(r.offset[0]+=n.offset[0],r.offset[1]+=n.offset[1]),n.scale!==void 0&&(r.scale*=n.scale),n.state!==void 0&&(r.state+=n.state),n.uniforms&&Object.assign(this.uniforms,n.uniforms)}}let a=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+t/400);let i=this.blend*this.blend*(3-2*this.blend),n=this.prevPose;a={rotation:[0,1,2].map(o=>Je(n.rotation[o],r.rotation[o],i)),offset:[g(n.offset[0],r.offset[0],i),g(n.offset[1],r.offset[1],i)],scale:g(n.scale,r.scale,i),state:g(n.state,r.state,i)}}this.pose=a,this.anim.rotation=D(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}};function Je(e,s,t){let r=((s-e+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return e+r*t}function ne(e,s){if(s==="float"){let r=typeof e=="number"?e:Number(e);return isNaN(r)?null:r}if(s==="color")return Array.isArray(e)?e:q(String(e));if(Array.isArray(e))return e;let t=String(e).split(/[\s,]+/).map(Number);return t.length===3&&t.every(r=>!isNaN(r))?t:null}var V=null;function F(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(V??(V=matchMedia("(prefers-reduced-motion: reduce)")),V.matches)}function Ke(e,s){for(let t of s)Object.getOwnPropertyDescriptor(e,ae(t))||Object.defineProperty(e,ae(t),{get(){return this.getAttribute(t)},set(r){r==null?this.removeAttribute(t):this.setAttribute(t,String(r))}})}function y(e,s){var r;if(!e?.tag||customElements.get(e.tag))return;W.set(e.name,{manifest:e,frag:s});let t=(r=class extends R{},r.manifest=e,r.frag=s,r);Ke(t.prototype,t.observedAttributes),customElements.define(e.tag,t)}var oe=`void main() { fragColor = texture(uScene, vUv); }
`;var _=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=t=>{let r=this.getBoundingClientRect();this.pointer={x:t.clientX-r.left,y:t.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=t=>{this.raf=0,this.t0||(this.t0=t);let r=this.last?Math.min(t-this.last,100):16;this.last=t,this.frame((t-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=t.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...T()]}connectedCallback(){if(!this.gl){let t=Z(this.canvas);if(this.gl=t?.gl??null,this.colorSpace=t?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{J(this.gl),this.fbos=null,G(this.gl);for(let r of this.objects)r.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([t])=>{this.visible=t.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let t of this.querySelectorAll("*"))t instanceof R&&this.attach(t);for(let t of this.objects)this.ro.observe(t);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(t,r,a){let i=a??"";t==="interaction"?(this.interactionNames=i.split(/\s+/).filter(Boolean),this.interactionNames.forEach(n=>S.get(n)?.setup?.(this))):t==="effect"?this.effectNames=i.split(/\s+/).filter(Boolean):t==="theme"?this.theme=i||"auto":t==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):C(t,a,this.effectParams)}attach(t){this.objects.has(t)||(this.objects.add(t),t.scene=this,t.recolor(),this.objects=new Set([...this.objects].sort((r,a)=>r.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(t.dataset.fallback=""),this.ro?.observe(t),this.measure())}detach(t){this.objects.delete(t),t.scene=null,this.ro?.unobserve(t)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let t=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=t.width,this.height=t.height;let r=Math.round(t.width*this.dpr),a=Math.round(t.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let i of this.objects){let n=i.getBoundingClientRect();i.rect=new DOMRect(n.left-t.left,n.top-t.top,n.width,n.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(t,r){let a=this.gl,i=this.canvas.width,n=this.canvas.height;if(!a||i===0||n===0)return;F()||(this.clock=t),t=this.clock;for(let l of this.objects)l.update(r);for(let l of this.interactionNames)S.get(l)?.frame(this,r,this.pointer);let o=this.fbos??(this.fbos={scene:M(a,i,n),a:M(a,i,n),b:M(a,i,n),oa:M(a,1,1),ob:M(a,1,1)});v(a,o.scene,i,n),v(a,o.a,i,n),v(a,o.b,i,n);let m=this.themeValue;this.bind(a,o.scene,0,0,i,n,!0);let p=[...this.objects].filter(l=>l.rect&&!l.broken).sort((l,u)=>l.anim.z-u.anim.z);for(let l of p)this.draw(a,l,t,m,o);let c=o.scene,f=this.effectNames.filter(l=>b.has(l));for(let l of f){let u=c===o.a?o.b:o.a;this.bind(a,u,0,0,i,n,!0),this.pass(a,l,c,this.effectParams[l],[i,n],t,m),c=u}this.bind(a,null,0,0,i,n,!0),this.blit(a,c)}bind(t,r,a,i,n,o,m){t.bindFramebuffer(t.FRAMEBUFFER,r?.fb??null),t.viewport(a,i,n,o),t.scissor(a,i,n,o),t.enable(t.SCISSOR_TEST),m&&(t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT))}blit(t,r){let a=j(t,oe,"effect");t.useProgram(a.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,r.tex),k(t,a,{uScene:[0]}),U(t)}pass(t,r,a,i,n,o,m){let p=b.get(r),c;try{c=j(t,p.frag,"effect")}catch(l){console.error(`[solids] effect "${r}" shader failed:
${l.message}`),this.blit(t,a);return}t.useProgram(c.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,a.tex);let f={};for(let l of p.manifest.params)f[l.name]=l.default;k(t,c,{uScene:[0],uResolution:n,uTime:o,uTheme:m,...f,...i}),U(t)}draw(t,r,a,i,n){let o=r.rect,m=r.manifest.bleed??1.5,p=o.x+o.width/2+r.anim.offset[0],c=o.y+o.height/2+r.anim.offset[1],f=o.width*m,l=o.height*m,u=Math.round((p-f/2)*this.dpr),L=Math.round((this.height-c-l/2)*this.dpr),d=Math.round(f*this.dpr),h=Math.round(l*this.dpr);if(d<=0||h<=0)return;let N;try{N=j(t,r.frag)}catch(x){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${x.message}`);return}let B=r.effectNames.filter(x=>b.has(x));B.length?(v(t,n.oa,d,h),v(t,n.ob,d,h),this.bind(t,n.oa,0,0,d,h,!0)):this.bind(t,n.scene,u,L,d,h,!1),t.useProgram(N.prog);let qe=this.pointer.inside?[(this.pointer.x-p)/f*2,-((this.pointer.y-c)/l)*2]:[0,0];if(k(t,N,{uTime:a,uResolution:[d,h],uPointer:qe,uRotation:r.anim.rotation,uScale:r.anim.scale/m,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:i,uColor:r.rgb,...r.uniforms}),U(t),!B.length)return;let O=n.oa;for(let x of B){let X=O===n.oa?n.ob:n.oa;this.bind(t,X,0,0,d,h,!0),this.pass(t,x,O,r.effectParams[x],[d,h],a,i),O=X}this.bind(t,n.scene,u,L,d,h,!1),this.blit(t,O)}};var ie=Math.PI/180,se={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:e=>({rotation:[Math.sin(e*2*Math.PI/9)*4*ie,Math.sin(e*2*Math.PI/6)*8*ie,0]})};var ce={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:e=>({rotation:[0,e*2*Math.PI/8,0]})};var le={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:e=>({scale:1+.06*Math.sin(e*2*Math.PI*1.2)})};var me={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:e=>{let s=Math.sin(e*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var fe={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:e=>({offset:[Math.sin(e*2*Math.PI*.17)*3,Math.sin(e*2*Math.PI*.4)*6]})};var tt=[se,ce,le,me,fe];for(let e of tt)E.set(e.meta.name,e);var ue={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var pe=`uniform float threshold;
uniform float radius;
uniform float strength;

vec4 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return c * smoothstep(threshold, threshold + 0.3, sdLuma(c.rgb));
}

void main() {
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
  fragColor = base + acc / wsum * strength * 1.6;
}
`;var de={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var he=`uniform float angle;
uniform float reach;
uniform float strength;

void main() {
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
  fragColor = base + acc / wsum * strength;
}
`;var be={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ge=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var ve={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var ye=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var xe={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Me=`uniform float levels;
uniform float scale;

void main() {
  vec4 c = texture(uScene, vUv);
  if (c.a < 0.004) { fragColor = vec4(0.0); return; }
  vec3 straight = c.rgb / c.a;
  float t = sdBayer(gl_FragCoord.xy / scale) - 0.5;
  float n = levels - 1.0;
  vec3 q = floor(straight * n + t + 0.5) / n;
  fragColor = vec4(clamp(q, 0.0, 1.0) * c.a, c.a);
}
`;var Se={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var we=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var dt=[{manifest:ue,frag:pe},{manifest:de,frag:he},{manifest:be,frag:ge},{manifest:ve,frag:ye},{manifest:xe,frag:Me},{manifest:Se,frag:we}];for(let e of dt)b.set(e.manifest.name,e);var Re=new WeakMap,Ee=20*Math.PI/180,Te={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(e,s,t){let i=Math.max(1,Math.round(s/16));for(let n of e.objects){if(!n.rect)continue;let o=Re.get(n)??Re.set(n,{rx:0,ry:0,vx:0,vy:0}).get(n),m=0,p=0;if(t.inside){let c=n.rect.x+n.rect.width/2+n.anim.offset[0],f=n.rect.y+n.rect.height/2+n.anim.offset[1],l=(t.x-c)/Math.max(e.width,1),u=(t.y-f)/Math.max(e.height,1);p=Math.max(-1,Math.min(1,l*2))*Ee,m=Math.max(-1,Math.min(1,u*2))*Ee}for(let c=0;c<i;c++)o.vx=(o.vx+(m-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(p-o.ry)*.08)*.8,o.ry+=o.vy;n.anim.rotation=re(D(o.rx,o.ry,0),n.anim.rotation)}}};var Ce=new WeakMap,Ae={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(e,s,t){for(let r of e.objects){if(!r.rect)continue;let a=r.rect.x+r.rect.width/2+r.anim.offset[0],i=r.rect.y+r.rect.height/2+r.anim.offset[1],n=t.inside&&Math.abs(t.x-a)<=r.rect.width/2&&Math.abs(t.y-i)<=r.rect.height/2,o=I(Ce.get(r)??0,n?1:0,s,160);Ce.set(r,o),r.anim.scale*=1+.08*o,r.anim.state+=o*(1-r.stateValue)}}};var Pe=new WeakMap,Fe=e=>[e.rect.x+e.rect.width/2,e.rect.y+e.rect.height/2],ht=e=>e*e*(3-2*e),Le={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(e,s){let t=[...e.objects].filter(o=>o.rect),r=t.find(o=>o.getAttribute("gravity")==="center")??null,a=A(e.getAttribute("gravity-strength"),.6),i=r?Fe(r):null,n=F();for(let o of t){let m=o.getAttribute("gravity"),p=!!i&&o!==r&&m!=="none",c=Pe.get(o);if(!c&&!p)continue;c||Pe.set(o,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let f=[0,0],l=0;if(p){let u=Fe(o);if(c.center!==r&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=r,c.angle=Math.atan2(u[1]-i[1],u[0]-i[0]),c.r=Math.hypot(u[0]-i[0],u[1]-i[1])),m==="fall"){let L=A(o.getAttribute("gravity-gap"),24)+(r.rect.width+o.rect.width)/4;n||(c.r+=(L-c.r)*(1-Math.exp(-s/700))*(.3+a))}else n||(c.angle+=s/1e3*.25*a),l=Math.sin(c.angle);f=[i[0]+Math.cos(c.angle)*c.r-u[0],i[1]+Math.sin(c.angle)*c.r-u[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+s/800);let u=ht(c.k);f=[g(c.from[0],f[0],u),g(c.from[1],f[1],u)]}c.offset=f,o.anim.offset[0]+=f[0],o.anim.offset[1]+=f[1],o.anim.z=l,o.anim.scale*=1+.06*l}}};var bt=[Te,Ae,Le];for(let e of bt)S.set(e.meta.name,e);var Oe={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var je=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var ke={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Ue=`uniform float thickness;
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
`;var Ie={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var De=`uniform float facets;
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
`;var _e={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var Ne=`uniform float turns;
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
`;var Be={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var ze=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Ge={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var We=`uniform float radius;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",_);y(Oe,je);y(ke,Ue);y(Ie,De);y(_e,Ne);y(Be,ze);y(Ge,We);export{R as SdObject,_ as SdScene,y as defineObject,K as registry};
//# sourceMappingURL=solids.js.map
