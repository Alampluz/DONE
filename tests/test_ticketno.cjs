/* Ticket numbers. The database assigns <board key>-YYMMDD-NNN on insert and never changes
   it; the app's job is to show it (table, kanban, drawer, export), to let the board's key be
   set, and to let someone paste a number into the filter box and find the task. A board with
   no key has unnumbered tasks, so every one of these must tolerate a blank. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={update(){return q;},insert(){return q;},delete(){return q;},select(){return q;},single(){return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(){return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){return Promise.resolve({data:[],error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'CS Team',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries — Q3 2026',status:'active',color:'#08e',key:'CS'},
            {id:'p2',workspace_id:'w1',name:'No Key Board',status:'active',color:'#08e',key:null}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true}],
  _groups:[{id:'g1',name:'Open'}], _fields:[], _subs:{}, _tasks:[]});
 const numbered={id:'t1',project_id:'p1',title:'260825AGY0RPNR',status:'todo',priority:'normal',
   assignee_id:null,due_date:null,group_id:'g1',archived_at:null,ticket_no:'CS-260908-001',created_at:'2026-09-08T03:00:00Z'};
 const bare={id:'t2',project_id:'p2',title:'Unnumbered',status:'todo',priority:'normal',
   assignee_id:null,due_date:null,group_id:'g1',archived_at:null,ticket_no:null,created_at:'2026-09-08T03:00:00Z'};
 S._tasks=[numbered,bare];

 // 1. the tag: shown for a numbered task, absent (not "null", not empty markup) without one
 r.tag = ticketTag(numbered); r.tagBare = ticketTag(bare);
 r.tagText = (()=>{const d=document.createElement('div');d.innerHTML=r.tag;return d.textContent;})();

 // 2. table row and kanban card both carry it, and neither breaks without one
 const row = tvRowHTML(numbered, [], null), rowBare = tvRowHTML(bare, [], null);
 r.rowHas = /CS-260908-001/.test(row) && /class="tkt"/.test(row);
 r.rowBareOk = !/tkt/.test(rowBare) && /Unnumbered/.test(rowBare);
 r.cardHas = /CS-260908-001/.test(taskCard(numbered));
 r.cardBareOk = !/tkt/.test(taskCard(bare));

 // 3. the filter box finds a task by its number, in either case, and by a fragment
 const f = (q)=>{ bfGet('p1').q = q; return bfApply('p1', S._tasks).map(t=>t.id).join(','); };
 r.byFull = f('CS-260908-001'); r.byLower = f('cs-260908-001'); r.byFragment = f('260908');
 r.byTitleStill = f('AGY0RPNR'); r.cleared = f('');

 // 4. a board key is cleaned to letters and digits, upper case, 6 max
 r.clean = [boardKeyClean('cs'), boardKeyClean('c-s 1!'), boardKeyClean('abcdefghij'), boardKeyClean(''), boardKeyClean(null)].join('|');
 // 5. and suggested from the board name, skipping filler and bare numbers
 r.sug = [boardKeySuggest('CS Inquiries — Q3 2026'), boardKeySuggest('Creative Queue'),
          boardKeySuggest('Brands Onboard – Offboard'), boardKeySuggest('BD Pipeline'),
          boardKeySuggest('Escalations'), boardKeySuggest('The Board of Q1 2026'), boardKeySuggest('')].join('|');
 r.sugAcronym = [boardKeySuggest('CS Inquiries'), boardKeySuggest('BD Pipeline'), boardKeySuggest('cs inquiries')].join('|');

 // 6. Edit board offers the prefix, pre-filled, and New board suggests as you type the name
 editProjectModal('p1');
 const epk = document.getElementById('ep-key');
 r.epKey = epk && epk.value; r.epHelp = !!document.querySelector('#ep-key') && /-260908-001/.test(document.body.innerHTML);
 closeModals();
 newProjectModal('w1');
 const pjn = document.getElementById('pj-name'), pjk = document.getElementById('pj-key');
 pjn.value='Escalations Queue'; pjKeySuggest(pjn); r.pjAuto = pjk.value;
 pjk.dataset.touched='1'; pjk.value='ESC'; pjn.value='Something Else'; pjKeySuggest(pjn);
 r.pjRespectsTyped = pjk.value;
 closeModals();

 // 7. a duplicate prefix is explained, not shown as a constraint name
 r.dupMsg = boardSaveError({message:'duplicate key value violates unique constraint "projects_company_key_uq"'});
 r.otherMsg = boardSaveError({message:'some other failure'});
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
const r=w.eval('window.__run()'); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('the tag renders the number, and nothing at all without one', /CS-260908-001/.test(r.tag||'') && r.tagBare==='' && r.tagText==='CS-260908-001');
check('table row shows it; a keyless board still renders', r.rowHas && r.rowBareOk);
check('kanban card shows it; a keyless board still renders', r.cardHas && r.cardBareOk);
check('filter finds a task by number, any case, or a fragment', r.byFull==='t1' && r.byLower==='t1' && r.byFragment==='t1');
check('filtering by title still works, and clearing restores both', r.byTitleStill==='t1' && r.cleared==='t1,t2');
check('a key is cleaned to <=6 upper letters/digits', r.clean==='CS|CS1|ABCDEF||');
check('a key is suggested from the board name', r.sug==='CS|CQ|BOO|BD|ESC|BOA|');
check('a name opening with an acronym keeps it; a lower-case one gets initials', r.sugAcronym==='CS|BD|CI');
check('Edit board pre-fills the current prefix and shows the format', r.epKey==='CS' && r.epHelp);
check('New board follows the name until you type your own', r.pjAuto==='EQ' && r.pjRespectsTyped==='ESC');
check('a clashing prefix is explained in words', /different one/.test(r.dupMsg||'') && r.otherMsg==='some other failure');
if(!ok) process.exit(1);
