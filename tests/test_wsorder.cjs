/* Workspaces are shown A→Z everywhere: refreshCore() sorts them case-insensitively regardless of
   the stored position, and the sidebar and the automation scope picker follow that order. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__sel={};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={select(){return q;},eq(){return q;},is(){return q;},in(){return q;},order(){return q;},limit(){return q;},single(){return q;},
 then(r,j){return Promise.resolve({data:window.__sel[t]||[],error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 window.__sel.workspaces=[{id:'w1',name:'Store Operation',position:1,color:'#0F766E'},{id:'w2',name:'creative',position:2,color:'#333'},{id:'w3',name:'Customer Service',position:3,color:'#358'},{id:'w4',name:'Business Development',position:4,color:'#369'},{id:'w5',name:'Warehouse',position:5,color:'#963'}];
 window.__sel.profiles=[{id:'me',full_name:'April',role:'admin',active:true,company_id:'c'}];
 S.me={id:'me',role:'admin',full_name:'April',company_id:'c'}; S.route={view:'home'};
 await refreshCore();
 r.sorted = S.workspaces.map(x=>x.name).join('|');
 renderSidebar();
 r.sidebar = [...document.querySelectorAll('#nav-ws .ws-name')].map(e=>e.textContent.trim()).join('|');
 S.projects=[]; S.profiles=[{id:'me',full_name:'April',role:'admin',active:true}];
 caModal(); pickOpen('ca-scope');
 r.picker = [...document.querySelectorAll('#pickmenu .pick-opt')].map(o=>o.textContent.trim()).filter(t=>t!=='Everywhere').join('|');
 closeModals();
}catch(e){r.error=e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 const want='Business Development|creative|Customer Service|Store Operation|Warehouse';
 check('no runtime error', !r.error);
 check('refreshCore sorts workspaces A→Z, case-insensitive, ignoring position', r.sorted===want);
 check('sidebar lists them in that order', r.sidebar===want);
 check('automation scope picker lists them in that order', r.picker===want);
 if(!ok) process.exit(1); });
