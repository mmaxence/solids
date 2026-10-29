var Et=Object.defineProperty;var Ft=(e,s)=>{for(var t in s)Et(e,t,{get:s[t],enumerable:!0})};var Z=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var J=`#version 300 es
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
`;var K=`#version 300 es
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
`;var G=new WeakMap;function te(e){let s=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(W(s),{gl:s,colorSpace:s.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function W(e){"drawingBufferColorSpace"in e&&(e.drawingBufferColorSpace="display-p3"),e.bindVertexArray(e.createVertexArray()),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)}function ee(e,s,t){let a=e.createShader(s);if(e.shaderSource(a,t),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(a)||"shader compile failed");return a}function U(e,s,t="object"){let a=G.get(e);a||G.set(e,a=new Map);let n=t[0]+s,i=a.get(n);if(i)return i;let r=(t==="object"?J:K)+`
`+s,o=e.createProgram();if(e.attachShader(o,ee(e,e.VERTEX_SHADER,Z)),e.attachShader(o,ee(e,e.FRAGMENT_SHADER,r)),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(o)||"link failed");let c=new Map,f=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let p=0;p<f;p++){let m=e.getActiveUniform(o,p);c.set(m.name,e.getUniformLocation(o,m.name))}let l={prog:o,loc:c};return a.set(n,l),l}function ae(e){G.delete(e)}function D(e,s,t){for(let[a,n]of Object.entries(t)){let i=s.loc.get(a);i!==void 0&&(typeof n=="number"?e.uniform1f(i,n):n.length===1?e.uniform1i(i,n[0]):n.length===2?e.uniform2f(i,n[0],n[1]):n.length===3?e.uniform3f(i,n[0],n[1],n[2]):n.length===4?e.uniform4f(i,n[0],n[1],n[2],n[3]):n.length===9&&e.uniformMatrix3fv(i,!1,n))}}function N(e){e.drawArrays(e.TRIANGLES,0,3)}function C(e,s,t){let a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let n=e.createFramebuffer(),i={fb:n,tex:a,w:0,h:0};return M(e,i,s,t),e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0),i}function M(e,s,t,a){t=Math.max(1,t),a=Math.max(1,a),!(s.w===t&&s.h===a)&&(e.bindTexture(e.TEXTURE_2D,s.tex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,a,0,e.RGBA,e.UNSIGNED_BYTE,null),s.w=t,s.h=a)}var se={};Ft(se,{animations:()=>j,effectAttrs:()=>P,effectParam:()=>O,effects:()=>v,interactionAttrs:()=>X,interactionParam:()=>H,interactionValue:()=>g,interactions:()=>x,kebab:()=>A,num:()=>z,objects:()=>V});var V=new Map,j=new Map,v=new Map,x=new Map,re=()=>[...v.values()].map(e=>e.manifest),oe=()=>[...x.values()].map(e=>e.meta),ne=e=>e.flatMap(s=>s.params.map(t=>`${s.name}-${A(t.name)}`)),P=()=>ne(re()),X=()=>ne(oe()),A=e=>e.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function ie(e,s,t,a){var n;for(let i of e){let r=i.name+"-";if(!s.startsWith(r))continue;let o=i.params.find(c=>A(c.name)===s.slice(r.length));if(o)return(a[n=i.name]??(a[n]={}))[o.name]=z(t,o.default),!0}return!1}var O=(e,s,t)=>ie(re(),e,s,t),H=(e,s,t)=>ie(oe(),e,s,t),g=(e,s,t)=>e.interactionParams[s]?.[t]??x.get(s).meta.params.find(a=>a.name===t).default,z=(e,s)=>{if(e==null||e==="")return s;let t=Number(e);return isNaN(t)?s:t};var w=(e,s,t)=>e+(s-e)*t,R=(e,s,t,a)=>e+(s-e)*(1-Math.exp(-t/Math.max(a,1))),ce=new Float32Array([1,0,0,0,1,0,0,0,1]);function E(e,s,t){let a=Math.cos(e),n=Math.sin(e),i=Math.cos(s),r=Math.sin(s),o=Math.cos(t),c=Math.sin(t);return new Float32Array([i*o,i*c,-r,n*r*o-a*c,n*r*c+a*o,n*i,a*r*o+n*c,a*r*c-n*o,a*i])}function _(e,s){let t=new Float32Array(9);for(let a=0;a<3;a++)for(let n=0;n<3;n++)t[a*3+n]=e[n]*s[a*3]+e[3+n]*s[a*3+1]+e[6+n]*s[a*3+2];return t}var le=null,L=new Map;function $(e,s="srgb"){if(e=e.trim(),s==="srgb"){let r=e.match(/^#([0-9a-f]{3})$/i);if(r)return[...r[1]].map(o=>parseInt(o+o,16)/255);if(r=e.match(/^#([0-9a-f]{6})$/i),r)return[0,2,4].map(o=>parseInt(r[1].slice(o,o+2),16)/255);if(r=e.match(/^rgba?\(([^)]+)\)$/i),r){let o=r[1].split(/[\s,\/]+/).map(Number);if(o.length>=3&&o.every(c=>!isNaN(c)))return[o[0]/255,o[1]/255,o[2]/255]}}let t=s+e;if(L.has(t))return L.get(t);let a=le??(le=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=e;let n=a.fillStyle;a.fillStyle="#fff",a.fillStyle=e;let i=null;if(n===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let r=a.getImageData(0,0,1,1,{colorSpace:s}).data;i=[r[0]/255,r[1]/255,r[2]/255]}return L.size>256&&L.clear(),L.set(t,i),i}var zt={off:0,idle:.25,busy:.6,active:1},Lt=["animation","speed","effect","state","color","size","gravity","gravity-gap"],me=e=>e.replace(/-([a-z])/g,(s,t)=>t.toUpperCase()),F=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(ce),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=fe(a.default,a.type)??0}static get observedAttributes(){return[...Lt,...this.manifest.uniforms.map(t=>A(t.name)),...P()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let t=this.closest("sd-scene"),a=this.shadowRoot.querySelector("sd-scene");if(t)a&&(a.detach(this),a.remove()),t.attach?.(this);else if(a)a.attach(this);else{let n=document.createElement("sd-scene");this.shadowRoot.append(n),n.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(t,a,n){let i=n??"";switch(t){case"animation":this.animNames=i.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=i.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(i);this.speedValue=i===""||isNaN(o)?1:o;return}case"state":this.stateTarget=zt[i]??.25;return;case"color":this.recolor(i);return;case"size":this.style.setProperty("--sd-size",i);return;case"gravity":case"gravity-gap":return}if(O(t,n,this.effectParams))return;let r=this.manifest.uniforms.find(o=>A(o.name)===t);if(r){let o=fe(n===null||n===""?r.default:n,r.type);o!==null&&(this.uniforms[r.name]=o)}}recolor(t=this.colorSrc){let a=t?$(t,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=t)}update(t){this.stateValue=R(this.stateValue,this.stateTarget,t,150),S()||(this.phase+=t/1e3*this.speedValue);let a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let r=j.get(i)?.fn(this.phase,this.speedValue,this);if(r){if(r.rotation)for(let o=0;o<3;o++)a.rotation[o]+=r.rotation[o];r.offset&&(a.offset[0]+=r.offset[0],a.offset[1]+=r.offset[1]),r.scale!==void 0&&(a.scale*=r.scale),r.state!==void 0&&(a.state+=r.state),r.uniforms&&Object.assign(this.uniforms,r.uniforms)}}let n=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+t/400);let i=this.blend*this.blend*(3-2*this.blend),r=this.prevPose;n={rotation:[0,1,2].map(o=>It(r.rotation[o],a.rotation[o],i)),offset:[w(r.offset[0],a.offset[0],i),w(r.offset[1],a.offset[1],i)],scale:w(r.scale,a.scale,i),state:w(r.state,a.state,i)}}this.pose=n,this.anim.rotation=E(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=0}};function It(e,s,t){let a=((s-e+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return e+a*t}function fe(e,s){if(s==="float"){let a=typeof e=="number"?e:Number(e);return isNaN(a)?null:a}if(s==="color")return Array.isArray(e)?e:$(String(e));if(Array.isArray(e))return e;let t=String(e).split(/[\s,]+/).map(Number);return t.length===3&&t.every(a=>!isNaN(a))?t:null}var Y=null;function S(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(Y??(Y=matchMedia("(prefers-reduced-motion: reduce)")),Y.matches)}function Ut(e,s){for(let t of s)Object.getOwnPropertyDescriptor(e,me(t))||Object.defineProperty(e,me(t),{get(){return this.getAttribute(t)},set(a){a==null?this.removeAttribute(t):this.setAttribute(t,String(a))}})}function h(e,s){var a;if(!e?.tag||customElements.get(e.tag))return;V.set(e.name,{manifest:e,frag:s});let t=(a=class extends F{},a.manifest=e,a.frag=s,a);Ut(t.prototype,t.observedAttributes),customElements.define(e.tag,t)}var pe=`void main() { fragColor = texture(uScene, vUv); }
`;var B=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.dpr=1;this.maxDpr=2;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=t=>{let a=this.getBoundingClientRect();this.pointer={x:t.clientX-a.left,y:t.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=t=>{this.raf=0,this.t0||(this.t0=t);let a=this.last?Math.min(t-this.last,100):16;this.last=t,this.frame((t-this.t0)/1e3,a),this.raf=requestAnimationFrame(this.tick)};let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=t.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...P(),...X()]}connectedCallback(){if(!this.gl){let t=te(this.canvas);if(this.gl=t?.gl??null,this.colorSpace=t?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let a of this.objects)a.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",a=>{a.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{ae(this.gl),this.fbos=null,W(this.gl);for(let a of this.objects)a.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([t])=>{this.visible=t.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let t of this.querySelectorAll("*"))t instanceof F&&this.attach(t);for(let t of this.objects)this.ro.observe(t);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(t,a,n){let i=n??"";if(t==="interaction")this.interactionNames=i.split(/\s+/).filter(Boolean),this.interactionNames.forEach(r=>x.get(r)?.setup?.(this));else if(t==="effect")this.effectNames=i.split(/\s+/).filter(Boolean);else if(t==="theme")this.theme=i||"auto";else if(t==="dpr"){let r=Number(i);this.maxDpr=i&&!isNaN(r)&&r>0?r:2,this.measure()}else t==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):O(t,n,this.effectParams)||H(t,n,this.interactionParams)}attach(t){this.objects.has(t)||(this.objects.add(t),t.scene=this,t.recolor(),this.objects=new Set([...this.objects].sort((a,n)=>a.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(t.dataset.fallback=""),this.ro?.observe(t),this.measure())}detach(t){this.objects.delete(t),t.scene=null,this.ro?.unobserve(t)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let t=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,this.maxDpr),this.width=t.width,this.height=t.height;let a=Math.round(t.width*this.dpr),n=Math.round(t.height*this.dpr);(this.canvas.width!==a||this.canvas.height!==n)&&(this.canvas.width=a,this.canvas.height=n);for(let i of this.objects){let r=i.getBoundingClientRect();i.rect=new DOMRect(r.left-t.left,r.top-t.top,r.width,r.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(t,a){let n=this.gl,i=this.canvas.width,r=this.canvas.height;if(!n||i===0||r===0)return;S()||(this.clock=t),t=this.clock;for(let m of this.objects)m.update(a);for(let m of this.interactionNames)x.get(m)?.frame(this,a,this.pointer);let o=this.fbos??(this.fbos={scene:C(n,i,r),a:C(n,i,r),b:C(n,i,r),oa:C(n,1,1),ob:C(n,1,1)});M(n,o.scene,i,r),M(n,o.a,i,r),M(n,o.b,i,r);let c=this.themeValue;this.bind(n,o.scene,0,0,i,r,!0);let f=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,u)=>m.anim.z-u.anim.z);for(let m of f)this.draw(n,m,t,c,o);let l=o.scene,p=this.effectNames.filter(m=>v.has(m));for(let m of p){let u=l===o.a?o.b:o.a;this.bind(n,u,0,0,i,r,!0),this.pass(n,m,l,this.effectParams[m],[i,r],t,c),l=u}this.bind(n,null,0,0,i,r,!0),this.blit(n,l)}bind(t,a,n,i,r,o,c){t.bindFramebuffer(t.FRAMEBUFFER,a?.fb??null),t.viewport(n,i,r,o),t.scissor(n,i,r,o),t.enable(t.SCISSOR_TEST),c&&(t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT))}blit(t,a){let n=U(t,pe,"effect");t.useProgram(n.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,a.tex),D(t,n,{uScene:[0]}),N(t)}pass(t,a,n,i,r,o,c){let f=v.get(a),l;try{l=U(t,f.frag,"effect")}catch(m){console.error(`[solids] effect "${a}" shader failed:
${m.message}`),this.blit(t,n);return}t.useProgram(l.prog),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,n.tex);let p={};for(let m of f.manifest.params)p[m.name]=m.default;D(t,l,{uScene:[0],uResolution:r,uTime:o,uTheme:c,...p,...i}),N(t)}draw(t,a,n,i,r){let o=a.rect,c=a.manifest.bleed??1.5,f=o.x+o.width/2+a.anim.offset[0],l=o.y+o.height/2+a.anim.offset[1],p=o.width*c,m=o.height*c,u=Math.round((f-p/2)*this.dpr),y=Math.round((this.height-l-m/2)*this.dpr),d=Math.round(p*this.dpr),b=Math.round(m*this.dpr);if(d<=0||b<=0)return;let k;try{k=U(t,a.frag)}catch(T){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${T.message}`);return}let q=a.effectNames.filter(T=>v.has(T));q.length?(M(t,r.oa,d,b),M(t,r.ob,d,b),this.bind(t,r.oa,0,0,d,b,!0)):this.bind(t,r.scene,u,y,d,b,!1),t.useProgram(k.prog);let At=this.pointer.inside?[(this.pointer.x-f)/p*2,-((this.pointer.y-l)/m)*2]:[0,0];if(D(t,k,{uTime:n,uResolution:[d,b],uPointer:At,uRotation:a.anim.rotation,uScale:a.anim.scale/c,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:i,uColor:a.rgb,...a.uniforms}),N(t),!q.length)return;let I=r.oa;for(let T of q){let Q=I===r.oa?r.ob:r.oa;this.bind(t,Q,0,0,d,b,!0),this.pass(t,T,I,a.effectParams[T],[d,b],n,i),I=Q}this.bind(t,r.scene,u,y,d,b,!1),this.blit(t,I)}};var ue=Math.PI/180,de={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:e=>({rotation:[Math.sin(e*2*Math.PI/9)*4*ue,Math.sin(e*2*Math.PI/6)*8*ue,0]})};var he={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:e=>({rotation:[0,e*2*Math.PI/8,0]})};var be={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:e=>({scale:1+.06*Math.sin(e*2*Math.PI*1.2)})};var ge={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:e=>{let s=Math.sin(e*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var ye={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:e=>({offset:[Math.sin(e*2*Math.PI*.17)*3,Math.sin(e*2*Math.PI*.4)*6]})};var Nt=[de,he,be,ge,ye];for(let e of Nt)j.set(e.meta.name,e);var ve={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var xe=`uniform float threshold;
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
`;var we={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Me=`uniform float angle;
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
`;var Re={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var Se=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var ke={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Te=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var Ce={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Ae=`uniform float levels;
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
`;var Ee={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var Fe=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var je={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var Pe=`uniform float size;
uniform float angle;

void main() {
  float a = radians(angle);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 g = r * gl_FragCoord.xy / size;               // position in the rotated dot grid
  vec2 cell = floor(g) + 0.5;
  vec4 c = texture(uScene, transpose(r) * cell * size / uResolution);
  // Dot area follows brightness on dark pages and opacity on light ones, where pale glass is the ink.
  float v = mix(max(c.r, max(c.g, c.b)), c.a, uTheme);
  v = max(v - 0.06, 0.0) / 0.94;                     // the faint halo prints no dots
  float cov = clamp((sqrt(v) * 0.62 - length(g - cell)) * size + 0.5, 0.0, 1.0);
  fragColor = vec4(c.rgb / max(c.a, 1e-3), 1.0) * cov * step(0.004, c.a);
}
`;var Oe={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var ze=`uniform float width;
uniform float strength;

vec4 at(float x, float y) { return texture(uScene, vUv + vec2(x, y) * width / uResolution); }
float k(vec4 s) { return sdLuma(s.rgb) * 0.5 + s.a * 0.5; }

void main() {
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
  fragColor = vec4(tint, 1.0) * e + c * (1.0 - 0.7 * strength) * (1.0 - e);
}
`;var Le={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var Ie=`uniform float amount;
uniform float size;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec4 c = texture(uScene, vUv);
  // A new pattern 24 times a second, cycling so the hash input stays small. Frozen with the clock under reduced motion.
  float f = floor(mod(uTime * 24.0, 64.0));
  float n = hash(floor(gl_FragCoord.xy / size) + f * vec2(37.0, 17.0)) - 0.5;
  fragColor = vec4(clamp(c.rgb + n * amount * c.a, 0.0, c.a), c.a);
}
`;var Ue={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var De=`uniform float radius;
uniform float softness;

void main() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  fragColor = vec4(c.rgb * f, c.a);
}
`;var Ne={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var _e=`uniform float speed;
uniform float range;

void main() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  fragColor = vec4(clamp(h, 0.0, c.a), c.a);
}
`;var Be={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var qe=`uniform float amplitude;
uniform float frequency;
uniform float speed;

void main() {
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float r = length(p);
  // Push along the radius; fade to nothing at the very center where the direction is undefined.
  float w = sin((r * frequency - uTime * speed) * 6.2831853) * smoothstep(0.0, 0.06, r);
  vec2 dir = p / max(r, 1e-4);
  fragColor = texture(uScene, vUv + dir * w * amplitude / uResolution);
}
`;var ma=[{manifest:ve,frag:xe},{manifest:we,frag:Me},{manifest:Re,frag:Se},{manifest:ke,frag:Te},{manifest:Ce,frag:Ae},{manifest:Ee,frag:Fe},{manifest:je,frag:Pe},{manifest:Oe,frag:ze},{manifest:Le,frag:Ie},{manifest:Ue,frag:De},{manifest:Ne,frag:_e},{manifest:Be,frag:qe}];for(let e of ma)v.set(e.manifest.name,e);var Ge=new WeakMap,We=20*Math.PI/180,Ve={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(e,s,t){let i=Math.max(1,Math.round(s/16));for(let r of e.objects){if(!r.rect)continue;let o=Ge.get(r)??Ge.set(r,{rx:0,ry:0,vx:0,vy:0}).get(r),c=0,f=0;if(t.inside){let l=r.rect.x+r.rect.width/2+r.anim.offset[0],p=r.rect.y+r.rect.height/2+r.anim.offset[1],m=(t.x-l)/Math.max(e.width,1),u=(t.y-p)/Math.max(e.height,1);f=Math.max(-1,Math.min(1,m*2))*We,c=Math.max(-1,Math.min(1,u*2))*We}for(let l=0;l<i;l++)o.vx=(o.vx+(c-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(f-o.ry)*.08)*.8,o.ry+=o.vy;r.anim.rotation=_(E(o.rx,o.ry,0),r.anim.rotation)}}};var Xe=new WeakMap,He={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(e,s,t){for(let a of e.objects){if(!a.rect)continue;let n=a.rect.x+a.rect.width/2+a.anim.offset[0],i=a.rect.y+a.rect.height/2+a.anim.offset[1],r=t.inside&&Math.abs(t.x-n)<=a.rect.width/2&&Math.abs(t.y-i)<=a.rect.height/2,o=R(Xe.get(a)??0,r?1:0,s,160);Xe.set(a,o),a.anim.scale*=1+.08*o,a.anim.state+=o*(1-a.stateValue)}}};var $e=new WeakMap,Ye=e=>[e.rect.x+e.rect.width/2,e.rect.y+e.rect.height/2],fa=e=>e*e*(3-2*e),Qe={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(e,s){let t=[...e.objects].filter(o=>o.rect),a=t.find(o=>o.getAttribute("gravity")==="center")??null,n=z(e.getAttribute("gravity-strength"),.6),i=a?Ye(a):null,r=S();for(let o of t){let c=o.getAttribute("gravity"),f=!!i&&o!==a&&c!=="none",l=$e.get(o);if(!l&&!f)continue;l||$e.set(o,l={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let p=[0,0],m=0;if(f){let u=Ye(o);if(l.center!==a&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=a,l.angle=Math.atan2(u[1]-i[1],u[0]-i[0]),l.r=Math.hypot(u[0]-i[0],u[1]-i[1])),c==="fall"){let y=z(o.getAttribute("gravity-gap"),24)+(a.rect.width+o.rect.width)/4;r||(l.r+=(y-l.r)*(1-Math.exp(-s/700))*(.3+n))}else r||(l.angle+=s/1e3*.25*n),m=Math.sin(l.angle);p=[i[0]+Math.cos(l.angle)*l.r-u[0],i[1]+Math.sin(l.angle)*l.r-u[1]]}else l.center&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=null);if(l.k<1){l.k=Math.min(1,l.k+s/800);let u=fa(l.k);p=[w(l.from[0],p[0],u),w(l.from[1],p[1],u)]}l.offset=p,o.anim.offset[0]+=p[0],o.anim.offset[1]+=p[1],o.anim.z=m,o.anim.scale*=1+.06*m}}};var Ze=new WeakMap,Je={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(e,s,t){let a=g(e,"repel","radius"),n=g(e,"repel","strength"),i=Math.max(1,Math.round(s/16));for(let r of e.objects){if(!r.rect)continue;let o=Ze.get(r)??Ze.set(r,{x:0,y:0,vx:0,vy:0}).get(r),c=0,f=0;if(t.inside){let l=r.rect.x+r.rect.width/2+r.anim.offset[0]-t.x,p=r.rect.y+r.rect.height/2+r.anim.offset[1]-t.y,m=Math.hypot(l,p);if(m<a){let u=(1-m/a)*a*.5*n;c=m>.001?l/m*u:0,f=m>.001?p/m*u:-u}}for(let l=0;l<i;l++)o.vx=(o.vx+(c-o.x)*.08)*.8,o.x+=o.vx,o.vy=(o.vy+(f-o.y)*.08)*.8,o.y+=o.vy;r.anim.offset[0]+=o.x,r.anim.offset[1]+=o.y}}};var Ke=new WeakMap,et={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(e,s,t){let a=g(e,"magnet","reach"),n=g(e,"magnet","strength");for(let i of e.objects){if(!i.rect)continue;let r=Ke.get(i)??[0,0],o=0,c=0;if(t.inside){o=(t.x-i.rect.x-i.rect.width/2-i.anim.offset[0])*n,c=(t.y-i.rect.y-i.rect.height/2-i.anim.offset[1])*n;let l=Math.hypot(o,c);l>a&&(o*=a/l,c*=a/l)}let f=[R(r[0],o,s,250),R(r[1],c,s,250)];Ke.set(i,f),i.anim.offset[0]+=f[0],i.anim.offset[1]+=f[1]}}};var tt=new WeakMap,at={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(e,s){let t=g(e,"collide","gap"),a=[...e.objects].filter(c=>c.rect),n=a.map(c=>[c.rect.x+c.rect.width/2+c.anim.offset[0],c.rect.y+c.rect.height/2+c.anim.offset[1]]),i=n.map(c=>[...c]),r=a.map(c=>c.getAttribute("gravity")==="center"?0:1);for(let c=0;c<4;c++)for(let f=0;f<a.length;f++)for(let l=f+1;l<a.length;l++){let p=i[l][0]-i[f][0],m=i[l][1]-i[f][1],u=Math.hypot(p,m),y=(a[f].rect.width+a[l].rect.width)/2+t,d=r[f]+r[l];if(u>=y||!d)continue;u<.001?(p=1,m=0):(p/=u,m/=u);let b=(y-u)*r[f]/d,k=(y-u)*r[l]/d;i[f][0]-=p*b,i[f][1]-=m*b,i[l][0]+=p*k,i[l][1]+=m*k}let o=S()?1:1-Math.exp(-s/120);a.forEach((c,f)=>{let l=tt.get(c)??[0,0],p=[l[0]+(i[f][0]-n[f][0]-l[0])*o,l[1]+(i[f][1]-n[f][1]-l[1])*o];tt.set(c,p),c.anim.offset[0]+=p[0],c.anim.offset[1]+=p[1]})}};var rt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(e){let s=e.getBoundingClientRect(),t=innerHeight,a=Math.min(1,Math.max(0,(t-s.top)/Math.max(t+s.height,1))),n=E(0,(a-.5)*g(e,"scroll","turns")*2*Math.PI,0);for(let i of e.objects)i.anim.rotation=_(n,i.anim.rotation)}};var pa=[Ve,He,Qe,Je,et,at,rt];for(let e of pa)x.set(e.meta.name,e);var ot={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var nt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var it={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var st=`uniform float thickness;
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
`;var lt={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var ct=`uniform float facets;
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
`;var mt={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var ft=`uniform float turns;
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
`;var pt={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var ut=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var dt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var ht=`uniform float radius;
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
`;var bt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:1,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var gt=`uniform float twist;
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
  float q = floor(twist + 0.5), a = atan(p.z, p.x), d = 1e9;
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
`;var yt={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var vt=`uniform float sides;
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
`;var xt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var wt=`uniform float span;
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
`;var Mt={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var Rt=`uniform float points;
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
`;var St={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var kt=`uniform float turns;
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
`;var Tt={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a raised rim, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var Ct=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",B);h(ot,nt);h(it,st);h(lt,ct);h(mt,ft);h(pt,ut);h(dt,ht);h(bt,gt);h(yt,vt);h(xt,wt);h(Mt,Rt);h(St,kt);h(Tt,Ct);export{F as SdObject,B as SdScene,h as defineObject,se as registry};
//# sourceMappingURL=solids.js.map
