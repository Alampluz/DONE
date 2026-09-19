/* Navigation races and the dashboard's own widget scope.
 *
 * 18 Sep 2026: clicking Campaigns showed the Operations Dashboard. renderCampaigns is
 * synchronous and painted immediately; renderDashboard was still awaiting its widget query
 * and painted over it when that resolved. Same screen also showed every board-report widget,
 * because the dashboard query filtered workspace_id but not project_id.
 *
 * C is a source-level lint, so a NEW async renderer that paints #content after an await
 * without a navStale() guard fails here rather than in front of April.
 */
const fs = require('fs'), { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.__isCalls = [];
w.__gate = null;

w.eval(`
window.scrollTo=()=>{};
/* Every query resolves only when the test opens the gate, so the race is deterministic. */
window.__mkQuery=(t)=>{const q={_t:t,_eq:{},
 select(){return q;}, single(){return q;}, insert(){return q;}, update(){return q;}, delete(){return q;},
 eq(c,v){q._eq[c]=v;return q;},
 is(c,v){window.__isCalls.push(t+'.'+c+'='+String(v));return q;},
 in(){return q;}, order(){return q;}, limit(){return q;}, gte(){return q;}, lte(){return q;},
 then(res,rej){
   const p = window.__gate
     ? window.__gate.then(()=>({data:window.__sel[t]||[],error:null}))
     : Promise.resolve({data:window.__sel[t]||[],error:null});
   return p.then(res,rej);}};return q;};
window.__sel={};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const driver = `window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',active:true},
  workspaces:[{id:'w1',name:'CS Team',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'}],
  requestTypes:[], _groups:[], _fields:[], _subs:{}, _tasksAll:[], _tasks:[]});

 /* ---- A. the dashboard must not paint over a view you navigated to while it loaded ---- */
 let open; window.__gate = new Promise(res=>{ open = res; });
 location.hash='#/dashboard'; navigate('#/dashboard');     // starts, then blocks on the gate
 r.navAfterDashboard = S.nav;
 location.hash='#/campaigns'; navigate('#/campaigns');     // synchronous, paints at once
 r.navAfterCampaigns = S.nav;
 r.bumped = S.nav === r.navAfterDashboard + 1;
 r.campaignsPaintedFirst = /Campaigns/.test(document.getElementById('content').textContent);
 open();                                                   // dashboard's query now resolves
 await new Promise(x=>setTimeout(x,80));
 const body = document.getElementById('content').textContent;
 r.dashboardDidNotClobber = !/Operations Dashboard/.test(body);
 r.campaignsStillShowing   = /Campaigns/.test(body);
 r.routeStillCampaigns     = S.route.view === 'campaigns';

 /* ---- B. the personal dashboard asks only for its own widgets ---- */
 window.__gate = null; window.__isCalls.length = 0;
 location.hash='#/dashboard'; navigate('#/dashboard');
 await new Promise(x=>setTimeout(x,80));
 r.filtersWorkspace = window.__isCalls.includes('dashboard_widgets.workspace_id=null');
 r.filtersProject   = window.__isCalls.includes('dashboard_widgets.project_id=null');
 r.dashboardRenders = /Operations Dashboard/.test(document.getElementById('content').textContent);

 /* ---- C. lint: every async renderer painting #content after an await carries a guard ---- */
 const src = window.__SRC;
 const lines = src.split('\\n');
 const starts = [];
 lines.forEach((l,i)=>{ const m=/^(?:async )?function (\\w+)\\(/.exec(l); if(m) starts.push([i,m[1],l.startsWith('async')]); });
 const unguarded = [];
 starts.forEach(([i,name,isAsync],idx)=>{
   if(!isAsync) return;
   const end = idx+1<starts.length ? starts[idx+1][0] : lines.length;
   const body = lines.slice(i,end);
   const fa = body.findIndex(l=>l.includes('await '));
   if(fa < 0) return;
   const paints = body.map((l,j)=>[j,l]).filter(([j,l])=> j>fa && /\\bC\\.innerHTML\\s*=|\\$\\('#content'\\)/.test(l));
   if(!paints.length) return;
   const hasCap = body.some(l=>l.includes('const _nav = S.nav;'));
   const guarded = paints.every(([j])=> body.slice(fa,j).some(l=>l.includes('navStale(_nav)')));
   if(!hasCap || !guarded) unguarded.push(name);
 });
 r.unguardedAsyncRenderers = unguarded;
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / ');}return r;};`;

try { w.eval(scripts.join('\n') + '\n' + driver); }
catch (e) { console.log('EVAL ERROR:', e.message); process.exit(1); }
w.__SRC = scripts.join('\n');

const EXPECT = {
  bumped: true,
  campaignsPaintedFirst: true,
  dashboardDidNotClobber: true,
  campaignsStillShowing: true,
  routeStillCampaigns: true,
  filtersWorkspace: true,
  filtersProject: true,
  dashboardRenders: true,
};

(async () => {
  let r;
  try { r = await w.eval('window.__run()'); }
  catch (e) { console.log('RUN ERROR:', e.message); process.exit(1); }
  if (r.error) { console.log('FAIL error ->', r.error); process.exit(1); }
  let fail = 0;
  for (const [k, want] of Object.entries(EXPECT)) {
    if (r[k] !== want) { console.log(`FAIL ${k} -> expected ${want}, got ${JSON.stringify(r[k])}`); fail++; }
  }
  if (!Array.isArray(r.unguardedAsyncRenderers)) {
    console.log('FAIL lint did not run'); fail++;
  } else if (r.unguardedAsyncRenderers.length) {
    console.log('FAIL async renderers paint #content after an await with no navStale() guard ->',
      r.unguardedAsyncRenderers.join(', '));
    fail++;
  }
  console.log(fail ? `navrace: ${fail} FAILED` : 'navrace: all checks passed');
  process.exit(fail ? 1 : 0);
})();
