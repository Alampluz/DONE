/* A board that has switched Due date off plots its calendar by the day each task was
   completed (solved-per-day), drops the Overdue chip, and says so in the view picker. Boards
   that still use due dates are untouched. Also guards the id-chunking that keeps "select all"
   on a 3,000-row board from putting 3,000 ids in one URL. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[];
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_ids:null,update(){return q;},insert(){return q;},delete(){return q;},select(){return q;},single(){return q;},
 eq(){return q;},is(){return q;},not(){return q;},or(){return q;},in(c,v){q._ids=v;return q;},order(){return q;},limit(){return q;},range(){return q;},
 then(r,j){window.__calls.push(q._ids?q._ids.length:0);return Promise.resolve({data:[],error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},rpc:async()=>({data:{},error:null})})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin'},profiles:[{id:'me',full_name:'April',role:'admin',active:true}],
  projects:[{id:'cs',name:'CS',status:'active',field_config:{due_date:{hidden:true}}},
            {id:'bd',name:'BD',status:'active',field_config:{}}], _groups:[], _fields:[], _subs:{}, _tasks:[]});
 // 1. the basis follows the hidden flag
 r.basis = calBasis('cs')+','+calBasis('bd');
 // 2. dates: completed_at is a UTC timestamp; the Bangkok day is what counts
 const t = {id:'t1',title:'A',status:'done',due_date:'2026-09-01',completed_at:'2026-09-08T18:30:00Z'};   // 01:30 on the 9th in Bangkok
 const local = new Date('2026-09-08T18:30:00Z');
 r.completedKey = calKey(calDateOf(t,'completed'))===calKey(local);
 r.dueKey = calKey(calDateOf(t,'due'))==='2026-09-01' || calKey(calDateOf(t,'due'))===calKey(calParse('2026-09-01'));
 r.openHasNoDate = calDateOf({status:'todo',due_date:'2026-09-01',completed_at:null},'completed')===null;
 // 3. buckets: an open task is "undated" on the completed basis but dated on the due basis
 const rows=[t,{id:'t2',title:'B',status:'todo',due_date:'2026-09-03',completed_at:null}];
 r.completedUndated = calBuckets(rows,'completed').undated.length;
 r.dueUndated = calBuckets(rows,'due').undated.length;
 // 4. the calendar wording follows the basis
 calMonth = new Date(2026,8,1);
 const rowsD = rows.concat([{id:'t9',title:'D',status:'todo',due_date:null,completed_at:null}]);   // one with no due date at all
 const htmlC = calendarHTML('cs', rows, {basis:'completed'}), htmlD = calendarHTML('bd', rowsD, {basis:'due'});
 r.wordsC = /not been completed yet/.test(htmlC) && !/no due date/.test(htmlC);
 r.wordsD = /no due date/.test(htmlD) && !/not been completed/.test(htmlD);
 // 5. nothing is "overdue" on a completed-date calendar
 const late={id:'t3',title:'C',status:'todo',due_date:'2020-01-01',completed_at:'2026-09-08T03:00:00Z'};
 r.noOverdueC = !/cal-pill over/.test(calPill(late,'completed')); r.overdueD = /cal-pill over/.test(calPill(late,'due'));
 // 6. Overdue chip offered only where due dates exist; a saved 'overdue' on CS is ignored
 r.chipCS = BF_QUICK.filter(x=>bfQuickOffered('cs',x)).map(x=>x.k).join(',');
 r.chipBD = BF_QUICK.filter(x=>bfQuickOffered('bd',x)).map(x=>x.k).join(',');
 bfGet('cs').quick='overdue'; r.ignoredSaved = bfApply('cs', rows).length===rows.length; bfGet('cs').quick='';
 // 7. the view picker describes what this board's calendar plots
 const btn=document.createElement('button'); document.body.appendChild(btn);
 viewMenu(btn,'cs'); r.descCS = [...document.querySelectorAll('#tvmenu .ihelp')].some(i=>/completed/.test(i.dataset.help)); document.getElementById('tvmenu').remove();
 viewMenu(btn,'bd'); r.descBD = [...document.querySelectorAll('#tvmenu .ihelp')].some(i=>/due dates/.test(i.dataset.help)); document.getElementById('tvmenu').remove();
 // 8. chunking: 3,043 ids never travel in one request
 window.__calls=[]; const many=Array.from({length:3043},(_,i)=>'id'+i);
 await forIdChunks(many, part=>db.from('tasks').update({x:1}).in('id',part));
 r.chunkCalls = window.__calls.length; r.chunkMax = Math.max(...window.__calls); r.chunkSum = window.__calls.reduce((a,b)=>a+b,0);
 window.__calls=[]; await echoAutomation(many, null);
 r.echoMax = Math.max(...window.__calls);
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('basis follows the hidden Due date flag', r.basis==='completed,due');
check('completed_at is read as a Bangkok day; open tasks have no completed date', r.completedKey && r.dueKey && r.openHasNoDate);
check('an open task is undated on the completed basis, dated on the due basis', r.completedUndated===1 && r.dueUndated===0);
check('footer wording follows the basis', r.wordsC && r.wordsD);
check('nothing is overdue on a completed-date calendar', r.noOverdueC && r.overdueD);
check('Overdue chip only where due dates exist; a saved one is ignored', !/overdue/.test(r.chipCS) && /overdue/.test(r.chipBD) && r.ignoredSaved);
check('view picker describes the calendar per board', r.descCS && r.descBD);
check('3,043 ids go out in slices of at most 200, none lost', r.chunkCalls===16 && r.chunkMax===200 && r.chunkSum===3043 && r.echoMax===200);
if(!ok) process.exit(1); });
