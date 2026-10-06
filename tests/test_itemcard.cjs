/* Board columns in the task popup (6 Oct 2026, April: "I want feature like this in the pop up
   task" — monday's item card). Every column shows as an editable field in named cards; the
   board owner sets the layout once for everyone (projects.field_config.item_card), can hide
   columns, and can add Subtasks / Files tabs. Cells reuse the table's editors, so an edit made
   here is the same save as on the board — including when the popup was opened from Home and
   the task is not on the board in memory. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__sel={}; w.__upds=[];
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_one:false,update(p){window.__upds.push({t,p});return q;},insert(){return q;},delete(){return q;},select(){return q;},
 single(){q._one=true;return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){const rows=window.__sel[t]||[];return Promise.resolve({data:q._one?(rows[0]||null):rows,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({upload:async()=>({}),remove:async()=>({}),createSignedUrls:async()=>({data:[]}),createSignedUrl:async()=>({data:{}})})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};const sleep=n=>new Promise(x=>setTimeout(x,n));try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'home'},
  workspaces:[{id:'w1',name:'Creative',color:'#0F766E'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},{id:'u2',full_name:'Toey S',role:'internal',active:true}],
  boardOwners:[{project_id:'p1',user_id:'me'}], wsOwners:[], brandsList:[{name:'Hush Puppies',active:true}],
  projects:[{id:'p1',workspace_id:'w1',name:'Artwork Requests',status:'active',color:'#08e',key:'AW',visibility:'collaborate',field_config:{sections:{deps:false}}}],
  _groups:[], _subs:{}, _tasks:[], _fields:[]});            // on Home: no board, nothing in memory
 const F=[['fb','Brand','brand'],['fp','Platform','platform'],['fs','Campaign Level','select',['Mega','Normal']],['fd','Live Date','date'],
          ['fpe','Reporter','person'],['fl','Brief Link','text'],['fc','Approved','checkbox']]
   .map(([id,label,ftype,options],i)=>({id,project_id:'p1',label,ftype,options:options||null,position:i}));
 window.__sel.project_fields=F;
 const T={id:'t1',project_id:'p1',title:'(HPxLAZ) 5.5 Frame',description:'',status:'review',priority:'normal',assignee_id:'u2',due_date:'2026-10-10',
   ticket_no:'AW-0001',created_at:'2026-10-01T03:00:00Z',created_by:'me',
   custom:{fb:'Hush Puppies',fp:'Lazada',fs:'Mega',fd:'2026-05-01',fpe:'u2',fl:'https://creacoltd.sharepoint.com/x',fc:true}};
 window.__sel.tasks=[T];
 ['task_checklist','comments','attachments','subtasks','activity_log','approvals','task_deps'].forEach(k=>window.__sel[k]=[]);
 const cardsOf=()=>[...document.querySelectorAll('.task-modal .ic-card')].map(c=>c.querySelector('.ic-title').textContent+':'+[...c.querySelectorAll('.ic-field')].map(f=>f.dataset.fid).join(','));

 // A. default layout, opened from Home: the popup loads the board's own columns
 await openTask('t1');
 r.firstTab=document.querySelector('.task-modal .tv-tab.on')?.id;
 r.cardsA=cardsOf().join(' | ');
 r.meta=document.querySelector('.task-modal .tv-meta')?.textContent.replace(/\s+/g,' ').trim();
 r.linkShown=/Open creacoltd/.test(document.querySelector('[data-fid="fl"]').textContent);
 r.selectOpts=JSON.stringify((TVO['f_fs']||[]).map(o=>o.v));
 const cell=document.querySelector('[data-fid="fs"] .tv-pickv');
 r.cellKbd=cell.getAttribute('role')==='button' && cell.tabIndex===0 && /Campaign Level: Mega/.test(cell.getAttribute('aria-label'));
 r.editLayoutBtn=!!document.querySelector('.task-modal .ic-bar button');
 r.tabAddBtn=!!document.querySelector('.task-modal .tv-tab-add');

 // B. editing a dropdown column: the menu opens even though the task isn't on a board in memory
 // jsdom's outside-only mode does not run inline onclick=, so call the handler the cell names
 tvEdit(cell, new Event('click')); r.menuOpened=!!document.getElementById('tvmenu'); tvCloseMenu();
 window.__upds=[]; await tvCustom('t1','fs','Normal'); await sleep(0);
 const up=window.__upds.find(u=>u.t==='tasks'); r.savedCustom=up? JSON.stringify(up.p.custom.fs) : null;
 r.cardRefreshed=/Normal/.test(document.querySelector('[data-fid="fs"]').textContent);

 // C. Escape in a text cell's editor cancels the edit, not the popup
 tvEdit(document.querySelector('[data-fid="fl"] .tv-pickv'), new Event('click'));
 const inp=document.querySelector('[data-fid="fl"] input');
 r.textEditorOpened=!!inp;
 inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 r.popupStillOpen=!!document.querySelector('.task-modal');
 closeModals();

 // D. a stored layout: renamed card, hidden column, new columns appended, unknown ids dropped, Files tab
 projById('p1').field_config={sections:{deps:false}, item_card:{cards:[{id:'a',title:'Main',fields:['fd','fb','zz','fd']}],hidden:['fp'],tabs:['files','bogus']}};
 await openTask('t1');
 r.cardsD=cardsOf().join(' | ');
 r.tabsD=[...document.querySelectorAll('.task-modal .tv-tab')].map(b=>b.id.replace('tv-tab-','')).join(',');
 r.attsInFiles=!!document.querySelector('#tv-pane-files #tv-atts') && !document.querySelector('#tv-pane-details #tv-atts');
 r.detailsSolo=document.querySelector('#tv-pane-details').classList.contains('solo');
 closeModals();
 // garbage never breaks the popup
 projById('p1').field_config={item_card:'nonsense'};
 await openTask('t1'); r.garbageDefault=cardsOf().length===2; closeModals();
 projById('p1').field_config={item_card:{cards:[null,7,{title:'<b>x</b>',fields:'fb'}]}};
 await openTask('t1'); r.garbageCards=cardsOf().join(' | '); r.titleEscaped=!document.querySelector('.ic-title b'); closeModals();

 // E. Edit layout: move a column to Not shown, add + rename a card, move a card up, keep other config
 projById('p1').field_config={sections:{deps:false}};
 await openTask('t1');
 icLayoutModal('t1');
 const L=()=>document.querySelector('.icl-modal');
 const sel=L().querySelector('.icl-row[data-fid="fb"] select');
 sel.value='hide'; sel.dispatchEvent(new Event('change',{bubbles:true}));
 r.hiddenRow=!!L().querySelector('.icl-hidden .icl-row[data-fid="fb"]');
 L().querySelector('[data-act="add-card"]').click();
 const t3=L().querySelector('.icl-title[data-ci="2"]'); t3.value='Links'; t3.dispatchEvent(new Event('input',{bubbles:true}));
 const sel2=L().querySelector('.icl-row[data-fid="fl"] select'); sel2.value='2'; sel2.dispatchEvent(new Event('change',{bubbles:true}));
 L().querySelector('[data-act="c-up"][data-ci="2"]').click();
 L().querySelector('.icl-row[data-fid="fd"] [data-act="f-down"]').click();
 r.keyboardOrder=[...L().querySelectorAll('.icl-card:not(.icl-hidden)')].map(c=>c.querySelector('.icl-title').value).join(',');
 window.__upds=[]; L().querySelector('[data-act="save"]').click(); await sleep(10);
 const pu=window.__upds.find(u=>u.t==='projects');
 r.savedLayout=pu? JSON.stringify(pu.p.field_config) : null;
 r.layoutClosed=!document.querySelector('.icl-modal') && !!document.querySelector('.task-modal');
 r.cardsE=cardsOf().join(' | ');
 // removing a card hands its columns to a neighbour
 icLayoutModal('t1');
 L().querySelector('[data-act="c-del"][data-ci="0"]').click();
 r.afterDel=[...L().querySelectorAll('.icl-card:not(.icl-hidden)')].map(c=>c.querySelector('.icl-title').value+':'+[...c.querySelectorAll('.icl-row')].map(x=>x.dataset.fid).join('+')).join(' | ');
 closeTopModal();

 // F. the ＋ next to the tabs adds a Subtasks tab for the whole board
 window.__upds=[];
 icTabMenu(document.querySelector('.task-modal .tv-tab-add'),'t1','p1');
 const opts=[...document.querySelectorAll('#tvmenu .opt')];
 r.tabMenu=opts.map(o=>o.textContent.trim()).join(' / ');
 opts.find(o=>/Subtasks/.test(o.textContent)).click(); await sleep(20);
 const tu=window.__upds.find(u=>u.t==='projects'); r.tabsSaved=tu? JSON.stringify(tu.p.field_config.item_card.tabs) : null;
 r.subtasksTab=!!document.querySelector('#tv-pane-subtasks #tv-subs') && !document.querySelector('#tv-pane-details #tv-subs');
 closeModals();

 // G. a partner: read-only cells, no layout controls
 S.me={id:'px',role:'partner',full_name:'P'}; S.profiles.push({id:'px',full_name:'P',role:'partner',active:true});
 await openTask('t1');
 r.partnerNoLayout=!document.querySelector('.task-modal .ic-bar') && !document.querySelector('.task-modal .tv-tab-add');
 r.partnerReadOnly=!document.querySelector('.task-modal .ic-val .tv-pickv[role="button"]') && !!document.querySelector('.task-modal .ic-val .tv-pickv.ro');
 closeModals();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,4).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('a board with columns opens on Fields', r.firstTab==='tv-tab-fields');
check('default layout: Information, then Dates & people', r.cardsA==='Information:fb,fp,fs,fl,fc | Dates & people:fd,fpe');
check('opened from Home, the meta line still has brand and platform', r.meta==='AW-0001 · Hush Puppies · Lazada');
check('URLs show as links; dropdown options are loaded for this board', r.linkShown && r.selectOpts==='["Mega","Normal"]');
check('cells are keyboard buttons with a name', r.cellKbd);
check('the board owner gets Edit layout and the tab ＋', r.editLayoutBtn && r.tabAddBtn);
check('a cell opens its picker for a task not on any open board', r.menuOpened);
check('an edit saves to custom and redraws the card', r.savedCustom==='"Normal"' && r.cardRefreshed);
check('Escape in a cell editor leaves the popup open', r.textEditorOpened && r.popupStillOpen);
check('stored layout: renamed card, hidden column out, new columns appended, junk ids dropped', r.cardsD==='Main:fd,fb,fs,fpe,fl,fc');
check('Files tab added, attachments move into it, Details goes single-column', r.tabsD==='fields,details,files,comments,activity' && r.attsInFiles && r.detailsSolo);
check('a nonsense config falls back to the default', r.garbageDefault && r.garbageCards==='<b>x</b>:fb,fp,fs,fd,fpe,fl,fc' && r.titleEscaped);
check('Edit layout: Not shown, new card, rename, reorder', r.hiddenRow && r.keyboardOrder==='Information,Links,Dates & people');
check('Save writes the layout and keeps the rest of field_config', r.savedLayout==='{"sections":{"deps":false},"item_card":{"v":1,"cards":[{"id":"info","title":"Information","fields":["fp","fs","fc"]},{"id":"'+(JSON.parse(r.savedLayout||'{"item_card":{"cards":[{},{"id":""}]}}').item_card.cards[1].id)+'","title":"Links","fields":["fl"]},{"id":"dates","title":"Dates & people","fields":["fpe","fd"]}],"hidden":["fb"],"tabs":[]}}');
check('the layout dialog closes and the popup redraws', r.layoutClosed && r.cardsE==='Information:fp,fs,fc | Links:fl | Dates & people:fpe,fd');
check('removing a card moves its columns to the next one', r.afterDel==='Links:fl+fp+fs+fc | Dates & people:fpe+fd');
check('the tab ＋ offers Subtasks and Files', /Add a Subtasks tab/.test(r.tabMenu||'') && /Add a Files tab/.test(r.tabMenu||''));
check('adding the Subtasks tab saves for the board and moves the section', r.tabsSaved==='["subtasks"]' && r.subtasksTab);
check('partners see values read-only, with no layout controls', r.partnerNoLayout && r.partnerReadOnly);
if(!ok) process.exit(1); });
