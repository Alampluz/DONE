/* An automation is an AFTER trigger, so the row the server ends up holding can differ from
   the one we just wrote - a rule may have moved it to another group, set a status, reassigned
   it. The board used to keep showing the stale row until something re-read it, which made the
   rules look like they only ran when you pressed "Run timed checks now". echoAutomation()
   re-reads and reports; automationToast() says what happened. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__server={};
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,
 update(){return q;}, insert(){return q;}, delete(){return q;}, select(){return q;}, single(){return q;},
 eq(){return q;}, is(){return q;}, not(){return q;}, or(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;},
 then(r,j){ return Promise.resolve({data:(window.__server[t]||[]), error:null}).then(r,j); }};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}, rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 const toasts=[]; window.toast=(m)=>toasts.push(m);
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},
            {id:'u2',full_name:'Prim V',role:'internal',active:true}],
  _groups:[{id:'g1',name:'Open'},{id:'g2',name:'Solved'}],
  _tasks:[{id:'t1',title:'A',status:'todo',priority:'normal',assignee_id:null,due_date:null,group_id:'g1',archived_at:null},
          {id:'t2',title:'B',status:'todo',priority:'normal',assignee_id:null,due_date:null,group_id:'g1',archived_at:null}]});

 // 1. nothing moved: the server agrees with what we asked for -> no noise
 window.__server.tasks=[{id:'t1',status:'done',priority:'normal',assignee_id:null,due_date:null,group_id:'g1',archived_at:null}];
 S._tasks[0].status='done';
 r.quiet = (await echoAutomation('t1',{status:'done'})).length;

 // 2. a rule moved it to another group while we were only setting the status
 window.__server.tasks=[{id:'t1',status:'done',priority:'normal',assignee_id:null,due_date:null,group_id:'g2',archived_at:null}];
 const moved = await echoAutomation('t1',{status:'done'});
 r.movedN=moved.length; r.movedField=moved[0]&&moved[0].field; r.movedValue=moved[0]&&moved[0].value;
 r.cachePatched = S._tasks[0].group_id;                       // the cache now holds the truth
 automationToast(moved); r.toast = toasts[toasts.length-1];

 // 3. a rule overrode the very field we set (we asked for todo, the rule forced done)
 S._tasks[0].group_id='g2';
 window.__server.tasks=[{id:'t1',status:'done',priority:'normal',assignee_id:null,due_date:null,group_id:'g2',archived_at:null}];
 const over = await echoAutomation('t1',{status:'todo'});
 r.overField = over.map(x=>x.field).join(','); r.overValue = over[0]&&over[0].value;

 // 4. several fields at once, and the toast names the first and counts the rest
 S._tasks[0].status='todo'; S._tasks[0].group_id='g1'; S._tasks[0].assignee_id=null;
 window.__server.tasks=[{id:'t1',status:'done',priority:'urgent',assignee_id:'u2',due_date:null,group_id:'g2',archived_at:null}];
 const many = await echoAutomation('t1', null);
 r.manyN = many.length;
 automationToast(many); r.manyToast = toasts[toasts.length-1];

 // 5. a task the board is not holding is ignored rather than throwing
 window.__server.tasks=[{id:'zz',status:'done',priority:'normal',assignee_id:null,due_date:null,group_id:'g2',archived_at:null}];
 r.unknown = (await echoAutomation('zz', null)).length;
 // 6. no ids, and a failing read, both come back empty instead of blowing up the save
 r.none = (await echoAutomation([], null)).length;
 const _from=db.from; db.from=()=>{ throw new Error('network'); };
 r.offline = (await echoAutomation('t1', null)).length; db.from=_from;
 // 7. an empty change list says nothing at all
 const before=toasts.length; automationToast([]); r.silent = toasts.length===before;
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('a write the server agreed with reports nothing', r.quiet===0);
check('a group move behind our back is reported and cached', r.movedN===1 && r.movedField==='group_id' && r.movedValue==='g2' && r.cachePatched==='g2');
check('the toast names the group by name', /moved it to Solved/.test(r.toast||''));
check('a rule overriding the field we set is caught too', r.overField==='status' && r.overValue==='done');
check('several changes: all collected, toast names one and counts the rest', r.manyN===4 && /\(\+3 more\)/.test(r.manyToast||''));
check('rows the board is not holding are skipped', r.unknown===0);
check('no ids, or a failed read, returns empty instead of throwing', r.none===0 && r.offline===0);
check('nothing changed means no toast', r.silent);
if(!ok) process.exit(1); });
