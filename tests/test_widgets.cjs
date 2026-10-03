/* Widgets read the database, not a downloaded copy of every task (3 Oct 2026).
   Checks the client-side translation: Show presets, column filters and time ranges become
   one filter list for widget_counts / widget_rows / widget_stats; data scope follows the page;
   the builder offers the board's own columns to group and filter by; bodies fill in after the
   card shell. The SQL side was probed live on the Price & TBs board when the migration landed. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[]; w.__rpc=[]; w.__sel={}; w.__rpcData={};
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},_is:{},_in:{},
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;},
 delete(){q._op='delete';return q;}, select(){return q;}, single(){return q;},
 eq(c,v){q._eq[c]=v;return q;}, is(c,v){q._is[c]=v;return q;}, in(c,v){q._in[c]=v;return q;}, order(){return q;}, limit(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq},is:{...q._is},in:{...q._in}});
  let data;
  if(q._op==='insert') data=(Array.isArray(q._p)?q._p:[q._p]).map((x,i)=>({...x,id:'sw'+i}));
  else if(t==='dashboard_widgets') data = window.__sel.widgets||[];
  else data = window.__sel[t]||[];
  return Promise.resolve({data,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 rpc:(fn,args)=>{ window.__rpc.push({fn,args}); const d=window.__rpcData[fn]; return Promise.resolve({data: typeof d==='function'? d(args) : (d||[]), error:null}); },
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',active:true},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Store Operation',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'Price & TBs Promotion',status:'active',color:'#08e'},{id:'p2',workspace_id:'w1',name:'Other',status:'active',color:'#888'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'},{id:'u2',full_name:'Ton W',role:'internal',active:true,avatar_color:'#358'}],
  requestTypes:[], _groups:[{id:'g1',name:'Open tasks',color:'#2273C9'}], _subs:{}, _tasksAll:[], _tasks:[], _viewPid:'p1',
  _fields:[{id:'f1',label:'Brand',ftype:'brand'},{id:'f2',label:'Platform',ftype:'select'},{id:'f3',label:'Start Date',ftype:'date'},{id:'f4',label:'Attachments',ftype:'link'}]});
 const pause=()=>new Promise(x=>setTimeout(x,40));
 window.__rpcData.widget_stats=[{total:10,open:6,overdue:2,due7:1,done:4,done7:1,new7:3,on_time_pct:75,median_days:2.5}];
 window.__rpcData.widget_counts=(a)=> a.p_group==='status'? [{key:'todo',label:'todo',n:4},{key:'done',label:'done',n:4},{key:'in_progress',label:'in_progress',n:2}]
   : a.p_group==='col:Platform'? [{key:'Shopee',label:'Shopee',n:7},{key:'Lazada',label:'Lazada',n:4},{key:null,label:null,n:1}]
   : a.p_group==='assignee'? [{key:'u2',label:'Ton W',n:5},{key:null,label:null,n:1}] : [];
 window.__rpcData.widget_rows=[{id:'t1',project_id:'p1',title:'NDG price Oct',status:'todo',priority:'urgent',assignee_id:'u2',due_date:'2026-09-01'}];
 window.__rpcData.widget_values=[{v:'Shopee',n:7},{v:'Lazada',n:4}];
 document.getElementById('content').innerHTML='<div id="board-body"></div>';

 // A. filter translation: presets, column filters, time range, bar/donut defaults
 const F=(cfg,t)=>JSON.stringify(wFilters(cfg,t));
 r.open = F({show:'open'},'stat');
 r.overdue = F({show:'overdue'},'list');
 r.done7 = F({show:'done7'},'stat'); r.new7 = F({show:'new7'},'stat');
 r.barDefault = F({groupBy:'col:Brand'},'bar');       // open only
 r.barStatus = F({groupBy:'status'},'donut');          // all
 r.colFilter = F({show:'all', filters:[{f:'col:Brand',op:'eq',v:'Nestlé'},{f:'col:Platform',op:'empty'},{f:'status',op:'eq',v:''}]},'stat');
 r.range7 = F({show:'all', range:{f:'completed',preset:'7d'}},'stat');
 r.rangeCustom = F({show:'all', range:{f:'created',preset:'custom',from:'2026-09-01',to:'2026-09-30'}},'stat');
 r.rangeAny = F({show:'all', range:{f:'created',preset:'any'}},'stat');

 // B. board report: stats + widgets come from RPCs scoped to the board; no tasks table download
 window.__sel.widgets=[
  {id:'w1',project_id:'p1',wtype:'bar',title:'Open by platform',config:{entity:'tasks',groupBy:'col:Platform'},position:0},
  {id:'w2',project_id:'p1',wtype:'stat',title:'Overdue',config:{entity:'tasks',show:'overdue'},position:1},
  {id:'w3',project_id:'p1',wtype:'list',title:'Due soon',config:{entity:'tasks',show:'due7'},position:2},
  {id:'w4',project_id:'p1',wtype:'progress',title:'Progress',config:{entity:'tasks'},position:3}];
 await renderBoardReport('p1'); await pause();
 r.statsCall = window.__rpc.find(c=>c.fn==='widget_stats');
 r.statsScoped = r.statsCall && r.statsCall.args.p_project==='p1' && r.statsCall.args.p_workspace===null;
 r.noTaskDownload = !window.__calls.some(c=>c.table==='tasks');
 r.openTile = document.querySelector('.stat .n').textContent;                       // 6
 r.medianShown = /2\\.5/.test(document.querySelector('.stat-row').textContent);
 r.cards = document.querySelectorAll('.widget-card').length;                          // 4
 const barCall = window.__rpc.find(c=>c.fn==='widget_counts' && c.args.p_group==='col:Platform');
 r.barScoped = barCall && barCall.args.p_project==='p1';
 r.barOpenOnly = barCall && JSON.stringify(barCall.args.p_filters)===JSON.stringify([{f:'status',op:'neq',v:'done'}]);
 r.barBody = document.getElementById('wb-w1').textContent;                           // Shopee 7, Lazada 4, Not set 1
 r.statBody = document.getElementById('wb-w2').textContent.trim();                   // 10 tasks (sum of counts)
 r.listBody = document.getElementById('wb-w3').textContent;                          // NDG price Oct
 const listCall = window.__rpc.find(c=>c.fn==='widget_rows');
 r.listArgs = listCall && listCall.args.p_limit===6 && JSON.stringify(listCall.args.p_filters)===JSON.stringify(W_SHOW_FILTERS.due7);
 r.progressBody = document.getElementById('wb-w4').textContent;                      // 40% · 4 of 10
 r.subtitle = document.querySelector('.widget-card[data-wid=w2] .w-sub')?.textContent;  // Overdue

 // C. the builder offers the board's columns to group by (not dates/links) and to filter on
 widgetModal(null,null,'p1'); await pause();
 const groupOpts=[...document.querySelectorAll('#wm-group option')].map(o=>o.value);
 r.groupHasBrand = groupOpts.includes('col:Brand') && groupOpts.includes('col:Platform');
 r.groupNoDateOrLink = !groupOpts.includes('col:Start Date') && !groupOpts.includes('col:Attachments');
 r.groupHasGroup = groupOpts.includes('group') && !groupOpts.includes('workspace');
 wmAddFilter(); await pause();
 const fOpts=[...document.querySelectorAll('.wm-frow select:first-child option')].map(o=>o.value);
 r.filterHasCols = fOpts.includes('col:Brand') && fOpts.includes('col:Start Date') && fOpts.includes('status') && fOpts.includes('group');
 wmSetF(0,'f','col:Platform'); await pause();
 r.valuesAsked = window.__rpc.some(c=>c.fn==='widget_values' && c.args.p_field==='col:Platform' && c.args.p_project==='p1');
 r.datalist = document.querySelectorAll('#wm-vals-0 option').length;                 // 2
 wmSetF(0,'v','Shopee');
 document.querySelector('#wm-group').value='col:Brand';
 document.querySelector('#wm-title').value='';
 window.__calls.length=0;
 document.querySelector('#wm-save').click(); await pause();
 const ins=window.__calls.find(c=>c.table==='dashboard_widgets'&&c.op==='insert');
 r.savedConfig = ins && JSON.stringify(ins.payload.config);
 r.savedTitle = ins && ins.payload.title;                                            // Tasks by Brand
 r.savedProj = ins && ins.payload.project_id==='p1';
 closeModals();

 // D. workspace report scopes to the workspace; personal dashboard with a dropdown too
 window.__rpc.length=0; window.__sel.widgets=[];
 await renderWorkspaceReport('w1'); await pause();
 const ws=window.__rpc.find(c=>c.fn==='widget_stats');
 r.wsScoped = ws && ws.args.p_workspace==='w1' && ws.args.p_project===null;
 window.__rpc.length=0; dashWs='w1';
 await renderDashboard(); await pause();
 const d=window.__rpc.find(c=>c.fn==='widget_stats');
 r.dashScoped = d && d.args.p_workspace==='w1' && widgetScope===null;
 r.overdueTable = window.__rpc.some(c=>c.fn==='widget_rows' && c.args.p_limit===50);
 dashWs='all';
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{
 const r=await w.eval('window.__run()'); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r).slice(0,900))); if(!c) ok=false; };
 check('no error', !r.error);
 check('Open preset = status != done', r.open==='[{"f":"status","op":"neq","v":"done"}]');
 check('Overdue preset = open + due < today', r.overdue==='[{"f":"status","op":"neq","v":"done"},{"f":"due","op":"lt","v":"today"}]');
 check('Done/New this week are relative dates', /today-7/.test(r.done7) && /"f":"completed"/.test(r.done7) && /"f":"created"/.test(r.new7));
 check('bar on a column counts open tasks by default', r.barDefault==='[{"f":"status","op":"neq","v":"done"}]');
 check('status chart counts everything by default', r.barStatus==='[]');
 check('column filters pass through; empty values dropped', r.colFilter==='[{"f":"col:Brand","op":"eq","v":"Nestlé"},{"f":"col:Platform","op":"empty"}]');
 check('time range: last 7 days is relative', r.range7==='[{"f":"completed","op":"gte","v":"today-7"}]');
 check('time range: custom dates are fixed', r.rangeCustom==='[{"f":"created","op":"gte","v":"2026-09-01"},{"f":"created","op":"lte","v":"2026-09-30"}]');
 check('time range: any time adds nothing', r.rangeAny==='[]');
 check('board report asks widget_stats for the board', r.statsScoped===true);
 check('board report never downloads the tasks table', r.noTaskDownload===true);
 check('stat tiles come from the RPC', r.openTile==='6' && r.medianShown===true);
 check('all four cards drawn', r.cards===4);
 check('bar by column is scoped to the board, open only', r.barScoped===true && r.barOpenOnly===true);
 check('bar body lists values + Not set', /Shopee/.test(r.barBody) && /Lazada/.test(r.barBody) && /Not set/.test(r.barBody));
 check('number widget sums the counts', /^10/.test(r.statBody));
 check('list asks widget_rows with the preset, 6 rows', r.listArgs===true && /NDG price Oct/.test(r.listBody));
 check('progress = done / total from counts', /40%/.test(r.progressBody) && /4 of 10/.test(r.progressBody));
 check('card subtitle says what it narrows by', r.subtitle==='Overdue');
 check('group-by offers Brand and Platform columns', r.groupHasBrand===true);
 check('group-by skips date and link columns', r.groupNoDateOrLink===true);
 check('board scope offers Group, not Workspace', r.groupHasGroup===true);
 check('filter field list has columns incl. dates + fixed fields', r.filterHasCols===true);
 check('column filter asks widget_values for the picker', r.valuesAsked===true && r.datalist===2);
 check('saved config carries groupBy + filters', r.savedConfig==='{"entity":"tasks","groupBy":"col:Brand","filters":[{"f":"col:Platform","op":"eq","v":"Shopee"}]}');
 check('auto title names the column', r.savedTitle==='Tasks by Brand' && r.savedProj===true);
 check('workspace report scopes stats to the workspace', r.wsScoped===true);
 check('personal dashboard scopes data by dropdown, keeps own widgets', r.dashScoped===true);
 check('dashboard overdue table comes from widget_rows (50)', r.overdueTable===true);
 console.log(ok? 'widgets: all checks passed' : 'widgets: FAILED');
 process.exit(ok?0:1);
})();
