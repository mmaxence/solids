var wa=Object.defineProperty;var Ma=(t,o)=>{for(var e in o)wa(t,e,{get:o[e],enumerable:!0})};var Ee=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var C=(t,o,e)=>Math.min(e,Math.max(o,t)),F=(t,o,e)=>t+(o-t)*e,A=(t,o,e,a)=>t+(o-t)*(1-Math.exp(-e/Math.max(a,1)));function se(t,o,e,a,r=.08,n=.8){let i=Math.min(a,100)/16;for(;i>1e-9;){let s=Math.min(1,i);i-=s;let f=r*s,m=Math.pow(n,s);t.vx=(t.vx+(o-t.x)*f)*m,t.x+=t.vx*s,t.vy=(t.vy+(e-t.y)*f)*m,t.y+=t.vy*s}}var Ae=new Float32Array([1,0,0,0,1,0,0,0,1]);function O(t,o,e){let a=Math.cos(t),r=Math.sin(t),n=Math.cos(o),i=Math.sin(o),s=Math.cos(e),f=Math.sin(e);return new Float32Array([n*s,n*f,-i,r*i*s-a*f,r*i*f+a*s,r*n,a*i*s+r*f,a*i*f-r*s,a*n])}function N(t,o){let e=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)e[a*3+r]=t[r]*o[a*3]+t[3+r]*o[a*3+1]+t[6+r]*o[a*3+2];return e}var Te=null,X=new Map;function he(t,o="srgb"){if(t=t.trim(),o==="srgb"){let i=t.match(/^#([0-9a-f]{3})$/i);if(i)return[...i[1]].map(s=>parseInt(s+s,16)/255);if(i=t.match(/^#([0-9a-f]{6})$/i),i)return[0,2,4].map(s=>parseInt(i[1].slice(s,s+2),16)/255)}let e=o+t;if(X.has(e))return X.get(e);let a=Te??(Te=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=t;let r=a.fillStyle;a.fillStyle="#fff",a.fillStyle=t;let n=null;if(r===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let i=a.getImageData(0,0,1,1,{colorSpace:o}).data;n=[i[0]/255,i[1]/255,i[2]/255]}return X.size>256&&X.clear(),X.set(e,n),n}var H=null;function Ce(){if(H!==null)return H;try{let t=he("#ff0000","display-p3");H=!!t&&t[1]>.05}catch{H=!1}return H}var Pe=`#version 300 es
precision highp float;
// Core uniforms, set every frame by <sd-scene>.
uniform float uTime;       // seconds
uniform vec2  uResolution; // quad size in device px
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
    if (t > 4.6) break; // every ray has left the r = 1.6 bound (|p| < 0.8 plus the halo's reach) by here; pixel-identical to 7.0
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
bool sdMisses(vec3 ro, vec3 rd) { float b = dot(ro, rd); return b * b - dot(ro, ro) + 2.56 <= 0.0; }
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
`;var Le=`#version 300 es
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
`;var ue=new WeakMap;function Fe(t){let o=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return o?(ge(o),{gl:o,colorSpace:o.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function ge(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=Ce()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.enable(t.SCISSOR_TEST),t.clearColor(0,0,0,0),t.activeTexture(t.TEXTURE0)}function je(t,o,e){let a=t.createShader(o);if(t.shaderSource(a,e),t.compileShader(a),!t.getShaderParameter(a,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(a)||"shader compile failed");return a}function oe(t,o,e="object",a){let r=ue.get(t);r||ue.set(t,r=new Map);let n=r.get(o);n||r.set(o,n=new Map);let i=e[0]+(a?.name??""),s=n.get(i);if(s)return s;let f=(e==="object"?Pe+`
`+(a?.frag??""):Le)+`
`+o,m=t.createProgram();if(t.attachShader(m,je(t,t.VERTEX_SHADER,Ee)),t.attachShader(m,je(t,t.FRAGMENT_SHADER,f)),t.linkProgram(m),!t.getProgramParameter(m,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(m)||"link failed");let h=new Map,u=t.getProgramParameter(m,t.ACTIVE_UNIFORMS);for(let l=0;l<u;l++){let d=t.getActiveUniform(m,l);h.set(d.name,t.getUniformLocation(m,d.name))}let c={prog:m,loc:h};return n.set(i,c),c}function Oe(t){ue.delete(t)}function ie(t,o,e){for(let[a,r]of Object.entries(e)){let n=o.loc.get(a);n!==void 0&&(typeof r=="number"?t.uniform1f(n,r):r.length===1?t.uniform1i(n,r[0]):r.length===2?t.uniform2f(n,r[0],r[1]):r.length===3?t.uniform3f(n,r[0],r[1],r[2]):r.length===4?t.uniform4f(n,r[0],r[1],r[2],r[3]):r.length===9&&t.uniformMatrix3fv(n,!1,r))}}function le(t){t.drawArrays(t.TRIANGLES,0,3)}function q(t,o,e){let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let r=t.createFramebuffer(),n={fb:r,tex:a,w:0,h:0};return Q(t,n,o,e),t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0),n}function Q(t,o,e,a){e=Math.max(1,e),a=Math.max(1,a),!(o.w===e&&o.h===a)&&(t.bindTexture(t.TEXTURE_2D,o.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,a,0,t.RGBA,t.UNSIGNED_BYTE,null),o.w=e,o.h=a)}function G(t,o){t.deleteFramebuffer(o.fb),t.deleteTexture(o.tex)}var Be={};Ma(Be,{LIGHT_SHADE:()=>De,animations:()=>$,clampTo:()=>te,effectAttrs:()=>Z,effectParam:()=>K,effects:()=>z,interactionAttrs:()=>ve,interactionParam:()=>ye,interactionValue:()=>E,interactions:()=>D,kebab:()=>V,num:()=>S,objects:()=>Y,resolveShade:()=>we,shadeAttrs:()=>J,shadeParam:()=>ee,shades:()=>j});var Y=new Map,$=new Map,z=new Map,j=new Map,De="matte",D=new Map,Ue=()=>[...z.values()].map(t=>t.manifest),Ie=()=>[...D.values()].map(t=>t.meta),_e=()=>[...j.values()].map(t=>t.manifest),be=t=>t.flatMap(o=>o.params.map(e=>`${o.name}-${V(e.name)}`)),Z=()=>be(Ue()),ve=()=>be(Ie()),J=()=>be(_e()),V=t=>t.replace(/[A-Z]/g,o=>"-"+o.toLowerCase());function xe(t,o,e,a){var r;for(let n of t){let i=n.name+"-";if(!o.startsWith(i))continue;let s=n.params.find(m=>V(m.name)===o.slice(i.length));if(!s)continue;let f=e==null||e===""?NaN:Number(e);return Number.isFinite(f)?(a[r=n.name]??(a[r]={}))[s.name]=te(f,s):delete a[n.name]?.[s.name],!0}return!1}var K=(t,o,e)=>xe(Ue(),t,o,e),ye=(t,o,e)=>xe(Ie(),t,o,e),ee=(t,o,e)=>xe(_e(),t,o,e),ze=new Set;function we(t,o){t&&t!=="auto"&&!j.has(t)&&!ze.has(t)&&(ze.add(t),console.warn(`[solids] unknown shading "${t}", using auto`));let e=j.has(t)?t:o?De:"glass";return j.has(e)?e:"glass"}var E=(t,o,e)=>t.interactionParams[o]?.[e]??D.get(o).meta.params.find(a=>a.name===e).default,S=(t,o)=>{if(t==null||t==="")return o;let e=Number(t);return Number.isFinite(e)?e:o},te=(t,o)=>Math.min(o.max??t,Math.max(o.min??t,t));var Ea=new Map([["off",0],["idle",.25],["busy",.6],["active",1]]),Ta=["animation","speed","effect","shading","state","color","size","phase","theme","gravity","gravity-gap"],ce=t=>t.replace(/-([a-z])/g,(o,e)=>e.toUpperCase()),U=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.shadeName="auto";this.shadeParams={};this.anim={rotation:new Float32Array(Ae),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.pinned=!1;this.blurPx=0;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=te(S(String(a.default),0),a)}static get observedAttributes(){return[...Ta,...this.manifest.uniforms.map(e=>V(e.name)),...Z(),...J()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),a=this.shadowRoot.querySelector("sd-scene");if(e)a&&(a.detach(this),a.remove()),e.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.hasAttribute("theme")&&r.setAttribute("theme",this.getAttribute("theme")),this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,a,r){let n=r??"";switch(e){case"animation":this.animNames=n.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=n.split(/\s+/).filter(Boolean);return;case"shading":this.shadeName=n.trim()||"auto";return;case"speed":this.speedValue=S(n,1);return;case"state":this.stateTarget=Ea.get(n)??.25;return;case"theme":this.shadowRoot.querySelector("sd-scene")?.setAttribute("theme",n);return;case"color":this.recolor(n||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=n?`:host{width:${n}}`:"";return;case"phase":this.phaseOffset=S(n,0);return;case"gravity":case"gravity-gap":return}if(K(e,r,this.effectParams)||ee(e,r,this.shadeParams))return;let i=this.manifest.uniforms.find(s=>V(s.name)===e);i&&(this.uniforms[i.name]=te(S(r,i.default),i))}recolor(e=this.colorSrc){let a=e?he(e,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=e)}drawCenter(){let e=this.rect;return[e.x+e.width/2+this.anim.offset[0],e.y+e.height/2+this.anim.offset[1]]}drawRadius(){return this.rect.width/2*this.anim.scale}update(e){this.stateValue=A(this.stateValue,this.stateTarget,e,150),this.pinned=!1,this.blurPx=0;let a=L();a||(this.clock+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let i of this.animNames){let s=$.get(i)?.fn(a?0:this.clock+this.phaseOffset,this.speedValue,this);if(s){if(s.rotation)for(let f=0;f<3;f++)r.rotation[f]+=s.rotation[f];s.offset&&(r.offset[0]+=s.offset[0],r.offset[1]+=s.offset[1]),s.scale!==void 0&&(r.scale*=s.scale),s.state!==void 0&&(r.state+=s.state)}}let n=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let i=this.blend*this.blend*(3-2*this.blend),s=this.prevPose;n={rotation:[0,1,2].map(f=>Aa(s.rotation[f],r.rotation[f],i)),offset:[F(s.offset[0],r.offset[0],i),F(s.offset[1],r.offset[1],i)],scale:F(s.scale,r.scale,i),state:F(s.state,r.state,i)}}this.pose=n,this.anim.rotation=O(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=0}};function Aa(t,o,e){let a=((o-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+a*e}var Me=null;function L(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(Me??(Me=matchMedia("(prefers-reduced-motion: reduce)")),Me.matches)}function Ne(t,o){for(let e of o)if(!Object.getOwnPropertyDescriptor(t,ce(e))){if(ce(e)in t){console.warn(`[solids] attribute "${e}" is not reflected: it would shadow the ${ce(e)} member`);continue}Object.defineProperty(t,ce(e),{get(){return this.getAttribute(e)},set(a){a==null?this.removeAttribute(e):this.setAttribute(e,String(a))}})}}function T(t,o){var a;if(!t?.tag||customElements.get(t.tag))return;Y.set(t.name,{manifest:t,frag:o});let e=(a=class extends U{},a.manifest=t,a.frag=o,a);Ne(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var qe=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var _=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1};this.interactionNames=[];this.effectNames=[];this.shadeName="auto";this.shadeParams={};this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.visible=!1;this.paused=!1;this.dirty=!1;this.frames=0;this.failed=new Set;this.maxTex=8192;this.lose=null;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let a=this.getBoundingClientRect();this.pointer={x:e.clientX-a.left,y:e.clientY-a.top,inside:!0}};this.onLeave=()=>{this.pointer.inside=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.last&&(this.fps=Se(this.fps,1e3/Math.max(e-this.last,1)));let a=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame(this.clock+a/1e3,a),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","shading","theme","paused","dpr",...Z(),...ve(),...J()]}get time(){return this.clock}connectedCallback(){if(this.gl)this.gl.isContextLost()&&this.lose?.restoreContext();else{let a=Fe(this.canvas);if(this.gl=a?.gl??null,this.colorSpace=a?.colorSpace??"srgb",this.gl)this.maxTex=Math.min(8192,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)),this.lose=this.gl.getExtension("WEBGL_lose_context");else{this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop(),this.dataset.fallback="",this.isConnected&&this.lose?.restoreContext()}),this.canvas.addEventListener("webglcontextrestored",()=>{Oe(this.gl),this.fbos=null,this.query=null,this.failed.clear(),ge(this.gl);for(let r of this.objects)r.broken=!1;delete this.dataset.fallback,this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this);let e=this.getBoundingClientRect();this.visible=e.bottom>0&&e.right>0&&e.top<innerHeight&&e.left<innerWidth,this.io=new IntersectionObserver(a=>{this.visible=a[a.length-1].isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),document.addEventListener("visibilitychange",this.onVis);for(let a of this.querySelectorAll("*"))a instanceof U&&a.closest("sd-scene, sd-universe")===this&&this.attach(a);for(let a of this.objects)this.ro.observe(a);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis),queueMicrotask(()=>{!this.isConnected&&this.gl&&!this.gl.isContextLost()&&this.lose?.loseContext()})}attributeChangedCallback(e,a,r){let n=r??"";if(e==="interaction")this.interactionNames=n.split(/\s+/).filter(Boolean),this.interactionNames.forEach(i=>D.get(i)?.setup?.(this));else if(e==="effect")this.effectNames=n.split(/\s+/).filter(Boolean);else if(e==="shading")this.shadeName=n.trim()||"auto";else if(e==="theme")this.theme=n||"auto";else if(e==="dpr"){let i=Number(n);this.maxDpr=n&&!isNaN(i)&&i>0?i:2,this.measure()}else e==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):!K(e,r,this.effectParams)&&!ee(e,r,this.shadeParams)&&ye(e,r,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.dirty=!0)}settle(){this.dirty=!1,this.objects=new Set([...this.objects].sort((e,a)=>e.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.measure()}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e),this.dirty=!0}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||(Ge??(Ge=matchMedia("(prefers-color-scheme: light)"))).matches?1:0}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let a=Math.round(e.width*this.pixelRatio),r=Math.round(e.height*this.pixelRatio);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let n of this.objects){let i=n.getBoundingClientRect();n.rect=new DOMRect(i.left-e.left,i.top-e.top,i.width,i.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,a){let r=this.gl;this.dirty&&this.settle();let n=this.canvas.width,i=this.canvas.height;if(!r||r.isContextLost()||n===0||i===0)return;let s=performance.now(),f=this.gpuOn?this.gpuBegin(r):null;try{this.render(r,n,i,e,a)}finally{f&&r.endQuery(f.TIME_ELAPSED_EXT),this.frames++>0&&(this.frameTime=Se(this.frameTime,performance.now()-s))}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let a=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!a)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let r=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(a.GPU_DISJOINT_EXT)&&Number.isFinite(r)&&(this.gpuMs=Se(this.gpuMs??0,r/1e6))}return e.beginQuery(a.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),a}render(e,a,r,n,i){L()||(this.clock=n),n=this.clock;for(let c of this.objects)c.update(i);this.step(i);for(let c of this.interactionNames)D.get(c)?.frame(this,i,this.pointer);let s=this.fbos??(this.fbos={scene:null,a:null,b:null,pool:new Map,used:new Set}),f=this.themeValue,m=this.effectNames.filter(c=>z.has(c));m.length?(s.scene??(s.scene=q(e,a,r)),s.a??(s.a=q(e,a,r)),s.b??(s.b=q(e,a,r)),Q(e,s.scene,a,r),Q(e,s.a,a,r),Q(e,s.b,a,r)):s.scene&&(G(e,s.scene),G(e,s.a),G(e,s.b),s.scene=s.a=s.b=null);let h=m.length?s.scene:null;this.bind(e,h,0,0,a,r,!0);let u=[...this.objects].filter(c=>c.rect&&!c.broken).sort((c,l)=>(c.anim.z||0)-(l.anim.z||0));for(let c of u)this.draw(e,c,n,f,s,h);if(m.length){let c=s.scene;for(let l of m){let d=c===s.a?s.b:s.a;this.bind(e,d,0,0,a,r,!0),this.pass(e,l,c,this.effectParams[l],[a,r],n,f),c=d}this.bind(e,null,0,0,a,r,!0),this.blit(e,c)}for(let[c,l]of s.pool)s.used.has(c)?l[2]=0:++l[2]>60&&(G(e,l[0]),G(e,l[1]),s.pool.delete(c));s.used.clear()}step(e){}bind(e,a,r,n,i,s,f){e.bindFramebuffer(e.FRAMEBUFFER,a?.fb??null),e.viewport(r,n,i,s),e.scissor(r,n,i,s),f&&e.clear(e.COLOR_BUFFER_BIT)}blit(e,a){let r=oe(e,qe,"effect");e.useProgram(r.prog),e.bindTexture(e.TEXTURE_2D,a.tex),ie(e,r,{uScene:[0]}),le(e)}pass(e,a,r,n,i,s,f){let m=z.get(a);if(this.failed.has(a))return this.blit(e,r);let h;try{h=oe(e,m.frag,"effect")}catch(c){this.failed.add(a),console.error(`[solids] effect "${a}" shader failed:
${c.message}`),this.blit(e,r);return}e.useProgram(h.prog),e.bindTexture(e.TEXTURE_2D,r.tex);let u={};for(let c of m.manifest.params)u[c.name]=c.default;ie(e,h,{uScene:[0],uResolution:i,uTime:s,uTheme:f,uMix:n?.mix??1,...u,...n}),le(e)}draw(e,a,r,n,i,s,f=this.canvas.width,m=this.canvas.height){let h=a.rect,[u,c]=a.drawCenter(),l=h.width*a.anim.scale*this.pixelRatio,d=Math.ceil(l*Pa/8)*8,v=d;if(!(l>0)||d>this.maxTex)return;let p=Math.round(u*this.pixelRatio-d/2),x=Math.round((this.height-c)*this.pixelRatio-v/2);if(p>=f||x>=m||p+d<=0||x+v<=0)return;let w=we(a.hasAttribute("shading")?a.shadeName:this.shadeName,n),y=j.get(w),k={};for(let b of y.manifest.params)k[b.name]=a.shadeParams[w]?.[b.name]??this.shadeParams[w]?.[b.name]??b.default;let P;try{P=oe(e,a.frag,"object",{name:w,frag:y.frag})}catch(b){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${b.message}`);return}let g=a.effectNames.filter(b=>z.has(b));a.blurPx>=.5&&!g.includes("defocus")&&g.push("defocus");let M;if(g.length){let b=d+"x"+v;M=i.pool.get(b),M||i.pool.set(b,M=[q(e,d,v),q(e,d,v),0]),i.used.add(b),this.bind(e,M[0],0,0,d,v,!0)}else this.bind(e,s,p,x,d,v,!1);if(e.useProgram(P.prog),ie(e,P,{uTime:r,uResolution:[d,v],uRotation:a.anim.rotation,uScale:l/d,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:n,uColor:a.rgb,...k,...a.uniforms}),le(e),!g.length)return;let R=M[0];for(let b of g){let ae=R===M[0]?M[1]:M[0];this.bind(e,ae,0,0,d,v,!0);let re={...this.effectParams[b],...a.effectParams[b],...b==="defocus"&&a.blurPx>=.5?{radius:a.blurPx}:{}};this.pass(e,b,R,re,[d,v],r,n),R=ae}this.bind(e,s,p,x,d,v,!1),this.blit(e,R)}},Ge=null,Pa=1.5,Se=(t,o)=>t?t+(o-t)*.1:o;var Qe=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],La=["idle","float","spin"],Ve=["count","seed","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],ja=["count","seed","shapes","palette"],We=640,I=Math.PI/180,Xe=()=>new Set([...Y.values()].map(t=>t.manifest.tag)),me=t=>Math.hypot(t[0],t[1],t[2]),Fa=(t,o)=>[t[0]-o[0],t[1]-o[1],t[2]-o[2]],He=t=>{let o=me(t)||1;return[t[0]/o,t[1]/o,t[2]/o]};function ke(t){return()=>{t=t+1831565813|0;let o=Math.imul(t^t>>>15,1|t);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}var fe=class extends _{constructor(){super();this.yaw=0;this.pitch=0;this.body=new WeakMap;this.rnd=ke(1);this.ready=!1;this.simTime=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary||e.button!==0||this.drag)){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{let a=this.drag;if(!a||e.pointerId!==a.id)return;if(e.buttons===0)return this.onUp(e);let r=Math.max(8,e.timeStamp-a.t),n=(e.clientX-a.x)*.006,i=(e.clientY-a.y)*.006;this.yaw+=n,this.pitch=C(this.pitch+i,-60*I,60*I),this.vel=[n/r,i/r],this.drag={id:a.id,x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=e=>{let a=this.drag;!a||e.pointerId!==a.id&&e.type!=="lostpointercapture"||(this.drag=null,this.classList.remove("sd-dragging"),(L()||e.timeStamp-a.t>80)&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("lostpointercapture",this.onUp)}static get observedAttributes(){return[..._.observedAttributes,...Ve]}get bodies(){return[...this.objects].map(e=>this.body.get(e)).filter(e=>!!e)}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=Xe();[...this.children].some(a=>e.has(a.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,a,r){if(!Ve.includes(e))return super.attributeChangedCallback(e,a,r);this.ready&&ja.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof U)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let c of this.kids())c.remove();let e=Xe(),a=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(c=>c.startsWith("sd-")?c:"sd-"+c),r=(a.length?a:[...e]).filter(c=>e.has(c)),n=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??Qe,i=r.length?C(Math.round(S(this.getAttribute("count"),24)),0,120):0,s=ke(S(this.getAttribute("seed"),1)),f=c=>c[Math.floor(s()*c.length)],m=()=>{for(;;){let c=[s()*2-1,s()*2-1,s()*2-1];if(me(c)<=1)return c}},h=[];for(let c=0;c<i;c++){let l=8*Math.round((40+100*s())/8),d=l/We,v=m(),p=-1/0;for(let x=0;x<8;x++){let w=m(),y=2;for(let k of h)y=Math.min(y,me(Fa(w,k.p))-d-k.r);y>p&&(p=y,v=w)}h.push({tag:f(r),p:v,r:d,size:l,color:f(n),anim:f(La),speed:.6+s()*.8,phase:s()*20})}let u=document.createDocumentFragment();for(let c of h){let l=document.createElement(c.tag);l.dataset.pos=c.p.map(d=>d.toFixed(2)).join(" "),l.setAttribute("size",c.size+"px"),l.setAttribute("color",c.color),l.setAttribute("animation",c.anim),l.setAttribute("speed",c.speed.toFixed(2)),l.setAttribute("phase",c.phase.toFixed(1)),u.append(l)}this.append(u),this.adopt()}adopt(){this.rnd=ke(S(this.getAttribute("seed"),1)*7919+17),this.body=new WeakMap}bodyOf(e){let a=this.body.get(e);if(a)return a;let r=this.rnd,n=(e.dataset.pos??"").split(/\s+/).map(Number),i=n.length===3&&n.every(h=>!isNaN(h))?[n[0],n[1],n[2]]:He([r()-.5,r()-.5,r()-.5]).map(h=>h*r()),s=He([r()-.5,r()-.5,r()-.5]).map(h=>h*(.02+r()*.04)),f=[];for(let h=0;h<3;h++)f.push(.05+r()*.1,r()*2*Math.PI,.02+r()*.03);let m=Math.max(S((e.getAttribute("size")??"").replace("px",""),80),1);return a={el:e,p:i,v:s,r:m/We,tilt:O((r()-.5)*70*I,0,(r()-.5)*70*I),wob:f},this.body.set(e,a),a}step(e){let a=this.width,r=this.height;if(!a||!r)return;let n=L(),i=this.cam(),s=Math.max(0,S(this.getAttribute("speed"),1)),f=n?0:C(S(this.getAttribute("drift"),.5),0,1),m=C(S(this.getAttribute("depth"),.5),0,1),h=C(S(this.getAttribute("focus"),0),-1,1),u=1.6/C(S(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),i.has("spin")&&!n&&(this.yaw+=e/1e3*(2*Math.PI/90)*s*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=C(this.pitch+this.vel[1]*e,-60*I,60*I);let g=Math.exp(-e/600);this.vel[0]*=g,this.vel[1]*=g}let c=i.has("pointer")&&this.pointer.inside;this.tilt[0]=A(this.tilt[0],c?(C(this.pointer.x/a,0,1)*2-1)*12*I:0,e,150),this.tilt[1]=A(this.tilt[1],c?(C(this.pointer.y/r,0,1)*2-1)*8*I:0,e,150);let l=this.yaw+this.tilt[0],d=this.pitch+this.tilt[1],v=Math.cos(l),p=Math.sin(l),x=Math.cos(d),w=Math.sin(d),y=a/2*.95,k=r/2*.95*(u-.6)/u;n||(this.simTime+=e/1e3);let P=[...this.objects].map(g=>this.bodyOf(g));if(f>0)for(let g of P){for(let R=0;R<3;R++)g.p[R]+=g.v[R]*(e/1e3)*f;let M=me(g.p);if(M>1){let R=(g.p[0]*g.v[0]+g.p[1]*g.v[1]+g.p[2]*g.v[2])/M;if(R>0)for(let b=0;b<3;b++)g.v[b]-=2*R*g.p[b]/M;for(let b=0;b<3;b++)g.p[b]/=M}}this.hasAttribute("collide")&&this.collide(P);for(let g of P){let M=g.el.anim,R=g.wob,b=[g.p[0],g.p[1],g.p[2]];if(f>0)for(let B=0;B<3;B++)b[B]+=Math.sin(2*Math.PI*R[B*3]*this.simTime+R[B*3+1])*R[B*3+2]*f;let ae=b[0]*v+b[2]*p,re=-b[0]*p+b[2]*v,ya=b[1]*x-re*w,ne=b[1]*w+re*x,W=g.el.rect;if(!W)continue;let de=C(u/(u-ne),.3,3);M.offset[0]+=a/2-(W.x+W.width/2)+ae*de*y,M.offset[1]+=r/2-(W.y+W.height/2)-ya*de*k,M.scale*=de,M.z=ne,M.rotation=N(g.tilt,M.rotation),g.el.blurPx=Math.min(24,m*Math.abs(ne-h)*14),M.state-=.75*m*Math.max(0,h-ne)}}collide(e){for(let a=0;a<4;a++)for(let r=0;r<e.length;r++)for(let n=r+1;n<e.length;n++){let i=e[r],s=e[n],f=s.p[0]-i.p[0],m=s.p[1]-i.p[1],h=s.p[2]-i.p[2],u=i.r+s.r,c=f*f+m*m+h*h;if(c>=u*u)continue;let l=Math.sqrt(c),d=l<1e-6?1:f/l,v=l<1e-6?0:m/l,p=l<1e-6?0:h/l,x=1/(i.r*i.r*i.r),w=1/(s.r*s.r*s.r),y=x+w,k=u-l;i.p[0]-=d*k*(x/y),i.p[1]-=v*k*(x/y),i.p[2]-=p*k*(x/y),s.p[0]+=d*k*(w/y),s.p[1]+=v*k*(w/y),s.p[2]+=p*k*(w/y);let P=(s.v[0]-i.v[0])*d+(s.v[1]-i.v[1])*v+(s.v[2]-i.v[2])*p;if(P>=0)continue;let g=-2*P/y;i.v[0]-=d*g*x,i.v[1]-=v*g*x,i.v[2]-=p*g*x,s.v[0]+=d*g*w,s.v[1]+=v*g*w,s.v[2]+=p*g*w}}};var Ye=Math.PI/180,$e={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*Ye,Math.sin(t*2*Math.PI/6)*8*Ye,0]})};var Ze={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var Je={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var Ke={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let o=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*o,state:.1*o}}};var et={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Oa=[$e,Ze,Je,Ke,et];for(let t of Oa)$.set(t.meta.name,t);var tt={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var at=`uniform float threshold;
uniform float radius;
uniform float strength;

vec4 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return c * smoothstep(threshold, threshold + 0.3, sdLuma(c.rgb));
}

vec4 sdEffect() {
  vec4 base = texture(uScene, vUv);
  vec2 px = radius / uResolution;
  // Four rings of 8 taps, each ring rotated by a per-pixel jitter so the rings never show. One cos and sin per ring; the
  // eight taps turn by 45 degrees with a constant rotation.
  float j = sdBayer(gl_FragCoord.xy) * 0.7853982;
  const mat2 TURN = mat2(0.7071068, 0.7071068, -0.7071068, 0.7071068);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int r = 1; r <= 4; r++) {
    float fr = float(r) / 4.0;
    float w = 1.0 - fr * 0.75;
    float a0 = j + float(r) * 0.3;
    vec2 d = vec2(cos(a0), sin(a0));
    for (int i = 0; i < 8; i++) {
      acc += bright(vUv + d * px * fr) * w;
      wsum += w;
      d = TURN * d;
    }
  }
  return base + acc / wsum * strength * 1.6;
}
`;var rt={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var nt=`uniform float angle;
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
`;var st={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ot=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var it={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var lt=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var ct={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var mt=`uniform float levels;
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
`;var ft={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var pt=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var dt={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var ht=`uniform float size;
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
`;var ut={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var gt=`uniform float width;
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
`;var bt={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var vt=`uniform float amount;
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
`;var xt={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var yt=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var wt={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var Mt=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var St={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var kt=`uniform float amplitude;
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
`;var Rt={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var Et=`uniform float radius;

// Taps on a golden-angle disc (uniform area): 32 from 6 px up, 16 below (grain only shows from about 8 px). Two decorrelated
// Bayer values per pixel rotate the spiral and stratify its radii, so the sparse kernel reads as fine grain instead of rings
// or copies. One cos and sin per pixel; each tap turns the direction by the golden angle with a constant rotation.
// Averaging premultiplied color keeps it valid.
const mat2 GOLD = mat2(-0.7373689, 0.6754903, -0.6754903, -0.7373689);
vec4 sdEffect() {
  if (radius < 0.5) return texture(uScene, vUv);
  vec2 px = radius / uResolution;
  float j = sdBayer(gl_FragCoord.xy) * 6.2831853;
  float k = sdBayer(gl_FragCoord.yx + vec2(1.0, 2.0));
  int n = radius < 6.0 ? 16 : 32;
  float fn = float(n);
  vec2 d = vec2(cos(j), sin(j));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    acc += texture(uScene, vUv + d * sqrt((float(i) + k) / fn) * px);
    d = GOLD * d;
  }
  return acc / fn;
}
`;var ir=[{manifest:tt,frag:at},{manifest:rt,frag:nt},{manifest:st,frag:ot},{manifest:it,frag:lt},{manifest:ct,frag:mt},{manifest:ft,frag:pt},{manifest:dt,frag:ht},{manifest:ut,frag:gt},{manifest:bt,frag:vt},{manifest:xt,frag:yt},{manifest:wt,frag:Mt},{manifest:St,frag:kt},{manifest:Rt,frag:Et}],lr={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of ir)t.manifest.params.some(o=>o.name==="mix")||t.manifest.params.push(lr),z.set(t.manifest.name,t);var Tt={name:"glass",description:"Tinted glass with a fresnel rim and one highlight. The original look, and the dark default.",params:[]};var At=`// Glassy: tinted body, fresnel rim, one specular, translucent. The dark look of v1; light is pale tinted glass with a darker rim.
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
`;var Ct={name:"matte",description:"A soft opaque surface: half-lambert diffuse, a sky ambient, one broad highlight. Reads well on white.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"softness",type:"float",default:.5,min:0,max:1,step:.01,label:"Terminator softness"}]};var Pt=`uniform float light;
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
`;var Lt={name:"cel",description:"Flat bands of light with a hard highlight and an ink rim. The cartoon look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"bands",type:"float",default:3,min:2,max:5,step:1,label:"Light bands"},{name:"outline",type:"float",default:.8,min:0,max:1,step:.01,label:"Outline (0 removes it)"}]};var jt=`uniform float light;
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
`;var Ft={name:"clay",description:"A warm putty surface with soft light, a little subsurface glow and darker creases. The clay render look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"warmth",type:"float",default:.5,min:0,max:1,step:.01,label:"Subsurface warmth"}]};var Ot=`uniform float light;
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
`;var zt={name:"metal",description:"A polished metal that reflects a studio gradient with a horizon stripe, tinted by the color.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"roughness",type:"float",default:.25,min:0,max:1,step:.01,label:"Roughness"}]};var Dt=`uniform float light;
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
`;var xr=[{manifest:Tt,frag:At},{manifest:Ct,frag:Pt},{manifest:Lt,frag:jt},{manifest:Ft,frag:Ot},{manifest:zt,frag:Dt}];for(let t of xr)j.set(t.manifest.name,t);var Ut=new WeakMap,It=20*Math.PI/180,_t={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,o,e){for(let a of t.objects){if(!a.rect)continue;let r=Ut.get(a)??Ut.set(a,{x:0,y:0,vx:0,vy:0}).get(a),n=0,i=0;if(e.inside){let[s,f]=a.drawCenter(),m=(e.x-s)/Math.max(t.width,1),h=(e.y-f)/Math.max(t.height,1);i=Math.max(-1,Math.min(1,m*2))*It,n=Math.max(-1,Math.min(1,h*2))*It}se(r,n,i,o),a.anim.rotation=N(O(r.x,r.y,0),a.anim.rotation)}}};var Bt=new WeakMap,Nt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,o,e){for(let a of t.objects){if(!a.rect)continue;let[r,n]=a.drawCenter(),i=a.drawRadius(),s=e.inside&&Math.abs(e.x-r)<=i&&Math.abs(e.y-n)<=i,f=A(Bt.get(a)??0,s?1:0,o,160);Bt.set(a,f),a.anim.scale*=1+.08*f,a.anim.state+=f*(1-a.stateValue)}}};var pe=new WeakMap,Re=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],yr=t=>t*t*(3-2*t),qt={meta:{name:"gravity",description:"One object is the center. The others orbit it on rings, farther rings turning slower like real orbits, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Clearance from the center in px (an object's gravity-gap overrides)"}]},setup(t){for(let o of t.objects){let e=pe.get(o);e&&t.time-e.at>.2&&pe.delete(o)}},frame(t,o){let e=[...t.objects].filter(l=>l.rect),a=e.find(l=>l.getAttribute("gravity")==="center")??null,r=E(t,"gravity","strength"),n=E(t,"gravity","gap"),i=a?Re(a):null,s=L(),f=l=>{let d=l.getAttribute("gravity");return!i||l===a||d==="none"?"none":d==="fall"?"fall":"orbit"},m=e.filter(l=>f(l)==="orbit").map(l=>{let d=Re(l);return{o:l,d:Math.hypot(d[0]-i[0],d[1]-i[1])}}).sort((l,d)=>l.d-d.d),h=m.length?Math.max(m[0].d,(a.rect.width+m[0].o.rect.width)/4+n):0,u=m.length?Math.max(m[m.length-1].d,h):0,c=l=>{let d=m.findIndex(p=>p.o===l),v=m.length;return v>1?h+(u-h)*d/(v-1):h};a&&(a.pinned=!0);for(let l of e){let d=f(l),v=d!=="none",p=pe.get(l);if(!p&&!v)continue;p||pe.set(l,p={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1,at:0}),p.at=t.time,d==="orbit"&&(l.pinned=!0);let x=[0,0],w=0;if(v){let y=Re(l);if(p.center!==a&&(p.from=[p.offset[0],p.offset[1]],p.k=0,p.center=a,p.angle=Math.atan2(y[1]-i[1],y[0]-i[0]),p.r=Math.hypot(y[0]-i[0],y[1]-i[1])),d==="fall"){let k=S(l.getAttribute("gravity-gap"),n)+(a.rect.width+l.rect.width)/4;s||(p.r+=(k-p.r)*(1-Math.exp(-o/700))*(.3+r))}else p.r=s||p.k===0?c(l):A(p.r,c(l),o,300),s||(p.angle+=o/1e3*.3*r*Math.pow(u/p.r,1.5)),w=Math.sin(p.angle)*(p.r/u);x=[i[0]+Math.cos(p.angle)*p.r-y[0],i[1]+Math.sin(p.angle)*p.r-y[1]]}else p.center&&(p.from=[p.offset[0],p.offset[1]],p.k=0,p.center=null);if(p.k<1){p.k=s?1:Math.min(1,p.k+o/800);let y=yr(p.k);x=[F(p.from[0],x[0],y),F(p.from[1],x[1],y)]}p.offset=x,l.anim.offset[0]+=x[0],l.anim.offset[1]+=x[1],l.anim.z+=w,l.anim.scale*=1+.06*w}}};var Gt=new WeakMap,Vt={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,o,e){let a=E(t,"repel","radius"),r=E(t,"repel","strength");for(let n of t.objects){if(!n.rect)continue;let i=Gt.get(n)??Gt.set(n,{x:0,y:0,vx:0,vy:0}).get(n),s=0,f=0;if(e.inside){let[m,h]=n.drawCenter(),u=m-e.x,c=h-e.y,l=Math.hypot(u,c);if(l<a){let d=(1-l/a)*a*.5*r;s=l>.001?u/l*d:0,f=l>.001?c/l*d:-d}}se(i,s,f,o),n.anim.offset[0]+=i.x,n.anim.offset[1]+=i.y}}};var Wt=new WeakMap,Xt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,o,e){let a=E(t,"magnet","reach"),r=E(t,"magnet","strength");for(let n of t.objects){if(!n.rect)continue;let i=Wt.get(n)??[0,0],s=0,f=0;if(e.inside){let[h,u]=n.drawCenter();s=(e.x-h)*r,f=(e.y-u)*r;let c=Math.hypot(s,f);c>a&&(s*=a/c,f*=a/c)}let m=[A(i[0],s,o,250),A(i[1],f,o,250)];Wt.set(n,m),n.anim.offset[0]+=m[0],n.anim.offset[1]+=m[1]}}};var Ht=new WeakMap,Qt={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart; a gravity center and its orbiters hold still. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,o){let e=E(t,"collide","gap"),a=[...t.objects].filter(m=>m.rect),r=a.map(m=>m.drawCenter()),n=r.map(m=>[...m]),i=a.map(m=>m.pinned?0:1),s=a.map(m=>m.drawRadius());for(let m=0;m<4;m++)for(let h=0;h<a.length;h++)for(let u=h+1;u<a.length;u++){let c=n[u][0]-n[h][0],l=n[u][1]-n[h][1],d=Math.hypot(c,l),v=s[h]+s[u]+e,p=i[h]+i[u];if(d>=v||!p)continue;d<.001?(c=1,l=0):(c/=d,l/=d);let x=(v-d)*i[h]/p,w=(v-d)*i[u]/p;n[h][0]-=c*x,n[h][1]-=l*x,n[u][0]+=c*w,n[u][1]+=l*w}let f=L()?1:1-Math.exp(-o/120);a.forEach((m,h)=>{let u=Ht.get(m)??[0,0],c=[u[0]+(n[h][0]-r[h][0]-u[0])*f,u[1]+(n[h][1]-r[h][1]-u[1])*f];Ht.set(m,c),m.anim.offset[0]+=c[0],m.anim.offset[1]+=c[1]})}};var Yt={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let o=t.getBoundingClientRect(),e=innerHeight,a=Math.min(1,Math.max(0,(e-o.top)/Math.max(e+o.height,1))),r=O(0,(a-.5)*E(t,"scroll","turns")*2*Math.PI,0);for(let n of t.objects)n.anim.rotation=N(r,n.anim.rotation)}};var wr=[_t,Nt,qt,Vt,Xt,Qt,Yt];for(let t of wr)D.set(t.meta.name,t);var $t={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}]};var Zt=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var Jt={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}]};var Kt=`uniform float thickness;
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
`;var ea={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}]};var ta=`uniform float facets;
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
`;var aa={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}]};var ra=`uniform float turns;
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
`;var na={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}]};var sa=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var oa={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}]};var ia=`uniform float radius;
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
`;var la={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}]};var ca=`uniform float twist;
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
`;var ma={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}]};var fa=`uniform float sides;
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
`;var pa={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}]};var da=`uniform float span;
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
`;var ha={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}]};var ua=`uniform float points;
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
`;var ga={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}]};var ba=`uniform float turns;
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
`;var va={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}]};var xa=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",_);T($t,Zt);T(Jt,Kt);T(ea,ta);T(aa,ra);T(na,sa);T(oa,ia);T(la,ca);T(ma,fa);T(pa,da);T(ha,ua);T(ga,ba);T(va,xa);customElements.get("sd-universe")||customElements.define("sd-universe",fe);export{Qe as PALETTE,U as SdObject,_ as SdScene,fe as SdUniverse,T as defineObject,Ne as reflect,Be as registry};
//# sourceMappingURL=solids.js.map
