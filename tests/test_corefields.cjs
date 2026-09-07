/* Per-board standard fields: a board can rename Status/Priority/Assignee/Due date and hide the
   ones it does not use (projects.field_config). Task drawer, table header/rows, CSV header and the
   Edit board modal all follow; Status can be renamed but never hidden. */
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
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'c'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Onboarding',color:'#333'}],
  projects:[{id:'p1',name:'Brands Onboard',workspace_id:'w1',status:'active',color:'#08e',field_config:{due_date:{label:'Store live'},assignee:{label:'Owner'},priority:{hidden:true},status:{label:'Stage'}}},
            {id:'p2',name:'Plain board',workspace_id:'w1',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true}], _fields:[], _groups:[], _tasks:[], _subs:{}, boardOwners:[], wsOwners:[]});
 // helpers
 r.labels = [coreLabel('p1','status'),coreLabel('p1','priority'),coreLabel('p1','assignee'),coreLabel('p1','due_date')].join('|');
 r.hidden = [coreHidden('p1','priority'),coreHidden('p1','assignee'),coreHidden('p1','status')].join('|');
 r.plain = [coreLabel('p2','due_date'),coreHidden('p2','priority')].join('|');
 // new-task drawer
 newTaskModal('p1'); await tick();
 const labs=[...document.querySelectorAll('#modal-root .field-grid label')].map(l=>l.textContent.trim());
 r.drawerLabels = labs.join('|');
 r.prioHidden = document.getElementById('tk-prio').closest('div[hidden]')!==null && document.getElementById('tk-prio')!==null;
 closeModals();
 newTaskModal('p2'); await tick();
 r.plainDrawer = [...document.querySelectorAll('#modal-root .field-grid label')].map(l=>l.textContent.trim()).join('|');
 r.plainPrioShown = document.getElementById('tk-prio').closest('div[hidden]')===null;
 closeModals();
 // table header + row
 const head = tvHeadHTML('p1', [], false, 'g1');
 r.headOk = /Stage/.test(head) && /Owner/.test(head) && /Store live/.test(head) && !/Priority/.test(head);
 const row = tvRowHTML({id:'t1',project_id:'p1',title:'Balmuda',status:'in_progress',priority:'normal',assignee_id:null,due_date:null}, [], null);
 r.rowCells = (row.match(/<td/g)||[]).length;
 const rowPlain = tvRowHTML({id:'t2',project_id:'p2',title:'X',status:'todo',priority:'normal',assignee_id:null,due_date:null}, [], null);
 r.rowCellsPlain = (rowPlain.match(/<td/g)||[]).length;
 // edit board modal shows the fields and saves field_config
 editProjectModal('p1'); await tick();
 r.epShows = [...document.querySelectorAll('[data-epf-label]')].map(i=>i.value).join('|');
 r.epChecks = [...document.querySelectorAll('[data-epf-show]')].map(i=>(i.checked?'1':'0')+(i.disabled?'d':'')).join('|');
 document.querySelector('[data-epf-label="due_date"]').value='Go-live';
 document.querySelector('[data-epf-show="priority"]').checked=true;
 document.querySelector('[data-epf-show="assignee"]').checked=false;
 window.__calls.length=0; document.getElementById('ep-save').click(); await new Promise(x=>setTimeout(x,30));
 const upd = window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.saved = upd && JSON.stringify(upd.payload.field_config);
 closeModals();
}catch(e){r.error=e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('no runtime error', !r.error);
 check('helpers: labels from field_config, defaults elsewhere, status never hidden', r.labels==='Stage|Priority|Owner|Store live' && r.hidden==='true|false|false' && r.plain==='Due date|false');
 check('new-task drawer uses board labels and hides Priority (control kept in DOM)', /Stage/.test(r.drawerLabels) && /Owner/.test(r.drawerLabels) && /Store live/.test(r.drawerLabels) && r.prioHidden);
 check('plain board unchanged', /Status\|Priority\|Assignee\|Due date/.test(r.plainDrawer) && r.plainPrioShown);
 check('table header follows labels and drops hidden column; rows match', r.headOk && r.rowCells===r.rowCellsPlain-1);
 check('edit board shows current config and saves the new one', r.epShows==='Stage||Owner|Store live' && r.epChecks==='1d|0|1|1' && r.saved==='{"status":{"label":"Stage"},"assignee":{"label":"Owner","hidden":true},"due_date":{"label":"Go-live"}}');
 if(!ok) process.exit(1); });
