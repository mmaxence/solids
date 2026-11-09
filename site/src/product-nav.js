// Shared family navigation: no dependencies, keyboard/touch support, no tracking.
class ProductNavigation extends HTMLElement {
 connectedCallback(){
  if(this.shadowRoot)return;
  const current=this.getAttribute('current');
  const products=[
   {id:'solids',name:'Solids',tag:'Interactive 3D',text:'Lightweight, responsive forms for the expressive web.'},
   {id:'materia',name:'Materia',tag:'Living typography',text:'Text with depth, texture, and motion. Compose your own character.'},
   {id:'prisma',name:'Prisma',tag:'Media in motion',text:'Layer cinematic motion and tactile effects on images and video.'}
  ];
  const root=this.attachShadow({mode:'open'});
  root.innerHTML=`<style>
:host{display:inline-flex;color:inherit;font:11px 'DM Sans',system-ui,sans-serif}*{box-sizing:border-box}.products{display:flex;gap:20px;align-items:center}.product{position:relative;display:flex;align-items:center;gap:4px}.product-link{padding:10px 0;white-space:nowrap;color:inherit;text-decoration:none}.product-link:hover{text-decoration:underline;text-underline-offset:4px}.preview-toggle{padding:4px;border:0;background:none;color:inherit;font:inherit;font-size:12px;cursor:pointer;opacity:.6}.preview-toggle:hover{opacity:1}[hidden]{display:none!important}button:focus-visible,a:focus-visible{outline:2px solid #9fc9ff;outline-offset:4px}.card{position:absolute;top:100%;right:-20px;width:270px;padding:12px;background:#111b28;border:1px solid #39495d;box-shadow:0 18px 50px #0006;color:#e1e9f2;z-index:1000;text-decoration:none;display:block}.visual{height:120px;display:grid;place-items:center;background:#080c12;overflow:hidden;margin-bottom:16px;position:relative}.visual.solids:before{content:'';width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#e7f3ff,#81ade6 25%,#344765 60%,#101824 78%);box-shadow:12px 15px 28px #0008,inset -4px -6px 10px #020711}.visual.materia{font-size:30px;font-weight:600;letter-spacing:-2px;color:#e6efff;text-shadow:2px 2px #557ca5,4px 4px #294663;perspective:500px}.visual.materia span{transform:rotateY(-16deg) rotateZ(-4deg)}.visual.prisma{background:#080c12 url(https://mmaxence.github.io/prisma/demo/assets/hero-orbit.jpg) center/cover;isolation:isolate}.visual.prisma:before{content:none;position:absolute;inset:0;background:repeating-linear-gradient(90deg,#ffffff25 0 2px,transparent 2px 22px);backdrop-filter:blur(2px)}.visual.prisma:after{content:none;position:absolute;width:150px;height:90px;background:#162e3b;clip-path:polygon(0 100%,35% 15%,55% 50%,75% 0,100% 100%);bottom:0}.tag{display:block;font-size:15px;font-weight:500;margin:0 5px 6px}.description{display:block;font-size:12px;line-height:1.6;color:#a5b3c5;margin:0 5px 10px}.visit{display:block;border-top:1px solid #2b3a4d;padding:10px 5px 0;color:#b5d5ff;font-size:11px}@media(max-width:680px){.products{gap:12px}.card{position:fixed;top:var(--menu-top,125px);left:5vw;right:5vw;width:auto;max-width:360px}.visual{height:100px}}
</style><nav class="products" aria-label="Other products">${products.filter(p=>p.id!==current).map(p=>`<div class="product"><a class="product-link" href="https://mmaxence.github.io/${p.id}/">${p.name}</a><button class="preview-toggle" aria-label="Preview ${p.name}" aria-expanded="false" aria-controls="preview-${p.id}">+</button><a id="preview-${p.id}" class="card" hidden href="https://mmaxence.github.io/${p.id}/"><div class="visual ${p.id}" aria-hidden="true">${p.id==='materia'?'<span>Beyond static.</span>':''}</div><span class="tag">${p.tag}</span><span class="description">${p.text}</span><span class="visit">Explore ${p.name}</span></a></div>`).join('')}</nav>`;
  const items=[...root.querySelectorAll('.product')];
  function setOpen(item,show){
   item.querySelector('.card').hidden=!show;
   item.querySelector('button').setAttribute('aria-expanded',String(show));
   if(show){item.style.setProperty('--menu-top',`${item.getBoundingClientRect().bottom+8}px`);for(const other of items)if(other!==item)setOpen(other,false);}
  }
  for(const item of items){
   const link=item.querySelector('.product-link'),card=item.querySelector('.card');
   item.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')setOpen(item,true);});
   item.addEventListener('pointerleave',()=>{if(!item.contains(root.activeElement))setOpen(item,false);});
   link.addEventListener('focus',e=>{if(e.target.matches(':focus-visible'))setOpen(item,true);});
   item.addEventListener('focusout',()=>queueMicrotask(()=>{if(!item.contains(root.activeElement))setOpen(item,false);}));
   item.querySelector('button').addEventListener('click',()=>setOpen(item,card.hidden));
   link.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(item,true);card.focus();}});
   item.addEventListener('keydown',e=>{if(e.key==='Escape'){link.focus();setOpen(item,false);e.stopPropagation();}});
  }
 }
}
if(!customElements.get('product-navigation'))customElements.define('product-navigation',ProductNavigation);
