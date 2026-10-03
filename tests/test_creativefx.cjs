/* Creative Queue formulas ported from Monday board 5617471353.
   WORKDAYS skips weekends. Brand weight is Monday's list; Interpharma is 0. */
const fs = require('fs');
const {JSDOM} = require('jsdom');
const {CREATIVE_FORMULA_COLUMNS, BRAND_WEIGHTS} = require('../tools/creative_routing/formulas.js');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html.replace(/<script src=[^>]+><\/script>/g, ''), {runScripts: 'outside-only', pretendToBeVisual: true});
const w = dom.window;
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=()=>{const q={then(r,j){return Promise.resolve({data:[],error:null}).then(r,j);}};
 ['update','insert','delete','select','single','eq','is','in','order','limit'].forEach(k=>q[k]=()=>q); return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const payload = JSON.stringify({columns: CREATIVE_FORMULA_COLUMNS, weights: BRAND_WEIGHTS});
const driver = `
const spec = ${payload};
const fields = [
  {id:'brand', label:'Brand', ftype:'brand', options:[]},
  {id:'kv', label:'Key Visual Type', ftype:'select', options:[]},
  {id:'req', label:'Request Date', ftype:'date', options:[]},
  {id:'aw', label:'AW Total', ftype:'number', options:[]},
].concat(spec.columns.map((c,i)=>({id:'c'+i, label:c.label, ftype:c.ftype, options:c.options})));
S._fields = fields;
const idOf = label => fields.find(f=>f.label===label).id;
const expr = label => spec.columns.find(c=>c.label===label).options.expr;
function task(custom){
  const c = {};
  Object.entries(custom).forEach(([label, value])=>{ c[idOf(label)] = value; });
  return {title:'Brief', status:'todo', priority:'normal', custom:c, created_at:'2026-10-01T00:00:00Z'};
}
function run(label, custom){ return fxEval(expr(label), task(custom)); }
const r = {};
const ids = spec.columns.filter(c=>c.monday_id).map(c=>c.monday_id);
r.eight = ids.length===8 && new Set(ids).size===8;
r.same = run('Request to Deadline', {Deadline:'2026-10-05', 'Request Date':'2026-10-05'})===0;
r.span = run('Request to Deadline', {Deadline:'2026-10-05', 'Request Date':'2026-10-09'})===4
      && run('Request to Deadline', {Deadline:'2026-10-09', 'Request Date':'2026-10-05'})===-4;
r.weekend = run('Request to Deadline', {Deadline:'2026-10-12', 'Request Date':'2026-10-09'})===-1;
r.blankDate = run('Request to Deadline', {Deadline:'2026-10-09'})==='';
r.prio = run('Priority (auto)', {'Priority status':'P1 High'})===2
      && run('Priority (auto)', {'Priority status':'🔥 🔥 🔥'})===3
      && run('Priority (auto)', {'Priority status':'P2 Medium'})===1
      && run('Priority (auto)', {'Priority status':'Something else'})===0;
r.kv = run('KV Complexity Weight', {'Key Visual Type':'Platform KV', '#SIS AW':4})===8
    && run('KV Complexity Weight', {'Key Visual Type':'New Create', '#SIS AW':4})===12
    && run('KV Complexity Weight', {'Key Visual Type':'Regional Asset', '#SIS AW':1})===5
    && run('KV Complexity Weight', {'Key Visual Type':'Platform KV'})===0;
r.pdp = run('PDP Complexity Weight', {'PDP Complexity':'White Background', '#PDP AW':4})===2
     && run('PDP Complexity Weight', {'PDP Complexity':'Value Set', '#PDP AW':2})===6
     && run('PDP Complexity Weight', {'PDP Complexity':'Complicated SKU'})===0;
r.effort = run('Complexity Effort', {'Key Visual Type':'Platform KV', '#SIS AW':4, 'PDP Complexity':'White Background', '#PDP AW':4})===10;
r.aw = run('#AW Formula', {'#SIS AW':1,'#PDP AW':2,'#Frame PDP AW':3,'#Visibility AW':4,'#Live Frame':5,'#MKT AW':6,'# non cats':7})===28
    && run('#AW Formula', {'#SIS AW':2})===2;
r.nestle = run('Complexity weight by Brand ( Creativity, Revision)', {Brand:'Nestle'})===2;
r.inter = run('Complexity weight by Brand ( Creativity, Revision)', {Brand:'Interpharma'})===0;
r.emptyBrand = run('Complexity weight by Brand ( Creativity, Revision)', {Brand:''})===0;
r.allWeights = spec.weights.every(([brand, weight]) => run('Complexity weight by Brand ( Creativity, Revision)', {Brand:brand})===weight);
r.report = run('Report', {'AW Total':9})===9;
r.noInvented = !spec.weights.some(([brand]) => String(brand).toLowerCase()==='interpharma');
window.__r = r;
`;
w.eval(scripts.join('\n') + '\n' + driver);
const r = w.__r;
let ok = true;
const check = (name, cond) => {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (cond ? '' : ' -> ' + JSON.stringify(r)));
  if (!cond) ok = false;
};
check('all eight Monday formula columns are in the port', r.eight);
check('same-day workdays are 0', r.same);
check('Mon to Fri is 4 working days, and the reverse is negative', r.span);
check('Friday to the next Monday is one working day', r.weekend);
check('a blank date leaves Request to Deadline blank', r.blankDate);
check('Priority (auto) keeps Monday codes', r.prio);
check('KV weight uses the Monday factors, and a blank count is 0', r.kv);
check('PDP weight uses the Monday factors', r.pdp);
check('Complexity Effort adds the two weights', r.effort);
check('#AW Formula sums the seven counts and treats blanks as 0', r.aw);
check('Nestle brand weight is 2', r.nestle);
check('Interpharma brand weight stays 0', r.inter && r.noInvented);
check('an empty brand weight is 0', r.emptyBrand);
check('every listed brand weight is the Monday number', r.allWeights);
check('Report echoes AW Total', r.report);
if (!ok) process.exit(1);
