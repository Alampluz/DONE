/* Onboarding registry + scheduler (13 Oct 2026). Checks the working-day backward scheduler
   against the Blueprint's scheduling demo (go-live Mon 16 Nov 2026), dedup of shared base
   tasks across services, dependency wiring, feasibility, the BD gate in the UI, the board
   picker before generation, and the payload handed to ob_generate_tasks(). */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.__rpc=[]; window.__ins=[]; window.__upd=[];
window.__tables={};
window.__mkQuery=(t)=>{const rows=()=> (window.__tables[t]||[]).map(r=>({...r}));
 const q={_t:t,_mode:'select',_rows:null,_single:false,
 select(){ if(q._mode==='select') q._rows=rows(); return q;},
 insert(r){ q._mode='insert'; const arr=Array.isArray(r)?r:[r]; q._rows=arr.map((x,i)=>({id:t+'-new-'+(window.__ins.length+i+1),...x})); window.__ins.push({t,rows:arr}); (window.__tables[t]=window.__tables[t]||[]).push(...q._rows); return q;},
 update(x){ q._mode='update'; window.__upd.push({t,x}); q._rows=[{...(rows()[0]||{}),...x}]; return q;},
 delete(){ q._mode='delete'; q._rows=[]; return q;},
 single(){ q._single=true; return q;},
 eq(){return q;}, is(){return q;}, not(){return q;}, or(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
 then(res,rej){ const d=q._rows||rows(); return Promise.resolve({data:q._single?(d[0]||null):d,error:null}).then(res,rej);}};
 return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},
 rpc:async(name,args)=>{ window.__rpc.push({name,args}); if(name==='ob_generate_tasks') return {data:{inserted:args.p_plan.length,redated:0,unchanged:0,deps:args.p_plan.reduce((n,i)=>n+i.deps.length,0)},error:null}; if(name==='ob_readiness') return {data:{gates:3,gates_done:0,open:7,blocked:0,overdue:0,total:7},error:null}; return {data:null,error:null}; }})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 const T_OPS='t-ops', T_ART='t-art', T_ONB='t-onb';
 Object.assign(S,{nav:1, me:{id:'me',role:'admin',full_name:'April'}, profiles:[{id:'me',full_name:'April',role:'admin',active:true}],
  workspaces:[{id:'w1',name:'Ops'}], projects:[{id:'bd-board',workspace_id:'w1',name:'Brands Onboard – Offboard',status:'active'},{id:'cr-board',workspace_id:'w1',name:'Creative Queue',status:'active'}],
  teams:[{id:T_OPS,name:'Store Operation & Product Listing'},{id:T_ART,name:'Creative Team'},{id:T_ONB,name:'Onboarding'}], teamMembers:[],
  brandsList:[{id:'b1',name:'111Skin',active:true},{id:'b2',name:'Zeta Brand',active:true}],
  slaHolidays:['2026-10-13','2026-10-23','2026-12-07','2026-12-10'], slaWorkDays:[1,2,3,4,5]});
 const tt=(template_id,code,title,scope_level,duration_wd,offset_wd,depends_on_code,dedup_key,team_id,gate,input_wait)=>({id:'tt-'+code,template_id,code,title,scope_level,duration_wd,offset_wd,depends_on_code,dedup_key,team_id,board_project_id:null,required_input:'',evidence_rule:'',gate:!!gate,input_wait:!!input_wait,position:1});
 window.__tables={
  service_types:[{id:'st-list',code:'LISTING',name:'Product listing',category:'Operations',channels:['Shopee'],scope_level:'store',team_id:T_OPS,active:true,position:1},
                 {id:'st-art',code:'CREATIVE',name:'Creative & artwork',category:'Creative',channels:[],scope_level:'brand',team_id:T_ART,active:true,position:2}],
  service_templates:[{id:'tpl-base',service_type_id:null,version:1,name:'Base',status:'published'},{id:'tpl-list',service_type_id:'st-list',version:1,name:'LISTING v1',status:'published'},{id:'tpl-art',service_type_id:'st-art',version:1,name:'CREATIVE v1',status:'published'}],
  template_tasks:[tt('tpl-base','BASE-01','Verify scope and stores','brand',1,null,null,'BASE-01',T_ONB),
                  tt('tpl-base','BASE-02','Platform access readiness','store',2,7,'BASE-01','BASE-02',T_OPS),
                  tt('tpl-base','QA-01','Go-live readiness / QA','brand',1,1,null,'QA-01',T_ONB,true),
                  tt('tpl-list','LIST-01','Product data accepted','service',2,null,null,null,T_OPS,false,true),
                  tt('tpl-list','LIST-02','Create product listings','service',5,null,'LIST-01',null,T_OPS,true),
                  tt('tpl-art','ART-01','Brand assets accepted','brand',1,null,null,null,T_ART,false,true),
                  tt('tpl-art','ART-02','Artwork production','brand',4,null,'ART-01',null,T_ART,true)],
  brand_stores:[{id:'s1',brand_id:'b1',name:'111Skin Shopee',platform:'Shopee',platform_store_id:'SHP-111',launch_state:'planned'},{id:'s2',brand_id:'b1',name:'111Skin Lazada',platform:'Lazada',platform_store_id:null,launch_state:'planned'}],
  brand_services:[{id:'bs1',brand_id:'b1',store_id:'s1',service_type_id:'st-list',status:'onboarding'},{id:'bs2',brand_id:'b1',store_id:null,service_type_id:'st-art',status:'onboarding'},
                  {id:'bs3',brand_id:'b1',store_id:'s2',service_type_id:'st-list',status:'confirmed'},{id:'bs9',brand_id:'b2',store_id:null,service_type_id:'st-art',status:'proposed'}],
  bd_confirmations:[{id:'c1',brand_service_id:'bs1',kind:'new',agreed_go_live:'2026-11-16',evidence:'Contract v2',confirmed_by:'me',confirmed_at:'2026-10-10T03:00:00Z'},{id:'c2',brand_service_id:'bs2',kind:'new',evidence:'Contract v2',confirmed_by:'me',confirmed_at:'2026-10-10T03:00:00Z'},{id:'c3',brand_service_id:'bs3',kind:'expansion',evidence:'Addendum',confirmed_by:'me',confirmed_at:'2026-10-12T03:00:00Z'}],
  onboarding_projects:[{id:'p1',brand_id:'b1',name:'111Skin onboarding',status:'draft',target_go_live:'2026-11-16',baseline_go_live:null,feasibility:null,owner_id:'me',plan:[]}],
  onboarding_project_services:[{project_id:'p1',brand_service_id:'bs1',template_id:'tpl-list'},{project_id:'p1',brand_service_id:'bs2',template_id:'tpl-art'}],
  onboarding_task_links:[], go_live_changes:[], sla_holidays:[], sla_settings:[]};
 // 1. working-day arithmetic
 r.backHoliday = obBack('2026-10-14',1);            // 13 Oct is a holiday → Mon 12 Oct
 r.backWeekend = obBack('2026-11-16',1);            // Mon → Fri 13 Nov
 r.backZero    = obBack('2026-11-15',0);            // Sunday → Fri 13 Nov
 r.wdBetween   = obWDBetween(obD('2026-11-06'), obD('2026-11-12'));  // 9,10,11 → 3
 // 2. nav + router
 r.navHas = navItems().menu.some(i=>i.key==='menu:onboarding');
 r.routeFn = typeof renderOnboarding==='function';
 // 3. registry list
 await obLoad(true);
 await renderOnboarding();
 r.listHasBrands = /111Skin/.test(document.getElementById('content').innerHTML) && /Zeta Brand/.test(document.getElementById('content').innerHTML);
 r.listChips = /2 Onboarding/.test(document.getElementById('content').innerHTML) && /1 BD confirmed/.test(document.getElementById('content').innerHTML);
 // 4. brand page + BD gate
 await renderOnboarding('brand','b1'); const b1=document.getElementById('content').innerHTML;
 r.b1NoConfirmBtn = !/BD confirm</.test(b1) && /111Skin Lazada/.test(b1) && /Contract v2/.test(b1);
 await renderOnboarding('brand','b2'); const b2=document.getElementById('content').innerHTML;
 r.b2ConfirmBtn = /BD confirm</.test(b2) && /Proposed/.test(b2);
 // start-onboarding modal lists only confirmed/onboarding services not already in an active plan
 obNewProjectModal('b1'); const mod=document.querySelector('#modal-root').innerHTML;
 r.modalOffersBs3Only = /value="bs3"/.test(mod) && !/value="bs1"/.test(mod) && !/value="bs2"/.test(mod);
 closeModals();
 // 5. plan from the demo: go-live Mon 16 Nov 2026
 const p=OB.projects.find(x=>x.id==='p1'); const svcs=OB.services.filter(s=>['bs1','bs2'].includes(s.id));
 const plan=obComposePlan(p, svcs, '2026-11-16'); const by=k=>plan.items.find(i=>i.key.startsWith(k));
 r.keys = plan.items.map(i=>i.key).sort().join('|');
 r.count = plan.items.length;
 r.qa   = by('QA-01@brand').due;                         // D-1 → 13 Nov
 r.list2 = by('LIST-02@service:bs1').due+'/'+by('LIST-02@service:bs1').start;   // 12 Nov / 6 Nov (5 WD)
 r.list1 = by('LIST-01@service:bs1').due+'/'+by('LIST-01@service:bs1').start;   // 5 Nov / 4 Nov
 r.art2  = by('ART-02@brand').due+'/'+by('ART-02@brand').start;                // 12 Nov / 9 Nov
 r.art1  = by('ART-01@brand').due;                                              // 6 Nov
 r.base2 = by('BASE-02@store:s1').due+'/'+by('BASE-02@store:s1').start;        // D-7 → 5 Nov / 4 Nov
 r.base1 = by('BASE-01@brand').due;                                             // before BASE-02 → 3 Nov
 r.list2deps = by('LIST-02@service:bs1').deps.sort().join(',');
 r.qaDeps = by('QA-01@brand').deps.sort().join(',');
 r.base2deps = by('BASE-02@store:s1').deps.join(',');
 r.list1deps = by('LIST-01@service:bs1').deps.length;
 r.scopeLabel = by('LIST-02@service:bs1').scope_label;
 // 6. dedup: a second listing service on another store adds LIST-* + BASE-02 for that store, never a second BASE-01/QA-01
 const plan2=obComposePlan(p, OB.services.filter(s=>['bs1','bs2','bs3'].includes(s.id)), '2026-11-16');
 r.dedupCount = plan2.items.length;                                             // 7 + 3 = 10
 r.dedupOnce = plan2.items.filter(i=>i.key==='BASE-01@brand').length===1 && plan2.items.filter(i=>i.key==='QA-01@brand').length===1 && plan2.items.some(i=>i.key==='BASE-02@store:s2');
 // 7. feasibility against today
 const iso=d=>obISO(d); const soon=iso(obAddDays(obToday(),1)), far=iso(obAddDays(obToday(),70));
 r.feasInfeasible = obComposePlan(p, svcs, soon).feasibility;
 r.feasFeasible   = obComposePlan(p, svcs, far).feasibility;
 // 8. project page: boards must be picked before generation; then the RPC gets a full payload
 await renderOnboarding('project','p1'); let ph=document.getElementById('content').innerHTML;
 r.boardBanner = /Pick the board/.test(ph) && /12 Nov 2026/.test(ph) && /GATE/.test(ph) && /waits on brand/.test(ph);
 r.approveBtn = /Approve plan/.test(ph);
 obTeamBoards[T_OPS]='bd-board'; obTeamBoards[T_ART]='cr-board'; obTeamBoards[T_ONB]='bd-board';
 await renderOnboarding('project','p1'); ph=document.getElementById('content').innerHTML;
 r.bannerGone = !/Pick the board/.test(ph);
 await obGenerate('p1');
 const call=window.__rpc.find(c=>c.name==='ob_generate_tasks');
 r.rpcItems = call? call.args.p_plan.length : 0;
 r.rpcBoards = call? call.args.p_plan.every(i=>i.board_id && i.start && i.due && i.key) : false;
 r.rpcGateDeps = call? (call.args.p_plan.find(i=>i.key.startsWith('QA-01'))||{}).deps.sort().join(',') : '';
 r.rpcDesc = call? /Required input/.test(call.args.p_plan[0].description) : false;
 r.baselineSet = p.baseline_go_live==='2026-11-16' && p.status==='in_progress';
 r.superWroteBoards = window.__upd.some(u=>u.t==='template_tasks' && u.x.board_project_id==='bd-board');
 // 9. holidays never land on a due date across the whole plan
 r.noHolidayDue = plan2.items.every(i=>obIsWorkDay(obD(i.due)) && obIsWorkDay(obD(i.start)));
 // 10. Decathlon tracker rule: calendar offsets rolled back to a working day; negative = after go-live. Go-live Thu 1 Apr 2027.
 r.cal70 = obAnchor('2027-04-01', 70, 'calendar');   // 21 Jan 27 (Thu)
 r.cal3  = obAnchor('2027-04-01', 3, 'calendar');    // 29 Mar 27 (Mon)
 r.cal0  = obAnchor('2027-04-01', 0, 'calendar');    // 1 Apr
 r.calP3 = obAnchor('2027-04-01', -3, 'calendar');   // 4 Apr is Sunday → Fri 2 Apr (sheet says 2-Apr-27)
 r.calP7 = obAnchor('2027-04-01', -7, 'calendar');   // 8 Apr (Thu)
 r.wdP3  = obAnchor('2027-04-01', -3, 'working');    // 3 working days after Thu 1 Apr → Tue 6 Apr
 // a calendar-unit template inside a plan: the task lands on the sheet's date and after-go-live tasks are not predecessors of the gate
 window.__tables.service_templates.push({id:'tpl-tt',service_type_id:'st-tt',version:1,name:'TT v1',status:'published',offset_unit:'calendar'});
 window.__tables.service_types.push({id:'st-tt',code:'STOREOPS_TT',name:'Store Operation — TikTok Shop',channels:['TikTok Shop'],scope_level:'store',team_id:T_OPS,active:true,position:9});
 window.__tables.template_tasks.push(tt('tpl-tt','S1','Contract signing','brand',1,70,null,null,T_OPS), tt('tpl-tt','S32','Week-1 hypercare','service',1,-7,null,null,T_OPS));
 window.__tables.brand_services.push({id:'bs7',brand_id:'b1',store_id:'s1',service_type_id:'st-tt',status:'confirmed'});
 await obLoad(true);
 const p3=obComposePlan(OB.projects.find(x=>x.id==='p1'), OB.services.filter(s=>s.id==='bs7'), '2027-04-01');
 const s1=p3.items.find(i=>i.key.startsWith('S1@')), s32=p3.items.find(i=>i.key.startsWith('S32@')), qa=p3.items.find(i=>i.key.startsWith('QA-01@'));
 r.p3s1 = s1.due; r.p3s32 = s32.due; r.p3qaDeps = qa.deps.length;
 // 11. the checklist parser on the Decathlon sheet shape
 const aoa=[[],['','','Decathlon - TikTok Shop Onboarding'],[],[],['','','Onboarding Summary'],['','','Overall progress'],['','','0%'],[],
  ['','','Phase','#','Activity','What CREA delivers','What Brand provides','Responsibility','CREA team','Days vs Go-Live','Deadline','Done date','Status','Remark'],
  ['','','A.  STORE OPERATION  |  TikTok Shop'],
  ['','','1. Project Alignment & Kick-off','S1','Contract signing','Contract & scope','Signed contract','Brand x CREA','BD','-70 d','','','Not started',''],
  ['','','','S2','Kick-off meeting','Timeline','Key contacts','Brand x CREA','OB, KAM','-63 d','','','Not started',''],
  ['','','2. Brand Preparation','S3','SKU list with price structure','SKU master','Full SKU list','Brand','KAM','-56 d','','','Not started',''],
  ['','','9. Go-Live','S31','Shop Live','Shop launched','-','Brand x CREA','OB, KAM','Go-Live','','','Not started',''],
  ['','','','S32','Week-1 hypercare & review','Report','Attend','CREA','OB, KAM','+7 d','','','Not started',''],
  ['','','B.  LIVESTREAMING SERVICE  |  TikTok LIVE'],
  ['','','1. LIVE Strategy & Plan','L1','LIVE objectives','Strategy','Goals','Brand x CREA','KAM, LIVE','-28 d','','','Not started',''],
  ['','','5. Rehearsal & First LIVE','L15','First LIVE session','LIVE hosted','-','CREA','LIVE','+3 d','','','Not started',''],
  [],['','','CREA E-mail','','x@crea.asia'],['','','Shop Link','TikTok']];
 const pr=obParseChecklist(aoa);
 r.parseSections = pr.sections.map(s=>s.name+':'+s.tasks.length).join('|');
 r.parseOffsets = pr.sections[0].tasks.map(t=>t.offset).join(',')+'/'+pr.sections[1].tasks.map(t=>t.offset).join(',');
 r.parsePhase = pr.sections[0].tasks[1].phase==='1. Project Alignment & Kick-off' && pr.sections[0].tasks[4].phase==='9. Go-Live';
 r.parseTeams = pr.sections[0].tasks[1].teams.join('+')+'/'+pr.teamCodes.sort().join('+');
 r.parseBrand = pr.sections[0].tasks[2].responsibility==='Brand' && pr.sections[0].tasks[2].brand_input==='Full SKU list';
 r.parseNoHeader = !!obParseChecklist([['a','b'],['c','d']]).error;
 r.guessTeam = obGuessTeam('OB')===T_ONB && obGuessTeam('GRAPHIC')===T_ART && obGuessTeam('CS')==='';
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('working days skip holidays and weekends', r.backHoliday==='2026-10-12' && r.backWeekend==='2026-11-13' && r.backZero==='2026-11-13' && r.wdBetween===3);
check('Onboarding is in the sidebar and the router', r.navHas && r.routeFn);
check('registry lists brands with service status counts', r.listHasBrands && r.listChips);
check('BD confirm only offered on a proposed service; confirmations shown', r.b1NoConfirmBtn && r.b2ConfirmBtn);
check('start-onboarding offers only confirmed services not already planned', r.modalOffersBs3Only);
check('plan composes 7 tasks for listing + creative', r.count===7 && /BASE-01@brand\|BASE-02@store:s1\|LIST-01@service:bs1/.test(r.keys));
check('demo dates: QA 13 Nov, LIST-02 12→6 Nov, LIST-01 5→4 Nov', r.qa==='2026-11-13' && r.list2==='2026-11-12/2026-11-06' && r.list1==='2026-11-05/2026-11-04');
check('demo dates: ART-02 12→9 Nov, ART-01 6 Nov, BASE-02 D-7 5→4 Nov, BASE-01 3 Nov', r.art2==='2026-11-12/2026-11-09' && r.art1==='2026-11-06' && r.base2==='2026-11-05/2026-11-04' && r.base1==='2026-11-03');
check('dependencies: LIST-02 waits for LIST-01; the QA gate waits for LIST-02 and ART-02; BASE-02 for BASE-01', r.list2deps==='LIST-01@service:bs1' && r.qaDeps==='ART-02@brand,LIST-02@service:bs1' && r.base2deps==='BASE-01@brand' && r.list1deps===0);
check('scope label is the store name', r.scopeLabel==='111Skin Shopee');
check('shared base tasks dedup per scope across services', r.dedupCount===10 && r.dedupOnce);
check('feasibility: tomorrow is infeasible, +70 days is feasible', r.feasInfeasible==='infeasible' && r.feasFeasible==='feasible');
check('project page asks for boards, shows dates, gates and brand-input waits', r.boardBanner && r.approveBtn && r.bannerGone);
check('ob_generate_tasks gets every item with board, dates, deps and description', r.rpcItems===7 && r.rpcBoards && r.rpcGateDeps==='ART-02@brand,LIST-02@service:bs1' && r.rpcDesc);
check('first approval sets the baseline and remembers team boards', r.baselineSet && r.superWroteBoards);
check('no planned date ever lands on a weekend or holiday', r.noHolidayDue);
check('calendar offsets: -70→21 Jan, -3→29 Mar, 0→1 Apr, +3→Fri 2 Apr, +7→8 Apr; working +3→6 Apr', r.cal70==='2027-01-21' && r.cal3==='2027-03-29' && r.cal0==='2027-04-01' && r.calP3==='2027-04-02' && r.calP7==='2027-04-08' && r.wdP3==='2027-04-06');
check('calendar-unit template schedules on the sheet dates; after-go-live task is not a gate predecessor', r.p3s1==='2027-01-21' && r.p3s32==='2027-04-08' && r.p3qaDeps===0);
check('parser finds both service sections with their tasks', r.parseSections==='Store Operation — TikTok Shop:5|Livestreaming — TikTok LIVE:2');
check('parser reads -70 d / Go-Live / +7 d as 70 / 0 / -7', r.parseOffsets==='70,63,56,0,-7/28,-3');
check('parser carries the phase down and splits team codes', r.parsePhase && r.parseTeams==='OB+KAM/BD+KAM+LIVE+OB');
check('parser keeps brand responsibility and input; rejects a sheet without the header', r.parseBrand && r.parseNoHeader && r.guessTeam);
if(!ok) process.exit(1); });
