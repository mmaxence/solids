var Be=Object.defineProperty;var Ge=(t,s)=>{for(var e in s)Be(t,e,{get:s[e],enumerable:!0})};var W=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var X=`#version 300 es
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
`;var H=`#version 300 es
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
`;var D=new WeakMap;function q(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(s.bindVertexArray(s.createVertexArray()),s.enable(s.BLEND),s.blendFunc(s.ONE,s.ONE_MINUS_SRC_ALPHA),s):null}function V(t,s,e){let r=t.createShader(s);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function P(t,s,e="object"){let r=D.get(t);r||D.set(t,r=new Map);let a=e[0]+s,o=r.get(a);if(o)return o;let n=(e==="object"?X:H)+`
`+s,i=t.createProgram();if(t.attachShader(i,V(t,t.VERTEX_SHADER,W)),t.attachShader(i,V(t,t.FRAGMENT_SHADER,n)),t.linkProgram(i),!t.getProgramParameter(i,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(i)||"link failed");let c=new Map,m=t.getProgramParameter(i,t.ACTIVE_UNIFORMS);for(let u=0;u<m;u++){let f=t.getActiveUniform(i,u);c.set(f.name,t.getUniformLocation(i,f.name))}let l={prog:i,loc:c};return r.set(a,l),l}function $(t){D.delete(t)}function F(t,s,e){for(let[r,a]of Object.entries(e)){let o=s.loc.get(r);o!==void 0&&(typeof a=="number"?t.uniform1f(o,a):a.length===1?t.uniform1i(o,a[0]):a.length===2?t.uniform2f(o,a[0],a[1]):a.length===3?t.uniform3f(o,a[0],a[1],a[2]):a.length===4?t.uniform4f(o,a[0],a[1],a[2],a[3]):a.length===9&&t.uniformMatrix3fv(o,!1,a))}}function L(t){t.drawArrays(t.TRIANGLES,0,3)}function M(t,s,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let a=t.createFramebuffer(),o={fb:a,tex:r,w:0,h:0};return v(t,o,s,e),t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),o}function v(t,s,e,r){e=Math.max(1,e),r=Math.max(1,r),!(s.w===e&&s.h===r)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=r)}var Y={};Ge(Y,{animations:()=>E,effectAttrs:()=>T,effectParam:()=>A,effects:()=>b,interactions:()=>R,kebab:()=>S,objects:()=>N});var N=new Map,E=new Map,b=new Map,R=new Map,T=()=>[...b.values()].flatMap(t=>t.manifest.params.map(s=>`${t.manifest.name}-${S(s.name)}`)),S=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function A(t,s,e){var r;for(let a of b.values()){let o=a.manifest.name+"-";if(!t.startsWith(o))continue;let n=a.manifest.params.find(c=>S(c.name)===t.slice(o.length));if(!n)continue;let i=Number(s);return(e[r=a.manifest.name]??(e[r]={}))[n.name]=isNaN(i)?n.default:i,!0}return!1}var g=(t,s,e)=>t+(s-t)*e,O=(t,s,e,r)=>t+(s-t)*(1-Math.exp(-e/Math.max(r,1))),Q=new Float32Array([1,0,0,0,1,0,0,0,1]);function j(t,s,e){let r=Math.cos(t),a=Math.sin(t),o=Math.cos(s),n=Math.sin(s),i=Math.cos(e),c=Math.sin(e);return new Float32Array([o*i,o*c,-n,a*n*i-r*c,a*n*c+r*i,a*o,r*n*i+a*c,r*n*c-a*i,r*o])}function Z(t,s){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let a=0;a<3;a++)e[r*3+a]=t[a]*s[r*3]+t[3+a]*s[r*3+1]+t[6+a]*s[r*3+2];return e}function I(t){t=t.trim();let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(e=>parseInt(e+e,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(e=>parseInt(s[1].slice(e,e+2),16)/255);if(s=t.match(/^rgba?\(([^)]+)\)$/i),s){let e=s[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var He={off:0,idle:.25,busy:.6,active:1},Ve=["animation","speed","effect","state","color","size","gravity","gravity-gap"],J=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),w=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(Q),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=K(r.default,r.type)??0}static get observedAttributes(){return[...Ve,...this.manifest.uniforms.map(e=>S(e.name)),...T()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){if(this.scene)return;let e=document.createElement("sd-scene");this.shadowRoot.append(e),e.attach(this)}attributeChangedCallback(e,r,a){let o=a??"";switch(e){case"animation":this.animNames=o.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=o.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(o)||1;return;case"state":this.stateTarget=He[o]??.25;return;case"color":{let i=I(o);i&&(this.color=i);return}case"size":this.style.setProperty("--sd-size",o);return;case"gravity":case"gravity-gap":return}if(A(e,o,this.effectParams))return;let n=this.manifest.uniforms.find(i=>S(i.name)===e);if(n){let i=K(o,n.type);i!==null&&(this.uniforms[n.name]=i)}}update(e,r){this.state=O(this.state,this.stateTarget,r,150);let a=qe()?0:e*this.speed,o={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let c=E.get(i)?.fn(a,this.speed,this);if(c){if(c.rotation)for(let m=0;m<3;m++)o.rotation[m]+=c.rotation[m];c.offset&&(o.offset[0]+=c.offset[0],o.offset[1]+=c.offset[1]),c.scale!==void 0&&(o.scale*=c.scale),c.state!==void 0&&(o.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let n=o;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let i=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;n={rotation:[0,1,2].map(m=>g(c.rotation[m],o.rotation[m],i)),offset:[g(c.offset[0],o.offset[0],i),g(c.offset[1],o.offset[1],i)],scale:g(c.scale,o.scale,i),state:g(c.state,o.state,i)}}this.lastPose=n,this.anim.rotation=j(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=0}},B=null;function qe(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(B??(B=matchMedia("(prefers-reduced-motion: reduce)")),B.matches)}function K(t,s){if(s==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(s==="color")return Array.isArray(t)?t:I(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function $e(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,J(e))||Object.defineProperty(t,J(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function x(t,s){var r;if(!t?.tag||customElements.get(t.tag))return;N.set(t.name,{manifest:t,frag:s});let e=(r=class extends w{},r.manifest=t,r.frag=s,r);$e(e.prototype,e.observedAttributes.filter(a=>!["color","speed","state"].includes(a))),customElements.define(t.tag,e)}var ee=`void main() { fragColor = texture(uScene, vUv); }
`;var U=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...T()]}connectedCallback(){if(!this.gl){if(this.gl=q(this.canvas),!this.gl){this.dataset.fallback="";for(let e of this.objects)e.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{$(this.gl),this.fbos=null,this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof w&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,a){let o=a??"";e==="interaction"?(this.interactionNames=o.split(/\s+/).filter(Boolean),this.interactionNames.forEach(n=>R.get(n)?.setup?.(this))):e==="effect"?this.effectNames=o.split(/\s+/).filter(Boolean):e==="theme"?this.theme=o||"auto":e==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):A(e,o,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),a=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let o of this.objects){let n=o.getBoundingClientRect();o.rect=new DOMRect(n.left-e.left,n.top-e.top,n.width,n.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let a=this.gl,o=this.canvas.width,n=this.canvas.height;if(!a||o===0||n===0)return;for(let f of this.objects)f.update(e,r);for(let f of this.interactionNames)R.get(f)?.frame(this,r,this.pointer);let i=this.fbos??(this.fbos={scene:M(a,o,n),a:M(a,o,n),b:M(a,o,n),oa:M(a,1,1),ob:M(a,1,1)});v(a,i.scene,o,n),v(a,i.a,o,n),v(a,i.b,o,n);let c=this.themeValue;this.bind(a,i.scene,0,0,o,n,!0);let m=[...this.objects].filter(f=>f.rect&&!f.broken).sort((f,p)=>f.anim.z-p.anim.z);for(let f of m)this.draw(a,f,e,c,i);let l=i.scene,u=this.effectNames.filter(f=>b.has(f));for(let f of u){let p=l===i.a?i.b:i.a;this.bind(a,p,0,0,o,n,!0),this.pass(a,f,l,this.effectParams[f],[o,n],e,c),l=p}this.bind(a,null,0,0,o,n,!0),this.blit(a,l)}bind(e,r,a,o,n,i,c){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(a,o,n,i),e.scissor(a,o,n,i),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let a=P(e,ee,"effect");e.useProgram(a.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),F(e,a,{uScene:[0]}),L(e)}pass(e,r,a,o,n,i,c){let m=b.get(r),l;try{l=P(e,m.frag,"effect")}catch(f){console.error(`[solids] effect "${r}" shader failed:
${f.message}`),this.blit(e,a);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex);let u={};for(let f of m.manifest.params)u[f.name]=f.default;F(e,l,{uScene:[0],uResolution:n,uTime:i,uTheme:c,...u,...o}),L(e)}draw(e,r,a,o,n){let i=r.rect,c=r.manifest.bleed??1.5,m=i.x+i.width/2+r.anim.offset[0],l=i.y+i.height/2+r.anim.offset[1],u=i.width*c,f=i.height*c,p=Math.round((m-u/2)*this.dpr),G=Math.round((this.height-l-f/2)*this.dpr),h=Math.round(u*this.dpr),d=Math.round(f*this.dpr);if(h<=0||d<=0)return;let _;try{_=P(e,r.frag)}catch(y){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${y.message}`);return}let k=r.effectNames.filter(y=>b.has(y));k.length?(v(e,n.oa,h,d),v(e,n.ob,h,d),this.bind(e,n.oa,0,0,h,d,!0)):this.bind(e,n.scene,p,G,h,d,!1),e.useProgram(_.prog);let Ie=this.pointer.inside?[(this.pointer.x-m)/u*2,-((this.pointer.y-l)/f)*2]:[0,0];if(F(e,_,{uTime:a,uResolution:[h,d],uPointer:Ie,uRotation:r.anim.rotation,uScale:r.anim.scale/c,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:o,uColor:r.color,...r.uniforms}),L(e),!k.length)return;let C=n.oa;for(let y of k){let z=C===n.oa?n.ob:n.oa;this.bind(e,z,0,0,h,d,!0),this.pass(e,y,C,r.effectParams[y],[h,d],a,o),C=z}this.bind(e,n.scene,p,G,h,d,!1),this.blit(e,C)}};var te=Math.PI/180,re={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*te,Math.sin(t*2*Math.PI/6)*8*te,0]})};var ne={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var ae={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var oe={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var ie={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Qe=[re,ne,ae,oe,ie];for(let t of Qe)E.set(t.meta.name,t);var se={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var ce=`uniform float threshold;
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
`;var me={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var fe=`uniform float angle;
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
`;var le={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ue=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var pe={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var he=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var de={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var be=`uniform float levels;
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
`;var ge={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var ve=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var mt=[{manifest:se,frag:ce},{manifest:me,frag:fe},{manifest:le,frag:ue},{manifest:pe,frag:he},{manifest:de,frag:be},{manifest:ge,frag:ve}];for(let t of mt)b.set(t.manifest.name,t);var xe=new WeakMap,ye=20*Math.PI/180,Me={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let o=Math.max(1,Math.round(s/16));for(let n of t.objects){if(!n.rect)continue;let i=xe.get(n)??xe.set(n,{rx:0,ry:0,vx:0,vy:0}).get(n),c=0,m=0;if(e.inside){let l=n.rect.x+n.rect.width/2+n.anim.offset[0],u=n.rect.y+n.rect.height/2+n.anim.offset[1],f=(e.x-l)/Math.max(t.width,1),p=(e.y-u)/Math.max(t.height,1);m=Math.max(-1,Math.min(1,f*2))*ye,c=Math.max(-1,Math.min(1,p*2))*ye}for(let l=0;l<o;l++)i.vx=(i.vx+(c-i.rx)*.08)*.8,i.rx+=i.vx,i.vy=(i.vy+(m-i.ry)*.08)*.8,i.ry+=i.vy;n.anim.rotation=Z(j(i.rx,i.ry,0),n.anim.rotation)}}};var Re=new WeakMap,Se={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let r of t.objects){if(!r.rect)continue;let a=r.rect.x+r.rect.width/2+r.anim.offset[0],o=r.rect.y+r.rect.height/2+r.anim.offset[1],n=e.inside&&Math.abs(e.x-a)<=r.rect.width/2&&Math.abs(e.y-o)<=r.rect.height/2,i=O(Re.get(r)??0,n?1:0,s,160);Re.set(r,i),r.anim.scale*=1+.08*i,r.anim.state+=i*(1-r.state)}}};var we=new WeakMap,Ee=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],ft=t=>t*t*(3-2*t),Te={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(n=>n.rect),r=e.find(n=>n.getAttribute("gravity")==="center");if(!r)return;let a=Number(t.getAttribute("gravity-strength"))||.6,o=Ee(r);for(let n of e){if(n===r)continue;let i=n.getAttribute("gravity");if(i==="none")continue;let c=Ee(n),m=we.get(n)??we.set(n,{angle:0,r:0,center:null,from:[0,0],k:1}).get(n);m.center!==r&&(m.from=[n.anim.offset[0],n.anim.offset[1]],m.k=m.center?0:1,m.center=r,m.angle=Math.atan2(c[1]-o[1],c[0]-o[0]),m.r=Math.hypot(c[0]-o[0],c[1]-o[1]));let l,u=0;if(i==="fall"){let p=(Number(n.getAttribute("gravity-gap"))||24)+(r.rect.width+n.rect.width)/4;m.r+=(p-m.r)*(1-Math.exp(-s/700))*(.3+a),l=[o[0]+Math.cos(m.angle)*m.r-c[0],o[1]+Math.sin(m.angle)*m.r-c[1]]}else m.angle+=s/1e3*.25*a,u=Math.sin(m.angle),l=[o[0]+Math.cos(m.angle)*m.r-c[0],o[1]+Math.sin(m.angle)*m.r-c[1]];if(m.k<1){m.k=Math.min(1,m.k+s/800);let f=ft(m.k);l=[g(m.from[0],l[0],f),g(m.from[1],l[1],f)]}n.anim.offset[0]+=l[0],n.anim.offset[1]+=l[1],n.anim.z=u,n.anim.scale*=1+.06*u}}};var lt=[Me,Se,Te];for(let t of lt)R.set(t.meta.name,t);var Ae={};var Ce={};var Pe={};var Fe={};var Le={};var Oe={};var je={};var Ue={};var _e={};var ke={};var De={};var Ne={};customElements.get("sd-scene")||customElements.define("sd-scene",U);x(Ae,Ce);x(Pe,Fe);x(Le,Oe);x(je,Ue);x(_e,ke);x(De,Ne);export{w as SdObject,U as SdScene,x as defineObject,Y as registry};
//# sourceMappingURL=core.js.map
