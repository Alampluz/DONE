/* Big boards (the CS inquiry board has 3,000+ rows): a group renders its first
   TV_CHUNK rows plus a "show more" line; small groups render whole; "show more"
   grows the group and "show all" opens it; the view resets when the board changes;
   dependencies are fetched through the board, not a 3,000-id URL. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 const PID='p1';
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'}, profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#000'}],
   projects:[{id:PID,name:'CS',workspace_id:'w',edit_preset:'everything',status:'active'}], workspaces:[{id:'w',name:'CS'}], brandsList:[], _deps:[], _subs:{}});
 const groups=[{id:'g-big',name:'Solved',color:'#12915E',position:0},{id:'g-small',name:'Open',color:'#2273C9',position:1}];
 const T=(i,g)=>({id:'t'+i, project_id:PID, title:'Task '+i, status:'todo', priority:'normal', group_id:g, position:i, custom:{}, due_date:null, archived_at:null});
 const tasks=[]; for(let i=0;i<1000;i++) tasks.push(T(i,'g-big')); for(let i=1000;i<1120;i++) tasks.push(T(i,'g-small'));
 Object.assign(S,{_tasksAll:tasks,_tasks:tasks,_fields:[],_groups:groups});
 boardMode='table'; tvResetShown();
 const host=document.createElement('div'); host.id='board-body'; document.body.appendChild(host);
 const count=(gid)=>host.querySelectorAll('#tvg-'+gid+' tr.tv-row').length;
 const more=(gid)=>host.querySelector('#tvg-'+gid+' tr.tv-more');
 renderProjectTableView(PID, tasks, host);
 r.bigShown=count('g-big'); r.bigMore=!!more('g-big'); r.bigMoreText=more('g-big')&&more('g-big').textContent.replace(/\\s+/g,' ');
 r.smallShown=count('g-small'); r.smallMore=!!more('g-small');
 r.headerCount=(host.querySelector('#tvg-g-big .cnt')||{}).textContent;   // header still counts everything
 tvShowMore('g-big',200); r.after200=count('g-big'); r.moreStill=!!more('g-big');
 tvShowMore('g-big',Infinity); r.afterAll=count('g-big'); r.moreGone=!more('g-big');
 tvResetShown(); renderProjectTableView(PID, tasks, host); r.afterReset=count('g-big');
 r.depsByBoard=/task_deps'\\)\\.select\\('task_id,depends_on,tasks!task_deps_task_id_fkey!inner\\(project_id\\)'\\)\\.eq\\('tasks\\.project_id', id\\)/.test(renderProject.toString());
 r.noIdList=!/task_deps'\\)\\.select\\('\\*'\\)\\.in\\('task_id'/.test(renderProject.toString());
 r.resetsOnBoardChange=/tvResetShown\\(\\)/.test(renderProject.toString());
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
const r=JSON.parse(w.eval('window.__run()')); let ok=true;
const check=(name,cond)=>{ console.log((cond?'PASS':'FAIL')+' '+name+(cond?'':' -> '+JSON.stringify(r))); if(!cond) ok=false; };
check('big group shows the first 100 rows', r.bigShown===100);
check('big group has a show-more line naming the totals', r.bigMore && /Show 200 more/.test(r.bigMoreText) && /Show all 1,000/.test(r.bigMoreText) && /100 of 1,000 shown/.test(r.bigMoreText));
check('small group (120) renders whole, no show-more', r.smallShown===120 && !r.smallMore);
check('group header still counts every row', /1000 tasks/.test(r.headerCount||''));
check('show 200 more -> 300 rows, line stays', r.after200===300 && r.moreStill);
check('show all -> 1,000 rows, line gone', r.afterAll===1000 && r.moreGone);
check('reset collapses back to 100', r.afterReset===100);
check('deps fetched through the board join', r.depsByBoard && r.noIdList);
check('board change resets the shown counts', r.resetsOnBoardChange);
if(!ok) process.exit(1);
