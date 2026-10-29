var Le=Object.defineProperty;var Ue=(t,i)=>{for(var e in i)Le(t,e,{get:i[e],enumerable:!0})};var G=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var z=`#version 300 es
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
`;var W=`#version 300 es
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
`;var D=new WeakMap;function H(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(i.bindVertexArray(i.createVertexArray()),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i):null}function X(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function P(t,i,e="object"){let r=D.get(t);r||D.set(t,r=new Map);let n=e[0]+i,a=r.get(n);if(a)return a;let o=(e==="object"?z:W)+`
`+i,s=t.createProgram();if(t.attachShader(s,X(t,t.VERTEX_SHADER,G)),t.attachShader(s,X(t,t.FRAGMENT_SHADER,o)),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s)||"link failed");let c=new Map,f=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let u=0;u<f;u++){let m=t.getActiveUniform(s,u);c.set(m.name,t.getUniformLocation(s,m.name))}let l={prog:s,loc:c};return r.set(n,l),l}function V(t){D.delete(t)}function C(t,i,e){for(let[r,n]of Object.entries(e)){let a=i.loc.get(r);a!==void 0&&(typeof n=="number"?t.uniform1f(a,n):n.length===1?t.uniform1i(a,n[0]):n.length===2?t.uniform2f(a,n[0],n[1]):n.length===3?t.uniform3f(a,n[0],n[1],n[2]):n.length===4?t.uniform4f(a,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(a,!1,n))}}function F(t){t.drawArrays(t.TRIANGLES,0,3)}function y(t,i,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let n=t.createFramebuffer(),a={fb:n,tex:r,w:0,h:0};return v(t,a,i,e),t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),a}function v(t,i,e,r){e=Math.max(1,e),r=Math.max(1,r),!(i.w===e&&i.h===r)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=r)}var q={};Ue(q,{animations:()=>T,effectAttrs:()=>S,effectParam:()=>w,effects:()=>h,interactions:()=>L,kebab:()=>M,objects:()=>N});var N=new Map,T=new Map,h=new Map,L=new Map,S=()=>[...h.values()].flatMap(t=>t.manifest.params.map(i=>`${t.manifest.name}-${M(i.name)}`)),M=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function w(t,i,e){var r;for(let n of h.values()){let a=n.manifest.name+"-";if(!t.startsWith(a))continue;let o=n.manifest.params.find(c=>M(c.name)===t.slice(a.length));if(!o)continue;let s=Number(i);return(e[r=n.manifest.name]??(e[r]={}))[o.name]=isNaN(s)?o.default:s,!0}return!1}var R=(t,i,e)=>t+(i-t)*e,$=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),Y=new Float32Array([1,0,0,0,1,0,0,0,1]);function Q(t,i,e){let r=Math.cos(t),n=Math.sin(t),a=Math.cos(i),o=Math.sin(i),s=Math.cos(e),c=Math.sin(e);return new Float32Array([a*s,a*c,-o,n*o*s-r*c,n*o*c+r*s,n*a,r*o*s+n*c,r*o*c-n*s,r*a])}function j(t){t=t.trim();let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(e=>parseInt(e+e,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(e=>parseInt(i[1].slice(e,e+2),16)/255);if(i=t.match(/^rgba?\(([^)]+)\)$/i),i){let e=i[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var Ne={off:0,idle:.25,busy:.6,active:1},je=["animation","speed","effect","state","color","size","gravity"],Z=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),E=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(Y),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=J(r.default,r.type)??0}static get observedAttributes(){return[...je,...this.manifest.uniforms.map(e=>M(e.name)),...S()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,n){let a=n??"";switch(e){case"animation":this.animNames=a.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=a.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(a)||1;return;case"state":this.stateTarget=Ne[a]??.25;return;case"color":{let s=j(a);s&&(this.color=s);return}case"size":this.style.setProperty("--sd-size",a);return;case"gravity":return}if(w(e,a,this.effectParams))return;let o=this.manifest.uniforms.find(s=>M(s.name)===e);if(o){let s=J(a,o.type);s!==null&&(this.uniforms[o.name]=s)}}update(e,r){this.state=$(this.state,this.stateTarget,r,150);let n=Be()?0:e*this.speed,a={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let c=T.get(s)?.fn(n,this.speed,this);if(c){if(c.rotation)for(let f=0;f<3;f++)a.rotation[f]+=c.rotation[f];c.offset&&(a.offset[0]+=c.offset[0],a.offset[1]+=c.offset[1]),c.scale!==void 0&&(a.scale*=c.scale),c.state!==void 0&&(a.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let o=a;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let s=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;o={rotation:[0,1,2].map(f=>R(c.rotation[f],a.rotation[f],s)),offset:[R(c.offset[0],a.offset[0],s),R(c.offset[1],a.offset[1],s)],scale:R(c.scale,a.scale,s),state:R(c.state,a.state,s)}}this.lastPose=o,this.anim.rotation=Q(o.rotation[0],o.rotation[1],o.rotation[2]),this.anim.offset=[o.offset[0],o.offset[1]],this.anim.scale=o.scale,this.anim.state=o.state,this.anim.z=0}},B=null;function Be(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(B??(B=matchMedia("(prefers-reduced-motion: reduce)")),B.matches)}function J(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:j(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function Ie(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,Z(e))||Object.defineProperty(t,Z(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function g(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;N.set(t.name,{manifest:t,frag:i});let e=(r=class extends E{},r.manifest=t,r.frag=i,r);Ie(e.prototype,e.observedAttributes.filter(n=>!["color","speed","state"].includes(n))),customElements.define(t.tag,e)}var K=`void main() { fragColor = texture(uScene, vUv); }
`;var U=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...S()]}connectedCallback(){this.gl||(this.gl=H(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{V(this.gl),this.fbos=null,this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof E&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let a=n??"";e==="interaction"?(this.interactionNames=a.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>L.get(o)?.setup?.(this))):e==="effect"?this.effectNames=a.split(/\s+/).filter(Boolean):e==="theme"?this.theme=a||"auto":e==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):w(e,a,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),n=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let a of this.objects){let o=a.getBoundingClientRect();a.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl,a=this.canvas.width,o=this.canvas.height;if(!n||a===0||o===0)return;for(let m of this.objects)m.update(e,r);for(let m of this.interactionNames)L.get(m)?.frame(this,r,this.pointer);let s=this.fbos??(this.fbos={scene:y(n,a,o),a:y(n,a,o),b:y(n,a,o),oa:y(n,1,1),ob:y(n,1,1)});v(n,s.scene,a,o),v(n,s.a,a,o),v(n,s.b,a,o);let c=this.themeValue;this.bind(n,s.scene,0,0,a,o,!0);let f=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,b)=>m.anim.z-b.anim.z);for(let m of f)this.draw(n,m,e,c,s);let l=s.scene,u=this.effectNames.filter(m=>h.has(m));for(let m of u){let b=l===s.a?s.b:s.a;this.bind(n,b,0,0,a,o,!0),this.pass(n,m,l,this.effectParams[m],[a,o],e,c),l=b}this.bind(n,null,0,0,a,o,!0),this.blit(n,l)}bind(e,r,n,a,o,s,c){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(n,a,o,s),e.scissor(n,a,o,s),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let n=P(e,K,"effect");e.useProgram(n.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),C(e,n,{uScene:[0]}),F(e)}pass(e,r,n,a,o,s,c){let f=h.get(r),l;try{l=P(e,f.frag,"effect")}catch(m){console.error(`[solids] effect "${r}" shader failed:
${m.message}`),this.blit(e,n);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.tex);let u={};for(let m of f.manifest.params)u[m.name]=m.default;C(e,l,{uScene:[0],uResolution:o,uTime:s,uTheme:c,...u,...a}),F(e)}draw(e,r,n,a,o){let s=r.rect,c=r.manifest.bleed??1.5,f=s.x+s.width/2+r.anim.offset[0],l=s.y+s.height/2+r.anim.offset[1],u=s.width*c,m=s.height*c,b=Math.round((f-u/2)*this.dpr),I=Math.round((this.height-l-m/2)*this.dpr),p=Math.round(u*this.dpr),d=Math.round(m*this.dpr);if(p<=0||d<=0)return;let O;try{O=P(e,r.frag)}catch(x){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${x.message}`);return}let _=r.effectNames.filter(x=>h.has(x));_.length?(v(e,o.oa,p,d),v(e,o.ob,p,d),this.bind(e,o.oa,0,0,p,d,!0)):this.bind(e,o.scene,b,I,p,d,!1),e.useProgram(O.prog);let Fe=this.pointer.inside?[(this.pointer.x-f)/u*2,-((this.pointer.y-l)/m)*2]:[0,0];if(C(e,O,{uTime:n,uResolution:[p,d],uPointer:Fe,uRotation:r.anim.rotation,uScale:r.anim.scale/c,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:a,uColor:r.color,...r.uniforms}),F(e),!_.length)return;let A=o.oa;for(let x of _){let k=A===o.oa?o.ob:o.oa;this.bind(e,k,0,0,p,d,!0),this.pass(e,x,A,r.effectParams[x],[p,d],n,a),A=k}this.bind(e,o.scene,b,I,p,d,!1),this.blit(e,A)}};var ee=Math.PI/180,te={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*ee,Math.sin(t*2*Math.PI/6)*8*ee,0]})};var re={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var ne={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ae={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var ie={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Ge=[te,re,ne,ae,ie];for(let t of Ge)T.set(t.meta.name,t);var oe={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var se=`uniform float threshold;
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
`;var ce={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var me=`uniform float angle;
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
`;var fe={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var le=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var ue={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var pe=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var de={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var he=`uniform float levels;
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
`;var be={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var ve=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var et=[{manifest:oe,frag:se},{manifest:ce,frag:me},{manifest:fe,frag:le},{manifest:ue,frag:pe},{manifest:de,frag:he},{manifest:be,frag:ve}];for(let t of et)h.set(t.manifest.name,t);var ge={};var xe={};var ye={};var Me={};var Re={};var Ee={};var Te={};var Se={};var we={};var Ae={};var Pe={};var Ce={};customElements.get("sd-scene")||customElements.define("sd-scene",U);g(ge,xe);g(ye,Me);g(Re,Ee);g(Te,Se);g(we,Ae);g(Pe,Ce);export{E as SdObject,U as SdScene,g as defineObject,q as registry};
//# sourceMappingURL=core.js.map
