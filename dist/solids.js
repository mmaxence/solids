var We=Object.defineProperty;var qe=(t,s)=>{for(var e in s)We(t,e,{get:s[e],enumerable:!0})};var X=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var H=`#version 300 es
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
`;var B=new WeakMap;function Q(t){let s=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return s?(z(s),s):null}function z(t){t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function Y(t,s,e){let r=t.createShader(s);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function O(t,s,e="object"){let r=B.get(t);r||B.set(t,r=new Map);let a=e[0]+s,o=r.get(a);if(o)return o;let i=(e==="object"?H:$)+`
`+s,n=t.createProgram();if(t.attachShader(n,Y(t,t.VERTEX_SHADER,X)),t.attachShader(n,Y(t,t.FRAGMENT_SHADER,i)),t.linkProgram(n),!t.getProgramParameter(n,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(n)||"link failed");let f=new Map,p=t.getProgramParameter(n,t.ACTIVE_UNIFORMS);for(let l=0;l<p;l++){let m=t.getActiveUniform(n,l);f.set(m.name,t.getUniformLocation(n,m.name))}let c={prog:n,loc:f};return r.set(a,c),c}function Z(t){B.delete(t)}function j(t,s,e){for(let[r,a]of Object.entries(e)){let o=s.loc.get(r);o!==void 0&&(typeof a=="number"?t.uniform1f(o,a):a.length===1?t.uniform1i(o,a[0]):a.length===2?t.uniform2f(o,a[0],a[1]):a.length===3?t.uniform3f(o,a[0],a[1],a[2]):a.length===4?t.uniform4f(o,a[0],a[1],a[2],a[3]):a.length===9&&t.uniformMatrix3fv(o,!1,a))}}function k(t){t.drawArrays(t.TRIANGLES,0,3)}function M(t,s,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let a=t.createFramebuffer(),o={fb:a,tex:r,w:0,h:0};return v(t,o,s,e),t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),o}function v(t,s,e,r){e=Math.max(1,e),r=Math.max(1,r),!(s.w===e&&s.h===r)&&(t.bindTexture(t.TEXTURE_2D,s.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),s.w=e,s.h=r)}var J={};qe(J,{animations:()=>T,effectAttrs:()=>E,effectParam:()=>A,effects:()=>b,interactions:()=>w,kebab:()=>R,num:()=>C,objects:()=>G});var G=new Map,T=new Map,b=new Map,w=new Map,E=()=>[...b.values()].flatMap(t=>t.manifest.params.map(s=>`${t.manifest.name}-${R(s.name)}`)),R=t=>t.replace(/[A-Z]/g,s=>"-"+s.toLowerCase());function A(t,s,e){var r;for(let a of b.values()){let o=a.manifest.name+"-";if(!t.startsWith(o))continue;let i=a.manifest.params.find(n=>R(n.name)===t.slice(o.length));if(i)return(e[r=a.manifest.name]??(e[r]={}))[i.name]=C(s,i.default),!0}return!1}var C=(t,s)=>{if(t==null||t==="")return s;let e=Number(t);return isNaN(e)?s:e};var g=(t,s,e)=>t+(s-t)*e,U=(t,s,e,r)=>t+(s-t)*(1-Math.exp(-e/Math.max(r,1))),K=new Float32Array([1,0,0,0,1,0,0,0,1]);function I(t,s,e){let r=Math.cos(t),a=Math.sin(t),o=Math.cos(s),i=Math.sin(s),n=Math.cos(e),f=Math.sin(e);return new Float32Array([o*n,o*f,-i,a*i*n-r*f,a*i*f+r*n,a*o,r*i*n+a*f,r*i*f-a*n,r*o])}function ee(t,s){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let a=0;a<3;a++)e[r*3+a]=t[a]*s[r*3]+t[3+a]*s[r*3+1]+t[6+a]*s[r*3+2];return e}function W(t){t=t.trim();let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(e=>parseInt(e+e,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(e=>parseInt(s[1].slice(e,e+2),16)/255);if(s=t.match(/^rgba?\(([^)]+)\)$/i),s){let e=s[1].split(/[\s,\/]+/).map(Number);if(e.length>=3&&e.every(r=>!isNaN(r)))return[e[0]/255,e[1]/255,e[2]/255]}return null}var $e={off:0,idle:.25,busy:.6,active:1},Ye=["animation","speed","effect","state","color","size","gravity","gravity-gap"],te=t=>t.replace(/-([a-z])/g,(s,e)=>e.toUpperCase()),S=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(K),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.broken=!1;this.phase=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=re(r.default,r.type)??0}static get observedAttributes(){return[...Ye,...this.manifest.uniforms.map(e=>R(e.name)),...E()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let a=document.createElement("sd-scene");this.shadowRoot.append(a),a.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,a){let o=a??"";switch(e){case"animation":this.animNames=o.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=o.split(/\s+/).filter(Boolean);return;case"speed":{let n=Number(o);this.speedValue=o===""||isNaN(n)?1:n;return}case"state":this.stateTarget=$e[o]??.25;return;case"color":{let n=W(o);n&&(this.rgb=n);return}case"size":this.style.setProperty("--sd-size",o);return;case"gravity":case"gravity-gap":return}if(A(e,a,this.effectParams))return;let i=this.manifest.uniforms.find(n=>R(n.name)===e);if(i){let n=re(a===null||a===""?i.default:a,i.type);n!==null&&(this.uniforms[i.name]=n)}}update(e){this.stateValue=U(this.stateValue,this.stateTarget,e,150),P()||(this.phase+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let o of this.animNames){let i=T.get(o)?.fn(this.phase,this.speedValue,this);if(i){if(i.rotation)for(let n=0;n<3;n++)r.rotation[n]+=i.rotation[n];i.offset&&(r.offset[0]+=i.offset[0],r.offset[1]+=i.offset[1]),i.scale!==void 0&&(r.scale*=i.scale),i.state!==void 0&&(r.state+=i.state),i.uniforms&&Object.assign(this.uniforms,i.uniforms)}}let a=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let o=this.blend*this.blend*(3-2*this.blend),i=this.prevPose;a={rotation:[0,1,2].map(n=>Qe(i.rotation[n],r.rotation[n],o)),offset:[g(i.offset[0],r.offset[0],o),g(i.offset[1],r.offset[1],o)],scale:g(i.scale,r.scale,o),state:g(i.state,r.state,o)}}this.pose=a,this.anim.rotation=I(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}};function Qe(t,s,e){let r=((s-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function re(t,s){if(s==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(s==="color")return Array.isArray(t)?t:W(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var q=null;function P(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(q??(q=matchMedia("(prefers-reduced-motion: reduce)")),q.matches)}function Ze(t,s){for(let e of s)Object.getOwnPropertyDescriptor(t,te(e))||Object.defineProperty(t,te(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function y(t,s){var r;if(!t?.tag||customElements.get(t.tag))return;G.set(t.name,{manifest:t,frag:s});let e=(r=class extends S{},r.manifest=t,r.frag=s,r);Ze(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var ae=`void main() { fragColor = texture(uScene, vUv); }
`;var _=class extends HTMLElement{constructor(){super();this.gl=null;this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.theme="auto";this.dpr=1;this.width=0;this.height=0;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e);let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","gravity-strength",...E()]}connectedCallback(){if(!this.gl){if(this.gl=Q(this.canvas),!this.gl){this.dataset.fallback="";for(let e of this.objects)e.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{Z(this.gl),this.fbos=null,z(this.gl);for(let e of this.objects)e.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof S&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,a){let o=a??"";e==="interaction"?(this.interactionNames=o.split(/\s+/).filter(Boolean),this.interactionNames.forEach(i=>w.get(i)?.setup?.(this))):e==="effect"?this.effectNames=o.split(/\s+/).filter(Boolean):e==="theme"?this.theme=o||"auto":e==="paused"?(this.paused=a!==null,this.paused?this.stop():this.start()):A(e,a,this.effectParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,this.objects=new Set([...this.objects].sort((r,a)=>r.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.dpr=Math.min(devicePixelRatio||1,2),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.dpr),a=Math.round(e.height*this.dpr);(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a);for(let o of this.objects){let i=o.getBoundingClientRect();o.rect=new DOMRect(i.left-e.left,i.top-e.top,i.width,i.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let a=this.gl,o=this.canvas.width,i=this.canvas.height;if(!a||o===0||i===0)return;P()||(this.clock=e),e=this.clock;for(let m of this.objects)m.update(r);for(let m of this.interactionNames)w.get(m)?.frame(this,r,this.pointer);let n=this.fbos??(this.fbos={scene:M(a,o,i),a:M(a,o,i),b:M(a,o,i),oa:M(a,1,1),ob:M(a,1,1)});v(a,n.scene,o,i),v(a,n.a,o,i),v(a,n.b,o,i);let f=this.themeValue;this.bind(a,n.scene,0,0,o,i,!0);let p=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,u)=>m.anim.z-u.anim.z);for(let m of p)this.draw(a,m,e,f,n);let c=n.scene,l=this.effectNames.filter(m=>b.has(m));for(let m of l){let u=c===n.a?n.b:n.a;this.bind(a,u,0,0,o,i,!0),this.pass(a,m,c,this.effectParams[m],[o,i],e,f),c=u}this.bind(a,null,0,0,o,i,!0),this.blit(a,c)}bind(e,r,a,o,i,n,f){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(a,o,i,n),e.scissor(a,o,i,n),e.enable(e.SCISSOR_TEST),f&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let a=O(e,ae,"effect");e.useProgram(a.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),j(e,a,{uScene:[0]}),k(e)}pass(e,r,a,o,i,n,f){let p=b.get(r),c;try{c=O(e,p.frag,"effect")}catch(m){console.error(`[solids] effect "${r}" shader failed:
${m.message}`),this.blit(e,a);return}e.useProgram(c.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a.tex);let l={};for(let m of p.manifest.params)l[m.name]=m.default;j(e,c,{uScene:[0],uResolution:i,uTime:n,uTheme:f,...l,...o}),k(e)}draw(e,r,a,o,i){let n=r.rect,f=r.manifest.bleed??1.5,p=n.x+n.width/2+r.anim.offset[0],c=n.y+n.height/2+r.anim.offset[1],l=n.width*f,m=n.height*f,u=Math.round((p-l/2)*this.dpr),F=Math.round((this.height-c-m/2)*this.dpr),d=Math.round(l*this.dpr),h=Math.round(m*this.dpr);if(d<=0||h<=0)return;let D;try{D=O(e,r.frag)}catch(x){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${x.message}`);return}let N=r.effectNames.filter(x=>b.has(x));N.length?(v(e,i.oa,d,h),v(e,i.ob,d,h),this.bind(e,i.oa,0,0,d,h,!0)):this.bind(e,i.scene,u,F,d,h,!1),e.useProgram(D.prog);let Ge=this.pointer.inside?[(this.pointer.x-p)/l*2,-((this.pointer.y-c)/m)*2]:[0,0];if(j(e,D,{uTime:a,uResolution:[d,h],uPointer:Ge,uRotation:r.anim.rotation,uScale:r.anim.scale/f,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:o,uColor:r.rgb,...r.uniforms}),k(e),!N.length)return;let L=i.oa;for(let x of N){let V=L===i.oa?i.ob:i.oa;this.bind(e,V,0,0,d,h,!0),this.pass(e,x,L,r.effectParams[x],[d,h],a,o),L=V}this.bind(e,i.scene,u,F,d,h,!1),this.blit(e,L)}};var ne=Math.PI/180,ie={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*ne,Math.sin(t*2*Math.PI/6)*8*ne,0]})};var oe={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var se={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var ce={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let s=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*s,state:.1*s}}};var me={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Ke=[ie,oe,se,ce,me];for(let t of Ke)T.set(t.meta.name,t);var fe={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var le=`uniform float threshold;
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
`;var de={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var he=`uniform float amount;

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
`;var ve={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var ye=`uniform float levels;
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
`;var xe={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var Me=`uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
`;var ut=[{manifest:fe,frag:le},{manifest:ue,frag:pe},{manifest:de,frag:he},{manifest:be,frag:ge},{manifest:ve,frag:ye},{manifest:xe,frag:Me}];for(let t of ut)b.set(t.manifest.name,t);var we=new WeakMap,Re=20*Math.PI/180,Se={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,s,e){let o=Math.max(1,Math.round(s/16));for(let i of t.objects){if(!i.rect)continue;let n=we.get(i)??we.set(i,{rx:0,ry:0,vx:0,vy:0}).get(i),f=0,p=0;if(e.inside){let c=i.rect.x+i.rect.width/2+i.anim.offset[0],l=i.rect.y+i.rect.height/2+i.anim.offset[1],m=(e.x-c)/Math.max(t.width,1),u=(e.y-l)/Math.max(t.height,1);p=Math.max(-1,Math.min(1,m*2))*Re,f=Math.max(-1,Math.min(1,u*2))*Re}for(let c=0;c<o;c++)n.vx=(n.vx+(f-n.rx)*.08)*.8,n.rx+=n.vx,n.vy=(n.vy+(p-n.ry)*.08)*.8,n.ry+=n.vy;i.anim.rotation=ee(I(n.rx,n.ry,0),i.anim.rotation)}}};var Te=new WeakMap,Ee={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,s,e){for(let r of t.objects){if(!r.rect)continue;let a=r.rect.x+r.rect.width/2+r.anim.offset[0],o=r.rect.y+r.rect.height/2+r.anim.offset[1],i=e.inside&&Math.abs(e.x-a)<=r.rect.width/2&&Math.abs(e.y-o)<=r.rect.height/2,n=U(Te.get(r)??0,i?1:0,s,160);Te.set(r,n),r.anim.scale*=1+.08*n,r.anim.state+=n*(1-r.stateValue)}}};var Ae=new WeakMap,Ce=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],pt=t=>t*t*(3-2*t),Pe={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,s){let e=[...t.objects].filter(n=>n.rect),r=e.find(n=>n.getAttribute("gravity")==="center")??null,a=C(t.getAttribute("gravity-strength"),.6),o=r?Ce(r):null,i=P();for(let n of e){let f=n.getAttribute("gravity"),p=!!o&&n!==r&&f!=="none",c=Ae.get(n);if(!c&&!p)continue;c||Ae.set(n,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let l=[0,0],m=0;if(p){let u=Ce(n);if(c.center!==r&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=r,c.angle=Math.atan2(u[1]-o[1],u[0]-o[0]),c.r=Math.hypot(u[0]-o[0],u[1]-o[1])),f==="fall"){let F=C(n.getAttribute("gravity-gap"),24)+(r.rect.width+n.rect.width)/4;i||(c.r+=(F-c.r)*(1-Math.exp(-s/700))*(.3+a))}else i||(c.angle+=s/1e3*.25*a),m=Math.sin(c.angle);l=[o[0]+Math.cos(c.angle)*c.r-u[0],o[1]+Math.sin(c.angle)*c.r-u[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+s/800);let u=pt(c.k);l=[g(c.from[0],l[0],u),g(c.from[1],l[1],u)]}c.offset=l,n.anim.offset[0]+=l[0],n.anim.offset[1]+=l[1],n.anim.z=m,n.anim.scale*=1+.06*m}}};var dt=[Se,Ee,Pe];for(let t of dt)w.set(t.meta.name,t);var Fe={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Le=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var Oe={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var je=`uniform float thickness;
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
`;var ke={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var Ue=`uniform float facets;
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
`;var Ie={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var _e=`uniform float turns;
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
`;var De={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var Ne=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Be={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var ze=`uniform float radius;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",_);y(Fe,Le);y(Oe,je);y(ke,Ue);y(Ie,_e);y(De,Ne);y(Be,ze);export{S as SdObject,_ as SdScene,y as defineObject,J as registry};
//# sourceMappingURL=solids.js.map
