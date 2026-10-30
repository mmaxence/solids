var za=Object.defineProperty;var Oa=(t,o)=>{for(var e in o)za(t,e,{get:o[e],enumerable:!0})};var Pe=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;var P=(t,o,e)=>Math.min(e,Math.max(o,t)),D=(t,o,e)=>t+(o-t)*e,F=(t,o,e,a)=>t+(o-t)*(1-Math.exp(-e/Math.max(a,1)));function U(t,o,e,a,r=.08,n=.8){let s=Math.min(a,100)/16;for(;s>1e-9;){let i=Math.min(1,s);s-=i;let c=r*i,l=Math.pow(n,i);t.vx=(t.vx+(o-t.x)*c)*l,t.x+=t.vx*i,t.vy=(t.vy+(e-t.y)*c)*l,t.y+=t.vy*i}}var je=new Float32Array([1,0,0,0,1,0,0,0,1]);function L(t,o,e){let a=Math.cos(t),r=Math.sin(t),n=Math.cos(o),s=Math.sin(o),i=Math.cos(e),c=Math.sin(e);return new Float32Array([n*i,n*c,-s,r*s*i-a*c,r*s*c+a*i,r*n,a*s*i+r*c,a*s*c-r*i,a*n])}function I(t,o){let e=new Float32Array(9);for(let a=0;a<3;a++)for(let r=0;r<3;r++)e[a*3+r]=t[r]*o[a*3]+t[3+r]*o[a*3+1]+t[6+r]*o[a*3+2];return e}var Le=null,J=new Map;function xe(t,o="srgb"){if(t=t.trim(),o==="srgb"){let s=t.match(/^#([0-9a-f]{3})$/i);if(s)return[...s[1]].map(i=>parseInt(i+i,16)/255);if(s=t.match(/^#([0-9a-f]{6})$/i),s)return[0,2,4].map(i=>parseInt(s[1].slice(i,i+2),16)/255)}let e=o+t;if(J.has(e))return J.get(e);let a=Le??(Le=Object.assign(document.createElement("canvas"),{width:1,height:1}).getContext("2d",{colorSpace:"display-p3",willReadFrequently:!0}));if(!a)return null;a.fillStyle="#000",a.fillStyle=t;let r=a.fillStyle;a.fillStyle="#fff",a.fillStyle=t;let n=null;if(r===a.fillStyle){a.clearRect(0,0,1,1),a.fillRect(0,0,1,1);let s=a.getImageData(0,0,1,1,{colorSpace:o}).data;n=[s[0]/255,s[1]/255,s[2]/255]}return J.size>256&&J.clear(),J.set(e,n),n}var ee=null;function ze(){if(ee!==null)return ee;try{let t=xe("#ff0000","display-p3");ee=!!t&&t[1]>.05}catch{ee=!1}return ee}var Oe=`#version 300 es
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
`;var De=`#version 300 es
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
`;var ye=new WeakMap;function Ie(t){let o=t.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});return o?(we(o),{gl:o,colorSpace:o.drawingBufferColorSpace==="display-p3"?"display-p3":"srgb"}):null}function we(t){"drawingBufferColorSpace"in t&&(t.drawingBufferColorSpace=ze()?"display-p3":"srgb"),t.bindVertexArray(t.createVertexArray()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.enable(t.SCISSOR_TEST),t.clearColor(0,0,0,0),t.activeTexture(t.TEXTURE0)}function Ue(t,o,e){let a=t.createShader(o);if(t.shaderSource(a,e),t.compileShader(a),!t.getShaderParameter(a,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(a)||"shader compile failed");return a}function ce(t,o,e="object",a){let r=ye.get(t);r||ye.set(t,r=new Map);let n=r.get(o);n||r.set(o,n=new Map);let s=e[0]+(a?.name??""),i=n.get(s);if(i)return i;let c=(e==="object"?Oe+`
`+(a?.frag??""):De)+`
`+o,l=t.createProgram();if(t.attachShader(l,Ue(t,t.VERTEX_SHADER,Pe)),t.attachShader(l,Ue(t,t.FRAGMENT_SHADER,c)),t.linkProgram(l),!t.getProgramParameter(l,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(l)||"link failed");let p=new Map,h=t.getProgramParameter(l,t.ACTIVE_UNIFORMS);for(let f=0;f<h;f++){let u=t.getActiveUniform(l,f);p.set(u.name,t.getUniformLocation(l,u.name))}let m={prog:l,loc:p};return n.set(s,m),m}function _e(t){ye.delete(t)}function me(t,o,e){for(let[a,r]of Object.entries(e)){let n=o.loc.get(a);n!==void 0&&(typeof r=="number"?t.uniform1f(n,r):r.length===1?t.uniform1i(n,r[0]):r.length===2?t.uniform2f(n,r[0],r[1]):r.length===3?t.uniform3f(n,r[0],r[1],r[2]):r.length===4?t.uniform4f(n,r[0],r[1],r[2],r[3]):r.length===9&&t.uniformMatrix3fv(n,!1,r))}}function fe(t){t.drawArrays(t.TRIANGLES,0,3)}function $(t,o,e){let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let r=t.createFramebuffer(),n={fb:r,tex:a,w:0,h:0};return te(t,n,o,e),t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0),n}function te(t,o,e,a){e=Math.max(1,e),a=Math.max(1,a),!(o.w===e&&o.h===a)&&(t.bindTexture(t.TEXTURE_2D,o.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,a,0,t.RGBA,t.UNSIGNED_BYTE,null),o.w=e,o.h=a)}function Q(t,o){t.deleteFramebuffer(o.fb),t.deleteTexture(o.tex)}var We={};Oa(We,{LIGHT_SHADE:()=>qe,animations:()=>re,clampTo:()=>G,effectAttrs:()=>ne,effectParam:()=>ie,effects:()=>_,interactionAttrs:()=>Se,interactionParam:()=>Re,interactionValue:()=>S,interactions:()=>B,kebab:()=>Z,num:()=>R,objects:()=>ae,resolveShade:()=>Ee,shadeAttrs:()=>se,shadeParam:()=>oe,shades:()=>O});var ae=new Map,re=new Map,_=new Map,O=new Map,qe="matte",B=new Map,Ne=()=>[..._.values()].map(t=>t.manifest),Ge=()=>[...B.values()].map(t=>t.meta),Ve=()=>[...O.values()].map(t=>t.manifest),Me=t=>t.flatMap(o=>o.params.map(e=>`${o.name}-${Z(e.name)}`)),ne=()=>Me(Ne()),Se=()=>Me(Ge()),se=()=>Me(Ve()),Z=t=>t.replace(/[A-Z]/g,o=>"-"+o.toLowerCase());function ke(t,o,e,a){var r;for(let n of t){let s=n.name+"-";if(!o.startsWith(s))continue;let i=n.params.find(l=>Z(l.name)===o.slice(s.length));if(!i)continue;let c=e==null||e===""?NaN:Number(e);return Number.isFinite(c)?(a[r=n.name]??(a[r]={}))[i.name]=G(c,i):delete a[n.name]?.[i.name],!0}return!1}var ie=(t,o,e)=>ke(Ne(),t,o,e),Re=(t,o,e)=>ke(Ge(),t,o,e),oe=(t,o,e)=>ke(Ve(),t,o,e),Be=new Set;function Ee(t,o){t&&t!=="auto"&&!O.has(t)&&!Be.has(t)&&(Be.add(t),console.warn(`[solids] unknown shading "${t}", using auto`));let e=O.has(t)?t:o?qe:"glass";return O.has(e)?e:"glass"}var S=(t,o,e)=>t.interactionParams[o]?.[e]??B.get(o).meta.params.find(a=>a.name===e).default,R=(t,o)=>{if(t==null||t==="")return o;let e=Number(t);return Number.isFinite(e)?e:o},G=(t,o)=>Math.min(o.max??t,Math.max(o.min??t,t));var _a=new Map([["off",0],["idle",.25],["busy",.6],["active",1]]),Ba=["animation","speed","effect","shading","state","color","size","phase","theme","gravity","gravity-gap"],pe=t=>t.replace(/-([a-z])/g,(o,e)=>e.toUpperCase()),j=class extends HTMLElement{constructor(){super();this.scene=null;this.rect=null;this.uniforms={};this.rgb=[.61,.82,1];this.colorSrc="#9bd1ff";this.stateValue=.25;this.stateTarget=.25;this.speedValue=1;this.animNames=[];this.effectNames=[];this.effectParams={};this.shadeName="auto";this.shadeParams={};this.anim={rotation:new Float32Array(je),offset:[0,0],scale:1,z:0,state:0};this.pose=null;this.pinned=!1;this.blurPx=0;this.field=null;this.drawn=null;this.broken=!1;this.clock=0;this.phaseOffset=0;this.prevPose=null;this.blend=1;let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{display:inline-block;position:relative;width:var(--sd-size,160px);aspect-ratio:1;vertical-align:middle}sd-scene{position:absolute;inset:0}</style><style></style>";for(let a of this.manifest.uniforms)this.uniforms[a.name]=G(R(String(a.default),0),a)}static get observedAttributes(){return[...Ba,...this.manifest.uniforms.map(e=>Z(e.name)),...ne(),...se()]}get manifest(){return this.constructor.manifest}get frag(){return this.constructor.frag}connectedCallback(){let e=this.closest("sd-scene, sd-universe"),a=this.shadowRoot.querySelector("sd-scene");if(e)a&&(a.detach(this),a.remove()),e.attach?.(this);else if(a)a.attach(this);else{let r=document.createElement("sd-scene");this.hasAttribute("theme")&&r.setAttribute("theme",this.getAttribute("theme")),this.shadowRoot.append(r),r.attach(this)}}disconnectedCallback(){this.scene?.detach(this)}attributeChangedCallback(e,a,r){let n=r??"";switch(e){case"animation":this.animNames=n.split(/\s+/).filter(Boolean),this.pose&&(this.prevPose=this.pose,this.blend=0);return;case"effect":this.effectNames=n.split(/\s+/).filter(Boolean);return;case"shading":this.shadeName=n.trim()||"auto";return;case"speed":this.speedValue=R(n,1);return;case"state":this.stateTarget=_a.get(n)??.25;return;case"theme":this.shadowRoot.querySelector("sd-scene")?.setAttribute("theme",n);return;case"color":this.recolor(n||"#9bd1ff");return;case"size":this.shadowRoot.querySelectorAll("style")[1].textContent=n?`:host{width:${n}}`:"";return;case"phase":this.phaseOffset=R(n,0);return;case"gravity":case"gravity-gap":return}if(ie(e,r,this.effectParams)||oe(e,r,this.shadeParams))return;let s=this.manifest.uniforms.find(i=>Z(i.name)===e);s&&(this.uniforms[s.name]=G(R(r,s.default),s))}recolor(e=this.colorSrc){let a=e?xe(e,this.scene?.colorSpace):null;a&&(this.rgb=a,this.colorSrc=e)}drawCenter(){let e=this.rect;return[e.x+e.width/2+this.anim.offset[0],e.y+e.height/2+this.anim.offset[1]]}drawRadius(){return Math.min(this.rect.width,this.rect.height)/2*this.anim.scale}update(e){this.stateValue=F(this.stateValue,this.stateTarget,e,150),this.pinned=!1,this.blurPx=0;let a=A();a||(this.clock+=e/1e3*this.speedValue);let r={rotation:[0,0,0],offset:[0,0],scale:1,state:0};for(let s of this.animNames){let i=re.get(s)?.fn(a?0:this.clock+this.phaseOffset,this.speedValue,this);if(i){if(i.rotation)for(let c=0;c<3;c++)r.rotation[c]+=i.rotation[c];i.offset&&(r.offset[0]+=i.offset[0],r.offset[1]+=i.offset[1]),i.scale!==void 0&&(r.scale*=i.scale),i.state!==void 0&&(r.state+=i.state)}}let n=r;if(this.prevPose&&this.blend<1){this.blend=Math.min(1,this.blend+e/400);let s=this.blend*this.blend*(3-2*this.blend),i=this.prevPose;n={rotation:[0,1,2].map(c=>qa(i.rotation[c],r.rotation[c],s)),offset:[D(i.offset[0],r.offset[0],s),D(i.offset[1],r.offset[1],s)],scale:D(i.scale,r.scale,s),state:D(i.state,r.state,s)}}this.pose=n,this.anim.rotation=L(n.rotation[0],n.rotation[1],n.rotation[2]),this.anim.offset=[n.offset[0],n.offset[1]],this.anim.scale=n.scale,this.anim.state=n.state,this.anim.z=0}};function qa(t,o,e){let a=((o-t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return t+a*e}var Te=null;function A(){return window.__SD_REDUCED!==void 0?!!window.__SD_REDUCED:(Te??(Te=matchMedia("(prefers-reduced-motion: reduce)")),Te.matches)}function de(t,o){for(let e of o)if(!Object.getOwnPropertyDescriptor(t,pe(e))){if(pe(e)in t){console.warn(`[solids] attribute "${e}" is not reflected: it would shadow the ${pe(e)} member`);continue}Object.defineProperty(t,pe(e),{get(){return this.getAttribute(e)},set(a){a==null?this.removeAttribute(e):this.setAttribute(e,String(a))}})}}function C(t,o){var a;if(!t?.tag||customElements.get(t.tag))return;ae.set(t.name,{manifest:t,frag:o});let e=(a=class extends j{},a.manifest=t,a.frag=o,a);de(e.prototype,e.observedAttributes),customElements.define(t.tag,e)}var Xe=`// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
`;var V=class extends HTMLElement{constructor(){super();this.gl=null;this.colorSpace="srgb";this.objects=new Set;this.pointer={x:0,y:0,inside:!1,down:!1,tap:null};this.press=null;this.interactionNames=[];this.effectNames=[];this.shadeName="auto";this.shadeParams={};this.effectParams={};this.interactionParams={};this.theme="auto";this.pixelRatio=1;this.maxDpr=2;this.width=0;this.height=0;this.frameTime=0;this.fps=0;this.gpuMs=null;this.gpuOn=!1;this.query=null;this.raf=0;this.last=0;this.visible=!1;this.paused=!1;this.dirty=!1;this.frames=0;this.failed=new Set;this.maxTex=8192;this.lose=null;this.fields=new Map;this.ro=null;this.io=null;this.fbos=null;this.clock=0;this.onPointer=e=>{let a=this.getBoundingClientRect();this.pointer.x=e.clientX-a.left,this.pointer.y=e.clientY-a.top,this.pointer.inside=!0};this.onLeave=()=>{this.pointer.inside=!1,this.pointer.down=!1};this.mine=e=>e.target.closest?.("sd-scene, sd-universe")===this;this.onPress=e=>{!e.isPrimary||e.button!==0||!this.mine(e)||(this.onPointer(e),this.pointer.down=!0,this.press={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp})};this.onRelease=e=>{let a=this.press;if(!(!a||e.pointerId!==a.id)&&(this.press=null,this.pointer.down=!1,!!this.mine(e)&&Math.hypot(e.clientX-a.x,e.clientY-a.y)<8&&e.timeStamp-a.t<400)){let r=this.getBoundingClientRect();this.tap(e.clientX-r.left,e.clientY-r.top)}};this.onCancelPress=()=>{this.press=null,this.pointer.down=!1};this.onVis=()=>{document.hidden?this.stop():this.start()};this.tick=e=>{this.raf=0,this.last&&(this.fps=Ae(this.fps,1e3/Math.max(e-this.last,1)));let a=this.last?Math.min(e-this.last,100):16;this.last=e,this.frame(this.clock+a/1e3,a),this.raf=requestAnimationFrame(this.tick)};let e=this.attachShadow({mode:"open"});e.innerHTML="<style>:host{position:relative;display:block}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style><canvas></canvas><slot></slot>",this.canvas=e.querySelector("canvas")}static get observedAttributes(){return["interaction","effect","shading","theme","paused","dpr",...ne(),...Se(),...se()]}get time(){return this.clock}connectedCallback(){if(this.gl)this.gl.isContextLost()&&this.lose?.restoreContext();else{let a=Ie(this.canvas);if(this.gl=a?.gl??null,this.colorSpace=a?.colorSpace??"srgb",this.gl)this.maxTex=Math.min(8192,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)),this.lose=this.gl.getExtension("WEBGL_lose_context");else{this.dataset.fallback="";for(let r of this.objects)r.dataset.fallback=""}this.canvas.addEventListener("webglcontextlost",r=>{r.preventDefault(),this.stop(),this.dataset.fallback="",this.isConnected&&this.lose?.restoreContext()}),this.canvas.addEventListener("webglcontextrestored",()=>{_e(this.gl),this.fbos=null,this.query=null,this.failed.clear(),this.fields.clear(),we(this.gl);for(let r of this.objects)r.broken=!1;delete this.dataset.fallback,this.start()})}this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this);let e=this.getBoundingClientRect();this.visible=e.bottom>0&&e.right>0&&e.top<innerHeight&&e.left<innerWidth,this.io=new IntersectionObserver(a=>{this.visible=a[a.length-1].isIntersecting,this.visible?this.start():this.stop()}),this.io.observe(this),this.addEventListener("pointermove",this.onPointer),this.addEventListener("pointerleave",this.onLeave),this.addEventListener("pointerdown",this.onPress),this.addEventListener("pointerup",this.onRelease),this.addEventListener("pointercancel",this.onCancelPress),document.addEventListener("visibilitychange",this.onVis);for(let a of this.querySelectorAll("*"))a instanceof j&&a.closest("sd-scene, sd-universe")===this&&this.attach(a);for(let a of this.objects)this.ro.observe(a);this.measure(),this.start()}disconnectedCallback(){this.stop(),this.ro?.disconnect(),this.io?.disconnect(),document.removeEventListener("visibilitychange",this.onVis),queueMicrotask(()=>{!this.isConnected&&this.gl&&!this.gl.isContextLost()&&this.lose?.loseContext()})}attributeChangedCallback(e,a,r){let n=r??"";if(e==="interaction")this.interactionNames=n.split(/\s+/).filter(Boolean),this.interactionNames.forEach(s=>B.get(s)?.setup?.(this));else if(e==="effect")this.effectNames=n.split(/\s+/).filter(Boolean);else if(e==="shading")this.shadeName=n.trim()||"auto";else if(e==="theme")this.theme=n||"auto";else if(e==="dpr"){let s=Number(n);this.maxDpr=n&&!isNaN(s)&&s>0?s:2,this.measure()}else e==="paused"?(this.paused=r!==null,this.paused?this.stop():this.start()):!ie(e,r,this.effectParams)&&!oe(e,r,this.shadeParams)&&Re(e,r,this.interactionParams)}attach(e){this.objects.has(e)||(this.objects.add(e),e.scene=this,e.recolor(),this.isConnected&&!this.gl&&(e.dataset.fallback=""),this.ro?.observe(e),this.dirty=!0)}settle(){this.dirty=!1,this.objects=new Set([...this.objects].sort((e,a)=>e.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)),this.measure()}detach(e){this.objects.delete(e),e.scene=null,this.ro?.unobserve(e),this.dirty=!0;let a=this.fields.get(e);a&&(this.gl?.deleteTexture(a.tex),this.fields.delete(e))}get themeValue(){return this.theme==="dark"?0:this.theme==="light"||(He??(He=matchMedia("(prefers-color-scheme: light)"))).matches?1:0}tap(e,a){this.pointer.tap={x:e,y:a}}measure(){let e=this.getBoundingClientRect();this.pixelRatio=Math.min(devicePixelRatio||1,this.maxDpr),this.width=e.width,this.height=e.height;let a=Math.round(e.width*this.pixelRatio),r=Math.round(e.height*this.pixelRatio);(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r);for(let n of this.objects){let s=n.getBoundingClientRect();n.rect=new DOMRect(s.left-e.left,s.top-e.top,s.width,s.height)}}start(){this.raf||!this.gl||this.gl.isContextLost()||!this.isConnected||this.paused||!this.visible||document.hidden||(this.last=0,this.raf=requestAnimationFrame(this.tick))}stop(){cancelAnimationFrame(this.raf),this.raf=0}frame(e,a){let r=this.gl;this.dirty&&this.settle();let n=this.canvas.width,s=this.canvas.height;if(!r||r.isContextLost()||n===0||s===0)return;let i=performance.now(),c=this.gpuOn?this.gpuBegin(r):null;try{this.render(r,n,s,e,a)}finally{c&&r.endQuery(c.TIME_ELAPSED_EXT),this.frames++>0&&(this.frameTime=Ae(this.frameTime,performance.now()-i))}}get gpuTime(){return this.gpuOn=!0,this.gpuMs}gpuBegin(e){let a=e.getExtension("EXT_disjoint_timer_query_webgl2");if(!a)return null;if(this.query){if(!e.getQueryParameter(this.query,e.QUERY_RESULT_AVAILABLE))return null;let r=e.getQueryParameter(this.query,e.QUERY_RESULT);!e.getParameter(a.GPU_DISJOINT_EXT)&&Number.isFinite(r)&&(this.gpuMs=Ae(this.gpuMs??0,r/1e6))}return e.beginQuery(a.TIME_ELAPSED_EXT,this.query??(this.query=e.createQuery())),a}render(e,a,r,n,s){A()||(this.clock=n),n=this.clock;for(let m of this.objects)m.update(s);this.step(s);for(let m of this.interactionNames)B.get(m)?.frame(this,s,this.pointer);let i=this.fbos??(this.fbos={scene:null,a:null,b:null,pool:new Map,used:new Set}),c=this.themeValue,l=this.effectNames.filter(m=>_.has(m));l.length?(i.scene??(i.scene=$(e,a,r)),i.a??(i.a=$(e,a,r)),i.b??(i.b=$(e,a,r)),te(e,i.scene,a,r),te(e,i.a,a,r),te(e,i.b,a,r)):i.scene&&(Q(e,i.scene),Q(e,i.a),Q(e,i.b),i.scene=i.a=i.b=null);let p=l.length?i.scene:null;this.bind(e,p,0,0,a,r,!0);let h=[...this.objects].filter(m=>m.rect&&!m.broken).sort((m,f)=>(m.anim.z||0)-(f.anim.z||0));for(let m of h)this.draw(e,m,n,c,i,p);if(l.length){let m=i.scene;for(let f of l){let u=m===i.a?i.b:i.a;this.bind(e,u,0,0,a,r,!0),this.pass(e,f,m,this.effectParams[f],[a,r],n,c),m=u}this.bind(e,null,0,0,a,r,!0),this.blit(e,m)}for(let[m,f]of i.pool)i.used.has(m)?f[2]=0:++f[2]>60&&(Q(e,f[0]),Q(e,f[1]),i.pool.delete(m));i.used.clear()}step(e){}bind(e,a,r,n,s,i,c){e.bindFramebuffer(e.FRAMEBUFFER,a?.fb??null),e.viewport(r,n,s,i),e.scissor(r,n,s,i),c&&e.clear(e.COLOR_BUFFER_BIT)}blit(e,a){let r=ce(e,Xe,"effect");e.useProgram(r.prog),e.bindTexture(e.TEXTURE_2D,a.tex),me(e,r,{uScene:[0]}),fe(e)}pass(e,a,r,n,s,i,c){let l=_.get(a);if(this.failed.has(a))return this.blit(e,r);let p;try{p=ce(e,l.frag,"effect")}catch(m){this.failed.add(a),console.error(`[solids] effect "${a}" shader failed:
${m.message}`),this.blit(e,r);return}e.useProgram(p.prog),e.bindTexture(e.TEXTURE_2D,r.tex);let h={};for(let m of l.manifest.params)h[m.name]=m.default;me(e,p,{uScene:[0],uResolution:s,uTime:i,uTheme:c,uMix:n?.mix??1,...h,...n}),fe(e)}draw(e,a,r,n,s,i,c=this.canvas.width,l=this.canvas.height){let p=a.rect,[h,m]=a.drawCenter();a.drawn=[h,m];let f=p.width*a.anim.scale*this.pixelRatio,u=p.height*a.anim.scale*this.pixelRatio,x=Math.min(f,u),d=Math.ceil(f*Ye/8)*8,b=Math.ceil(u*Ye/8)*8;if(!(x>0)||d>this.maxTex||b>this.maxTex)return;let y=Math.round(h*this.pixelRatio-d/2),g=Math.round((this.height-m)*this.pixelRatio-b/2);if(y>=c||g>=l||y+d<=0||g+b<=0)return;let k=Ee(a.hasAttribute("shading")?a.shadeName:this.shadeName,n),z=O.get(k),v={};for(let w of z.manifest.params)v[w.name]=a.shadeParams[k]?.[w.name]??this.shadeParams[k]?.[w.name]??w.default;let T;try{T=ce(e,a.frag,"object",{name:k,frag:z.frag})}catch(w){a.broken=!0,console.error(`[solids] <${a.manifest.tag}> shader failed:
${w.message}`);return}let E=a.effectNames.filter(w=>_.has(w));a.blurPx>=.5&&!E.includes("defocus")&&E.push("defocus");let M;if(E.length){let w=d+"x"+b;M=s.pool.get(w),M||s.pool.set(w,M=[$(e,d,b),$(e,d,b),0]),s.used.add(w),this.bind(e,M[0],0,0,d,b,!0)}else this.bind(e,i,y,g,d,b,!1);if(e.useProgram(T.prog),a.field){let w=this.fields.get(a);if(w)e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,w.tex);else{let N=e.createTexture();e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,N),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.fields.set(a,w={tex:N,v:-1})}w.v!==a.field.version&&(e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.R8,a.field.width,a.field.height,0,e.RED,e.UNSIGNED_BYTE,a.field.data),w.v=a.field.version),e.activeTexture(e.TEXTURE0)}if(me(e,T,{uTime:r,uResolution:[d,b],uRotation:a.anim.rotation,uScale:x/Math.min(d,b),uBound:1.6*Math.max(f,u)/x,uState:Math.min(1,Math.max(0,a.stateValue+a.anim.state)),uTheme:n,uColor:a.rgb,...a.field?{uField:[1],uFieldSize:[a.field.width,a.field.height],uFieldRange:a.field.range}:{},...v,...a.uniforms}),fe(e),!E.length)return;let X=M[0];for(let w of E){let N=X===M[0]?M[1]:M[0];this.bind(e,N,0,0,d,b,!0);let H={...this.effectParams[w],...a.effectParams[w],...w==="defocus"&&a.blurPx>=.5?{radius:a.blurPx}:{}};this.pass(e,w,X,H,[d,b],r,n),X=N}this.bind(e,i,y,g,d,b,!1),this.blit(e,X)}},He=null,Ye=1.5,Ae=(t,o)=>t?t+(o-t)*.1:o;var Je=["color(display-p3 0.55 0.85 1)","color(display-p3 0.78 0.66 1)","color(display-p3 1 0.55 0.8)","color(display-p3 0.5 1 0.85)","color(display-p3 1 0.8 0.5)","color(display-p3 0.55 1 0.6)"],Ga=["idle","float","spin"],$e=["count","seed","collide","camera","speed","drift","perspective","depth","focus","shapes","palette"],Va=["count","seed","shapes","palette"],Qe=640,q=Math.PI/180,Ze=()=>new Set([...ae.values()].map(t=>t.manifest.tag)),he=t=>Math.hypot(t[0],t[1],t[2]),Wa=(t,o)=>[t[0]-o[0],t[1]-o[1],t[2]-o[2]],Ke=t=>{let o=he(t)||1;return[t[0]/o,t[1]/o,t[2]/o]};function Ce(t){return()=>{t=t+1831565813|0;let o=Math.imul(t^t>>>15,1|t);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}var ue=class extends V{constructor(){super();this.yaw=0;this.pitch=0;this.body=new WeakMap;this.rnd=Ce(1);this.ready=!1;this.simTime=0;this.drag=null;this.vel=[0,0];this.spinGain=1;this.tilt=[0,0];this.onDown=e=>{if(!(!this.cam().has("drag")||!e.isPrimary||e.button!==0||this.drag)){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp},this.vel=[0,0],this.classList.add("sd-dragging");try{this.setPointerCapture(e.pointerId)}catch{}}};this.onMove=e=>{let a=this.drag;if(!a||e.pointerId!==a.id)return;if(e.buttons===0)return this.onUp(e);let r=Math.max(8,e.timeStamp-a.t),n=(e.clientX-a.x)*.006,s=(e.clientY-a.y)*.006;this.yaw+=n,this.pitch=P(this.pitch+s,-60*q,60*q),this.vel=[n/r,s/r],this.drag={id:a.id,x:e.clientX,y:e.clientY,t:e.timeStamp}};this.onUp=e=>{let a=this.drag;!a||e.pointerId!==a.id&&e.type!=="lostpointercapture"||(this.drag=null,this.classList.remove("sd-dragging"),(A()||e.timeStamp-a.t>80)&&(this.vel=[0,0]))};this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{overflow:hidden;min-height:320px;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}::slotted(*){position:absolute;left:50%;top:50%;translate:-50% -50%}:host(:not([camera])),:host([camera~=drag]){cursor:grab}:host(.sd-dragging){cursor:grabbing}"})),this.addEventListener("pointerdown",this.onDown),this.addEventListener("pointermove",this.onMove),this.addEventListener("pointerup",this.onUp),this.addEventListener("pointercancel",this.onUp),this.addEventListener("lostpointercapture",this.onUp)}static get observedAttributes(){return[...V.observedAttributes,...$e]}get bodies(){return[...this.objects].map(e=>this.body.get(e)).filter(e=>!!e)}connectedCallback(){if(super.connectedCallback(),this.ready)return;this.ready=!0;let e=Ze();[...this.children].some(a=>e.has(a.localName))?queueMicrotask(()=>this.adopt()):this.generate()}attributeChangedCallback(e,a,r){if(!$e.includes(e))return super.attributeChangedCallback(e,a,r);this.ready&&Va.includes(e)&&this.generate()}kids(){return[...this.children].filter(e=>e instanceof j)}cam(){return new Set((this.getAttribute("camera")??"spin drag pointer").split(/\s+/))}generate(){for(let m of this.kids())m.remove();let e=Ze(),a=(this.getAttribute("shapes")??"").split(/\s+/).filter(Boolean).map(m=>m.startsWith("sd-")?m:"sd-"+m),r=(a.length?a:[...e]).filter(m=>e.has(m)),n=this.getAttribute("palette")?.match(/[^\s,(]+(\([^)]*\))?/g)??Je,s=r.length?P(Math.round(R(this.getAttribute("count"),24)),0,120):0,i=Ce(R(this.getAttribute("seed"),1)),c=m=>m[Math.floor(i()*m.length)],l=()=>{for(;;){let m=[i()*2-1,i()*2-1,i()*2-1];if(he(m)<=1)return m}},p=[];for(let m=0;m<s;m++){let f=8*Math.round((40+100*i())/8),u=f/Qe,x=l(),d=-1/0;for(let b=0;b<8;b++){let y=l(),g=2;for(let k of p)g=Math.min(g,he(Wa(y,k.p))-u-k.r);g>d&&(d=g,x=y)}p.push({tag:c(r),p:x,r:u,size:f,color:c(n),anim:c(Ga),speed:.6+i()*.8,phase:i()*20})}let h=document.createDocumentFragment();for(let m of p){let f=document.createElement(m.tag);f.dataset.pos=m.p.map(u=>u.toFixed(2)).join(" "),f.setAttribute("size",m.size+"px"),f.setAttribute("color",m.color),f.setAttribute("animation",m.anim),f.setAttribute("speed",m.speed.toFixed(2)),f.setAttribute("phase",m.phase.toFixed(1)),h.append(f)}this.append(h),this.adopt()}adopt(){this.rnd=Ce(R(this.getAttribute("seed"),1)*7919+17),this.body=new WeakMap}bodyOf(e){let a=this.body.get(e);if(a)return a;let r=this.rnd,n=(e.dataset.pos??"").split(/\s+/).map(Number),s=n.length===3&&n.every(p=>!isNaN(p))?[n[0],n[1],n[2]]:Ke([r()-.5,r()-.5,r()-.5]).map(p=>p*r()),i=Ke([r()-.5,r()-.5,r()-.5]).map(p=>p*(.02+r()*.04)),c=[];for(let p=0;p<3;p++)c.push(.05+r()*.1,r()*2*Math.PI,.02+r()*.03);let l=Math.max(R((e.getAttribute("size")??"").replace("px",""),80),1);return a={el:e,p:s,v:i,r:l/Qe,tilt:L((r()-.5)*70*q,0,(r()-.5)*70*q),wob:c},this.body.set(e,a),a}step(e){let a=this.width,r=this.height;if(!a||!r)return;let n=A(),s=this.cam(),i=Math.max(0,R(this.getAttribute("speed"),1)),c=n?0:P(R(this.getAttribute("drift"),.5),0,1),l=P(R(this.getAttribute("depth"),.5),0,1),p=P(R(this.getAttribute("focus"),0),-1,1),h=1.6/P(R(this.getAttribute("perspective"),.5),.05,1);if(this.drag)this.spinGain=Math.max(0,this.spinGain-e/300);else{this.spinGain=Math.min(1,this.spinGain+e/2e3),s.has("spin")&&!n&&(this.yaw+=e/1e3*(2*Math.PI/90)*i*this.spinGain),this.yaw+=this.vel[0]*e,this.pitch=P(this.pitch+this.vel[1]*e,-60*q,60*q);let v=Math.exp(-e/600);this.vel[0]*=v,this.vel[1]*=v}let m=s.has("pointer")&&this.pointer.inside;this.tilt[0]=F(this.tilt[0],m?(P(this.pointer.x/a,0,1)*2-1)*12*q:0,e,150),this.tilt[1]=F(this.tilt[1],m?(P(this.pointer.y/r,0,1)*2-1)*8*q:0,e,150);let f=this.yaw+this.tilt[0],u=this.pitch+this.tilt[1],x=Math.cos(f),d=Math.sin(f),b=Math.cos(u),y=Math.sin(u),g=a/2*.95,k=r/2*.95*(h-.6)/h;n||(this.simTime+=e/1e3);let z=[...this.objects].map(v=>this.bodyOf(v));if(c>0)for(let v of z){for(let E=0;E<3;E++)v.p[E]+=v.v[E]*(e/1e3)*c;let T=he(v.p);if(T>1){let E=(v.p[0]*v.v[0]+v.p[1]*v.v[1]+v.p[2]*v.v[2])/T;if(E>0)for(let M=0;M<3;M++)v.v[M]-=2*E*v.p[M]/T;for(let M=0;M<3;M++)v.p[M]/=T}}this.hasAttribute("collide")&&this.collide(z);for(let v of z){let T=v.el.anim,E=v.wob,M=[v.p[0],v.p[1],v.p[2]];if(c>0)for(let Y=0;Y<3;Y++)M[Y]+=Math.sin(2*Math.PI*E[Y*3]*this.simTime+E[Y*3+1])*E[Y*3+2]*c;let X=M[0]*x+M[2]*d,w=-M[0]*d+M[2]*x,N=M[1]*b-w*y,H=M[1]*y+w*b,K=v.el.rect;if(!K)continue;let ve=P(h/(h-H),.3,3);T.offset[0]+=a/2-(K.x+K.width/2)+X*ve*g,T.offset[1]+=r/2-(K.y+K.height/2)-N*ve*k,T.scale*=ve,T.z=H,T.rotation=I(v.tilt,T.rotation),v.el.blurPx=Math.min(24,l*Math.abs(H-p)*14),T.state-=.75*l*Math.max(0,p-H)}}collide(e){for(let a=0;a<4;a++)for(let r=0;r<e.length;r++)for(let n=r+1;n<e.length;n++){let s=e[r],i=e[n],c=i.p[0]-s.p[0],l=i.p[1]-s.p[1],p=i.p[2]-s.p[2],h=s.r+i.r,m=c*c+l*l+p*p;if(m>=h*h)continue;let f=Math.sqrt(m),u=f<1e-6?1:c/f,x=f<1e-6?0:l/f,d=f<1e-6?0:p/f,b=1/(s.r*s.r*s.r),y=1/(i.r*i.r*i.r),g=b+y,k=h-f;s.p[0]-=u*k*(b/g),s.p[1]-=x*k*(b/g),s.p[2]-=d*k*(b/g),i.p[0]+=u*k*(y/g),i.p[1]+=x*k*(y/g),i.p[2]+=d*k*(y/g);let z=(i.v[0]-s.v[0])*u+(i.v[1]-s.v[1])*x+(i.v[2]-s.v[2])*d;if(z>=0)continue;let v=-2*z/g;s.v[0]-=u*v*b,s.v[1]-=x*v*b,s.v[2]-=d*v*b,i.v[0]+=u*v*y,i.v[1]+=x*v*y,i.v[2]+=d*v*y}}};var et=Math.PI/180,tt={meta:{name:"idle",description:"A slow sway, as if the object were resting in still air.",params:[]},fn:t=>({rotation:[Math.sin(t*2*Math.PI/9)*4*et,Math.sin(t*2*Math.PI/6)*8*et,0]})};var at={meta:{name:"spin",description:"A continuous turn around the vertical axis, one turn every 8 seconds at speed 1.",params:[]},fn:t=>({rotation:[0,t*2*Math.PI/8,0]})};var rt={meta:{name:"pulse",description:"A quick heartbeat in scale, 1.2 beats per second.",params:[]},fn:t=>({scale:1+.06*Math.sin(t*2*Math.PI*1.2)})};var nt={meta:{name:"breathe",description:"A slow swell in scale and brightness, one breath every 4 seconds.",params:[]},fn:t=>{let o=Math.sin(t*2*Math.PI*.25);return{scale:1+.03*o,state:.1*o}}};var st={meta:{name:"float",description:"A gentle bob with a little sideways drift.",params:[]},fn:t=>({offset:[Math.sin(t*2*Math.PI*.17)*3,Math.sin(t*2*Math.PI*.4)*6]})};var Xa=[tt,at,rt,nt,st];for(let t of Xa)re.set(t.meta.name,t);var it={name:"glow",description:"A soft bloom around bright areas. The voice-ring look.",params:[{name:"threshold",type:"float",default:.35,min:0,max:1,step:.01,label:"Brightness threshold"},{name:"radius",type:"float",default:14,min:2,max:40,step:1,label:"Radius (px)"},{name:"strength",type:"float",default:.9,min:0,max:2,step:.01,label:"Strength"}]};var ot=`uniform float threshold;
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
`;var lt={name:"beam",description:"A directional light streak, like an anamorphic lens flare.",params:[{name:"angle",type:"float",default:0,min:-90,max:90,step:1,label:"Angle (deg)"},{name:"reach",type:"float",default:60,min:10,max:200,step:1,label:"Reach (px)"},{name:"strength",type:"float",default:.8,min:0,max:2,step:.01,label:"Strength"}]};var ct=`uniform float angle;
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
`;var mt={name:"rgb-split",description:"Chromatic aberration: red and blue pulled apart horizontally.",params:[{name:"amount",type:"float",default:4,min:0,max:24,step:.5,label:"Offset (px)"}]};var ft=`uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
`;var pt={name:"pixelate",description:"Snaps the image to a coarse grid.",params:[{name:"size",type:"float",default:8,min:2,max:48,step:1,label:"Cell size (px)"}]};var dt=`uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
`;var ht={name:"dither",description:"Ordered Bayer dithering with a reduced palette. Retro.",params:[{name:"levels",type:"float",default:4,min:2,max:8,step:1,label:"Levels per channel"},{name:"scale",type:"float",default:2,min:1,max:6,step:1,label:"Pattern scale (px)"}]};var ut=`uniform float levels;
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
`;var bt={name:"scanlines",description:"Horizontal CRT lines over the image.",params:[{name:"density",type:"float",default:3,min:2,max:12,step:1,label:"Line spacing (px)"},{name:"opacity",type:"float",default:.35,min:0,max:1,step:.01,label:"Line darkness"}]};var gt=`uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
`;var vt={name:"halftone",description:"A print dot screen: the image becomes a grid of dots that grow with brightness.",params:[{name:"size",type:"float",default:7,min:3,max:24,step:1,label:"Dot spacing (px)"},{name:"angle",type:"float",default:45,min:0,max:90,step:1,label:"Screen angle (deg)"}]};var xt=`uniform float size;
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
`;var yt={name:"outline",description:"Traces edges in the object's own color and lets the body recede. A drawn, technical look.",params:[{name:"width",type:"float",default:1.5,min:.5,max:6,step:.5,label:"Line width (px)"},{name:"strength",type:"float",default:.8,min:0,max:1,step:.01,label:"Strength"}]};var wt=`uniform float width;
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
`;var Mt={name:"grain",description:"Animated film grain over the objects. Adds texture without changing the shapes.",params:[{name:"amount",type:"float",default:.18,min:0,max:.6,step:.01,label:"Amount"},{name:"size",type:"float",default:1.5,min:1,max:4,step:.5,label:"Grain size (px)"}]};var St=`uniform float amount;
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
`;var kt={name:"vignette",description:"Darkens objects toward the edges of the scene, like an old lens.",params:[{name:"radius",type:"float",default:.15,min:0,max:1,step:.01,label:"Clear radius"},{name:"softness",type:"float",default:.45,min:.05,max:1,step:.01,label:"Softness"}]};var Rt=`uniform float radius;
uniform float softness;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  // Distance from the center in units of the shorter side, so the clear area stays round.
  vec2 p = (vUv - 0.5) * uResolution / min(uResolution.x, uResolution.y);
  float f = 1.0 - 0.85 * smoothstep(radius, radius + softness, length(p));
  return vec4(c.rgb * f, c.a);
}
`;var Et={name:"chroma",description:"Slowly swings the hue back and forth around the original color.",params:[{name:"speed",type:"float",default:.6,min:0,max:3,step:.05,label:"Speed"},{name:"range",type:"float",default:.35,min:0,max:1,step:.01,label:"Hue range (1 is the full wheel)"}]};var Tt=`uniform float speed;
uniform float range;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float a = sin(uTime * speed) * range * 3.14159;
  // Rotate around the grey axis: brightness stays, hue turns. Linear, so premultiplied color is fine.
  vec3 k = vec3(0.57735);
  vec3 h = c.rgb * cos(a) + cross(k, c.rgb) * sin(a) + k * dot(k, c.rgb) * (1.0 - cos(a));
  return vec4(clamp(h, 0.0, c.a), c.a);
}
`;var At={name:"ripple",description:"Rings of distortion travel out from the center, like a drop in water.",params:[{name:"amplitude",type:"float",default:6,min:0,max:16,step:.5,label:"Amplitude (px)"},{name:"frequency",type:"float",default:6,min:1,max:24,step:.5,label:"Rings across the scene"},{name:"speed",type:"float",default:.8,min:0,max:3,step:.05,label:"Speed (rings per second)"}]};var Ct=`uniform float amplitude;
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
`;var Ft={name:"defocus",description:"A soft disc blur, like a lens out of focus. The universe sets it per shape from its depth.",params:[{name:"radius",type:"float",default:6,min:0,max:24,step:.5,label:"Radius (px)"}]};var Pt=`uniform float radius;

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
`;var xr=[{manifest:it,frag:ot},{manifest:lt,frag:ct},{manifest:mt,frag:ft},{manifest:pt,frag:dt},{manifest:ht,frag:ut},{manifest:bt,frag:gt},{manifest:vt,frag:xt},{manifest:yt,frag:wt},{manifest:Mt,frag:St},{manifest:kt,frag:Rt},{manifest:Et,frag:Tt},{manifest:At,frag:Ct},{manifest:Ft,frag:Pt}],yr={name:"mix",type:"float",default:1,min:0,max:2,step:.05,label:"Mix"};for(let t of xr)t.manifest.params.some(o=>o.name==="mix")||t.manifest.params.push(yr),_.set(t.manifest.name,t);var Lt={name:"glass",description:"Tinted glass with a fresnel rim and one highlight. The original look, and the dark default.",params:[]};var jt=`// Glassy: tinted body, fresnel rim, one specular, translucent. The dark look of v1; light is pale tinted glass with a darker rim.
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
`;var zt={name:"matte",description:"A soft opaque surface: half-lambert diffuse, a sky ambient, one broad highlight. Reads well on white.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"softness",type:"float",default:.5,min:0,max:1,step:.01,label:"Terminator softness"}]};var Ot=`uniform float light;
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
`;var Dt={name:"cel",description:"Flat bands of light with a hard highlight and an ink rim. The cartoon look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"bands",type:"float",default:3,min:2,max:5,step:1,label:"Light bands"},{name:"outline",type:"float",default:.8,min:0,max:1,step:.01,label:"Outline (0 removes it)"}]};var Ut=`uniform float light;
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
`;var It={name:"clay",description:"A warm putty surface with soft light, a little subsurface glow and darker creases. The clay render look.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"warmth",type:"float",default:.5,min:0,max:1,step:.01,label:"Subsurface warmth"}]};var _t=`uniform float light;
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
`;var Bt={name:"metal",description:"A polished metal that reflects a studio gradient with a horizon stripe, tinted by the color.",params:[{name:"light",type:"float",default:120,min:0,max:360,step:1,label:"Light azimuth (degrees)"},{name:"roughness",type:"float",default:.25,min:0,max:1,step:.01,label:"Roughness"}]};var qt=`uniform float light;
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
`;var Pr=[{manifest:Lt,frag:jt},{manifest:zt,frag:Ot},{manifest:Dt,frag:Ut},{manifest:It,frag:_t},{manifest:Bt,frag:qt}];for(let t of Pr)O.set(t.manifest.name,t);var Nt=new WeakMap,Gt=20*Math.PI/180,Vt={meta:{name:"pointer-follow",description:"Every object tilts toward the pointer on a soft spring.",params:[]},frame(t,o,e){for(let a of t.objects){if(!a.rect)continue;let r=Nt.get(a)??Nt.set(a,{x:0,y:0,vx:0,vy:0}).get(a),n=0,s=0;if(e.inside){let[i,c]=a.drawCenter(),l=(e.x-i)/Math.max(t.width,1),p=(e.y-c)/Math.max(t.height,1);s=Math.max(-1,Math.min(1,l*2))*Gt,n=Math.max(-1,Math.min(1,p*2))*Gt}U(r,n,s,o),a.anim.rotation=I(L(r.x,r.y,0),a.anim.rotation)}}};var Wt=new WeakMap,Xt={meta:{name:"hover-lift",description:"The object under the pointer grows a little and brightens to its active state.",params:[]},frame(t,o,e){for(let a of t.objects){if(!a.rect)continue;let[r,n]=a.drawCenter(),s=a.rect.width/2*a.anim.scale,i=a.rect.height/2*a.anim.scale,c=e.inside&&Math.abs(e.x-r)<=s&&Math.abs(e.y-n)<=i,l=F(Wt.get(a)??0,c?1:0,o,160);Wt.set(a,l),a.anim.scale*=1+.08*l,a.anim.state+=l*(1-a.stateValue)}}};var be=new WeakMap,Fe=t=>[t.rect.x+t.rect.width/2,t.rect.y+t.rect.height/2],Lr=t=>t*t*(3-2*t),Ht={meta:{name:"gravity",description:"One object is the center. The others orbit it on rings, farther rings turning slower like real orbits, or fall toward it and settle, in the plane of the page.",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Strength (scene attribute gravity-strength)"},{name:"gap",type:"float",default:24,min:0,max:200,step:1,label:"Clearance from the center in px (an object's gravity-gap overrides)"}]},setup(t){for(let o of t.objects){let e=be.get(o);e&&t.time-e.at>.2&&be.delete(o)}},frame(t,o){let e=[...t.objects].filter(f=>f.rect),a=e.find(f=>f.getAttribute("gravity")==="center")??null,r=S(t,"gravity","strength"),n=S(t,"gravity","gap"),s=a?Fe(a):null,i=A(),c=f=>{let u=f.getAttribute("gravity");return!s||f===a||u==="none"?"none":u==="fall"?"fall":"orbit"},l=e.filter(f=>c(f)==="orbit").map(f=>{let u=Fe(f);return{o:f,d:Math.hypot(u[0]-s[0],u[1]-s[1])}}).sort((f,u)=>f.d-u.d),p=l.length?Math.max(l[0].d,(a.rect.width+l[0].o.rect.width)/4+n):0,h=l.length?Math.max(l[l.length-1].d,p):0,m=f=>{let u=l.findIndex(d=>d.o===f),x=l.length;return x>1?p+(h-p)*u/(x-1):p};a&&(a.pinned=!0);for(let f of e){let u=c(f),x=u!=="none",d=be.get(f);if(!d&&!x)continue;d||be.set(f,d={angle:0,r:0,center:null,offset:[0,0],from:[0,0],k:1,at:0}),d.at=t.time,u==="orbit"&&(f.pinned=!0);let b=[0,0],y=0;if(x){let g=Fe(f);if(d.center!==a&&(d.from=[d.offset[0],d.offset[1]],d.k=0,d.center=a,d.angle=Math.atan2(g[1]-s[1],g[0]-s[0]),d.r=Math.hypot(g[0]-s[0],g[1]-s[1])),u==="fall"){let k=R(f.getAttribute("gravity-gap"),n)+(a.rect.width+f.rect.width)/4;i||(d.r+=(k-d.r)*(1-Math.exp(-o/700))*(.3+r))}else d.r=i||d.k===0?m(f):F(d.r,m(f),o,300),i||(d.angle+=o/1e3*.3*r*Math.pow(h/d.r,1.5)),y=Math.sin(d.angle)*(d.r/h);b=[s[0]+Math.cos(d.angle)*d.r-g[0],s[1]+Math.sin(d.angle)*d.r-g[1]]}else d.center&&(d.from=[d.offset[0],d.offset[1]],d.k=0,d.center=null);if(d.k<1){d.k=i?1:Math.min(1,d.k+o/800);let g=Lr(d.k);b=[D(d.from[0],b[0],g),D(d.from[1],b[1],g)]}d.offset=b,f.anim.offset[0]+=b[0],f.anim.offset[1]+=b[1],f.anim.z+=y,f.anim.scale*=1+.06*y}}};var Yt=new WeakMap,$t={meta:{name:"repel",description:"Objects near the pointer are pushed away from it and spring back when it leaves.",params:[{name:"radius",type:"float",default:140,min:20,max:400,step:1,label:"Reach around the pointer (px)"},{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Push strength"}]},frame(t,o,e){let a=S(t,"repel","radius"),r=S(t,"repel","strength");for(let n of t.objects){if(!n.rect)continue;let s=Yt.get(n)??Yt.set(n,{x:0,y:0,vx:0,vy:0}).get(n),i=0,c=0;if(e.inside){let[l,p]=n.drawCenter(),h=l-e.x,m=p-e.y,f=Math.hypot(h,m);if(f<a){let u=(1-f/a)*a*.5*r;i=f>.001?h/f*u:0,c=f>.001?m/f*u:-u}}U(s,i,c,o),n.anim.offset[0]+=s.x,n.anim.offset[1]+=s.y}}};var Qt=new WeakMap,Zt={meta:{name:"magnet",description:"Objects drift toward the pointer, each held within a short reach of its place.",params:[{name:"reach",type:"float",default:40,min:0,max:200,step:1,label:"Farthest drift from rest (px)"},{name:"strength",type:"float",default:.3,min:0,max:1,step:.01,label:"Pull strength"}]},frame(t,o,e){let a=S(t,"magnet","reach"),r=S(t,"magnet","strength");for(let n of t.objects){if(!n.rect)continue;let s=Qt.get(n)??[0,0],i=0,c=0;if(e.inside){let[p,h]=n.drawCenter();i=(e.x-p)*r,c=(e.y-h)*r;let m=Math.hypot(i,c);m>a&&(i*=a/m,c*=a/m)}let l=[F(s[0],i,o,250),F(s[1],c,o,250)];Qt.set(n,l),n.anim.offset[0]+=l[0],n.anim.offset[1]+=l[1]}}};var Kt=new WeakMap,Jt={meta:{name:"collide",description:"Objects keep their distance: overlapping neighbors ease apart; a gravity center and its orbiters hold still. List it last so it sees where the other interactions moved things.",params:[{name:"gap",type:"float",default:8,min:0,max:80,step:1,label:"Space kept between objects (px)"}]},frame(t,o){let e=S(t,"collide","gap"),a=[...t.objects].filter(l=>l.rect),r=a.map(l=>l.drawCenter()),n=r.map(l=>[...l]),s=a.map(l=>l.pinned?0:1),i=a.map(l=>l.drawRadius());for(let l=0;l<4;l++)for(let p=0;p<a.length;p++)for(let h=p+1;h<a.length;h++){let m=n[h][0]-n[p][0],f=n[h][1]-n[p][1],u=Math.hypot(m,f),x=i[p]+i[h]+e,d=s[p]+s[h];if(u>=x||!d)continue;u<.001?(m=1,f=0):(m/=u,f/=u);let b=(x-u)*s[p]/d,y=(x-u)*s[h]/d;n[p][0]-=m*b,n[p][1]-=f*b,n[h][0]+=m*y,n[h][1]+=f*y}let c=A()?1:1-Math.exp(-o/120);a.forEach((l,p)=>{let h=Kt.get(l)??[0,0],m=[h[0]+(n[p][0]-r[p][0]-h[0])*c,h[1]+(n[p][1]-r[p][1]-h[1])*c];Kt.set(l,m),l.anim.offset[0]+=m[0],l.anim.offset[1]+=m[1]})}};var ea={meta:{name:"scroll",description:"Objects turn as the page scrolls past the scene, and face front when the scene is in the middle of the screen.",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.05,label:"Turns while the scene crosses the screen"}]},frame(t){let o=t.getBoundingClientRect(),e=innerHeight,a=Math.min(1,Math.max(0,(e-o.top)/Math.max(e+o.height,1))),r=L(0,(a-.5)*S(t,"scroll","turns")*2*Math.PI,0);for(let n of t.objects)n.anim.rotation=I(r,n.anim.rotation)}};var ta=new WeakMap,aa=new WeakMap,ra={meta:{name:"shockwave",description:"A tap sends a ring out across the scene: shapes it crosses are shoved outward, flash, and spring back.",input:"tap",params:[{name:"radius",type:"float",default:480,min:60,max:1600,step:1,label:"How far the ring travels (px)"},{name:"strength",type:"float",default:.7,min:0,max:1,step:.01,label:"Shove strength"},{name:"speed",type:"float",default:900,min:100,max:3e3,step:10,label:"Ring speed (px per second)"}]},frame(t,o,e){let a=S(t,"shockwave","radius"),r=S(t,"shockwave","strength"),n=S(t,"shockwave","speed"),s=ta.get(t);s||ta.set(t,s={tap:e.tap,x:0,y:0,age:1e9}),e.tap&&e.tap!==s.tap&&(s.tap=e.tap,s.x=e.tap.x,s.y=e.tap.y,s.age=0),s.age+=o/1e3;let i=s.age*n,c=a+120,l=A();for(let p of t.objects){if(!p.rect)continue;let h=aa.get(p)??aa.set(p,{x:0,y:0,vx:0,vy:0}).get(p),m=0,f=0,u=0;if(i<c){let[x,d]=p.drawn??p.drawCenter(),b=x-s.x,y=d-s.y,g=Math.hypot(b,y);g>.001&&(u=Math.exp(-((g-i)**2)/7200)*(1-i/c)*r*(p.pinned?1/3:1),m=b/g*u*90,f=y/g*u*90)}U(h,m,f,o),p.anim.offset[0]+=h.x,p.anim.offset[1]+=h.y,l||(p.anim.scale*=1+.15*u,p.anim.state+=u*(1-p.stateValue))}}};var ge=new WeakMap,le=new WeakMap,na={meta:{name:"poke",description:"Tap a shape and it turns once around its vertical axis with a little pop.",input:"tap",params:[{name:"turns",type:"float",default:1,min:-3,max:3,step:.25,label:"Turns per tap"},{name:"pop",type:"float",default:.18,min:0,max:.5,step:.01,label:"Scale pop"}]},frame(t,o,e){let a=S(t,"poke","turns"),r=S(t,"poke","pop"),n=A();if(ge.has(t)||ge.set(t,e.tap),e.tap&&e.tap!==ge.get(t)){ge.set(t,e.tap);let s=null;for(let i of[...t.objects].sort((c,l)=>(c.anim.z||0)-(l.anim.z||0))){if(!i.rect)continue;let[c,l]=i.drawn??i.drawCenter(),p=i.rect.width/2*i.anim.scale,h=i.rect.height/2*i.anim.scale;Math.abs(e.tap.x-c)<=p&&Math.abs(e.tap.y-l)<=h&&(s=i)}s&&!le.has(s)&&le.set(s,0)}for(let s of t.objects){let i=le.get(s);if(i===void 0)continue;let c=Math.min(i/.9,1),l=1-(1-c)**3;s.anim.rotation=I(L(0,l*a*2*Math.PI,0),s.anim.rotation),n||(s.anim.scale*=1+r*Math.sin(c*Math.PI)),c>=1?le.delete(s):le.set(s,i+o/1e3)}}};var sa=new WeakMap,ia={meta:{name:"pull",description:"Press and hold anywhere: shapes gather toward your finger or pointer, then spring back when you let go.",input:"tap",params:[{name:"strength",type:"float",default:.6,min:0,max:1,step:.01,label:"Pull strength"},{name:"reach",type:"float",default:400,min:0,max:1e3,step:1,label:"Farthest travel (px)"}]},frame(t,o,e){let a=S(t,"pull","strength"),r=S(t,"pull","reach");for(let n of t.objects){if(!n.rect)continue;let s=sa.get(n)??sa.set(n,{x:0,y:0,vx:0,vy:0}).get(n),i=0,c=0;if(e.down){let[l,p]=n.drawCenter();i=(e.x-l)*a,c=(e.y-p)*a;let h=Math.hypot(i,c),m=r*(n.pinned?1/3:1);h>m&&(i*=m/h,c*=m/h)}U(s,i,c,o),n.anim.offset[0]+=s.x,n.anim.offset[1]+=s.y}}};var jr=[Ht,Vt,Xt,$t,Zt,ra,na,ia,Jt,ea];for(let t of jr)B.set(t.meta.name,t);var oa=`uniform sampler2D uField;   // signed distance of the text, set by the core from the element's field: 0.5 at the edge
uniform vec2 uFieldSize;    // texels
uniform float uFieldRange;  // padding texels around the em box, and the distance the byte spans
uniform float depth;        // half thickness, in units of a third of the em half height
uniform float bevel;        // edge rounding
uniform float emUnits;      // the em in unit space, set by the element from its font size and box (2 for a one-line word wider than tall)

// The text as an extruded 2D distance field with a rounded edge. The em is \`emUnits\` in unit space (the element measures its font
// against its box), so the twin sits on the HTML it wraps whatever the box's aspect; the field is the em plus padding, rows top down.
float map(vec3 p) {
  float tu = emUnits / (uFieldSize.y - 2.0 * uFieldRange);
  vec2 half2 = uFieldSize * tu * 0.5;
  vec2 uv = vec2(p.x, -p.y) / (half2 * 2.0) + 0.5;
  float d2 = (texture(uField, clamp(uv, 0.0, 1.0)).r - 0.5) * 2.0 * uFieldRange * tu - 0.25 * tu; // a quarter texel of bilinear safety
  vec2 q = abs(p.xy) - half2;
  d2 += length(max(q, 0.0));                                   // outside the field rect the lookup clamps; grow by the rect distance
  float r = bevel * 0.08;
  vec2 w = vec2(d2, abs(p.z) - depth * 0.3) + r;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;  // rounded extrusion, a true lower bound
}
void main() { fragColor = sdRender(0.9, 0.3); }
`;var Or={name:"text",tag:"sd-text",description:"Your HTML text as a solid: the letters of the element it wraps, extruded and shaded.",uniforms:[{name:"depth",type:"float",default:.35,min:.02,max:1,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.25,min:0,max:1,step:.01,label:"Edge rounding"}]},la=null,W=class extends j{constructor(){super();this.cell=0;this.version=0;this.queued=!1;this.mo=null;this.sizeWatch=null;this.shadowRoot.append(Object.assign(document.createElement("style"),{textContent:":host{display:inline-block;width:auto;aspect-ratio:auto;white-space:nowrap;line-height:1;color:transparent;-webkit-text-fill-color:transparent;user-select:none;-webkit-user-select:none}:host([data-fallback]){color:inherit;-webkit-text-fill-color:inherit}slot{display:block}"}),document.createElement("slot"))}static get observedAttributes(){return[...super.observedAttributes,"pixel"]}connectedCallback(){super.connectedCallback(),this.mo??(this.mo=new MutationObserver(()=>this.rebuild())),this.mo.observe(this,{childList:!0,characterData:!0,subtree:!0}),this.sizeWatch??(this.sizeWatch=new ResizeObserver(()=>this.rebuild())),this.sizeWatch.observe(this),document.fonts?.ready.then(()=>this.rebuild()),this.rebuild()}disconnectedCallback(){super.disconnectedCallback(),this.mo?.disconnect(),this.sizeWatch?.disconnect()}attributeChangedCallback(e,a,r){if(e!=="size"){if(e==="pixel"){this.cell=G(R(r,0),{min:0,max:24}),this.rebuild();return}super.attributeChangedCallback(e,a,r)}}update(e){super.update(e);let a=this.rect;if(!a)return;let r=parseFloat(getComputedStyle(this.firstElementChild??this).fontSize)||16;this.uniforms.emUnits=2*r/Math.max(1,Math.min(a.width,a.height))}rebuild(){this.queued||!this.isConnected||(this.queued=!0,requestAnimationFrame(()=>{this.queued=!1,this.isConnected&&this.raster()}))}raster(){let e=(this.textContent??"").replace(/\s+/g," ").trim()||"Aa",a=getComputedStyle(this.firstElementChild??this),r=parseFloat(a.fontSize)||16,n=this.cell>0?Math.max(4,Math.round(r/this.cell)):96,s=this.cell>0?3:16,i=la??(la=document.createElement("canvas")),c=i.getContext("2d",{willReadFrequently:!0}),l=`${a.fontStyle} ${a.fontWeight} ${n}px ${a.fontFamily}`,p=(parseFloat(a.letterSpacing)||0)/r*n,h=()=>{c.font=l,"letterSpacing"in c&&(c.letterSpacing=p+"px")};h();let m=c.measureText(e),f=m.fontBoundingBoxAscent??n*.8,u=m.fontBoundingBoxDescent??n*.2,x=Math.min(2048,Math.ceil(m.width)+2*s),d=n+2*s;i.width=x,i.height=d,h(),c.clearRect(0,0,x,d),c.fillStyle="#fff",c.textBaseline="alphabetic",c.fillText(e,s,s+(n-f-u)/2+f);let b=c.getImageData(0,0,x,d).data,y=new Uint8Array(x*d);for(let k=0;k<x*d;k++)y[k]=b[k*4+3]>=102?1:0;let g=Dr(y,x,d,s);this.field={data:g,width:x,height:d,range:s,version:++this.version}}};W.manifest=Or,W.frag=oa;function Dr(t,o,e,a){let n=o*e,s=new Float32Array(n),i=new Float32Array(n);for(let l=0;l<n;l++)s[l]=t[l]?0:1e20,i[l]=t[l]?1e20:0;for(let l of[s,i])Ur(l,o,e);let c=new Uint8Array(n);for(let l=0;l<n;l++){let p=Math.sqrt(s[l])-Math.sqrt(i[l]);c[l]=Math.max(0,Math.min(255,Math.round(128+p/a*127)))}return c}function Ur(t,o,e){let a=Math.max(o,e),r=new Float32Array(a),n=new Float32Array(a),s=new Int32Array(a),i=new Float32Array(a+1);for(let c=0;c<e;c++){for(let l=0;l<o;l++)r[l]=t[c*o+l];ca(r,n,s,i,o);for(let l=0;l<o;l++)t[c*o+l]=n[l]}for(let c=0;c<o;c++){for(let l=0;l<e;l++)r[l]=t[l*o+c];ca(r,n,s,i,e);for(let l=0;l<e;l++)t[l*o+c]=n[l]}}function ca(t,o,e,a,r){let n=0;e[0]=0,a[0]=-1e20,a[1]=1e20;for(let s=1;s<r;s++){let i=(t[s]+s*s-(t[e[n]]+e[n]*e[n]))/(2*s-2*e[n]);for(;i<=a[n];)n--,i=(t[s]+s*s-(t[e[n]]+e[n]*e[n]))/(2*s-2*e[n]);n++,e[n]=s,a[n]=i,a[n+1]=1e20}n=0;for(let s=0;s<r;s++){for(;a[n+1]<s;)n++;o[s]=(s-e[n])*(s-e[n])+t[e[n]]}}customElements.get("sd-text")||(de(W.prototype,W.observedAttributes),customElements.define("sd-text",W));var ma={name:"orb",tag:"sd-orb",description:"A glassy sphere with a fresnel rim and a soft halo. The simplest object and the reference for the others.",uniforms:[{name:"glow",type:"float",default:.6,min:0,max:1,step:.01,label:"Halo strength"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}]};var fa=`uniform float glow;
uniform float rim;

float map(vec3 p) {
  return length(p) - 0.62;
}

void main() {
  fragColor = sdRender(rim, glow);
}
`;var pa={name:"ring",tag:"sd-ring",description:"A glassy torus, tilted toward the viewer. Spin it, or put it in orbit around something.",uniforms:[{name:"thickness",type:"float",default:.16,min:.05,max:.5,step:.01,label:"Tube thickness"},{name:"tilt",type:"float",default:.55,min:0,max:1,step:.01,label:"Tilt toward the viewer"},{name:"rim",type:"float",default:1,min:0,max:2,step:.01,label:"Fresnel rim"}]};var da=`uniform float thickness;
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
`;var ha={name:"crystal",tag:"sd-crystal",description:"A faceted octahedral gem. Hard edges, flat facets, sharp highlights.",uniforms:[{name:"facets",type:"float",default:2,min:1,max:3,step:1,label:"Facet cuts"},{name:"clarity",type:"float",default:.7,min:0,max:1,step:.01,label:"Clarity"},{name:"stretch",type:"float",default:1.4,min:.6,max:2,step:.01,label:"Vertical stretch"}]};var ua=`uniform float facets;
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
`;var ba={name:"coil",tag:"sd-coil",description:"A helix of glassy tube, like a spring seen from the side.",uniforms:[{name:"turns",type:"float",default:3,min:1,max:6,step:.5,label:"Turns"},{name:"thickness",type:"float",default:.09,min:.03,max:.2,step:.005,label:"Tube thickness"},{name:"radius",type:"float",default:.38,min:.15,max:.6,step:.01,label:"Coil radius"}]};var ga=`uniform float turns;
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
`;var va={name:"blob",tag:"sd-blob",description:"A soft sphere that wobbles like liquid. The most organic object in the set.",uniforms:[{name:"wobble",type:"float",default:.5,min:0,max:1,step:.01,label:"Wobble amount"},{name:"rim",type:"float",default:1.2,min:0,max:2,step:.01,label:"Fresnel rim"}]};var xa=`uniform float wobble;
uniform float rim;

float map(vec3 p) {
  float t = uTime * 1.3;
  float w = sin(p.x * 4.0 + t) * sin(p.y * 3.5 - t * 1.3) * sin(p.z * 4.5 + t * 0.7);
  return length(p) - 0.56 - w * 0.13 * wobble;
}

void main() {
  fragColor = sdRender(rim, 0.45);
}
`;var ya={name:"cube",tag:"sd-cube",description:"A rounded glass cube. Calm and architectural, a good center of gravity.",uniforms:[{name:"radius",type:"float",default:.08,min:0,max:.5,step:.01,label:"Corner radius"},{name:"bevel",type:"float",default:.3,min:0,max:1,step:.01,label:"Edge bevel"}]};var wa=`uniform float radius;
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
`;var Ma={name:"knot",tag:"sd-knot",description:"A glassy torus knot: one tube that winds around a ring and through itself.",uniforms:[{name:"twist",type:"float",default:3,min:1,max:5,step:2,label:"Twists (lobes seen from the front)"},{name:"thickness",type:"float",default:.09,min:.04,max:.15,step:.005,label:"Tube thickness"}]};var Sa=`uniform float twist;
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
`;var ka={name:"prism",tag:"sd-prism",description:"A glass prism with flat faces and crisp edges, from a triangle to an octagon.",uniforms:[{name:"sides",type:"float",default:6,min:3,max:8,step:1,label:"Sides"},{name:"height",type:"float",default:.8,min:.3,max:1.2,step:.01,label:"Height"}]};var Ra=`uniform float sides;
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
`;var Ea={name:"capsule",tag:"sd-capsule",description:"A rounded glass pill lying on a diagonal. Soft and friendly, it reads well small.",uniforms:[{name:"span",type:"float",default:.7,min:0,max:.9,step:.01,label:"Length"},{name:"radius",type:"float",default:.27,min:.12,max:.4,step:.01,label:"Radius"}]};var Ta=`uniform float span;
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
`;var Aa={name:"star",tag:"sd-star",description:"A glass star with beveled edges, like a cut ornament.",uniforms:[{name:"points",type:"float",default:5,min:4,max:8,step:1,label:"Points"},{name:"depth",type:"float",default:.26,min:.1,max:.5,step:.01,label:"Thickness"}]};var Ca=`uniform float points;
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
`;var Fa={name:"shell",tag:"sd-shell",description:"A spiral shell: glass beads that grow along a logarithmic spiral, like a nautilus.",uniforms:[{name:"turns",type:"float",default:2.5,min:1,max:4,step:.25,label:"Turns"},{name:"growth",type:"float",default:.18,min:.1,max:.26,step:.005,label:"Growth per turn"}]};var Pa=`uniform float turns;
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
`;var La={name:"disc",tag:"sd-disc",description:"A glass coin with a beveled edge and a gently domed face, turned to catch the light.",uniforms:[{name:"thickness",type:"float",default:.16,min:.06,max:.4,step:.01,label:"Thickness"},{name:"bevel",type:"float",default:.5,min:0,max:1,step:.01,label:"Edge bevel"}]};var ja=`uniform float thickness;
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
`;customElements.get("sd-scene")||customElements.define("sd-scene",V);C(ma,fa);C(pa,da);C(ha,ua);C(ba,ga);C(va,xa);C(ya,wa);C(Ma,Sa);C(ka,Ra);C(Ea,Ta);C(Aa,Ca);C(Fa,Pa);C(La,ja);customElements.get("sd-universe")||customElements.define("sd-universe",ue);export{Je as PALETTE,j as SdObject,V as SdScene,ue as SdUniverse,C as defineObject,de as reflect,We as registry};
//# sourceMappingURL=solids.js.map
