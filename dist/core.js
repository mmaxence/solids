var ze=Object.defineProperty;var Ve=(t,s)=>{for(var e in s)ze(t,e,{get:s[e],enumerable:!0})};var H=`#version 300 es
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
`;var $=`#version 300 es
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
`;var B=new WeakMap;function Q(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(G(s),s):null}function G(t){t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function Y(t,s,e){let r=t.createShader(s);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function O(t,s,e="object"){let r=B.get(t);r||B.set(t,r=new Map);let n=e[0]+s,i=r.get(n);if(i)return i;let a=(e==="object"?q:$)+`
`+s,o=t.createProgram();if(t.attachShader(o,Y(t,t.VERTEX_SHADER,H)),t.attachShader(o,Y(t,t.FRAGMENT_SHADER,a)),t.linkProgram(o),!t.getProgramParameter(o,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(o)||"link failed");let f=new Map,p=t.getProgramParameter(o,t.ACTIVE_UNIFORMS);for(let l=0;l<p;l++){let m=t.getActiveUniform(o,l);f.set(m.name,t.getUniformLocation(o,m.name))}let c={prog:o,loc:f};return r.set(n,c),c}function Z(t){B.delete(t)}function j(t,s,e){for(let[r,n]of Object.entries(e)){let i=s.loc.get(r);i!==void 0&&(typeof n=="number"?t.uniform1f(i,n):n.length===1?t.uniform1i(i,n[0]):n.length===2?t.uniform2f(i,n[0],n[1]):n.length===3?t.uniform3f(i,n[0],n[1],n[2]):n.length===4?t.uniform4f(i,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(i,!1,n))}}function U(t){t.drawArrays(t.TRIANGLES,0,3)}function M(t,s,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let n=t.createFramebuffer(),i={fb:n,tex:r,w:0,h:0};return v(t,i,s,e),t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),i}function v(t,s,e,r){e=Math.max(1,e),r=Math.max(1,r),!(s.w===e&&s.h===r)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=r)}var J={};Ve(J,{animations:()=>E,effectAttrs:()=>T,effectParam:()=>A,effects:()=>b,interactions:()=>R,kebab:()=>S,num:()=>C,objects:()=>W});var W=new Map,E=new Map,b=new Map,R=new Map,T=()=>[...b.values()].flatMap(t=>t.manifest.params.map(s=>`${t.manifest.name}-${S(s.name)}`)),S=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function A(t,s,e){var r;for(let n of b.values()){let i=n.manifest.name+"-";if(!t.startsWith(i))continue;let a=n.manifest.params.find(o=>S(o.name)===t.slice(i.length));if(a)return(e[r=n.manifest.name]??(e[r]={}))[a.name]=C(s,a.default),!0}return!1}var C=(t,s)=>{if(t==null||t==="")return s;let e=Number(t);return isNaN(e)?s:e};var g=(t,s,e)=>t+(s-t)*e,k=(t,s,e,r)=>t+(s-t)*(1-Math.exp(-e/Math.max(r,1))),K=new Float32Array([1,0,0,0,1,0,0,0,1]);function I(t,s,e){let r=Math.cos(t),n=Math.sin(t),i=Math.cos(s),a=Math.sin(s),o=Math.cos(e),f=Math.sin(e);return new Float32Array([i*o,i*f,-a,n*a*o-r*f,n*a*f+r*o,n*i,r*a*o+n*f,r*a*f-n*o,r*i])}function ee(t,s){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let n=0;n<3;n++)e[r*3+n]=t[n]*s[r*3]+t[3+n]*s[r*3+1]+t[6+n]*s[r*3+2];return e}function z(t){t=t.trim();let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(e=>parseInt(e+e,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(e=>parseInt(s[1].slice(e,e+2),16)/255);if(s=t.match(/^rgba?\(([^)]+)\)$/i),s){let e=s[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var $e={off:0,idle:.25,busy:.6,active:1},Ye=["animation","speed","effect","state","color","size","gravity","gravity-gap"],te=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),w=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(K),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=re(r.default,r.type)??0}static get observedAttributes(){return[...Ye,...this.manifest.uniforms.map(e=>S(e.name)),...T()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let n=document.createElement("sd-scene");this.shadowRoot.append(n),n.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,n){let i=n??"";switch(e){case"animation":this.animNames=i.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=i.split(/\s+/).filter(Boolean);return;case"speed":{let o=Number(i);this.speedValue=i===""||isNaN(o)?1:o;return}case"state":this.stateTarget=$e[i]??.25;return;case"color":{let o=z(i);o&&(this.rgb=o);return}case"size":this.style.setProperty("--sd-size",i);return;case"gravity":case"gravity-gap":return}if(A(e,n,this.effectParams))return;let a=this.manifest.uniforms.find(o=>S(o.name)===e);if(a){let o=re(n===null||n===""?a.default:n,a.type);o!==null&&(this.uniforms[a.name]=o)}}update(e){this.stateValue=k(this.stateValue,this.stateTarget,e,150),P()||(this.phase+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let a=E.get(i)?.fn(this.phase,this.speedValue,this);if(a){if(a.rotation)for(let o=0;o<3;o++)r.rotation[o]+=a.rotation[o];a.offset&&(r.offset[0]+=a.offset[0],r.offset[1]+=a.offset[1]),a.scale!==void 0&&(r.scale*=a.scale),a.state!==void 0&&(r.state+=a.state),a.uniforms&&Object.assign(this.uniforms,a.uniforms)}}let n=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let i=this.blend*this.blend*(3-2*this.blend),a=this.prevPose;n={rotation:[0,1,2].map(o=>Qe(a.rotation[o],r.rotation[o],i)),offset:[g(a.offset[0],r.offset[0],i),g(a.offset[1],r.offset[1],i)],scale:g(a.scale,r.scale,i),state:g(a.state,r.state,i)}}this.pose=n,this.anim.rotation=I(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=0}};function Qe(t,s,e){let r=((s-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function re(t,s){if(s==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(s==="color")return Array.isArray(t)?t:z(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var V=null;function P(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(V??(V=matchMedia("(prefers-reduced-motion: reduce)")),V.matches)}function Ze(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,te(e))||Object.defineProperty(t,te(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function x(t,s){var r;if(!t?.tag||customElements.get(t.tag))return;W.set(t.name,{manifest:t,frag:s});let e=(r=class extends w{},r.manifest=t,r.frag=s,r);Ze(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var ne=`void main() { fragColor = texture(uScene, vUv); }
`;var _=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...T()]}connectedCallback(){if(!this.gl){if(this.gl=Q(this.canvas),!this.gl){this.dataset.fallback="";for(let e of this.objects)e.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{Z(this.gl),this.fbos=null,G(this.gl);for(let e of this.objects)e.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof w&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let i=n??"";e==="interaction"?(this.interactionNames=i.split(/\s+/).filter(Boolean),this.interactionNames.forEach(a=>R.get(a)?.setup?.(this))):e==="effect"?this.effectNames=i.split(/\s+/).filter(Boolean):e==="theme"?this.theme=i||"auto":e==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):A(e,n,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.objects=new Set([...this.objects].sort((r,n)=>r.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),n=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let i of this.objects){let a=i.getBoundingClientRect();i.rect=new DOMRect(a.left-e.left,a.top-e.top,a.width,a.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl,i=this.canvas.width,a=this.canvas.height;if(!n||i===0||a===0)return;P()||(this.clock=e),e=this.clock;for(let m of this.objects)m.update(r);for(let m of this.interactionNames)R.get(m)?.frame(this,r,this.pointer);let o=this.fbos??(this.fbos={scene:M(n,i,a),a:M(n,i,a),b:M(n,i,a),oa:M(n,1,1),ob:M(n,1,1)});v(n,o.scene,i,a),v(n,o.a,i,a),v(n,o.b,i,a);let f=this.themeValue;this.bind(n,o.scene,0,0,i,a,!0);let p=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,u)=>m.anim.z-u.anim.z);for(let m of p)this.draw(n,m,e,f,o);let c=o.scene,l=this.effectNames.filter(m=>b.has(m));for(let m of l){let u=c===o.a?o.b:o.a;this.bind(n,u,0,0,i,a,!0),this.pass(n,m,c,this.effectParams[m],[i,a],e,f),c=u}this.bind(n,null,0,0,i,a,!0),this.blit(n,c)}bind(e,r,n,i,a,o,f){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(n,i,a,o),e.scissor(n,i,a,o),e.enable(e.SCISSOR_TEST),f&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let n=O(e,ne,"effect");e.useProgram(n.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),j(e,n,{uScene:[0]}),U(e)}pass(e,r,n,i,a,o,f){let p=b.get(r),c;try{c=O(e,p.frag,"effect")}catch(m){console.error(`[solids] effect "${r}" shader failed:
${m.message}`),this.blit(e,n);return}e.useProgram(c.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.tex);let l={};for(let m of p.manifest.params)l[m.name]=m.default;j(e,c,{uScene:[0],uResolution:a,uTime:o,uTheme:f,...l,...i}),U(e)}draw(e,r,n,i,a){let o=r.rect,f=r.manifest.bleed??1.5,p=o.x+o.width/2+r.anim.offset[0],c=o.y+o.height/2+r.anim.offset[1],l=o.width*f,m=o.height*f,u=Math.round((p-l/2)*this.dpr),L=Math.round((this.height-c-m/2)*this.dpr),h=Math.round(l*this.dpr),d=Math.round(m*this.dpr);if(h<=0||d<=0)return;let D;try{D=O(e,r.frag)}catch(y){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${y.message}`);return}let N=r.effectNames.filter(y=>b.has(y));N.length?(v(e,a.oa,h,d),v(e,a.ob,h,d),this.bind(e,a.oa,0,0,h,d,!0)):this.bind(e,a.scene,u,L,h,d,!1),e.useProgram(D.prog);let We=this.pointer.inside?[(this.pointer.x-p)/l*2,-((this.pointer.y-c)/m)*2]:[0,0];if(j(e,D,{uTime:n,uResolution:[h,d],uPointer:We,uRotation:r.anim.rotation,uScale:r.anim.scale/f,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:i,uColor:r.rgb,...r.uniforms}),U(e),!N.length)return;let F=a.oa;for(let y of N){let X=F===a.oa?a.ob:a.oa;this.bind(e,X,0,0,h,d,!0),this.pass(e,y,F,r.effectParams[y],[h,d],n,i),F=X}this.bind(e,a.scene,u,L,h,d,!1),this.blit(e,F)}};var oe=Math.PI/180,ae={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*oe,Math.sin(t*2*Math.PI/6)*8*oe,0]})};var ie={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var se={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ce={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var me={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Ke=[ae,ie,se,ce,me];for(let t of Ke)E.set(t.meta.name,t);var fe={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var le=`uniform float threshold;
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
`;var ue={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var pe=`uniform float angle;
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
`;var he={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var de=`uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var be={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var ge=`uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
`;var ve={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var xe=`uniform float levels;
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
`;var ye={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var Me=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var ut=[{manifest:fe,frag:le},{manifest:ue,frag:pe},{manifest:he,frag:de},{manifest:be,frag:ge},{manifest:ve,frag:xe},{manifest:ye,frag:Me}];for(let t of ut)b.set(t.manifest.name,t);var Re=new WeakMap,Se=20*Math.PI/180,we={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let i=Math.max(1,Math.round(s/16));for(let a of t.objects){if(!a.rect)continue;let o=Re.get(a)??Re.set(a,{rx:0,ry:0,vx:0,vy:0}).get(a),f=0,p=0;if(e.inside){let c=a.rect.x+a.rect.width/2+a.anim.offset[0],l=a.rect.y+a.rect.height/2+a.anim.offset[1],m=(e.x-c)/Math.max(t.width,1),u=(e.y-l)/Math.max(t.height,1);p=Math.max(-1,Math.min(1,m*2))*Se,f=Math.max(-1,Math.min(1,u*2))*Se}for(let c=0;c<i;c++)o.vx=(o.vx+(f-o.rx)*.08)*.8,o.rx+=o.vx,o.vy=(o.vy+(p-o.ry)*.08)*.8,o.ry+=o.vy;a.anim.rotation=ee(I(o.rx,o.ry,0),a.anim.rotation)}}};var Ee=new WeakMap,Te={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let r of t.objects){if(!r.rect)continue;let n=r.rect.x+r.rect.width/2+r.anim.offset[0],i=r.rect.y+r.rect.height/2+r.anim.offset[1],a=e.inside&&Math.abs(e.x-n)<=r.rect.width/2&&Math.abs(e.y-i)<=r.rect.height/2,o=k(Ee.get(r)??0,a?1:0,s,160);Ee.set(r,o),r.anim.scale*=1+.08*o,r.anim.state+=o*(1-r.stateValue)}}};var Ae=new WeakMap,Ce=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],pt=t=>t*t*(3-2*t),Pe={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(o=>o.rect),r=e.find(o=>o.getAttribute("gravity")==="center")??null,n=C(t.getAttribute("gravity-strength"),.6),i=r?Ce(r):null,a=P();for(let o of e){let f=o.getAttribute("gravity"),p=!!i&&o!==r&&f!=="none",c=Ae.get(o);if(!c&&!p)continue;c||Ae.set(o,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let l=[0,0],m=0;if(p){let u=Ce(o);if(c.center!==r&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=r,c.angle=Math.atan2(u[1]-i[1],u[0]-i[0]),c.r=Math.hypot(u[0]-i[0],u[1]-i[1])),f==="fall"){let L=C(o.getAttribute("gravity-gap"),24)+(r.rect.width+o.rect.width)/4;a||(c.r+=(L-c.r)*(1-Math.exp(-s/700))*(.3+n))}else a||(c.angle+=s/1e3*.25*n),m=Math.sin(c.angle);l=[i[0]+Math.cos(c.angle)*c.r-u[0],i[1]+Math.sin(c.angle)*c.r-u[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+s/800);let u=pt(c.k);l=[g(c.from[0],l[0],u),g(c.from[1],l[1],u)]}c.offset=l,o.anim.offset[0]+=l[0],o.anim.offset[1]+=l[1],o.anim.z=m,o.anim.scale*=1+.06*m}}};var ht=[we,Te,Pe];for(let t of ht)R.set(t.meta.name,t);var Le={};var Fe={};var Oe={};var je={};var Ue={};var ke={};var Ie={};var _e={};var De={};var Ne={};var Be={};var Ge={};customElements.get("sd-scene")||customElements.define("sd-scene",_);x(Le,Fe);x(Oe,je);x(Ue,ke);x(Ie,_e);x(De,Ne);x(Be,Ge);export{w as SdObject,_ as SdScene,x as defineObject,J as registry};
//# sourceMappingURL=core.js.map
