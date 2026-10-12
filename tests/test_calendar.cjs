/* Calendar view: grid shape, placement by local calendar day, the fold,
   month navigation, and that undated tasks are reported rather than dropped. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/'});   // a real origin so localStorage works
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>({limit:()=>Promise.resolve({data:[]})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

const driver=`window.__run=function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  projects:[{id:'p1',name:'Creative Queue'}],
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true,avatar_color:'#0F766E'}],
  _groups:[], _fields:[], _subs:{}});
 // the Calendar tab sets these two; navigation re-renders through renderBoardBody
 boardMode='calendar';

 const T=(id,title,due,status,priority)=>({id,title,due_date:due,status:status||'todo',priority:priority||'normal',assignee_id:'me'});
 // a fixed month so the assertions never drift: September 2026 (1 Sep is a Tuesday)
 calMonth = new Date(2026,8,1);

 const rows=[
   T('t1','Live frame','2026-09-09'),
   T('t2','SIS banner','2026-09-09','in_progress','urgent'),
   T('t3','GWP set','2026-09-09','done'),
   T('t4','KV resize','2026-09-09','review','high'),
   T('t5','Brief AW','2026-09-01'),
   T('t6','Month end','2026-09-30','blocked'),
   T('t7','Spills over','2026-10-02'),          // in the trailing week of the grid, so it shows
   T('t10','Far future','2026-11-20'),          // outside the six weeks entirely
   T('t8','No date',null),
   T('t9','No date either',undefined),
 ];

 // renderProject would have set this; the fold and the arrows re-render from it
 S._tasks = rows;

 // ---- pure helpers
 const first = calFirst();
 r.firstIsSep = first.getFullYear()===2026 && first.getMonth()===8 && first.getDate()===1;
 const cells = calGrid(first);
 r.cellCount = cells.length;                                  // 42
 r.startsMonday = cells[0].date.getDay()===1;
 r.firstCellKey = cells[0].key;                               // 31 Aug 2026 (Mon)
 r.lastCellKey  = cells[41].key;
 r.inMonthCount = cells.filter(c=>c.inMonth).length;          // 30 days in Sept
 const b = calBuckets(rows);
 r.undated = b.undated.length;                                // 2
 r.on9th = (b.by.get('2026-09-09')||[]).length;               // 4
 r.doneSortsLast = (b.by.get('2026-09-09')||[]).map(t=>t.id).indexOf('t3')===3;
 r.urgentSortsFirst = (b.by.get('2026-09-09')||[])[0].id==='t2';

 // a bare yyyy-mm-dd must land on its own day, not the one before (UTC+7 trap)
 r.parsedLocalDay = calKey(calParse('2026-09-01'))==='2026-09-01';

 // ---- rendering
 const host=w0.document.createElement('div'); host.id='board-body'; w0.document.body.appendChild(host);
 renderCalendar('p1', rows, host);
 r.renderedCells = host.querySelectorAll('.cal-cell').length;
 r.dowHeadings = host.querySelectorAll('.cal-dows>div').length;
 const day9 = host.querySelector('[data-day="2026-09-09"]');
 r.pillsOn9th = day9.querySelectorAll('.cal-pill').length;     // folded to 3
 r.hasMore = /\\+1 more/.test(day9.textContent);
 r.pillOpensTask = /openTask\\('t2'\\)/.test(day9.innerHTML);
 r.overdueMarked = host.querySelectorAll('.cal-pill.over').length > 0;
 r.title = host.querySelector('.cal-title').textContent;
 r.undatedNoted = /2 tasks have no due date/.test(host.textContent);
 r.elsewhereNoted = /1 is due outside the weeks shown/.test(host.textContent);  // t10, in November
 r.outsideMonthShown = !!host.querySelector('[data-day="2026-10-02"] .cal-pill');
 r.outsideMonthDimmed = host.querySelector('[data-day="2026-10-02"]').className.includes('out');

 // ---- the fold
 calToggleDay('p1','2026-09-09');
 r.pillsAfterExpand = host.querySelectorAll('[data-day="2026-09-09"] .cal-pill').length;   // 4
 r.hasShowLess = /Show less/.test(host.querySelector('[data-day="2026-09-09"]').textContent);
 calToggleDay('p1','2026-09-09');
 r.pillsAfterCollapse = host.querySelectorAll('[data-day="2026-09-09"] .cal-pill').length; // 3

 // ---- navigation (goes through renderBoardBody, like the real buttons)
 calMove('p1',1);  r.afterNext = host.querySelector('.cal-title').textContent;
 calMove('p1',-1); r.afterPrev = host.querySelector('.cal-title').textContent;
 calMove('p1',0);  r.todayResets = calMonth===null;

 // filters are applied before the view sees the rows: an empty set renders an empty grid
 calMonth = new Date(2026,8,1);
 renderCalendar('p1', [], host);
 r.emptyStillDrawsGrid = host.querySelectorAll('.cal-cell').length===42
   && host.querySelectorAll('.cal-pill').length===0;

 // ---- workspace calendar: every board on one grid, board legend toggles
 S.projects = [{id:'p1',name:'Creative Queue',workspace_id:'w1',color:'#0F766E',status:'active'},
               {id:'p2',name:'Brand Review',workspace_id:'w1',color:'#B97A08',status:'active'},
               {id:'p3',name:'Archived one',workspace_id:'w1',color:'#999',status:'archived'},
               {id:'p9',name:'Other workspace',workspace_id:'w2',color:'#333',status:'active'}];
 S.workspaces = [{id:'w1',name:'Creative'}];
 r.wsTabHasCalendar = wsTabsHTML('w1','calendar').includes('#/ws/w1/calendar');
 const wsHost=w0.document.createElement('div'); wsHost.id='ws-cal-body'; w0.document.body.appendChild(wsHost);
 S._wsCalRows = [
   {...T('a1','KV set','2026-09-09'), project_id:'p1', _pname:'Creative Queue', _pcolor:'#0F766E'},
   {...T('a2','Copy check','2026-09-09'), project_id:'p2', _pname:'Brand Review', _pcolor:'#B97A08'},
   {...T('a3','Retouch','2026-09-10'), project_id:'p1', _pname:'Creative Queue', _pcolor:'#0F766E'},
 ];
 calWsHidden = new Set(); calWsFor = 'w1'; calMonth = new Date(2026,8,1);
 renderWorkspaceCalendarBody('w1');
 r.wsLegendChips = wsHost.querySelectorAll('.cal-lg:not(.cal-pick)').length;   // the Boards picker pill is not a board chip             // 2 active boards, archived left out
 r.wsLegendCounts = [...wsHost.querySelectorAll('.cal-lgn')].map(e=>e.textContent).join(',');   // "2,1"
 r.wsPills = wsHost.querySelectorAll('.cal-pill').length;                 // 3
 r.wsPillNamesBoard = /Brand Review/.test(wsHost.querySelector('[data-day="2026-09-09"] .cal-pill[title*="Copy check"]').getAttribute('title'));
 r.wsPillHasBoardDot = wsHost.querySelectorAll('.cal-pill .cal-bdot').length===3;
 calWsToggle('w1','p2');
 r.wsPillsAfterHide = wsHost.querySelectorAll('.cal-pill').length;        // 2
 r.wsHiddenChipMarked = wsHost.querySelector('.cal-lg.off') && /Brand Review/.test(wsHost.querySelector('.cal-lg.off').textContent);
 calWsToggle('w1','p2');
 r.wsPillsAfterShow = wsHost.querySelectorAll('.cal-pill').length;        // 3
 // month arrows redraw the workspace grid, not a board
 calMove('w1',1);
 r.wsNavKeepsLegend = wsHost.querySelectorAll('.cal-lg:not(.cal-pick)').length===2 && /October 2026/.test(wsHost.querySelector('.cal-title').textContent);
 calMove('w1',-1);

 // ---- My calendar on Home: List / Calendar toggle over the same person's tasks
 const home=w0.document.createElement('div');
 home.innerHTML = '<div class="tabs"><button class="tab home-mode" data-m="list"></button><button class="tab home-mode" data-m="calendar"></button></div><div id="home-tasks-body"></div>';
 w0.document.body.appendChild(home);
 S._myTasks = [T('m1','Open one','2026-09-15'), T('m2','Open two',null)];
 S._myCalRows = [
   {...T('m1','Open one','2026-09-15'), project_id:'p1', _pname:'Creative Queue', _pcolor:'#0F766E'},
   {...T('m3','Done one','2026-09-16','done'), project_id:'p2', _pname:'Brand Review', _pcolor:'#B97A08'},
 ];
 calMonth = new Date(2026,8,1);
 setHomeTasksMode('list');
 r.homeListRenders = !!home.querySelector('#home-tasks-body table') && home.querySelector('.home-mode[data-m="list"]').classList.contains('active');
 setHomeTasksMode('calendar');
 r.homeCalRenders = home.querySelectorAll('#home-tasks-body .cal-cell').length===42
   && home.querySelector('.home-mode[data-m="calendar"]').classList.contains('active');
 r.homeCalPills = home.querySelectorAll('#home-tasks-body .cal-pill').length;           // 2 - done tasks stay on the grid
 r.homeCalPillNamesBoard = /Brand Review/.test(home.querySelector('[data-day="2026-09-16"] .cal-pill').getAttribute('title'));
 r.homeModeSticks = w0.localStorage.getItem('workos.homeTasks')==='calendar';
 calMove('home',1);
 r.homeNavRedrawsHome = /October 2026/.test(home.querySelector('#home-tasks-body .cal-title').textContent);
 calMove('home',-1);
 setHomeTasksMode('list');
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,3).join(' / ');}return r;};`;

w.eval('var w0=window;');
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);}
let r={};
try{ r=w.eval('window.__run()'); }catch(e){ console.log('RUN ERROR:',e.message); process.exit(1); }
if(r.error){ console.log('DRIVER ERROR:',r.error); process.exit(1); }

let pass=0, fail=0;
const ok=(name,cond)=>{ if(cond) pass++; else { fail++; console.log('FAIL:',name); } };
ok('September 2026 is the month under test', r.firstIsSep);
ok('grid is 42 cells', r.cellCount===42 && r.renderedCells===42);
ok('weeks start on Monday', r.startsMonday && r.firstCellKey==='2026-08-31');
ok('grid runs to the trailing week', r.lastCellKey==='2026-10-11');
ok('30 cells belong to September', r.inMonthCount===30);
ok('seven day-of-week headings', r.dowHeadings===7);
ok('a bare yyyy-mm-dd stays on its own day', r.parsedLocalDay);
ok('four tasks bucket onto the 9th', r.on9th===4);
ok('urgent sorts first, done sorts last', r.urgentSortsFirst && r.doneSortsLast);
ok('a day folds at three tasks', r.pillsOn9th===3 && r.hasMore);
ok('a pill opens its task', r.pillOpensTask);
ok('overdue tasks are marked', r.overdueMarked);
ok('month title reads as a month', /September 2026/.test(r.title));
ok('tasks from the next month still render in the trailing week', r.outsideMonthShown);
ok('out-of-month cells are dimmed', r.outsideMonthDimmed);
ok('undated tasks are reported, not dropped', r.undated===2 && r.undatedNoted);
ok('tasks due in another month are accounted for', r.elsewhereNoted);
ok('expanding a day shows them all', r.pillsAfterExpand===4 && r.hasShowLess);
ok('collapsing folds it back', r.pillsAfterCollapse===3);
ok('next month advances the title', /October 2026/.test(r.afterNext));
ok('previous month goes back', /September 2026/.test(r.afterPrev));
ok('Today clears the pinned month', r.todayResets);
ok('an empty filter result still draws the grid', r.emptyStillDrawsGrid);
ok('workspace tabs include Calendar', r.wsTabHasCalendar);
ok('workspace legend lists active boards only', r.wsLegendChips===2 && r.wsLegendCounts==='2,1');
ok('workspace grid shows every board\'s tasks', r.wsPills===3 && r.wsPillHasBoardDot);
ok('workspace pills name their board', r.wsPillNamesBoard);
ok('hiding a board in the legend removes its tasks', r.wsPillsAfterHide===2 && r.wsHiddenChipMarked);
ok('showing it again brings them back', r.wsPillsAfterShow===3);
ok('month arrows redraw the workspace grid with the legend', r.wsNavKeepsLegend);
ok('Home: List mode renders the task table', r.homeListRenders);
ok('Home: Calendar mode renders the grid and marks its tab', r.homeCalRenders);
ok('Home: done tasks stay on the grid, pills name their board', r.homeCalPills===2 && r.homeCalPillNamesBoard);
ok('Home: the chosen mode sticks in localStorage', r.homeModeSticks);
ok('Home: month arrows redraw the Home grid', r.homeNavRedrawsHome);
console.log(`calendar: ${pass} passed, ${fail} failed`);
process.exit(fail? 1 : 0);
