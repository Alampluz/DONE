/* Quick filter chips on the board filter bar: My open / Unassigned / Urgent open / Overdue /
   New this week / Done this week. One chip at a time, remembered per board in localStorage,
   counted as an active filter, cleared by Clear. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 const PID='p1'; const now=new Date(); const iso=(d)=>new Date(now.getTime()-d*86400000).toISOString(); const day=(d)=>iso(d).slice(0,10);
 Object.assign(S,{me:{id:'me',role:'internal',full_name:'Vee'}, profiles:[{id:'me',full_name:'Vee',role:'internal',active:true}],
   projects:[{id:PID,name:'CS',workspace_id:'w',edit_preset:'everything',status:'active'}], workspaces:[{id:'w',name:'CS'}], brandsList:[], _groups:[], _fields:[], _deps:[], _subs:{}});
 const rows=[
  {id:'a',project_id:PID,title:'mine open',status:'todo',priority:'normal',assignee_id:'me',created_at:iso(20)},
  {id:'b',project_id:PID,title:'mine done',status:'done',priority:'normal',assignee_id:'me',created_at:iso(20),completed_at:iso(2)},
  {id:'c',project_id:PID,title:'nobody',status:'in_progress',priority:'urgent',assignee_id:null,created_at:iso(1)},
  {id:'d',project_id:PID,title:'late',status:'todo',priority:'low',assignee_id:'x',due_date:day(3),created_at:iso(40)},
  {id:'e',project_id:PID,title:'old done',status:'done',priority:'normal',assignee_id:'x',created_at:iso(40),completed_at:iso(20)},
 ];
 localStorage.removeItem('workos.quick.'+PID); delete boardFilters[PID];
 const names=q=>{ bfGet(PID).quick=q; return bfApply(PID, rows).map(t=>t.id).sort().join(','); };
 r.mine=names('mine'); r.unassigned=names('unassigned'); r.urgent=names('urgent'); r.overdue=names('overdue'); r.new7=names('new7'); r.done7=names('done7'); r.none=names('');
 // chips render, active one highlighted, counted as a filter
 bfGet(PID).quick='mine'; const bar=filterBarHTML(PID);
 r.chips=(bar.match(/class="bf-chip/g)||[]).length; r.activeChip=/bf-chip on" onclick="bfQuick\\('p1','mine'\\)">My open/.test(bar); r.count=bfActiveCount(PID); r.clearBtn=/Clear 1 filter/.test(bar);
 // toggling persists, toggling the same chip again clears it
 const _rp=window.renderProject; window.renderProject=()=>{}; 
 bfQuick(PID,'overdue'); r.saved=localStorage.getItem('workos.quick.'+PID); r.after=bfGet(PID).quick;
 bfQuick(PID,'overdue'); r.toggledOff=bfGet(PID).quick; r.savedOff=localStorage.getItem('workos.quick.'+PID);
 bfQuick(PID,'done7'); delete boardFilters[PID]; r.reloaded=bfGet(PID).quick;           // a fresh bfGet reads it back
 bfClear(PID); r.cleared=bfGet(PID).quick; r.clearedStore=localStorage.getItem('workos.quick.'+PID);
 window.renderProject=_rp;
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
const r=JSON.parse(w.eval('window.__run()')); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('My open = my not-done tasks', r.mine==='a');
check('Unassigned = open with nobody', r.unassigned==='c');
check('Urgent open', r.urgent==='c');
check('Overdue = open, due date passed', r.overdue==='d');
check('New this week by created_at', r.new7==='c');
check('Done this week by completed_at', r.done7==='b');
check('no chip = everything', r.none==='a,b,c,d,e');
check('six chips, active one highlighted and counted', r.chips===6 && r.activeChip && r.count===1 && r.clearBtn);
check('chip choice is remembered per board and toggles off', r.saved==='overdue' && r.after==='overdue' && r.toggledOff==='' && r.savedOff===null && r.reloaded==='done7');
check('Clear removes the chip and the memory', r.cleared==='' && r.clearedStore===null);
if(!ok) process.exit(1);
