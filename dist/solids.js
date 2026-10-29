var K=Object.defineProperty;var J=(t,i)=>{for(var e in i)K(t,e,{get:i[e],enumerable:!0})};var C=`#version 300 es
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
  vec3 body = uColor * (0.18 + 0.5 * diff) * (0.8 + 0.4 * uState);
  vec3 col = body + uColor * fres * rim * 0.9 + vec3(1.0) * (spec * 0.85 + fres * 0.18);
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
`;var M=new WeakMap;function L(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(i.bindVertexArray(i.createVertexArray()),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i):null}function E(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function T(t,i,e=!0){let r=M.get(t);r||M.set(t,r=new Map);let n=(e?"o":"e")+i,o=r.get(n);if(o)return o;let a=e?P+`
`+i:i,s=t.createProgram();if(t.attachShader(s,E(t,t.VERTEX_SHADER,C)),t.attachShader(s,E(t,t.FRAGMENT_SHADER,a)),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s)||"link failed");let c=new Map,l=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let m=0;m<l;m++){let p=t.getActiveUniform(s,m);c.set(p.name,t.getUniformLocation(s,p.name))}let f={prog:s,loc:c};return r.set(n,f),f}function D(t){M.delete(t)}function I(t,i,e){for(let[r,n]of Object.entries(e)){let o=i.loc.get(r);o!==void 0&&(typeof n=="number"?t.uniform1f(o,n):n.length===2?t.uniform2f(o,n[0],n[1]):n.length===3?t.uniform3f(o,n[0],n[1],n[2]):n.length===4?t.uniform4f(o,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(o,!1,n))}}function N(t){t.drawArrays(t.TRIANGLES,0,3)}var j={};J(j,{animations:()=>d,effects:()=>re,interactions:()=>v,objects:()=>S});var S=new Map,d=new Map,re=new Map,v=new Map;var u=(t,i,e)=>t+(i-t)*e,O=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),k=new Float32Array([1,0,0,0,1,0,0,0,1]);function _(t,i,e){let r=Math.cos(t),n=Math.sin(t),o=Math.cos(i),a=Math.sin(i),s=Math.cos(e),c=Math.sin(e);return new Float32Array([o*s,o*c,-a,n*a*s-r*c,n*a*c+r*s,n*o,r*a*s+n*c,r*a*c-n*s,r*o])}function w(t){t=t.trim();let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(e=>parseInt(e+e,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(e=>parseInt(i[1].slice(e,e+2),16)/255);if(i=t.match(/^rgba?\(([^)]+)\)$/i),i){let e=i[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var ne={off:0,idle:.25,busy:.6,active:1},ie=["animation","speed","effect","state","color","size","gravity"],U=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),F=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase()),h=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.anim={rotation:new Float32Array(k),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=G(r.default,r.type)??0}static get observedAttributes(){return[...ie,...this.manifest.uniforms.map(e=>F(e.name))]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,n){let o=n??"";switch(e){case"animation":this.animNames=o.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=o.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(o)||1;return;case"state":this.stateTarget=ne[o]??.25;return;case"color":{let s=w(o);s&&(this.color=s);return}case"size":this.style.setProperty("--sd-size",o);return;case"gravity":return}let a=this.manifest.uniforms.find(s=>F(s.name)===e);if(a){let s=G(o,a.type);s!==null&&(this.uniforms[a.name]=s)}}update(e,r){this.state=O(this.state,this.stateTarget,r,150);let n=se()?0:e*this.speed,o={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let c=d.get(s)?.fn(n,this.speed,this);if(c){if(c.rotation)for(let l=0;l<3;l++)o.rotation[l]+=c.rotation[l];c.offset&&(o.offset[0]+=c.offset[0],o.offset[1]+=c.offset[1]),c.scale!==void 0&&(o.scale*=c.scale),c.state!==void 0&&(o.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let a=o;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let s=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;a={rotation:[0,1,2].map(l=>u(c.rotation[l],o.rotation[l],s)),offset:[u(c.offset[0],o.offset[0],s),u(c.offset[1],o.offset[1],s)],scale:u(c.scale,o.scale,s),state:u(c.state,o.state,s)}}this.lastPose=a,this.anim.rotation=_(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}},A=null;function se(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(A??(A=matchMedia("(prefers-reduced-motion: reduce)")),A.matches)}function G(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:w(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function oe(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,U(e))||Object.defineProperty(t,U(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function z(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;S.set(t.name,{manifest:t,frag:i});let e=(r=class extends h{},r.manifest=t,r.frag=i,r);oe(e.prototype,e.observedAttributes.filter(n=>!["color","speed","state"].includes(n))),customElements.define(t.tag,e)}var y=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength"]}connectedCallback(){this.gl||(this.gl=L(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{D(this.gl),this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof h&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let o=n??"";e==="interaction"?(this.interactionNames=o.split(/\s+/).filter(Boolean),this.interactionNames.forEach(a=>v.get(a)?.setup?.(this))):e==="effect"?this.effectNames=o.split(/\s+/).filter(Boolean):e==="theme"?this.theme=o||"auto":e==="paused"&&(this.paused=n!==null,this.paused?this.stop():this.start())}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),n=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let o of this.objects){let a=o.getBoundingClientRect();o.rect=new DOMRect(a.left-e.left,a.top-e.top,a.width,a.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl;if(!n||this.width===0||this.height===0)return;for(let s of this.objects)s.update(e,r);for(let s of this.interactionNames)v.get(s)?.frame(this,r,this.pointer);n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,this.canvas.width,this.canvas.height),n.disable(n.SCISSOR_TEST),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.enable(n.SCISSOR_TEST);let o=this.themeValue,a=[...this.objects].filter(s=>s.rect&&!s.broken).sort((s,c)=>s.anim.z-c.anim.z);for(let s of a)this.draw(n,s,e,o);n.disable(n.SCISSOR_TEST)}draw(e,r,n,o){let a=r.rect,s=r.manifest.bleed??1.5,c=a.x+a.width/2+r.anim.offset[0],l=a.y+a.height/2+r.anim.offset[1],f=a.width*s,m=a.height*s,p=Math.round((c-f/2)*this.dpr),R=Math.round((this.height-l-m/2)*this.dpr),b=Math.round(f*this.dpr),g=Math.round(m*this.dpr);if(b<=0||g<=0)return;let x;try{x=T(e,r.frag)}catch(Z){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${Z.message}`);return}e.viewport(p,R,b,g),e.scissor(p,R,b,g),e.useProgram(x.prog);let X=this.pointer.inside?[(this.pointer.x-c)/f*2,-((this.pointer.y-l)/m)*2]:[0,0];I(e,x,{uTime:n,uResolution:[b,g],uPointer:X,uRotation:r.anim.rotation,uScale:r.anim.scale/s,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:o,uColor:r.color,...r.uniforms}),N(e)}};var V=Math.PI/180,W={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*V,Math.sin(t*2*Math.PI/6)*8*V,0]})};var H={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var B={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var q={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var Y={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var ae=[W,H,B,q,Y];for(let t of ae)d.set(t.meta.name,t);var $={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Q=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;customElements.get("sd-scene")||customElements.define("sd-scene",y);z($,Q);export{h as SdObject,y as SdScene,z as defineObject,j as registry};
//# sourceMappingURL=solids.js.map
