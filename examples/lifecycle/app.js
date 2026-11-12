// Application-owned enhancement policy. The runtime export remains unchanged.
/** @param {string} id */
const need=id=>{const node=document.getElementById(id);if(!node)throw Error('Missing '+id);return node;};
const stage=need('stage'),fallback=need('static'),status=need('status');
const toggle=/** @type {HTMLButtonElement} */(need('enhance'));
const color=/** @type {HTMLSelectElement} */(need('color'));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 640px)');
/** @type {Promise<typeof import('solids')>|undefined} */
let library;
/** @type {{dispose:()=>void,snapshot:()=>{requested:boolean,mounted:boolean,blocked:boolean}}|undefined} */
let app;
export function mountExample(){
 if(app)return app;
 const events=new AbortController();let disposed=false,requested=false,ticket=0;
 /** @type {import('solids').SdScene|null} */
 let scene=null;
 const blocked=()=>reduced.matches||compact.matches;
 const remove=()=>{scene?.remove();scene=null;fallback.hidden=false;};
 const paint=()=>{toggle.disabled=disposed;toggle.textContent=requested?'Use static':'Use 3D';toggle.setAttribute('aria-pressed',String(requested));};
 const sync=async()=>{
  const current=++ticket;paint();
  if(disposed||!requested||blocked()){
   remove();status.textContent=blocked()?'Static illustration for compact view or reduced motion.':'Static illustration. No owned WebGL scene.';return;
  }
  if(scene)return;
  status.textContent='Loading 3D…';
  try{
   // Reuse the import promise; stale completions never append a scene.
   await (library??=import('solids'));
   if(disposed||current!==ticket||!requested||blocked())return;
   const next=document.createElement('sd-scene');next.setAttribute('dpr','1');next.setAttribute('theme','dark');
   const orb=document.createElement('sd-orb');orb.setAttribute('color',color.value);orb.setAttribute('animation','spin');
   const ring=document.createElement('sd-ring');ring.setAttribute('color','#c9b3ff');ring.setAttribute('animation','breathe');
   next.append(orb,ring);scene=next;stage.append(next);
   if(!next.gl||next.hasAttribute('data-fallback')){remove();requested=false;paint();status.textContent='3D unavailable. Static illustration retained; you can retry.';return;}
   fallback.hidden=true;status.textContent='3D enabled. Use static removes this scene and releases its resources.';
  }catch{if(disposed||current!==ticket)return;remove();requested=false;paint();status.textContent='3D could not load. Static illustration retained. Check the module URL and reload.';}
 };
 toggle.addEventListener('click',()=>{requested=!requested;void sync();},{signal:events.signal});
 color.addEventListener('change',()=>scene?.querySelector('sd-orb')?.setAttribute('color',color.value),{signal:events.signal});
 reduced.addEventListener('change',()=>void sync(),{signal:events.signal});
 compact.addEventListener('change',()=>void sync(),{signal:events.signal});
 const dispose=()=>{if(disposed)return;disposed=true;++ticket;events.abort();remove();paint();status.textContent='Example disposed. Static content retained.';app=undefined;};
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:events.signal});
 app={dispose,snapshot:()=>({requested,mounted:!!scene,blocked:blocked()})};void sync();return app;
}
export const snapshotExample=()=>app?.snapshot()??null;
export const disposeExample=()=>app?.dispose();
mountExample();
