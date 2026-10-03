const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[]; w.__sel={};
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},_is:{},
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;},
 delete(){q._op='delete';return q;}, select(){return q;}, single(){return q;},
 eq(c,v){q._eq[c]=v;return q;}, is(c,v){q._is[c]=v;return q;}, in(){return q;}, order(){return q;}, limit(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq},is:{...q._is}});
  let data;
  if(q._op==='insert') data = (Array.isArray(q._p)? q._p : [q._p]).map((x,i)=>({...x,id:'seed'+i}));
  else if(t==='dashboard_widgets') data = (q._eq.workspace_id ? (window.__sel.wsWidgets||[]) : (window.__sel.myWidgets||[]));
  else data = window.__sel[t]||[];
  return Promise.resolve({data,count:0,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 rpc:(fn,args)=>{ (window.__rpc=window.__rpc||[]).push({fn,args}); const d=(window.__rpcData||{})[fn]; return Promise.resolve({data: typeof d==='function'? d(args) : (d||[]), error:null}); },
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'ws',id:'w1',tab:'report'},company:{name:'CREA'},
  workspaces:[{id:'w1',name:'Creative Team',color:'#7D3C55',description:'Design'},
              {id:'w2',name:'Tech Team',color:'#6E56B8',description:''}],
  projects:[{id:'p1',workspace_id:'w1',name:'Creative Queue',status:'active',color:'#08e'},
            {id:'p9',workspace_id:'w2',name:'Infra',status:'active',color:'#666'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,email:'a@a',avatar_color:'#0F766E'},
            {id:'u2',full_name:'Prim V',role:'management',active:true,email:'p@a',avatar_color:'#3E5C95'}],
  requestTypes:[{id:'rt1',name:'Creative',default_workspace_id:'w1'}]});
 window.__sel['tasks']=[
  {id:'t1',project_id:'p1',title:'Banner',status:'todo',priority:'urgent',assignee_id:'me',due_date:'2020-01-01',created_at:'2026-08-01'},
  {id:'t2',project_id:'p1',title:'Copy',status:'done',priority:'normal',assignee_id:'u2',due_date:null,completed_at:'2026-08-02',created_at:'2026-08-01'},
  {id:'t9',project_id:'p9',title:'Server',status:'todo',priority:'low',assignee_id:'u2',due_date:null,created_at:'2026-08-01'}];
 window.__sel['requests']=[{id:'r1',ticket_no:'WO-1',title:'Req',status:'submitted',request_type_id:'rt1',sla_due_at:'2020-01-01',created_at:'2026-08-01'}];
 window.__sel['approvals']=[{id:'a1',status:'pending',request_id:'r1'}];
 window.__rpcData={widget_stats:(a)=>[{total:a.p_workspace?2:3, open:a.p_workspace?1:2, overdue:1, due7:0, done:1, done7:0, new7:0, on_time_pct:100, median_days:null}], widget_counts:[{key:'todo',label:'todo',n:1},{key:'done',label:'done',n:1}], widget_rows:[]};
 window.__rpc=[];

 // A. report scopes data to the workspace (t9 belongs to Tech Team and must not count)
 window.__sel.wsWidgets=[{id:'wg1',workspace_id:'w1',wtype:'donut',title:'Tasks by status',config:{entity:'tasks',groupBy:'status'},position:0}];
 await renderWorkspaceReport('w1');
 r.scopedStats = window.__rpc.find(c=>c.fn==='widget_stats'); r.scopedToWs = r.scopedStats && r.scopedStats.args.p_workspace==='w1';
 r.scopedProjects  = S._dashCtx.scopeProjects.map(p=>p.id);   // [p1]
 r.widgetScope = widgetScope;
 r.hasTabs = [...document.querySelectorAll('.tabs .tab')].map(t=>t.textContent.trim());
 r.activeTab = document.querySelector('.tabs .tab.active')?.textContent.trim();
 r.heading = document.querySelector('.page-head h1').textContent;
 r.widgetsShown = document.querySelectorAll('.widget-card').length;
 r.hasAddBtn = /Add widget/.test(document.querySelector('.section-title').textContent);
 r.statTiles = document.querySelectorAll('.stat').length;
 r.openTasks = document.querySelector('.stat .n').textContent;  // 1 open in w1
 r.canEditWidgets = widgetsEditable();

 // B. the report query asks for this workspace's widgets, not the personal set
 const q = window.__calls.filter(c=>c.table==='dashboard_widgets' && c.op==='select').pop();
 r.queriedWorkspace = q && q.eq.workspace_id;

 // C. adding a widget from the report stamps workspace_id
 window.__calls.length=0;
 widgetModal(null,'w1');
 document.querySelector('#wm-title').value='Brand mix';
 document.querySelector('#wm-save').click();
 await new Promise(x=>setTimeout(x,60));
 const ins = window.__calls.find(c=>c.table==='dashboard_widgets'&&c.op==='insert');
 r.insertedScope = ins? ins.payload.workspace_id : null;
 r.insertedTitle = ins? ins.payload.title : null;
 closeModals();

 // D. a requester sees the report but no edit affordances
 S.me.role='requester';
 await renderWorkspaceReport('w1');
 r.requesterSeesWidgets = document.querySelectorAll('.widget-card').length;
 r.requesterHasAdd = /Add widget/.test(document.querySelector('.section-title').textContent);
 r.requesterHasEditLinks = document.querySelectorAll('.w-actions').length;
 r.requesterEditable = widgetsEditable();
 S.me.role='admin';

 // E. personal dashboard still asks for its own widgets and clears the scope
 window.__sel.myWidgets=[{id:'mw1',wtype:'bar',title:'Mine',config:{entity:'tasks',groupBy:'status'},position:0}];
 window.__calls.length=0;
 dashWs='all';
 await renderDashboard();
 r.dashScope = widgetScope;
 const dq = window.__calls.filter(c=>c.table==='dashboard_widgets'&&c.op==='select').pop();
 r.dashQueriedUser = dq && dq.eq.user_id;
 r.dashQueriedNullWs = dq && ('workspace_id' in dq.is);
 r.dashStats = window.__rpc.filter(c=>c.fn==='widget_stats').pop(); r.dashUnscoped = r.dashStats && r.dashStats.args.p_workspace===null;

 // F. boards tab renders tabs too
 await renderWorkspace('w1');
 r.boardsTabActive = document.querySelector('.tabs .tab.active')?.textContent.trim();
 r.boardsScopeCleared = widgetScope;
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);}
(async()=>{ const r=await w.eval('window.__run()'); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r).slice(0,700))); if(!c) ok=false; };
 check('no error', !r.error);
 check('report stats scoped to the workspace', r.scopedToWs===true && String(r.scopedProjects)==='p1');
 check('report tabs + heading', r.activeTab==='Report' && /Creative Team/.test(r.heading));
 check('widgets drawn, Add widget for editors', r.widgetsShown===1 && r.hasAddBtn===true && r.canEditWidgets===true);
 check('stat tiles from RPC', r.statTiles===7 && r.openTasks==='1');
 check('asks for the workspace widget set', r.queriedWorkspace==='w1');
 check('new widget stamped with workspace_id', r.insertedScope==='w1' && r.insertedTitle==='Brand mix');
 check('requester: sees, cannot edit', r.requesterSeesWidgets===1 && r.requesterHasAdd===false && r.requesterHasEditLinks===0 && r.requesterEditable===false);
 check('personal dashboard: own widgets, unscoped stats', r.dashScope===null && r.dashQueriedUser==='me' && r.dashQueriedNullWs===true && r.dashUnscoped===true);
 check('boards tab', r.boardsTabActive==='Boards' && r.boardsScopeCleared===null);
 console.log(ok?'report: all checks passed':'report: FAILED'); process.exit(ok?0:1); })();
