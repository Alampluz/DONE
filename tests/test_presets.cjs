/* Per-board edit presets: the UI mirrors of can_edit_task / can_write_board, the
   notice a restricted member sees, read-only cells, and the Edit board dropdown. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>({limit:()=>Promise.resolve({data:[]})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

const driver=`window.__run=function(){const r={};try{
 const ME='u-vee', OTHER='u-ko';
 const setMe=(role)=>{ S.me={id:ME, role, full_name:'Vee', email:'vee@example.test'}; };
 S.profiles=[{id:ME,full_name:'Vee',role:'internal',active:true},{id:OTHER,full_name:'Ko',role:'admin',active:true}];
 S.workspaces=[{id:'w1',name:'BD'}];
 S.boardOwners=[]; S.wsOwners=[];
 S._groups=[]; S._fields=[]; S._subs={}; S._deps=[];
 const board=(preset)=>{ S.projects=[{id:'p1',name:'BD Pipeline',workspace_id:'w1',color:'#0F766E',status:'active',edit_preset:preset}]; };
 const mine ={id:'t1',project_id:'p1',title:'Mine',  status:'todo',priority:'normal',assignee_id:ME,   created_by:OTHER};
 const made ={id:'t2',project_id:'p1',title:'Made',  status:'todo',priority:'normal',assignee_id:OTHER,created_by:ME};
 const other={id:'t3',project_id:'p1',title:'Theirs',status:'todo',priority:'normal',assignee_id:OTHER,created_by:OTHER};
 S._tasksAll=S._tasks=[mine,made,other];

 // --- internal member, each preset
 setMe('internal');
 board('everything');
 r.ev = [canEditTask(mine),canEditTask(made),canEditTask(other),canEditOnBoard('p1'),presetNoticeHTML('p1')===''];
 board('assigned');
 r.as = [canEditTask(mine),canEditTask(made),canEditTask(other),canEditOnBoard('p1'),/assigned to you/.test(presetNoticeHTML('p1'))];
 board('view');
 r.vw = [canEditTask(mine),canEditTask(made),canEditTask(other),canEditOnBoard('p1'),/view-only/.test(presetNoticeHTML('p1'))];

 // --- the same board is unrestricted for admin, management, and the board's owner
 setMe('admin');      r.adminFree = canEditTask(other) && canEditOnBoard('p1') && presetNoticeHTML('p1')==='';
 setMe('management'); r.mgmtFree  = canEditTask(other) && canEditOnBoard('p1');
 setMe('internal'); S.boardOwners=[{project_id:'p1',user_id:ME}];
 r.ownerFree = canEditTask(other) && canEditOnBoard('p1') && presetNoticeHTML('p1')==='';
 S.boardOwners=[];

 // --- a requester never edits, whatever the preset, and gets no notice (theirs is role-level)
 setMe('requester'); board('everything');
 r.requesterNever = !canEditTask(mine) && !canEditOnBoard('p1') && presetNoticeHTML('p1')==='';

 // --- a missing preset column (older cached row) means 'everything'
 setMe('internal'); S.projects=[{id:'p1',name:'BD Pipeline',workspace_id:'w1'}];
 r.defaultEverything = boardPreset('p1')==='everything' && canEditTask(other);

 // --- table cells go read-only for tasks the member may not touch
 board('assigned');
 r.cellMineEditable = !/\\bro\\b/.test(tvPickHTML('status','t1','status',false,'todo',mine));
 r.cellOtherReadOnly = /tv-pickv fillcell ro/.test(tvPickHTML('status','t3','status',false,'todo',other));
 r.cellByIdLookup = /tv-pickv ro/.test(tvPickHTML('number','t3','f9',true,5));      // custom cells pass no task, resolved by id
 r.cardDrag = /draggable="true"/.test(taskCard(mine)) && /draggable="false"/.test(taskCard(other));

 // --- Edit board: owners get the dropdown with the current preset selected, and the ⓘ help
 // beside it follows the selection (the blurb used to be inline text; it moved behind the icon).
 const blurb = ()=> document.querySelector('#ep-preset-blurb .ihelp').dataset.help;
 setMe('admin'); board('assigned');
 editProjectModal('p1');
 const sel=document.getElementById('ep-preset');
 r.presetSelect = !!sel && sel.value==='assigned' && sel.options.length===3;
 r.blurbMatches = /assigned to them/.test(blurb());
 sel.value='view'; sel.onchange();
 r.blurbFollows = /read and comment/.test(blurb());
 closeModals();
 // a plain member who is not an owner does not see the control at all
 setMe('internal'); editProjectModal('p1');
 r.noSelectForMember = !document.getElementById('ep-preset');
 closeModals();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,3).join(' / ');}return r;};`;

try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
const r=w.eval('window.__run()');
if(r.error){ console.log('DRIVER ERROR:',r.error); process.exit(1); }
let pass=0, fail=0; const ok=(n,c)=>{ if(c) pass++; else { fail++; console.log('FAIL:',n, JSON.stringify(r)); } };
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
ok('everything: member edits all, may create, no notice',      eq(r.ev,[true,true,true,true,true]));
ok('assigned: own + created editable, others not, may create', eq(r.as,[true,true,false,true,true]));
ok('view: nothing editable, cannot create, view-only notice',  eq(r.vw,[false,false,false,false,true]));
ok('admin is never restricted', r.adminFree);
ok('management is never restricted', r.mgmtFree);
ok('board owner is never restricted', r.ownerFree);
ok('requester never edits and gets no preset notice', r.requesterNever);
ok('no preset on the row means everything', r.defaultEverything);
ok('table cells: own editable, others read-only, custom cells resolve the task by id', r.cellMineEditable && r.cellOtherReadOnly && r.cellByIdLookup);
ok('kanban cards only drag when editable', r.cardDrag);
ok('Edit board shows the preset dropdown to a manager with the current value', r.presetSelect && r.blurbMatches);
ok('changing the preset updates the blurb', r.blurbFollows);
ok('a non-owner member gets no preset control', r.noSelectForMember);
console.log(`presets: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
