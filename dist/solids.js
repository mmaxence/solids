var At=Object.defineProperty;var Ct=(t,i)=>{for(var e in i)At(t,e,{get:i[e],enumerable:!0})};var Q=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var Z=`#version 300 es
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
`;var B=new WeakMap;function ee(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(G(i),i):null}function G(t){t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function K(t,i,e){let a=t.createShader(i);if(t.shaderSource(a,e),t.compileShader(a),!t.getShaderParameter(a,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(a)||"shader compile failed");return a}function I(t,i,e="object"){let a=B.get(t);a||B.set(t,a=new Map);let r=e[0]+i,s=a.get(r);if(s)return s;let n=(e==="object"?Z:J)+`
`+i,o=t.createProgram();if(t.attachShader(o,K(t,t.VERTEX_SHADER,Q)),t.attachShader(o,K(t,t.FRAGMENT_SHADER,n)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let m=new Map,f=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let p=0;p<f;p++){let c=t.getActiveUniform(o,p);m.set(c.name,t.getUniformLocation(o,c.name))}let l={prog:o,loc:m};return a.set(r,l),l}function te(t){B.delete(t)}function U(t,i,e){for(let[a,r]of Object.entries(e)){let s=i.loc.get(a);s!==void 0&&(typeof r=="number"?t.uniform1f(s,r):r.length===1?t.uniform1i(s,r[0]):r.length===2?t.uniform2f(s,r[0],r[1]):r.length===3?t.uniform3f(s,r[0],r[1],r[2]):r.length===4?t.uniform4f(s,r[0],r[1],r[2],r[3]):r.length===9&&t.uniformMatrix3fv(s,!1,r))}}function D(t){t.drawArrays(t.TRIANGLES,0,3)}function A(t,i,e){let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let r=t.createFramebuffer(),s={fb:r,tex:a,w:0,h:0};return M(t,s,i,e),t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0),s}function M(t,i,e,a){e=Math.max(1,e),a=Math.max(1,a),!(i.w===e&&i.h===a)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,a,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=a)}var se={};Ct(se,{animations:()=>P,effectAttrs:()=>j,effectParam:()=>O,effects:()=>x,interactionAttrs:()=>V,interactionParam:()=>X,interactionValue:()=>g,interactions:()=>y,kebab:()=>C,num:()=>z,objects:()=>W});var W=new Map,P=new Map,x=new Map,y=new Map,ae=()=>[...x.values()].map(t=>t.manifest),re=()=>[...y.values()].map(t=>t.meta),oe=t=>t.flatMap(i=>i.params.map(e=>`${i.name}-${C(e.name)}`)),j=()=>oe(ae()),V=()=>oe(re()),C=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function ne(t,i,e,a){var r;for(let s of t){let n=s.name+"-";if(!i.startsWith(n))continue;let o=s.params.find(m=>C(m.name)===i.slice(n.length));if(o)return(a[r=s.name]??(a[r]={}))[o.name]=z(e,o.default),!0}return!1}var O=(t,i,e)=>ne(ae(),t,i,e),X=(t,i,e)=>ne(re(),t,i,e),g=(t,i,e)=>t.interactionParams[i]?.[e]??y.get(i).meta.params.find(a=>a.name===e).default,z=(t,i)=>{if(t==null||t==="")return i;let e=Number(t);return isNaN(e)?i:e};var w=(t,i,e)=>t+(i-t)*e,R=(t,i,e,a)=>t+(i-t)*(1-Math.exp(-e/Math.max(a,1))),ie=new Float32Array([1,0,0,0,1,0,0,0,1]);function E(t,i,e){let a=Math.cos(t),r=Math.sin(t),s=Math.cos(i),n=Math.sin(i),o=Math.cos(e),m=Math.sin(e);return new Float32Array([s*o,s*m,-n,r*n*o-a*m,r*n*m+a*o,r*s,a*n*o+r*m,a*n*m-r*o,a*s])}function _(t,i){let e=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)e[a*3+r]=t[r]*i[a*3]+t[3+r]*i[a*3+1]+t[6+r]*i[a*3+2];return e}function H(t){t=t.trim();let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(e=>parseInt(e+e,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(e=>parseInt(i[1].slice(e,e+2),16)/255);if(i=t.match(/^rgba?\(([^)]+)\)$/i),i){let e=i[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(a=>!isNaN(a)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var jt={off:0,idle:.25,busy:.6,active:1},Ot=["animation","speed","effect","state","color","size","gravity","gravity-gap"],le=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),F=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(ie),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=me(a.default,a.type)??0}static get observedAttributes(){return[...Ot,...this.manifest.uniforms.map(e=>C(e.name)),...j()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene"),a=this.shadowRoot.querySelector("sd-scene");if(e)a&&(a.detach(this),a.remove()),e.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,a,r){let s=r??"";switch(e){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(s);this.speedValue=s===""||isNaN(o)?1:o;return}case"state":this.stateTarget=jt[s]??.25;return;case"color":{let o=H(s);o&&(this.rgb=o);return}case"size":this.style.setProperty("--sd-size",s);return;case"gravity":case"gravity-gap":return}if(O(e,r,this.effectParams))return;let n=this.manifest.uniforms.find(o=>C(o.name)===e);if(n){let o=me(r===null||r===""?n.default:r,n.type);o!==null&&(this.uniforms[n.name]=o)}}update(e){this.stateValue=R(this.stateValue,this.stateTarget,e,150),S()||(this.phase+=e/1e3*this.speedValue);let a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let n=P.get(s)?.fn(this.phase,this.speedValue,this);if(n){if(n.rotation)for(let o=0;o<3;o++)a.rotation[o]+=n.rotation[o];n.offset&&(a.offset[0]+=n.offset[0],a.offset[1]+=n.offset[1]),n.scale!==void 0&&(a.scale*=n.scale),n.state!==void 0&&(a.state+=n.state),n.uniforms&&Object.assign(this.uniforms,n.uniforms)}}let r=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),n=this.prevPose;r={rotation:[0,1,2].map(o=>zt(n.rotation[o],a.rotation[o],s)),offset:[w(n.offset[0],a.offset[0],s),w(n.offset[1],a.offset[1],s)],scale:w(n.scale,a.scale,s),state:w(n.state,a.state,s)}}this.pose=r,this.anim.rotation=E(r.rotation[0],r.rotation[1],r.rotation[2]),this.anim.offset=[r.offset[0],r.offset[1]],this.anim.scale=r.scale,this.anim.state=r.state,this.anim.z=0}};function zt(t,i,e){let a=((i-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+a*e}function me(t,i){if(i==="float"){let a=typeof t=="number"?t:Number(t);return isNaN(a)?null:a}if(i==="color")return Array.isArray(t)?t:H(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(a=>!isNaN(a))?e:null}var $=null;function S(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:($??($=matchMedia("(prefers-reduced-motion: reduce)")),$.matches)}function Lt(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,le(e))||Object.defineProperty(t,le(e),{get(){return this.getAttribute(e)},set(a){a==null?this.removeAttribute(e):this.setAttribute(e,String(a))}})}function h(t,i){var a;if(!t?.tag||customElements.get(t.tag))return;W.set(t.name,{manifest:t,frag:i});let e=(a=class extends F{},a.manifest=t,a.frag=i,a);Lt(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var ce=`void main() { fragColor = texture(uScene, vUv); }
`;var N=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let a=this.getBoundingClientRect();this.pointer={x:e.clientX-a.left,y:e.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let a=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,a),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused",...j(),...V()]}connectedCallback(){if(!this.gl){if(this.gl=ee(this.canvas),!this.gl){this.dataset.fallback="";for(let e of this.objects)e.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{te(this.gl),this.fbos=null,G(this.gl);for(let e of this.objects)e.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof F&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,a,r){let s=r??"";e==="interaction"?(this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(n=>y.get(n)?.setup?.(this))):e==="effect"?this.effectNames=s.split(/\s+/).filter(Boolean):e==="theme"?this.theme=s||"auto":e==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):O(e,r,this.effectParams)||X(e,r,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.objects=new Set([...this.objects].sort((a,r)=>a.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let a=Math.round(e.width*this.dpr),r=Math.round(e.height*this.dpr);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let s of this.objects){let n=s.getBoundingClientRect();s.rect=new DOMRect(n.left-e.left,n.top-e.top,n.width,n.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,a){let r=this.gl,s=this.canvas.width,n=this.canvas.height;if(!r||s===0||n===0)return;S()||(this.clock=e),e=this.clock;for(let c of this.objects)c.update(a);for(let c of this.interactionNames)y.get(c)?.frame(this,a,this.pointer);let o=this.fbos??(this.fbos={scene:A(r,s,n),a:A(r,s,n),b:A(r,s,n),oa:A(r,1,1),ob:A(r,1,1)});M(r,o.scene,s,n),M(r,o.a,s,n),M(r,o.b,s,n);let m=this.themeValue;this.bind(r,o.scene,0,0,s,n,!0);let f=[...this.objects].filter(c=>c.rect&&!c.broken).sort((c,u)=>c.anim.z-u.anim.z);for(let c of f)this.draw(r,c,e,m,o);let l=o.scene,p=this.effectNames.filter(c=>x.has(c));for(let c of p){let u=l===o.a?o.b:o.a;this.bind(r,u,0,0,s,n,!0),this.pass(r,c,l,this.effectParams[c],[s,n],e,m),l=u}this.bind(r,null,0,0,s,n,!0),this.blit(r,l)}bind(e,a,r,s,n,o,m){e.bindFramebuffer(e.FRAMEBUFFER,a?.fb??null),e.viewport(r,s,n,o),e.scissor(r,s,n,o),e.enable(e.SCISSOR_TEST),m&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,a){let r=I(e,ce,"effect");e.useProgram(r.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex),U(e,r,{uScene:[0]}),D(e)}pass(e,a,r,s,n,o,m){let f=x.get(a),l;try{l=I(e,f.frag,"effect")}catch(c){console.error(`[solids] effect "${a}" shader failed:
${c.message}`),this.blit(e,r);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex);let p={};for(let c of f.manifest.params)p[c.name]=c.default;U(e,l,{uScene:[0],uResolution:n,uTime:o,uTheme:m,...p,...s}),D(e)}draw(e,a,r,s,n){let o=a.rect,m=a.manifest.bleed??1.5,f=o.x+o.width/2+a.anim.offset[0],l=o.y+o.height/2+a.anim.offset[1],p=o.width*m,c=o.height*m,u=Math.round((f-p/2)*this.dpr),v=Math.round((this.height-l-c/2)*this.dpr),d=Math.round(p*this.dpr),b=Math.round(c*this.dpr);if(d<=0||b<=0)return;let k;try{k=I(e,a.frag)}catch(T){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${T.message}`);return}let q=a.effectNames.filter(T=>x.has(T));q.length?(M(e,n.oa,d,b),M(e,n.ob,d,b),this.bind(e,n.oa,0,0,d,b,!0)):this.bind(e,n.scene,u,v,d,b,!1),e.useProgram(k.prog);let Tt=this.pointer.inside?[(this.pointer.x-f)/p*2,-((this.pointer.y-l)/c)*2]:[0,0];if(U(e,k,{uTime:r,uResolution:[d,b],uPointer:Tt,uRotation:a.anim.rotation,uScale:a.anim.scale/m,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:s,uColor:a.rgb,...a.uniforms}),D(e),!q.length)return;let L=n.oa;for(let T of q){let Y=L===n.oa?n.ob:n.oa;this.bind(e,Y,0,0,d,b,!0),this.pass(e,T,L,a.effectParams[T],[d,b],r,s),L=Y}this.bind(e,n.scene,u,v,d,b,!1),this.blit(e,L)}};var fe=Math.PI/180,pe={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*fe,Math.sin(t*2*Math.PI/6)*8*fe,0]})};var ue={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var de={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var he={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var be={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Ut=[pe,ue,de,he,be];for(let t of Ut)P.set(t.meta.name,t);var ge={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var ve=`uniform float threshold;
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
`;var xe={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var ye=`uniform float angle;
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
`;var we={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var Me=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Re={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Se=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var ke={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var Te=`uniform float levels;
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
`;var Ee={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var Fe=`uniform float size;
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
`;var Pe={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var je=`uniform float width;
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
`;var Oe={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var ze=`uniform float amount;
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
`;var Le={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var Ie=`uniform float radius;
uniform float softness;

void main() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  fragColor = vec4(c.rgb * f, c.a);
}
`;var Ue={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var De=`uniform float speed;
uniform float range;

void main() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  fragColor = vec4(clamp(h, 0.0, c.a), c.a);
}
`;var _e={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var Ne=`uniform float amplitude;
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
`;var la=[{manifest:ge,frag:ve},{manifest:xe,frag:ye},{manifest:we,frag:Me},{manifest:Re,frag:Se},{manifest:ke,frag:Te},{manifest:Ae,frag:Ce},{manifest:Ee,frag:Fe},{manifest:Pe,frag:je},{manifest:Oe,frag:ze},{manifest:Le,frag:Ie},{manifest:Ue,frag:De},{manifest:_e,frag:Ne}];for(let t of la)x.set(t.manifest.name,t);var qe=new WeakMap,Be=20*Math.PI/180,Ge={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,i,e){let s=Math.max(1,Math.round(i/16));for(let n of t.objects){if(!n.rect)continue;let o=qe.get(n)??qe.set(n,{rx:0,ry:0,vx:0,vy:0}).get(n),m=0,f=0;if(e.inside){let l=n.rect.x+n.rect.width/2+n.anim.offset[0],p=n.rect.y+n.rect.height/2+n.anim.offset[1],c=(e.x-l)/Math.max(t.width,1),u=(e.y-p)/Math.max(t.height,1);f=Math.max(-1,Math.min(1,c*2))*Be,m=Math.max(-1,Math.min(1,u*2))*Be}for(let l=0;l<s;l++)o.vx=(o.vx+(m-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(f-o.ry)*.08)*.8,o.ry+=o.vy;n.anim.rotation=_(E(o.rx,o.ry,0),n.anim.rotation)}}};var We=new WeakMap,Ve={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,i,e){for(let a of t.objects){if(!a.rect)continue;let r=a.rect.x+a.rect.width/2+a.anim.offset[0],s=a.rect.y+a.rect.height/2+a.anim.offset[1],n=e.inside&&Math.abs(e.x-r)<=a.rect.width/2&&Math.abs(e.y-s)<=a.rect.height/2,o=R(We.get(a)??0,n?1:0,i,160);We.set(a,o),a.anim.scale*=1+.08*o,a.anim.state+=o*(1-a.stateValue)}}};var Xe=new WeakMap,He=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],ma=t=>t*t*(3-2*t),$e={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,i){let e=[...t.objects].filter(o=>o.rect),a=e.find(o=>o.getAttribute("gravity")==="center")??null,r=z(t.getAttribute("gravity-strength"),.6),s=a?He(a):null,n=S();for(let o of e){let m=o.getAttribute("gravity"),f=!!s&&o!==a&&m!=="none",l=Xe.get(o);if(!l&&!f)continue;l||Xe.set(o,l={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let p=[0,0],c=0;if(f){let u=He(o);if(l.center!==a&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=a,l.angle=Math.atan2(u[1]-s[1],u[0]-s[0]),l.r=Math.hypot(u[0]-s[0],u[1]-s[1])),m==="fall"){let v=z(o.getAttribute("gravity-gap"),24)+(a.rect.width+o.rect.width)/4;n||(l.r+=(v-l.r)*(1-Math.exp(-i/700))*(.3+r))}else n||(l.angle+=i/1e3*.25*r),c=Math.sin(l.angle);p=[s[0]+Math.cos(l.angle)*l.r-u[0],s[1]+Math.sin(l.angle)*l.r-u[1]]}else l.center&&(l.from=[l.offset[0],l.offset[1]],l.k=0,l.center=null);if(l.k<1){l.k=Math.min(1,l.k+i/800);let u=ma(l.k);p=[w(l.from[0],p[0],u),w(l.from[1],p[1],u)]}l.offset=p,o.anim.offset[0]+=p[0],o.anim.offset[1]+=p[1],o.anim.z=c,o.anim.scale*=1+.06*c}}};var Ye=new WeakMap,Qe={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,i,e){let a=g(t,"repel","radius"),r=g(t,"repel","strength"),s=Math.max(1,Math.round(i/16));for(let n of t.objects){if(!n.rect)continue;let o=Ye.get(n)??Ye.set(n,{x:0,y:0,vx:0,vy:0}).get(n),m=0,f=0;if(e.inside){let l=n.rect.x+n.rect.width/2+n.anim.offset[0]-e.x,p=n.rect.y+n.rect.height/2+n.anim.offset[1]-e.y,c=Math.hypot(l,p);if(c<a){let u=(1-c/a)*a*.5*r;m=c>.001?l/c*u:0,f=c>.001?p/c*u:-u}}for(let l=0;l<s;l++)o.vx=(o.vx+(m-o.x)*.08)*.8,o.x+=o.vx,o.vy=(o.vy+(f-o.y)*.08)*.8,o.y+=o.vy;n.anim.offset[0]+=o.x,n.anim.offset[1]+=o.y}}};var Ze=new WeakMap,Je={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,i,e){let a=g(t,"magnet","reach"),r=g(t,"magnet","strength");for(let s of t.objects){if(!s.rect)continue;let n=Ze.get(s)??[0,0],o=0,m=0;if(e.inside){o=(e.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*r,m=(e.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*r;let l=Math.hypot(o,m);l>a&&(o*=a/l,m*=a/l)}let f=[R(n[0],o,i,250),R(n[1],m,i,250)];Ze.set(s,f),s.anim.offset[0]+=f[0],s.anim.offset[1]+=f[1]}}};var Ke=new WeakMap,et={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,i){let e=g(t,"collide","gap"),a=[...t.objects].filter(m=>m.rect),r=a.map(m=>[m.rect.x+m.rect.width/2+m.anim.offset[0],m.rect.y+m.rect.height/2+m.anim.offset[1]]),s=r.map(m=>[...m]),n=a.map(m=>m.getAttribute("gravity")==="center"?0:1);for(let m=0;m<4;m++)for(let f=0;f<a.length;f++)for(let l=f+1;l<a.length;l++){let p=s[l][0]-s[f][0],c=s[l][1]-s[f][1],u=Math.hypot(p,c),v=(a[f].rect.width+a[l].rect.width)/2+e,d=n[f]+n[l];if(u>=v||!d)continue;u<.001?(p=1,c=0):(p/=u,c/=u);let b=(v-u)*n[f]/d,k=(v-u)*n[l]/d;s[f][0]-=p*b,s[f][1]-=c*b,s[l][0]+=p*k,s[l][1]+=c*k}let o=S()?1:1-Math.exp(-i/120);a.forEach((m,f)=>{let l=Ke.get(m)??[0,0],p=[l[0]+(s[f][0]-r[f][0]-l[0])*o,l[1]+(s[f][1]-r[f][1]-l[1])*o];Ke.set(m,p),m.anim.offset[0]+=p[0],m.anim.offset[1]+=p[1]})}};var tt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let i=t.getBoundingClientRect(),e=innerHeight,a=Math.min(1,Math.max(0,(e-i.top)/Math.max(e+i.height,1))),r=E(0,(a-.5)*g(t,"scroll","turns")*2*Math.PI,0);for(let s of t.objects)s.anim.rotation=_(r,s.anim.rotation)}};var ca=[Ge,Ve,$e,Qe,Je,et,tt];for(let t of ca)y.set(t.meta.name,t);var at={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var rt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var ot={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var nt=`uniform float thickness;
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
`;var st={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var it=`uniform float facets;
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
`;var lt={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var mt=`uniform float turns;
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
`;var ct={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var ft=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var pt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var ut=`uniform float radius;
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
`;var dt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:1,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var ht=`uniform float twist;
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
`;var bt={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var gt=`uniform float sides;
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
`;var vt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var xt=`uniform float span;
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
`;var yt={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var wt=`uniform float points;
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
`;var Mt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var Rt=`uniform float turns;
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
`;var St={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a raised rim, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var kt=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",N);h(at,rt);h(ot,nt);h(st,it);h(lt,mt);h(ct,ft);h(pt,ut);h(dt,ht);h(bt,gt);h(vt,xt);h(yt,wt);h(Mt,Rt);h(St,kt);export{F as SdObject,N as SdScene,h as defineObject,se as registry};
//# sourceMappingURL=solids.js.map
