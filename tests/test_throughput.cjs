/* Report widgets: "Done this week" and "New this week" are pickable and select the right rows. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 const iso=(d)=>new Date(Date.now()-d*86400000).toISOString();
 const tasks=[{id:'a',status:'done',created_at:iso(10),completed_at:iso(1)},{id:'b',status:'done',created_at:iso(30),completed_at:iso(12)},{id:'c',status:'todo',created_at:iso(2)},{id:'d',status:'todo',created_at:iso(20)}];
 Object.assign(S,{me:{id:'me',role:'admin'}, profiles:[], _dashCtx:{tasks, open:tasks.filter(t=>t.status!=='done'), doneTasks:tasks.filter(t=>t.status==='done'), overdue:[], dueWeek:[], requests:[], openReqs:[], slaBreach:[], scopeProjects:[], groups:[]}});
 r.opts=W_SHOWS_TASKS.map(x=>x[0]).join(',');
 r.done7=widgetTaskRows({entity:'tasks',show:'done7'}).map(t=>t.id).join(','); r.new7=widgetTaskRows({entity:'tasks',show:'new7'}).map(t=>t.id).join(',');
 r.reportSrc=renderBoardReport.toString(); return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
const r=JSON.parse(w.eval('window.__run()')); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify({...r,reportSrc:undefined}))); if(!c) ok=false; };
check('widget picker offers Done this week and New this week', /done7/.test(r.opts) && /new7/.test(r.opts));
check('Done this week = completed within 7 days', r.done7==='a');
check('New this week = created within 7 days', r.new7==='c');
check('board report shows done/new this week and median days', /Done this week/.test(r.reportSrc) && /Median days to finish/.test(r.reportSrc) && /medianDays/.test(r.reportSrc));
if(!ok) process.exit(1);
