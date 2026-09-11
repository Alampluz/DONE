const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''), { runScripts:'outside-only', pretendToBeVisual:true });
const w = dom.window;
w.__calls = [];
w.__rows = {};   // table -> rows returned by select
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
      const data = q._op==='select' ? (window.__rows[table]||[]) : {id:'new1'};
      return Promise.resolve({data,count:0,error:null}).then(res,rej); }};
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
    Object.assign(S,{
      me:{id:'me',role:'admin',full_name:'April'},
      route:{view:'admin',id:null}, company:{name:'CREA'},
      workspaces:[{id:'w1',name:'Commercial Team',color:'#0F766E',description:''},
                  {id:'w2',name:'Creative Team',color:'#7D3C55',description:''},
                  {id:'w3',name:'Tech Team',color:'#6E56B8',description:''}],
      projects:[], profiles:[
        {id:'me',full_name:'April',role:'admin',active:true,email:'a@example.test'},
        {id:'u2',full_name:'Som Internal',role:'internal',active:true,email:'som@example.test'},
        {id:'u3',full_name:'Nok Commercial',role:'requester',active:true,email:'nok@example.test'},
        {id:'u4',full_name:'Ext Partner',role:'partner',active:true,email:'p@x.com'},
        {id:'u5',full_name:'Prim V',role:'management',active:true,email:'prim@example.test'},
      ],
    });
    refreshCore = async()=>{}; renderSidebar=()=>{}; renderAdmin=async()=>{};

    // --- A. workspace Members modal includes requesters as well as internal staff.
    //        Partners and freelancers are NOT here — an external account is a board
    //        grant only; test_wspartner.cjs is the suite that asserts that.
    window.__rows['workspace_members']=[{user_id:'u2',workspace_id:'w1'},{user_id:'u3',workspace_id:'w1'},{user_id:'u3',workspace_id:'w2'}];
    await teamMembersModal('w1');
    const boxes=[...document.querySelectorAll('.modal input[data-uid]')];
    r.memberCheckboxUsers = boxes.map(b=>b.dataset.uid).sort();     // expect u2,u3
    r.memberCheckedHere = boxes.filter(b=>b.checked).map(b=>b.dataset.uid).sort(); // u2,u3
    r.showsOtherWsChip = /\\+1 other workspace/.test(document.querySelector('.modal-body').textContent);
    r.showsAlwaysAccess = /Always has access/.test(document.querySelector('.modal-body').textContent);
    r.saysMultiAllowed = /as many workspaces as you like/.test(document.querySelector('.modal-body').textContent);
    closeModals();

    // --- B. per-user modal: tick many workspaces for one person
    window.__rows['workspace_members']=[{workspace_id:'w1'}];
    await userWorkspacesModal('u3');
    const wb=[...document.querySelectorAll('.modal input[data-wid]')];
    r.userWsOptions = wb.length;                                    // expect 3
    r.userWsPrechecked = wb.filter(b=>b.checked).map(b=>b.dataset.wid); // expect [w1]
    document.querySelector('#uw-all').click();
    r.afterSelectAll = wb.filter(b=>b.checked).length;              // expect 3
    window.__calls.length=0;
    document.querySelector('#uw-save').click();
    await new Promise(x=>setTimeout(x,80));
    const ins = window.__calls.find(c=>c.table==='workspace_members' && c.op==='insert');
    r.insertedWorkspaces = ins ? ins.payload.map(p=>p.workspace_id).sort() : null;  // expect w2,w3
    r.insertedUser = ins ? ins.payload[0].user_id : null;
    r.deleteCalled = window.__calls.some(c=>c.op==='delete');       // expect false
    closeModals();

    // --- C. admin/management short-circuit
    await userWorkspacesModal('u5');
    r.mgmtNoCheckboxes = document.querySelectorAll('.modal input[data-wid]').length; // expect 0
    r.mgmtMessage = /every workspace/.test(document.querySelector('.modal-body').textContent);
    closeModals();

    // --- D. invite modal offers workspace ticks, disabled for admin role
    inviteUserModal();
    const iw=[...document.querySelectorAll('#iu-ws input')];
    r.inviteWsOptions = iw.length;                                  // expect 3
    r.inviteEnabledForInternal = !iw[0].disabled;                   // default role internal -> true
    const sel=document.querySelector('#iu-role'); sel.value='admin'; sel.onchange();
    r.inviteDisabledForAdmin = [...document.querySelectorAll('#iu-ws input')].every(i=>i.disabled);
    sel.value='requester'; sel.onchange();
    r.inviteEnabledForRequester = [...document.querySelectorAll('#iu-ws input')].every(i=>!i.disabled);
    closeModals();
  }catch(e){ r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / '); }
  return r;
};`;
try{ w.eval(scripts.join('\n')+'\n'+driver); }catch(e){ console.log('EVAL ERROR:',e.message); }
(async()=>{ try{ console.log(JSON.stringify(await w.eval('window.__run()'),null,2)); }catch(e){ console.log('RUN ERROR:',e.message); } process.exit(0); })();
