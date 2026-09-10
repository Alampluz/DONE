/* Saved views as tabs. A view = view type + filter bar + the person's sort. Everyone has their
   own; a board owner can pin one for the whole board. The active tab is remembered per board
   and re-applied on open; "All" clears everything; an amber dot marks a tab the person has
   drifted from. RLS does the real gatekeeping - this guards the UI's half of it. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__writes=[]; w.__nextId=100;
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,update(p){q._op='update';q._p=p;return q;},insert(p){q._op='insert';q._p=p;return q;},delete(){q._op='delete';return q;},select(){return q;},single(){return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){window.__writes.push({t,op:q._op,p:q._p});let data=[];if(q._op==='insert'){data={...q._p,id:'v'+(window.__nextId++),created_at:'2026-09-10T00:00:00Z'};}return Promise.resolve({data,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 window.toast=()=>{}; window.confirm=()=>true;
 Object.assign(S,{me:{id:'me',role:'internal',full_name:'Vee'},route:{view:'project',id:'p1'},
  profiles:[{id:'me',full_name:'Vee',role:'internal',active:true},{id:'u2',full_name:'Bee',role:'internal',active:true}],
  boardOwners:[], wsOwners:[{workspace_id:'w1',user_id:'me'}], workspaces:[{id:'w1',name:'Creative',color:'#000'}],
  projects:[{id:'p1',workspace_id:'w1',name:'Creative Queue',status:'active',color:'#08e',field_config:{}}],
  _groups:[{id:'g1',name:'Open',color:'#0F766E'}], _fields:[], _subs:{}, _views:[]});
 S._tasks=[{id:'a',project_id:'p1',title:'One',status:'todo',priority:'urgent',assignee_id:'me',due_date:null,group_id:'g1',archived_at:null,position:1,custom:{}},
           {id:'b',project_id:'p1',title:'Two',status:'done',priority:'low',assignee_id:'u2',due_date:null,group_id:'g1',archived_at:null,position:2,custom:{}}];
 S._tasksAll=S._tasks;
 if(!document.getElementById('content')) document.body.insertAdjacentHTML('beforeend','<div id="content"></div>');
 if(!document.getElementById('modal-root')) document.body.insertAdjacentHTML('beforeend','<div id="modal-root"></div>');
 boardMode='table'; tvPid='p1'; localStorage.clear();
 const tabs=()=>[...document.querySelectorAll('.vtabs .vtab')].map(b=>b.textContent.replace(/\s+/g,' ').trim());
 const onTab=()=>(document.querySelector('.vtabs .vtab.on')||{}).textContent?.replace(/\s+/g,' ').trim();
 // 1. empty: just "All" (active) and "+ Save view"
 renderBoardChrome('p1'); r.empty=tabs().join('|'); r.emptyOn=onTab();
 // 2. save the current state as a personal view: filters + sort + view type go into the row
 bfGet('p1').status='todo'; bfGet('p1').assignee='me'; tvSortSave('p1',{key:'priority',dir:'desc'});
 bvSaveModal('p1'); document.getElementById('bv-name').value='My urgent'; r.pinOffered=!!document.getElementById('bv-pin');
 await document.getElementById('bv-save').onclick();
 const ins=window.__writes.find(x=>x.t==='board_views'&&x.op==='insert');
 r.saved=JSON.stringify({u:ins.p.user_id,f:ins.p.filters,s:ins.p.sort,v:ins.p.view});
 r.tabsAfter=tabs().join('|'); r.onAfter=onTab(); r.remembered=localStorage.getItem('workos.vtab.p1');
 // 3. drift: change a filter -> amber dot; "All" clears filters, sort and the memory
 bfGet('p1').status='done'; renderBoardChrome('p1'); r.dirty=!!document.querySelector('.vtab.on .vt-dirty');
 bvClear('p1'); r.cleared=JSON.stringify(bfGet('p1')); r.sortCleared=tvSortLoad('p1'); r.allOn=onTab(); r.forgot=localStorage.getItem('workos.vtab.p1');
 // 4. clicking the tab re-applies everything, including the view type
 const v=bvList('p1')[0]; v.view='board'; bvApply('p1', v);
 r.applied=JSON.stringify({st:bfGet('p1').status,as:bfGet('p1').assignee,sort:tvSortLoad('p1').key,mode:boardMode}); boardMode='table';
 // 5. pinning as an owner: the row is re-created with user_id null and the pin icon shows
 window.__writes=[]; await bvTogglePin('p1', v.id);
 r.pinInsert=JSON.stringify(window.__writes.find(x=>x.op==='insert').p.user_id); r.pinDeleteOld=window.__writes.some(x=>x.op==='delete');
 r.pinned=bvList('p1')[0].user_id===null; r.pinIcon=!!document.querySelector('.vtab .vt-pin');
 // 6. a member who is not an owner sees the pinned tab but gets no ⋯ on it, and no pin checkbox
 S.me={id:'u2',role:'internal',full_name:'Bee'}; renderBoardChrome('p1');
 r.memberSeesPinned=/My urgent/.test(tabs().join('|')); r.memberNoDots=!document.querySelector('.vtab .vt-dots');
 bvSaveModal('p1'); r.memberNoPin=!document.getElementById('bv-pin'); closeModals();
 S.me={id:'me',role:'internal',full_name:'Vee'};
 // 7. on open, a remembered tab is re-applied even though text filters live only in memory
 const pv=bvList('p1')[0]; pv.filters={q:'nespro',status:'todo'}; pv.sort={key:'title',dir:'asc'}; pv.view='table';
 vtabSave('p1', pv.id); boardFilters['p1']={q:'',status:'',priority:'',assignee:'',group:'',quick:''}; tvSortSave('p1',null); S._viewsApplied=null;
 // simulate the tail of renderProject
 const act=bvActive('p1'); if(act){ (S._viewsApplied=new Set()).add('p1'); boardFilters['p1']={...BV_BLANK,...(act.filters||{})}; tvSortSave('p1',act.sort||null); }
 r.reapplied=JSON.stringify({q:bfGet('p1').q,st:bfGet('p1').status,sort:tvSortLoad('p1').key});
 // 8. delete: gone from the strip, memory cleared
 await bvDelete('p1', pv.id); r.deleted=!/My urgent/.test(tabs().join('|')) && localStorage.getItem('workos.vtab.p1')===null;
 // 9. the RLS refusal is explained in words
 r.err=bvError({message:'new row violates row-level security policy for table "board_views"'});
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('empty strip: All (active) and Save view', r.empty==='All|＋ Save view' && r.emptyOn==='All');
check('saving captures filters, sort and view type as a personal row; owner is offered pin', r.saved==='{"u":"me","f":{"status":"todo","assignee":"me"},"s":{"key":"priority","dir":"desc"},"v":"table"}' && r.pinOffered);
check('new tab appears, is active and remembered', /My urgent/.test(r.tabsAfter) && /My urgent/.test(r.onAfter) && !!r.remembered);
check('drifting marks the tab; All clears filters, sort and memory', r.dirty && /"status":""/.test(r.cleared) && r.sortCleared===null && r.allOn==='All' && r.forgot===null);
check('clicking a tab re-applies filters, sort and view type', r.applied==='{"st":"todo","as":"me","sort":"priority","mode":"board"}');
check('pinning re-creates the row with no user and shows the pin', r.pinInsert==='null' && r.pinDeleteOld && r.pinned && r.pinIcon);
check('a non-owner sees the pinned tab, cannot edit it, cannot pin', r.memberSeesPinned && r.memberNoDots && r.memberNoPin);
check('a remembered tab is re-applied on open, text filter included', r.reapplied==='{"q":"nespro","st":"todo","sort":"title"}');
check('delete removes the tab and forgets it', r.deleted);
check('RLS refusal is explained', /owners/.test(r.err));
if(!ok) process.exit(1); });
