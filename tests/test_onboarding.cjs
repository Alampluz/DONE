/* Onboarding tracker v2 (13 Oct 2026) — "the Excel tracker, but live". Checks: the working-day
   calendar and the Decathlon-sheet deadline rule; a tracker created from two checklists gets every
   activity with the right deadline, team and default PIC; summary numbers; status/done coupling;
   moving the Shop Live date re-dates open activities; the PIC picker lists the team first; the
   brand (public) page hides internal columns; My Work gets a section; the xlsx parser. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.__rpc=[]; window.__ins=[]; window.__upd=[];
window.__tables={};
window.__mkQuery=(t)=>{const rows=()=> (window.__tables[t]||[]).map(r=>({...r}));
 const q={_t:t,_mode:'select',_rows:null,_single:false,_filters:[],
 select(){ if(q._mode==='select') q._rows=rows(); return q;},
 insert(r){ q._mode='insert'; const arr=Array.isArray(r)?r:[r]; q._rows=arr.map((x,i)=>({id:t+'-'+(window.__ins.length+1)+'-'+i,...x})); window.__ins.push({t,rows:arr}); (window.__tables[t]=window.__tables[t]||[]).push(...q._rows); return q;},
 update(x){ q._mode='update'; q._patch=x; return q;},
 delete(){ q._mode='delete'; q._rows=[]; return q;},
 single(){ q._single=true; return q;},
 eq(k,v){ q._filters.push([k,v]); return q;}, is(){return q;}, not(){return q;}, or(){return q;}, in(){return q;}, lt(){return q;}, gt(){return q;}, gte(){return q;}, lte(){return q;}, neq(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
 then(res,rej){ let d;
   if(q._mode==='update'){ const tbl=window.__tables[t]||[]; d=[]; tbl.forEach(r=>{ if(q._filters.every(([k,v])=>r[k]===v)){ Object.assign(r,q._patch); d.push({...r}); } }); window.__upd.push({t,x:q._patch,n:d.length}); }
   else { d=(q._rows||rows()).filter(r=>q._filters.every(([k,v])=>r[k]===v)); }
   return Promise.resolve({data:q._single?(d[0]||null):d,error:null}).then(res,rej);}};
 return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{},
 rpc:async(name,args)=>{ window.__rpc.push({name,args}); if(name==='ob_public_tracker'){ if(args.p_token!=='tok-123456789012345678') return {data:null,error:null};
   return {data:{name:'Decathlon — TikTok Shop',brand:'Decathlon',go_live:'2027-04-01',company:'CREA',activities:(window.__tables.onboarding_activities||[]).map(a=>({service:a.service_name,code:a.code,phase:a.phase,title:a.title,crea_delivers:a.crea_delivers,brand_provides:a.brand_provides,responsibility:a.responsibility,deadline:a.deadline,done_date:a.done_date,status:a.status}))},error:null}; }
   return {data:null,error:null}; }})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 const T_OB='t-ob', T_ART='t-art', T_KAM='t-kam', T_LIVE='t-live';
 Object.assign(S,{nav:1, me:{id:'me',role:'admin',full_name:'April'},
  profiles:[{id:'me',full_name:'April',role:'admin',active:true},{id:'anch',full_name:'Anchisa',role:'internal',active:true},{id:'liam',full_name:'Liam',role:'internal',active:true}],
  workspaces:[{id:'ws-ob',name:'Onboarding',color:'#6E56B8',description:''},{id:'ws-cs',name:'Customer Service',color:'#000',description:''}], projects:[],
  teams:[{id:T_OB,name:'Onboarding'},{id:T_ART,name:'Creative Team'},{id:T_KAM,name:'Commercial Team'},{id:T_LIVE,name:'Livestreaming'}],
  teamMembers:[{team_id:T_OB,user_id:'anch'},{team_id:T_ART,user_id:'liam'}],
  brandsList:[{id:'b1',name:'Decathlon',active:true},{id:'b2',name:'Zeta',active:true}],
  slaHolidays:['2026-10-13','2027-04-06','2027-04-13','2027-04-14','2027-04-15'], slaWorkDays:[1,2,3,4,5]});
 const tt=(template_id,code,title,phase,offset_wd,team_id,responsibility,pos,default_assignee_id)=>({id:'tt-'+code,template_id,code,title,phase,scope_level:'service',duration_wd:1,offset_wd,team_id,responsibility,evidence_rule:'deliver '+code,required_input:'brand gives '+code,gate:false,input_wait:responsibility==='Brand',position:pos,default_assignee_id:default_assignee_id||null});
 window.__tables={
  service_types:[{id:'st-ops',code:'STOREOPS_TT',name:'Store Operation — TikTok Shop',channels:['TikTok Shop'],scope_level:'store',team_id:T_OB,active:true,position:10},
                 {id:'st-live',code:'LIVE_TT',name:'Livestreaming — TikTok LIVE',channels:['TikTok Shop'],scope_level:'store',team_id:T_LIVE,active:true,position:11},
                 {id:'st-empty',code:'EMPTY',name:'No rows yet',channels:[],scope_level:'store',team_id:null,active:true,position:12}],
  service_templates:[{id:'tpl-ops',service_type_id:'st-ops',version:1,name:'ops v1',status:'published',offset_unit:'calendar'},{id:'tpl-live',service_type_id:'st-live',version:1,name:'live v1',status:'published',offset_unit:'calendar'}],
  template_tasks:[tt('tpl-ops','S1','Contract signing','1. Project Alignment & Kick-off',70,T_KAM,'Brand x CREA',1),
                  tt('tpl-ops','S3','SKU list with price structure','2. Brand Preparation',56,T_KAM,'Brand',2),
                  tt('tpl-ops','S5','Image & brand assets','2. Brand Preparation',49,T_OB,'Brand',3,'anch'),
                  tt('tpl-ops','S30','Pre-launch QA','9. Go-Live',3,T_OB,'Brand x CREA',4),
                  tt('tpl-ops','S32','Week-1 hypercare & review','9. Go-Live',-7,T_OB,'CREA',5),
                  tt('tpl-live','L15','First LIVE session','5. Rehearsal & First LIVE',-3,T_LIVE,'CREA',1),
                  tt('tpl-live','L16','Post-LIVE report','5. Rehearsal & First LIVE',-4,T_LIVE,'Brand x CREA',2)],
  onboardings:[], onboarding_activities:[], sla_holidays:[], sla_settings:[], brands:[]};
 // 1. calendar rule (Decathlon sheet, go-live Thu 1 Apr 2027)
 r.cal70=obAnchor('2027-04-01',70,'calendar'); r.cal3=obAnchor('2027-04-01',3,'calendar'); r.calP3=obAnchor('2027-04-01',-3,'calendar'); r.calP7=obAnchor('2027-04-01',-7,'calendar');
 r.wd1=obBack('2026-10-14',1); r.wdP3=obAnchor('2027-04-01',-3,'working');  // 13 Oct holiday → 12 Oct; +3 WD after Thu 1 Apr, 6 Apr holiday → Wed 7 Apr
 // 2. nav + router
 r.navHas=!navItems().menu.some(i=>i.key==='menu:onboarding') && typeof obWorkspaceSection==='function'; r.routeFn=typeof renderOnboarding==='function' && typeof renderPublicTracker==='function';
 // 3. empty list
 await obLoad(true); await renderOnboarding(); const L0=document.getElementById('content').innerHTML;
 r.emptyList=/New onboarding/.test(L0) && /No onboarding here yet/.test(L0);
 // 4. create a tracker from two checklists (modal → rows)
 obNewModal(); const mod=document.querySelector('#modal-root');
 r.modalOffers=[...mod.querySelectorAll('.on-svc')].map(i=>i.value).join(',');   // the empty checklist is not offered
 mod.querySelector('#on-brand').value='b1'; mod.querySelector('#on-brand').onchange();
 mod.querySelectorAll('.on-svc').forEach(i=>i.checked=true); mod.querySelector('#on-date').value='2027-04-01';
 r.platBoxes=[...mod.querySelectorAll('.on-plat')].map(i=>i.value).join(',');
 mod.querySelector('#on-plat-new').value='Shopify'; obAddPlatformBox('on-plat'); r.platAdded=!![...mod.querySelectorAll('.on-plat:checked')].find(i=>i.value==='Shopify'); mod.querySelector('.on-plat[value="Shopify"]').checked=false;
 await mod.querySelector('#on-save').onclick(); await new Promise(x=>setTimeout(x,0));
 const o=OB.onboardings[0]; const acts=OB.acts[o.id];
 r.created = !!o && o.name==='Decathlon — TikTok Shop' && o.go_live==='2027-04-01' && acts.length===7 && o.workspace_id==='ws-ob' && JSON.stringify(o.platforms)==='["TikTok Shop"]';
 const by=c=>acts.find(a=>a.code===c);
 r.deadlines=[by('S1').deadline, by('S3').deadline, by('S30').deadline, by('S32').deadline, by('L15').deadline, by('L16').deadline].join('|');
 r.copied = by('S5').team_id===T_OB && by('S5').assignee_id==='anch' && by('S3').brand_provides==='brand gives S3' && by('S3').responsibility==='Brand' && by('L15').service_name==='Livestreaming — TikTok LIVE';
 r.order = acts.map(a=>a.code).join(',');
 // 5. tracker page
 location.hash='#/onboarding/'+o.id; await obRenderTracker(o.id); let T=document.getElementById('content').innerHTML;
 r.trackerHead = /A · STORE OPERATION — TIKTOK SHOP/.test(T) && /B · LIVESTREAMING — TIKTOK LIVE/.test(T) && /2\. Brand Preparation/.test(T) && /Shop Live: <b>1 Apr 2027/.test(T);
 r.trackerKpis = />0%</.test(T) && /0 <small>\/ 7/.test(T) && /Days to go-live/.test(T);
 r.picGrouped = (()=>{ const sel=[...document.querySelectorAll('tr[data-id="'+by('S5').id+'"] select')][1]; return sel && sel.querySelector('optgroup') && sel.querySelector('optgroup').label==='Onboarding' && sel.querySelector('optgroup option').textContent==='Anchisa' && sel.value==='anch'; })();
 // 6. status / done coupling + summary
 obSetStatus(by('S1').id,'done'); await new Promise(x=>setTimeout(x,0));
 r.doneSetsDate = by('S1').status==='done' && by('S1').done_date===obISO(obToday());
 obSetStatus(by('S3').id,'waiting_brand'); await new Promise(x=>setTimeout(x,0));
 obSetDone(by('S30').id,'2027-03-28'); await new Promise(x=>setTimeout(x,0));
 r.doneDateSetsStatus = by('S30').status==='done';
 obSetStatus(by('L16').id,'na'); await new Promise(x=>setTimeout(x,0));
 const s=obSummary(o, acts);
 r.summary = s.done===2 && s.total===6 && s.pct===33 && s.waiting===1 && s.next && s.next.code==='S3';
 await obRenderTracker(o.id); T=document.getElementById('content').innerHTML;
 r.kpiAfter = />33%</.test(T) && /ob-wait">1</.test(T);
 // 7. D- edit re-dates; moving Shop Live re-dates every activity with a D-
 obSetDays(by('S32').id,'-14'); await new Promise(x=>setTimeout(x,0));
 r.daysEdit = by('S32').offset_days===-14 && by('S32').deadline==='2027-04-12';   // +14 → Thu 15 Apr, Songkran 13–15 → Mon 12 Apr
 obGoLiveModal(o.id); const gm=document.querySelector('#modal-root'); gm.querySelector('#ogl-date').value='2027-04-08'; await gm.querySelector('#ogl-save').onclick(); await new Promise(x=>setTimeout(x,0));
 r.moved = o.go_live==='2027-04-08' && by('S1').deadline==='2027-01-28' && by('S30').deadline==='2027-04-05' && by('L15').deadline==='2027-04-09';   // +3 → Sun 11 Apr → Fri 9 Apr
 // 8. overdue: a past deadline on an open activity
 by('S3').deadline='2020-01-01'; r.overdue = obOverdue(by('S3')) && !obOverdue(by('S1'));
 // 9a. the workspace page lists the tracker above its boards; another workspace shows nothing
 S.route={view:'ws',id:'ws-ob'}; await renderWorkspace('ws-ob'); await new Promise(x=>setTimeout(x,30)); const W=document.getElementById('content').innerHTML;
 r.wsSection = /Onboarding trackers/.test(W) && /Decathlon/.test(W) && /New onboarding/.test(W) && W.indexOf('Onboarding trackers') < W.indexOf('No boards yet');
 await renderWorkspace('ws-cs'); await new Promise(x=>setTimeout(x,30)); r.wsOther = !/Onboarding trackers/.test(document.getElementById('content').innerHTML);
 // 9. list page shows the tracker
 await obRenderList(); const L=document.getElementById('content').innerHTML;
 r.listRow = /Decathlon/.test(L) && /8 Apr 2027/.test(L) && /ob-over">1</.test(L) && /ob-wait">1</.test(L);
 // 10. export rows
 let exported=null; window.downloadXLSX=(n,rows)=>{ exported={n,rows}; }; obExport(o.id);
 r.exportOk = exported && exported.rows.length===8 && exported.rows[0].includes('What brand provides') && exported.rows[1][8]==='' ;
 // 11. share link + brand page hides PIC/team/remark
 await obShareModal(o.id); r.tokenLen = (o.share_token||'').length; closeModals();
 o.share_token='tok-123456789012345678';
 await renderPublicTracker('tok-123456789012345678'); const P=document.getElementById('pub-root').innerHTML;
 r.pubOk = /Decathlon — TikTok Shop/.test(P) && /What we need from you/.test(P) && /SKU list with price structure/.test(P) && !/Anchisa/.test(P) && !/Remark/.test(P) && !/PIC/.test(P);
 document.getElementById('pub-root').parentNode.remove();
 await renderPublicTracker('bad'); r.pubBad = /Link not found/.test(document.getElementById('pub-root').innerHTML); document.getElementById('pub-root').parentNode.remove();
 // 12. My Work gets a section for my activities
 obSetAct(by('S1').id,{assignee_id:'me',status:'in_progress'},false); await new Promise(x=>setTimeout(x,0));
 S.route={view:'home'}; await renderHome(); await new Promise(x=>setTimeout(x,20)); const H=document.getElementById('content').innerHTML;
 r.homeSection = /My onboarding activities/.test(H) && /Contract signing/.test(H);
 // 13. checklist page + add row + parser
 await obRenderChecklist('st-ops'); const CL=document.getElementById('content').innerHTML;
 r.checklist = /Default PIC/.test(CL) && /Contract signing/.test(CL) && /calendar days/.test(CL);
 await obAddRow('tpl-ops'); r.addRow = OB.ttasks.some(t=>t.template_id==='tpl-ops' && t.title==='New activity' && t.code==='A6');
 const aoa=[[],['','','Phase','#','Activity','What CREA delivers','What Brand provides','Responsibility','CREA team','Days vs Go-Live'],['','','A.  STORE OPERATION  |  TikTok Shop'],['','','1. Kick-off','S1','Contract signing','x','y','Brand x CREA','BD','-70 d'],['','','','S2','Kick-off','x','y','Brand x CREA','OB, KAM','Go-Live'],['','','B.  LIVESTREAMING SERVICE  |  TikTok LIVE'],['','','5. First LIVE','L15','First LIVE','x','-','CREA','LIVE','+3 d'],['','','CREA E-mail']];
 const pr=obParseChecklist(aoa); r.parse = pr.sections.map(s=>s.name+':'+s.tasks.map(t=>t.offset).join('/')).join('|') + ' ' + pr.teamCodes.sort().join('+');
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('no error', !r.error);
check('deadline rule: -70→21 Jan, -3→29 Mar, +3→Fri 2 Apr, +7→8 Apr; holidays skipped', r.cal70==='2027-01-21' && r.cal3==='2027-03-29' && r.calP3==='2027-04-02' && r.calP7==='2027-04-08' && r.wd1==='2026-10-12' && r.wdP3==='2027-04-07');
check('no top-level menu item; workspace hook, tracker and brand-page renderers exist', r.navHas && r.routeFn);
check('empty list invites a new onboarding', r.emptyList);
check('new-onboarding modal offers only checklists with rows', r.modalOffers==='st-ops,st-live');
check('platforms are multi-select, no Other, and a new one can be added', r.platBoxes==='TikTok Shop,Shopee,Lazada,Brand.com' && r.platAdded);
check('tracker created with every activity from both checklists', r.created && r.order==='S1,S3,S5,S30,S32,L15,L16');
check('deadlines computed from the Shop Live date', r.deadlines==='2027-01-21|2027-02-04|2027-03-29|2027-04-08|2027-04-02|2027-04-05');
check('team, default PIC, brand input and responsibility copied in', r.copied);
check('tracker page: service bands, phases, date button, KPIs', r.trackerHead && r.trackerKpis);
check('PIC picker lists the team\'s members first and keeps the default PIC', r.picGrouped);
check('Done sets the done date; a done date sets Done', r.doneSetsDate && r.doneDateSetsStatus);
check('summary: N/A excluded, waiting counted, next deadline', r.summary && r.kpiAfter);
check('editing D- re-dates; moving Shop Live re-dates every D- activity', r.daysEdit && r.moved);
check('overdue only for open activities with a past deadline', r.overdue);
check('tracker listed on its workspace page above the boards, not on others', r.wsSection && r.wsOther);
check('list shows go-live, overdue and waiting counts', r.listRow);
check('Excel export has one row per activity', r.exportOk);
check('share link token generated; brand page hides PIC, team and remarks; bad token refused', r.tokenLen===36 && r.pubOk && r.pubBad);
check('My Work shows my open onboarding activities', r.homeSection);
check('checklist page edits with a default PIC column; add row works', r.checklist && r.addRow);
check('xlsx parser splits sections, offsets and team codes', r.parse==='Store Operation — TikTok Shop:70/0|Livestreaming — TikTok LIVE:-3 BD+KAM+LIVE+OB');
if(!ok) process.exit(1); });
