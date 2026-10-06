/* The task popup layout (4 Oct 2026, from April's mockup): breadcrumb, a big title you click
   to rename, ticket/brand/platform meta line, status + priority pills, owner and due date,
   Details / Comments / Activity tabs, and a two-column details pane. The Save button still
   reads the same controls, so a rename made in the heading must reach the update. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__sel={}; w.__upd=null;
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_one:false,update(p){window.__upd={t,p};return q;},insert(){return q;},delete(){return q;},select(){return q;},
 single(){q._one=true;return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){const rows=window.__sel[t]||[];return Promise.resolve({data:q._one?(rows[0]||null):rows,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'calendar',id:'w1'},
  workspaces:[{id:'w1',name:'Store Operation',color:'#0F766E'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},{id:'u2',full_name:'Praeploy G',role:'internal',active:true}],
  boardOwners:[{project_id:'p1',user_id:'me'}], wsOwners:[],
  projects:[{id:'p1',workspace_id:'w1',name:'Flash Sale',status:'active',color:'#08e',key:'FS',visibility:'collaborate',field_config:{}}],
  _groups:[], _subs:{}, _tasks:[],
  _fields:[{id:'fb',project_id:'p1',ftype:'brand',name:'Brand'},{id:'fp',project_id:'p1',ftype:'platform',name:'Platform'},
           {id:'fx',project_id:'other',ftype:'brand',name:'Brand'}]});
 const T={id:'t1',project_id:'p1',title:'October flash sale <pricing>',description:'Confirm prices',status:'in_progress',priority:'normal',
   assignee_id:'u2',due_date:'2026-10-05',group_id:null,archived_at:null,ticket_no:'FS-1048',created_at:'2026-10-01T03:00:00Z',created_by:'me',
   custom:{fb:'Revlon',fp:['Lazada'],fx:'NotThisBoard'}};
 window.__sel.tasks=[T];
 window.__sel.task_checklist=[{id:'c1',task_id:'t1',label:'Validate selling prices',done:true},{id:'c2',task_id:'t1',label:'Confirm brand approval',done:true},{id:'c3',task_id:'t1',label:'Attach final price list',done:false}];
 window.__sel.comments=[{id:'k1',entity_type:'task',entity_id:'t1',author_id:'me',body:'one',created_at:'2026-10-01T04:00:00Z'},
   {id:'k2',entity_type:'task',entity_id:'t1',author_id:'me',body:'two',created_at:'2026-10-01T05:00:00Z'},
   {id:'k3',entity_type:'task',entity_id:'t1',author_id:'me',body:'three',created_at:'2026-10-01T06:00:00Z'}];
 ['attachments','subtasks','activity_log','approvals','task_deps'].forEach(k=>window.__sel[k]=[]);
 await openTask('t1');
 const m=document.querySelector('.task-modal'), $=s=>m.querySelector(s);
 r.crumb=$('.task-context').textContent.replace(/\s+/g,' ').trim();
 r.title=$('#tv-title-view').textContent;
 r.titleEscaped=!$('.tv-h2 pricing') && $('#tv-title-view').innerHTML.includes('&lt;pricing&gt;');
 r.meta=$('.tv-meta').textContent.replace(/\s+/g,' ').trim();
 r.labelled=m.getAttribute('aria-labelledby')===$('.tv-h2').id;
 r.statusPainted=!!$('#tv-status').style.background && $('#tv-status').value==='in_progress';
 r.owner=$('#tv-assignee').value; r.ownerAv=!!$('#tv-owner-av').innerHTML.trim();
 r.due=$('#tv-due').value;
 r.tabs=[...m.querySelectorAll('.tv-tab')].map(b=>b.textContent.replace(/\s+/g,' ').trim()+':'+b.getAttribute('aria-selected')).join('|');
 r.panes=['fields','details','comments','activity'].map(k=>k+':'+($('#tv-pane-'+k).hidden?'hidden':'shown')).join(',');
 r.twoCols=!!$('#tv-pane-details .tv-main') && !!$('#tv-pane-details .tv-side');
 r.chkCount=$('#tv-chk-count').textContent;
 // checklist count follows a toggle (class flip) and a removal
 document.getElementById('chk-c3').classList.add('done'); await new Promise(x=>setTimeout(x,0));
 r.chkAfterToggle=$('#tv-chk-count').textContent;
 document.getElementById('chk-c1').remove(); await new Promise(x=>setTimeout(x,0));
 r.chkAfterRemove=$('#tv-chk-count').textContent;
 // tabs: click, then arrow keys
 $('#tv-tab-comments').click();
 r.afterClick=['details','comments','activity'].map(k=>$('#tv-pane-'+k).hidden?0:1).join('');
 $('#tv-tab-comments').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 r.afterArrow=['details','comments','activity'].map(k=>$('#tv-pane-'+k).hidden?0:1).join('')+':'+(document.activeElement&&document.activeElement.id);
 $('#tv-tab-activity').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
 r.afterHome=$('#tv-tab-fields').getAttribute('aria-selected');
 // edits on a hidden pane survive a tab switch
 $('#tv-desc').value='Changed while on Details'; $('#tv-tab-activity').click(); $('#tv-tab-details').click();
 r.descKept=$('#tv-desc').value==='Changed while on Details';
 // rename in the heading: click opens the input, Escape restores, Enter keeps
 $('#tv-title-view').click();
 r.inputOpen=!$('#tv-title').hidden && $('.tv-h2').hidden;
 $('#tv-title').value='Renamed then cancelled';
 $('#tv-title').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 r.escapeKeptModal=!!document.querySelector('.task-modal'); r.escapeRestored=$('#tv-title').value==='October flash sale <pricing>';
 $('#tv-title-view').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 $('#tv-title').value='October flash sale pricing v2'; $('#tv-title').blur();
 r.viewUpdated=$('#tv-title-view').textContent; r.inputClosed=$('#tv-title').hidden;
 // status change repaints, owner change swaps the avatar
 const bg1=$('#tv-status').style.background; $('#tv-status').value='done'; $('#tv-status').dispatchEvent(new Event('change'));
 r.repainted=$('#tv-status').style.background!==bg1;
 $('#tv-assignee').value=''; $('#tv-assignee').dispatchEvent(new Event('change')); r.avCleared=$('#tv-owner-av').innerHTML==='';
 // Save sends the heading rename and the other edits
 await $('#tv-save').onclick();
 r.saved=window.__upd&&window.__upd.t==='tasks'? window.__upd.p : null;
 closeModals();
 // a partner gets no Activity tab, and read-only users get no rename affordance
 S.me={id:'px',role:'partner',full_name:'P'}; S.profiles.push({id:'px',full_name:'P',role:'partner',active:true});
 await openTask('t1');
 r.partnerTabs=[...document.querySelectorAll('.task-modal .tv-tab')].map(b=>b.id).join(',');
 closeModals();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('breadcrumb is workspace / board', r.crumb==='Store Operation / Flash Sale');
check('title is the heading, escaped, and names the dialog', r.title==='October flash sale <pricing>' && r.titleEscaped && r.labelled);
check('meta line: ticket · brand · platform, only from this board', r.meta==='FS-1048 · Revlon · Lazada');
check('status pill painted, owner and due filled', r.statusPainted && r.owner==='u2' && r.ownerAv && r.due==='2026-10-05');
check('tabs: Fields first on a board with columns, Comments shows its count, Activity for staff', r.tabs==='Fields:true|Details:false|Comments 3:false|Activity:false');
check('only Fields is shown at first; Details keeps its two columns', r.panes==='fields:shown,details:hidden,comments:hidden,activity:hidden' && r.twoCols);
check('checklist header counts done items', r.chkCount==='(2 of 3 complete)');
check('count follows a toggle and a removal', r.chkAfterToggle==='(3 of 3 complete)' && r.chkAfterRemove==='(2 of 2 complete)');
check('click switches tab', r.afterClick==='010');
check('arrow key moves to the next tab and focuses it', r.afterArrow==='001:tv-tab-activity');
check('Home goes back to the first tab', r.afterHome==='true');
check('unsaved edits survive switching tabs', r.descKept);
check('clicking the title opens the rename input', r.inputOpen);
check('Escape in the rename restores the title and does not close the popup', r.escapeKeptModal && r.escapeRestored);
check('Enter/blur keeps the new title in the heading', r.viewUpdated==='October flash sale pricing v2' && r.inputClosed);
check('status change repaints the pill; clearing owner clears the avatar', r.repainted && r.avCleared);
check('Save sends the rename and the edits', !!r.saved && r.saved.title==='October flash sale pricing v2' && r.saved.status==='done' && r.saved.assignee_id===null && r.saved.description==='Changed while on Details');
check('partners get Fields, Details and Comments, no Activity', r.partnerTabs==='tv-tab-fields,tv-tab-details,tv-tab-comments');
if(!ok) process.exit(1); });
