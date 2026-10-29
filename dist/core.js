var At=Object.defineProperty;var Ct=(t,s)=>{for(var e in s)At(t,e,{get:s[e],enumerable:!0})};var Z=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var Q=`#version 300 es
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
`;var J=`#version 300 es
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
`;var G=new WeakMap;function ee(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(W(s),s):null}function W(t){t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function K(t,s,e){let r=t.createShader(s);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function I(t,s,e="object"){let r=G.get(t);r||G.set(t,r=new Map);let a=e[0]+s,i=r.get(a);if(i)return i;let n=(e==="object"?Q:J)+`
`+s,o=t.createProgram();if(t.attachShader(o,K(t,t.VERTEX_SHADER,Z)),t.attachShader(o,K(t,t.FRAGMENT_SHADER,n)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let m=new Map,l=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let p=0;p<l;p++){let f=t.getActiveUniform(o,p);m.set(f.name,t.getUniformLocation(o,f.name))}let c={prog:o,loc:m};return r.set(a,c),c}function te(t){G.delete(t)}function D(t,s,e){for(let[r,a]of Object.entries(e)){let i=s.loc.get(r);i!==void 0&&(typeof a=="number"?t.uniform1f(i,a):a.length===1?t.uniform1i(i,a[0]):a.length===2?t.uniform2f(i,a[0],a[1]):a.length===3?t.uniform3f(i,a[0],a[1],a[2]):a.length===4?t.uniform4f(i,a[0],a[1],a[2],a[3]):a.length===9&&t.uniformMatrix3fv(i,!1,a))}}function _(t){t.drawArrays(t.TRIANGLES,0,3)}function A(t,s,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let a=t.createFramebuffer(),i={fb:a,tex:r,w:0,h:0};return w(t,i,s,e),t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),i}function w(t,s,e,r){e=Math.max(1,e),r=Math.max(1,r),!(s.w===e&&s.h===r)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=r)}var ie={};Ct(ie,{animations:()=>j,effectAttrs:()=>F,effectParam:()=>O,effects:()=>v,interactionAttrs:()=>q,interactionParam:()=>X,interactionValue:()=>g,interactions:()=>y,kebab:()=>C,num:()=>L,objects:()=>V});var V=new Map,j=new Map,v=new Map,y=new Map,re=()=>[...v.values()].map(t=>t.manifest),ae=()=>[...y.values()].map(t=>t.meta),oe=t=>t.flatMap(s=>s.params.map(e=>`${s.name}-${C(e.name)}`)),F=()=>oe(re()),q=()=>oe(ae()),C=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function ne(t,s,e,r){var a;for(let i of t){let n=i.name+"-";if(!s.startsWith(n))continue;let o=i.params.find(m=>C(m.name)===s.slice(n.length));if(o)return(r[a=i.name]??(r[a]={}))[o.name]=L(e,o.default),!0}return!1}var O=(t,s,e)=>ne(re(),t,s,e),X=(t,s,e)=>ne(ae(),t,s,e),g=(t,s,e)=>t.interactionParams[s]?.[e]??y.get(s).meta.params.find(r=>r.name===e).default,L=(t,s)=>{if(t==null||t==="")return s;let e=Number(t);return isNaN(e)?s:e};var M=(t,s,e)=>t+(s-t)*e,S=(t,s,e,r)=>t+(s-t)*(1-Math.exp(-e/Math.max(r,1))),se=new Float32Array([1,0,0,0,1,0,0,0,1]);function P(t,s,e){let r=Math.cos(t),a=Math.sin(t),i=Math.cos(s),n=Math.sin(s),o=Math.cos(e),m=Math.sin(e);return new Float32Array([i*o,i*m,-n,a*n*o-r*m,a*n*m+r*o,a*i,r*n*o+a*m,r*n*m-a*o,r*i])}function N(t,s){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let a=0;a<3;a++)e[r*3+a]=t[a]*s[r*3]+t[3+a]*s[r*3+1]+t[6+a]*s[r*3+2];return e}function H(t){t=t.trim();let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(e=>parseInt(e+e,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(e=>parseInt(s[1].slice(e,e+2),16)/255);if(s=t.match(/^rgba?\(([^)]+)\)$/i),s){let e=s[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var Ft={off:0,idle:.25,busy:.6,active:1},Ot=["animation","speed","effect","state","color","size","gravity","gravity-gap"],ce=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),k=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(se),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=me(r.default,r.type)??0}static get observedAttributes(){return[...Ot,...this.manifest.uniforms.map(e=>C(e.name)),...F()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let a=document.createElement("sd-scene");this.shadowRoot.append(a),a.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,a){let i=a??"";switch(e){case"animation":this.animNames=i.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=i.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(i);this.speedValue=i===""||isNaN(o)?1:o;return}case"state":this.stateTarget=Ft[i]??.25;return;case"color":{let o=H(i);o&&(this.rgb=o);return}case"size":this.style.setProperty("--sd-size",i);return;case"gravity":case"gravity-gap":return}if(O(e,a,this.effectParams))return;let n=this.manifest.uniforms.find(o=>C(o.name)===e);if(n){let o=me(a===null||a===""?n.default:a,n.type);o!==null&&(this.uniforms[n.name]=o)}}update(e){this.stateValue=S(this.stateValue,this.stateTarget,e,150),R()||(this.phase+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let n=j.get(i)?.fn(this.phase,this.speedValue,this);if(n){if(n.rotation)for(let o=0;o<3;o++)r.rotation[o]+=n.rotation[o];n.offset&&(r.offset[0]+=n.offset[0],r.offset[1]+=n.offset[1]),n.scale!==void 0&&(r.scale*=n.scale),n.state!==void 0&&(r.state+=n.state),n.uniforms&&Object.assign(this.uniforms,n.uniforms)}}let a=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let i=this.blend*this.blend*(3-2*this.blend),n=this.prevPose;a={rotation:[0,1,2].map(o=>Lt(n.rotation[o],r.rotation[o],i)),offset:[M(n.offset[0],r.offset[0],i),M(n.offset[1],r.offset[1],i)],scale:M(n.scale,r.scale,i),state:M(n.state,r.state,i)}}this.pose=a,this.anim.rotation=P(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}};function Lt(t,s,e){let r=((s-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function me(t,s){if(s==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(s==="color")return Array.isArray(t)?t:H(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var $=null;function R(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:($??($=matchMedia("(prefers-reduced-motion: reduce)")),$.matches)}function Ut(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,ce(e))||Object.defineProperty(t,ce(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function d(t,s){var r;if(!t?.tag||customElements.get(t.tag))return;V.set(t.name,{manifest:t,frag:s});let e=(r=class extends k{},r.manifest=t,r.frag=s,r);Ut(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var fe=`void main() { fragColor = texture(uScene, vUv); }
`;var B=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused",...F(),...q()]}connectedCallback(){if(!this.gl){if(this.gl=ee(this.canvas),!this.gl){this.dataset.fallback="";for(let e of this.objects)e.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{te(this.gl),this.fbos=null,W(this.gl);for(let e of this.objects)e.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof k&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,a){let i=a??"";e==="interaction"?(this.interactionNames=i.split(/\s+/).filter(Boolean),this.interactionNames.forEach(n=>y.get(n)?.setup?.(this))):e==="effect"?this.effectNames=i.split(/\s+/).filter(Boolean):e==="theme"?this.theme=i||"auto":e==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):O(e,a,this.effectParams)||X(e,a,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.objects=new Set([...this.objects].sort((r,a)=>r.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),a=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let i of this.objects){let n=i.getBoundingClientRect();i.rect=new DOMRect(n.left-e.left,n.top-e.top,n.width,n.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let a=this.gl,i=this.canvas.width,n=this.canvas.height;if(!a||i===0||n===0)return;R()||(this.clock=e),e=this.clock;for(let f of this.objects)f.update(r);for(let f of this.interactionNames)y.get(f)?.frame(this,r,this.pointer);let o=this.fbos??(this.fbos={scene:A(a,i,n),a:A(a,i,n),b:A(a,i,n),oa:A(a,1,1),ob:A(a,1,1)});w(a,o.scene,i,n),w(a,o.a,i,n),w(a,o.b,i,n);let m=this.themeValue;this.bind(a,o.scene,0,0,i,n,!0);let l=[...this.objects].filter(f=>f.rect&&!f.broken).sort((f,u)=>f.anim.z-u.anim.z);for(let f of l)this.draw(a,f,e,m,o);let c=o.scene,p=this.effectNames.filter(f=>v.has(f));for(let f of p){let u=c===o.a?o.b:o.a;this.bind(a,u,0,0,i,n,!0),this.pass(a,f,c,this.effectParams[f],[i,n],e,m),c=u}this.bind(a,null,0,0,i,n,!0),this.blit(a,c)}bind(e,r,a,i,n,o,m){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(a,i,n,o),e.scissor(a,i,n,o),e.enable(e.SCISSOR_TEST),m&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let a=I(e,fe,"effect");e.useProgram(a.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),D(e,a,{uScene:[0]}),_(e)}pass(e,r,a,i,n,o,m){let l=v.get(r),c;try{c=I(e,l.frag,"effect")}catch(f){console.error(`[solids] effect "${r}" shader failed:
${f.message}`),this.blit(e,a);return}e.useProgram(c.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex);let p={};for(let f of l.manifest.params)p[f.name]=f.default;D(e,c,{uScene:[0],uResolution:n,uTime:o,uTheme:m,...p,...i}),_(e)}draw(e,r,a,i,n){let o=r.rect,m=r.manifest.bleed??1.5,l=o.x+o.width/2+r.anim.offset[0],c=o.y+o.height/2+r.anim.offset[1],p=o.width*m,f=o.height*m,u=Math.round((l-p/2)*this.dpr),x=Math.round((this.height-c-f/2)*this.dpr),h=Math.round(p*this.dpr),b=Math.round(f*this.dpr);if(h<=0||b<=0)return;let T;try{T=I(e,r.frag)}catch(E){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${E.message}`);return}let z=r.effectNames.filter(E=>v.has(E));z.length?(w(e,n.oa,h,b),w(e,n.ob,h,b),this.bind(e,n.oa,0,0,h,b,!0)):this.bind(e,n.scene,u,x,h,b,!1),e.useProgram(T.prog);let Et=this.pointer.inside?[(this.pointer.x-l)/p*2,-((this.pointer.y-c)/f)*2]:[0,0];if(D(e,T,{uTime:a,uResolution:[h,b],uPointer:Et,uRotation:r.anim.rotation,uScale:r.anim.scale/m,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:i,uColor:r.rgb,...r.uniforms}),_(e),!z.length)return;let U=n.oa;for(let E of z){let Y=U===n.oa?n.ob:n.oa;this.bind(e,Y,0,0,h,b,!0),this.pass(e,E,U,r.effectParams[E],[h,b],a,i),U=Y}this.bind(e,n.scene,u,x,h,b,!1),this.blit(e,U)}};var le=Math.PI/180,pe={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*le,Math.sin(t*2*Math.PI/6)*8*le,0]})};var ue={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var he={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var de={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var be={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Dt=[pe,ue,he,de,be];for(let t of Dt)j.set(t.meta.name,t);var ge={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var xe=`uniform float threshold;
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
`;var ve={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var ye=`uniform float angle;
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
`;var Me={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var we=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Se={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Re=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var Te={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Ee=`uniform float levels;
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
`;var Ae={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var Ce=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var Pe={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var ke=`uniform float size;
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
`;var je={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var Fe=`uniform float width;
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
`;var Oe={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var Le=`uniform float amount;
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
`;var Ue={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var Ie=`uniform float radius;
uniform float softness;

void main() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  fragColor = vec4(c.rgb * f, c.a);
}
`;var De={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var _e=`uniform float speed;
uniform float range;

void main() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  fragColor = vec4(clamp(h, 0.0, c.a), c.a);
}
`;var Ne={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var Be=`uniform float amplitude;
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
`;var cr=[{manifest:ge,frag:xe},{manifest:ve,frag:ye},{manifest:Me,frag:we},{manifest:Se,frag:Re},{manifest:Te,frag:Ee},{manifest:Ae,frag:Ce},{manifest:Pe,frag:ke},{manifest:je,frag:Fe},{manifest:Oe,frag:Le},{manifest:Ue,frag:Ie},{manifest:De,frag:_e},{manifest:Ne,frag:Be}];for(let t of cr)v.set(t.manifest.name,t);var ze=new WeakMap,Ge=20*Math.PI/180,We={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let i=Math.max(1,Math.round(s/16));for(let n of t.objects){if(!n.rect)continue;let o=ze.get(n)??ze.set(n,{rx:0,ry:0,vx:0,vy:0}).get(n),m=0,l=0;if(e.inside){let c=n.rect.x+n.rect.width/2+n.anim.offset[0],p=n.rect.y+n.rect.height/2+n.anim.offset[1],f=(e.x-c)/Math.max(t.width,1),u=(e.y-p)/Math.max(t.height,1);l=Math.max(-1,Math.min(1,f*2))*Ge,m=Math.max(-1,Math.min(1,u*2))*Ge}for(let c=0;c<i;c++)o.vx=(o.vx+(m-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(l-o.ry)*.08)*.8,o.ry+=o.vy;n.anim.rotation=N(P(o.rx,o.ry,0),n.anim.rotation)}}};var Ve=new WeakMap,qe={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let r of t.objects){if(!r.rect)continue;let a=r.rect.x+r.rect.width/2+r.anim.offset[0],i=r.rect.y+r.rect.height/2+r.anim.offset[1],n=e.inside&&Math.abs(e.x-a)<=r.rect.width/2&&Math.abs(e.y-i)<=r.rect.height/2,o=S(Ve.get(r)??0,n?1:0,s,160);Ve.set(r,o),r.anim.scale*=1+.08*o,r.anim.state+=o*(1-r.stateValue)}}};var Xe=new WeakMap,He=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],mr=t=>t*t*(3-2*t),$e={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(o=>o.rect),r=e.find(o=>o.getAttribute("gravity")==="center")??null,a=L(t.getAttribute("gravity-strength"),.6),i=r?He(r):null,n=R();for(let o of e){let m=o.getAttribute("gravity"),l=!!i&&o!==r&&m!=="none",c=Xe.get(o);if(!c&&!l)continue;c||Xe.set(o,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let p=[0,0],f=0;if(l){let u=He(o);if(c.center!==r&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=r,c.angle=Math.atan2(u[1]-i[1],u[0]-i[0]),c.r=Math.hypot(u[0]-i[0],u[1]-i[1])),m==="fall"){let x=L(o.getAttribute("gravity-gap"),24)+(r.rect.width+o.rect.width)/4;n||(c.r+=(x-c.r)*(1-Math.exp(-s/700))*(.3+a))}else n||(c.angle+=s/1e3*.25*a),f=Math.sin(c.angle);p=[i[0]+Math.cos(c.angle)*c.r-u[0],i[1]+Math.sin(c.angle)*c.r-u[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+s/800);let u=mr(c.k);p=[M(c.from[0],p[0],u),M(c.from[1],p[1],u)]}c.offset=p,o.anim.offset[0]+=p[0],o.anim.offset[1]+=p[1],o.anim.z=f,o.anim.scale*=1+.06*f}}};var Ye=new WeakMap,Ze={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,s,e){let r=g(t,"repel","radius"),a=g(t,"repel","strength"),i=Math.max(1,Math.round(s/16));for(let n of t.objects){if(!n.rect)continue;let o=Ye.get(n)??Ye.set(n,{x:0,y:0,vx:0,vy:0}).get(n),m=0,l=0;if(e.inside){let c=n.rect.x+n.rect.width/2+n.anim.offset[0]-e.x,p=n.rect.y+n.rect.height/2+n.anim.offset[1]-e.y,f=Math.hypot(c,p);if(f<r){let u=(1-f/r)*r*.5*a;m=f>.001?c/f*u:0,l=f>.001?p/f*u:-u}}for(let c=0;c<i;c++)o.vx=(o.vx+(m-o.x)*.08)*.8,o.x+=o.vx,o.vy=(o.vy+(l-o.y)*.08)*.8,o.y+=o.vy;n.anim.offset[0]+=o.x,n.anim.offset[1]+=o.y}}};var Qe=new WeakMap,Je={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,s,e){let r=g(t,"magnet","reach"),a=g(t,"magnet","strength");for(let i of t.objects){if(!i.rect)continue;let n=Qe.get(i)??[0,0],o=0,m=0;if(e.inside){o=(e.x-i.rect.x-i.rect.width/2-i.anim.offset[0])*a,m=(e.y-i.rect.y-i.rect.height/2-i.anim.offset[1])*a;let c=Math.hypot(o,m);c>r&&(o*=r/c,m*=r/c)}let l=[S(n[0],o,s,250),S(n[1],m,s,250)];Qe.set(i,l),i.anim.offset[0]+=l[0],i.anim.offset[1]+=l[1]}}};var Ke=new WeakMap,et={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,s){let e=g(t,"collide","gap"),r=[...t.objects].filter(m=>m.rect),a=r.map(m=>[m.rect.x+m.rect.width/2+m.anim.offset[0],m.rect.y+m.rect.height/2+m.anim.offset[1]]),i=a.map(m=>[...m]),n=r.map(m=>m.getAttribute("gravity")==="center"?0:1);for(let m=0;m<4;m++)for(let l=0;l<r.length;l++)for(let c=l+1;c<r.length;c++){let p=i[c][0]-i[l][0],f=i[c][1]-i[l][1],u=Math.hypot(p,f),x=(r[l].rect.width+r[c].rect.width)/2+e,h=n[l]+n[c];if(u>=x||!h)continue;u<.001?(p=1,f=0):(p/=u,f/=u);let b=(x-u)*n[l]/h,T=(x-u)*n[c]/h;i[l][0]-=p*b,i[l][1]-=f*b,i[c][0]+=p*T,i[c][1]+=f*T}let o=R()?1:1-Math.exp(-s/120);r.forEach((m,l)=>{let c=Ke.get(m)??[0,0],p=[c[0]+(i[l][0]-a[l][0]-c[0])*o,c[1]+(i[l][1]-a[l][1]-c[1])*o];Ke.set(m,p),m.anim.offset[0]+=p[0],m.anim.offset[1]+=p[1]})}};var tt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let s=t.getBoundingClientRect(),e=innerHeight,r=Math.min(1,Math.max(0,(e-s.top)/Math.max(e+s.height,1))),a=P(0,(r-.5)*g(t,"scroll","turns")*2*Math.PI,0);for(let i of t.objects)i.anim.rotation=N(a,i.anim.rotation)}};var fr=[We,qe,$e,Ze,Je,et,tt];for(let t of fr)y.set(t.meta.name,t);var rt={};var at={};var ot={};var nt={};var it={};var st={};var ct={};var mt={};var ft={};var lt={};var pt={};var ut={};var ht={};var dt={};var bt={};var gt={};var xt={};var vt={};var yt={};var Mt={};var wt={};var St={};var Rt={};var Tt={};customElements.get("sd-scene")||customElements.define("sd-scene",B);d(rt,at);d(ot,nt);d(it,st);d(ct,mt);d(ft,lt);d(pt,ut);d(ht,dt);d(bt,gt);d(xt,vt);d(yt,Mt);d(wt,St);d(Rt,Tt);export{k as SdObject,B as SdScene,d as defineObject,ie as registry};
//# sourceMappingURL=core.js.map
