const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};window.supabase={createClient:()=>({from:()=>({}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'}],
  _fields:[{id:'fb',project_id:'p1',label:'Brand',ftype:'brand'},{id:'fn',project_id:'p1',label:'Number of SKUs',ftype:'number'}],_subs:{},_groups:[]});
 const t={id:'t1',project_id:'p1',title:'Update SKU',status:'todo',priority:'high',due_date:'2026-10-15',ticket_no:'BD-1',assignee_id:'me',custom:{fb:'Aestura',fn:47},tags:[]};
 try{localStorage.removeItem('workos.cardfields.p1');}catch(e){}
 const d=document.createElement('div'); d.innerHTML=taskCard(t);
 r.defaultHasFields = d.querySelectorAll('.kb-fld').length;            // 2: the board's custom columns show by default
 r.defaultHasTag = !!d.querySelector('.tkt');
 kbFieldsSave('p1',['f:fn','f:fb','priority']);
 const e=document.createElement('div'); e.innerHTML=taskCard(t);
 r.rows=[...e.querySelectorAll('.kb-fld')].map(x=>x.textContent);       // SKUs first, then Brand
 r.noTag = !e.querySelector('.tkt'); r.noDue = !e.querySelector('.due'); r.hasPrio = !!e.querySelector('.meta');
 S.route={view:'project',id:'p1'};
 document.getElementById('content').innerHTML='<div id="x"></div>';
 kbFieldsModal('p1');
 r.modalRows=document.querySelectorAll('.kbf-row').length;
 r.modalFirstOn=[...document.querySelectorAll('.kbf-row input')].slice(0,3).map(i=>i.checked);
 kbFieldsSave('p1',null); r.reset=kbFieldsLoad('p1')===null;
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\\\n').slice(0,3).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{const r=await w.eval('window.__run()');console.log(JSON.stringify(r));
 const ok=!r.error&&r.defaultHasFields===2&&r.defaultHasTag&&r.rows.length===2&&/47/.test(r.rows[0])&&/Aestura/.test(r.rows[1])&&r.noTag&&r.noDue&&r.hasPrio&&r.modalRows===9&&r.reset;
 process.exit(ok?0:1);})();
