var le=Object.defineProperty;var ce=(t,n)=>{for(var e in n)le(t,e,{get:n[e],enumerable:!0})};var E=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var P=`#version 300 es
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
  col = mix(col, col * 0.7 + uColor * 0.15, uTheme);
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
`;var w=new WeakMap;function L(t){let n=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return n?(n.bindVertexArray(n.createVertexArray()),n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE_MINUS_SRC_ALPHA),n):null}function T(t,n,e){let r=t.createShader(n);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function k(t,n,e=!0){let r=w.get(t);r||w.set(t,r=new Map);let i=(e?"o":"e")+n,a=r.get(i);if(a)return a;let o=e?P+`
`+n:n,s=t.createProgram();if(t.attachShader(s,T(t,t.VERTEX_SHADER,E)),t.attachShader(s,T(t,t.FRAGMENT_SHADER,o)),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s)||"link failed");let l=new Map,c=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let m=0;m<c;m++){let d=t.getActiveUniform(s,m);l.set(d.name,t.getUniformLocation(s,d.name))}let u={prog:s,loc:l};return r.set(i,u),u}function O(t){w.delete(t)}function j(t,n,e){for(let[r,i]of Object.entries(e)){let a=n.loc.get(r);a!==void 0&&(typeof i=="number"?t.uniform1f(a,i):i.length===2?t.uniform2f(a,i[0],i[1]):i.length===3?t.uniform3f(a,i[0],i[1],i[2]):i.length===4?t.uniform4f(a,i[0],i[1],i[2],i[3]):i.length===9&&t.uniformMatrix3fv(a,!1,i))}}function D(t){t.drawArrays(t.TRIANGLES,0,3)}var I={};ce(I,{animations:()=>b,effects:()=>ue,interactions:()=>y,objects:()=>S});var S=new Map,b=new Map,ue=new Map,y=new Map;var p=(t,n,e)=>t+(n-t)*e,N=(t,n,e,r)=>t+(n-t)*(1-Math.exp(-e/Math.max(r,1))),z=new Float32Array([1,0,0,0,1,0,0,0,1]);function F(t,n,e){let r=Math.cos(t),i=Math.sin(t),a=Math.cos(n),o=Math.sin(n),s=Math.cos(e),l=Math.sin(e);return new Float32Array([a*s,a*l,-o,i*o*s-r*l,i*o*l+r*s,i*a,r*o*s+i*l,r*o*l-i*s,r*a])}function A(t){t=t.trim();let n=t.match(/^#([0-9a-f]{3})$/i);if(n)return[...n[1]].map(e=>parseInt(e+e,16)/255);if(n=t.match(/^#([0-9a-f]{6})$/i),n)return[0,2,4].map(e=>parseInt(n[1].slice(e,e+2),16)/255);if(n=t.match(/^rgba?\(([^)]+)\)$/i),n){let e=n[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var pe={off:0,idle:.25,busy:.6,active:1},he=["animation","speed","effect","state","color","size","gravity"],_=t=>t.replace(/-([a-z])/g,(n,e)=>e.toUpperCase()),q=t=>t.replace(/[A-Z]/g,n=>"-"+n.toLowerCase()),h=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.anim={rotation:new Float32Array(z),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=U(r.default,r.type)??0}static get observedAttributes(){return[...he,...this.manifest.uniforms.map(e=>q(e.name))]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,i){let a=i??"";switch(e){case"animation":this.animNames=a.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=a.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(a)||1;return;case"state":this.stateTarget=pe[a]??.25;return;case"color":{let s=A(a);s&&(this.color=s);return}case"size":this.style.setProperty("--sd-size",a);return;case"gravity":return}let o=this.manifest.uniforms.find(s=>q(s.name)===e);if(o){let s=U(a,o.type);s!==null&&(this.uniforms[o.name]=s)}}update(e,r){this.state=N(this.state,this.stateTarget,r,150);let i=de()?0:e*this.speed,a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let l=b.get(s)?.fn(i,this.speed,this);if(l){if(l.rotation)for(let c=0;c<3;c++)a.rotation[c]+=l.rotation[c];l.offset&&(a.offset[0]+=l.offset[0],a.offset[1]+=l.offset[1]),l.scale!==void 0&&(a.scale*=l.scale),l.state!==void 0&&(a.state+=l.state),l.uniforms&&Object.assign(this.uniforms,l.uniforms)}}let o=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let s=this.blend*this.blend*(3-2*this.blend),l=this.prevPose;o={rotation:[0,1,2].map(c=>p(l.rotation[c],a.rotation[c],s)),offset:[p(l.offset[0],a.offset[0],s),p(l.offset[1],a.offset[1],s)],scale:p(l.scale,a.scale,s),state:p(l.state,a.state,s)}}this.lastPose=o,this.anim.rotation=F(o.rotation[0],o.rotation[1],o.rotation[2]),this.anim.offset=[o.offset[0],o.offset[1]],this.anim.scale=o.scale,this.anim.state=o.state,this.anim.z=0}},R=null;function de(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(R??(R=matchMedia("(prefers-reduced-motion: reduce)")),R.matches)}function U(t,n){if(n==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(n==="color")return Array.isArray(t)?t:A(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function be(t,n){for(let e of n)Object.getOwnPropertyDescriptor(t,_(e))||Object.defineProperty(t,_(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function f(t,n){var r;if(!t?.tag||customElements.get(t.tag))return;S.set(t.name,{manifest:t,frag:n});let e=(r=class extends h{},r.manifest=t,r.frag=n,r);be(e.prototype,e.observedAttributes.filter(i=>!["color","speed","state"].includes(i))),customElements.define(t.tag,e)}var x=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength"]}connectedCallback(){this.gl||(this.gl=L(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{O(this.gl),this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof h&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,i){let a=i??"";e==="interaction"?(this.interactionNames=a.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>y.get(o)?.setup?.(this))):e==="effect"?this.effectNames=a.split(/\s+/).filter(Boolean):e==="theme"?this.theme=a||"auto":e==="paused"&&(this.paused=i!==null,this.paused?this.stop():this.start())}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),i=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==i)&&(this.canvas.width=r,this.canvas.height=i);for(let a of this.objects){let o=a.getBoundingClientRect();a.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let i=this.gl;if(!i||this.width===0||this.height===0)return;for(let s of this.objects)s.update(e,r);for(let s of this.interactionNames)y.get(s)?.frame(this,r,this.pointer);i.bindFramebuffer(i.FRAMEBUFFER,null),i.viewport(0,0,this.canvas.width,this.canvas.height),i.disable(i.SCISSOR_TEST),i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),i.enable(i.SCISSOR_TEST);let a=this.themeValue,o=[...this.objects].filter(s=>s.rect&&!s.broken).sort((s,l)=>s.anim.z-l.anim.z);for(let s of o)this.draw(i,s,e,a);i.disable(i.SCISSOR_TEST)}draw(e,r,i,a){let o=r.rect,s=r.manifest.bleed??1.5,l=o.x+o.width/2+r.anim.offset[0],c=o.y+o.height/2+r.anim.offset[1],u=o.width*s,m=o.height*s,d=Math.round((l-u/2)*this.dpr),C=Math.round((this.height-c-m/2)*this.dpr),g=Math.round(u*this.dpr),v=Math.round(m*this.dpr);if(g<=0||v<=0)return;let M;try{M=k(e,r.frag)}catch(oe){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${oe.message}`);return}e.viewport(d,C,g,v),e.scissor(d,C,g,v),e.useProgram(M.prog);let ae=this.pointer.inside?[(this.pointer.x-l)/u*2,-((this.pointer.y-c)/m)*2]:[0,0];j(e,M,{uTime:i,uResolution:[g,v],uPointer:ae,uRotation:r.anim.rotation,uScale:r.anim.scale/s,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:a,uColor:r.color,...r.uniforms}),D(e)}};var G=Math.PI/180,H={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*G,Math.sin(t*2*Math.PI/6)*8*G,0]})};var V={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var B={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var W={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let n=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*n,state:.1*n}}};var Y={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var ge=[H,V,B,W,Y];for(let t of ge)b.set(t.meta.name,t);var $={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Q=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var X={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Z=`uniform float thickness;
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
`;var K={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var J=`uniform float facets;
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
`;var ee={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var te=`uniform float turns;
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
`;var re={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var ie=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var ne={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var se=`uniform float radius;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",x);f($,Q);f(X,Z);f(K,J);f(ee,te);f(re,ie);f(ne,se);export{h as SdObject,x as SdScene,f as defineObject,I as registry};
//# sourceMappingURL=solids.js.map
