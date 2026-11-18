/* Form → board link in the request-type editor (26 Oct 2026): the editor offers a board picker that
   follows the workspace, draws a form-field → board-column mapping once a board is chosen, keeps the
   saved map, and Save sends default_project_id + field_map. The workspace board list shows a Form chip
   on boards that have a public form pointing at them. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.__saved=null;
const cols=[{id:'c-brand',label:'Brand',ftype:'brand'},{id:'c-email',label:'Requester',ftype:'text'},{id:'c-status',label:'Status',ftype:'select'},{id:'c-f',label:'Calc',ftype:'formula'}];
const groups=[{id:'g1',name:'Daily check'},{id:'g2',name:'Ticket request'}];
const mk=(table)=>{ let data=[]; if(table==='project_fields') data=cols; if(table==='project_groups') data=groups;
  const h={get:(_,k)=>{ if(k==='then') return (res)=>res({data,error:null,count:0});
    if(k==='update'||k==='insert') return (p)=>{window.__saved=p; return new Proxy({},h);};
    return ()=>new Proxy({},h); }};
  return new Proxy({},h); };
window.supabase={createClient:()=>({from:(t)=>mk(t),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'Admin'}, profiles:[],
   workspaces:[{id:'ws1',name:'Store Ops'},{id:'ws2',name:'Creative'}],
   projects:[{id:'b1',name:'Price board',workspace_id:'ws1',status:'active'},{id:'b2',name:'Creative Queue',workspace_id:'ws2',status:'active'},{id:'b3',name:'Old',workspace_id:'ws1',status:'archived'}],
   requestTypes:[{id:'rt1',name:'Price form',default_project_id:'b1',public_enabled:true,public_token:'tok1'}]});
 window._allTypes=[{id:'rt1',name:'Price form',sla_hours:24,fields:[{key:'brand',label:'Brand',type:'brand'},{key:'notes',label:'Notes',type:'textarea'}],
   default_workspace_id:'ws1',default_project_id:'b1',default_group_id:'g2',field_map:{brand:'c-brand',_status:'c-status'},public_enabled:true,public_token:'tok1',active:true}];
 r.chipHtml = boardForms('b1').length;
 // board level, like monday's Form view: a new form opened from the board is preset to that board
 editTypeModal(null, 'ws2', 'b2'); await new Promise(x=>setTimeout(x,20));
 const m0=document.querySelector('.modal'); r.presetBoard=m0.querySelector('#ty-board').value; r.presetWs=m0.querySelector('#ty-ws').value; r.presetMap=m0.querySelectorAll('#ty-map select[data-mk]').length; closeModals();
 editTypeModal('rt1');
 await new Promise(x=>setTimeout(x,20));
 const m=document.querySelector('.modal');
 r.boardOpts=[...m.querySelectorAll('#ty-board option')].map(o=>o.value);
 r.boardSel=m.querySelector('#ty-board').value;
 r.mapRows=[...m.querySelectorAll('#ty-map select[data-mk]')].map(s=>s.dataset.mk+'='+s.value);
 r.noFormulaCol=![...m.querySelectorAll('#ty-map option')].some(o=>o.value==='c-f');
 r.helpIcon=!!m.querySelector('label .ihelp');
 r.groupOpts=[...m.querySelectorAll('#ty-group option')].map(o=>o.value+':'+o.textContent); r.groupSel=m.querySelector('#ty-group').value;
 // map a new field by hand, then save
 const sel=m.querySelector('#ty-map select[data-mk=_requester_email]'); sel.value='c-email'; window._tyMapSet(sel.dataset.mk, sel.value);  // inline onchange does not run under runScripts:outside-only
 m.querySelector('#ty-save').click(); await new Promise(x=>setTimeout(x,20));
 r.saved=window.__saved;
 // switching workspace to one with no boards clears the board
 window._allTypes[0].default_workspace_id=null; closeModals();
 S.workspaces=[{id:'ws1',name:'Store Ops'},{id:'ws2',name:'Creative'}]; S.projects=[{id:'b1',name:'Price board',workspace_id:'ws1',status:'active'},{id:'b2',name:'Creative Queue',workspace_id:'ws2',status:'active'},{id:'b3',name:'Old',workspace_id:'ws1',status:'archived'}]; editTypeModal('rt1'); await new Promise(x=>setTimeout(x,20));
 const m2=document.querySelector('.modal'); r.allWsOpts=[...m2.querySelectorAll('#ty-board option')].map(o=>o.textContent);
 m2.querySelector('#ty-ws').value='ws2'; tyBoardOpts(); await new Promise(x=>setTimeout(x,20));
 r.afterWs=m2.querySelector('#ty-board').value; r.mapCleared=m2.querySelector('#ty-map').innerHTML==='';
 m2.querySelector('#ty-save').click(); await new Promise(x=>setTimeout(x,20)); r.saved2=window.__saved; closeModals();
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run().then(s=>{window.__out=s}).catch(e=>{window.__out="ERR "+e.stack})');
const t0=Date.now(); (function wait(){ const out=w.eval('window.__out'); if(!out && Date.now()-t0<8000) return setTimeout(wait,50); if(!out||out.startsWith('ERR')){ console.log('FAIL driver '+out); process.exit(1); }
 const r=JSON.parse(out); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('board picker lists the workspace\'s active boards, not archived ones', JSON.stringify(r.boardOpts)==='["","b1"]' && r.boardSel==='b1');
 check('mapping shows form fields + requester/status rows with the saved map, no formula columns, help behind ⓘ',
   JSON.stringify(r.mapRows)==='["brand=c-brand","notes=","_requester_email=","_status=c-status"]' && r.noFormulaCol && r.helpIcon);
 check('save sends default_project_id and the edited field_map', r.saved && r.saved.default_project_id==='b1' && JSON.stringify(r.saved.field_map)==='{"brand":"c-brand","_status":"c-status","_requester_email":"c-email"}');
 check('group picker: first group is the default, saved group selected and sent', JSON.stringify(r.groupOpts)==='[":Lands in: Daily check (first group)","g2:Lands in: Ticket request"]' && r.groupSel==='g2' && r.saved.default_group_id==='g2');
 check('no board → no group sent', r.saved2.default_group_id===null);
 check('no workspace: every active board, labelled with its workspace', r.allWsOpts.length===3 && /Creative Queue · Creative/.test(r.allWsOpts.join('|')));
 check('changing workspace to one without that board clears it and the map; save sends null + {}', r.afterWs==='' && r.mapCleared && r.saved2.default_project_id===null && JSON.stringify(r.saved2.field_map)==='{}');
 check('boardForms finds the form for the board (feeds the Form chip/button)', r.chipHtml===1);
 check('new form opened from a board is preset to that board and workspace, mapping drawn', r.presetBoard==='b2' && r.presetWs==='ws2' && r.presetMap===2);
 if(!ok) process.exit(1);
})();
