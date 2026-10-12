const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};window.supabase={createClient:()=>({from:()=>({}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'}],_fields:[],_subs:{},_groups:[],_deps:[],
  projects:[{id:'p1',name:'B',status:'active',workspace_id:'w'}]});
 const mk=n=>({id:'t'+n,project_id:'p1',title:'Task '+n,status:'todo',priority:'normal',custom:{},ticket_no:n===1?'BD-1':''});
 S._tasksAll=[mk(1),mk(2)]; S._tasks=S._tasksAll.slice();
 const th=tvHeadHTML('p1',[],false,'g'); const row=tvRowHTML(S._tasks[0],[],null);
 r.headHas=/>Ticket</.test(th); r.cellHas=/class="tv-ticket"/.test(row) && /BD-1/.test(row);
 r.tagNotInTask = !/tv-open[^>]*>[^<]*<span class="tkt/.test(row);
 S._tasksAll.forEach(t=>t.ticket_no=''); 
 r.headNone=!/>Ticket</.test(tvHeadHTML('p1',[],false,'g')); r.cellNone=!/tv-ticket/.test(tvRowHTML(S._tasks[0],[],null));
}catch(e){r.error=e.message;}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{const r=await w.eval('window.__run()');console.log(JSON.stringify(r));process.exit(!r.error&&r.headHas&&r.cellHas&&r.tagNotInTask&&r.headNone&&r.cellNone?0:1);})();
