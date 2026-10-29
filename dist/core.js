var V=Object.defineProperty;var W=(t,i)=>{for(var e in i)V(t,e,{get:i[e],enumerable:!0})};var w=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var R=`#version 300 es
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
`;var y=new WeakMap;function E(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(i.bindVertexArray(i.createVertexArray()),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i):null}function C(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function A(t,i,e=!0){let r=y.get(t);r||y.set(t,r=new Map);let n=(e?"o":"e")+i,o=r.get(n);if(o)return o;let a=e?R+`
`+i:i,s=t.createProgram();if(t.attachShader(s,C(t,t.VERTEX_SHADER,w)),t.attachShader(s,C(t,t.FRAGMENT_SHADER,a)),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s)||"link failed");let c=new Map,h=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let l=0;l<h;l++){let f=t.getActiveUniform(s,l);c.set(f.name,t.getUniformLocation(s,f.name))}let m={prog:s,loc:c};return r.set(n,m),m}function L(t){y.delete(t)}function T(t,i,e){for(let[r,n]of Object.entries(e)){let o=i.loc.get(r);o!==void 0&&(typeof n=="number"?t.uniform1f(o,n):n.length===2?t.uniform2f(o,n[0],n[1]):n.length===3?t.uniform3f(o,n[0],n[1],n[2]):n.length===4?t.uniform4f(o,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(o,!1,n))}}function N(t){t.drawArrays(t.TRIANGLES,0,3)}var O={};W(O,{animations:()=>q,effects:()=>$,interactions:()=>b,objects:()=>x});var x=new Map,q=new Map,$=new Map,b=new Map;var P=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),j=new Float32Array([1,0,0,0,1,0,0,0,1]);function S(t){t=t.trim();let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(e=>parseInt(e+e,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(e=>parseInt(i[1].slice(e,e+2),16)/255);if(i=t.match(/^rgba?\(([^)]+)\)$/i),i){let e=i[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var Y={off:0,idle:.25,busy:.6,active:1},Q=["animation","speed","effect","state","color","size","gravity"],k=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),D=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase()),u=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.anim={rotation:new Float32Array(j),offset:[0,0],scale:1,z:0};this.broken=!1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=I(r.default,r.type)??0}static get observedAttributes(){return[...Q,...this.manifest.uniforms.map(e=>D(e.name))]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,n){let o=n??"";switch(e){case"animation":this.animNames=o.split(/\s+/).filter(Boolean);return;case"effect":this.effectNames=o.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(o)||1;return;case"state":this.stateTarget=Y[o]??.25;return;case"color":{let s=S(o);s&&(this.color=s);return}case"size":this.style.setProperty("--sd-size",o);return;case"gravity":return}let a=this.manifest.uniforms.find(s=>D(s.name)===e);if(a){let s=I(o,a.type);s!==null&&(this.uniforms[a.name]=s)}}update(e,r){this.state=P(this.state,this.stateTarget,r,150)}};function I(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:S(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function X(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,k(e))||Object.defineProperty(t,k(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function U(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;x.set(t.name,{manifest:t,frag:i});let e=(r=class extends u{},r.manifest=t,r.frag=i,r);X(e.prototype,e.observedAttributes.filter(n=>!["color","speed","state"].includes(n))),customElements.define(t.tag,e)}var g=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength"]}connectedCallback(){this.gl||(this.gl=E(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{L(this.gl),this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof u&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let o=n??"";e==="interaction"?(this.interactionNames=o.split(/\s+/).filter(Boolean),this.interactionNames.forEach(a=>b.get(a)?.setup?.(this))):e==="effect"?this.effectNames=o.split(/\s+/).filter(Boolean):e==="theme"?this.theme=o||"auto":e==="paused"&&(this.paused=n!==null,this.paused?this.stop():this.start())}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),n=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let o of this.objects){let a=o.getBoundingClientRect();o.rect=new DOMRect(a.left-e.left,a.top-e.top,a.width,a.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl;if(!n||this.width===0||this.height===0)return;for(let s of this.objects)s.update(e,r);for(let s of this.interactionNames)b.get(s)?.frame(this,r,this.pointer);n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,this.canvas.width,this.canvas.height),n.disable(n.SCISSOR_TEST),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.enable(n.SCISSOR_TEST);let o=this.themeValue,a=[...this.objects].filter(s=>s.rect&&!s.broken).sort((s,c)=>s.anim.z-c.anim.z);for(let s of a)this.draw(n,s,e,o);n.disable(n.SCISSOR_TEST)}draw(e,r,n,o){let a=r.rect,s=r.manifest.bleed??1.5,c=a.x+a.width/2+r.anim.offset[0],h=a.y+a.height/2+r.anim.offset[1],m=a.width*s,l=a.height*s,f=Math.round((c-m/2)*this.dpr),M=Math.round((this.height-h-l/2)*this.dpr),d=Math.round(m*this.dpr),p=Math.round(l*this.dpr);if(d<=0||p<=0)return;let v;try{v=A(e,r.frag)}catch(z){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${z.message}`);return}e.viewport(f,M,d,p),e.scissor(f,M,d,p),e.useProgram(v.prog);let G=this.pointer.inside?[(this.pointer.x-c)/m*2,-((this.pointer.y-h)/l)*2]:[0,0];T(e,v,{uTime:n,uResolution:[d,p],uPointer:G,uRotation:r.anim.rotation,uScale:r.anim.scale/s,uState:r.state,uTheme:o,uColor:r.color,...r.uniforms}),N(e)}};var _={};var F={};customElements.get("sd-scene")||customElements.define("sd-scene",g);U(_,F);export{u as SdObject,g as SdScene,U as defineObject,O as registry};
//# sourceMappingURL=core.js.map
