var nr=Object.defineProperty;var sr=(t,o)=>{for(var e in o)nr(t,e,{get:o[e],enumerable:!0})};var ve=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var j=(t,o,e)=>Math.min(e,Math.max(o,t)),L=(t,o,e)=>t+(o-t)*e,C=(t,o,e,r)=>t+(o-t)*(1-Math.exp(-e/Math.max(r,1))),xe=new Float32Array([1,0,0,0,1,0,0,0,1]);function z(t,o,e){let r=Math.cos(t),n=Math.sin(t),s=Math.cos(o),i=Math.sin(o),a=Math.cos(e),m=Math.sin(e);return new Float32Array([s*a,s*m,-i,n*i*a-r*m,n*i*m+r*a,n*s,r*i*a+n*m,r*i*m-n*a,r*s])}function V(t,o){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let n=0;n<3;n++)e[r*3+n]=t[n]*o[r*3]+t[3+n]*o[r*3+1]+t[6+n]*o[r*3+2];return e}var ye=null,H=new Map;function re(t,o="srgb"){if(t=t.trim(),o==="srgb"){let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(a=>parseInt(a+a,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(a=>parseInt(i[1].slice(a,a+2),16)/255)}let e=o+t;if(H.has(e))return H.get(e);let r=ye??(ye=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!r)return null;r.fillStyle="#000",r.fillStyle=t;let n=r.fillStyle;r.fillStyle="#fff",r.fillStyle=t;let s=null;if(n===r.fillStyle){r.clearRect(0,0,1,1),r.fillRect(0,0,1,1);let i=r.getImageData(0,0,1,1,{colorSpace:o}).data;s=[i[0]/255,i[1]/255,i[2]/255]}return H.size>256&&H.clear(),H.set(e,s),s}var Y=null;function we(){if(Y!==null)return Y;try{let t=re("#ff0000","display-p3");Y=!!t&&t[1]>.05}catch{Y=!1}return Y}var Me=`#version 300 es
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
`;var Se=`#version 300 es
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
// The effect defines sdEffect(); main blends it with the scene by uMix (0 copy, 1 as designed, 2 accentuated),
// then clamps to valid premultiplied color. Calling a prototyped function defined later is plain GLSL.
uniform float uMix;
vec4 sdEffect();
void main() {
  vec4 r = sdEffect();
  vec4 s = texture(uScene, vUv);
  vec4 o = mix(s, r, uMix);
  o.a = clamp(o.a, 0.0, 1.0);
  // Keep premultiplied validity without flattening glass highlights: rgb may exceed alpha where an input already did.
  o.rgb = min(o.rgb, max(vec3(o.a), max(s.rgb, r.rgb)));
  fragColor = o;
}
`;var le=new WeakMap;function ke(t){let o=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return o?(me(o),{gl:o,colorSpace:o.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function me(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=we()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA)}function Re(t,o,e){let r=t.createShader(o);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function ae(t,o,e="object"){let r=le.get(t);r||le.set(t,r=new Map);let n=e[0]+o,s=r.get(n);if(s)return s;let i=(e==="object"?Me:Se)+`
`+o,a=t.createProgram();if(t.attachShader(a,Re(t,t.VERTEX_SHADER,ve)),t.attachShader(a,Re(t,t.FRAGMENT_SHADER,i)),t.linkProgram(a),!t.getProgramParameter(a,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(a)||"link failed");let m=new Map,p=t.getProgramParameter(a,t.ACTIVE_UNIFORMS);for(let u=0;u<p;u++){let l=t.getActiveUniform(a,u);m.set(l.name,t.getUniformLocation(a,l.name))}let c={prog:a,loc:m};return r.set(n,c),c}function Ee(t){le.delete(t)}function ne(t,o,e){for(let[r,n]of Object.entries(e)){let s=o.loc.get(r);s!==void 0&&(typeof n=="number"?t.uniform1f(s,n):n.length===1?t.uniform1i(s,n[0]):n.length===2?t.uniform2f(s,n[0],n[1]):n.length===3?t.uniform3f(s,n[0],n[1],n[2]):n.length===4?t.uniform4f(s,n[0],n[1],n[2],n[3]):n.length===9&&t.uniformMatrix3fv(s,!1,n))}}function se(t){t.drawArrays(t.TRIANGLES,0,3)}function G(t,o,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let n=t.createFramebuffer(),s={fb:n,tex:r,w:0,h:0};return Q(t,s,o,e),t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),s}function Q(t,o,e,r){e=Math.max(1,e),r=Math.max(1,r),!(o.w===e&&o.h===r)&&(t.bindTexture(t.TEXTURE_2D,o.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),o.w=e,o.h=r)}function fe(t,o){t.deleteFramebuffer(o.fb),t.deleteTexture(o.tex)}var je={};sr(je,{animations:()=>Z,effectAttrs:()=>J,effectParam:()=>K,effects:()=>I,interactionAttrs:()=>pe,interactionParam:()=>ue,interactionValue:()=>A,interactions:()=>U,kebab:()=>W,num:()=>S,objects:()=>$});var $=new Map,Z=new Map,I=new Map,U=new Map,Ae=()=>[...I.values()].map(t=>t.manifest),Te=()=>[...U.values()].map(t=>t.meta),Ce=t=>t.flatMap(o=>o.params.map(e=>`${o.name}-${W(e.name)}`)),J=()=>Ce(Ae()),pe=()=>Ce(Te()),W=t=>t.replace(/[A-Z]/g,o=>"-"+o.toLowerCase());function Pe(t,o,e,r){var n;for(let s of t){let i=s.name+"-";if(!o.startsWith(i))continue;let a=s.params.find(m=>W(m.name)===o.slice(i.length));if(a)return(r[n=s.name]??(r[n]={}))[a.name]=S(e,a.default),!0}return!1}var K=(t,o,e)=>Pe(Ae(),t,o,e),ue=(t,o,e)=>Pe(Te(),t,o,e),A=(t,o,e)=>t.interactionParams[o]?.[e]??U.get(o).meta.params.find(r=>r.name===e).default,S=(t,o)=>{if(t==null||t==="")return o;let e=Number(t);return isNaN(e)?o:e};var lr={off:0,idle:.25,busy:.6,active:1},mr=["animation","speed","effect","state","color","size","phase","gravity","gravity-gap"],Fe=t=>t.replace(/-([a-z])/g,(o,e)=>e.toUpperCase()),D=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.anim={rotation:new Float32Array(xe),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.z=0;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=Oe(r.default,r.type)??0}static get observedAttributes(){return[...mr,...this.manifest.uniforms.map(e=>W(e.name)),...J()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let n=document.createElement("sd-scene");this.shadowRoot.append(n),n.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,n){let s=n??"";switch(e){case"animation":this.animNames=s.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=s.split(/\s+/).filter(Boolean);return;case"speed":{let a=Number(s);this.speedValue=s===""||isNaN(a)?1:a;return}case"state":this.stateTarget=lr[s]??.25;return;case"color":this.recolor(s||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=s?`:host{width:${s}}`:"";return;case"phase":this.phaseOffset=S(s,0);return;case"gravity":case"gravity-gap":return}if(K(e,n,this.effectParams))return;let i=this.manifest.uniforms.find(a=>W(a.name)===e);if(i){let a=Oe(n===null||n===""?i.default:n,i.type);a!==null&&(this.uniforms[i.name]=a)}}recolor(e=this.colorSrc){let r=e?re(e,this.scene?.colorSpace):null;r&&(this.rgb=r,this.colorSrc=e)}update(e){this.stateValue=C(this.stateValue,this.stateTarget,e,150),P()||(this.clock+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let i=Z.get(s)?.fn(this.clock+this.phaseOffset,this.speedValue,this);if(i){if(i.rotation)for(let a=0;a<3;a++)r.rotation[a]+=i.rotation[a];i.offset&&(r.offset[0]+=i.offset[0],r.offset[1]+=i.offset[1]),i.scale!==void 0&&(r.scale*=i.scale),i.state!==void 0&&(r.state+=i.state),i.uniforms&&Object.assign(this.uniforms,i.uniforms)}}let n=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),i=this.prevPose;n={rotation:[0,1,2].map(a=>fr(i.rotation[a],r.rotation[a],s)),offset:[L(i.offset[0],r.offset[0],s),L(i.offset[1],r.offset[1],s)],scale:L(i.scale,r.scale,s),state:L(i.state,r.state,s)}}this.pose=n,this.anim.rotation=z(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=this.z}};function fr(t,o,e){let r=((o-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}function Oe(t,o){if(o==="float"){let r=typeof t=="number"?t:Number(t);return isNaN(r)?null:r}if(o==="color")return Array.isArray(t)?t:re(String(t));if(Array.isArray(t))return t;let e=String(t).split(/[\s,]+/).map(Number);return e.length===3&&e.every(r=>!isNaN(r))?e:null}var de=null;function P(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(de??(de=matchMedia("(prefers-reduced-motion: reduce)")),de.matches)}function pr(t,o){for(let e of o)Object.getOwnPropertyDescriptor(t,Fe(e))||Object.defineProperty(t,Fe(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}function R(t,o){var r;if(!t?.tag||customElements.get(t.tag))return;$.set(t.name,{manifest:t,frag:o});let e=(r=class extends D{},r.manifest=t,r.frag=o,r);pr(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var Le=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var q=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.t0=0;this.visible=!0;this.paused=!1;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer={x:e.clientX-r.left,y:e.clientY-r.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.t0||(this.t0=e),this.last&&(this.fps=he(this.fps,1e3/Math.max(e-this.last,1)));let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame((e-this.t0)/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","theme","paused","dpr",...J(),...pe()]}connectedCallback(){if(!this.gl){let e=ke(this.canvas);if(this.gl=e?.gl??null,this.colorSpace=e?.colorSpace??"srgb",!this.gl){this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop()}),this.canvas.addEventListener("webglcontextrestored",()=>{Ee(this.gl),this.fbos=null,this.query=null,me(this.gl);for(let r of this.objects)r.broken=!1;this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let e of this.querySelectorAll("*"))e instanceof D&&this.attach(e);for(let e of this.objects)this.ro.observe(e);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis)}attributeChangedCallback(e,r,n){let s=n??"";if(e==="interaction")this.interactionNames=s.split(/\s+/).filter(Boolean),this.interactionNames.forEach(i=>U.get(i)?.setup?.(this));else if(e==="effect")this.effectNames=s.split(/\s+/).filter(Boolean);else if(e==="theme")this.theme=s||"auto";else if(e==="dpr"){let i=Number(s);this.maxDpr=s&&!isNaN(i)&&i>0?i:2,this.measure()}else e==="paused"?(this.paused=n!==null,this.paused?this.stop():this.start()):K(e,n,this.effectParams)||ue(e,n,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.objects=new Set([...this.objects].sort((r,n)=>r.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.measure())}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e)}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||matchMedia("(prefers-color-scheme: light)").matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.pixelRatio),n=Math.round(e.height*this.pixelRatio);(this.canvas.width!==r||this.canvas.height!==n)&&(this.canvas.width=r,this.canvas.height=n);for(let s of this.objects){let i=s.getBoundingClientRect();s.rect=new DOMRect(i.left-e.left,i.top-e.top,i.width,i.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let n=this.gl,s=this.canvas.width,i=this.canvas.height;if(!n||s===0||i===0)return;let a=performance.now(),m=this.gpuOn?this.gpuBegin(n):null;try{this.render(n,s,i,e,r)}finally{m&&n.endQuery(m.TIME_ELAPSED_EXT),this.frameTime=he(this.frameTime,performance.now()-a)}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let r=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!r)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let n=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(r.GPU_DISJOINT_EXT)&&Number.isFinite(n)&&(this.gpuMs=he(this.gpuMs??0,n/1e6))}return e.beginQuery(r.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),r}render(e,r,n,s,i){P()||(this.clock=s),s=this.clock;for(let l of this.objects)l.update(i);this.step(i);for(let l of this.interactionNames)U.get(l)?.frame(this,i,this.pointer);let a=this.fbos??(this.fbos={scene:G(e,r,n),a:G(e,r,n),b:G(e,r,n),pool:new Map,used:new Set});Q(e,a.scene,r,n),Q(e,a.a,r,n),Q(e,a.b,r,n);let m=this.themeValue;this.bind(e,a.scene,0,0,r,n,!0);let p=[...this.objects].filter(l=>l.rect&&!l.broken).sort((l,f)=>l.anim.z-f.anim.z);for(let l of p)this.draw(e,l,s,m,a);let c=a.scene,u=this.effectNames.filter(l=>I.has(l));for(let l of u){let f=c===a.a?a.b:a.a;this.bind(e,f,0,0,r,n,!0),this.pass(e,l,c,this.effectParams[l],[r,n],s,m),c=f}this.bind(e,null,0,0,r,n,!0),this.blit(e,c);for(let[l,f]of a.pool)a.used.has(l)||(fe(e,f[0]),fe(e,f[1]),a.pool.delete(l));a.used.clear()}step(e){}bind(e,r,n,s,i,a,m){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(n,s,i,a),e.scissor(n,s,i,a),e.enable(e.SCISSOR_TEST),m&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT))}blit(e,r){let n=ae(e,Le,"effect");e.useProgram(n.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.tex),ne(e,n,{uScene:[0]}),se(e)}pass(e,r,n,s,i,a,m){let p=I.get(r),c;try{c=ae(e,p.frag,"effect")}catch(l){console.error(`[solids] effect "${r}" shader failed:
${l.message}`),this.blit(e,n);return}e.useProgram(c.prog),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.tex);let u={};for(let l of p.manifest.params)u[l.name]=l.default;ne(e,c,{uScene:[0],uResolution:i,uTime:a,uTheme:m,uMix:s?.mix??1,...u,...s}),se(e)}draw(e,r,n,s,i,a=this.canvas.width,m=this.canvas.height){let p=r.rect,c=r.manifest.bleed??1.5,u=p.x+p.width/2+r.anim.offset[0],l=p.y+p.height/2+r.anim.offset[1],f=p.width*r.anim.scale*this.pixelRatio,d=Math.ceil(f*c/8)*8,b=d;if(!(f>0)||d>8192)return;let w=Math.round(u*this.pixelRatio-d/2),M=Math.round((this.height-l)*this.pixelRatio-b/2);if(w>=a||M>=m||w+d<=0||M+b<=0)return;let T=d/this.pixelRatio,k=b/this.pixelRatio,y;try{y=ae(e,r.frag)}catch(v){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${v.message}`);return}let B=r.effectNames.filter(v=>I.has(v)),E;if(B.length){let v=d+"x"+b;E=i.pool.get(v),E||i.pool.set(v,E=[G(e,d,b),G(e,d,b)]),i.used.add(v),this.bind(e,E[0],0,0,d,b,!0)}else this.bind(e,i.scene,w,M,d,b,!1);e.useProgram(y.prog);let h=this.pointer.inside?[(this.pointer.x-u)/T*2,-((this.pointer.y-l)/k)*2]:[0,0];if(ne(e,y,{uTime:n,uResolution:[d,b],uPointer:h,uRotation:r.anim.rotation,uScale:f/d,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:s,uColor:r.rgb,...r.uniforms}),se(e),!B.length)return;let g=E[0];for(let v of B){let x=g===E[0]?E[1]:E[0];this.bind(e,x,0,0,d,b,!0),this.pass(e,v,g,r.effectParams[v],[d,b],n,s),g=x}this.bind(e,i.scene,w,M,d,b,!1),this.blit(e,g)}},he=(t,o)=>t?t+(o-t)*.1:o;var dr=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],hr=["idle","float","spin"],ze=["count","seed","gravity","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],br=["count","seed","gravity","shapes","palette"],Ie=640,_=Math.PI/180,Ue=()=>new Set([...$.values()].map(t=>t.manifest.tag)),N=t=>Math.hypot(t[0],t[1],t[2]),X=(t,o)=>[t[0]-o[0],t[1]-o[1],t[2]-o[2]],De=(t,o)=>[t[1]*o[2]-t[2]*o[1],t[2]*o[0]-t[0]*o[2],t[0]*o[1]-t[1]*o[0]],ee=t=>{let o=N(t)||1;return[t[0]/o,t[1]/o,t[2]/o]};function _e(t){return()=>{t=t+1831565813|0;let o=Math.imul(t^t>>>15,1|t);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}var ie=class extends q{constructor(){super();this.yaw=0;this.pitch=0;this.bodies=[];this.ready=!1;this.time=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary)){this.drag={x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{if(!this.drag)return;let r=Math.max(1,e.timeStamp-this.drag.t),n=(e.clientX-this.drag.x)*.006,s=(e.clientY-this.drag.y)*.006;this.yaw+=n,this.pitch=j(this.pitch+s,-60*_,60*_),this.vel=[n/r,s/r],this.drag={x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=()=>{this.drag&&(this.drag=null,this.classList.remove("sd-dragging"),P()&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp)}static get observedAttributes(){return[...q.observedAttributes,...ze]}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=Ue();[...this.children].some(r=>e.has(r.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,r,n){if(!ze.includes(e))return super.attributeChangedCallback(e,r,n);this.ready&&br.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof D)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let l of this.kids())l.remove();let e=Ue(),r=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(l=>l.startsWith("sd-")?l:"sd-"+l),n=(r.length?r:[...e]).filter(l=>e.has(l)),s=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??dr,i=n.length?j(Math.round(S(this.getAttribute("count"),24)),0,120):0,a=_e(S(this.getAttribute("seed"),1)),m=l=>l[Math.floor(a()*l.length)],p=()=>{for(;;){let l=[a()*2-1,a()*2-1,a()*2-1];if(N(l)<=1)return l}},c=[];for(let l=0;l<i;l++){let f=8*Math.round((40+100*a())/8),d=f/Ie,b=p(),w=-1/0;for(let M=0;M<8;M++){let T=p(),k=2;for(let y of c)k=Math.min(k,N(X(T,y.p))-d-y.r);k>w&&(w=k,b=T)}c.push({tag:m(n),p:b,r:d,size:f,color:m(s),anim:m(hr),speed:.6+a()*.8,phase:a()*20,center:!1})}if(this.hasAttribute("gravity")&&i){let l=c.reduce((f,d)=>d.size>f.size?d:f);l.center=!0,l.p=[0,0,0]}let u=document.createDocumentFragment();for(let l of c){let f=document.createElement(l.tag);f.dataset.pos=l.p.map(d=>d.toFixed(2)).join(" "),f.setAttribute("size",l.size+"px"),f.setAttribute("color",l.color),f.setAttribute("animation",l.anim),f.setAttribute("speed",l.speed.toFixed(2)),f.setAttribute("phase",l.phase.toFixed(1)),l.center&&f.setAttribute("gravity","center"),u.append(f)}this.append(u),this.adopt()}adopt(){let e=_e(S(this.getAttribute("seed"),1)*7919+17),r=this.kids(),n=r.map(a=>S((a.getAttribute("size")??"").replace("px",""),80));if(this.bodies=r.map((a,m)=>{let p=(a.dataset.pos??"").split(/\s+/).map(Number),c=p.length===3&&p.every(f=>!isNaN(f))?[p[0],p[1],p[2]]:ee([e()-.5,e()-.5,e()-.5]).map(f=>f*e()),u=ee([e()-.5,e()-.5,e()-.5]).map(f=>f*(.02+e()*.04)),l=[];for(let f=0;f<3;f++)l.push(.05+e()*.1,e()*2*Math.PI,.02+e()*.03);return{el:a,p:c,v:u,r:n[m]/Ie,tilt:z((e()-.5)*70*_,0,(e()-.5)*70*_),wob:l,orbit:null,pinned:!1}}),!this.hasAttribute("gravity")||!this.bodies.length)return;let s=this.bodies.find(a=>a.el.getAttribute("gravity")==="center")??this.bodies.reduce((a,m)=>m.r>a.r?m:a);s.pinned=!0;let i=this.bodies.filter(a=>a!==s).sort((a,m)=>N(X(a.p,s.p))-N(X(m.p,s.p)));for(let a of i.slice(0,Math.round(i.length/3))){let m=ee(X(a.p,s.p)),p=Math.max(N(X(a.p,s.p)),s.r+a.r+.04),c=ee(De(m,ee([e()-.5,e()-.5,e()-.5])));a.orbit={c:s.p,r:p,w:(e()<.5?-1:1)*.35/Math.pow(p,1.5),u:m,v:De(c,m),a:0},a.p=[s.p[0]+m[0]*p,s.p[1]+m[1]*p,s.p[2]+m[2]*p]}}step(e){var E;let r=this.width,n=this.height;if(!r||!n)return;let s=P(),i=this.cam(),a=Math.max(0,S(this.getAttribute("speed"),1)),m=s?0:j(S(this.getAttribute("drift"),.5),0,1),p=j(S(this.getAttribute("depth"),.5),0,1),c=j(S(this.getAttribute("focus"),0),-1,1),u=1.6/j(S(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),i.has("spin")&&!s&&(this.yaw+=e/1e3*(2*Math.PI/90)*a*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=j(this.pitch+this.vel[1]*e,-60*_,60*_);let h=Math.exp(-e/600);this.vel[0]*=h,this.vel[1]*=h}let l=i.has("pointer")&&this.pointer.inside;this.tilt[0]=C(this.tilt[0],l?-(this.pointer.x/r*2-1)*12*_:0,e,150),this.tilt[1]=C(this.tilt[1],l?(this.pointer.y/n*2-1)*8*_:0,e,150);let f=this.yaw+this.tilt[0],d=this.pitch+this.tilt[1],b=Math.cos(f),w=Math.sin(f),M=Math.cos(d),T=Math.sin(d),k=r/2*.95,y=n/2*.95*(u-.6)/u;s||(this.time+=e/1e3);let B=this.bodies.filter(h=>h.el.scene===this);for(let h of B)if(h.orbit){let g=h.orbit;s||(g.a+=e/1e3*g.w*a);let v=Math.cos(g.a),x=Math.sin(g.a);for(let F=0;F<3;F++)h.p[F]=g.c[F]+g.r*(v*g.u[F]+x*g.v[F])}else if(!h.pinned&&m>0){for(let v=0;v<3;v++)h.p[v]+=h.v[v]*(e/1e3)*m;let g=N(h.p);if(g>1){let v=(h.p[0]*h.v[0]+h.p[1]*h.v[1]+h.p[2]*h.v[2])/g;if(v>0)for(let x=0;x<3;x++)h.v[x]-=2*v*h.p[x]/g;for(let x=0;x<3;x++)h.p[x]/=g}}this.hasAttribute("collide")&&this.collide(B);for(let h of B){let g=h.el.anim,v=h.wob,x=[h.p[0],h.p[1],h.p[2]];if(m>0)for(let O=0;O<3;O++)x[O]+=Math.sin(2*Math.PI*v[O*3]*this.time+v[O*3+1])*v[O*3+2]*m;let F=x[0]*b+x[2]*w,be=-x[0]*w+x[2]*b,ar=x[1]*M-be*T,te=x[1]*T+be*M,oe=j(u/(u-te),.3,3);g.offset[0]+=F*oe*k,g.offset[1]-=ar*oe*y,g.scale*=oe,g.z=te,g.rotation=V(h.tilt,g.rotation);let ge=Math.min(24,p*Math.abs(te-c)*14),ce=h.el.effectNames.filter(O=>O!=="defocus");ge>=.5?(h.el.effectNames=[...ce,"defocus"],((E=h.el.effectParams).defocus??(E.defocus={})).radius=ge):ce.length!==h.el.effectNames.length&&(h.el.effectNames=ce),g.state-=.75*p*Math.max(0,c-te)}}collide(e){let r=n=>n.pinned||n.orbit?1/0:n.r*n.r*n.r;for(let n=0;n<4;n++)for(let s=0;s<e.length;s++)for(let i=s+1;i<e.length;i++){let a=e[s],m=e[i],p=r(a),c=r(m);if(p===1/0&&c===1/0)continue;let u=X(m.p,a.p),l=N(u),f=a.r+m.r;if(l>=f)continue;let d=l<1e-6?[1,0,0]:[u[0]/l,u[1]/l,u[2]/l];l=l||0;let b=p===1/0?0:1/p,w=c===1/0?0:1/c,M=b+w;for(let y=0;y<3;y++)a.p[y]-=d[y]*(f-l)*(b/M),m.p[y]+=d[y]*(f-l)*(w/M);let T=(m.v[0]-a.v[0])*d[0]+(m.v[1]-a.v[1])*d[1]+(m.v[2]-a.v[2])*d[2];if(T>=0)continue;let k=-2*T/M;for(let y=0;y<3;y++)a.v[y]-=d[y]*k*b,m.v[y]+=d[y]*k*w}}};var Ne=Math.PI/180,Be={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*Ne,Math.sin(t*2*Math.PI/6)*8*Ne,0]})};var qe={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var Ve={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Ge={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let o=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*o,state:.1*o}}};var We={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var gr=[Be,qe,Ve,Ge,We];for(let t of gr)Z.set(t.meta.name,t);var Xe={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var He=`uniform float threshold;
uniform float radius;
uniform float strength;

vec4 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return c * smoothstep(threshold, threshold + 0.3, sdLuma(c.rgb));
}

vec4 sdEffect() {
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
  return base + acc / wsum * strength * 1.6;
}
`;var Ye={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var Qe=`uniform float angle;
uniform float reach;
uniform float strength;

vec4 sdEffect() {
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
  return base + acc / wsum * strength;
}
`;var $e={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var Ze=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var Je={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var Ke=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var et={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var tt=`uniform float levels;
uniform float scale;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  if (c.a < 0.004) return vec4(0.0);
  vec3 straight = c.rgb / c.a;
  float t = sdBayer(gl_FragCoord.xy / scale) - 0.5;
  float n = levels - 1.0;
  vec3 q = floor(straight * n + t + 0.5) / n;
  return vec4(clamp(q, 0.0, 1.0) * c.a, c.a);
}
`;var rt={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var at=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var nt={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var st=`uniform float size;
uniform float angle;

vec4 sdEffect() {
  float a = radians(angle);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 g = r * gl_FragCoord.xy / size;               // position in the rotated dot grid
  vec2 cell = floor(g) + 0.5;
  vec4 c = texture(uScene, transpose(r) * cell * size / uResolution);
  // Dot area follows brightness on dark pages and opacity on light ones, where pale glass is the ink.
  float v = mix(max(c.r, max(c.g, c.b)), c.a, uTheme);
  v = max(v - 0.06, 0.0) / 0.94;                     // the faint halo prints no dots
  float cov = clamp((sqrt(v) * 0.62 - length(g - cell)) * size + 0.5, 0.0, 1.0) * step(1e-4, v);
  return vec4(c.rgb / max(c.a, 1e-3), 1.0) * cov * step(0.004, c.a);
}
`;var it={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var ot=`uniform float width;
uniform float strength;

vec4 at(float x, float y) { return texture(uScene, vUv + vec2(x, y) * width / uResolution); }
float k(vec4 s) { return sdLuma(s.rgb) * 0.5 + s.a * 0.5; }

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  vec4 l = at(-1.0, 0.0), r = at(1.0, 0.0), b = at(0.0, -1.0), t = at(0.0, 1.0);
  float tl = k(at(-1.0, 1.0)), tr = k(at(1.0, 1.0)), bl = k(at(-1.0, -1.0)), br = k(at(1.0, -1.0));
  // Sobel on luma plus opacity, so silhouettes and inner edges both draw.
  float gx = tr + 2.0 * k(r) + br - tl - 2.0 * k(l) - bl;
  float gy = tl + 2.0 * k(t) + tr - bl - 2.0 * k(b) - br;
  // Thresholded so the faint falloff of a halo draws no line.
  float e = smoothstep(0.06, 0.5, length(vec2(gx, gy))) * strength;
  // Line color: the neighborhood's own hue at full brightness, deeper on light pages.
  vec4 m = max(max(l, r), max(b, t));
  vec3 tint = m.rgb / max(max(m.r, max(m.g, m.b)), 1e-3);
  tint *= mix(1.0, 0.6, uTheme);
  // Premultiplied scaling: the body darkens on dark pages and pales on light ones.
  return vec4(tint, 1.0) * e + c * (1.0 - 0.7 * strength) * (1.0 - e);
}
`;var ct={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var lt=`uniform float amount;
uniform float size;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // A new pattern 24 times a second, cycling so the hash input stays small. Frozen with the clock under reduced motion.
  float f = floor(mod(uTime * 24.0, 64.0));
  float n = hash(floor(gl_FragCoord.xy / size) + f * vec2(37.0, 17.0)) - 0.5;
  return vec4(clamp(c.rgb + n * amount * c.a, 0.0, c.a), c.a);
}
`;var mt={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var ft=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var pt={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var ut=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var dt={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var ht=`uniform float amplitude;
uniform float frequency;
uniform float speed;

vec4 sdEffect() {
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float r = length(p);
  // Push along the radius; fade to nothing at the very center where the direction is undefined.
  float w = sin((r * frequency - uTime * speed) * 6.2831853) * smoothstep(0.0, 0.06, r);
  vec2 dir = p / max(r, 1e-4);
  return texture(uScene, vUv + dir * w * amplitude / uResolution);
}
`;var bt={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var gt=`uniform float radius;

// 32 taps on a golden-angle disc (uniform area). Two decorrelated Bayer values per pixel rotate the
// spiral and stratify its radii, so the sparse kernel reads as fine grain instead of rings or copies.
// 16 taps showed grain from about 8 px up. Averaging premultiplied color keeps it valid.
vec4 sdEffect() {
  if (radius < 0.5) return texture(uScene, vUv);
  vec2 px = radius / uResolution;
  float j = sdBayer(gl_FragCoord.xy) * 6.2831853;
  float k = sdBayer(gl_FragCoord.yx + vec2(1.0, 2.0));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float a = float(i) * 2.3999632 + j;
    acc += texture(uScene, vUv + vec2(cos(a), sin(a)) * sqrt((float(i) + k) / 32.0) * px);
  }
  return acc / 32.0;
}
`;var Gr=[{manifest:Xe,frag:He},{manifest:Ye,frag:Qe},{manifest:$e,frag:Ze},{manifest:Je,frag:Ke},{manifest:et,frag:tt},{manifest:rt,frag:at},{manifest:nt,frag:st},{manifest:it,frag:ot},{manifest:ct,frag:lt},{manifest:mt,frag:ft},{manifest:pt,frag:ut},{manifest:dt,frag:ht},{manifest:bt,frag:gt}],Wr={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of Gr)t.manifest.params.some(o=>o.name==="mix")||t.manifest.params.push(Wr),I.set(t.manifest.name,t);var vt=new WeakMap,yt=20*Math.PI/180,xt={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,o,e){let s=Math.max(1,Math.round(o/16));for(let i of t.objects){if(!i.rect)continue;let a=vt.get(i)??vt.set(i,{rx:0,ry:0,vx:0,vy:0}).get(i),m=0,p=0;if(e.inside){let c=i.rect.x+i.rect.width/2+i.anim.offset[0],u=i.rect.y+i.rect.height/2+i.anim.offset[1],l=(e.x-c)/Math.max(t.width,1),f=(e.y-u)/Math.max(t.height,1);p=Math.max(-1,Math.min(1,l*2))*yt,m=Math.max(-1,Math.min(1,f*2))*yt}for(let c=0;c<s;c++)a.vx=(a.vx+(m-a.rx)*.08)*.8,a.rx+=a.vx,a.vy=(a.vy+(p-a.ry)*.08)*.8,a.ry+=a.vy;i.anim.rotation=V(z(a.rx,a.ry,0),i.anim.rotation)}}};var wt=new WeakMap,Mt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,o,e){for(let r of t.objects){if(!r.rect)continue;let n=r.rect.x+r.rect.width/2+r.anim.offset[0],s=r.rect.y+r.rect.height/2+r.anim.offset[1],i=e.inside&&Math.abs(e.x-n)<=r.rect.width/2&&Math.abs(e.y-s)<=r.rect.height/2,a=C(wt.get(r)??0,i?1:0,o,160);wt.set(r,a),r.anim.scale*=1+.08*a,r.anim.state+=a*(1-r.stateValue)}}};var St=new WeakMap,Rt=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],Xr=t=>t*t*(3-2*t),kt={meta:{name:"gravity",description:"One object is the center. The others orbit it, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Fall gap in px (object attribute gravity-gap)"}]},frame(t,o){let e=[...t.objects].filter(a=>a.rect),r=e.find(a=>a.getAttribute("gravity")==="center")??null,n=S(t.getAttribute("gravity-strength"),.6),s=r?Rt(r):null,i=P();for(let a of e){let m=a.getAttribute("gravity"),p=!!s&&a!==r&&m!=="none",c=St.get(a);if(!c&&!p)continue;c||St.set(a,c={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1});let u=[0,0],l=0;if(p){let f=Rt(a);if(c.center!==r&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=r,c.angle=Math.atan2(f[1]-s[1],f[0]-s[0]),c.r=Math.hypot(f[0]-s[0],f[1]-s[1])),m==="fall"){let d=S(a.getAttribute("gravity-gap"),24)+(r.rect.width+a.rect.width)/4;i||(c.r+=(d-c.r)*(1-Math.exp(-o/700))*(.3+n))}else i||(c.angle+=o/1e3*.25*n),c.r=Math.hypot(f[0]-s[0],f[1]-s[1]),l=Math.sin(c.angle);u=[s[0]+Math.cos(c.angle)*c.r-f[0],s[1]+Math.sin(c.angle)*c.r-f[1]]}else c.center&&(c.from=[c.offset[0],c.offset[1]],c.k=0,c.center=null);if(c.k<1){c.k=Math.min(1,c.k+o/800);let f=Xr(c.k);u=[L(c.from[0],u[0],f),L(c.from[1],u[1],f)]}c.offset=u,a.anim.offset[0]+=u[0],a.anim.offset[1]+=u[1],a.anim.z+=l,a.anim.scale*=1+.06*l}}};var Et=new WeakMap,At={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,o,e){let r=A(t,"repel","radius"),n=A(t,"repel","strength"),s=Math.max(1,Math.round(o/16));for(let i of t.objects){if(!i.rect)continue;let a=Et.get(i)??Et.set(i,{x:0,y:0,vx:0,vy:0}).get(i),m=0,p=0;if(e.inside){let c=i.rect.x+i.rect.width/2+i.anim.offset[0]-e.x,u=i.rect.y+i.rect.height/2+i.anim.offset[1]-e.y,l=Math.hypot(c,u);if(l<r){let f=(1-l/r)*r*.5*n;m=l>.001?c/l*f:0,p=l>.001?u/l*f:-f}}for(let c=0;c<s;c++)a.vx=(a.vx+(m-a.x)*.08)*.8,a.x+=a.vx,a.vy=(a.vy+(p-a.y)*.08)*.8,a.y+=a.vy;i.anim.offset[0]+=a.x,i.anim.offset[1]+=a.y}}};var Tt=new WeakMap,Ct={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,o,e){let r=A(t,"magnet","reach"),n=A(t,"magnet","strength");for(let s of t.objects){if(!s.rect)continue;let i=Tt.get(s)??[0,0],a=0,m=0;if(e.inside){a=(e.x-s.rect.x-s.rect.width/2-s.anim.offset[0])*n,m=(e.y-s.rect.y-s.rect.height/2-s.anim.offset[1])*n;let c=Math.hypot(a,m);c>r&&(a*=r/c,m*=r/c)}let p=[C(i[0],a,o,250),C(i[1],m,o,250)];Tt.set(s,p),s.anim.offset[0]+=p[0],s.anim.offset[1]+=p[1]}}};var Pt=new WeakMap,jt={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,o){let e=A(t,"collide","gap"),r=[...t.objects].filter(m=>m.rect),n=r.map(m=>[m.rect.x+m.rect.width/2+m.anim.offset[0],m.rect.y+m.rect.height/2+m.anim.offset[1]]),s=n.map(m=>[...m]),i=r.map(m=>m.getAttribute("gravity")==="center"?0:1);for(let m=0;m<4;m++)for(let p=0;p<r.length;p++)for(let c=p+1;c<r.length;c++){let u=s[c][0]-s[p][0],l=s[c][1]-s[p][1],f=Math.hypot(u,l),d=(r[p].rect.width+r[c].rect.width)/2+e,b=i[p]+i[c];if(f>=d||!b)continue;f<.001?(u=1,l=0):(u/=f,l/=f);let w=(d-f)*i[p]/b,M=(d-f)*i[c]/b;s[p][0]-=u*w,s[p][1]-=l*w,s[c][0]+=u*M,s[c][1]+=l*M}let a=P()?1:1-Math.exp(-o/120);r.forEach((m,p)=>{let c=Pt.get(m)??[0,0],u=[c[0]+(s[p][0]-n[p][0]-c[0])*a,c[1]+(s[p][1]-n[p][1]-c[1])*a];Pt.set(m,u),m.anim.offset[0]+=u[0],m.anim.offset[1]+=u[1]})}};var Ft={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let o=t.getBoundingClientRect(),e=innerHeight,r=Math.min(1,Math.max(0,(e-o.top)/Math.max(e+o.height,1))),n=z(0,(r-.5)*A(t,"scroll","turns")*2*Math.PI,0);for(let s of t.objects)s.anim.rotation=V(n,s.anim.rotation)}};var Hr=[xt,Mt,kt,At,Ct,jt,Ft];for(let t of Hr)U.set(t.meta.name,t);var Ot={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",bleed:1.5,uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["sphere","basic"]};var Lt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var zt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["torus","basic"]};var It=`uniform float thickness;
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
`;var Ut={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",bleed:1.5,uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}],tags:["gem","faceted"]};var Dt=`uniform float facets;
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
`;var _t={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}],tags:["helix","spring"]};var Nt=`uniform float turns;
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
`;var Bt={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",bleed:1.5,uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}],tags:["organic","liquid"]};var qt=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var Vt={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",bleed:1.5,uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["box","basic"]};var Gt=`uniform float radius;
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
`;var Wt={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",bleed:1.5,uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}],tags:["knot","torus"]};var Xt=`uniform float twist;
uniform float thickness;

// The (2, q) torus knot: around the ring twice while winding q times around its tube. Returns the point, dc the tangent.
vec3 knot(float s, float q, out vec3 dc) {
  float b = s * q * 0.5, cb = cos(b), sb = sin(b), cs = cos(s), ss = sin(s);
  float rho = 0.45 + 0.18 * cb, drho = -0.09 * q * sb;
  dc = vec3(drho * cs - rho * ss, 0.09 * q * cb, drho * ss + rho * cs);
  return vec3(rho * cs, 0.18 * sb, rho * ss);
}

float map(vec3 p) {
  // Rest pose: facing the viewer, tipped back so the crossings read.
  p.yz = mat2(0.342, -0.94, 0.94, 0.342) * p.yz;
  float q = 2.0 * floor(twist * 0.5) + 1.0, a = atan(p.z, p.x), d = 1e9; // odd only: even values would unknot into one loop
  vec3 dc;
  // The tube passes this point's angle twice; from each pass, one Newton step onto the nearest curve point.
  for (int i = 0; i < 2; i++) {
    float s = a + 6.2831853 * float(i);
    for (int n = 0; n < 1; n++) { vec3 e = knot(s, q, dc) - p; s -= dot(e, dc) / dot(dc, dc); }
    d = min(d, length(knot(s, q, dc) - p));
  }
  return (d - thickness) * 0.9;
}

void main() {
  fragColor = sdRender(1.1, 0.3);
}
`;var Ht={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",bleed:1.5,uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}],tags:["faceted","basic"]};var Yt=`uniform float sides;
uniform float height;

float map(vec3 p) {
  // Rest pose: tipped toward the viewer so the top face shows, turned so an edge leads.
  p.yz = mat2(0.906, -0.423, 0.423, 0.906) * p.yz;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  float n = floor(sides + 0.5);
  float sector = 6.2831853 / n;
  float a = mod(atan(p.x, p.z) + sector * 0.5, sector) - sector * 0.5;
  // Distance to the nearest side plane, then extrude along y with slightly rounded edges.
  vec2 w = vec2(length(p.xz) * cos(a) - 0.52 * cos(sector * 0.5), abs(p.y) - height * 0.5) + 0.025;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.025;
}

void main() {
  fragColor = sdRender(1.0, 0.3);
}
`;var Qt={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",bleed:1.5,uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}],tags:["pill","basic"]};var $t=`uniform float span;
uniform float radius;

float map(vec3 p) {
  // Rest pose: lying on a diagonal, turned a little so it reads round.
  p.xy = mat2(0.819, 0.574, -0.574, 0.819) * p.xy;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  p.x -= clamp(p.x, -span * 0.5, span * 0.5);
  return length(p) - radius;
}

void main() {
  fragColor = sdRender(1.0, 0.4);
}
`;var Zt={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",bleed:1.5,uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}],tags:["star","faceted"]};var Jt=`uniform float points;
uniform float depth;

// Star outline (after Inigo Quilez): n points, outer radius r, m sets the spike sharpness (2 is a polygon, n the sharpest).
float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.141593 / n, en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float map(vec3 p) {
  // Rest pose: turned a little so the bevels catch the light.
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  p.yz = mat2(0.985, -0.174, 0.174, 0.985) * p.yz;
  float n = floor(points + 0.5);
  float s = sdStar(p.xy, 0.72, n, 0.4 * n + 0.6);
  vec2 w = vec2(s, abs(p.z) - depth * 0.5);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  // 45 degree bevel around the outline.
  return max(d, (w.x + w.y + depth * 0.4) * 0.7071);
}

void main() {
  fragColor = sdRender(1.1, 0.35);
}
`;var Kt={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",bleed:1.5,uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}],tags:["organic","spiral"]};var er=`uniform float turns;
uniform float growth;

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

// Beads on a logarithmic spiral: center radius 0.56 e^(growth t), bead radius 0.48 of that, t from -2 pi turns to 0.
float map(vec3 p) {
  // Rest pose: tipped back so the coil shows depth, shifted so the spiral's bulk sits on the origin.
  p.yz = mat2(0.94, -0.342, 0.342, 0.94) * p.yz;
  p.xy += vec2(0.16, -0.11);
  float g = growth, t0 = -6.2831853 * turns, gap = 0.5;
  float phi = atan(p.y, p.x);
  // Which winding this point is nearest to, from the inverse of the spiral.
  float n0 = floor((phi - log(max(length(p.xy), 1e-3) / 0.56) / g) / 6.2831853 + 0.5);
  float d = 1e9;
  for (int i = -1; i <= 1; i++) {
    float t = phi - 6.2831853 * (n0 + float(i));
    float j = floor(t / gap);
    for (int k = 0; k < 2; k++) {
      float tb = clamp((j + float(k)) * gap, t0, 0.0);
      float R = 0.56 * exp(g * tb);
      d = smin(d, length(p - R * vec3(cos(tb), sin(tb), 0.0)) - 0.48 * R, 0.04);
    }
  }
  return d * 0.9;
}

void main() {
  fragColor = sdRender(1.1, 0.3);
}
`;var tr={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",bleed:1.5,uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}],tags:["coin","basic"]};var rr=`uniform float thickness;
uniform float bevel;

float map(vec3 p) {
  // Rest pose: tipped back and turned so the face and the edge both show.
  p.yz = mat2(0.819, 0.574, -0.574, 0.819) * p.yz;
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  float r = length(p.xy), h = thickness * 0.5;
  // Faces bulge a little toward the middle so the light slides across them.
  vec2 w = vec2(r - 0.62, abs(p.z) - h - 0.05 * (1.0 - r * r / 0.3844));
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  return max(d, (w.x + w.y + bevel * h) * 0.7071) * 0.9;
}

void main() {
  fragColor = sdRender(1.0, 0.3);
}
`;customElements.get("sd-scene")||customElements.define("sd-scene",q);R(Ot,Lt);R(zt,It);R(Ut,Dt);R(_t,Nt);R(Bt,qt);R(Vt,Gt);R(Wt,Xt);R(Ht,Yt);R(Qt,$t);R(Zt,Jt);R(Kt,er);R(tr,rr);customElements.get("sd-universe")||customElements.define("sd-universe",ie);export{D as SdObject,q as SdScene,ie as SdUniverse,R as defineObject,je as registry};
//# sourceMappingURL=solids.js.map
