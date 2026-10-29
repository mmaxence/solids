var ct=Object.defineProperty;var lt=(e,i)=>{for(var t in i)ct(e,t,{get:i[t],enumerable:!0})};var P=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var E=`#version 300 es
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
`;var S=new WeakMap;function T(e){let i=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(i.bindVertexArray(i.createVertexArray()),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i):null}function L(e,i,t){let r=e.createShader(i);if(e.shaderSource(r,t),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(r)||"shader compile failed");return r}function D(e,i,t=!0){let r=S.get(e);r||S.set(e,r=new Map);let n=(t?"o":"e")+i,o=r.get(n);if(o)return o;let a=t?E+`
`+i:i,s=e.createProgram();if(e.attachShader(s,L(e,e.VERTEX_SHADER,P)),e.attachShader(s,L(e,e.FRAGMENT_SHADER,a)),e.linkProgram(s),!e.getProgramParameter(s,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(s)||"link failed");let c=new Map,l=e.getProgramParameter(s,e.ACTIVE_UNIFORMS);for(let m=0;m<l;m++){let d=e.getActiveUniform(s,m);c.set(d.name,e.getUniformLocation(s,d.name))}let u={prog:s,loc:c};return r.set(n,u),u}function I(e){S.delete(e)}function N(e,i,t){for(let[r,n]of Object.entries(t)){let o=i.loc.get(r);o!==void 0&&(typeof n=="number"?e.uniform1f(o,n):n.length===2?e.uniform2f(o,n[0],n[1]):n.length===3?e.uniform3f(o,n[0],n[1],n[2]):n.length===4?e.uniform4f(o,n[0],n[1],n[2],n[3]):n.length===9&&e.uniformMatrix3fv(o,!1,n))}}function O(e){e.drawArrays(e.TRIANGLES,0,3)}var j={};lt(j,{animations:()=>b,effects:()=>ut,interactions:()=>y,objects:()=>w});var w=new Map,b=new Map,ut=new Map,y=new Map;var p=(e,i,t)=>e+(i-e)*t,k=(e,i,t,r)=>e+(i-e)*(1-Math.exp(-t/Math.max(r,1))),_=new Float32Array([1,0,0,0,1,0,0,0,1]);function F(e,i,t){let r=Math.cos(e),n=Math.sin(e),o=Math.cos(i),a=Math.sin(i),s=Math.cos(t),c=Math.sin(t);return new Float32Array([o*s,o*c,-a,n*a*s-r*c,n*a*c+r*s,n*o,r*a*s+n*c,r*a*c-n*s,r*o])}function A(e){e=e.trim();let i=e.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(t=>parseInt(t+t,16)/255);if(i=e.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(t=>parseInt(i[1].slice(t,t+2),16)/255);if(i=e.match(/^rgba?\(([^)]+)\)$/i),i){let t=i[1].split(/[\s,\/]+/).map(Number);if(t.length>=3&&t.every(r=>!isNaN(r)))return[t[0]/255,t[1]/255,t[2]/255]}return null}var pt={off:0,idle:.25,busy:.6,active:1},ht=["animation","speed","effect","state","color","size","gravity"],U=e=>e.replace(/-([a-z])/g,(i,t)=>t.toUpperCase()),G=e=>e.replace(/[A-Z]/g,i=>"-"+i.toLowerCase()),h=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.anim={rotation:new Float32Array(_),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=z(r.default,r.type)??0}static get observedAttributes(){return[...ht,...this.manifest.uniforms.map(t=>G(t.name))]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let t=this.closest("sd-scene");t?t.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(t,r,n){let o=n??"";switch(t){case"animation":this.animNames=o.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=o.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(o)||1;return;case"state":this.stateTarget=pt[o]??.25;return;case"color":{let s=A(o);s&&(this.color=s);return}case"size":this.style.setProperty("--sd-size",o);return;case"gravity":return}let a=this.manifest.uniforms.find(s=>G(s.name)===t);if(a){let s=z(o,a.type);s!==null&&(this.uniforms[a.name]=s)}}update(t,r){this.state=k(this.state,this.stateTarget,r,150);let n=dt()?0:t*this.speed,o={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let c=b.get(s)?.fn(n,this.speed,this);if(c){if(c.rotation)for(let l=0;l<3;l++)o.rotation[l]+=c.rotation[l];c.offset&&(o.offset[0]+=c.offset[0],o.offset[1]+=c.offset[1]),c.scale!==void 0&&(o.scale*=c.scale),c.state!==void 0&&(o.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let a=o;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let s=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;a={rotation:[0,1,2].map(l=>p(c.rotation[l],o.rotation[l],s)),offset:[p(c.offset[0],o.offset[0],s),p(c.offset[1],o.offset[1],s)],scale:p(c.scale,o.scale,s),state:p(c.state,o.state,s)}}this.lastPose=a,this.anim.rotation=F(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}},R=null;function dt(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(R??(R=matchMedia("(prefers-reduced-motion: reduce)")),R.matches)}function z(e,i){if(i==="float"){let r=typeof e=="number"?e:Number(e);return isNaN(r)?null:r}if(i==="color")return Array.isArray(e)?e:A(String(e));if(Array.isArray(e))return e;let t=String(e).split(/[\s,]+/).map(Number);return t.length===3&&t.every(r=>!isNaN(r))?t:null}function bt(e,i){for(let t of i)Object.getOwnPropertyDescriptor(e,U(t))||Object.defineProperty(e,U(t),{get(){return this.getAttribute(t)},set(r){r==null?this.removeAttribute(t):this.setAttribute(t,String(r))}})}function f(e,i){var r;if(!e?.tag||customElements.get(e.tag))return;w.set(e.name,{manifest:e,frag:i});let t=(r=class extends h{},r.manifest=e,r.frag=i,r);bt(t.prototype,t.observedAttributes.filter(n=>!["color","speed","state"].includes(n))),customElements.define(e.tag,t)}var x=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.onPointer=t=>{let r=this.getBoundingClientRect();this.pointer={x:t.clientX-r.left,y:t.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=t=>{this.raf=0,this.t0||(this.t0=t);let r=this.last?Math.min(t-this.last,100):16;this.last=t,this.frame((t-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let t=this.attachShadow({mode:"open"});t.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=t.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength"]}connectedCallback(){this.gl||(this.gl=T(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",t=>{t.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{I(this.gl),this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([t])=>{this.visible=t.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let t of this.querySelectorAll("*"))t instanceof h&&this.attach(t);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(t,r,n){let o=n??"";t==="interaction"?(this.interactionNames=o.split(/\s+/).filter(Boolean),this.interactionNames.forEach(a=>y.get(a)?.setup?.(this))):t==="effect"?this.effectNames=o.split(/\s+/).filter(Boolean):t==="theme"?this.theme=o||"auto":t==="paused"&&(this.paused=n!==null,this.paused?this.stop():this.start())}attach(t){this.objects.has(t)||(this.objects.add(t),t.scene=this,this.ro?.observe(t),this.measure())}detach(t){this.objects.delete(t),t.scene=null,this.ro?.unobserve(t)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let t=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=t.width,this.height=t.height;let r=Math.round(t.width*this.dpr),n=Math.round(t.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let o of this.objects){let a=o.getBoundingClientRect();o.rect=new DOMRect(a.left-t.left,a.top-t.top,a.width,a.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(t,r){let n=this.gl;if(!n||this.width===0||this.height===0)return;for(let s of this.objects)s.update(t,r);for(let s of this.interactionNames)y.get(s)?.frame(this,r,this.pointer);n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,this.canvas.width,this.canvas.height),n.disable(n.SCISSOR_TEST),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.enable(n.SCISSOR_TEST);let o=this.themeValue,a=[...this.objects].filter(s=>s.rect&&!s.broken).sort((s,c)=>s.anim.z-c.anim.z);for(let s of a)this.draw(n,s,t,o);n.disable(n.SCISSOR_TEST)}draw(t,r,n,o){let a=r.rect,s=r.manifest.bleed??1.5,c=a.x+a.width/2+r.anim.offset[0],l=a.y+a.height/2+r.anim.offset[1],u=a.width*s,m=a.height*s,d=Math.round((c-u/2)*this.dpr),C=Math.round((this.height-l-m/2)*this.dpr),g=Math.round(u*this.dpr),v=Math.round(m*this.dpr);if(g<=0||v<=0)return;let M;try{M=D(t,r.frag)}catch(at){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${at.message}`);return}t.viewport(d,C,g,v),t.scissor(d,C,g,v),t.useProgram(M.prog);let ot=this.pointer.inside?[(this.pointer.x-c)/u*2,-((this.pointer.y-l)/m)*2]:[0,0];N(t,M,{uTime:n,uResolution:[g,v],uPointer:ot,uRotation:r.anim.rotation,uScale:r.anim.scale/s,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:o,uColor:r.color,...r.uniforms}),O(t)}};var V=Math.PI/180,W={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:e=>({rotation:[Math.sin(e*2*Math.PI/9)*4*V,Math.sin(e*2*Math.PI/6)*8*V,0]})};var B={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:e=>({rotation:[0,e*2*Math.PI/8,0]})};var H={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:e=>({scale:1+.06*Math.sin(e*2*Math.PI*1.2)})};var q={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:e=>{let i=Math.sin(e*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var Y={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:e=>({offset:[Math.sin(e*2*Math.PI*.17)*3,Math.sin(e*2*Math.PI*.4)*6]})};var gt=[W,B,H,q,Y];for(let e of gt)b.set(e.meta.name,e);var $={};var Q={};var X={};var Z={};var K={};var J={};var tt={};var et={};var rt={};var nt={};var it={};var st={};customElements.get("sd-scene")||customElements.define("sd-scene",x);f($,Q);f(X,Z);f(K,J);f(tt,et);f(rt,nt);f(it,st);export{h as SdObject,x as SdScene,f as defineObject,j as registry};
//# sourceMappingURL=core.js.map
