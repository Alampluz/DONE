/* Request numbers follow the workspace board (27 Oct 2026). A request that produced a task on a board
   shows the task's ticket number (e.g. CNL-261022-001) in the Requests list and in the request modal;
   a request with no board task keeps its WO-<n> intake number. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.__sel={};
window.__mkQuery=(t)=>{const q={_t:t,_single:false,
 select(){return q;}, insert(){return q;}, update(){return q;}, delete(){return q;}, single(){q._single=true;return q;},
 eq(){return q;}, neq(){return q;}, is(){return q;}, not(){return q;}, or(){return q;}, in(){return q;}, lt(){return q;}, gt(){return q;}, gte(){return q;}, lte(){return q;}, like(){return q;}, ilike(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
 then(res,rej){ const d=(window.__sel[t]||[]); return Promise.resolve({data:q._single?(d[0]||null):d,error:null,count:d.length}).then(res,rej);}};
 return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}, rpc:async()=>({data:[],error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{nav:1, me:{id:'me',role:'admin',full_name:'April',company_id:'co1'},route:{view:'requests'},
  workspaces:[], projects:[], requestTypes:[{id:'rt1',name:'Create New Listing',fields:[]}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true}]});
 r.helperBoard = reqNo({ticket_no:1013, board_ticket_no:'CNL-261022-001'});
 r.helperWO    = reqNo({ticket_no:42, board_ticket_no:null});
 r.helperNone  = reqNo({});
 window.__sel.requests=[
  {id:'r1',ticket_no:1013,board_ticket_no:'CNL-261022-001',title:'TEST',status:'in_progress',priority:'normal',request_type_id:'rt1',submitted_by:'me',data:{},created_at:'2026-10-22T05:00:00Z',project_id:'p1'},
  {id:'r2',ticket_no:42,board_ticket_no:null,title:'Broken banner',status:'submitted',priority:'normal',request_type_id:'rt1',submitted_by:'me',data:{},created_at:'2026-10-21T05:00:00Z',project_id:null}];
 window.__sel.comments=[]; window.__sel.approvals=[]; window.__sel.attachments=[]; window.__sel.activity_log=[];
 await renderRequests();
 const txt=document.querySelector('#content').textContent;
 r.listBoard = txt.includes('CNL-261022-001');
 r.listWO    = txt.includes('WO-42');
 r.listNoWO1013 = !txt.includes('WO-1013');
 window.__sel.requests=[window.__sel.requests[0]];
 await openRequest('r1');
 const head=document.querySelector('#modal-root .modal-head');
 r.modalBoard = !!head && head.textContent.includes('CNL-261022-001') && !head.textContent.includes('WO-');
}catch(e){r.error=String(e&&e.stack||e);} return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{
  let fail=0; const check=(n,ok)=>{ console.log((ok?'PASS ':'FAIL ')+n); if(!ok) fail++; };
  check('reqNo prefers the board ticket number', r.helperBoard==='CNL-261022-001');
  check('reqNo falls back to WO-<n>', r.helperWO==='WO-42');
  check('reqNo is empty without a number', r.helperNone==='');
  check('Requests list shows the board number for a request with a task', r.listBoard && r.listNoWO1013);
  check('Requests list keeps WO-<n> for a request without a board task', r.listWO);
  check('Request modal header shows the board number', r.modalBoard);
  if(r.error){ console.log(r.error); fail++; }
  process.exit(fail?1:0);
});
