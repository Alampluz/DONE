/* What the task window shows, per board. A CS inquiry is one touch — no subtasks, no
   checklist, nothing to wait on — and every empty section is something an agent scrolls
   past. Each section can be switched off in Edit board; off means it is not rendered at
   all, its content is kept, and the save handler must not reach for controls that are gone. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__sel={};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_one:false,update(){return q;},insert(){return q;},delete(){return q;},select(){return q;},
 single(){q._one=true;return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){const rows=window.__sel[t]||[];return Promise.resolve({data:q._one?(rows[0]||null):rows,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'CS Team',color:'#0F766E'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true}],
  boardOwners:[{project_id:'p1',user_id:'me'}], wsOwners:[],
  projects:[
   {id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e',key:'CS',visibility:'collaborate',
    field_config:{due_date:{hidden:true}, sections:{subtasks:false, checklist:false, deps:false}}},
   {id:'p2',workspace_id:'w1',name:'Plain Board',status:'active',color:'#08e',visibility:'collaborate',field_config:{}}],
  _groups:[], _fields:[], _subs:{}, _tasks:[]});

 // 1. defaults: an untouched board shows everything
 r.plainOn = TASK_SECTIONS.map(x=>sectionOn('p2',x.k)).join(',');
 // 2. the configured board reports exactly what was switched off
 r.csOff = TASK_SECTIONS.filter(x=>!sectionOn('p1',x.k)).map(x=>x.k).join(',');
 // 3. an unknown board, or a board with no config at all, still says "shown"
 r.unknown = sectionOn('nope','subtasks');

 // 4. the drawer honours it: hidden sections are absent, kept ones present
 window.__sel.subtasks=[]; window.__sel.task_checklist=[];
 window.__sel.attachments=[]; window.__sel.comments=[]; window.__sel.task_deps=[]; window.__sel.approvals=[];
 const task=(pid)=>({id:'t-'+pid,project_id:pid,title:'X',description:'body',status:'todo',priority:'normal',
   assignee_id:null,due_date:null,group_id:null,archived_at:null,ticket_no:'CS-260908-001',created_at:'2026-09-08T03:00:00Z',created_by:'me'});
 window.__sel.tasks=[task('p1')];
 await openTask('t-p1');
 const body=document.querySelector('.modal-body');
 const labels=()=>[...document.querySelectorAll('.modal-body > label')].map(l=>l.textContent.trim().replace(/\s+/g,' '));
 r.csLabels = labels().join(' | ');
 r.csNoSubInput = !document.getElementById('tv-sub-new') && !document.getElementById('tv-chk-new');
 r.csKeepsDesc  = !!document.getElementById('tv-desc');
 r.csKeepsComments = !!document.getElementById('tv-comments');
 closeModals();
 window.__sel.tasks=[task('p2')];
 await openTask('t-p2');
 r.plainLabels = labels().join(' | ');
 r.plainHasSub = !!document.getElementById('tv-sub-new');
 closeModals();

 // 5. Edit board offers a toggle per section, pre-ticked from the config, and saving
 //    writes only the ones that are off
 editProjectModal('p1');
 const boxes=[...document.querySelectorAll('[data-eps]')];
 r.boxCount = boxes.length;
 r.boxState = boxes.map(b=>b.dataset.eps+':'+(b.checked?'on':'off')).join(',');
 // switch subtasks back on, switch comments off, then read what the save would build
 document.querySelector('[data-eps="subtasks"]').checked = true;
 document.querySelector('[data-eps="comments"]').checked = false;
 const secs={}; TASK_SECTIONS.forEach(x=>{ const el=document.querySelector('[data-eps="'+x.k+'"]'); if(el && !el.checked) secs[x.k]=false; });
 r.wouldSave = JSON.stringify(secs);
 closeModals();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('an untouched board shows every section', r.plainOn==='true,true,true,true,true,true' && r.unknown===true);
check('the CS board reports exactly what was switched off', r.csOff==='subtasks,checklist,deps');
check('the drawer drops the hidden sections', !/Subtasks/.test(r.csLabels||'') && !/Checklist/.test(r.csLabels||'') && r.csNoSubInput);
check('and keeps the ones still on', r.csKeepsDesc && r.csKeepsComments && /Description/.test(r.csLabels||'') && /Comments/.test(r.csLabels||''));
check('a plain board still shows subtasks and checklist', /Subtasks/.test(r.plainLabels||'') && /Checklist/.test(r.plainLabels||'') && r.plainHasSub);
check('Edit board offers one toggle per section, pre-ticked from the config', r.boxCount===6 && r.boxState==='description:on,subtasks:off,checklist:off,attachments:on,deps:off,comments:on');
check('saving writes only the sections that are off', r.wouldSave==='{"checklist":false,"deps":false,"comments":false}');
if(!ok) process.exit(1); });
