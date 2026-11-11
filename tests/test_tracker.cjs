/* Campaign tracker (part7b): the planning sheet parsed from Excel rows, cell kinds, late rule, stats,
   filters, the rendered sheet and the brand directory rows. Optional: TRACKER_AOA=<json of real rows>
   also parses a real export and prints its size (not part of CI). */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const real=process.env.TRACKER_AOA?fs.readFileSync(process.env.TRACKER_AOA,'utf8'):'null';
const driver=`window.__run=function(){const r={};
 const N=null, serial=d=>Math.round(Date.parse(d+'T00:00:00Z')/86400000+25569);
 const rows=[
  [N,'10.10 Campaign Planning',N,N,N,N,N,N,N,N,N,N,N,'TARGET & BUDGETING',N,'Store Ops',N,N],
  ['Dday',serial('2026-10-10'),N,'<- DDay',N,N,N,N,N,N,N,N,N,'Target Proposal','Brand  Target\\nAlignment','Join Campaign',N,'Price Lock'],
  [N,N,N,N,N,N,N,N,N,N,N,'Details',N,'KAM plans GMV',N,'Only Lazada','orphan how',N],
  [N,N,N,N,N,N,N,N,N,'Completion',N,N,'Completion',0.9,0.5,0.1,N,0],
  [N,N,N,N,N,N,N,N,N,'Overdue?',N,N,'Overdue?','Yes','Yes','No',N,'No'],
  [N,N,N,N,N,N,N,N,N,'default','D-',N,N,'23',20,'10',N,N],
  ['Country','Brand','Lead','KAM/PIC','Asso','Teasing Date Start','MKT start date','Presale start','Presale MKT start date','Platform','Category','Service Type','Completion',serial('2026-09-17'),serial('2026-09-20'),'2026-09-30 00:00:00',N,serial('2026-10-10')],
  ['TH','111SKIN','Jann','Yves','Mint',serial('2026-10-06'),N,N,N,'Lazada','Beauty','Retail',0.6,'Done','Pending','n/a','x',30000],
  ['TH','111SKIN','Jann','Yves','Mint',N,N,N,N,'Shopee','Beauty','Retail',0.6,'Done','In Progress','Brand Review',N,N],
  [N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N],
  ['SG','Banila','Orn','Palmy','Palmy',N,N,N,N,'Lazada','Beauty','Service',0.6,'Done','Done','Yes',N,'MKT set']];
 const p=cptParseSheet(rows);
 r.head=JSON.stringify([p.name,p.dday,p.steps.length,p.lines.length]);
 r.steps=JSON.stringify(p.steps);
 r.line0=JSON.stringify(p.lines[0]); r.line2=JSON.stringify([p.lines[2].position,p.lines[2].brand_name,p.lines[2].cells]);
 try{ cptParseSheet([['a','b']]); r.bad='no error'; }catch(e){ r.bad=e.message; }
 r.dates=JSON.stringify([cptDate(46305),cptDate('2026-10-10 00:00:00'),cptDate(null),cptDate(5),cptDate('x')]);
 r.kinds=['Done','done ','Pending','Brand Review','In Progress','n/a','',null,'Yes','30000','MKT set','No Top-up  request'].map(cptKind).join(',');
 r.labels=JSON.stringify(['Done','n/a','In Progress','30000','254132.00000000006','Yes','',null].map(cptLabel));
 const S9={position:0,due:'2026-09-17'}, SN={position:1,due:null};
 r.late=[cptIsLate(S9,'Pending','2026-10-10'),cptIsLate(S9,'In Progress','2026-09-17'),cptIsLate(S9,'Done','2026-10-10'),cptIsLate(S9,'','2026-10-10'),cptIsLate(S9,'Brand Review','2026-09-18'),cptIsLate(SN,'Pending','2026-10-10')].join(',');
 const L=p.lines.map((l,i)=>({...l,id:'l'+i}));
 r.stats=JSON.stringify([cptStats(L[0],p.steps,'2026-10-01'),cptStats(L[1],p.steps,'2026-10-01'),cptStats(L[2],p.steps,'2026-10-01')]);
 const F=f=>cptFiltered(L,{svc:'',brand:'',kam:'',lead:'',q:'',late:false,...f},p.steps,'2026-10-01').map(l=>l.id).join(',');
 r.filters=JSON.stringify([F({}),F({svc:'Service'}),F({brand:'111SKIN'}),F({kam:'Mint'}),F({lead:'Orn'}),F({q:'shop'}),F({late:true}),F({svc:'Retail',kam:'Palmy'})]);
 r.groups=JSON.stringify(cptElements(p.steps).map(g=>[g.name,g.steps.length]));
 const host=document.createElement('div'); document.body.appendChild(host);
 host.innerHTML=cptSheetHTML(L,p.steps,{},'2026-10-01');
 r.cells=host.querySelectorAll('td.cc').length; r.lateCells=host.querySelectorAll('td.cc.late').length;
 r.cell=(c=>c?c.className+'|'+c.textContent+'|'+c.title:null)(host.querySelector('td.cc[data-line="l0"][data-step="3"]'));
 r.pct=[...host.querySelectorAll('td.c3')].map(t=>t.textContent).join(',');
 host.innerHTML=cptSheetHTML(L,p.steps,{'Store Ops':1},'2026-10-01');
 r.folded=JSON.stringify([host.querySelectorAll('td.cc').length,[...host.querySelectorAll('td.gs')].map(t=>t.textContent+(t.classList.contains('bad')?'!':t.classList.contains('ok')?'+':''))]);
 host.innerHTML=cptSheetHTML([{...L[0],brand_name:'<img src=x onerror=1>'}],p.steps,{},'2026-10-01'); r.esc=!host.querySelector('img');
 host.innerHTML=cptSumHTML(L,p.steps,'2026-10-01'); r.sum=host.textContent.replace(/\\s+/g,' ').trim();
 const B=[{id:'b1',name:'Aveda',kam:'Yves',category_lead:'',service_model:'Retail',active:true},{id:'b2',name:'Old',merged_into:'b1'},{id:'b3',name:'Zed',kam:'Mint',category_lead:'Jann',active:true},{id:'b4',name:'Off',active:false}];
 host.innerHTML='<table><tbody>'+cpdRowsHTML(B,'',true)+'</tbody></table>';
 r.dir=JSON.stringify([host.querySelectorAll('tr').length,host.querySelectorAll('input').length,host.querySelectorAll('input.empty').length,host.querySelector('input[data-brand="b1"][data-f="kam"]').value]);
 host.innerHTML='<table><tbody>'+cpdRowsHTML(B,'mint',false)+'</tbody></table>'; r.dirRO=JSON.stringify([host.querySelectorAll('tr').length,host.querySelectorAll('input').length,/Zed/.test(host.textContent)]);
 const REAL=${real}; if(REAL){ const q=cptParseSheet(REAL); r.real=JSON.stringify([q.name,q.dday,q.steps.length,q.lines.length,new Set(q.lines.map(l=>l.brand_name)).size,q.lines.reduce((n,l)=>n+Object.keys(l.cells).length,0),cptElements(q.steps).length]); }
 return Promise.resolve(JSON.stringify(r)); };`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(s=>{ const r=JSON.parse(s), J=JSON.stringify; let ok=true;
const check=(n,c,x)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+J(x))); if(!c) ok=false; };
check('parse: name, D-day, 4 named steps (unnamed column skipped), 3 brand lines (blank row skipped)', r.head===J(['10.10 Campaign Planning','2026-10-10',4,3]), r.head);
check('parse: steps carry section, how-to, D- offset and due date', r.steps===J([
 {position:0,element:'TARGET & BUDGETING',name:'Target Proposal',how:'KAM plans GMV',d_offset:23,due:'2026-09-17'},
 {position:1,element:'TARGET & BUDGETING',name:'Brand Target Alignment',how:'',d_offset:20,due:'2026-09-20'},
 {position:2,element:'Store Ops',name:'Join Campaign',how:'Only Lazada',d_offset:10,due:'2026-09-30'},
 {position:3,element:'Store Ops',name:'Price Lock',how:'',d_offset:null,due:'2026-10-10'}]), r.steps);
check('parse: a line keeps its people, service, dates and filled cells by step position', r.line0===J({position:0,country:'TH',brand_name:'111SKIN',lead:'Jann',kam:'Yves',associate:'Mint',platform:'Lazada',category:'Beauty',service_type:'Retail',dates:{teasing:'2026-10-06'},cells:{0:'Done',1:'Pending',2:'n/a',3:'30000'}}), r.line0);
check('parse: later lines are renumbered', r.line2===J([2,'Banila',{0:'Done',1:'Done',2:'Yes',3:'MKT set'}]), r.line2);
check('parse: a wrong file says so', /Country \| Brand/.test(r.bad), r.bad);
check('dates: Excel serial, text, empty, junk', r.dates===J(['2026-10-10','2026-10-10','','','']), r.dates);
check('kinds', r.kinds==='done,done,pend,pend,inprog,na,na,na,info,info,info,info', r.kinds);
check('labels', r.labels===J(['✓','—','In progress','30k','254.1k','Yes','','']), r.labels);
check('late: open and past due only', r.late==='true,false,false,false,true,false', r.late);
check('stats per line', r.stats===J([{applicable:3,done:2,open:1,late:1},{applicable:3,done:1,open:2,late:2},{applicable:4,done:4,open:0,late:0}]), r.stats);
check('filters: service, brand, KAM or associate, lead, search, late only, combined', r.filters===J(['l0,l1,l2','l2','l0,l1','l0,l1','l2','l1','l0,l1','']), r.filters);
check('sections in sheet order', r.groups===J([['TARGET & BUDGETING',2],['Store Ops',2]]), r.groups);
check('sheet: a cell per line and step, late ones marked', r.cells===12 && r.lateCells===3, [r.cells,r.lateCells]);
check('sheet: amount cell shows short, keeps the full value', r.cell==='cc info ge|30k|30000', r.cell);
check('sheet: done % per line', r.pct==='67%,33%,100%', r.pct);
check('sheet: a folded section is one summary cell per line', r.folded===J([6,['1/1+','0/1 · 1 late!','2/2+']]), r.folded);
check('sheet: brand names are escaped', r.esc===true);
check('summary numbers', r.sum==='2brands · 3 lines 70%7 of 10 steps done 3still open3past their due date', r.sum);
check('directory: active, unmerged brands; editable cells; missing KAM / lead highlighted', r.dir===J([2,12,1,'Yves']), r.dir);
check('directory: search and read-only', r.dirRO===J([1,0,true]), r.dirRO);
if(r.real) console.log('REAL FILE', r.real);
if(!ok) process.exit(1); });
