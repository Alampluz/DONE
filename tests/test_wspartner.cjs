/* Partner access is a board grant, never a workspace one (April, 11 Sep 2026).
   The database refuses a workspace_members / workspace_owners row for an external
   account outright; this suite guards the UI half, so nobody is offered a tick that
   the server is going to reject. Three surfaces: the workspace Members dialog, the
   per-person Workspaces dialog, and Add user. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''), { runScripts:'outside-only', pretendToBeVisual:true });
const w = dom.window;
w.__calls = [];
w.__rows = {};
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(table)=>{
  const q={_t:table,_op:'select',_payload:null,_ids:null,_eq:{},
    update(p){q._op='update';q._payload=p;return q;},
    insert(p){q._op='insert';q._payload=p;return q;},
    delete(){q._op='delete';return q;},
    select(){return q;}, single(){return q;},
    eq(c,v){q._eq[c]=v;return q;}, in(c,ids){q._ids=ids;return q;}, order(){return q;},
    then(res,rej){ window.__calls.push({table:table,op:q._op,payload:q._payload,ids:q._ids,eq:{...q._eq}});
      const rows = window.__rows[table]||[];
      const data = q._op==='select' ? rows : {id:'new1'};
      return Promise.resolve({data,count:rows.length,error:null}).then(res,rej); }};
  return q;
};
window.supabase={createClient:()=>({from:window.__mkQuery,
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
  storage:{from:()=>({})},functions:{}})};
`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver = `
window.__run = async function(){
  const r={};
  try{
    const tick=()=>new Promise(x=>setTimeout(x,15));
    Object.assign(S,{
      me:{id:'me',role:'admin',full_name:'April',company_id:'c'},
      route:{view:'admin',id:null}, company:{name:'CREA'},
      workspaces:[{id:'w1',name:'Customer Service',color:'#0F766E',description:''},
                  {id:'w2',name:'Creative',color:'#7D3C55',description:''}],
      projects:[], teams:[], profiles:[
        {id:'me',full_name:'April',role:'admin',active:true,email:'a@example.test'},
        {id:'u2',full_name:'Som Internal',role:'internal',active:true,email:'som@example.test'},
        {id:'u3',full_name:'Nok Requester',role:'requester',active:true,email:'nok@example.test'},
        {id:'u4',full_name:'Ext Partner',role:'partner',active:true,email:'p@example.test'},
        {id:'u5',full_name:'Free Lance',role:'freelancer',active:true,email:'f@example.test'}],
      boardOwners:[], wsOwners:[]});
    window.refreshCore=async()=>{}; window.renderSidebar=()=>{}; window.renderAdmin=async()=>{}; window.toast=()=>{};

    r.assignable = JSON.stringify(ASSIGNABLE_ROLES);
    r.isExternalRole = [isExternalRole('partner'),isExternalRole('freelancer'),isExternalRole('internal')].join(',');

    // A. the workspace Members dialog offers internal and requester only, and points
    //    anyone looking for a partner at the board dialog instead
    window.__rows['workspace_members']=[{user_id:'u2',workspace_id:'w1'}];
    await teamMembersModal('w1'); await tick();
    const body=document.querySelector('.modal-body');
    r.wsBoxes=[...document.querySelectorAll('.modal input[data-uid]')].map(b=>b.dataset.uid).sort().join(',');
    r.wsNote=/Board members \\(partner access\\)/.test(body.textContent);
    closeModals();

    // B. the per-person dialog refuses an external outright, and still works for staff
    await userWorkspacesModal('u4'); await tick();
    r.partnerNoBoxes=document.querySelectorAll('.modal input[data-wid]').length;
    r.partnerMessage=/one board at a time/.test(document.querySelector('.modal-body').textContent);
    closeModals();
    await userWorkspacesModal('u5'); await tick();
    r.freelancerNoBoxes=document.querySelectorAll('.modal input[data-wid]').length;
    closeModals();
    window.__rows['workspace_members']=[{workspace_id:'w1'}];
    await userWorkspacesModal('u2'); await tick();
    r.internalStillHasBoxes=document.querySelectorAll('.modal input[data-wid]').length;
    closeModals();

    // C. Add user: the workspace ticks switch off for an external role and clear themselves,
    //    and nothing is written to workspace_members for one
    inviteUserModal();
    const sel=document.querySelector('#iu-role');
    const allOff=()=>[...document.querySelectorAll('#iu-ws input')].every(i=>i.disabled);
    const set=v=>{ sel.value=v; sel.onchange(); return allOff(); };
    r.inviteInternalOn = set('internal')===false;
    r.inviteRequesterOn = set('requester')===false;
    r.invitePartnerOff = set('partner')===true;
    r.inviteFreelancerOff = set('freelancer')===true;
    sel.value='internal'; sel.onchange();
    document.querySelector('#iu-ws input').checked=true;
    sel.value='partner'; sel.onchange();
    r.invitePartnerUnticked=[...document.querySelectorAll('#iu-ws input')].every(i=>!i.checked);
    r.invitePartnerNote=/Board members \\(partner access\\)/.test(document.querySelector('#iu-wsnote').innerHTML);
    closeModals();
  }catch(e){ r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / '); }
  return r;
};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('only internal and requester are workspace-assignable', r.assignable==='["internal","requester"]');
check('isExternalRole knows partner and freelancer, and nobody else', r.isExternalRole==='true,true,false');
check('the workspace Members dialog lists no external account', r.wsBoxes==='u2,u3');
check('it says where partners are added instead', r.wsNote);
check('the per-person dialog gives a partner no workspace ticks', r.partnerNoBoxes===0 && r.partnerMessage);
check('nor a freelancer', r.freelancerNoBoxes===0);
check('internal staff still get their ticks', r.internalStillHasBoxes===2);
check('Add user keeps the ticks for internal and requester', r.inviteInternalOn && r.inviteRequesterOn);
check('and switches them off for partner and freelancer', r.invitePartnerOff && r.inviteFreelancerOff);
check('switching to partner clears any tick already made, and explains why', r.invitePartnerUnticked && r.invitePartnerNote);
if(!ok) process.exit(1); });
