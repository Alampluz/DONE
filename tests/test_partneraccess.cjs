/* Board members (partner access): the dialog must open at all — it used to throw, because the
   people list read `canGuest` above its own `const` — and it must say plainly when the board
   is not Shareable, offer the one-click fix, and set what partners may change on this board.
   The database is the thing that actually enforces the last one; this guards the UI half. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__calls=[]; w.__sel={workspace_members:[{user_id:'u2'}]};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},update(p){q._op='update';q._p=p;return px;},insert(p){q._op='insert';q._p=p;return px;},
 delete(){q._op='delete';return px;},eq(c,v){q._eq[c]=v;return px;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}}); return Promise.resolve({data:window.__sel[t]||[],error:null}).then(r,j);}};
 const px=new Proxy(q,{get(o,k){ return k in o? o[k] : (()=>px); }}); return px;};
window.supabase={createClient:()=>({from:window.__mkQuery,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:null,error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{ const tick=()=>new Promise(x=>setTimeout(x,10));
 window.toast=()=>{}; window.refreshCore=async()=>{};
 const setup=(vis, partner_edit)=>Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'c'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Creative',color:'#333'}],
  projects:[{id:'p1',name:'Creative Queue',workspace_id:'w1',status:'active',color:'#08e',visibility:vis,partner_edit}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,email:'a@example.test'},
            {id:'u2',full_name:'Vee Thitiphong',role:'internal',active:true,email:'v@example.test'},
            {id:'px',full_name:'Nok Designer',role:'freelancer',active:true,email:'nok@example.test'},
            {id:'pb',full_name:'Brand Contact',role:'partner',active:true,email:'bc@example.test'}],
  boardOwners:[{project_id:'p1',user_id:'me'}], wsOwners:[]});

 // 1. a Collaborate board: the dialog opens, says why guests can't be added, and offers the fix
 setup('collaborate','assigned');
 await projectMembersModal('p1'); await tick();
 const body=document.querySelector('.modal-body');
 r.opened = !!body;
 r.warned = /Switch it to/.test(body.textContent) && /Collaborate/.test(body.textContent);
 r.fixOffered = !!document.getElementById('pm-tovis');
 r.boxesOff = [...body.querySelectorAll('input[data-uid]')].every(i=>i.disabled) && document.getElementById('pm-save').disabled;
 r.noEditPickerYet = !document.getElementById('pm-pedit');
 // the fix writes the new visibility
 window.__calls.length=0; document.getElementById('pm-tovis').click(); await tick();
 const v=window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.madeShareable = v && v.payload.visibility==='shareable' && v.eq.id==='p1';
 closeModals();

 // 2. a Shareable board: the externals are pickable and the edit scope is there, defaulting safe
 setup('shareable', undefined);
 await projectMembersModal('p1'); await tick();
 const b2=document.querySelector('.modal-body');
 r.externals=[...b2.querySelectorAll('input[data-uid]')].map(i=>i.dataset.uid).sort().join(',');
 r.boxesOn=[...b2.querySelectorAll('input[data-uid]')].every(i=>!i.disabled);
 const pe=document.getElementById('pm-pedit');
 r.editOpts=[...pe.options].map(o=>o.value).join(',');
 r.editDefault=pe.value;
 r.editHelp=[...b2.querySelectorAll('.ihelp')].some(h=>/staff keep/.test(h.dataset.help||''));
 // staff never appear as addable guests, only as people on the board
 r.staffNotGuests = !/data-uid="u2"/.test(b2.innerHTML) && /Vee Thitiphong/.test(b2.textContent);
 // 3. saving writes the members and the scope together
 window.__calls.length=0;
 b2.querySelector('input[data-uid="pb"]').checked=true;
 pe.value='view';
 await document.getElementById('pm-save').onclick();
 const ins=window.__calls.find(c=>c.table==='project_members'&&c.op==='insert');
 const upd=window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.savedMember = ins && ins.payload[0].user_id==='pb' && ins.payload[0].project_id==='p1';
 r.savedScope = upd && upd.payload.partner_edit==='view' && upd.eq.id==='p1';
 // 4. an unchanged scope is not written again
 setup('shareable','assigned'); await projectMembersModal('p1'); await tick();
 window.__calls.length=0; await document.getElementById('pm-save').onclick();
 r.noPointlessWrite = !window.__calls.some(c=>c.table==='projects'&&c.op==='update');
 closeModals();
 // 5. the activity log is internal: partners get no history section at all
 S.me={id:'pb',role:'partner',full_name:'Brand Contact'}; S._taskHist=[];
 r.histHiddenPartner = historySectionHTML()==='';
 S.me={id:'nk',role:'freelancer',full_name:'Nok'};
 r.histHiddenFreelancer = historySectionHTML()==='';
 S.me={id:'me',role:'admin',full_name:'April'};
 r.histShownStaff = /Activity log/.test(historySectionHTML());
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('the dialog opens at all', r.opened);
check('a Collaborate board says why guests cannot be added, and offers the switch', r.warned && r.fixOffered);
check('on such a board the guest boxes and Save are disabled, and no edit scope is offered', r.boxesOff && r.noEditPickerYet);
check('Make Shareable writes the visibility', r.madeShareable);
check('on a Shareable board only partners and freelancers are addable', r.externals==='pb,px' && r.boxesOn && r.staffNotGuests);
check('the edit scope offers the three levels and defaults to assigned-only', r.editOpts==='assigned,everything,view' && r.editDefault==='assigned');
check('the scope explains that staff are unaffected', r.editHelp);
check('Save writes the membership and the scope together', r.savedMember && r.savedScope);
check('an unchanged scope is not written again', r.noPointlessWrite);
check('partners and freelancers get no activity log; staff do', r.histHiddenPartner && r.histHiddenFreelancer && r.histShownStaff);
if(!ok) process.exit(1); });
