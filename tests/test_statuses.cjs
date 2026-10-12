/* Custom statuses per board (projects.field_config.statuses): renamed/recoloured built-ins,
   extra statuses, and any status can count as Done. STATUSES follows the open board. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__calls=[]; w.__sel={};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},update(p){q._op='update';q._p=p;return px;},insert(p){q._op='insert';q._p=p;return px;},delete(){q._op='delete';return px;},eq(c,v){q._eq[c]=v;return px;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}}); return Promise.resolve({data:window.__sel[t]||[],error:null}).then(r,j);}};
 const px=new Proxy(q,{get(o,k){ return k in o? o[k] : (()=>px); }}); return px;};
window.supabase={createClient:()=>({from:window.__mkQuery,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 const tick=()=>new Promise(x=>setTimeout(x,5));
 const custom=[{k:'todo',label:'Pending Brief'},{k:'in_progress',label:'In-Progress'},{k:'s_brand_review',label:'Brand Review',color:'#6e56b8'},{k:'review',label:'Revisions'},{k:'s_approved',label:'Brand Approved',color:'#0f766e',done:true},{k:'done',label:'Resolved'}];
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'c'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Creative',color:'#333'}],
  projects:[{id:'p1',name:'Creative Queue',workspace_id:'w1',status:'active',color:'#08e',field_config:{statuses:custom}},
            {id:'p2',name:'Plain board',workspace_id:'w1',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true}], _fields:[], _groups:[], _tasks:[], _subs:{}, boardOwners:[], wsOwners:[]});
 window.__sel.projects=S.projects; window.__sel.profiles=S.profiles; window.__sel.workspaces=S.workspaces;   // refreshCore() after a save reads these back
 setStatusScope('p1');
 r.keys = STATUSES.map(s=>s.k).join('|'); r.labels = STATUSES.map(s=>s.label).join('|');
 r.customColor = STATUSES.find(s=>s.k==='s_brand_review').color;
 r.builtinKeepsToken = /var\(--st-prog\)/.test(STATUSES.find(s=>s.k==='in_progress').color);
 r.doneFlags = [isDoneK('done'), isDoneK('s_approved'), isDoneK('s_brand_review'), isOpenK('todo')].join('|');
 r.doneKeys = doneKeyList();
 r.cell = tvDisplay('status','s_approved',{});
 r.cellUnknown = /tv-chip|tv-lab/.test(tvDisplay('status','s_gone',{}));
 tvBuildOpts([]); r.opts = TVO.status.map(o=>o.l).join('|');
 S._tasks=[{id:'t1',project_id:'p1',title:'A',status:'s_brand_review',priority:'normal'}]; S._tasksAll=S._tasks;
 renderProjectFromCache('p1'); await tick();
 r.cols = [...document.querySelectorAll('#content .col-head')].map(h=>h.textContent.replace(/\s+/g,' ').trim()).join('|');
 setStatusScope('p2'); r.plain = STATUSES.map(s=>s.label).join('|');
 setStatusScope(null); r.union = STATUSES.map(s=>s.k).join('|');
 r.unionDone = isDoneK('s_approved');
 setStatusScope('p1'); editProjectModal('p1'); await tick();
 r.epRows = [...document.querySelectorAll('.ep-st .ep-st-label')].map(i=>i.value).join('|');
 r.epBuiltinLocked = document.querySelector('.ep-st[data-k="todo"] .ep-st-x').tagName!=='BUTTON';
 document.getElementById('ep-st-add').click(); await tick();
 const last=document.querySelector('#ep-sts .ep-st:last-child'); last.querySelector('.ep-st-label').value='On Hold';
 window.__calls.length=0; document.getElementById('ep-save').click(); await new Promise(x=>setTimeout(x,30));
 const upd = window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.savedSts = upd && JSON.stringify(upd.payload.field_config.statuses);
 closeModals();
 editProjectModal('p2'); await tick();
 window.__calls.length=0; document.getElementById('ep-save').click(); await new Promise(x=>setTimeout(x,30));
 const upd2 = window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.plainSaved = !!(upd2 && ('statuses' in (upd2.payload.field_config||{})));
 closeModals();
}catch(e){r.error=e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('no runtime error', !r.error);
 check('board list: renamed built-ins keep keys and theme colours, extras carry their hex', r.keys==='todo|in_progress|s_brand_review|review|s_approved|done' && r.labels==='Pending Brief|In-Progress|Brand Review|Revisions|Brand Approved|Resolved' && r.customColor==='#6e56b8' && r.builtinKeepsToken);
 check('done is a flag: Brand Approved counts as finished, Brand Review does not', r.doneFlags==='true|true|false|true' && /"done"/.test(r.doneKeys) && /"s_approved"/.test(r.doneKeys));
 check('status cell paints a custom status; an unknown key still renders', /Brand Approved/.test(r.cell) && /#0f766e/.test(r.cell) && r.cellUnknown);
 check('filter options and kanban columns follow the board list', r.opts==='Pending Brief|In-Progress|Brand Review|Revisions|Brand Approved|Resolved' && /Brand Review/.test(r.cols) && /Resolved/.test(r.cols) && !/To Do/.test(r.cols));
 check('plain board keeps the defaults; off a board the union resolves every key', r.plain==='To Do|In Progress|Review|Blocked|Done' && /s_approved/.test(r.union) && r.unionDone);
 check('edit board lists statuses, locks built-ins, saves an added one', r.epRows==='Pending Brief|In-Progress|Brand Review|Revisions|Brand Approved|Resolved' && r.epBuiltinLocked && /"k":"s_on_hold","label":"On Hold"/.test(r.savedSts||'') && /"k":"s_approved","label":"Brand Approved","color":"#0f766e","done":true/.test(r.savedSts||''));
 check('untouched defaults store nothing', r.plainSaved===false);
 if(!ok) process.exit(1); });
