// Living Things family navigation. IDs and destinations preserve existing links.
const products=[
 {id:'materia',name:'Type',description:'Interactive typography',legacy:'Materia'},
 {id:'prisma',name:'Frame',description:'Image and video effects',legacy:'Prisma'},
 {id:'solids',name:'Object',description:'Lightweight 3D objects',legacy:'Solids'},
 {id:'strata',name:'Space',description:'Spatial HTML interfaces',legacy:'Strata'}
];
class ProductNavigation extends HTMLElement{
 connectedCallback(){
  if(this.shadowRoot)return;
  const root=this.attachShadow({mode:'open'}),current=this.getAttribute('current');
  root.innerHTML=`<style>
  :host{display:inline-flex;position:relative;font:12px/1.4 system-ui,sans-serif;color:inherit}*{box-sizing:border-box}summary{cursor:pointer;list-style:none;padding:8px 0;white-space:nowrap}summary::-webkit-details-marker{display:none}summary::after{content:'+';margin-left:8px}details[open] summary::after{content:'−'}nav{position:absolute;right:0;top:100%;z-index:1200;width:260px;border:1px solid #ffffff25;border-radius:14px;padding:16px;background:#151a1f;color:#f1f4f1;box-shadow:0 18px 50px #0005}p{font-size:10px;color:#a8b6b0;margin:0 0 10px;letter-spacing:.08em}a{display:block;color:inherit;text-decoration:none;padding:10px;border-radius:7px}a:hover,a:focus-visible{background:#ffffff0d}a[aria-current=page]{background:#ffffff12}strong{font-size:14px;font-weight:500}small{display:block;color:#a8b6b0;margin-top:3px}summary:focus-visible,a:focus-visible{outline:2px solid #b9d8c2;outline-offset:3px}@media(max-width:420px){nav{position:fixed;left:16px;right:16px;top:var(--living-menu-top,100px);width:auto}}
  </style><details><summary>Living Things</summary><nav aria-label="Living Things libraries"><p>LIBRARIES FOR A LIVING WEB</p>${products.map(p=>`<a href="https://mmaxence.github.io/${p.id}/" ${p.id===current?'aria-current="page"':''} title="Living ${p.name}, formerly ${p.legacy}"><strong>Living ${p.name}</strong><small>${p.description}</small></a>`).join('')}</nav></details>`;
  const details=root.querySelector('details'),summary=root.querySelector('summary');
  details.addEventListener('toggle',()=>{if(details.open)this.style.setProperty('--living-menu-top',`${Math.min(this.getBoundingClientRect().bottom+10,innerHeight-290)}px`)});
  this.outside=e=>{if(!e.composedPath().includes(this))details.open=false};
  this.escape=e=>{if(e.key==='Escape'&&details.open){details.open=false;summary.focus()}};
  document.addEventListener('pointerdown',this.outside);document.addEventListener('keydown',this.escape);
 }
 disconnectedCallback(){document.removeEventListener('pointerdown',this.outside);document.removeEventListener('keydown',this.escape)}
}
if(!customElements.get('product-navigation'))customElements.define('product-navigation',ProductNavigation);
