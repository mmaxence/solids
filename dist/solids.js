var Be=Object.defineProperty;var ze=(t,s)=>{for(var e in s)Be(t,e,{get:s[e],enumerable:!0})};var W=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var q=`#version 300 es
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
`;var X=`#version 300 es
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
`;var D=new WeakMap;function V(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(s.bindVertexArray(s.createVertexArray()),s.enable(s.BLEND),s.blendFunc(s.ONE,s.ONE_MINUS_SRC_ALPHA),s):null}function H(t,s,e){let r=t.createShader(s);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function P(t,s,e="object"){let r=D.get(t);r||D.set(t,r=new Map);let n=e[0]+s,i=r.get(n);if(i)return i;let a=(e==="object"?q:X)+`
`+s,o=t.createProgram();if(t.attachShader(o,H(t,t.VERTEX_SHADER,W)),t.attachShader(o,H(t,t.FRAGMENT_SHADER,a)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let c=new Map,m=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let u=0;u<m;u++){let f=t.getActiveUniform(o,u);c.set(f.name,t.getUniformLocation(o,f.name))}let l={prog:o,loc:c};return r.set(n,l),l}function $(t){D.delete(t)}function F(t,s,e){for(let[r,n]of Object.entries(e)){let i=s.loc.get(r);i!==void 0&&(typeof n=="number"?t.uniform1f(i,n):n.length===1?t.uniform1i(i,n[0]):n.length===2?t.uniform2f(i,n[0],n[1]):n.length===3?t.uniform3f(i,n[0],n[1],n[2]):n.length===4?t.uniform4f(i,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(i,!1,n))}}function L(t){t.drawArrays(t.TRIANGLES,0,3)}function M(t,s,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let n=t.createFramebuffer(),i={fb:n,tex:r,w:0,h:0};return v(t,i,s,e),t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),i}function v(t,s,e,r){e=Math.max(1,e),r=Math.max(1,r),!(s.w===e&&s.h===r)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=r)}var Y={};ze(Y,{animations:()=>E,effectAttrs:()=>S,effectParam:()=>A,effects:()=>b,interactions:()=>w,kebab:()=>R,objects:()=>N});var N=new Map,E=new Map,b=new Map,w=new Map,S=()=>[...b.values()].flatMap(t=>t.manifest.params.map(s=>`${t.manifest.name}-${R(s.name)}`)),R=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function A(t,s,e){var r;for(let n of b.values()){let i=n.manifest.name+"-";if(!t.startsWith(i))continue;let a=n.manifest.params.find(c=>R(c.name)===t.slice(i.length));if(!a)continue;let o=Number(s);return(e[r=n.manifest.name]??(e[r]={}))[a.name]=isNaN(o)?a.default:o,!0}return!1}var g=(t,s,e)=>t+(s-t)*e,O=(t,s,e,r)=>t+(s-t)*(1-Math.exp(-e/Math.max(r,1))),Q=new Float32Array([1,0,0,0,1,0,0,0,1]);function j(t,s,e){let r=Math.cos(t),n=Math.sin(t),i=Math.cos(s),a=Math.sin(s),o=Math.cos(e),c=Math.sin(e);return new Float32Array([i*o,i*c,-a,n*a*o-r*c,n*a*c+r*o,n*i,r*a*o+n*c,r*a*c-n*o,r*i])}function Z(t,s){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let n=0;n<3;n++)e[r*3+n]=t[n]*s[r*3]+t[3+n]*s[r*3+1]+t[6+n]*s[r*3+2];return e}function I(t){t=t.trim();let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(e=>parseInt(e+e,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(e=>parseInt(s[1].slice(e,e+2),16)/255);if(s=t.match(/^rgba?\(([^)]+)\)$/i),s){let e=s[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var Xe={off:0,idle:.25,busy:.6,active:1},He=["animation","speed","effect","state","color","size","gravity","gravity-gap"],J=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),T=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.color=[.61,.82,1];this.state=.25;this.stateTarget=.25;this.speed=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(Q),offset:[0,0],scale:1,z:0,state:0};this.prevPose=null;this.blend=1;this.broken=!1;this.lastPose=null;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=K(r.default,r.type)??0}static get observedAttributes(){return[...He,...this.manifest.uniforms.map(e=>R(e.name)),...S()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene");e?e.attach?.(this):this.standalone()}disconnectedCallback(){this.scene?.detach(this)}standalone(){}attributeChangedCallback(e,r,n){let i=n??"";switch(e){case"animation":this.animNames=i.split(/\s+/).filter(Boolean),this.lastPose&&(this.prevPose=this.lastPose,this.blend=0);return;case"effect":this.effectNames=i.split(/\s+/).filter(Boolean);return;case"speed":this.speed=Number(i)||1;return;case"state":this.stateTarget=Xe[i]??.25;return;case"color":{let o=I(i);o&&(this.color=o);return}case"size":this.style.setProperty("--sd-size",i);return;case"gravity":case"gravity-gap":return}if(A(e,i,this.effectParams))return;let a=this.manifest.uniforms.find(o=>R(o.name)===e);if(a){let o=K(i,a.type);o!==null&&(this.uniforms[a.name]=o)}}update(e,r){this.state=O(this.state,this.stateTarget,r,150);let n=Ve()?0:e*this.speed,i={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let o of this.animNames){let c=E.get(o)?.fn(n,this.speed,this);if(c){if(c.rotation)for(let m=0;m<3;m++)i.rotation[m]+=c.rotation[m];c.offset&&(i.offset[0]+=c.offset[0],i.offset[1]+=c.offset[1]),c.scale!==void 0&&(i.scale*=c.scale),c.state!==void 0&&(i.state+=c.state),c.uniforms&&Object.assign(this.uniforms,c.uniforms)}}let a=i;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+r/400);let o=this.blend*this.blend*(3-2*this.blend),c=this.prevPose;a={rotation:[0,1,2].map(m=>g(c.rotation[m],i.rotation[m],o)),offset:[g(c.offset[0],i.offset[0],o),g(c.offset[1],i.offset[1],o)],scale:g(c.scale,i.scale,o),state:g(c.state,i.state,o)}}this.lastPose=a,this.anim.rotation=j(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}},B=null;function Ve(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(B??(B=matchMedia("(prefers-reduced-motion: reduce)")),B.matches)}function K(t,s){if(s==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(s==="color")return Array.isArray(t)?t:I(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}function $e(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,J(e))||Object.defineProperty(t,J(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function y(t,s){var r;if(!t?.tag||customElements.get(t.tag))return;N.set(t.name,{manifest:t,frag:s});let e=(r=class extends T{},r.manifest=t,r.frag=s,r);$e(e.prototype,e.observedAttributes.filter(n=>!["color","speed","state"].includes(n))),customElements.define(t.tag,e)}var ee=`void main() { fragColor = texture(uScene, vUv); }
`;var k=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...S()]}connectedCallback(){this.gl||(this.gl=V(this.canvas),this.gl||(this.dataset.fallback=""),this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{$(this.gl),this.fbos=null,this.start()})),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof T&&this.attach(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let i=n??"";e==="interaction"?(this.interactionNames=i.split(/\s+/).filter(Boolean),this.interactionNames.forEach(a=>w.get(a)?.setup?.(this))):e==="effect"?this.effectNames=i.split(/\s+/).filter(Boolean):e==="theme"?this.theme=i||"auto":e==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):A(e,i,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),n=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let i of this.objects){let a=i.getBoundingClientRect();i.rect=new DOMRect(a.left-e.left,a.top-e.top,a.width,a.height)}}start(){this.raf||!this.gl||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl,i=this.canvas.width,a=this.canvas.height;if(!n||i===0||a===0)return;for(let f of this.objects)f.update(e,r);for(let f of this.interactionNames)w.get(f)?.frame(this,r,this.pointer);let o=this.fbos??(this.fbos={scene:M(n,i,a),a:M(n,i,a),b:M(n,i,a),oa:M(n,1,1),ob:M(n,1,1)});v(n,o.scene,i,a),v(n,o.a,i,a),v(n,o.b,i,a);let c=this.themeValue;this.bind(n,o.scene,0,0,i,a,!0);let m=[...this.objects].filter(f=>f.rect&&!f.broken).sort((f,p)=>f.anim.z-p.anim.z);for(let f of m)this.draw(n,f,e,c,o);let l=o.scene,u=this.effectNames.filter(f=>b.has(f));for(let f of u){let p=l===o.a?o.b:o.a;this.bind(n,p,0,0,i,a,!0),this.pass(n,f,l,this.effectParams[f],[i,a],e,c),l=p}this.bind(n,null,0,0,i,a,!0),this.blit(n,l)}bind(e,r,n,i,a,o,c){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(n,i,a,o),e.scissor(n,i,a,o),e.enable(e.SCISSOR_TEST),c&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let n=P(e,ee,"effect");e.useProgram(n.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),F(e,n,{uScene:[0]}),L(e)}pass(e,r,n,i,a,o,c){let m=b.get(r),l;try{l=P(e,m.frag,"effect")}catch(f){console.error(`[solids] effect "${r}" shader failed:
${f.message}`),this.blit(e,n);return}e.useProgram(l.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.tex);let u={};for(let f of m.manifest.params)u[f.name]=f.default;F(e,l,{uScene:[0],uResolution:a,uTime:o,uTheme:c,...u,...i}),L(e)}draw(e,r,n,i,a){let o=r.rect,c=r.manifest.bleed??1.5,m=o.x+o.width/2+r.anim.offset[0],l=o.y+o.height/2+r.anim.offset[1],u=o.width*c,f=o.height*c,p=Math.round((m-u/2)*this.dpr),z=Math.round((this.height-l-f/2)*this.dpr),d=Math.round(u*this.dpr),h=Math.round(f*this.dpr);if(d<=0||h<=0)return;let U;try{U=P(e,r.frag)}catch(x){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${x.message}`);return}let _=r.effectNames.filter(x=>b.has(x));_.length?(v(e,a.oa,d,h),v(e,a.ob,d,h),this.bind(e,a.oa,0,0,d,h,!0)):this.bind(e,a.scene,p,z,d,h,!1),e.useProgram(U.prog);let Ie=this.pointer.inside?[(this.pointer.x-m)/u*2,-((this.pointer.y-l)/f)*2]:[0,0];if(F(e,U,{uTime:n,uResolution:[d,h],uPointer:Ie,uRotation:r.anim.rotation,uScale:r.anim.scale/c,uState:Math.min(1,Math.max(0,r.state+r.anim.state)),uTheme:i,uColor:r.color,...r.uniforms}),L(e),!_.length)return;let C=a.oa;for(let x of _){let G=C===a.oa?a.ob:a.oa;this.bind(e,G,0,0,d,h,!0),this.pass(e,x,C,r.effectParams[x],[d,h],n,i),C=G}this.bind(e,a.scene,p,z,d,h,!1),this.blit(e,C)}};var te=Math.PI/180,re={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*te,Math.sin(t*2*Math.PI/6)*8*te,0]})};var ae={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var ne={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ie={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var oe={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Qe=[re,ae,ne,ie,oe];for(let t of Qe)E.set(t.meta.name,t);var se={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var ce=`uniform float threshold;
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
`;var pe={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var de=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var he={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var be=`uniform float levels;
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
`;var mt=[{manifest:se,frag:ce},{manifest:me,frag:fe},{manifest:le,frag:ue},{manifest:pe,frag:de},{manifest:he,frag:be},{manifest:ge,frag:ve}];for(let t of mt)b.set(t.manifest.name,t);var ye=new WeakMap,xe=20*Math.PI/180,Me={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let i=Math.max(1,Math.round(s/16));for(let a of t.objects){if(!a.rect)continue;let o=ye.get(a)??ye.set(a,{rx:0,ry:0,vx:0,vy:0}).get(a),c=0,m=0;if(e.inside){let l=a.rect.x+a.rect.width/2+a.anim.offset[0],u=a.rect.y+a.rect.height/2+a.anim.offset[1],f=(e.x-l)/Math.max(t.width,1),p=(e.y-u)/Math.max(t.height,1);m=Math.max(-1,Math.min(1,f*2))*xe,c=Math.max(-1,Math.min(1,p*2))*xe}for(let l=0;l<i;l++)o.vx=(o.vx+(c-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(m-o.ry)*.08)*.8,o.ry+=o.vy;a.anim.rotation=Z(j(o.rx,o.ry,0),a.anim.rotation)}}};var we=new WeakMap,Re={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let r of t.objects){if(!r.rect)continue;let n=r.rect.x+r.rect.width/2+r.anim.offset[0],i=r.rect.y+r.rect.height/2+r.anim.offset[1],a=e.inside&&Math.abs(e.x-n)<=r.rect.width/2&&Math.abs(e.y-i)<=r.rect.height/2,o=O(we.get(r)??0,a?1:0,s,160);we.set(r,o),r.anim.scale*=1+.08*o,r.anim.state+=o*(1-r.state)}}};var Te=new WeakMap,Ee=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],ft=t=>t*t*(3-2*t),Se={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(a=>a.rect),r=e.find(a=>a.getAttribute("gravity")==="center");if(!r)return;let n=Number(t.getAttribute("gravity-strength"))||.6,i=Ee(r);for(let a of e){if(a===r)continue;let o=a.getAttribute("gravity");if(o==="none")continue;let c=Ee(a),m=Te.get(a)??Te.set(a,{angle:0,r:0,center:null,from:[0,0],k:1}).get(a);m.center!==r&&(m.from=[a.anim.offset[0],a.anim.offset[1]],m.k=m.center?0:1,m.center=r,m.angle=Math.atan2(c[1]-i[1],c[0]-i[0]),m.r=Math.hypot(c[0]-i[0],c[1]-i[1]));let l,u=0;if(o==="fall"){let p=(Number(a.getAttribute("gravity-gap"))||24)+(r.rect.width+a.rect.width)/4;m.r+=(p-m.r)*(1-Math.exp(-s/700))*(.3+n),l=[i[0]+Math.cos(m.angle)*m.r-c[0],i[1]+Math.sin(m.angle)*m.r-c[1]]}else m.angle+=s/1e3*.25*n,u=Math.sin(m.angle),l=[i[0]+Math.cos(m.angle)*m.r-c[0],i[1]+Math.sin(m.angle)*m.r-c[1]];if(m.k<1){m.k=Math.min(1,m.k+s/800);let f=ft(m.k);l=[g(m.from[0],l[0],f),g(m.from[1],l[1],f)]}a.anim.offset[0]+=l[0],a.anim.offset[1]+=l[1],a.anim.z=u,a.anim.scale*=1+.06*u}}};var lt=[Me,Re,Se];for(let t of lt)w.set(t.meta.name,t);var Ae={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Ce=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var Pe={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var Fe=`uniform float thickness;
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
`;var Le={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var Oe=`uniform float facets;
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
`;var je={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var ke=`uniform float turns;
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
`;var Ue={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var _e=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var De={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var Ne=`uniform float radius;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",k);y(Ae,Ce);y(Pe,Fe);y(Le,Oe);y(je,ke);y(Ue,_e);y(De,Ne);export{T as SdObject,k as SdScene,y as defineObject,Y as registry};
//# sourceMappingURL=solids.js.map
