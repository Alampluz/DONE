const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};window.supabase={createClient:()=>({from:()=>({}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 S.projects=[{id:'p1',name:'B',status:'active',workspace_id:'w',field_config:{item_card:{tabs:['files'],tabOrder:['comments','details','bogus'],tabNames:{details:'  Overview ',comments:'Chat',x:'no'}}}}];
 const cfg=icConfig('p1',[{id:'f1',label:'A',ftype:'text'}]);
 r.order=cfg.tabOrder; r.names=cfg.tabNames;
 const defs=icTabDefs(cfg,k=>['fields','details','files','comments','activity'].includes(k));
 r.defs=defs.map(d=>d.join(':'));
 S.projects[0].field_config={};
 const d2=icTabDefs(icConfig('p1',[]),k=>['details','comments','activity'].includes(k));
 r.defaults=d2.map(d=>d.join(':'));
}catch(e){r.error=e.message;}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{const r=await w.eval('window.__run()');console.log(JSON.stringify(r));
 const ok=!r.error&&r.order.join()==='comments,details'&&r.names.details==='Overview'&&r.names.comments==='Chat'&&!r.names.x
  &&r.defs.join()==='comments:Chat,details:Overview,fields:Fields,files:Files,activity:Activity'&&r.defaults.join()==='details:Details,comments:Comments,activity:Activity';
 process.exit(ok?0:1);})();
