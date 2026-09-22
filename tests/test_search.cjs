/* Global search (Cmd/Ctrl+K). The property that matters is the security one: every task row
 * comes back through PostgREST with the caller's RLS, never through a security-definer RPC. A
 * later "optimisation" that swaps in an rpc() would silently leak titles across the partner
 * boundary — this fails the build instead. Also checks the highlighter escapes user text. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
let fail=0; const check=(n,ok,x)=>{ if(!ok){ fail++; console.log('FAIL',n,x!==undefined?'-> '+JSON.stringify(x):''); } };

const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const gsStart = src.indexOf('async function gsRun('); const gsEnd = src.indexOf('function gsMark(', gsStart);
const gsRun = gsStart>=0 ? src.slice(gsStart, gsEnd) : '';
check('A. gsRun exists', gsRun.length>0);
check('A. tasks come through PostgREST (.from + .ilike + .limit)', /\.from\('tasks'\)/.test(gsRun) && /\.ilike\(/.test(gsRun) && /\.limit\(/.test(gsRun));
check('A. never a security-definer rpc', !/\.rpc\(/.test(gsRun));
check('A. archived tasks excluded', /is\('archived_at',\s*null\)/.test(gsRun));
check('A. ticket matches merged ahead of title matches', /\.\.\.\(byTicket\.data\|\|\[\]\),\s*\.\.\.\(byTitle\.data\|\|\[\]\)/.test(gsRun));
check('A. stale responses dropped', /seq !== gsSeq/.test(gsRun));

const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.supabase={createClient:()=>({from:()=>({}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const probe = `window.__r = ({
  esc: gsMark('<b>Lacoste</b> x TT', 'lacoste'),
  none: gsMark('Dettol', 'zzz'),
  kbd: !!document.getElementById('gs-btn'),
  opens: (function(){ S.me={id:'me',role:'admin'}; gsOpen(); return !!document.getElementById('gs-q'); })(),
});`;
try{ w.eval(src+'\n'+probe); }catch(e){ console.log('EVAL ERROR',e.message); process.exit(1); }
const r = w.__r;
check('B. highlighter escapes HTML and marks the hit', r.esc==='&lt;b&gt;<mark>Lacoste</mark>&lt;/b&gt; x TT', r.esc);
check('B. no match returns escaped text', r.none==='Dettol');
check('C. topbar entry present', r.kbd);
check('C. palette opens with its input', r.opens);
console.log(fail?`search: ${fail} FAILED`:'search: all checks passed'); process.exit(fail?1:0);
