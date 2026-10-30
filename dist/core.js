var _t=Object.defineProperty;var Ft=(t,n)=>{for(var e in n)_t(t,e,{get:n[e],enumerable:!0})};var Ee=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var A=(t,n,e)=>Math.min(e,Math.max(n,t)),Y=(t,n,e)=>t+(n-t)*e,Q=(t,n,e,r)=>t+(n-t)*(1-Math.exp(-e/Math.max(r,1)));var Te=new Float32Array([1,0,0,0,1,0,0,0,1]);function ie(t,n,e){let r=Math.cos(t),i=Math.sin(t),a=Math.cos(n),o=Math.sin(n),s=Math.cos(e),c=Math.sin(e);return new Float32Array([a*s,a*c,-o,i*o*s-r*c,i*o*c+r*s,i*a,r*o*s+i*c,r*o*c-i*s,r*a])}function Re(t,n){let e=new Float32Array(9);for(let r=0;r<3;r++)for(let i=0;i<3;i++)e[r*3+i]=t[i]*n[r*3]+t[3+i]*n[r*3+1]+t[6+i]*n[r*3+2];return e}var we=null,W=new Map;function he(t,n="srgb"){if(t=t.trim(),n==="srgb"){let o=t.match(/^#([0-9a-f]{3})$/i);if(o)return[...o[1]].map(s=>parseInt(s+s,16)/255);if(o=t.match(/^#([0-9a-f]{6})$/i),o)return[0,2,4].map(s=>parseInt(o[1].slice(s,s+2),16)/255)}let e=n+t;if(W.has(e))return W.get(e);let r=we??(we=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!r)return null;r.fillStyle="#000",r.fillStyle=t;let i=r.fillStyle;r.fillStyle="#fff",r.fillStyle=t;let a=null;if(i===r.fillStyle){r.clearRect(0,0,1,1),r.fillRect(0,0,1,1);let o=r.getImageData(0,0,1,1,{colorSpace:n}).data;a=[o[0]/255,o[1]/255,o[2]/255]}return W.size>256&&W.clear(),W.set(e,a),a}var q=null;function Se(){if(q!==null)return q;try{let t=he("#ff0000","display-p3");q=!!t&&t[1]>.05}catch{q=!1}return q}var Pe=`#version 300 es
precision highp float;
// Core uniforms, set every frame by <sd-scene>.
uniform float uTime;       // seconds
uniform vec2  uResolution; // quad size in device px
uniform mat3  uRotation;   // object rotation from animations and interactions
uniform float uScale;      // object scale (already divided by bleed)
uniform float uBound;      // radius of the sphere holding the shape and its halo: 1.6 for a square box, more for a wide or tall one
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
// The march starts at z = 3 for a square box; a wide or tall box (uBound > 3) starts further back along the same ray, so
// an end turned toward the camera is not sliced by the start plane. Squares keep their exact rays.
float sdStart() { return max(3.0, uBound); }
void sdRay(out vec3 ro, out vec3 rd) {
  vec2 p = sdCoord();
  float zs = sdStart();
  ro = vec3(p * (0.7 - 0.1 * (zs - 3.0)), zs); // the same ray line, further back (it converges toward z = 10)
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
  float t = 0.0; minD = 1e9; float zs = sdStart();
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    minD = min(minD, d);
    if (d < 1e-3) return t;
    if (t > zs + uBound) break; // every ray has left the bound sphere by here (4.6 for a square box); pixel-identical to 7.0
    t += d * 0.9;
  }
  return -1.0;
}
// A key light at \`azimuthDeg\` around the view (0 from the right, 90 from the top), about 47 degrees up toward the viewer.
// Fixed to the view: the object turns under it (p, n and rd are object space, so the direction is brought into that space).
vec3 sdLightDir(float azimuthDeg) {
  float a = radians(azimuthDeg);
  return transpose(uRotation) * normalize(vec3(cos(a) * 0.7, sin(a) * 0.7, 0.75));
}
// A view-space direction from an object-space one (for sky and environment lookups that must not turn with the object).
vec3 sdView(vec3 v) { return uRotation * v; }
// A shade (src/shades/<name>/frag.glsl) defines these two: the color of a surface hit and the tint of the soft edge on a miss.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim);
vec3 sdEdge();
// True when the ray never enters the r = 1.6 sphere that holds every shape and halo (the quad corners).
bool sdMisses(vec3 ro, vec3 rd) { float b = dot(ro, rd); return b * b - dot(ro, ro) + uBound * uBound <= 0.0; }
// Default renderer: march, shade, soft edge, optional halo on miss.
vec4 sdRender(float rim, float glow) {
  vec3 ro, rd; sdRay(ro, rd);
  if (sdMisses(ro, rd)) return vec4(0.0); // cull
  float minD; float t = sdMarch(ro, rd, minD);
  float px = 2.5 / min(uResolution.x, uResolution.y) / uScale;
  if (t < 0.0) {
    float edge = 1.0 - smoothstep(0.0, px * 2.0, minD);
    float halo = glow * exp(-minD * 7.0) * 0.35 * (0.6 + 0.4 * uState);
    vec3 c = sdEdge() * (edge * 0.9 + halo);
    float a = clamp(edge * 0.9 + halo, 0.0, 1.0);
    return vec4(c, a);
  }
  vec3 p = ro + rd * t;
  return sdShade(p, sdNormal(p), rd, rim);
}
`;var Ae=`#version 300 es
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
`;var fe=new WeakMap;function Le(t){let n=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return n?(ue(n),{gl:n,colorSpace:n.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function ue(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=Se()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.enable(t.SCISSOR_TEST),t.clearColor(0,0,0,0),t.activeTexture(t.TEXTURE0)}function Ce(t,n,e){let r=t.createShader(n);if(t.shaderSource(r,e),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(r)||"shader compile failed");return r}function se(t,n,e="object",r){let i=fe.get(t);i||fe.set(t,i=new Map);let a=i.get(n);a||i.set(n,a=new Map);let o=e[0]+(r?.name??""),s=a.get(o);if(s)return s;let c=(e==="object"?Pe+`
`+(r?.frag??""):Ae)+`
`+n,f=t.createProgram();if(t.attachShader(f,Ce(t,t.VERTEX_SHADER,Ee)),t.attachShader(f,Ce(t,t.FRAGMENT_SHADER,c)),t.linkProgram(f),!t.getProgramParameter(f,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(f)||"link failed");let u=new Map,x=t.getProgramParameter(f,t.ACTIVE_UNIFORMS);for(let m=0;m<x;m++){let v=t.getActiveUniform(f,m);u.set(v.name,t.getUniformLocation(f,v.name))}let l={prog:f,loc:u};return a.set(o,l),l}function ke(t){fe.delete(t)}function ne(t,n,e){for(let[r,i]of Object.entries(e)){let a=n.loc.get(r);a!==void 0&&(typeof i=="number"?t.uniform1f(a,i):i.length===1?t.uniform1i(a,i[0]):i.length===2?t.uniform2f(a,i[0],i[1]):i.length===3?t.uniform3f(a,i[0],i[1],i[2]):i.length===4?t.uniform4f(a,i[0],i[1],i[2],i[3]):i.length===9&&t.uniformMatrix3fv(a,!1,i))}}function ae(t){t.drawArrays(t.TRIANGLES,0,3)}function N(t,n,e){let r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let i=t.createFramebuffer(),a={fb:i,tex:r,w:0,h:0};return $(t,a,n,e),t.bindFramebuffer(t.FRAMEBUFFER,i),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),a}function $(t,n,e,r){e=Math.max(1,e),r=Math.max(1,r),!(n.w===e&&n.h===r)&&(t.bindTexture(t.TEXTURE_2D,n.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),n.w=e,n.h=r)}function B(t,n){t.deleteFramebuffer(n.fb),t.deleteTexture(n.tex)}var Ie={};Ft(Ie,{LIGHT_SHADE:()=>_e,animations:()=>Z,clampTo:()=>re,effectAttrs:()=>K,effectParam:()=>ee,effects:()=>j,interactionAttrs:()=>pe,interactionParam:()=>ge,interactionValue:()=>Nt,interactions:()=>G,kebab:()=>z,num:()=>R,objects:()=>H,resolveShade:()=>ve,shadeAttrs:()=>J,shadeParam:()=>te,shades:()=>L});var H=new Map,Z=new Map,j=new Map,L=new Map,_e="matte",G=new Map,Fe=()=>[...j.values()].map(t=>t.manifest),Oe=()=>[...G.values()].map(t=>t.meta),Ue=()=>[...L.values()].map(t=>t.manifest),de=t=>t.flatMap(n=>n.params.map(e=>`${n.name}-${z(e.name)}`)),K=()=>de(Fe()),pe=()=>de(Oe()),J=()=>de(Ue()),z=t=>t.replace(/[A-Z]/g,n=>"-"+n.toLowerCase());function be(t,n,e,r){var i;for(let a of t){let o=a.name+"-";if(!n.startsWith(o))continue;let s=a.params.find(f=>z(f.name)===n.slice(o.length));if(!s)continue;let c=e==null||e===""?NaN:Number(e);return Number.isFinite(c)?(r[i=a.name]??(r[i]={}))[s.name]=re(c,s):delete r[a.name]?.[s.name],!0}return!1}var ee=(t,n,e)=>be(Fe(),t,n,e),ge=(t,n,e)=>be(Oe(),t,n,e),te=(t,n,e)=>be(Ue(),t,n,e),De=new Set;function ve(t,n){t&&t!=="auto"&&!L.has(t)&&!De.has(t)&&(De.add(t),console.warn(`[solids] unknown shading "${t}", using auto`));let e=L.has(t)?t:n?_e:"glass";return L.has(e)?e:"glass"}var Nt=(t,n,e)=>t.interactionParams[n]?.[e]??G.get(n).meta.params.find(r=>r.name===e).default,R=(t,n)=>{if(t==null||t==="")return n;let e=Number(t);return Number.isFinite(e)?e:n},re=(t,n)=>Math.min(n.max??t,Math.max(n.min??t,t));var Bt=new Map([["off",0],["idle",.25],["busy",.6],["active",1]]),jt=["animation","speed","effect","shading","state","color","size","phase","theme","gravity","gravity-gap"],oe=t=>t.replace(/-([a-z])/g,(n,e)=>e.toUpperCase()),k=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.shadeName="auto";this.shadeParams={};this.anim={rotation:new Float32Array(Te),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.pinned=!1;this.blurPx=0;this.field=null;this.drawn=null;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let r of this.manifest.uniforms)this.uniforms[r.name]=re(R(String(r.default),0),r)}static get observedAttributes(){return[...jt,...this.manifest.uniforms.map(e=>z(e.name)),...K(),...J()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),r=this.shadowRoot.querySelector("sd-scene");if(e)r&&(r.detach(this),r.remove()),e.attach?.(this);else if(r)r.attach(this);else{let i=document.createElement("sd-scene");this.hasAttribute("theme")&&i.setAttribute("theme",this.getAttribute("theme")),this.shadowRoot.append(i),i.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,r,i){let a=i??"";switch(e){case"animation":this.animNames=a.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=a.split(/\s+/).filter(Boolean);return;case"shading":this.shadeName=a.trim()||"auto";return;case"speed":this.speedValue=R(a,1);return;case"state":this.stateTarget=Bt.get(a)??.25;return;case"theme":this.shadowRoot.querySelector("sd-scene")?.setAttribute("theme",a);return;case"color":this.recolor(a||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=a?`:host{width:${a}}`:"";return;case"phase":this.phaseOffset=R(a,0);return;case"gravity":case"gravity-gap":return}if(ee(e,i,this.effectParams)||te(e,i,this.shadeParams))return;let o=this.manifest.uniforms.find(s=>z(s.name)===e);o&&(this.uniforms[o.name]=re(R(i,o.default),o))}recolor(e=this.colorSrc){let r=e?he(e,this.scene?.colorSpace):null;r&&(this.rgb=r,this.colorSrc=e)}drawCenter(){let e=this.rect;return[e.x+e.width/2+this.anim.offset[0],e.y+e.height/2+this.anim.offset[1]]}drawRadius(){return this.rect.width/2*this.anim.scale}update(e){this.stateValue=Q(this.stateValue,this.stateTarget,e,150),this.pinned=!1,this.blurPx=0;let r=X();r||(this.clock+=e/1e3*this.speedValue);let i={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let o of this.animNames){let s=Z.get(o)?.fn(r?0:this.clock+this.phaseOffset,this.speedValue,this);if(s){if(s.rotation)for(let c=0;c<3;c++)i.rotation[c]+=s.rotation[c];s.offset&&(i.offset[0]+=s.offset[0],i.offset[1]+=s.offset[1]),s.scale!==void 0&&(i.scale*=s.scale),s.state!==void 0&&(i.state+=s.state)}}let a=i;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let o=this.blend*this.blend*(3-2*this.blend),s=this.prevPose;a={rotation:[0,1,2].map(c=>Gt(s.rotation[c],i.rotation[c],o)),offset:[Y(s.offset[0],i.offset[0],o),Y(s.offset[1],i.offset[1],o)],scale:Y(s.scale,i.scale,o),state:Y(s.state,i.state,o)}}this.pose=a,this.anim.rotation=ie(a.rotation[0],a.rotation[1],a.rotation[2]),this.anim.offset=[a.offset[0],a.offset[1]],this.anim.scale=a.scale,this.anim.state=a.state,this.anim.z=0}};function Gt(t,n,e){let r=((n-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+r*e}var xe=null;function X(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(xe??(xe=matchMedia("(prefers-reduced-motion: reduce)")),xe.matches)}function Ne(t,n){for(let e of n)if(!Object.getOwnPropertyDescriptor(t,oe(e))){if(oe(e)in t){console.warn(`[solids] attribute "${e}" is not reflected: it would shadow the ${oe(e)} member`);continue}Object.defineProperty(t,oe(e),{get(){return this.getAttribute(e)},set(r){r==null?this.removeAttribute(e):this.setAttribute(e,String(r))}})}}function P(t,n){var r;if(!t?.tag||customElements.get(t.tag))return;H.set(t.name,{manifest:t,frag:n});let e=(r=class extends k{},r.manifest=t,r.frag=n,r);Ne(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var Be=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var F=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1,down:!1,tap:null};this.press=null;this.interactionNames=[];this.effectNames=[];this.shadeName="auto";this.shadeParams={};this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.visible=!1;this.paused=!1;this.dirty=!1;this.frames=0;this.failed=new Set;this.maxTex=8192;this.lose=null;this.fields=new Map;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let r=this.getBoundingClientRect();this.pointer.x=e.clientX-r.left,this.pointer.y=e.clientY-r.top,this.pointer.inside=!0};this.onLeave=()=>{this.pointer.inside=!1,this.pointer.down=!1};this.mine=e=>e.target.closest?.("sd-scene, sd-universe")===this;this.onPress=e=>{!e.isPrimary||e.button!==0||!this.mine(e)||(this.onPointer(e),this.pointer.down=!0,this.press={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp})};this.onRelease=e=>{let r=this.press;if(!(!r||e.pointerId!==r.id)&&(this.press=null,this.pointer.down=!1,!!this.mine(e)&&Math.hypot(e.clientX-r.x,e.clientY-r.y)<8&&e.timeStamp-r.t<400)){let i=this.getBoundingClientRect();this.tap(e.clientX-i.left,e.clientY-i.top)}};this.onCancelPress=()=>{this.press=null,this.pointer.down=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.last&&(this.fps=ye(this.fps,1e3/Math.max(e-this.last,1)));let r=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame(this.clock+r/1e3,r),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","shading","theme","paused","dpr",...K(),...pe(),...J()]}get time(){return this.clock}connectedCallback(){if(this.gl)this.gl.isContextLost()&&this.lose?.restoreContext();else{let r=Le(this.canvas);if(this.gl=r?.gl??null,this.colorSpace=r?.colorSpace??"srgb",this.gl)this.maxTex=Math.min(8192,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)),this.lose=this.gl.getExtension("WEBGL_lose_context");else{this.dataset.fallback="";for(let i of this.objects)i.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",i=>{i.preventDefault(),this.stop(),this.dataset.fallback="",this.isConnected&&this.lose?.restoreContext()}),this.canvas.addEventListener("webglcontextrestored",()=>{ke(this.gl),this.fbos=null,this.query=null,this.failed.clear(),this.fields.clear(),ue(this.gl);for(let i of this.objects)i.broken=!1;delete this.dataset.fallback,this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this);let e=this.getBoundingClientRect();this.visible=e.bottom>0&&e.right>0&&e.top<innerHeight&&e.left<innerWidth,this.io=new IntersectionObserver(r=>{this.visible=r[r.length-1].isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),this.addEventListener("pointerdown",this.onPress),this.addEventListener("pointerup",this.onRelease),this.addEventListener("pointercancel",this.onCancelPress),document.addEventListener("visibilitychange",this.onVis);for(let r of this.querySelectorAll("*"))r instanceof k&&r.closest("sd-scene, sd-universe")===this&&this.attach(r);for(let r of this.objects)this.ro.observe(r);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis),queueMicrotask(()=>{!this.isConnected&&this.gl&&!this.gl.isContextLost()&&this.lose?.loseContext()})}attributeChangedCallback(e,r,i){let a=i??"";if(e==="interaction")this.interactionNames=a.split(/\s+/).filter(Boolean),this.interactionNames.forEach(o=>G.get(o)?.setup?.(this));else if(e==="effect")this.effectNames=a.split(/\s+/).filter(Boolean);else if(e==="shading")this.shadeName=a.trim()||"auto";else if(e==="theme")this.theme=a||"auto";else if(e==="dpr"){let o=Number(a);this.maxDpr=a&&!isNaN(o)&&o>0?o:2,this.measure()}else e==="paused"?(this.paused=i!==null,this.paused?this.stop():this.start()):!ee(e,i,this.effectParams)&&!te(e,i,this.shadeParams)&&ge(e,i,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.dirty=!0)}settle(){this.dirty=!1,this.objects=new Set([...this.objects].sort((e,r)=>e.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.measure()}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e),this.dirty=!0;let r=this.fields.get(e);r&&(this.gl?.deleteTexture(r.tex),this.fields.delete(e))}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||(je??(je=matchMedia("(prefers-color-scheme: light)"))).matches?1:0}tap(e,r){this.pointer.tap={x:e,y:r}}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let r=Math.round(e.width*this.pixelRatio),i=Math.round(e.height*this.pixelRatio);(this.canvas.width!==r||this.canvas.height!==i)&&(this.canvas.width=r,this.canvas.height=i);for(let a of this.objects){let o=a.getBoundingClientRect();a.rect=new DOMRect(o.left-e.left,o.top-e.top,o.width,o.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,r){let i=this.gl;this.dirty&&this.settle();let a=this.canvas.width,o=this.canvas.height;if(!i||i.isContextLost()||a===0||o===0)return;let s=performance.now(),c=this.gpuOn?this.gpuBegin(i):null;try{this.render(i,a,o,e,r)}finally{c&&i.endQuery(c.TIME_ELAPSED_EXT),this.frames++>0&&(this.frameTime=ye(this.frameTime,performance.now()-s))}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let r=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!r)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let i=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(r.GPU_DISJOINT_EXT)&&Number.isFinite(i)&&(this.gpuMs=ye(this.gpuMs??0,i/1e6))}return e.beginQuery(r.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),r}render(e,r,i,a,o){X()||(this.clock=a),a=this.clock;for(let l of this.objects)l.update(o);this.step(o);for(let l of this.interactionNames)G.get(l)?.frame(this,o,this.pointer);let s=this.fbos??(this.fbos={scene:null,a:null,b:null,pool:new Map,used:new Set}),c=this.themeValue,f=this.effectNames.filter(l=>j.has(l));f.length?(s.scene??(s.scene=N(e,r,i)),s.a??(s.a=N(e,r,i)),s.b??(s.b=N(e,r,i)),$(e,s.scene,r,i),$(e,s.a,r,i),$(e,s.b,r,i)):s.scene&&(B(e,s.scene),B(e,s.a),B(e,s.b),s.scene=s.a=s.b=null);let u=f.length?s.scene:null;this.bind(e,u,0,0,r,i,!0);let x=[...this.objects].filter(l=>l.rect&&!l.broken).sort((l,m)=>(l.anim.z||0)-(m.anim.z||0));for(let l of x)this.draw(e,l,a,c,s,u);if(f.length){let l=s.scene;for(let m of f){let v=l===s.a?s.b:s.a;this.bind(e,v,0,0,r,i,!0),this.pass(e,m,l,this.effectParams[m],[r,i],a,c),l=v}this.bind(e,null,0,0,r,i,!0),this.blit(e,l)}for(let[l,m]of s.pool)s.used.has(l)?m[2]=0:++m[2]>60&&(B(e,m[0]),B(e,m[1]),s.pool.delete(l));s.used.clear()}step(e){}bind(e,r,i,a,o,s,c){e.bindFramebuffer(e.FRAMEBUFFER,r?.fb??null),e.viewport(i,a,o,s),e.scissor(i,a,o,s),c&&e.clear(e.COLOR_BUFFER_BIT)}blit(e,r){let i=se(e,Be,"effect");e.useProgram(i.prog),e.bindTexture(e.TEXTURE_2D,r.tex),ne(e,i,{uScene:[0]}),ae(e)}pass(e,r,i,a,o,s,c){let f=j.get(r);if(this.failed.has(r))return this.blit(e,i);let u;try{u=se(e,f.frag,"effect")}catch(l){this.failed.add(r),console.error(`[solids] effect "${r}" shader failed:
${l.message}`),this.blit(e,i);return}e.useProgram(u.prog),e.bindTexture(e.TEXTURE_2D,i.tex);let x={};for(let l of f.manifest.params)x[l.name]=l.default;ne(e,u,{uScene:[0],uResolution:o,uTime:s,uTheme:c,uMix:a?.mix??1,...x,...a}),ae(e)}draw(e,r,i,a,o,s,c=this.canvas.width,f=this.canvas.height){let u=r.rect,[x,l]=r.drawCenter();r.drawn=[x,l];let m=u.width*r.anim.scale*this.pixelRatio,v=u.height*r.anim.scale*this.pixelRatio,S=Math.min(m,v),b=Math.ceil(m*Ge/8)*8,d=Math.ceil(v*Ge/8)*8;if(!(S>0)||b>this.maxTex||d>this.maxTex)return;let M=Math.round(x*this.pixelRatio-b/2),y=Math.round((this.height-l)*this.pixelRatio-d/2);if(M>=c||y>=f||M+b<=0||y+d<=0)return;let w=ve(r.hasAttribute("shading")?r.shadeName:this.shadeName,a),C=L.get(w),h={};for(let p of C.manifest.params)h[p.name]=r.shadeParams[w]?.[p.name]??this.shadeParams[w]?.[p.name]??p.default;let T;try{T=se(e,r.frag,"object",{name:w,frag:C.frag})}catch(p){r.broken=!0,console.error(`[solids] <${r.manifest.tag}> shader failed:
${p.message}`);return}let E=r.effectNames.filter(p=>j.has(p));r.blurPx>=.5&&!E.includes("defocus")&&E.push("defocus");let g;if(E.length){let p=b+"x"+d;g=o.pool.get(p),g||o.pool.set(p,g=[N(e,b,d),N(e,b,d),0]),o.used.add(p),this.bind(e,g[0],0,0,b,d,!0)}else this.bind(e,s,M,y,b,d,!1);if(e.useProgram(T.prog),r.field){let p=this.fields.get(r);if(p)e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,p.tex);else{let _=e.createTexture();e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,_),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.fields.set(r,p={tex:_,v:-1})}p.v!==r.field.version&&(e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.R8,r.field.width,r.field.height,0,e.RED,e.UNSIGNED_BYTE,r.field.data),p.v=r.field.version),e.activeTexture(e.TEXTURE0)}if(ne(e,T,{uTime:i,uResolution:[b,d],uRotation:r.anim.rotation,uScale:S/Math.min(b,d),uBound:1.6*Math.max(m,v)/S,uState:Math.min(1,Math.max(0,r.stateValue+r.anim.state)),uTheme:a,uColor:r.rgb,...r.field?{uField:[1],uFieldSize:[r.field.width,r.field.height],uFieldRange:r.field.range}:{},...h,...r.uniforms}),ae(e),!E.length)return;let O=g[0];for(let p of E){let _=O===g[0]?g[1]:g[0];this.bind(e,_,0,0,b,d,!0);let U={...this.effectParams[p],...r.effectParams[p],...p==="defocus"&&r.blurPx>=.5?{radius:r.blurPx}:{}};this.pass(e,p,O,U,[b,d],i,a),O=_}this.bind(e,s,M,y,b,d,!1),this.blit(e,O)}},je=null,Ge=1.5,ye=(t,n)=>t?t+(n-t)*.1:n;var qe=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],Xt=["idle","float","spin"],ze=["count","seed","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],Vt=["count","seed","shapes","palette"],Xe=640,D=Math.PI/180,Ve=()=>new Set([...H.values()].map(t=>t.manifest.tag)),le=t=>Math.hypot(t[0],t[1],t[2]),Wt=(t,n)=>[t[0]-n[0],t[1]-n[1],t[2]-n[2]],We=t=>{let n=le(t)||1;return[t[0]/n,t[1]/n,t[2]/n]};function Me(t){return()=>{t=t+1831565813|0;let n=Math.imul(t^t>>>15,1|t);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}var ce=class extends F{constructor(){super();this.yaw=0;this.pitch=0;this.body=new WeakMap;this.rnd=Me(1);this.ready=!1;this.simTime=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary||e.button!==0||this.drag)){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{let r=this.drag;if(!r||e.pointerId!==r.id)return;if(e.buttons===0)return this.onUp(e);let i=Math.max(8,e.timeStamp-r.t),a=(e.clientX-r.x)*.006,o=(e.clientY-r.y)*.006;this.yaw+=a,this.pitch=A(this.pitch+o,-60*D,60*D),this.vel=[a/i,o/i],this.drag={id:r.id,x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=e=>{let r=this.drag;!r||e.pointerId!==r.id&&e.type!=="lostpointercapture"||(this.drag=null,this.classList.remove("sd-dragging"),(X()||e.timeStamp-r.t>80)&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("lostpointercapture",this.onUp)}static get observedAttributes(){return[...F.observedAttributes,...ze]}get bodies(){return[...this.objects].map(e=>this.body.get(e)).filter(e=>!!e)}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=Ve();[...this.children].some(r=>e.has(r.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,r,i){if(!ze.includes(e))return super.attributeChangedCallback(e,r,i);this.ready&&Vt.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof k)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let l of this.kids())l.remove();let e=Ve(),r=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(l=>l.startsWith("sd-")?l:"sd-"+l),i=(r.length?r:[...e]).filter(l=>e.has(l)),a=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??qe,o=i.length?A(Math.round(R(this.getAttribute("count"),24)),0,120):0,s=Me(R(this.getAttribute("seed"),1)),c=l=>l[Math.floor(s()*l.length)],f=()=>{for(;;){let l=[s()*2-1,s()*2-1,s()*2-1];if(le(l)<=1)return l}},u=[];for(let l=0;l<o;l++){let m=8*Math.round((40+100*s())/8),v=m/Xe,S=f(),b=-1/0;for(let d=0;d<8;d++){let M=f(),y=2;for(let w of u)y=Math.min(y,le(Wt(M,w.p))-v-w.r);y>b&&(b=y,S=M)}u.push({tag:c(i),p:S,r:v,size:m,color:c(a),anim:c(Xt),speed:.6+s()*.8,phase:s()*20})}let x=document.createDocumentFragment();for(let l of u){let m=document.createElement(l.tag);m.dataset.pos=l.p.map(v=>v.toFixed(2)).join(" "),m.setAttribute("size",l.size+"px"),m.setAttribute("color",l.color),m.setAttribute("animation",l.anim),m.setAttribute("speed",l.speed.toFixed(2)),m.setAttribute("phase",l.phase.toFixed(1)),x.append(m)}this.append(x),this.adopt()}adopt(){this.rnd=Me(R(this.getAttribute("seed"),1)*7919+17),this.body=new WeakMap}bodyOf(e){let r=this.body.get(e);if(r)return r;let i=this.rnd,a=(e.dataset.pos??"").split(/\s+/).map(Number),o=a.length===3&&a.every(u=>!isNaN(u))?[a[0],a[1],a[2]]:We([i()-.5,i()-.5,i()-.5]).map(u=>u*i()),s=We([i()-.5,i()-.5,i()-.5]).map(u=>u*(.02+i()*.04)),c=[];for(let u=0;u<3;u++)c.push(.05+i()*.1,i()*2*Math.PI,.02+i()*.03);let f=Math.max(R((e.getAttribute("size")??"").replace("px",""),80),1);return r={el:e,p:o,v:s,r:f/Xe,tilt:ie((i()-.5)*70*D,0,(i()-.5)*70*D),wob:c},this.body.set(e,r),r}step(e){let r=this.width,i=this.height;if(!r||!i)return;let a=X(),o=this.cam(),s=Math.max(0,R(this.getAttribute("speed"),1)),c=a?0:A(R(this.getAttribute("drift"),.5),0,1),f=A(R(this.getAttribute("depth"),.5),0,1),u=A(R(this.getAttribute("focus"),0),-1,1),x=1.6/A(R(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),o.has("spin")&&!a&&(this.yaw+=e/1e3*(2*Math.PI/90)*s*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=A(this.pitch+this.vel[1]*e,-60*D,60*D);let h=Math.exp(-e/600);this.vel[0]*=h,this.vel[1]*=h}let l=o.has("pointer")&&this.pointer.inside;this.tilt[0]=Q(this.tilt[0],l?(A(this.pointer.x/r,0,1)*2-1)*12*D:0,e,150),this.tilt[1]=Q(this.tilt[1],l?(A(this.pointer.y/i,0,1)*2-1)*8*D:0,e,150);let m=this.yaw+this.tilt[0],v=this.pitch+this.tilt[1],S=Math.cos(m),b=Math.sin(m),d=Math.cos(v),M=Math.sin(v),y=r/2*.95,w=i/2*.95*(x-.6)/x;a||(this.simTime+=e/1e3);let C=[...this.objects].map(h=>this.bodyOf(h));if(c>0)for(let h of C){for(let E=0;E<3;E++)h.p[E]+=h.v[E]*(e/1e3)*c;let T=le(h.p);if(T>1){let E=(h.p[0]*h.v[0]+h.p[1]*h.v[1]+h.p[2]*h.v[2])/T;if(E>0)for(let g=0;g<3;g++)h.v[g]-=2*E*h.p[g]/T;for(let g=0;g<3;g++)h.p[g]/=T}}this.hasAttribute("collide")&&this.collide(C);for(let h of C){let T=h.el.anim,E=h.wob,g=[h.p[0],h.p[1],h.p[2]];if(c>0)for(let I=0;I<3;I++)g[I]+=Math.sin(2*Math.PI*E[I*3]*this.simTime+E[I*3+1])*E[I*3+2]*c;let O=g[0]*S+g[2]*b,p=-g[0]*b+g[2]*S,_=g[1]*d-p*M,U=g[1]*M+p*d,V=h.el.rect;if(!V)continue;let me=A(x/(x-U),.3,3);T.offset[0]+=r/2-(V.x+V.width/2)+O*me*y,T.offset[1]+=i/2-(V.y+V.height/2)-_*me*w,T.scale*=me,T.z=U,T.rotation=Re(h.tilt,T.rotation),h.el.blurPx=Math.min(24,f*Math.abs(U-u)*14),T.state-=.75*f*Math.max(0,u-U)}}collide(e){for(let r=0;r<4;r++)for(let i=0;i<e.length;i++)for(let a=i+1;a<e.length;a++){let o=e[i],s=e[a],c=s.p[0]-o.p[0],f=s.p[1]-o.p[1],u=s.p[2]-o.p[2],x=o.r+s.r,l=c*c+f*f+u*u;if(l>=x*x)continue;let m=Math.sqrt(l),v=m<1e-6?1:c/m,S=m<1e-6?0:f/m,b=m<1e-6?0:u/m,d=1/(o.r*o.r*o.r),M=1/(s.r*s.r*s.r),y=d+M,w=x-m;o.p[0]-=v*w*(d/y),o.p[1]-=S*w*(d/y),o.p[2]-=b*w*(d/y),s.p[0]+=v*w*(M/y),s.p[1]+=S*w*(M/y),s.p[2]+=b*w*(M/y);let C=(s.v[0]-o.v[0])*v+(s.v[1]-o.v[1])*S+(s.v[2]-o.v[2])*b;if(C>=0)continue;let h=-2*C/y;o.v[0]-=v*h*d,o.v[1]-=S*h*d,o.v[2]-=b*h*d,s.v[0]+=v*h*M,s.v[1]+=S*h*M,s.v[2]+=b*h*M}}};var Ye=Math.PI/180,Qe={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*Ye,Math.sin(t*2*Math.PI/6)*8*Ye,0]})};var $e={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var He={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Ze={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let n=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*n,state:.1*n}}};var Ke={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var qt=[Qe,$e,He,Ze,Ke];for(let t of qt)Z.set(t.meta.name,t);var Je={name:"glass",description:"Tinted glass with a fresnel rim and one highlight. The original look, and the dark default.",params:[]};var et=`// Glassy: tinted body, fresnel rim, one specular, translucent. The dark look of v1; light is pale tinted glass with a darker rim.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
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
vec3 sdEdge() { return uColor; }
`;var tt={name:"matte",description:"A soft opaque surface: half-lambert diffuse, a sky ambient, one broad highlight. Reads well on white.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"softness",type:"float",default:.5,min:0,max:1,step:.01,label:"Terminator softness"}]};var rt=`uniform float light;
uniform float softness;

// Matte: half-lambert diffuse with a firm terminator, a sky ambient from above, one broad soft highlight, opaque.
// Dark: a lifted floor and a faint rim keep the silhouette off black. Light: the edge darkens for definition on white.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float wrap = pow(max(dot(n, l) * 0.5 + 0.5, 0.0), mix(2.4, 1.2, softness));
  float sky = sdView(n).y * 0.5 + 0.5;
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 14.0) * 0.16;
  vec3 col = uColor * (mix(0.3, 0.42, uTheme) + 0.62 * wrap) * (0.9 + 0.1 * sky) + vec3(0.05, 0.06, 0.08) * sky + vec3(spec);
  col *= 1.0 - 0.3 * fres * uTheme;
  col += uColor * fres * rim * 0.35 * (1.0 - uTheme);
  col *= 0.85 + 0.3 * uState;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return uColor * mix(1.0, 0.7, uTheme); }
`;var it={name:"cel",description:"Flat bands of light with a hard highlight and an ink rim. The cartoon look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"bands",type:"float",default:3,min:2,max:5,step:1,label:"Light bands"},{name:"outline",type:"float",default:.8,min:0,max:1,step:.01,label:"Outline (0 removes it)"}]};var st=`uniform float light;
uniform float bands;
uniform float outline;

// Cel: diffuse quantized into bands, a hard highlight dot, and an ink outline (a rim at grazing angles plus the edge on a miss) that \`outline\` fades to nothing.
// Dark: the ink is a lighter tint of the color. Light: the ink is a third of the color.
vec3 inkColor() { return mix(min(uColor * 1.3 + 0.1, vec3(1.0)), uColor * 0.32, uTheme); }
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float diff = max(dot(n, l), 0.0);
  float nb = clamp(floor(bands + 0.5), 2.0, 5.0);
  float band = min(floor(diff * nb), nb - 1.0) / (nb - 1.0);
  float lvl = mix(0.5, 1.0, band);
  float dot_ = step(0.985, max(dot(reflect(-l, n), -rd), 0.0));
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 col = uColor * lvl * (0.95 + 0.25 * uState) + vec3(1.0) * dot_ * 0.5;
  col = mix(col, inkColor(), smoothstep(0.45, 0.6, fres) * outline);
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return mix(uColor, inkColor(), outline); }
`;var nt={name:"clay",description:"A warm putty surface with soft light, a little subsurface glow and darker creases. The clay render look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"warmth",type:"float",default:.5,min:0,max:1,step:.01,label:"Subsurface warmth"}]};var at=`uniform float light;
uniform float warmth;

// Clay: matte with the color pulled toward a warm putty, a warm subsurface term at the back and on thin edges,
// and a two-sample occlusion along the normal that darkens creases.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  float wrap = pow(max(dot(n, l) * 0.5 + 0.5, 0.0), 1.4);
  float back = max(dot(n, -l), 0.0);
  float thin = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
  float ao = 0.5 * clamp(map(p + n * 0.08) / 0.08, 0.0, 1.0) + 0.5 * clamp(map(p + n * 0.2) / 0.2, 0.0, 1.0);
  vec3 base = mix(uColor, vec3(0.9, 0.82, 0.72), 0.25);
  vec3 warm = vec3(1.0, 0.55, 0.35) * warmth;
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 8.0) * 0.08;
  vec3 col = base * (mix(0.28, 0.38, uTheme) + 0.6 * wrap) + warm * (0.12 * back + 0.08 * thin) + vec3(spec);
  col *= 0.6 + 0.4 * ao;
  col *= 0.85 + 0.3 * uState;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return mix(uColor, vec3(0.9, 0.82, 0.72), 0.25); }
`;var ot={name:"metal",description:"A polished metal that reflects a studio gradient with a horizon stripe, tinted by the color.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"roughness",type:"float",default:.25,min:0,max:1,step:.01,label:"Roughness"}]};var lt=`uniform float light;
uniform float roughness;

// Metal: the reflection vector samples a studio environment (a vertical gradient with a horizon stripe) tinted by the color,
// plus a tight highlight and fresnel brightening. The environment is dark in the dark theme and pale in the light one.
vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) {
  vec3 l = sdLightDir(light);
  vec3 r = reflect(rd, n);
  float up = clamp(sdView(r).y * 0.5 + 0.5, 0.0, 1.0);
  vec3 envDark = mix(vec3(0.1, 0.11, 0.14), vec3(0.85, 0.9, 1.0), up);
  vec3 envLight = mix(vec3(0.45, 0.46, 0.5), vec3(1.0), up);
  vec3 env = mix(envDark, envLight, uTheme);
  float stripe = smoothstep(0.3, 0.36, up) * (1.0 - smoothstep(0.5, 0.56, up));
  env += stripe * 0.35 * (1.0 - roughness);
  float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), mix(90.0, 6.0, roughness)) * (1.0 - 0.5 * roughness);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 col = uColor * env * (0.8 + 0.4 * uState) + vec3(spec) + uColor * fres * 0.3;
  return vec4(min(col, vec3(1.0)), 1.0);
}
vec3 sdEdge() { return uColor; }
`;var ir=[{manifest:Je,frag:et},{manifest:tt,frag:rt},{manifest:it,frag:st},{manifest:nt,frag:at},{manifest:ot,frag:lt}];for(let t of ir)L.set(t.manifest.name,t);var ct={};var mt={};var ht={};var ft={};var ut={};var dt={};var pt={};var bt={};var gt={};var vt={};var xt={};var yt={};var Mt={};var Et={};var wt={};var Tt={};var Rt={};var St={};var Pt={};var At={};var Ct={};var Lt={};var kt={};var Dt={};customElements.get("sd-scene")||customElements.define("sd-scene",F);P(ct,mt);P(ht,ft);P(ut,dt);P(pt,bt);P(gt,vt);P(xt,yt);P(Mt,Et);P(wt,Tt);P(Rt,St);P(Pt,At);P(Ct,Lt);P(kt,Dt);customElements.get("sd-universe")||customElements.define("sd-universe",ce);export{qe as PALETTE,k as SdObject,F as SdScene,ce as SdUniverse,P as defineObject,Ne as reflect,Ie as registry};
//# sourceMappingURL=core.js.map
