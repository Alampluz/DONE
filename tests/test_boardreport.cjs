const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[]; w.__sel={};
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;},
 delete(){q._op='delete';return q;}, select(){return q;}, single(){return q;},
 eq(c,v){q._eq[c]=v;return q;}, is(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}});
  let data;
  if(q._op==='insert') data=(Array.isArray(q._p)?q._p:[q._p]).map((x,i)=>({...x,id:'sw'+i}));
  else if(t==='dashboard_widgets') data = q._eq.project_id? (window.__sel.projWidgets||[]) : [];
  else data = window.__sel[t]||[];
  return Promise.resolve({data,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 rpc:(fn,args)=>{ (window.__rpc=window.__rpc||[]).push({fn,args}); const d=(window.__rpcData||{})[fn]; return Promise.resolve({data: typeof d==='function'? d(args) : (d||[]), error:null}); },
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'CS Team',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'},
            {id:'u2',full_name:'Prim V',role:'management',active:true,avatar_color:'#358'}],
  requestTypes:[],
  _groups:[{id:'g1',name:'Case Open',color:'#2273C9'},{id:'g2',name:'Solved',color:'#12915E'}],
  _fields:[], _subs:{},
  _tasksAll:[
   {id:'t1',project_id:'p1',title:'A',status:'todo',priority:'urgent',assignee_id:'me',group_id:'g1',due_date:'2020-01-01',custom:{},position:1},
   {id:'t2',project_id:'p1',title:'B',status:'done',priority:'normal',assignee_id:'u2',group_id:'g2',completed_at:'2026-08-01',custom:{},position:2},
   {id:'t3',project_id:'p1',title:'C',status:'todo',priority:'normal',assignee_id:'u2',group_id:'g1',custom:{},position:3}]});
 S._tasks=S._tasksAll.slice();
 document.getElementById('content').innerHTML='<div id="board-body"></div>';
 window.__rpcData={widget_stats:[{total:3,open:2,overdue:1,due7:0,done:1,done7:0,new7:0,on_time_pct:100,median_days:null}], widget_counts:(a)=> a.p_group==='group'? [{key:'g1',label:'Case Open',n:2}] : [{key:'todo',label:'todo',n:2},{key:'done',label:'done',n:1}], widget_rows:[]}; window.__rpc=[];

 // A. board report renders scoped stats + seeds 4 widgets incl. group-by-group
 window.__sel.projWidgets=[];
 await renderBoardReport('p1');
 r.projScope = widgetProjScope;
 r.wsScopeCleared = widgetScope===null;
 r.statTiles = document.querySelectorAll('.stat').length;         // 5 (no requests)
 r.openCount = document.querySelector('.stat .n').textContent;    // 2
 const seed = window.__calls.find(c=>c.table==='dashboard_widgets'&&c.op==='insert');
 r.seeded = seed && seed.payload.length===4 && seed.payload.every(x=>x.project_id==='p1' && !x.workspace_id);
 r.groupWidgetSeeded = seed && seed.payload.some(x=>x.config.groupBy==='group');
 r.hasAddBtn = /Add widget/.test(document.querySelector('.section-title').textContent);
 r.widgetsRendered = document.querySelectorAll('.widget-card').length;

 // B. group-by-group chart uses the board's own groups
 const rows = await widgetGroups({entity:'tasks', groupBy:'group'}, 'bar');
 r.groupRows = rows.map(x=>x.label+':'+x.n);                       // Case Open:2
 r.groupCallScoped = window.__rpc.some(c=>c.fn==='widget_counts' && c.args.p_group==='group' && c.args.p_project==='p1');

 // C. adding a widget from the board report stamps project_id, not workspace_id
 window.__calls.length=0; reRenderWidgets=()=>{};
 widgetModal(null,null,'p1');
 r.modalNote = /this board/.test(document.querySelector('.modal-body').textContent);
 document.querySelector('#wm-title').value='Board mix';
 document.querySelector('#wm-save').click();
 await new Promise(x=>setTimeout(x,60));
 const ins = window.__calls.find(c=>c.table==='dashboard_widgets'&&c.op==='insert');
 r.insertProj = ins && ins.payload.project_id==='p1' && ins.payload.workspace_id===null;
 closeModals();

 // D. editors only: requester loses the button and edit affordances
 S.me={id:'u9',role:'requester',full_name:'R'};
 window.__sel.projWidgets=[{id:'x1',project_id:'p1',wtype:'donut',title:'T',config:{entity:'tasks',groupBy:'status'},position:0}];
 await renderBoardReport('p1');
 r.requesterAdd = /Add widget/.test(document.querySelector('.section-title').textContent);  // false
 r.requesterEditLinks = document.querySelectorAll('.w-actions').length;                      // 0
 r.requesterStillSees = document.querySelectorAll('.widget-card').length;                    // 1
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);}
(async()=>{ const r=await w.eval('window.__run()'); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r).slice(0,700))); if(!c) ok=false; };
 check('no error', !r.error);
 check('board report scope set, workspace scope cleared', r.projScope==='p1' && r.wsScopeCleared===true);
 check('stat tiles (no requests → 7 tiles) from RPC', r.statTiles===7 && r.openCount==='2');
 check('seeds 4 board widgets incl. group-by-group', r.seeded===true && r.groupWidgetSeeded===true && r.widgetsRendered===4 && r.hasAddBtn===true);
 check('group chart uses the board groups via RPC', String(r.groupRows)==='Case Open:2' && r.groupCallScoped===true);
 check('new widget stamped with project_id', r.modalNote===true && r.insertProj===true);
 check('requester sees but cannot edit', r.requesterAdd===false && r.requesterEditLinks===0 && r.requesterStillSees===1);
 console.log(ok?'boardreport: all checks passed':'boardreport: FAILED'); process.exit(ok?0:1); })();
