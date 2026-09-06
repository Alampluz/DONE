/* New request with no request types: the picker explains and sends admins to the builder
   instead of showing an empty grid; non-admins are told to ask an admin; with types the
   normal grid comes back. (New companies start with zero types since 6 Sep 2026.) */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 const txt=()=>[...document.querySelectorAll('.modal, .modal-body, .modal-head')].map(e=>e.textContent).join(' ').replace(/\\s+/g,' ');
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'Admin'}, profiles:[], requestTypes:[]});
 newRequestFlow();
 r.emptyAdmin=txt(); r.hasButton=!!document.querySelector('.modal-body button.btn-primary'); r.noGrid=!document.querySelector('.rt-grid');
 closeModals();
 S.me={id:'me',role:'internal',full_name:'Staff'}; newRequestFlow(); r.emptyStaff=txt(); r.staffNoButton=!document.querySelector('.modal-body button.btn-primary'); closeModals();
 S.requestTypes=[{id:'rt1',name:'Tech Request',description:'Bugs',sla_hours:48,approval_required:false}]; newRequestFlow();
 r.gridCount=document.querySelectorAll('.rt-grid .rt-pick').length; r.gridText=txt(); closeModals();
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
const r=JSON.parse(w.eval('window.__run()')); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('admin, no types: explains and offers the builder', /No request types yet/.test(r.emptyAdmin) && /Admin → Request types/.test(r.emptyAdmin) && r.hasButton && r.noGrid);
check('staff, no types: told to ask an admin, no button', /ask an admin/i.test(r.emptyStaff) && r.staffNoButton);
check('with a type: the normal picker grid', r.gridCount===1 && /Tech Request/.test(r.gridText) && !/No request types yet/.test(r.gridText));
if(!ok) process.exit(1);
