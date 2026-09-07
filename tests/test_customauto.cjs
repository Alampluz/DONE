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
  if(q._op==='insert') data=(Array.isArray(q._p)?q._p:[q._p]).map((x,i)=>({...x,id:'nw'+i}));
  else data = window.__sel[t]||[];
  return Promise.resolve({data,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}, rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'admin'},
  workspaces:[{id:'w1',name:'CS Team',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true,avatar_color:'#0F766E'},
            {id:'u2',full_name:'Prim V',role:'internal',active:true,avatar_color:'#358'},
            {id:'u3',full_name:'Gone P',role:'internal',active:false,avatar_color:'#358'}]});
 renderAdmin=()=>{};

 // A. tab renders custom section: sentence, switch, scope chip, run-log name
 window.__sel.custom_automations=[{id:'c1',workspace_id:null,project_id:null,name:'When status changes to Done, notify the assignee',
   trigger_key:'status_changed',condition:{to:'done'},action_key:'notify_assignee',action_config:{},enabled:true,created_at:'2026-08-29'}];
 window.__sel.automation_rules=[];
 window.__sel.automation_runs=[{id:1,rule_key:'custom',entity_type:'task',entity_id:'t1',status:'ok',
   detail:{automation_id:'c1',name:'When status changes to Done, notify the assignee',action:'notify_assignee'},created_at:new Date().toISOString()}];
 const B=document.createElement('div'); document.body.appendChild(B);
 await renderAutomationsTab(B);
 r.section = /Your automations/.test(B.textContent) && /Built-in rules/.test(B.textContent);
 r.sentence = /When status changes to Done, notify the assignee/.test(B.textContent);
 r.scopeChip = /Everywhere/.test(B.textContent);
 r.addBtn = /Add automation/.test(B.textContent);
 r.runShowsName = (B.textContent.match(/When status changes to Done, notify the assignee/g)||[]).length >= 2;

 // B. builder v2: draft model, sentence preview, from→to
 caModal();                                     // JSDOM outside-only mode doesn't run inline onclick
 r.modalWhen = !!document.querySelector('#ca-body select');
 r.draftDefaults = _ca.trigger==='status_changed' && Array.isArray(_ca.conds) && _ca.conds.length===0 && _ca.acts.length===1 && _ca.acts[0].key==='notify_assignee';
 caTc('to','done');
 r.previewCond = /When status changes to Done, notify the assignee/.test(document.querySelector('#ca-preview').textContent);
 caTc('from','review');
 r.previewFromTo = /When status changes from Review to Done, notify the assignee/.test(document.querySelector('#ca-preview').textContent);
 // same from/to is refused
 caTc('from','done'); window.__calls.length=0; await caSave();
 r.sameFromToRefused = !window.__calls.some(c=>c.table==='custom_automations');
 caTc('from','');

 // C. validation: person actions refuse to save without a person
 caActKey(0,'notify_person');
 window.__calls.length=0;
 await caSave();
 r.blockedNoPerson = !window.__calls.some(c=>c.table==='custom_automations');

 // D. save inserts the full v2 recipe AND the legacy mirror columns
 caActCfg(0,'user_id','u2');
 window.__calls.length=0;
 await caSave();
 await new Promise(x=>setTimeout(x,40));
 const ins = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.insert = ins && ins.payload.trigger_key==='status_changed' && ins.payload.trigger_config.to==='done' && ins.payload.condition.to==='done'
   && ins.payload.actions.length===1 && ins.payload.actions[0].key==='notify_person' && ins.payload.actions[0].cfg.user_id==='u2'
   && ins.payload.action_key==='notify_person' && ins.payload.action_config.user_id==='u2'
   && Array.isArray(ins.payload.conditions) && ins.payload.conditions.length===0
   && ins.payload.workspace_id===null && ins.payload.project_id===null;
 r.insertName = ins && ins.payload.name==='When status changes to Done, notify Prim V';

 // E. inactive people are not offered
 caModal();
 caActKey(0,'assign_person');
 const pbtn=document.querySelector('#ca-acts .pick:not(.sel-pick)'); r.personIsPicker = !!pbtn && /Pick a person/.test(pbtn.textContent);
 pickOpen(pbtn.id);
 r.noInactive = document.querySelectorAll('#pickmenu .pick-opt').length===2 && ![...document.querySelectorAll('#pickmenu .pick-opt')].some(o=>/Gone P/.test(o.textContent));
 // type to filter, Enter picks the highlighted match and writes the config
 const ps=document.querySelector('#pickmenu .pick-search'); ps.value='prim'; ps.dispatchEvent(new window.Event('input'));
 r.personFiltered = [...document.querySelectorAll('#pickmenu .pick-opt')].map(o=>o.textContent.trim()).join('|');
 ps.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter'}));
 r.personPicked = _ca.acts[0].cfg.user_id==='u2' && !document.getElementById('pickmenu') && /Prim V/.test(document.querySelector('#ca-acts .pick:not(.sel-pick)').textContent);
 // scope is a searchable picker too: search narrows workspaces and boards, choosing switches scope
 pickOpen('ca-scope');
 r.scopeGroups = [...document.querySelectorAll('#pickmenu .pick-group')].map(g=>g.textContent).join(',');
 const ss=document.querySelector('#pickmenu .pick-search'); ss.value='cs inq'; ss.dispatchEvent(new window.Event('input'));
 r.scopeFiltered = [...document.querySelectorAll('#pickmenu .pick-opt')].map(o=>o.textContent.trim());
 ss.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter'}));
 await new Promise(x=>setTimeout(x,20));
 r.scopePicked = _ca.scope==='p:p1' && /CS Inquiries/.test(document.getElementById('ca-scope').textContent);
 pickOpen('ca-scope'); const ss2=document.querySelector('#pickmenu .pick-search'); ss2.value='zzz'; ss2.dispatchEvent(new window.Event('input'));
 r.scopeNone = /Nothing matches/.test(document.getElementById('pickmenu').textContent);
 ss2.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})); r.escClosesPick = !document.getElementById('pickmenu');
 closeModals();

 // F. board scope: groups load from the board, save stamps project_id
 window.__sel.project_groups=[{id:'g1',name:'Case Open'},{id:'g2',name:'Solved'}]; window._caGroups={}; window._caFields={};
 caModal();
 caSetTrigger('moved_to_group'); caActKey(0,'move_to_group');
 r.needsBoard = /Choose a board under/.test(document.querySelector('#ca-body').textContent);
 _ca.scope='p:p1'; await caLoadGroups('p1');
 r.groupOpts = [...document.querySelectorAll('#ca-acts option')].map(o=>o.textContent).filter(x=>/Case Open|Solved/.test(x));
 caActCfg(0,'group_id','g2'); caTc('group_id','g1');
 window.__calls.length=0;
 await caSave();
 const ins2 = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.boardInsert = ins2 && ins2.payload.project_id==='p1' && ins2.payload.workspace_id===null
   && ins2.payload.trigger_config.group_id==='g1' && ins2.payload.actions[0].cfg.group_id==='g2';
 r.boardName = ins2 && ins2.payload.name==='When a task moves to Case Open, move it to Solved';

 // G. edit prefills (legacy row → v2 draft) and updates in place
 S._customAutos = window.__sel.custom_automations;
 caModal('c1');
 r.prefill = _ca.trigger==='status_changed' && _ca.tc.to==='done' && _ca.id==='c1' && _ca.acts[0].key==='notify_assignee';
 window.__calls.length=0;
 await caSave();
 const upd = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='update');
 r.update = upd && upd.eq.id==='c1' && upd.payload.action_key==='notify_assignee' && upd.payload.actions[0].key==='notify_assignee';

 // G2. a v2 row prefills conditions and several actions; duplicate opens a fresh copy
 window.__sel.custom_automations.push({id:'c9',workspace_id:null,project_id:'p1',name:'v2 rule',trigger_key:'field_changed',
   trigger_config:{field_id:'sf1',to:'Mars'},conditions:[{k:'priority',op:'is',v:'urgent'},{k:'assignee',op:'empty'},{k:'field:sf2',op:'is_not',v:'X'}],
   actions:[{key:'assign_person',cfg:{user_id:'u2'}},{key:'move_to_group',cfg:{group_id:'g2'}},{key:'add_comment',cfg:{text:'hi {title}'}}],
   condition:{field_id:'sf1',to:'Mars'},action_key:'assign_person',action_config:{user_id:'u2'},enabled:true,created_at:'2026-09-07'});
 S._customAutos = window.__sel.custom_automations;
 window.__sel.project_fields=[{id:'sf1',label:'Brand',ftype:'select',options:['Mars','Hera']},{id:'sf2',label:'Market',ftype:'select',options:['X','Y']},{id:'nf1',label:'GMV',ftype:'number',options:null}];
 window._caFields={}; window._caGroups={};
 caModal('c9'); await caLoadGroups('p1');
 r.v2prefill = _ca.conds.length===3 && _ca.conds[2].k==='field' && _ca.conds[2].field_id==='sf2' && _ca.conds[2].op==='is_not' && _ca.acts.length===3 && _ca.acts[2].cfg.text==='hi {title}';
 r.v2rows = document.querySelectorAll('#ca-conds .ca-row').length===3 && document.querySelectorAll('#ca-acts .ca-act').length===3;
 r.v2sentence = document.querySelector('#ca-preview').textContent;
 r.v2sentenceOk = /When Brand becomes Mars, if priority is Urgent and assignee is empty and market is not X, assign it to Prim V, move it to Solved and add a comment/.test(r.v2sentence);
 // reorder + remove + add
 caActMove(2,-1); r.reordered = _ca.acts[1].key==='add_comment' && _ca.acts[2].key==='move_to_group';
 caActDel(0); r.removed = _ca.acts.length===2 && _ca.acts[0].key==='add_comment';
 caActAdd(); r.added = _ca.acts.length===3 && _ca.acts[2].key==='notify_assignee';
 caCondDel(1); r.condRemoved = _ca.conds.length===2;
 window.__calls.length=0; await caSave();
 const upd9 = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='update');
 r.v2update = upd9 && upd9.eq.id==='c9' && upd9.payload.actions.map(a=>a.key).join(',')==='add_comment,move_to_group,notify_assignee'
   && upd9.payload.conditions.length===2 && upd9.payload.conditions[1].k==='field:sf2' && upd9.payload.conditions[1].v==='X'
   && upd9.payload.action_key==='add_comment' && upd9.payload.action_config.text==='hi {title}';
 caDuplicate('c9'); await new Promise(x=>setTimeout(x,20));
 r.dupFresh = _ca.id===null && _ca.acts.length===3 && _ca.conds.length===3 && /Add automation/.test(document.querySelector('#ca-save').textContent);
 closeModals();

 // G3. conditions demand a value unless empty/set; field conditions need a board
 caModal(); caCondAdd();
 window.__calls.length=0; await caSave(); r.condNeedsValue = !window.__calls.some(c=>c.table==='custom_automations');
 caCondSet(0,'op','empty'); window.__calls.length=0; await caSave();
 const insC = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.condEmptySaves = insC && insC.payload.conditions.length===1 && insC.payload.conditions[0].op==='empty' && !('v' in insC.payload.conditions[0]);
 caModal(); caCondAdd(); caCondSet(0,'k','field'); window.__calls.length=0; await caSave();
 r.fieldCondNeedsBoard = !window.__calls.some(c=>c.table==='custom_automations');
 closeModals();

 // G4. due-date-passed trigger carries days; create_task carries its config
 caModal(); caSetTrigger('due_date_passed'); caTc('days','3'); caActKey(0,'create_task'); caActCfg(0,'title','QA: {title}'); caActCfg(0,'same_assignee','true'); caActCfg(0,'due_in_days','2');
 r.dueSentence = /When the due date is 3 days past, create a follow-up task/.test(document.querySelector('#ca-preview').textContent);
 r.timedNote = /checked every 15 minutes/.test(document.querySelector('#ca-preview').textContent);
 window.__calls.length=0; await caSave();
 const insD = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.dueInsert = insD && insD.payload.trigger_key==='due_date_passed' && insD.payload.trigger_config.days===3
   && insD.payload.actions[0].cfg.title==='QA: {title}' && insD.payload.actions[0].cfg.same_assignee==='true' && insD.payload.actions[0].cfg.due_in_days===2;

 // H. toggle + delete
 window.__calls.length=0;
 await caToggle('c1', false);
 await caDelete('c1');
 r.toggle = window.__calls.some(c=>c.table==='custom_automations'&&c.op==='update'&&c.payload.enabled===false&&c.eq.id==='c1');
 r.del = window.__calls.some(c=>c.table==='custom_automations'&&c.op==='delete'&&c.eq.id==='c1');

 // H2. run history modal reads the rule's runs and shows each step
 window.__sel.automation_runs=[{id:5,rule_key:'custom',entity_type:'task',entity_id:'t1',status:'blocked',created_at:new Date().toISOString(),
   detail:{automation_id:'c9',name:'v2 rule',task_title:'Brief A',steps:[{action:'assign_person',result:'ok'},{action:'set_status',result:'blocked',reason:'waiting on a dependency'}]}}];
 window.__calls.length=0; await caRuns('c9'); await new Promise(x=>setTimeout(x,20));
 const rq = window.__calls.find(c=>c.table==='automation_runs');
 r.runsQuery = rq && rq.eq['detail->>automation_id']==='c9' && rq.eq.rule_key==='custom';
 const RT=document.getElementById('ca-runs').textContent;
 r.runsShown = /Brief A/.test(RT) && /Assign it to someone → ok/.test(RT) && /Set status → blocked \(waiting on a dependency\)/.test(RT) && /1 with a blocked step/.test(RT);
 closeModals();

 // J. each workspace hosts the same tab, pinned to itself
 S.me={id:'me',role:'admin',full_name:'April'};
 S.workspaces.push({id:'w2',name:'BD Team',color:'#333'});
 window.__sel.custom_automations=[
  {id:'c1',workspace_id:null,project_id:null,name:'Global rule',trigger_key:'task_created',condition:{},action_key:'notify_team',action_config:{},enabled:true,created_at:'2026-08-01'},
  {id:'c2',workspace_id:'w1',project_id:null,name:'CS rule',trigger_key:'task_created',condition:{},action_key:'notify_team',action_config:{},enabled:true,created_at:'2026-08-02'},
  {id:'c3',workspace_id:'w2',project_id:null,name:'Other ws rule',trigger_key:'task_created',condition:{},action_key:'notify_team',action_config:{},enabled:true,created_at:'2026-08-03'},
  {id:'c4',workspace_id:null,project_id:'p1',name:'Board rule',trigger_key:'task_created',condition:{},action_key:'notify_team',action_config:{},enabled:true,created_at:'2026-08-04'}];
 window.__sel.automation_runs=[];
 S.route={view:'ws',id:'w1',tab:'automations'};
 await renderWorkspaceAutomations('w1');
 const CT=document.getElementById('content');
 r.wsTabShown = /Rules for this workspace/.test(CT.textContent) && /Built-in rules/.test(CT.textContent);
 r.wsNoScopeSelector = !/Rules apply to/.test(CT.textContent);
 r.wsCustomsFiltered = ['Global rule','CS rule','Board rule'].every(n=>CT.textContent.includes(n)) && !CT.textContent.includes('Other ws rule');
 // built-in toggle from the ws tab writes a w1 override
 window.__calls.length=0;
 await setAutoRule('task_assigned', false);
 const arIns = window.__calls.find(c=>c.table==='automation_rules'&&c.op==='insert');
 r.wsPinnedRule = arIns && arIns.payload.workspace_id==='w1' && arIns.payload.enabled===false;
 // new recipe from the ws tab starts scoped to that workspace
 caModal(null,'w:w1');
 r.wsDefaultScope = _ca.scope==='w:w1';
 window.__calls.length=0;
 await caSave();
 const insW = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.wsInsertScoped = insW && insW.payload.workspace_id==='w1' && insW.payload.project_id===null;
 // management sees it read-only: no add button, switches disabled
 S.me={id:'u2',role:'management',full_name:'Prim V'};
 await renderWorkspaceAutomations('w1');
 r.mgmtNoAdd = !/Add automation/.test(document.getElementById('content').textContent);
 r.mgmtSwitchesOff = [...document.querySelectorAll('#ws-auto .sw input')].length>0
   && [...document.querySelectorAll('#ws-auto .sw input')].every(i=>i.disabled);
 // requesters are bounced back to the boards tab
 S.me={id:'u9',role:'requester',full_name:'R'};
 await renderWorkspaceAutomations('w1');
 r.requesterBounced = location.hash==='#/ws/w1';
 S.me={id:'me',role:'admin',full_name:'April'};

 // K. per-board columns: "A column changes" trigger + "Set a column value" action
 window._caFields={}; window._caGroups={};
 window.__sel.project_fields=[
   {id:'sf1',label:'Production Status',ftype:'select',options:['Pending','In-Progress','Resolved']},
   {id:'nf1',label:'GMV',ftype:'number',options:null}];    // number field: allowed for empty/set conditions, not as a value picker
 caModal(null,'w:w1');
 caSetTrigger('field_changed');
 r.fieldNeedsBoard = /Choose a board under/.test(document.querySelector('#ca-body').textContent);
 _ca.scope='p:p1'; await caLoadGroups('p1');
 r.fieldColOnlySelect = [...document.querySelectorAll('#ca-body .ca-sec:first-child option')].map(o=>o.textContent).filter(x=>/Production Status|GMV/.test(x));
 caTc('field_id','sf1');
 r.fieldValueOpts = [...document.querySelectorAll('#ca-body .ca-sec:first-child option')].map(o=>o.textContent).filter(x=>/Pending|In-Progress|Resolved/.test(x));
 caTc('to','Resolved');
 caActKey(0,'set_status'); caActCfg(0,'status','done');
 r.fieldSentence = /When Production Status becomes Resolved, set status to Done/.test(document.querySelector('#ca-preview').textContent);
 window.__calls.length=0;
 await caSave();
 const insF = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.fieldInsert = insF && insF.payload.trigger_key==='field_changed'
   && insF.payload.trigger_config.field_id==='sf1' && insF.payload.trigger_config.to==='Resolved'
   && insF.payload.project_id==='p1';

 // set_field action mirrors a value onto a board column
 caModal(null,'p:p1'); await caLoadGroups('p1');
 caTc('to','done'); caActKey(0,'set_field');
 window.__calls.length=0; await caSave();
 r.setFieldNeedsValue = !window.__calls.some(c=>c.table==='custom_automations');
 caActCfg(0,'field_id','sf1'); caActCfg(0,'value','Resolved');
 window.__calls.length=0;
 await caSave();
 const insSF = window.__calls.find(c=>c.table==='custom_automations'&&c.op==='insert');
 r.setFieldInsert = insSF && insSF.payload.action_key==='set_field'
   && insSF.payload.action_config.field_id==='sf1' && insSF.payload.action_config.value==='Resolved';
 r.setFieldName = insSF && insSF.payload.name==='When status changes to Done, set Production Status to Resolved';
 closeModals();

 // I. the bell knows the new kind
 r.notif = notifLine({kind:'automation',title:'Banner set',body:'When status changes to Done, notify the assignee'},null);
 r.notifOk = /Banner set/.test(r.notif) && /notify the assignee/.test(r.notif);
 r.notifNoBody = /An automation flagged/.test(notifLine({kind:'automation',title:'X'},null));
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{ const r=await w.eval('window.__run()'); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('no runtime error in driver', !r.error);
 check('tab renders custom + built-in sections, sentence, scope, add button, run log name', r.section && r.sentence && r.scopeChip && r.addBtn && r.runShowsName);
 check('builder opens with a one-action draft; preview follows to/from', r.modalWhen && r.draftDefaults && r.previewCond && r.previewFromTo && r.sameFromToRefused);
 check('person action refuses to save without a person', r.blockedNoPerson);
 check('insert writes v2 columns and legacy mirror', r.insert && r.insertName);
 check('people are a searchable picker: inactive hidden, filter + Enter picks', r.personIsPicker && r.noInactive && /^Prim V/.test(r.personFiltered) && !/April/.test(r.personFiltered) && r.personPicked);
 check('scope is a searchable picker: groups, filter, pick, empty state, Esc', /Workspaces/.test(r.scopeGroups) && /Boards/.test(r.scopeGroups) && r.scopeFiltered.length===1 && /CS Inquiries/.test(r.scopeFiltered[0]) && r.scopePicked && r.scopeNone && r.escClosesPick);
 check('board scope: needs board, loads groups, stamps project_id', r.needsBoard && r.groupOpts.length===2 && r.boardInsert && r.boardName);
 check('legacy row prefills into the v2 draft and updates in place', r.prefill && r.update);
 check('v2 row prefills 3 conditions + 3 actions; sentence reads naturally', r.v2prefill && r.v2rows && r.v2sentenceOk);
 check('reorder / remove / add actions and conditions, saved in order', r.reordered && r.removed && r.added && r.condRemoved && r.v2update);
 check('duplicate opens an unsaved copy', r.dupFresh);
 check('conditions need a value unless empty/set; column conditions need a board', r.condNeedsValue && r.condEmptySaves && r.fieldCondNeedsBoard);
 check('due-date-passed trigger with days + follow-up task config', r.dueSentence && r.timedNote && r.dueInsert);
 check('toggle + delete', r.toggle && r.del);
 check('run history reads the rule runs and lists each step', r.runsQuery && r.runsShown);
 check('workspace tab: pinned, filtered, scoped inserts, read-only for management, requesters bounced', r.wsTabShown && r.wsNoScopeSelector && r.wsCustomsFiltered && r.wsPinnedRule && r.wsDefaultScope && r.wsInsertScoped && r.mgmtNoAdd && r.mgmtSwitchesOff && r.requesterBounced);
 check('column trigger: select columns only, value options, sentence, insert', r.fieldNeedsBoard && r.fieldColOnlySelect.join()==='Production Status' && r.fieldValueOpts.length===3 && r.fieldSentence && r.fieldInsert);
 check('set-column action needs a value and saves it', r.setFieldNeedsValue && r.setFieldInsert && r.setFieldName);
 check('bell knows the automation kind', r.notifOk && r.notifNoBody);
 if(!ok){ console.log(JSON.stringify(r,null,1).slice(0,3000)); process.exit(1);} })();
