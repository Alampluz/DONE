const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[]; w.__sel={};
w.eval(`
window.scrollTo=()=>{};
window.__failNext=null; window.__rpcData=null;
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},_in:{},_single:false,
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;},
 upsert(p){q._op='upsert';q._p=p;return q;},
 delete(){q._op='delete';return q;}, select(){return q;}, single(){q._single=true;return q;},
 eq(c,v){q._eq[c]=v;return q;}, neq(){return q;}, not(){return q;}, is(){return q;}, or(){return q;},
 lt(){return q;}, gte(){return q;}, lte(){return q;}, in(c,v){q._in[c]=v;return q;}, order(){return q;}, limit(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq},inq:{...q._in},single:q._single});
  if(window.__failNext && window.__failNext.table===t && window.__failNext.op===q._op){
    const msg=window.__failNext.msg; window.__failNext=null;
    return Promise.resolve({data:null,count:0,error:{message:msg}}).then(r,j);}
  let data = window.__sel[t]||[];
  if(q._op==='select'){
    Object.entries(q._eq).forEach(([c,v])=> data=data.filter(x=>x[c]===v));
    Object.entries(q._in).forEach(([c,v])=> data=data.filter(x=>v.includes(x[c])));
  }
  // insert returns the payload rows with generated ids g0,g1,… so callers can map them
  if(q._op==='insert') data=(Array.isArray(q._p)?q._p:[q._p]).map((x,i)=>({id:'g'+i,...x}));
  if(q._op==='update') data = data.filter(x=>x.id===q._eq.id).map(x=>({...x,...q._p}));
  if(q._single) data = Array.isArray(data)? (data[0]||null) : data;
  return Promise.resolve({data,count:0,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},
 rpc:(name,args)=>{window.__calls.push({rpc:name,args:args});return Promise.resolve({data:window.__rpcData,error:null});}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'co1'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'CS',color:'#111'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e',visibility:'collaborate'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true,avatar_color:'#0F766E',email:'april@example.test'},
   {id:'u2',full_name:'Ploy Chan',role:'internal',active:true,avatar_color:'#0984E3',email:'ploy@example.test'},
   {id:'u5',full_name:'Off Duty',role:'internal',active:false,avatar_color:'#999',email:'off@example.test'}],
  _groups:[{id:'ga',project_id:'p1',name:'Active',color:'#0F766E',position:0},
           {id:'gb',project_id:'p1',name:'Won',color:'#2273C9',position:1}],
  _fields:[{id:'f1',project_id:'p1',label:'Notes',ftype:'text',options:[],position:0}],
  _tasks:[], _tasksAll:[
    {id:'t1',project_id:'p1',title:'Brief the client',status:'todo',priority:'high',group_id:'ga',position:1},
    {id:'t2',project_id:'p1',title:'Old campaign',status:'done',priority:'low',group_id:'gb',position:2,archived_at:'2026-08-01'},
    {id:'t3',project_id:'p1',title:'Loose end',status:'in_progress',priority:'normal',group_id:null,position:3}]});
 S._tasks = S._tasksAll.filter(t=>!t.archived_at);
 renderProject=()=>{}; refreshCore=async()=>{}; renderSidebar=()=>{}; navigate=()=>{}; autoRerender=()=>{};

 // A. Save as template: spec from the loaded board, archived excluded, no company_id
 await saveTemplateModal('p1');
 let body=document.querySelector('.modal-body');
 r.tplNameDefault = body.querySelector('#tp-name').value==='CS Inquiries';
 body.querySelector('#tp-name').value='CS starter';
 window.__calls.length=0;
 await document.querySelector('#tp-save').onclick();
 const tins=window.__calls.find(c=>c.table==='board_templates'&&c.op==='insert');
 r.tplInsert = !!tins && tins.payload.name==='CS starter' && !!tins.payload.spec;
 r.tplNoCompanyId = !!tins && !('company_id' in tins.payload);
 const spec = tins? tins.payload.spec : {groups:[],fields:[],tasks:[]};
 r.tplGroups = spec.groups.length===2 && spec.groups[0].name==='Active' && spec.groups[1].color==='#2273C9';
 r.tplFields = spec.fields.length===1 && spec.fields[0].label==='Notes' && spec.fields[0].ftype==='text';
 r.tplArchivedExcluded = spec.tasks.length===2 && !spec.tasks.some(t=>t.title==='Old campaign');
 r.tplGroupIndex = spec.tasks.find(t=>t.title==='Brief the client').group_index===0
   && spec.tasks.find(t=>t.title==='Loose end').group_index===null;
 closeModals();

 // B. Create from template: groups first (ids captured in order), then fields, then tasks
 window.__sel.board_templates=[{id:'tp1',name:'CS starter',spec:{
   groups:[{name:'Active',color:'#0F766E',position:0},{name:'Won',color:'#2273C9',position:1}],
   fields:[{label:'Notes',ftype:'text',options:[],position:0}],
   tasks:[{title:'T-A',status:'todo',priority:'high',group_index:0},
          {title:'T-B',status:'in_progress',priority:'normal',group_index:1},
          {title:'T-C',status:'todo',priority:'low',group_index:null}]}}];
 newProjectModal('w1');
 await new Promise(x=>setTimeout(x,20)); // template fetch populates the picker after paint
 body=document.querySelector('.modal-body');
 const tsel=body.querySelector('#pj-tpl');
 r.startFromSelect = !!tsel && body.querySelector('#pj-tpl-wrap').hidden===false
   && tsel.querySelector('option[value=""]').textContent.includes('Blank board')
   && !!tsel.querySelector('option[value="tp1"]');
 body.querySelector('#pj-name').value='New CS board';
 tsel.value='tp1';
 window.__calls.length=0;
 await document.querySelector('#pj-save').onclick();
 const pj=window.__calls.find(c=>c.table==='projects'&&c.op==='insert');
 const gi=window.__calls.find(c=>c.table==='project_groups'&&c.op==='insert');
 const fi=window.__calls.find(c=>c.table==='project_fields'&&c.op==='insert');
 const ti=window.__calls.find(c=>c.table==='tasks'&&c.op==='insert');
 r.projectInsertedFirst = !!pj && window.__calls.indexOf(pj)<window.__calls.indexOf(gi);
 r.groupsInOrder = !!gi && gi.payload.length===2 && gi.payload[0].name==='Active' && gi.payload[1].name==='Won'
   && gi.payload.every(g=>g.project_id==='g0');
 r.fieldsInserted = !!fi && fi.payload[0].label==='Notes' && fi.payload[0].project_id==='g0';
 r.tasksMapped = !!ti && ti.payload.length===3
   && ti.payload[0].group_id==='g0' && ti.payload[1].group_id==='g1' && ti.payload[2].group_id===null
   && ti.payload.every((t,i)=>t.position===i+1 && t.created_by==='me' && t.project_id==='g0');
 closeModals(); window.__sel.board_templates=[];
 S.route={view:'project',id:'p1'};

 // C. Recurring manager
 window.__sel.recurring_tasks=[{id:'rc1',project_id:'p1',group_id:'gb',title:'Weekly stock check',
   priority:'normal',assignee_id:'u2',every:'weekly',next_run:'2026-09-01',due_in_days:2,enabled:true}];
 window.__sel.project_groups=S._groups.slice();
 await recurringModal('p1');
 body=document.querySelector('.modal-body');
 const list=body.querySelector('#rc-list');
 r.rcListRow = /Weekly stock check/.test(list.textContent) && /Every week/.test(list.textContent)
   && /2026-09-01/.test(list.textContent) && /Won/.test(list.textContent);
 r.rcToggleChecked = list.querySelector('.sw input').checked===true;
 r.rcAssigneeAvatar = /Ploy Chan/.test(list.innerHTML);
 // title required — no insert without it
 window.__calls.length=0;
 await body.parentNode.querySelector('#rc-add').onclick();
 r.rcTitleRequired = !window.__calls.some(c=>c.table==='recurring_tasks'&&c.op==='insert');
 // fill and add — "No group" goes up as null, due_in_days as an int
 body.querySelector('#rc-title').value='Daily standup';
 body.querySelector('#rc-group').value='';
 body.querySelector('#rc-prio').value='high';
 body.querySelector('#rc-assignee').value='';
 body.querySelector('#rc-every').value='daily';
 body.querySelector('#rc-next').value='2026-09-02';
 body.querySelector('#rc-due').value='3';
 window.__calls.length=0;
 await body.parentNode.querySelector('#rc-add').onclick();
 const rins=window.__calls.find(c=>c.table==='recurring_tasks'&&c.op==='insert');
 r.rcInsertPayload = !!rins && rins.payload.project_id==='p1' && rins.payload.group_id===null
   && rins.payload.title==='Daily standup' && rins.payload.description===''
   && rins.payload.priority==='high' && rins.payload.assignee_id===null
   && rins.payload.every==='daily' && rins.payload.next_run==='2026-09-02'
   && rins.payload.due_in_days===3 && rins.payload.enabled===true;
 r.rcInactiveHidden = ![...body.querySelectorAll('#rc-assignee option')].some(o=>o.value==='u5');
 // recurring rule as a dated subtask on a standing task (4 Oct): weekdays cadence, parent_task_id, no group
 S._tasksAll=[{id:'tp',title:'Daily Flash Sale check',status:'todo',archived_at:null}];
 closeModals(); await recurringModal('p1'); const body2=document.querySelector('.modal-body');
 body2.querySelector('#rc-title').value='Check new campaigns'; body2.querySelector('#rc-mode').value='sub';
 body2.querySelector('#rc-parent').value='Daily Flash Sale check'; body2.querySelector('#rc-every').value='weekdays'; body2.querySelector('#rc-next').value='2026-10-05';
 window.__calls.length=0; await body2.parentNode.querySelector('#rc-add').onclick();
 const sins=window.__calls.find(c=>c.table==='recurring_tasks'&&c.op==='insert');
 r.rcSubtaskRule = !!sins && sins.payload.parent_task_id==='tp' && sins.payload.group_id===null && sins.payload.every==='weekdays';
 r.rcWeekdaysOffered = /weekdays/.test(body2.querySelector('#rc-every').innerHTML);
 closeModals();
 window.__calls.length=0;
 await rcToggle('rc1', false, 'p1');
 const rupd=window.__calls.find(c=>c.table==='recurring_tasks'&&c.op==='update');
 r.rcToggleUpdate = !!rupd && rupd.eq.id==='rc1' && rupd.payload.enabled===false;
 window.__calls.length=0;
 await rcDelete('rc1','p1');
 r.rcDelete = window.__calls.some(c=>c.table==='recurring_tasks'&&c.op==='delete'&&c.eq.id==='rc1');
 closeModals();

 // D. Dependencies in the drawer
 window.__sel.tasks=[{id:'t1',project_id:'p1',title:'Brief the client',description:'',status:'todo',
   priority:'high',assignee_id:null,due_date:null,tags:[],created_by:'me',created_at:'2026-08-30T05:00:00Z'}];
 window.__sel.comments=[]; window.__sel.attachments=[]; window.__sel.subtasks=[];
 window.__sel.task_checklist=[]; window.__sel.activity_log=[]; window.__sel.approvals=[];
 S._tasksAll=[{id:'t1',project_id:'p1',title:'Brief the client',status:'todo',priority:'high'},
   {id:'t2',project_id:'p1',title:'Sign contract',status:'done',priority:'normal'},
   {id:'t3',project_id:'p1',title:'Collect assets',status:'in_progress',priority:'normal'},
   {id:'t4',project_id:'p1',title:'Write copy',status:'todo',priority:'normal'}];
 S._tasks=S._tasksAll.slice();
 window.__sel.task_deps=[{task_id:'t1',depends_on:'t3'},{task_id:'t9',depends_on:'t1'}];
 window.__calls.length=0;
 await openTask('t1');
 const dv=document.getElementById('tv-deps');
 body=dv.closest('.modal-body'); // rcDelete's re-render may still be settling — anchor on the drawer itself
 r.depSection = !!dv && /Waiting on/.test(body.textContent);
 r.depRowChip = /Collect assets/.test(dv.textContent) && /In Progress/.test(dv.textContent);
 r.depWaitingLine = /1 task is waiting on this one/.test(dv.textContent);
 r.depQueries = window.__calls.some(c=>c.table==='task_deps'&&c.op==='select'&&c.eq.task_id==='t1')
   && window.__calls.some(c=>c.table==='task_deps'&&c.op==='select'&&c.eq.depends_on==='t1');
 r.depAddBtn = [...dv.querySelectorAll('button')].some(b=>/addDepModal/.test(b.outerHTML));
 r.depRemoveBtn = /removeDep\('t1','t3'\)/.test(dv.innerHTML);
 // picker: excludes self (t1), done (t2), already-linked (t3) — only t4 left
 addDepModal('t1');
 const pick=document.getElementById('dep-pick');
 const vals=[...pick.querySelectorAll('option')].map(o=>o.value);
 r.depPickerFiltered = vals.length===1 && vals[0]==='t4';
 pick.value='t4';
 window.__calls.length=0;
 await document.getElementById('dep-add').onclick();
 const dins=window.__calls.find(c=>c.table==='task_deps'&&c.op==='insert');
 r.depInsert = !!dins && dins.payload.task_id==='t1' && dins.payload.depends_on==='t4'
   && Object.keys(dins.payload).length===2;
 closeModals();
 window.__calls.length=0;
 await removeDep('t1','t3');
 const ddel=window.__calls.find(c=>c.table==='task_deps'&&c.op==='delete');
 r.depRemove = !!ddel && ddel.eq.task_id==='t1' && ddel.eq.depends_on==='t3';
 closeModals();
 // a blocked status move surfaces the DB's message (existing handler, just verified)
 window.__failNext={table:'tasks',op:'update',msg:'Waiting on “Collect assets” — finish it first'};
 const toasts=[]; const _t=toast; toast=(m,e)=>{toasts.push({m,e});};
 await tvCore('t1','status','done');
 toast=_t;
 r.depBlockToasted = toasts.some(x=>/Collect assets/.test(x.m) && x.e===true);
 r.depBlockReverted = S._tasks.find(t=>t.id==='t1').status==='todo';

 // E. table-row chain icon only for OPEN deps
 S._deps=[{task_id:'t1',depends_on:'t3'},{task_id:'t4',depends_on:'t2'}]; // t3 open, t2 done
 const row1=tvRowHTML(S._tasks.find(t=>t.id==='t1'),[],null);
 const row4=tvRowHTML(S._tasks.find(t=>t.id==='t4'),[],null);
 r.depIconOnOpen = row1.includes('Waiting on another task');
 r.depIconNotOnClosed = !row4.includes('Waiting on another task');

 // F. sweep toast counts recurring
 window.__rpcData={recurring:2, custom:1};
 const btn=document.createElement('button'); document.body.appendChild(btn);
 const toasts2=[]; const _t2=toast; toast=(m,e)=>{toasts2.push({m,e});};
 await runSweepNow(btn);
 toast=_t2; window.__rpcData=null;
 r.sweepCountsRecurring = toasts2.some(x=>x.m==='3 alerts sent');
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);}
(async()=>{ const r=await w.eval('window.__run()'); let ok=true;
 // Every boolean result is an assertion (the suite used to print JSON and exit 0 — it was never a gate).
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n); if(!c) ok=false; };
 check('no error', !r.error); if(r.error) console.log(r.error);
 for(const [k,v] of Object.entries(r)) if(typeof v==='boolean') check(k, v===true);
 console.log(ok?'sprintE: all checks passed':'sprintE: FAILED'); process.exit(ok?0:1); })();
