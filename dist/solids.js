var Le=Object.defineProperty;var Oe=(t,i)=>{for(var e in i)Le(t,e,{get:i[e],enumerable:!0})};var I=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var G=`#version 300 es
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
`;var q=`#version 300 es
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
`;var D=new WeakMap;function X(t){let i=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return i?(i.bindVertexArray(i.createVertexArray()),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i):null}function W(t,i,e){let r=t.createShader(i);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function C(t,i,e="object"){let r=D.get(t);r||D.set(t,r=new Map);let a=e[0]+i,n=r.get(a);if(n)return n;let s=(e==="object"?G:q)+`
`+i,o=t.createProgram();if(t.attachShader(o,W(t,t.VERTEX_SHADER,I)),t.attachShader(o,W(t,t.FRAGMENT_SHADER,s)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let c=new Map,l=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let u=0;u<l;u++){let m=t.getActiveUniform(o,u);c.set(m.name,t.getUniformLocation(o,m.name))}let f={prog:o,loc:c};return r.set(a,f),f}function H(t){D.delete(t)}function P(t,i,e){for(let[r,a]of Object.entries(e)){let n=i.loc.get(r);n!==void 0&&(typeof a=="number"?t.uniform1f(n,a):a.length===1?t.uniform1i(n,a[0]):a.length===2?t.uniform2f(n,a[0],a[1]):a.length===3?t.uniform3f(n,a[0],a[1],a[2]):a.length===4?t.uniform4f(n,a[0],a[1],a[2],a[3]):a.length===9&&t.uniformMatrix3fv(n,!1,a))}}function F(t){t.drawArrays(t.TRIANGLES,0,3)}function y(t,i,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let a=t.createFramebuffer(),n={fb:a,tex:r,w:0,h:0};return g(t,n,i,e),t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),n}function g(t,i,e,r){e=Math.max(1,e),r=Math.max(1,r),!(i.w===e&&i.h===r)&&(t.bindTexture(t.TEXTURE_2D,i.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),i.w=e,i.h=r)}var V={};Oe(V,{animations:()=>E,effectAttrs:()=>T,effectParam:()=>A,effects:()=>h,interactions:()=>L,kebab:()=>R,objects:()=>k});var k=new Map,E=new Map,h=new Map,L=new Map,T=()=>[...h.values()].flatMap(t=>t.manifest.params.map(i=>`${t.manifest.name}-${R(i.name)}`)),R=t=>t.replace(/[A-Z]/g,i=>"-"+i.toLowerCase());function A(t,i,e){var r;for(let a of h.values()){let n=a.manifest.name+"-";if(!t.startsWith(n))continue;let s=a.manifest.params.find(c=>R(c.name)===t.slice(n.length));if(!s)continue;let o=Number(i);return(e[r=a.manifest.name]??(e[r]={}))[s.name]=isNaN(o)?s.default:o,!0}return!1}var M=(t,i,e)=>t+(i-t)*e,$=(t,i,e,r)=>t+(i-t)*(1-Math.exp(-e/Math.max(r,1))),Y=new Float32Array([1,0,0,0,1,0,0,0,1]);function Q(t,i,e){let r=Math.cos(t),a=Math.sin(t),n=Math.cos(i),s=Math.sin(i),o=Math.cos(e),c=Math.sin(e);return new Float32Array([n*o,n*c,-s,a*s*o-r*c,a*s*c+r*o,a*n,r*s*o+a*c,r*s*c-a*o,r*n])}function N(t){t=t.trim();let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(e=>parseInt(e+e,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(e=>parseInt(i[1].slice(e,e+2),16)/255);if(i=t.match(/^rgba?\(([^)]+)\)$/i),i){let e=i[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var ke={off:0,idle:.25,busy:.6,active:1},Ne=["animation","speed","effect","state","color","size","gravity"],Z=t=>t.replace(/-([a-z])/g,(i,e)=>e.toUpperCase()),w=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(Y),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=J(r.default,r.type)??0}static get observedAttributes(){return[...Ne,...this.manifest.uniforms.map(e=>R(e.name)),...T()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,a){let n=a??"";switch(e){case"animation":this.animNames=n.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=n.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(n)||1;return;case"state":this.stateTarget=ke[n]??.25;return;case"color":{let o=N(n);o&&(this.color=o);return}case"size":this.style.setProperty("--sd-size",n);return;case"gravity":return}if(A(e,n,this.effectParams))return;let s=this.manifest.uniforms.find(o=>R(o.name)===e);if(s){let o=J(n,s.type);o!==null&&(this.uniforms[s.name]=o)}}update(e,r){this.state=$(this.state,this.stateTarget,r,150);let a=Be()?0:e*this.speed,n={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let o of this.animNames){let c=E.get(o)?.fn(a,this.speed,this);if(c){if(c.rotation)for(let l=0;l<3;l++)n.rotation[l]+=c.rotation[l];c.offset&&(n.offset[0]+=c.offset[0],n.offset[1]+=c.offset[1]),c.scale!==void 0&&(n.scale*=c.scale),c.state!==void 0&&(n.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let s=n;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let o=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;s={rotation:[0,1,2].map(l=>M(c.rotation[l],n.rotation[l],o)),offset:[M(c.offset[0],n.offset[0],o),M(c.offset[1],n.offset[1],o)],scale:M(c.scale,n.scale,o),state:M(c.state,n.state,o)}}this.lastPose=s,this.anim.rotation=Q(s.rotation[0],s.rotation[1],s.rotation[2]),this.anim.offset=[s.offset[0],s.offset[1]],this.anim.scale=s.scale,this.anim.state=s.state,this.anim.z=0}},B=null;function Be(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(B??(B=matchMedia("(prefers-reduced-motion: reduce)")),B.matches)}function J(t,i){if(i==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(i==="color")return Array.isArray(t)?t:N(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function je(t,i){for(let e of i)Object.getOwnPropertyDescriptor(t,Z(e))||Object.defineProperty(t,Z(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function v(t,i){var r;if(!t?.tag||customElements.get(t.tag))return;k.set(t.name,{manifest:t,frag:i});let e=(r=class extends w{},r.manifest=t,r.frag=i,r);je(e.prototype,e.observedAttributes.filter(a=>!["color","speed","state"].includes(a))),customElements.define(t.tag,e)}var K=`void main() { fragColor = texture(uScene, vUv); }
`;var O=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...T()]}connectedCallback(){this.gl||(this.gl=X(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{H(this.gl),this.fbos=null,this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof w&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,a){let n=a??"";e==="interaction"?(this.interactionNames=n.split(/\s+/).filter(Boolean),this.interactionNames.forEach(s=>L.get(s)?.setup?.(this))):e==="effect"?this.effectNames=n.split(/\s+/).filter(Boolean):e==="theme"?this.theme=n||"auto":e==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):A(e,n,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),a=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let n of this.objects){let s=n.getBoundingClientRect();n.rect=new DOMRect(s.left-e.left,s.top-e.top,s.width,s.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let a=this.gl,n=this.canvas.width,s=this.canvas.height;if(!a||n===0||s===0)return;for(let m of this.objects)m.update(e,r);for(let m of this.interactionNames)L.get(m)?.frame(this,r,this.pointer);let o=this.fbos??(this.fbos={scene:y(a,n,s),a:y(a,n,s),b:y(a,n,s),oa:y(a,1,1),ob:y(a,1,1)});g(a,o.scene,n,s),g(a,o.a,n,s),g(a,o.b,n,s);let c=this.themeValue;this.bind(a,o.scene,0,0,n,s,!0);let l=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,b)=>m.anim.z-b.anim.z);for(let m of l)this.draw(a,m,e,c,o);let f=o.scene,u=this.effectNames.filter(m=>h.has(m));for(let m of u){let b=f===o.a?o.b:o.a;this.bind(a,b,0,0,n,s,!0),this.pass(a,m,f,this.effectParams[m],[n,s],e,c),f=b}this.bind(a,null,0,0,n,s,!0),this.blit(a,f)}bind(e,r,a,n,s,o,c){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(a,n,s,o),e.scissor(a,n,s,o),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let a=C(e,K,"effect");e.useProgram(a.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),P(e,a,{uScene:[0]}),F(e)}pass(e,r,a,n,s,o,c){let l=h.get(r),f;try{f=C(e,l.frag,"effect")}catch(m){console.error(`[solids] effect "${r}" shader failed:
${m.message}`),this.blit(e,a);return}e.useProgram(f.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex);let u={};for(let m of l.manifest.params)u[m.name]=m.default;P(e,f,{uScene:[0],uResolution:s,uTime:o,uTheme:c,...u,...n}),F(e)}draw(e,r,a,n,s){let o=r.rect,c=r.manifest.bleed??1.5,l=o.x+o.width/2+r.anim.offset[0],f=o.y+o.height/2+r.anim.offset[1],u=o.width*c,m=o.height*c,b=Math.round((l-u/2)*this.dpr),j=Math.round((this.height-f-m/2)*this.dpr),p=Math.round(u*this.dpr),d=Math.round(m*this.dpr);if(p<=0||d<=0)return;let U;try{U=C(e,r.frag)}catch(x){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${x.message}`);return}let _=r.effectNames.filter(x=>h.has(x));_.length?(g(e,s.oa,p,d),g(e,s.ob,p,d),this.bind(e,s.oa,0,0,p,d,!0)):this.bind(e,s.scene,b,j,p,d,!1),e.useProgram(U.prog);let Fe=this.pointer.inside?[(this.pointer.x-l)/u*2,-((this.pointer.y-f)/m)*2]:[0,0];if(P(e,U,{uTime:a,uResolution:[p,d],uPointer:Fe,uRotation:r.anim.rotation,uScale:r.anim.scale/c,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:n,uColor:r.color,...r.uniforms}),F(e),!_.length)return;let S=s.oa;for(let x of _){let z=S===s.oa?s.ob:s.oa;this.bind(e,z,0,0,p,d,!0),this.pass(e,x,S,r.effectParams[x],[p,d],a,n),S=z}this.bind(e,s.scene,b,j,p,d,!1),this.blit(e,S)}};var ee=Math.PI/180,te={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*ee,Math.sin(t*2*Math.PI/6)*8*ee,0]})};var re={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var ae={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ne={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let i=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*i,state:.1*i}}};var ie={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Ie=[te,re,ae,ne,ie];for(let t of Ie)E.set(t.meta.name,t);var se={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var oe=`uniform float threshold;
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
`;var le={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var fe=`uniform float amount;

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
`;var be={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var ge=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var et=[{manifest:se,frag:oe},{manifest:ce,frag:me},{manifest:le,frag:fe},{manifest:ue,frag:pe},{manifest:de,frag:he},{manifest:be,frag:ge}];for(let t of et)h.set(t.manifest.name,t);var ve={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var xe=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var ye={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Re=`uniform float thickness;
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
`;var Me={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var we=`uniform float facets;
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
`;var Ee={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var Te=`uniform float turns;
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
`;var Ae={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var Se=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Ce={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var Pe=`uniform float radius;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",O);v(ve,xe);v(ye,Re);v(Me,we);v(Ee,Te);v(Ae,Se);v(Ce,Pe);export{w as SdObject,O as SdScene,v as defineObject,V as registry};
//# sourceMappingURL=solids.js.map
