/* Column header menu: Rename (owners, changes the board) and Sort (per person, never written
   to the database). Sort applies within each group, empties last either way, and the drag
   order comes back when it is cleared. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__writes=[];
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_p:null,update(p){q._p=p;return q;},insert(){return q;},delete(){return q;},select(){return q;},single(){return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){if(q._p) window.__writes.push({t,p:q._p});return Promise.resolve({data:[],error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  profiles:[{id:'me',full_name:'April',role:'admin',active:true},{id:'u2',full_name:'Bee',role:'internal',active:true},{id:'u3',full_name:'Zed',role:'internal',active:true}],
  boardOwners:[{project_id:'p1',user_id:'me'}], wsOwners:[], workspaces:[{id:'w1',name:'W',color:'#000'}],
  projects:[{id:'p1',workspace_id:'w1',name:'B',status:'active',color:'#08e',field_config:{}}],
  _groups:[{id:'g1',name:'Open',color:'#0F766E'}],
  _fields:[{id:'fx',project_id:'p1',label:'Budget',ftype:'number',options:null}], _subs:{}});
 const mk=(id,title,pos,extra)=>Object.assign({id,project_id:'p1',title,status:'todo',priority:'normal',assignee_id:null,due_date:null,group_id:'g1',archived_at:null,position:pos,custom:{}},extra);
 S._tasks=[ mk('a','Charlie',1,{priority:'urgent',assignee_id:'u3',due_date:'2026-09-20',custom:{fx:'30'}}),
            mk('b','alpha',2,{priority:'low',assignee_id:'u2',due_date:'2026-09-01',custom:{fx:'5'}}),
            mk('c','Bravo',3,{priority:'high',assignee_id:null,due_date:null,custom:{}}) ];
 S._tasksAll=S._tasks;
 localStorage.removeItem('workos.sort.p1');
 // keep the real page skeleton (the async boot path touches #login-screen); add only what the board needs
 if(!document.getElementById('content')) document.body.insertAdjacentHTML('beforeend','<div id="content"></div>');
 document.getElementById('content').innerHTML='<div id="board-body"></div>';
 if(!document.getElementById('modal-root')) document.body.insertAdjacentHTML('beforeend','<div id="modal-root"></div>');
 boardMode='table'; tvPid='p1';
 const order=()=>[...document.querySelectorAll('#board-body tr.tv-row')].map(tr=>tr.dataset.tid).join('');
 // 1. no sort: drag order
 renderBoardBody('p1'); r.natural=order();
 r.hasDots = document.querySelectorAll('#board-body th .th-dots').length;
 // 2. by title, case-insensitive, both directions; the header shows the arrow
 tvSortSet('p1','title','asc');  r.titleAsc=order(); r.arrow=(document.querySelector('#board-body th.sorted .th-sort')||{}).textContent;
 tvSortSet('p1','title','desc'); r.titleDesc=order();
 // 3. empties last in both directions (due date, assignee, custom number)
 tvSortSet('p1','due_date','asc');  r.dueAsc=order();
 tvSortSet('p1','due_date','desc'); r.dueDesc=order();
 tvSortSet('p1','assignee','asc');  r.asgAsc=order();
 tvSortSet('p1','f:fx','asc');      r.numAsc=order();
 tvSortSet('p1','f:fx','desc');     r.numDesc=order();
 // 4. priority follows the PRIORITIES order, not the alphabet
 tvSortSet('p1','priority','asc'); r.prioAsc=order();
 r.prioOrder = PRIORITIES.map(p=>p.k).join(',');
 // 5. remembered per person, never sent to the database; the bar names it; clearing restores drag order
 r.saved = JSON.parse(localStorage.getItem('workos.sort.p1')).key;
 r.bar = /Sorted by/.test(document.querySelector('#board-body .tv-sortbar')?.textContent||'');
 r.noDbWrite = window.__writes.length===0;
 tvSortSet('p1',null); r.cleared=order(); r.barGone=!document.querySelector('#board-body .tv-sortbar'); r.forgot=localStorage.getItem('workos.sort.p1');
 // 6. the menu: owner sees Rename; sort labels adapt to the column type
 let items=null; const _ctx=window.ctxMenu; window.ctxMenu=(a,i)=>{ items=i; }; window.toast=()=>{};
 tvColMenu(document.createElement('span'),'p1','due_date'); r.menuDue=items.map(i=>i==='-'?'-':i.label).join('|');
 tvColMenu(document.createElement('span'),'p1','f:fx');     r.menuNum=items.map(i=>i==='-'?'-':i.label).join('|');
 tvColMenu(document.createElement('span'),'p1','title');    r.menuTitle=items.map(i=>i==='-'?'-':i.label).join('|');
 S.me={id:'u2',role:'internal',full_name:'Bee'}; tvColMenu(document.createElement('span'),'p1','status'); r.menuMember=items.map(i=>i==='-'?'-':i.label).join('|');
 S.me={id:'me',role:'admin',full_name:'April'}; window.ctxMenu=_ctx;
 // 7. filter from a column header. Core columns hand off to the filter bar (single value);
 //    a custom column opens a live multi-select that stays open while you tick.
 let fopts=null,fpick=null; const _tsm=window.tvShowMenu;
 window.tvShowMenu=(a,o,rend,pick)=>{ fopts=o; fpick=pick; };
 // rendering behind the menu kicks off a reload, and the mocked database answers with
 // nothing, so re-seed the board whenever the test has awaited a real tick.
 const seed=()=>{ S._fields=[{id:'fx',project_id:'p1',label:'Budget',ftype:'number',options:null},
            {id:'fp',project_id:'p1',label:'Platform',ftype:'platform',options:null},
            {id:'fs',project_id:'p1',label:'Reason',ftype:'select',options:['Damaged','Late','Wrong item']}];
   S._tasks=[ mk('a','Charlie',1,{priority:'urgent',assignee_id:'u3',due_date:'2026-09-20',custom:{fx:'30',fp:['Lazada','Shopee'],fs:'Late'}}),
              mk('b','alpha',2,{priority:'low',assignee_id:'u2',due_date:'2026-09-01',custom:{fx:'5',fp:['Lazada'],fs:'Damaged'}}),
              mk('c','Bravo',3,{priority:'high',assignee_id:null,due_date:null,custom:{}}) ];
   S._tasksAll=S._tasks; };
 seed();
 r.filterable=[tvColFilterable('title'),tvColFilterable('ticket_no'),tvColFilterable('due_date'),tvColFilterable('status'),tvColFilterable('f:fs')].join(',');
 const anchor=document.createElement('span'); document.body.appendChild(anchor);
 const rows=()=>[...document.querySelectorAll('#tvmenu .opt.multi')];
 const tick=(label)=>{ rows().find(o=>o.textContent.includes(label)).click(); };
 const shown=()=>bfApply('p1',S._tasks).map(t=>t.id).join('');
 // the menu lists the values on the board, counted, Empty last
 tvColFilterPick(anchor,'p1','f:fs');
 r.selOpts=rows().map(o=>o.dataset.v+':'+o.querySelector('.mcount').textContent).join('|');
 // ticking two values keeps the menu open and matches either one
 tick('Late');    r.oneTicked=shown(); r.menuStaysOpen=!!document.getElementById('tvmenu');
 tick('Damaged'); r.twoTicked=shown(); r.twoStored=JSON.stringify(bfGet('p1').cols.fs);
 r.footCount=(document.querySelector('#tvmenu .mfoot')||{}).textContent;
 r.headerLabel=tvColFilterLabel('p1','f:fs'); r.headerMark=/th-filt/.test(tvHeadHTML('p1',S._fields,false,'g1'));
 // un-ticking the last one drops the filter entirely
 tick('Late'); tick('Damaged'); r.afterUntick=JSON.stringify(bfGet('p1').cols)+'/'+shown();
 // Clear in the footer wipes the column
 tick('Late'); document.querySelector('#tvmenu .mfoot .clr').click();
 r.afterClearBtn=JSON.stringify(bfGet('p1').cols);
 // Escape closes it (the listener is attached on a timeout, so let it land first)
 await new Promise(res=>setTimeout(res,5));
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); r.escClosed=!document.getElementById('tvmenu');
 seed();
 // a platform cell matches any of its chips, and two ticks widen the result
 tvColFilterPick(anchor,'p1','f:fp');
 tick('Shopee'); r.platOne=shown();
 tick('Lazada'); r.platTwo=shown();
 tick('Empty');  r.platWithEmpty=shown();
 tvCloseMenu(); bfClear('p1');
 // 7b. operators (April, 10 Sep): every column gets is / is not / is empty / is not empty,
 //     text also contains, numbers greater-and-less-than, dates before / after / between.
 const opsOf = ft => bfOpsFor(ft).map(o=>o.k).join(',');
 r.opsText=opsOf('select'); r.opsNum=opsOf('number'); r.opsDate=opsOf('date');
 // matching, driven through the real filter object rather than the menu
 const withCol = (raw)=>{ const f=bfGet('p1'); f.cols={fs:raw}; const out=shown(); f.cols={}; return out; };
 r.opIs      = withCol({op:'is',  v:['Late']});
 r.opNotIs   = withCol({op:'nis', v:['Late']});
 r.opEmpty   = withCol({op:'empty'});
 r.opNotEmpty= withCol({op:'nempty'});
 r.opHas     = withCol({op:'has', v:['dam']});          // case-insensitive, part of the word
 r.opNotHas  = withCol({op:'nhas',v:['dam']});          // and an empty cell contains nothing
 const withNum = (raw)=>{ const f=bfGet('p1'); f.cols={fx:raw}; const out=shown(); f.cols={}; return out; };
 r.opGt = withNum({op:'gt', v:['10']});                 // a=30, b=5, c empty
 r.opLt = withNum({op:'lt', v:['10']});
 S._fields.push({id:'fd',project_id:'p1',label:'Ship by',ftype:'date',options:null});
 S._tasks[0].custom.fd='2026-09-20'; S._tasks[1].custom.fd='2026-09-01';
 const withDate = (raw)=>{ const f=bfGet('p1'); f.cols={fd:raw}; const out=shown(); f.cols={}; return out; };
 r.opBefore  = withDate({op:'before', v:['2026-09-10']});
 r.opAfter   = withDate({op:'after',  v:['2026-09-10']});
 r.opBetween = withDate({op:'between',v:['2026-08-31','2026-09-05']});
 // an operator picked but not yet filled in is not a filter at all
 r.opHalf = JSON.stringify([bfColFilter({op:'has',v:['']}), bfColFilter({op:'between',v:['2026-09-01']}), bfColFilter({op:'nope',v:['x']})]);
 r.opHalfShows = withCol({op:'has', v:['']});
 // header labels stay short enough for a column head
 const lbl = (raw)=>{ const f=bfGet('p1'); f.cols={fs:raw}; const out=tvColFilterLabel('p1','f:fs'); f.cols={}; return out; };
 r.lblNotIs=lbl({op:'nis',v:['Late','Damaged']}); r.lblEmpty=lbl({op:'empty'}); r.lblNotEmpty=lbl({op:'nempty'});
 r.lblHas=lbl({op:'has',v:['ref']}); r.lblGt=(()=>{const f=bfGet('p1');f.cols={fx:{op:'gt',v:['10']}};const o=tvColFilterLabel('p1','f:fx');f.cols={};return o;})();
 r.lblBetween=(()=>{const f=bfGet('p1');f.cols={fd:{op:'between',v:['2026-09-01','2026-09-30']}};const o=tvColFilterLabel('p1','f:fd');f.cols={};return o;})();
 // and through the menu: switching the operator writes it, keeps ticks between is and is not,
 // and drops them when the new operator takes typing instead
 bfClear('p1'); tvColFilterPick(anchor,'p1','f:fs');
 const setOp=(k)=>{ const sel=document.querySelector('#tvmenu .mop'); sel.value=k; sel.dispatchEvent(new window.Event('change')); };
 r.menuOps=[...document.querySelectorAll('#tvmenu .mop option')].map(o=>o.value).join(',');
 tick('Late'); setOp('nis');
 r.switchKept=JSON.stringify(bfGet('p1').cols.fs)+'/'+shown();
 setOp('nempty'); r.switchNone=JSON.stringify(bfGet('p1').cols.fs)+'/'+shown();
 setOp('has');    r.switchTyped=JSON.stringify(bfGet('p1').cols)+'/'+!!document.querySelector('#tvmenu .mval input');
 // typing into the value box filters after a short pause, not on every keystroke
 const vi=document.querySelector('#tvmenu .mval input'); vi.value='dam';
 vi.dispatchEvent(new window.Event('input')); r.typedInstant=JSON.stringify(bfGet('p1').cols);
 await new Promise(res=>setTimeout(res,360));
 r.typedSettled=JSON.stringify(bfGet('p1').cols);
 tvCloseMenu(); bfClear('p1'); S._fields=S._fields.filter(f=>f.id!=='fd'); seed();
 // a value saved as a plain string by an older view still filters
 bfGet('p1').cols={fs:'Late'}; r.legacyString=shown(); bfClear('p1');
 // a core column hands over to the filter bar's own slot, so bar and header agree
 tvColFilterPick(anchor,'p1','status'); fpick('done');
 r.coreSlot=bfGet('p1').status; r.coreMark=tvColFiltered('p1','status');
 bfClear('p1'); r.afterClear=JSON.stringify(bfGet('p1').cols)+'/'+bfActiveCount('p1');
 // a column that is empty on every task says so instead of offering a useless "Empty"
 let toasted=''; window.toast=(m)=>{toasted=m;};
 S._tasks.forEach(t=>t.custom={}); tvColFilterPick(anchor,'p1','f:fx');
 r.emptyCol=/Nothing to filter by/.test(toasted) && !document.getElementById('tvmenu');
 window.tvShowMenu=_tsm; window.toast=()=>{};
 S._fields=[{id:'fx',project_id:'p1',label:'Budget',ftype:'number',options:null}];
 S._tasks[0].custom={fx:'30'}; S._tasks[1].custom={fx:'5'}; S._tasks[2].custom={};
 // 8. rename a custom column and a standard field
 tvRenameColumn('p1','f:fx'); document.getElementById('rc-name').value='Spend'; await document.getElementById('rc-save').onclick();
 r.renamedField = S._fields[0].label; r.fieldWrite = JSON.stringify(window.__writes.find(x=>x.t==='project_fields')?.p);
 tvRenameColumn('p1','assignee'); document.getElementById('rc-name').value='Owner'; await document.getElementById('rc-save').onclick();
 r.renamedCore = coreLabel('p1','assignee'); r.coreWrite = JSON.stringify(window.__writes.find(x=>x.t==='projects')?.p);
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('no sort means drag order; every header has a menu', r.natural==='abc' && r.hasDots>=6);
check('title sorts case-insensitively both ways and shows an arrow', r.titleAsc==='bca' && r.titleDesc==='acb' && r.arrow==='▲');
check('empty values sort last in both directions', r.dueAsc==='bac' && r.dueDesc==='abc' && r.asgAsc==='bac' && r.numAsc==='bac' && r.numDesc==='abc');
check('priority follows its own order', r.prioOrder==='low,normal,high,urgent' ? r.prioAsc==='bca' : r.prioAsc==='acb');
check('remembered in localStorage, never written to the database, bar shown', r.saved==='priority' && r.noDbWrite && r.bar);
check('clearing restores drag order and forgets', r.cleared==='abc' && r.barGone && r.forgot===null);
check('menu labels fit the column; members get no Rename', /Rename\|-\|Oldest first\|Newest first/.test(r.menuDue) && /Lowest first\|Highest first/.test(r.menuNum) && !/Rename/.test(r.menuTitle) && !/Rename/.test(r.menuMember));
check('rename writes the custom column label and the standard-field label', r.renamedField==='Spend' && /Spend/.test(r.fieldWrite||'') && r.renamedCore==='Owner' && /Owner/.test(r.coreWrite||''));
check('Task, Ticket and Due date are not value-filtered; the rest are', r.filterable==='false,false,false,true,true');
check('the menu lists the values on the board, counted, Empty last', r.selOpts==='Damaged:1|Late:1|__none__:1');   // equal counts fall back to A-Z
check('ticking one filters; the menu stays open', r.oneTicked==='a' && r.menuStaysOpen);
check('ticking a second widens to either, and both are stored', r.twoTicked==='ab' && r.twoStored==='["Late","Damaged"]' && /2 selected/.test(r.footCount||''));
check('the header shows the funnel and names the first plus a count', r.headerMark && r.headerLabel==='Late +1');
check('un-ticking everything drops the filter', r.afterUntick==='{}/abc');
check('Clear in the footer wipes the column; Escape closes the menu', r.afterClearBtn==='{}' && r.escClosed);
check('a platform cell matches any chip, and ticks widen', r.platOne==='a' && r.platTwo==='ab' && r.platWithEmpty==='abc');
check('a value saved as a plain string by an older view still filters', r.legacyString==='a');
check('a core column goes through the filter bar slot', r.coreSlot==='done' && r.coreMark);
check('Clear filters drops the column filters too', r.afterClear==='{}/0');
check('a column empty on every task says so', r.emptyCol);
check('every column offers is / is not / empty; text adds contains, numbers and dates their own',
  r.opsText==='is,nis,empty,nempty,has,nhas' && r.opsNum==='is,nis,empty,nempty,gt,lt' && r.opsDate==='is,nis,empty,nempty,before,after,between');
check('is and is not are opposites, and empty / not empty split the board', r.opIs==='a' && r.opNotIs==='bc' && r.opEmpty==='c' && r.opNotEmpty==='ab');
check('contains matches part of the word, case-insensitively; an empty cell contains nothing', r.opHas==='b' && r.opNotHas==='ac');
check('greater than and less than read the number out of the cell', r.opGt==='a' && r.opLt==='b');
check('before, after and between compare dates', r.opBefore==='b' && r.opAfter==='a' && r.opBetween==='b');
check('an operator with nothing filled in filters nothing', r.opHalf==='[null,null,null]' && r.opHalfShows==='abc');
check('the header label names the operator and stays short',
  r.lblNotIs==='not Late +1' && r.lblEmpty==='Empty' && r.lblNotEmpty==='Not empty' && r.lblHas==='\u201cref\u201d' && r.lblGt==='> 10' && r.lblBetween==='2026-09-01 \u2192 2026-09-30');
check('the menu switches operator: ticks survive is -> is not, and go when typing takes over',
  /^is,nis,empty,nempty,has,nhas$/.test(r.menuOps||'') && r.switchKept==='{"op":"nis","v":["Late"]}/bc'
  && r.switchNone==='{"op":"nempty"}/ab' && r.switchTyped==='{}/true');
check('typing a value filters after a pause, not on every keystroke',
  r.typedInstant==='{}' && r.typedSettled==='{"fs":{"op":"has","v":["dam"]}}');
if(!ok) process.exit(1); });
