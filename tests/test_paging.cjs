/* allRows(): Supabase caps a request at 1,000 rows, so big boards are read in pages.
   Walks a fake builder that serves 2,340 rows, stops on a short page, keeps what it
   had when a later page errors, and the board loader actually goes through it. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 const rows=Array.from({length:2340},(_,i)=>({id:i}));
 const calls=[];
 const fake=(src)=>()=>({range:async(a,b)=>{calls.push([a,b]); return {data:src.slice(a,b+1),error:null};}});
 const all=await allRows(fake(rows));
 r.count=all.data.length; r.pages=calls.length; r.ranges=JSON.stringify(calls); r.lastId=all.data[2339]&&all.data[2339].id; r.noError=all.error===null;
 calls.length=0; const exact=await allRows(fake(rows.slice(0,2000)));
 r.exactCount=exact.data.length; r.exactPages=calls.length;           // 2 full pages + 1 empty probe
 const empty=await allRows(fake([])); r.emptyCount=empty.data.length;
 let n=0; const failing=()=>({range:async(a,b)=>{ n++; return n===1? {data:rows.slice(a,b+1),error:null} : {data:null,error:{message:'boom'}}; }});
 const part=await allRows(failing); r.partialKeeps=part.data.length; r.partialError=part.error&&part.error.message;
 const src=renderProject.toString()+renderWorkspaceCalendar.toString()+renderHome.toString()+buildDashCtx.toString();
 r.boardUsesPaging=/allRows\\(\\(\\)=>db\\.from\\('tasks'\\)/.test(renderProject.toString());
 r.sitesPaged=(src.match(/allRows\\(/g)||[]).length;
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{
  const r=JSON.parse(j); let ok=true;
  const check=(name,cond)=>{ console.log((cond?'PASS':'FAIL')+' '+name); if(!cond) ok=false; };
  check('reads all 2,340 rows', r.count===2340);
  check('three pages of 1,000', r.pages===3 && r.ranges==='[[0,999],[1000,1999],[2000,2999]]');
  check('order preserved to the last row', r.lastId===2339 && r.noError);
  check('exact multiple probes one empty page', r.exactCount===2000 && r.exactPages===3);
  check('empty table -> zero rows', r.emptyCount===0);
  check('page error keeps earlier rows and reports it', r.partialKeeps===1000 && r.partialError==='boom');
  check('board loader goes through allRows', r.boardUsesPaging===true);
  check('home, calendar, board and dashboard all paged (>=5 sites)', r.sitesPaged>=5);
  if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
