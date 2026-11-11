/* Listing Tracker client (21 Oct 2026): ltParseName, ltStatus, ltMonthClip (Task 3);
   "Campaign setups" section on the ticket — CUSP lookup, save, 503/already, overlap detail (Task 4);
   month report page — ltLoadMonth, ltSummary, ltSummaryText, renderListingTracker, workspace section (Task 7);
   brand cards, platform strips, filters, popover, who set what, activity log (Task 8);
   freeze-window admin tab, legend + strip markers, Excel export (Task 9). */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.scrollTo=()=>{}; window.__rpc=[]; window.__ins=[]; window.__upd=[];
window.__tables={}; window.__rpcRes={}; window.__fnCalls=[];
window.__fn=async()=>({data:null,error:{name:'FunctionsFetchError',message:'no stub'}});
window.__mkQuery=(t)=>{const rows=()=> (window.__tables[t]||[]).map(r=>({...r}));
 const q={_t:t,_mode:'select',_rows:null,_single:false,
 select(){ if(q._mode==='select') q._rows=rows(); return q;},
 insert(r){ q._mode='insert'; const arr=Array.isArray(r)?r:[r]; q._rows=arr.map((x,i)=>({id:t+'-new-'+(window.__ins.length+i+1),...x})); window.__ins.push({t,rows:arr}); (window.__tables[t]=window.__tables[t]||[]).push(...q._rows); return q;},
 update(x){ q._mode='update'; window.__upd.push({t,x}); q._rows=[{...(rows()[0]||{}),...x}]; return q;},
 delete(){ q._mode='delete'; q._rows=[]; return q;},
 single(){ q._single=true; return q;},
 eq(){return q;}, neq(){return q;}, like(){return q;}, gte(){return q;}, lte(){return q;}, is(){return q;}, not(){return q;}, or(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
 then(res,rej){ const d=q._rows||rows(); return Promise.resolve({data:q._single?(d[0]||null):d,error:null}).then(res,rej);}};
 return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{invoke:(name,opts)=>window.__fn(name,opts)},
 rpc:async(name,args)=>{ window.__rpc.push({name,args}); if(window.__rpcRes && name in window.__rpcRes) return window.__rpcRes[name]; if(name==='ob_generate_tasks') return {data:{inserted:args.p_plan.length,redated:0,unchanged:0,deps:args.p_plan.reduce((n,i)=>n+i.deps.length,0)},error:null}; if(name==='ob_readiness') return {data:{gates:3,gates_done:0,open:7,blocked:0,overdue:0,total:7},error:null}; return {data:null,error:null}; }})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{
 r.a=ltParseName('13333214952 LZD 25-31 OCT 26 (PDP+Frame)');
 r.b=ltParseName('CFR-0412 SHP 25-31 Oct 2026 (Frame)');
 r.c=ltParseName('13334182389 TT 22-23 OCT 2026 (Pack6)');
 r.d=ltParseName('Payday frames Oct');
 r.e=ltParseName('1333 shopee 1-2 nov 26 (pdp + frame)');
 r.f=ltParseName('9999999 lazada (PD)');
 r.st=['approved','active','ended','draft'].map(ltStatus);
 const row={begin_at:'2026-10-28T16:52:00Z',end_at:'2026-11-03T16:40:00Z'};
 r.m10=ltMonthClip(row,2026,10); r.m11=ltMonthClip(row,2026,11); r.m9=ltMonthClip(row,2026,9);
 r.lt=typeof LT==='object' && Array.isArray(LT.rows) && LT.loaded===false && LT.lastSynced===null && typeof LT.month==='object';
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;

const driver2=String.raw`window.__run2=async function(){const r={};const tick=()=>new Promise(x=>setTimeout(x,0));
 const settle=async()=>{for(let i=0;i<12;i++) await tick();};
 try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},nav:S.nav||0,
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},{id:'u2',full_name:'May S',role:'internal',active:true}],
  projects:[{id:'p1',name:'Request: Campaign Frames',field_config:{listing_tracker:true}},{id:'p2',name:'Flash Sale',field_config:{}}]});
 window.__tables.projects=S.projects;
 const T={id:'t1',project_id:'p1',title:'TT frames',ticket_no:'CFR-0412',custom:{platform:['TikTok','Shopee']}};
 const T2={id:'t2',project_id:'p2',title:'Other board',custom:{}};
 r.on=ltBoardOn('p1'); r.offFlag=ltBoardOn('p2');
 r.html=ltTaskSectionHTML(T); r.off=ltTaskSectionHTML(T2);
 const fixture={id:72739,name:'13334182389 TT 22-23 OCT 2026 (PDP+Frame)',begin:'2026-10-22T00:00:00+07:00',end:'2026-10-23T23:59:00+07:00',
   state:'approved',seller_id:501,seller:'Ultima II [TH]',positions:null,shops:[{shop_id:9,name:'Ultima TT',platform:'TikTok'}],sku_count:12};
 const skus=Array.from({length:12},(_,i)=>({shop_listing_id:100+i,sku:'SKU-'+(i+1),product_name:'Prod '+(i+1)}));
 const ok=async(name,opts)=>{ window.__fnCalls.push(opts.body); return opts.body.action==='lookup'? {data:fixture,error:null} : {data:{skus},error:null}; };
 const fail503=async(name,opts)=>{ window.__fnCalls.push(opts.body); return {data:null,error:{name:'FunctionsHttpError',message:'Edge Function returned a non-2xx status code',context:{status:503,json:async()=>({code:'cusp_unavailable',message:'CUSP is not reachable'})}}}; };
 window.__fn=ok;
 // direct helper: URL -> id
 const lk=await ltLookup('https://cusp.crea.asia/campaigns/72739');
 r.lkIds=window.__fnCalls.map(b=>b.action+':'+b.id).join(',');
 r.lkShape=!!lk.lookup && Array.isArray(lk.skus) && lk.skus.length;
 window.__fnCalls=[]; await ltLookup('https://cusp.crea.asia/x?id=72739'); r.qIds=window.__fnCalls.map(b=>b.id).join(',');
 window.__fnCalls=[]; r.cfr=await ltLookup('CFR-0412'); r.cfrCalls=window.__fnCalls.length;
 window.__tables.listing_campaigns=[{id:'o1',task_id:'t9',cusp_campaign_id:72735,cusp_seller_id:501,cusp_state:'approved',begin_at:'2026-10-21T00:00:00Z',end_at:'2026-10-25T00:00:00Z'}];
 window.__tables.listing_campaign_skus=[{cusp_campaign_id:72735,shop_listing_id:100},{cusp_campaign_id:72735,shop_listing_id:101}];
 r.ovApproved=await ltOverlapPreview(fixture,skus);
 r.ovEnded=await ltOverlapPreview({...fixture,state:'ended'},skus);
 delete window.__tables.listing_campaigns; delete window.__tables.listing_campaign_skus;
 // UI: detached container
 const box=el('<div class="lt-host">'+r.html+'</div>'); document.body.appendChild(box);
 ltTaskSectionWire(T, box); await settle();
 const $=s=>box.querySelector(s);
 r.hasInput=!!$('#lt-id'); r.btnText=($('#lt-look')||{}).textContent;
 { let open; const gate=new Promise(x=>open=x); const orig=db.from;
   db.from=(t)=>{ const q=orig(t); if(t==='listing_campaigns'){ const th=q.then; q.then=(a,b)=>gate.then(()=>th(a,b)); } return q; };
   $('#lt-id').value='https://cusp.crea.asia/campaigns/72739'; $('#lt-look').click(); await settle();
   r.lookDisabledDuringPreview=$('#lt-look').disabled && $('#lt-found').hidden;
   db.from=orig; open(); await settle();
   r.lookEnabledAfter=!$('#lt-look').disabled; }
 r.found=$('#lt-found').textContent.replace(/\s+/g,' ').trim();
 window.__rpcRes.lt_upsert_campaign={data:{id:'lc1',status:'set',overlap:[],already:null,new_overlaps:0},error:null};
 window.__rpc=[]; $('#lt-save').click(); await settle();
 const up=window.__rpc.find(c=>c.name==='lt_upsert_campaign'); r.up=up? {platform:up.args.p.platform,ctype:up.args.p.ctype,n:up.args.p.skus.length,task:up.args.p.task_id,cid:up.args.p.cusp_campaign_id,state:up.args.p.cusp_state,seller:up.args.p.cusp_seller_id,keys:Object.keys(up.args.p).sort().join(',')} : null;
 // 503
 window.__rpc=[]; window.__fn=fail503;
 $('#lt-id').value='72739'; $('#lt-look').click(); await settle();
 r.f503=$('#lt-found').textContent.replace(/\s+/g,' ').trim(); r.save503=!!$('#lt-save');
 r.rpc503=window.__rpc.some(c=>c.name==='lt_upsert_campaign');
 // 503 cusp_not_configured / 401 / 403 -> honest messages
 const httpErr=(status,body)=>async()=>({data:null,error:{name:'FunctionsHttpError',context:{status,json:async()=>body}}});
 window.__fn=httpErr(503,{code:'cusp_not_configured',message:'CUSP link not set up yet'}); r.mNotConf=(await ltLookup('72739')).message;
 window.__fn=httpErr(401,{code:'staff_only',message:'Staff only'}); r.m401=(await ltLookup('72739')).message;
 window.__fn=httpErr(403,{code:'sync_only',message:'x'}); r.m403=(await ltLookup('72739')).message;
 window.__fn=httpErr(503,{code:'cusp_unavailable',message:'CUSP did not answer, try again'}); r.m503=(await ltLookup('72739')).message;
 window.__fn=httpErr(503,{code:'cusp_not_configured'}); $('#lt-id').value='72739'; $('#lt-look').click(); await settle();
 r.fNotConf=$('#lt-found').textContent.replace(/\s+/g,' ').trim();
 // 404
 window.__fn=async()=>({data:null,error:{name:'FunctionsHttpError',context:{status:404,json:async()=>({code:'not_found',message:'No CUSP campaign with that id'})}}});
 $('#lt-id').value='99999'; $('#lt-look').click(); await settle();
 r.f404=$('#lt-found').textContent.replace(/\s+/g,' ').trim();
 // already logged elsewhere
 window.__fn=ok; window.__rpcRes.lt_upsert_campaign={data:{id:'lcX',status:'set',overlap:[],already:{task_id:'t9',ticket_no:'CFR-0398',logged_by:'u2',logged_by_name:'May'},new_overlaps:0},error:null};
 $('#lt-id').value='72739'; $('#lt-look').click(); await settle();
 const nRowsBefore=box.querySelectorAll('.lt-row').length;
 $('#lt-save').click(); await settle();
 r.already=$('#lt-found').textContent.replace(/\s+/g,' ').trim();
 r.alreadyNoRow=box.querySelectorAll('.lt-row').length===nRowsBefore;
 box.remove();
 // overlap row
 window.__tables.listing_campaigns=[{id:'lc1',task_id:'t1',cusp_campaign_id:72739,cusp_name:fixture.name,platform:'TikTok',ctype:'both',
   begin_at:'2026-10-21T17:00:00Z',end_at:'2026-10-23T16:59:00Z',cusp_state:'approved',status:'set',sku_count:12,logged_by:'me',logged_at:'2026-10-21T04:00:00Z',
   overlap:[{campaign_id:72735,task_id:'t9',ticket_no:'CFR-0401',pic:'u2',pic_name:'May S',from:'2026-10-22T00:00:00Z',to:'2026-10-23T00:00:00Z',
     skus:[{sku:'SKU-1',product_name:'Prod 1'},{sku:'SKU-2',product_name:'Prod 2'},{sku:'SKU-3',product_name:'Prod 3'}]}],overlap_ack:{}}];
 const box2=el('<div class="lt-host">'+ltTaskSectionHTML(T)+'</div>'); document.body.appendChild(box2);
 ltTaskSectionWire(T, box2); await settle();
 const $2=s=>box2.querySelector(s);
 r.rowText=($2('.lt-row[data-id]')||{textContent:''}).textContent.replace(/\s+/g,' ').trim();
 r.planned=[...box2.querySelectorAll('.lt-planned')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join('|');
 const see=[...box2.querySelectorAll('button,a')].find(b=>/see ›/.test(b.textContent)); r.hasSee=!!see; if(see) see.click(); await settle();
 r.detail=($2('.lt-ovd')||{textContent:''}).textContent.replace(/\s+/g,' ').trim();
 const notify=[...box2.querySelectorAll('button')].find(b=>/^Notify /.test(b.textContent.trim())); r.notifyText=notify&&notify.textContent.trim();
 window.__ins=[]; if(notify){ notify.click(); await settle(); }
 const ni=window.__ins.find(x=>x.t==='notifications'); r.notif=ni? {user:ni.rows[0].user_id,kind:ni.rows[0].kind,entity:ni.rows[0].entity_id,type:ni.rows[0].entity_type} : null;
 r.fromTo=fmtDateTime('2026-10-22T00:00:00Z')+' → '+fmtDateTime('2026-10-23T00:00:00Z');
 r.nNotif=window.__ins.filter(x=>x.t==='notifications').length;
 r.comments=window.__ins.filter(x=>x.t==='comments').map(x=>({e:x.rows[0].entity_id,type:x.rows[0].entity_type,a:x.rows[0].author_id,b:x.rows[0].body}));
 r.notifiedLabel=notify&&notify.textContent.trim(); r.notifiedDisabled=notify&&notify.disabled;
 if(notify){ notify.click(); await settle(); } r.nNotifAfter2=window.__ins.filter(x=>x.t==='notifications').length;
 window.__rpc=[]; window.__rpcRes.lt_ack_overlap={data:{'72735':{by:'me',reason:'intended'}},error:null};
 const mark=[...box2.querySelectorAll('button')].find(b=>b.textContent.trim()==='Mark as intended'); r.hasMark=!!mark;
 if(mark){ mark.click(); await settle(); }
 const ack=window.__rpc.find(c=>c.name==='lt_ack_overlap'); r.ack=ack? ack.args : null;
 box2.remove();
 // acked pair renders muted "intended" tag
 window.__tables.listing_campaigns[0].overlap_ack={'72735':{by:'me',reason:'intended'}};
 const box3=el('<div class="lt-host">'+ltTaskSectionHTML(T)+'</div>'); document.body.appendChild(box3);
 ltTaskSectionWire(T, box3); await settle();
 r.ackRow=(box3.querySelector('.lt-row[data-id]')||{textContent:''}).textContent.replace(/\s+/g,' ').trim();
 r.ackRed=!!box3.querySelector('.lt-row .lt-pill.ov');
 // Re-check re-runs lookup+skus+upsert per row
 window.__fn=ok; window.__fnCalls=[]; window.__rpc=[]; window.__rpcRes.lt_upsert_campaign={data:{id:'lc1',status:'set',overlap:[],already:null,new_overlaps:0},error:null};
 const rc=[...box3.querySelectorAll('button')].find(b=>/Re-check CUSP/.test(b.textContent)); r.hasRecheck=!!rc;
 if(rc){ rc.click(); await settle(); }
 r.recheck=window.__fnCalls.map(b=>b.action+':'+b.id).join(',');
 r.recheckUpsert=window.__rpc.filter(c=>c.name==='lt_upsert_campaign').length;
 const sy=window.__rpc.filter(c=>c.name==='lt_sync_apply'); r.syncN=sy.length;
 r.syncKeys=sy[0]? Object.keys(sy[0].args.p).sort().join(',') : null; r.syncSkus=sy[0]&&sy[0].args.p.skus.length; r.syncTask=sy[0]&&sy[0].args.p.task_id;
 box3.remove();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;

const driver3=String.raw`window.__run3=async function(){const r={};const tick=()=>new Promise(x=>setTimeout(x,0));
 const settle=async()=>{for(let i=0;i<12;i++) await tick();};
 const H=3600e3, iso=ms=>new Date(Date.now()+ms).toISOString();
 try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},nav:S.nav||0});
 const page=()=>{ $('#content').innerHTML='<div class="section-title">My tasks <span class="count">0</span></div><div class="section-title">My requests <span class="count">0</span></div><div class="card"></div>'; };
 const secs=()=>[...document.querySelectorAll('#content .section-title')];
 const mine=()=>secs().find(x=>/My listing setups/.test(x.textContent));
 window.__tables.tasks=[{id:'t1',ticket_no:'CFR-0412'},{id:'t2',ticket_no:null}];
 window.__tables.listing_campaigns=[
  {id:'a',task_id:'t1',cusp_campaign_id:111,cusp_name:'111 TT 22-23 OCT 2026 (PDP+Frame)',platform:'TikTok',ctype:'both',begin_at:iso(10*H),end_at:iso(34*H),cusp_state:'approved',overlap:[],overlap_ack:{},logged_by:'me'},
  {id:'b',task_id:'t2',cusp_campaign_id:222,cusp_name:'222 <b>SHP</b> (Frame)',platform:'Shopee',ctype:'frame',begin_at:iso(-72*H),end_at:iso(-24*H),cusp_state:'ended',overlap:[{campaign_id:999,skus:[{sku:'S1'},{sku:'S2'}]}],overlap_ack:{},logged_by:'me'},
  {id:'c',task_id:'t1',cusp_campaign_id:333,cusp_name:'333 old',platform:'Lazada',ctype:'pdp',begin_at:iso(-30*24*H),end_at:iso(-28*24*H),cusp_state:'ended',overlap:[],overlap_ack:{},logged_by:'me'},
  {id:'d',task_id:'t1',cusp_campaign_id:444,cusp_name:'444 not mine',platform:'Lazada',ctype:'pdp',begin_at:iso(5*H),end_at:iso(30*H),cusp_state:'approved',overlap:[],overlap_ack:{},logged_by:'u2'}];
 page(); await ltHomeSection(); await settle();
 const s=mine(); r.has=!!s; r.count=s&&(s.querySelector('.count')||{}).textContent;
 const card=s&&s.nextElementSibling; r.rows=card?card.querySelectorAll('tbody tr').length:0;
 const wrap=s&&s.parentNode; r.order=!!wrap&&wrap.parentNode===$('#content')&&wrap.nextElementSibling===secs().find(x=>/My requests/.test(x.textContent));
 r.text=card?card.textContent.replace(/\s+/g,' '):''; r.html=card?card.innerHTML:'';
 const trs=card?[...card.querySelectorAll('tbody tr')]:[]; r.firstText=trs[0]?trs[0].textContent:'';
 const nav0=window.navigate; window.navigate=()=>{}; r.hashAfter=[];
 for(const t of trs){ t.click(); r.hashAfter.push(location.hash); await tick(); }
 window.navigate=nav0;
 window.__tables.listing_campaigns=[window.__tables.listing_campaigns[2]];
 page(); await ltHomeSection(); await settle(); r.none=!mine();
 window.__tables.listing_campaigns=[]; page(); await ltHomeSection(); await settle(); r.empty=!mine();
 window.__tables.listing_campaigns=[{id:'e',task_id:'t1',cusp_campaign_id:555,cusp_name:'555',platform:'TikTok',ctype:'pdp',begin_at:iso(-5*H),end_at:iso(5*H),cusp_state:'active',overlap:[{campaign_id:9,skus:[{sku:'X'}]}],overlap_ack:{'9':{by:'me'}},logged_by:'me'}];
 page(); await ltHomeSection(); await settle(); r.activeOk=!!mine();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;

const driver4=String.raw`window.__run4=async function(){const r={};const tick=()=>new Promise(x=>setTimeout(x,0));
 const settle=async()=>{for(let i=0;i<12;i++) await tick();};
 try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},nav:S.nav||0,
  workspaces:[{id:'w1',name:'Product Listing'},{id:'w2',name:'Creative'}],
  projects:[{id:'p1',name:'Request: Campaign Frames',workspace_id:'w1',field_config:{listing_tracker:true}},{id:'p2',name:'Flash Sale',workspace_id:'w2',field_config:{}}]});
 const NOW=Date.parse('2026-10-21T05:00:00Z');
 const ov=(cid)=>[{campaign_id:cid,task_id:'tx',ticket_no:'CFR-0401',from:'2026-10-22T00:00:00Z',to:'2026-10-23T00:00:00Z',skus:[{sku:'A'},{sku:'B'},{sku:'C'}]}];
 const base={overlap:[],overlap_ack:{},last_synced:null};
 const rows=[
  {...base,id:'r1',task_id:'t1',ticket_no:'CFR-0410',brand_name:'Ultima II',platform:'Shopee',ctype:'frame',cusp_campaign_id:701,status:'live',cusp_state:'active',begin_at:'2026-10-15T00:00:00Z',end_at:'2026-10-25T00:00:00Z',logged_at:'2026-10-14T03:00:00Z',last_synced:'2026-10-21T01:00:00Z'},
  {...base,id:'r2',task_id:'t2',ticket_no:'CFR-0411',brand_name:'Ultima II',platform:'TikTok',ctype:'pdp',cusp_campaign_id:702,status:'live',cusp_state:'active',begin_at:'2026-10-18T00:00:00Z',end_at:'2026-10-24T00:00:00Z',logged_at:'2026-10-17T03:00:00Z',overlap:ov(703),last_synced:'2026-10-21T02:30:00Z'},
  {...base,id:'r3',task_id:'t3',ticket_no:'CFR-0412',brand_name:'Ultima II',platform:'TikTok',ctype:'both',cusp_campaign_id:703,status:'set',cusp_state:'approved',begin_at:'2026-10-22T00:00:00Z',end_at:'2026-10-23T00:00:00Z',logged_at:'2026-10-20T03:00:00Z',overlap:ov(702)},
  {...base,id:'r4',task_id:'t4',ticket_no:'CFR-0413',brand_name:'Nestle',platform:'Shopee',ctype:'frame',cusp_campaign_id:704,status:'set',cusp_state:'approved',begin_at:'2026-10-22T17:00:00Z',end_at:'2026-10-24T00:00:00Z',logged_at:'2026-10-20T03:00:00Z'},
  {...base,id:'r5',task_id:'t5',ticket_no:'CFR-0414',brand_name:'Nestle',platform:'Lazada',ctype:'pdp',cusp_campaign_id:705,status:'set',cusp_state:'approved',begin_at:'2026-10-28T00:00:00Z',end_at:'2026-10-30T00:00:00Z',logged_at:'2026-10-20T03:00:00Z'},
  {...base,id:'r6',task_id:'t6',ticket_no:'CFR-0415',brand_name:'Ostech',platform:'Lazada',ctype:'both',cusp_campaign_id:706,status:'done',cusp_state:'ended',begin_at:'2026-10-01T00:00:00Z',end_at:'2026-10-03T00:00:00Z',logged_at:'2026-10-02T03:00:00Z'}];
 const noId=[{id:'t9',ticket_no:'CFR-0420',title:'Payday frames',due_date:'2026-10-25',created_at:'2026-10-10T00:00:00Z',status:'todo',project_id:'p1'}];
 r.sum=ltSummary(rows,2026,10,noId,NOW);
 r.text=ltSummaryText(r.sum,2026,10);
 r.fmt=[fmtDate('2026-10-22T00:00:00Z'),fmtDate('2026-10-23T00:00:00Z'),fmtDate('2026-10-25')];
 const clean=[rows[0],rows[3]].map(x=>({...x,overlap:[]}));
 r.sumOk=ltSummary(clean,2026,10,[],NOW); r.textOk=ltSummaryText(r.sumOk,2026,10);
 r.textOv=ltSummaryText(ltSummary(rows,2026,10,[],NOW),2026,10);
 r.textNoId=ltSummaryText(ltSummary(clean,2026,10,noId,NOW),2026,10);
 r.ym=[ltYM(2026,1,-1),ltYM(2026,12,1),ltYM(2026,10,0)];
 // load: rpc + noId tasks (minus tasks that have a row, minus done) + last synced
 window.__rpcRes.lt_month={data:rows,error:null}; window.__rpcRes.lt_no_id_tasks={data:noId,error:null};
 window.__tables.tasks=[...noId,{id:'t1',ticket_no:'CFR-0410',title:'x',status:'todo',project_id:'p1'},{id:'t8',ticket_no:'CFR-0399',title:'old',status:'done',project_id:'p1'}];
 window.__rpc=[]; const got=await ltLoadMonth(2026,10);
 r.loadCall=J0(window.__rpc.find(c=>c.name==='lt_month'));
 r.loadN=got.rows.length; r.gotShape=J0(Object.keys(got).sort()); r.LTnoId=LT.noIdTasks.map(t=>t.id).join(','); r.LTsync=LT.lastSynced; r.LTmonth=J0(LT.month);
 // page render
 // past month: no no-ID sentence, "—" tile (counted for the current month only); current month unchanged
 r.sumPast=ltSummary(rows,2026,9,noId,NOW); r.textPast=ltSummaryText(r.sumPast,2026,9);
 { const hb=document.createElement('div'); hb.innerHTML=ltNumsHTML(r.sumPast); const t=[...hb.querySelectorAll('.lt-num')][4];
   r.tilePast=t? t.textContent.replace(/\s+/g,' ').trim()+'|'+t.getAttribute('title') : null;
   hb.innerHTML=ltNumsHTML(r.sum); const t2=[...hb.querySelectorAll('.lt-num')][4]; r.tileCur=t2? t2.textContent.replace(/\s+/g,' ').trim()+'|'+t2.getAttribute('title') : null; }
 const dn0=Date.now; Date.now=()=>NOW;   // the page below is October 2026 = the current Bangkok month
 S.nav++;
 await renderListingTracker('2026-10'); await settle();
 Date.now=dn0;
 const C=$('#content'); r.page=C.textContent.replace(/\s+/g,' ');
 r.h1=(C.querySelector('h1')||{}).textContent;
 r.hrefs=[...C.querySelectorAll('a')].map(a=>a.getAttribute('href'));
 r.nums=[...C.querySelectorAll('.lt-num')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
 r.cards=!!C.querySelector('#lt-cards');
 const xl=[...C.querySelectorAll('button')].find(b=>/Excel/.test(b.textContent)); let xlCalls=[]; const d0=window.downloadXLSX; window.downloadXLSX=(...a)=>xlCalls.push(a);
 if(xl) xl.click(); await settle(); r.xlCall=xlCalls.length===1 && /^Listing Tracker \d{4}-\d{2} - /.test(xlCalls[0][0]) && xlCalls[0][2][0].name==='Log'; window.downloadXLSX=d0;
 const lg=[...C.querySelectorAll('button')].find(b=>/Log a setup/.test(b.textContent)); if(lg) lg.click(); await settle();
 const md=document.querySelector('.modal'); r.pick=md? md.textContent.replace(/\s+/g,' ') : null;
 const fi=md&&md.querySelector('input'); if(fi){ fi.value='payday'; fi.dispatchEvent(new window.Event('input')); }
 r.pickFiltered=md? [...md.querySelectorAll('[data-task]')].filter(x=>!x.hidden).map(x=>x.dataset.task).join(',') : null;
 closeModals();
 // escaping of brand names in the paragraph
 window.__rpcRes.lt_month={data:[{...rows[1],brand_name:'<img src=x onerror=alert(1)>'}],error:null};
 S.nav++; await renderListingTracker('2026-10'); await settle(); r.escaped=!$('#content').querySelector('img') && /&lt;img/.test($('#content').innerHTML);
 // bad sub -> current Bangkok month
 window.__rpc=[]; S.nav++; await renderListingTracker('nonsense'); await settle();
 const bk=new Date(Date.now()+7*3600e3); const c=window.__rpc.find(x=>x.name==='lt_month'); r.curOk=!!c && c.args.p_year===bk.getUTCFullYear() && c.args.p_month===bk.getUTCMonth()+1;
 // navrace: S.nav bumped during the await -> nothing painted
 { let open; const gate=new Promise(x=>open=x); const orig=db.rpc;
   db.rpc=async(n,a)=>{ if(n==='lt_month'){ await gate; return {data:rows,error:null}; } return orig(n,a); };
   $('#content').innerHTML='<p id="sentinel">other view</p>';
   const p=renderListingTracker('2026-10'); S.nav++; $('#content').innerHTML='<p id="sentinel">other view</p>'; open(); await p; await settle();
   r.race=$('#content').innerHTML; db.rpc=orig; }
 // error -> text, not blank
 window.__rpcRes.lt_month={data:null,error:{message:'permission denied for function lt_month'}};
 S.nav++; await renderListingTracker('2026-10'); await settle(); r.err=$('#content').textContent.replace(/\s+/g,' ');
 // lt_no_id_tasks error -> no paragraph, error text shown
 window.__rpcRes.lt_month={data:rows,error:null}; window.__rpcRes.lt_no_id_tasks={data:null,error:{message:'permission denied for function lt_no_id_tasks'}};
 S.nav++; await renderListingTracker('2026-10'); await settle();
 r.niErr=$('#content').textContent.replace(/\s+/g,' '); r.niPara=!!$('#content').querySelector('.lt-para');
 { const wp=()=>{ $('#content').innerHTML='<section class="ws-board-directory"></section>'; }; wp(); S.nav++; await ltWorkspaceSection('w1'); await settle();
   r.wsErr=($('#content').querySelector('.lt-ws .lt-err')||{textContent:''}).textContent; r.wsErrNums=$('#content').querySelectorAll('.lt-num').length; }
 window.__rpcRes.lt_no_id_tasks={data:[],error:null};
 // month boundary row counts in Oct and Nov
 const edge={...base,id:'e1',task_id:'t1',ticket_no:'CFR-0410',brand_name:'Ultima II',platform:'Lazada',ctype:'pdp',cusp_campaign_id:799,status:'set',cusp_state:'approved',begin_at:'2026-10-28T16:52:00Z',end_at:'2026-11-03T16:40:00Z',logged_at:'2026-10-27T00:00:00Z'};
 window.__rpcRes.lt_month={data:[edge],error:null};
 const o=await ltLoadMonth(2026,10); r.edgeOct=ltSummary(o.rows,2026,10,[],NOW).total;
 const n=await ltLoadMonth(2026,11); r.edgeNov=ltSummary(n.rows,2026,11,[],NOW).total;
 // workspace section: only on a workspace owning a listing board
 window.__rpcRes.lt_month={data:rows,error:null}; window.__rpcRes.lt_no_id_tasks={data:noId,error:null};
 const wsPage=()=>{ $('#content').innerHTML='<div class="page-head"><h1>WS</h1></div><section class="ws-board-directory"></section>'; };
 wsPage(); S.nav++; await ltWorkspaceSection('w1'); await settle();
 const sec=[...document.querySelectorAll('#content .section-title')].find(x=>/Listing Tracker/.test(x.textContent));
 r.ws=!!sec; r.wsBefore=!!sec && sec.closest('section').nextElementSibling===document.querySelector('.ws-board-directory');
 r.wsNums=[...document.querySelectorAll('#content .lt-num')].length;
 const open=[...document.querySelectorAll('#content button')].find(b=>/Open report/.test(b.textContent)); r.wsOpen=!!open;
 if(open){ const n0=window.navigate; window.navigate=()=>{}; open.click(); r.wsHash=location.hash; await tick(); await tick(); window.navigate=n0; }
 wsPage(); S.nav++; await ltWorkspaceSection('w2'); await settle(); r.ws2=!!document.querySelector('#content .lt-num');
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
const driver5=String.raw`window.__run5=async function(){const r={};const tick=()=>new Promise(x=>setTimeout(x,0));
 const settle=async()=>{for(let i=0;i<14;i++) await tick();};
 const txt=e=>e? e.textContent.replace(/\s+/g,' ').trim() : '';
 try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},nav:S.nav||0,
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},{id:'u2',full_name:'May S',role:'internal',active:true},{id:'u3',full_name:'AOD',role:'internal',active:true},{id:'u4',full_name:'Dear',role:'internal',active:true}],
  projects:[{id:'p1',name:'Request: Campaign Frames',workspace_id:'w1',field_config:{listing_tracker:true}}]});
 const NOW=Date.parse('2026-10-21T05:00:00Z');                       // 21 Oct 12:00 Bangkok
 const bk=(d,h)=>new Date(Date.UTC(2026,9,d,h||0)-7*3600e3).toISOString();  // Bangkok wall time -> ISO
 const base={overlap:[],overlap_ack:{},last_synced:'2026-10-21T01:00:00Z',cusp_seller:'Seller'};
 const skus=[{sku:'S1',product_name:'P1'},{sku:'S2',product_name:'P2'},{sku:'S3',product_name:'P3'},{sku:'S4',product_name:'P4'}];
 const rows=[
  {...base,id:'z1',task_id:'tz',ticket_no:'CFR-0501',brand_name:'Zeta',platform:'Shopee',ctype:'frame',cusp_campaign_id:701,status:'set',cusp_state:'approved',begin_at:bk(25),end_at:bk(31,23),sku_count:10,logged_by:'u4',logged_by_name:'Dear',logged_at:'2026-10-20T03:00:00Z'},
  {...base,id:'a1',task_id:'ta1',ticket_no:'CFR-0601',brand_name:'Alpha',platform:'Shopee',ctype:'pdp',cusp_campaign_id:801,status:'live',cusp_state:'active',begin_at:bk(20),end_at:bk(27,23),sku_count:41,logged_by:'u2',logged_by_name:'May S',logged_at:'2026-10-19T03:00:00Z',
    overlap:[{campaign_id:802,task_id:'ta2',ticket_no:'CFR-0602',pic:'u3',pic_name:'AOD',from:bk(25),to:bk(27,23),skus}]},
  {...base,id:'a2',task_id:'ta2',ticket_no:'CFR-0602',brand_name:'Alpha',platform:'Shopee',ctype:'both',cusp_campaign_id:802,status:'set',cusp_state:'approved',begin_at:bk(25),end_at:bk(31,23),sku_count:9,logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-10-20T08:21:00Z',
    overlap:[{campaign_id:801,task_id:'ta1',ticket_no:'CFR-0601',pic:'u2',pic_name:'May S',from:bk(25),to:bk(27,23),skus}]},
  {...base,id:'a3',task_id:'ta3',ticket_no:'CFR-0603',brand_name:'Alpha',platform:'Lazada',ctype:'frame',cusp_campaign_id:803,status:'done',cusp_state:'ended',begin_at:bk(1),end_at:bk(6,23),sku_count:111,logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-09-30T03:00:00Z'},
  {...base,id:'b1',task_id:'tb1',ticket_no:'CFR-0701',brand_name:'Beta',platform:'TikTok',ctype:'frame',cusp_campaign_id:901,status:'live',cusp_state:'active',begin_at:bk(18),end_at:bk(23,23),sku_count:5,logged_by:'u4',logged_by_name:'Dear',logged_at:'2026-10-17T03:00:00Z'},
  {...base,id:'g1',task_id:'tg1',ticket_no:'CFR-0801',brand_name:'Gamma',platform:'Lazada',ctype:'pdp',cusp_campaign_id:951,status:'set',cusp_state:'approved',begin_at:new Date(NOW+10*3600e3).toISOString(),end_at:bk(24,23),sku_count:7,logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-10-20T03:00:00Z'},
  {...base,id:'aa1',task_id:'taa',ticket_no:'CFR-0901',brand_name:'Aaron',platform:'Lazada',ctype:'both',cusp_campaign_id:961,status:'done',cusp_state:'ended',begin_at:bk(2),end_at:bk(3,23),sku_count:3,logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-10-01T03:00:00Z'}];
 const noId=[{id:'tn',ticket_no:'CFR-0430',title:'Beta payday frames',due_date:'2026-10-25',status:'todo',project_id:'p1'}];
 const opt={noIdTasks:noId,now:NOW}; S.route={view:'listing',id:'2026-10'};
 const host=document.createElement('div'); document.body.appendChild(host);
 const cards=f=>{ host.innerHTML=ltBrandCardsHTML(rows,2026,10,f||{chip:'all',q:''},opt); return [...host.querySelectorAll('.lt-bcard')]; };
 const names=f=>cards(f).map(c=>txt(c.querySelector('h3'))).join(',');
 r.order=names();
 r.attention=names({chip:'attention',q:''}); r.live=names({chip:'live',q:''}); r.soon=names({chip:'soon',q:''});
 r.qBrand=names({chip:'all',q:'ALP'}); r.qTicket=names({chip:'all',q:'cfr-0501'}); r.qNone=txt(host);
 names({chip:'all',q:'zzz'}); r.qNone=txt(host);
 const all=cards();
 const card=n=>all.find(c=>txt(c.querySelector('h3'))===n);
 const zeta=card('Zeta'), alpha=card('Alpha'), beta=card('Beta'), aaron=card('Aaron');
 r.zHead=txt(zeta.querySelector('.lt-bhead')); r.aHead=txt(alpha.querySelector('.lt-bhead')); r.bHead=txt(beta.querySelector('.lt-bhead')); r.aaHead=txt(aaron.querySelector('.lt-bhead'));
 r.aAlert=alpha.classList.contains('alert'); r.zAlert=zeta.classList.contains('alert');
 const zStrip=zeta.querySelector('.lt-strip'); r.zCells=zStrip.querySelectorAll('.lt-d').length;
 r.zWe=[...zStrip.querySelectorAll('.lt-d')].map((d,i)=>d.classList.contains('we')?i+1:0).filter(Boolean).join(',');
 const zSeg=zStrip.querySelectorAll('.lt-seg'); r.zSegN=zSeg.length; r.zLeft=zSeg[0]&&zSeg[0].style.left; r.zWidth=zSeg[0]&&zSeg[0].style.width; r.zCls=zSeg[0]&&zSeg[0].className;
 r.zToday=(zStrip.querySelector('.lt-today')||{style:{}}).style.left;
 r.zIco=(zeta.querySelector('.lt-ico')||{}).className+'|'+txt(zeta.querySelector('.lt-ico'));
 r.zList=txt(zeta.querySelector('.lt-plist')); r.zLink=(zeta.querySelector('.lt-plist a')||{getAttribute:()=>null}).getAttribute('href');
 const aRows=[...alpha.querySelectorAll('.lt-prow')]; r.aPlats=aRows.map(p=>txt(p.querySelector('.lt-plat'))).join(',');
 const aShp=aRows[0].querySelector('.lt-strip'); r.aH=aShp.style.height; r.aTops=[...aShp.querySelectorAll('.lt-seg')].map(x=>x.style.top).join('|'); r.zH=zStrip.style.height;
 r.aSegs=[...aShp.querySelectorAll('.lt-seg')].map(s=>s.className).join('|');
 r.aList=txt(aRows[0].querySelector('.lt-plist'));
 r.aFoot=txt(alpha.querySelector('.lt-bfoot.red .lt-fs')); r.aFootN=alpha.querySelectorAll('.lt-bfoot.red').length;
 r.aBtns=[...alpha.querySelectorAll('.lt-bfoot.red button')].map(b=>txt(b)).join('|');
 r.bFoot=txt(beta.querySelector('.lt-bfoot.amber')); r.bBtns=[...beta.querySelectorAll('.lt-bfoot.amber button,.lt-bfoot.amber a')].map(b=>txt(b)).join('|');
 // Feb 2026 / 30-day month strips; days-in-month positioning
 const sb=document.createElement('div'); sb.innerHTML=ltStripHTML([],2026,2,NOW); r.febCells=sb.querySelectorAll('.lt-d').length; r.febToday=!!sb.querySelector('.lt-today');
 r.febWe=[...sb.querySelectorAll('.lt-d')].map((d,i)=>d.classList.contains('we')?i+1:0).filter(Boolean).join(',');
 sb.innerHTML=ltStripHTML([{...rows[0],begin_at:'2026-11-29T17:00:00Z',end_at:'2026-11-30T16:00:00Z'}],2026,11,NOW); r.novCells=sb.querySelectorAll('.lt-d').length; r.novSeg=(sb.querySelector('.lt-seg')||{style:{}}).style.left+'|'+(sb.querySelector('.lt-seg')||{style:{}}).style.width;
 // three overlapping segments on one platform -> three lanes
 sb.innerHTML=ltStripHTML([{...rows[0],id:'x1',begin_at:bk(10),end_at:bk(20)},{...rows[0],id:'x2',begin_at:bk(12),end_at:bk(18)},{...rows[0],id:'x3',begin_at:bk(15),end_at:bk(25)}],2026,10,NOW);
 r.lanes=[...sb.querySelectorAll('.lt-seg')].map(x=>x.style.top).join('|'); r.lanesH=sb.querySelector('.lt-strip').style.height;
 // brand match: short name is a whole token; longest brand wins; unmatched -> catch-all card
 const bm=(b,t)=>({...rows[0],id:'m'+b,brand_name:b,ticket_no:'CFR-M'+b});
 const nid=[{id:'n1',ticket_no:'CFR-1',title:'Listing update',status:'todo'},{id:'n2',ticket_no:'CFR-2',title:'Dove Men+Care payday',status:'todo'},{id:'n3',ticket_no:'CFR-3',title:'IN payday frames',status:'todo'},{id:'n4',ticket_no:'CFR-4',title:'dove relaunch',status:'todo'}];
 host.innerHTML=ltBrandCardsHTML([bm('IN'),bm('Dove'),bm('Dove Men+Care'),bm('Zed')],2026,10,{chip:'all',q:''},{noIdTasks:nid,now:NOW});
 const amb=n=>{ const c=[...host.querySelectorAll('.lt-bcard')].find(c=>txt(c.querySelector('h3'))===n); return c? [...c.querySelectorAll('.lt-nid b')].map(txt).join(',') : null; };
 r.bmIN=amb('IN'); r.bmDove=amb('Dove'); r.bmDMC=amb('Dove Men+Care'); r.bmCatch=amb('Tickets without a CUSP ID');
 r.bmOrder=[...host.querySelectorAll('.lt-bcard h3')].map(txt).join(',');
 r.bmCatchHead=txt(host.querySelector('.lt-catchall .lt-bhead'));
 host.innerHTML=ltBrandCardsHTML([bm('Zed')],2026,10,{chip:'attention',q:''},{noIdTasks:[nid[0]],now:NOW}); r.bmAtt=[...host.querySelectorAll('.lt-bcard h3')].map(txt).join(',');
 r.noLookbehind=!/\(\?<[!=]/.test(ltBrandMatch.toString());
 r.bmFn=[ltBrandMatch('IN','Listing update'),ltBrandMatch('IN','IN payday'),ltBrandMatch('Dove','Dovetail'),ltBrandMatch('Dove','[DOVE] frames'),ltBrandMatch('A.B','AxB'),ltBrandMatch('Clé de Peau','Clé de Peau x LZD')].join(',');
 // escaping
 host.innerHTML=ltBrandCardsHTML([{...rows[0],brand_name:'<img src=x onerror=1>',ticket_no:'<b>T</b>'}],2026,10,{chip:'all',q:''},{noIdTasks:[],now:NOW});
 r.escCards=!host.querySelector('img') && !host.querySelector('.lt-plist b') && /&lt;img/.test(host.innerHTML);
 // people
 host.innerHTML=ltPeopleHTML(rows);
 r.people=[...host.querySelectorAll('.lt-person')].map(p=>txt(p.querySelector('.n'))+'='+txt(p.querySelector('.c'))).join(',');
 r.pAod=txt(host.querySelector('.lt-person .s')); r.pBars=[...host.querySelector('.lt-person .lt-bars').children].map(i=>i.className+':'+i.style.width).join(',');
 r.pHead=txt(host); r.aodT=fmtDateTime('2026-10-20T08:21:00Z');
 // log
 const acts=[
  {id:1,actor_id:'u2',action:'listing_setup_logged',created_at:'2026-10-19T03:00:00Z',detail:{cusp_campaign_id:801,platform:'Shopee',ctype:'pdp',begin_at:bk(20),end_at:bk(27,23),new:true}},
  {id:2,actor_id:'u3',action:'listing_overlap_found',created_at:'2026-10-20T08:21:00Z',detail:{campaign_id:802,other_campaign_id:801,other_task_id:'ta1',from:bk(25),to:bk(27,23),sku_count:4}},
  {id:3,actor_id:'u3',action:'listing_overlap_found',created_at:'2026-10-20T08:21:00Z',detail:{campaign_id:801,other_campaign_id:802,other_task_id:'ta2',from:bk(25),to:bk(27,23),sku_count:4}},
  {id:4,actor_id:null,action:'listing_state_changed',created_at:'2026-10-20T16:50:00Z',detail:{cusp_campaign_id:901,from:'approved',to:'active'}},
  {id:5,actor_id:'zz',action:'listing_setup_logged',created_at:'2026-10-02T03:00:00Z',detail:{cusp_campaign_id:999,platform:'Lazada',ctype:'both',begin_at:bk(2),end_at:bk(3),new:true}},
  {id:6,actor_id:'me',action:'listing_overlap_ack',created_at:'2026-10-21T02:00:00Z',detail:{campaign_id:801,other_campaign_id:802,reason:'intended'}}];
 const syncs=[{ran_at:'2026-10-20T23:00:00Z',campaigns:37,overlaps:1,errors:null}];
 const merged=ltMergeActivity(acts,syncs);
 host.innerHTML=ltLogHTML(merged,rows);
 r.log=[...host.querySelectorAll('.lt-log li')].map(li=>txt(li.querySelector('.lt-lt'))).join('\n');
 r.logT=fmtDateTime('2026-10-20T23:00:00Z'); r.logFlag=!!host.querySelector('.lt-log .lt-flag');
 r.logTimes=[...host.querySelectorAll('.lt-log li .t')].map(x=>txt(x)).join('|');
 r.logEmpty=ltLogHTML([],rows);
 host.innerHTML=ltLogHTML(ltMergeActivity([],[{ran_at:'2026-10-21T23:00:00Z',campaigns:1,overlaps:0,errors:'72731: not found in CUSP\n72736: time budget reached'}]),rows);
 r.logErr=txt(host.querySelector('.lt-log li .lt-lt'));
 // nightly-sync state changes (lt__apply writes {cusp_campaign_id, from, to} with a null actor)
 host.innerHTML=ltLogHTML(ltMergeActivity([
  {id:21,actor_id:null,action:'listing_state_changed',created_at:'2026-10-21T23:01:00Z',detail:{cusp_campaign_id:801,from:'active',to:'ended'}},
  {id:22,actor_id:null,action:'listing_state_changed',created_at:'2026-10-20T23:01:00Z',detail:{cusp_campaign_id:801,from:'approved',to:'active'}},
  {id:23,actor_id:null,action:'listing_state_changed',created_at:'2026-10-19T23:01:00Z',detail:{cusp_campaign_id:801,from:null,to:'paused'}}],[]),rows);
 r.logState=[...host.querySelectorAll('.lt-log li')].map(li=>txt(li.querySelector('.lt-lt'))).join('\n');
 r.logStateLive=(host.querySelector('.lt-log li:nth-child(2) .lt-lt b:last-child')||{}).textContent;
 // footer
 r.footFresh=ltFootHTML('2026-10-21T01:00:00Z',NOW); r.footStale=ltFootHTML('2026-10-19T00:00:00Z',NOW); r.footNone=ltFootHTML(null,NOW);
 r.syncT=fmtDateTime('2026-10-19T00:00:00Z');
 host.remove();
 // ---- the page ----
 window.__rpcRes.lt_month={data:rows,error:null}; window.__rpcRes.lt_no_id_tasks={data:noId,error:null};
 window.__tables.tasks=[]; window.__tables.activity_log=acts; window.__tables.listing_sync_log=syncs;
 S.nav++; await renderListingTracker('2026-10'); await settle();
 const C=$('#content');
 r.pFilters=[...C.querySelectorAll('.lt-filters .lt-chip')].map(b=>txt(b)+':'+b.getAttribute('aria-pressed')).join(',');
 r.pSearch=(C.querySelector('.lt-filters input')||{}).placeholder; r.pSort=txt(C.querySelector('.lt-sortnote'));
 r.pCards=[...C.querySelectorAll('#lt-cards .lt-bcard h3')].map(txt).join(',');
 r.pBoxes=[...C.querySelectorAll('.lt-box h3')].map(txt).join('|'); r.pHint=txt(C.querySelector('.lt-box .hint'));
 r.pLog=C.querySelectorAll('.lt-log li').length; r.pPeople=C.querySelectorAll('.lt-person').length;
 const sum=C.querySelector('.lt-sum');
 const chip=k=>[...C.querySelectorAll('.lt-chip')].find(b=>b.dataset.chip===k);
 chip('attention').click(); await settle();
 r.pAtt=[...C.querySelectorAll('#lt-cards .lt-bcard h3')].map(txt).join(','); r.pSame=C.querySelector('.lt-sum')===sum && C.querySelector('.lt-filters input')!=null;
 r.pPressed=chip('attention').getAttribute('aria-pressed')+'/'+chip('all').getAttribute('aria-pressed'); r.LTf=J0(LT.filter);
 const qi=C.querySelector('.lt-filters input'); chip('all').click(); qi.value='zeta'; qi.dispatchEvent(new window.Event('input')); await settle();
 r.pQ=[...C.querySelectorAll('#lt-cards .lt-bcard h3')].map(txt).join(','); r.pQkeep=C.querySelector('.lt-filters input')===qi;
 qi.value=''; qi.dispatchEvent(new window.Event('input')); await settle();
 // popover
 const seg=[...C.querySelectorAll('#lt-cards .lt-seg')].find(s=>s.dataset.row==='a2'); seg.click(); await settle();
 const pop=document.getElementById('lt-pop'); r.pop=txt(pop); r.popShown=!!pop && !pop.hidden;
 r.popCusp=(pop.querySelector('a[target]')||{getAttribute:()=>null}).getAttribute('href'); r.cuspNull=LT_CUSP_URL===null;
 r.popTicket=([...pop.querySelectorAll('a')].find(a=>/Open ticket/.test(a.textContent))||{getAttribute:()=>null}).getAttribute('href');
 r.popBtns=[...pop.querySelectorAll('a,button')].map(txt).join('|');
 document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})); r.popEsc=pop.hidden;
 const seg1=[...C.querySelectorAll('#lt-cards .lt-seg')].find(s=>s.dataset.row==='a1'); seg1.click(); await settle();
 r.pop1=txt(pop); r.popOne=document.querySelectorAll('#lt-pop').length;
 document.body.click(); r.popOutside=pop.hidden;
 // popover escapes
 ltPopover('nope', null); r.popMissing=pop.hidden;
 // closes on navigation (hashchange) and on #content scroll
 { const nv=window.navigate; window.navigate=()=>{};
   seg1.click(); await settle(); const was=!pop.hidden; window.dispatchEvent(new window.Event('hashchange')); r.popHash=was && pop.hidden;
   seg1.click(); await settle(); $('#content').dispatchEvent(new window.Event('scroll')); r.popScroll=pop.hidden;
   // a stale popover's Re-check never repaints another view
   seg1.click(); await settle(); S.route={view:'home'}; window.__rpc=[]; window.__fnCalls=[];
   const rb=[...pop.querySelectorAll('button')].find(b=>/Re-check/.test(b.textContent)); rb.click(); await settle();
   r.staleRc=window.__rpc.filter(c=>c.name==='lt_month'||c.name==='lt_sync_apply').length===0 && window.__fnCalls.length===0 && pop.hidden;
   S.route={view:'listing',id:'2026-10'}; window.navigate=nv; }
 // re-check from the popover: lookup + lt_sync_apply for that row, then reload
 seg.click(); await settle();
 const fx={id:802,name:'CFR-0602 SHP 25-31 OCT 26 (PDP+Frame)',begin:bk(25),end:bk(31,23),state:'approved',seller_id:5,seller:'Seller',shops:[],sku_count:9};
 window.__fnCalls=[]; window.__fn=async(n,o)=>{ window.__fnCalls.push(o.body); return o.body.action==='lookup'? {data:fx,error:null}:{data:{skus:[{shop_listing_id:1,sku:'S1',product_name:'P1'}]},error:null}; };
 window.__rpc=[]; const rcb=[...pop.querySelectorAll('button')].find(b=>/Re-check/.test(b.textContent)); rcb.click(); await settle();
 r.rcFn=window.__fnCalls.map(b=>b.action+':'+b.id).join(','); const sy=window.__rpc.find(c=>c.name==='lt_sync_apply'); r.rcSync=sy? sy.args.p.task_id+':'+sy.args.p.cusp_campaign_id : null;
 r.rcReload=window.__rpc.filter(c=>c.name==='lt_month').length;
 // red footer actions use the shared handlers
 window.__ins=[]; const nb=[...$('#content').querySelectorAll('.lt-bfoot.red button')].find(b=>/^Notify /.test(b.textContent.trim()));
 nb.click(); await settle();
 const ni=window.__ins.find(x=>x.t==='notifications'); r.cNotif=ni? ni.rows[0].user_id+':'+ni.rows[0].entity_id+':'+ni.rows[0].kind : null;
 r.cComments=window.__ins.filter(x=>x.t==='comments').map(x=>x.rows[0].entity_id).sort().join(','); r.cLabel=txt(nb)+':'+nb.disabled;
 window.__rpc=[]; window.__rpcRes.lt_ack_overlap={data:{},error:null};
 const mb=[...$('#content').querySelectorAll('.lt-bfoot.red button')].find(b=>b.textContent.trim()==='Mark as intended'); mb.click(); await settle();
 const ak=window.__rpc.find(c=>c.name==='lt_ack_overlap'); r.cAck=ak? ak.args.p_id+':'+ak.args.p_other+':'+ak.args.p_reason : null;
 r.cAckReload=window.__rpc.filter(c=>c.name==='lt_month').length;
 // stale sync -> CUSP not reachable
 window.__rpcRes.lt_month={data:rows.map(x=>({...x,last_synced:'2020-01-01T00:00:00Z'})),error:null};
 S.nav++; await renderListingTracker('2026-10'); await settle();
 r.pStale=txt($('#content').querySelector('.lt-foot'));
 // last synced never claims a sync that did not reach CUSP
 { const lc0=window.__tables.listing_campaigns, sl0=window.__tables.listing_sync_log;
   window.__rpcRes.lt_month={data:rows.map(x=>({...x,last_synced:null})),error:null};
   window.__tables.listing_campaigns=[]; window.__tables.listing_sync_log=[{ran_at:'2026-10-21T00:00:00Z',campaigns:0,overlaps:0,errors:'CUSP link not set up yet'}];
   S.nav++; await renderListingTracker('2026-10'); await settle(); r.lsFailed=txt($('#content').querySelector('.lt-foot'));
   window.__tables.listing_campaigns=[{id:'old',cusp_campaign_id:1,last_synced:'2026-10-21T02:00:00Z'}];   // a row outside this month
   S.nav++; await renderListingTracker('2026-10'); await settle(); r.lsAll=txt($('#content').querySelector('.lt-foot')); r.lsAllT=fmtDateTime('2026-10-21T02:00:00Z');
   window.__tables.listing_campaigns=[]; window.__tables.listing_sync_log=[{ran_at:'2026-10-21T03:00:00Z',campaigns:4,overlaps:0,errors:null},{ran_at:'2026-10-21T04:00:00Z',campaigns:0,overlaps:0,errors:'x'}];
   S.nav++; await renderListingTracker('2026-10'); await settle(); r.lsLog=txt($('#content').querySelector('.lt-foot')); r.lsLogT=fmtDateTime('2026-10-21T03:00:00Z');
   window.__tables.listing_campaigns=lc0; window.__tables.listing_sync_log=sl0; }
 window.__rpcRes.lt_month={data:rows,error:null};
 // activity load error -> message in the box, page still there
 const of=db.from; db.from=t=>{ const q=of(t); if(t==='activity_log'){ q.then=(a,b)=>Promise.resolve({data:null,error:{message:'log denied'}}).then(a,b); } return q; };
 S.nav++; await renderListingTracker('2026-10'); await settle(); db.from=of;
 r.pLogErr=txt($('#content').querySelector('#lt-logbox')); r.pLogErrCards=$('#content').querySelectorAll('.lt-bcard').length;
 // navrace: nav bumped while the activity loads -> log box not painted into another view
 { let open; const gate=new Promise(x=>open=x); const of2=db.from;
   db.from=t=>{ const q=of2(t); if(t==='activity_log'){ const th=q.then; q.then=(a,b)=>gate.then(()=>th(a,b)); } return q; };
   const p=renderListingTracker('2026-10'); await settle(); S.nav++; const box=$('#content').querySelector('#lt-logbox'); const before=box&&box.innerHTML; open(); await p; await settle(); db.from=of2;
   r.raceLog=!!box && box.innerHTML===before; }
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
const driver6=String.raw`window.__run6=async function(){const r={};const tick=()=>new Promise(x=>setTimeout(x,0));
 const settle=async()=>{for(let i=0;i<14;i++) await tick();};
 const txt=e=>e? e.textContent.replace(/\s+/g,' ').trim() : '';
 try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},nav:S.nav||0,
  profiles:[{id:'me',full_name:'April Niramol',role:'admin',active:true},{id:'u2',full_name:'May S',role:'internal',active:true},{id:'u3',full_name:'AOD',role:'internal',active:true}],
  projects:[{id:'p1',name:'Request: Campaign Frames',workspace_id:'w1',field_config:{listing_tracker:true}}]});
 const bk=(d,h)=>new Date(Date.UTC(2026,9,d,h||0)-7*3600e3).toISOString();
 const base={overlap:[],overlap_ack:{},last_synced:new Date().toISOString(),sku_count:5};
 const rows=[
  {...base,id:'u2',task_id:'tu2',ticket_no:'CFR-1002',brand_name:'Ultima II',cusp_seller:'Ultima II [TH]',platform:'Shopee',ctype:'both',cusp_campaign_id:1002,cusp_name:'CFR-1002 SHP 25-31 OCT 26 (PDP+Frame)',status:'set',cusp_state:'approved',begin_at:bk(25),end_at:bk(31,23),logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-10-20T03:00:00Z'},
  {...base,id:'k1',task_id:'tk1',ticket_no:'CFR-1004',brand_name:'Kiehls',cusp_seller:"Kiehl's [SG]",platform:'TikTok',ctype:'frame',cusp_campaign_id:1004,cusp_name:'CFR-1004 TT 1-5 OCT 26 (Frame)',status:'done',cusp_state:'ended',begin_at:bk(1),end_at:bk(5,23),logged_by:'u2',logged_by_name:'May S',logged_at:'2026-09-30T03:00:00Z'},
  {...base,id:'u1',task_id:'tu1',ticket_no:'CFR-1001',brand_name:'Ultima II',cusp_seller:'Ultima II [TH]',platform:'Shopee',ctype:'pdp',cusp_campaign_id:1001,cusp_name:'CFR-1001 SHP 20-27 OCT 26 (PDP)',status:'live',cusp_state:'active',begin_at:bk(20),end_at:bk(27,23),logged_by:'u3',logged_by_name:'AOD',logged_at:'2026-10-19T03:00:00Z'},
  {...base,id:'u3',task_id:'tu3',ticket_no:'CFR-1003',brand_name:'Ultima II',cusp_seller:'Ultima II',platform:'Lazada',ctype:'frame',cusp_campaign_id:1003,cusp_name:'CFR-1003 LZD 25-31 OCT 26 (Frame)',status:'set',cusp_state:'approved',begin_at:bk(25),end_at:bk(31,23),logged_by:'u2',logged_by_name:'May S',logged_at:'2026-10-20T04:00:00Z'}];
 const data={rows,noIdTasks:[],openTasks:[],lastSynced:null,month:{y:2026,m:10}};
 const x=ltExportRows(data,2026,10);
 r.header=x.overview[0]; r.ov=x.overview.slice(1); r.logHead=x.log[0]; r.log=x.log.slice(1);
 r.header1=ltExportRows({rows:[]},2026,10).overview[0]; r.empty=ltExportRows({rows:[]},2026,10).overview.length;
 // freeze helpers: Bangkok wall time <-> ISO, explicit +07:00
 r.toIso=ltBkInputToISO('2026-10-08T19:30'); r.toInput=ltIsoToBkInput('2026-10-08T12:30:00Z'); r.badIso=ltBkInputToISO('8/10/2026');
 r.fzSame=ltFreezeText({platform:'Lazada',starts_at:'2026-10-08T12:30:00Z',ends_at:'2026-10-08T13:30:00Z'});
 r.fzCross=ltFreezeText({platform:'All',starts_at:'2026-10-08T16:30:00Z',ends_at:'2026-10-08T17:30:00Z'});
 // XLSX: legacy call and the two-sheet export
 const rec={sheets:[],file:null,aoa:[]};
 window.XLSX={utils:{aoa_to_sheet:a=>{rec.aoa.push(a); return {a};},book_new:()=>({}),book_append_sheet:(wb,ws,n)=>rec.sheets.push(n)},writeFile:(wb,f)=>{rec.file=f;}};
 downloadXLSX('legacy.xlsx',[['A'],['1']]);
 r.legacy=J0({sheets:rec.sheets,file:rec.file,aoa:rec.aoa});
 rec.sheets=[]; rec.file=null; rec.aoa=[];
 // page: legend shows freeze windows, strip marks the day, Excel button exports
 window.__tables.listing_freeze_windows=[{id:'f1',platform:'Lazada',starts_at:'2026-10-08T12:30:00Z',ends_at:'2026-10-08T13:30:00Z',note:'LZD sync'},{id:'f2',platform:'Lazada',starts_at:'2026-10-26T16:30:00Z',ends_at:'2026-10-26T17:30:00Z',note:null}];
 window.__rpcRes.lt_month={data:rows,error:null}; window.__rpcRes.lt_no_id_tasks={data:[],error:null};
 window.__tables.tasks=[]; window.__tables.activity_log=[]; window.__tables.listing_sync_log=[];
 S.route={view:'listing',id:'2026-10'}; S.nav++; await renderListingTracker('2026-10'); await settle();
 const C=$('#content');
 r.legend=txt(C.querySelector('.lt-legend')); r.pills=[...C.querySelectorAll('.lt-legend .freeze')].map(txt);
 const ucard=[...C.querySelectorAll('.lt-bcard')].find(c=>txt(c.querySelector('h3'))==='Ultima II');
 const prow=p=>[...ucard.querySelectorAll('.lt-prow')].find(x=>txt(x.querySelector('.lt-plat')).endsWith(p));
 const fzDays=p=>[...prow(p).querySelectorAll('.lt-d')].map((d,i)=>d.classList.contains('lt-fz')?i+1:0).filter(Boolean).join(',');
 r.fzLzd=fzDays('Lazada'); r.fzShp=fzDays('Shopee');
 C.querySelector('#lt-xl').click(); await settle();
 r.xSheets=rec.sheets.join('|'); r.xFile=rec.file; r.xHead=J0((rec.aoa[0]||[])[0]); r.xLogHead=J0((rec.aoa[1]||[])[0]);
 delete window.XLSX;
 // freeze load error: page still renders
 { const of=db.from; db.from=t=>{ const q=of(t); if(t==='listing_freeze_windows'){ q.then=(a,b)=>Promise.resolve({data:null,error:{message:'fz denied'}}).then(a,b); } return q; };
   S.nav++; await renderListingTracker('2026-10'); await settle(); db.from=of;
   r.fzErrCards=$('#content').querySelectorAll('.lt-bcard').length; r.fzErrPills=$('#content').querySelectorAll('.lt-legend .freeze').length; }
 // admin tab
 r.tabBtn=ltAdminTabButton('listing'); r.tabBtnOff=ltAdminTabButton('users');
 r.help=typeof ADMIN_HELP==='object' && typeof ADMIN_HELP.listing==='string' && ADMIN_HELP.listing.length>10;
 r.hook=/ltAdminTabButton\(adminTab\)/.test(renderAdmin.toString()) && /ltRenderAdminTab\(B\)/.test(renderAdmin.toString());
 const B=document.createElement('div'); document.body.appendChild(B);
 S.nav++; await ltRenderAdminTab(B); await settle();
 r.aRows=B.querySelectorAll('tr[data-id]').length; r.aAdd=!!B.querySelector('tr.lfw-add');
 const r1=B.querySelector('tr[data-id="f1"]');
 r.a1=[r1.querySelector('[data-k=platform]').value,r1.querySelector('[data-k=from]').value,r1.querySelector('[data-k=to]').value,r1.querySelector('[data-k=note]').value].join('|');
 r.aOpts=[...r1.querySelectorAll('[data-k=platform] option')].map(o=>o.value).join(',');
 const add=B.querySelector('tr.lfw-add'); const set=(row,k,v)=>{ row.querySelector('[data-k='+k+']').value=v; };
 // invalid: To before From -> no insert
 window.__ins=[]; set(add,'platform','Lazada'); set(add,'from','2026-10-16T00:30'); set(add,'to','2026-10-15T23:30');
 add.querySelector('[data-act=add]').click(); await settle(); r.badIns=window.__ins.filter(i=>i.t==='listing_freeze_windows').length;
 set(add,'from','2026-10-15T23:30'); set(add,'to','2026-10-16T00:30'); set(add,'note','Mega sale');
 add.querySelector('[data-act=add]').click(); await settle();
 const ins=window.__ins.find(i=>i.t==='listing_freeze_windows'); r.ins=ins? J0(ins.rows[0]) : null;
 window.__upd=[]; const r1b=B.querySelector('tr[data-id="f1"]'); set(r1b,'note','LZD sync 2'); r1b.querySelector('[data-act=save]').click(); await settle();
 const up=window.__upd.find(u=>u.t==='listing_freeze_windows'); r.upd=up? J0(up.x) : null;
 // delete goes through the app's confirm modal
 const dels=[]; const of3=db.from; db.from=t=>{ const q=of3(t); const d=q.delete; q.delete=()=>{ dels.push(t); return d(); }; const e=q.eq; q.eq=(k,v)=>{ if(q._mode==='delete') dels.push(k+'='+v); return e(k,v); }; return q; };
 B.querySelector('tr[data-id="f2"] [data-act=del]').click(); await settle();
 const mdl=document.querySelector('#modal-root .modal'); r.mdl=txt(mdl); r.delBefore=dels.length;
 const ok=[...mdl.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); ok.click(); await settle();
 db.from=of3; r.dels=dels.join(','); r.mdlGone=!document.querySelector('#modal-root .modal');
 // read-only for a non-admin role
 S.me={id:'u2',role:'internal',full_name:'May S'}; S.nav++; await ltRenderAdminTab(B); await settle();
 r.roInputs=B.querySelectorAll('input,select,button').length; r.roText=txt(B.querySelector('tr[data-id="f1"]')); r.roAdd=!!B.querySelector('tr.lfw-add');
 // escaping
 window.__tables.listing_freeze_windows=[{id:'f9',platform:'Lazada',starts_at:'2026-10-08T12:30:00Z',ends_at:'2026-10-08T13:30:00Z',note:'<img src=x onerror=1>'}];
 S.nav++; await ltRenderAdminTab(B); await settle(); r.esc=!B.querySelector('img');
 S.me={id:'me',role:'admin',full_name:'April'};
 B.remove();
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval('window.J0=x=>JSON.stringify(x);'+scripts.join('\n')+'\n'+driver+'\n'+driver2+'\n'+driver3+'\n'+driver4+'\n'+driver5+'\n'+driver6);
w.eval('window.__run()').then(r0=>{ let ok=true; let r=r0;
const J=JSON.stringify;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+J(r))); if(!c) ok=false; };
check('no error', !r.error);
check('parse: LZD, PDP+Frame -> both', J(r.a)===J({ticket:'13333214952',platform:'Lazada',ctype:'both',dates:'25-31 OCT 26'}));
check('parse: CFR ticket, SHP, Frame', r.b&&r.b.ticket==='CFR-0412'&&r.b.platform==='Shopee'&&r.b.ctype==='frame'&&r.b.dates==='25-31 Oct 2026');
check('parse: TT -> TikTok, Pack6 -> other', r.c&&r.c.platform==='TikTok'&&r.c.ctype==='other'&&r.c.ticket==='13334182389');
check('parse: free text -> null platform, other', r.d&&r.d.platform===null&&r.d.ctype==='other'&&r.d.ticket===null&&r.d.dates===null);
check('parse is case-insensitive (shopee, pdp + frame)', !!r.e && r.e.platform==='Shopee' && r.e.ctype==='both' && r.e.ticket==='1333' && r.e.dates==='1-2 nov 26');
check('parse: PD -> pdp', r.f&&r.f.ctype==='pdp'&&r.f.platform==='Lazada');
check('status map', J(r.st)===J(['set','live','done','other']));
check('month clip Bangkok: Oct 28-31, Nov 1-3, Sep null', J(r.m10)===J({s:28,e:31})&&J(r.m11)===J({s:1,e:3})&&r.m9===null);
check('LT state object', r.lt);
return w.eval('window.__run2()').then(q=>{ r=q;
check('section: no error', !q.error);
check('ltBoardOn reads field_config.listing_tracker', q.on===true && q.offFlag===false);
check('section HTML on a flagged board has "Log a setup"', /Log a setup/.test(q.html||'') && /Campaign setups/.test(q.html||''));
check('section HTML empty on a board without the flag', q.off==='');
check('ltLookup: URL path -> id 72739 for lookup and skus', q.lkIds==='lookup:72739,skus:72739' && q.lkShape===12);
check('ltLookup: ?id=72739 query form', q.qIds==='72739,72739');
check('add box: input + "Look up in CUSP"', q.hasInput && q.btnText==='Look up in CUSP');
check('found box: TikTok, PDP+Frame, 12 SKUs, No SKU overlap', ['TikTok','PDP+Frame','12 SKUs','No SKU overlap'].every(x=>(q.found||'').includes(x)));
check('save: lt_upsert_campaign with TikTok / both / 12 skus', !!q.up && q.up.platform==='TikTok' && q.up.ctype==='both' && q.up.n===12 && q.up.task==='t1' && q.up.cid===72739 && q.up.state==='approved' && q.up.seller===501);
check('save payload keys exactly per brief', q.up && q.up.keys==='begin_at,ctype,cusp_campaign_id,cusp_name,cusp_seller,cusp_seller_id,cusp_state,end_at,platform,skus,task_id');
check('503 -> "CUSP did not answer, try again", no Save, no RPC', q.f503==='CUSP did not answer, try again' && !q.save503 && !q.rpc503);
check('503 cusp_not_configured -> "CUSP link not set up yet — paste the CUSP ID in a comment and ask April to log it" (helper + found box)', q.mNotConf==='CUSP link not set up yet — paste the CUSP ID in a comment and ask April to log it' && q.fNotConf===q.mNotConf);
check('401 / 403 -> "Staff only — sign in again"', q.m401==='Staff only — sign in again' && q.m403==='Staff only — sign in again');
check('other 503 -> "CUSP did not answer, try again"', q.m503==='CUSP did not answer, try again');
check('404 -> "Campaign 99999 not found in CUSP"', q.f404==='Campaign 99999 not found in CUSP');
check('already -> "Already logged on CFR-0398 by May", no row added', (q.already||'').includes('Already logged on CFR-0398 by May') && q.alreadyNoRow);
check('overlap row: "3 SKUs overlap" + see ›', /3 SKUs overlap/.test(q.rowText||'') && q.hasSee);
check('row columns: platform, type, CUSP id, SKUs, status, PIC', ['TikTok','PDP+Frame','72739','12','Set','April Niramol'].every(x=>(q.rowText||'').includes(x)));
check('planned but not logged: Shopee greyed with log ›', /Shopee/.test(q.planned||'') && /log ›/.test(q.planned||'') && !/TikTok/.test(q.planned||''));
check('overlap detail: other id, ticket, PIC, SKUs', ['72735','CFR-0401','May S','SKU-1','SKU-3'].every(x=>(q.detail||'').includes(x)));
check('Notify May S -> notifications row for u2', q.notifyText==='Notify May S' && !!q.notif && q.notif.user==='u2' && q.notif.kind==='listing_overlap' && q.notif.entity==='t9' && q.notif.type==='task');
check('Mark as intended -> lt_ack_overlap(lc1, 72735, intended)', q.hasMark && !!q.ack && q.ack.p_id==='lc1' && q.ack.p_other===72735 && q.ack.p_reason==='intended');
check('acked pair: muted "intended" tag, no red badge', /intended/.test(q.ackRow||'') && !q.ackRed);
check('Re-check CUSP re-runs lookup+skus per row', q.hasRecheck && q.recheck==='lookup:72739,skus:72739');
check('Re-check calls lt_sync_apply without platform/ctype, never lt_upsert_campaign', q.syncN===1 && q.recheckUpsert===0 && q.syncTask==='t1' && q.syncSkus===12
  && q.syncKeys==='begin_at,cusp_campaign_id,cusp_name,cusp_seller,cusp_seller_id,cusp_state,end_at,skus,task_id');
check('ltIdFrom: "CFR-0412" is not looked up as 412', q.cfr && q.cfr.error==='bad_id' && q.cfrCalls===0);
check('overlap preview: approved -> 2 shared SKUs with 72735; same campaign ended -> n 0', q.ovApproved && q.ovApproved.n===2 && q.ovApproved.ids.join()==='72735' && q.ovEnded && q.ovEnded.n===0);
check('Look up stays disabled until the found box renders', q.lookDisabledDuringPreview===true && q.lookEnabledAfter===true);
check('Notify: one notification + a comment on both tickets', q.nNotif===1 && q.comments.length===2 && q.comments.map(c=>c.e).sort().join(',')==='t1,t9'
  && q.comments.every(c=>c.type==='task' && c.a==='me' && c.b==='SKU overlap with 72735 (CFR-0401) — 3 SKUs, '+q.fromTo+'. Notified May S.'));
check('Notify: button relabelled "Notified May S", stays disabled, no duplicate send', q.notifiedLabel==='Notified May S' && q.notifiedDisabled===true && q.nNotifAfter2===1);
return w.eval('window.__run3()').then(h=>{ r=h;
check('home: no error', !h.error);
check('home: section "My listing setups" with 2 rows (count 2), before My requests', h.has && h.rows===2 && h.count==='2' && h.order===true);
check('home: row shows name, platform, type, No SKU overlap / 2 SKUs overlap (red), status', ['111 TT','TikTok','PDP+Frame','No SKU overlap','2 SKUs overlap','Set'].every(x=>(h.text||'').includes(x)) && /lt-pill ov/.test(h.html||''));
check('home: name escaped, other PIC row excluded', !/<b>SHP/.test(h.html||'') && !/444/.test(h.text||''));
check('home: row click -> ticket hash / task id hash', h.hashAfter && h.hashAfter[0]==='#/task/t2' && h.hashAfter[1]==='#/t/CFR-0412');
check('home: only an old done row -> no section; no rows -> none', h.none===true && h.empty===true);
check('home: active row with acknowledged overlap still shows', h.activeOk===true);
return w.eval('window.__run4()').then(m=>{ r=m;
check('report: no error', !m.error);
check('summary numbers: total 6, live 2, setSoon 2, overlaps 1 (pair counted once), noId 1', !!m.sum && m.sum.total===6 && m.sum.live===2 && m.sum.setSoon===2 && m.sum.overlaps===1 && m.sum.noId===1);
check('summary: byType 2/2/2, 3 brands, 83% logged before go-live', !!m.sum && J(m.sum.byType)===J({frame:2,pdp:2,both:2,other:0}) && m.sum.brands===3 && m.sum.pctInSla===83);
check('text: ran 6 campaigns / 2 are live right now / Two problems to fix: (1 overlap + no-ID)', /ran 6 campaigns/.test(m.text||'') && /2 are live right now/.test(m.text||'') && /Two problems to fix:/.test(m.text||''));
check('text: exact paragraph', m.text==='3 brands ran 6 campaigns in October: 2 Frames, 2 PDPs and 2 PDP+Frame. 2 are live right now and 2 more are set to start within 48 hours. Two problems to fix: Ultima II on TikTok has two campaigns sharing 3 SKUs from '+(m.fmt||[])[0]+' to '+(m.fmt||[])[1]+'. 1 ticket has no CUSP ID logged yet; the oldest is CFR-0420 Payday frames, due '+(m.fmt||[])[2]+'.');
check('text: no problems -> "Every campaign has a ticket and a PIC." and no "problem"', /Every campaign has a ticket and a PIC\./.test(m.textOk||'') && !/problem/i.test(m.textOk||'') && m.sumOk.overlaps===0 && m.sumOk.noId===0);
check('ltLoadMonth returns {rows, noIdTasks, openTasks, openTasksError, lastSynced, month}', m.gotShape===J(['lastSynced','month','noIdTasks','openTasks','openTasksError','rows']));
check('ltLoadMonth: lt_month(2026,10), 6 rows, no-id = open tasks minus logged, last synced = max', m.loadCall===J({name:'lt_month',args:{p_year:2026,p_month:10}}) && m.loadN===6 && m.LTnoId==='t9' && m.LTsync==='2026-10-21T02:30:00Z' && m.LTmonth===J({y:2026,m:10}));
check('page: h1 "Listing Tracker · October 2026", prev/next month links', m.h1==='Listing Tracker · October 2026' && (m.hrefs||[]).includes('#/listing/2026-09') && (m.hrefs||[]).includes('#/listing/2026-11'));
check('page: heading + six numbers with labels', /This month in one paragraph/.test(m.page||'') && J(m.nums)===J(['6 campaigns this month','2 live right now','2 set, starting soon','1 SKU overlap to resolve','1 ticket without a CUSP ID','83% logged within SLA']));
check('page: paragraph, cards placeholder, Last synced footer', /ran 6 campaigns/.test(m.page||'') && m.cards && /Last synced/.test(m.page||''));
check('page: ⇩ Excel calls the export (downloadXLSX with a Log sheet)', m.xlCall===true);
check('page: "Log a setup" opens a picker of open listing tickets with a filter', !!m.pick && /CFR-0420/.test(m.pick) && /CFR-0410/.test(m.pick) && !/CFR-0399/.test(m.pick) && m.pickFiltered==='t9');
check('page: brand name escaped in the paragraph', m.escaped===true);
check('page: bad sub -> current Bangkok month', m.curOk===true);
check('navrace: S.nav bumped during the load -> nothing painted', m.race==='<p id="sentinel">other view</p>');
check('lt_month error -> error text in the page', /Could not load the Listing Tracker/.test(m.err||'') && /permission denied for function lt_month/.test(m.err||''));
check('text: 1 overlap and no no-ID ticket -> "One problem to fix:"', /One problem to fix: Ultima II on TikTok/.test(m.textOv||'') && !/ticket has no CUSP ID/.test(m.textOv||''));
check('text: only no-ID tickets -> "One problem to fix: 1 ticket has no CUSP ID"', /One problem to fix: 1 ticket has no CUSP ID logged yet/.test(m.textNoId||''));
check('text: zero-count types are left out', /in October: 2 Frames\. /.test(m.textOk||'') && !/0 PDP/.test(m.textOk||''));
check('past month: no no-ID sentence, tile shows "—" titled "counted for the current month only"', r.sumPast.noId===null && !/CUSP ID/.test(m.textPast||'') && /One problem to fix: Ultima II/.test(m.textPast||'') && m.tilePast==='— tickets without a CUSP ID|counted for the current month only');
check('current month: no-ID sentence and count unchanged', m.sum.noId===1 && /1 ticket has no CUSP ID logged yet/.test(m.text||'') && m.tileCur==='1 ticket without a CUSP ID|null');
check('ltYM wraps years', J(m.ym)===J(['2025-12','2027-01','2026-10']));
check('lt_no_id_tasks error -> no paragraph, error text shown', !m.niPara && /Could not load the Listing Tracker/.test(m.niErr||'') && /permission denied for function lt_no_id_tasks/.test(m.niErr||''));
check('workspace section: load error -> one-line .lt-err, no numbers', /permission denied for function lt_no_id_tasks/.test(m.wsErr||'') && m.wsErrNums===0);
check('month boundary row counts in October and November', m.edgeOct===1 && m.edgeNov===1);
check('workspace section: numbers + Open report on the listing workspace, before the boards', m.ws && m.wsBefore && m.wsNums===6 && m.wsOpen && m.wsHash==='#/listing');
check('workspace section: absent on a workspace without a listing board', m.ws2===false);
return w.eval('window.__run5()').then(c=>{ r=c;
const P=v=>((v-1)/31*100).toFixed(3)+'%', W=(s,e,d)=>((e-s+1)/(d||31)*100).toFixed(3)+'%';
check('cards: no error', !c.error);
check('cards: problems first (overlap, no-ID), then A→Z', c.order==='Alpha,Beta,Aaron,Gamma,Zeta');
check('card head: name, n campaigns, PIC most frequent, status chip', c.aHead==='Alpha 3 campaigns · PIC AOD Needs attention' && c.zHead==='Zeta 1 campaign · PIC Dear Nothing live today' && c.bHead==='Beta 1 campaign · PIC Dear Needs attention' && c.aaHead==='Aaron 1 campaign · PIC AOD Nothing live today');
check('card: alert class only with a problem', c.aAlert===true && c.zAlert===false);
check('strip: 31 cells for October, weekends 3,4,10,11,17,18,24,25,31', c.zCells===31 && c.zWe==='3,4,10,11,17,18,24,25,31');
check('strip: one .lt-seg, left/width from ltMonthClip (25–31 Oct)', c.zSegN===1 && c.zLeft===P(25) && c.zLeft==='77.419%' && c.zWidth===W(25,31));
check('segment classes: type + status', c.zCls==='lt-seg frame set');
check('strip: today line at 21 Oct', c.zToday===P(21));
check('platform icon: S, class lt-ico shp', c.zIco==='lt-ico shp|S');
check('plain list: "Frame 25–31 Oct · Set · CFR-0501" with ticket link', c.zList==='Frame 25–31 Oct · Set · CFR-0501' && c.zLink==='#/t/CFR-0501');
check('Alpha: one row per platform (Shopee, Lazada)', c.aPlats==='SShopee,LLazada');
check('overlap: both segments ringed "ov", second lane at top 30px, strip 60px; one lane 34px', c.aSegs==='lt-seg pdp live ov|lt-seg both set ov' && c.aTops==='4px|30px' && c.aH==='60px' && c.zH==='34px');
check('three overlapping segments -> three distinct tops, strip 86px', c.lanes==='4px|30px|56px' && c.lanesH==='86px');
check('brand match: "IN" vs "Listing update" no; longest brand wins; unmatched -> catch-all card', c.bmIN==='CFR-3' && c.bmDove==='CFR-4' && c.bmDMC==='CFR-2' && c.bmCatch==='CFR-1');
check('catch-all card: last among problem cards, own header', c.bmOrder==='Dove,Dove Men+Care,IN,Tickets without a CUSP ID,Zed' && c.bmCatchHead==='Tickets without a CUSP ID 1 ticket · no brand matched in the title Needs attention');
check('Needs attention keeps the catch-all card when no brand matches', c.bmAtt==='Tickets without a CUSP ID');
check('ltBrandMatch: word boundaries, short-name token rule, regex chars escaped, Unicode', c.bmFn==='false,true,false,true,false,true');
check('ltBrandMatch uses no regex lookbehind (Safari < 16.4)', c.noLookbehind===true);
check('popover closes on hashchange and on #content scroll', c.popHash===true && c.popScroll===true);
check('stale popover Re-check off the report route: no lookup, no sync, no repaint', c.staleRc===true);
check('plain list flags "· 4 SKUs overlap"', /PDP 20–27 Oct · Live · 4 SKUs overlap · CFR-0601/.test(c.aList||'') && /PDP\+Frame 25–31 Oct · Set · 4 SKUs overlap · CFR-0602/.test(c.aList||''));
check('red footer: one sentence per pair', c.aFootN===1 && c.aFoot==="4 SKUs overlap on Shopee, 25–27 Oct. May S's PDP (801) and AOD's PDP+Frame (802) both include P1, P2 and P3.");
check('red footer buttons: Notify AOD, Mark as intended', c.aBtns==='Notify AOD|Mark as intended');
check('amber footer: no-ID ticket of the brand + Open ticket', /CFR-0430/.test(c.bFoot||'') && /no CUSP ID/.test(c.bFoot||'') && c.bBtns==='Open ticket');
check('filter Needs attention -> Alpha, Beta', c.attention==='Alpha,Beta');
check('filter Live now -> Alpha, Beta; Starting soon -> Gamma', c.live==='Alpha,Beta' && c.soon==='Gamma');
check('search: brand (case-insensitive) and ticket no', c.qBrand==='Alpha' && c.qTicket==='Zeta' && /No brands match/.test(c.qNone||''));
check('Feb 2026: 28 cells, weekends from the real calendar, no today line', c.febCells===28 && c.febWe==='1,7,8,14,15,21,22,28' && c.febToday===false);
check('Nov (30 days): 30 cells, 30 Nov at (30-1)/30', c.novCells===30 && c.novSeg===((29/30*100).toFixed(3)+'%')+'|'+W(30,30,30));
check('cards escape brand and ticket', c.escCards===true);
check('people: by count desc', c.people==='AOD=4,Dear=2,May S=1');
check('people: brands + last log; type mix bar', c.pAod==='Alpha, Gamma, Aaron · last log '+c.aodT && c.pBars==='f:25%,p:25%,b:50%' && /Who set what/.test(c.pHead) && /Setups logged this month, by PIC\./.test(c.pHead));
check('log: newest first, actor names, overlap once per pair, nightly check', c.log===["April Niramol marked the overlap between 801 and 802 as intended","DONE nightly check: 37 campaigns refreshed, 1 new overlap found","CUSP Beta · TikTok · Frame (901) went live","Overlap found — Alpha · Shopee · PDP+Frame (802) shares 4 SKUs with 801 until 27 Oct","May S logged Alpha · Shopee · PDP 20–27 Oct (801)","DONE logged Lazada · PDP+Frame 2–3 Oct (999)"].join('\n') && c.logFlag);
check('log: nightly check with errors -> ", K errors" (flagged, details in the title)', c.logErr==='DONE nightly check: 1 campaign refreshed, 0 new overlaps found, 2 errors');
check('last synced: sync_log row with errors and 0 campaigns -> footer "Not synced yet"', c.lsFailed==='Not synced yet');
check('last synced: max(last_synced) over ALL listing_campaigns rows, else a clean sync_log run', c.lsAll.startsWith('Last synced '+c.lsAllT) && c.lsLog.startsWith('Last synced '+c.lsLogT));
check('log: time column', (c.logTimes||'').split('|')[1]===c.logT);
check('log: nightly state changes -> CUSP <brand · platform · type> (<id>) went live / ended', c.logState===["CUSP Alpha · Shopee · PDP (801) ended","CUSP Alpha · Shopee · PDP (801) went live","CUSP Alpha · Shopee · PDP (801) changed to paused in CUSP"].join('\n') && c.logStateLive==='live');
check('log: empty -> plain line', /Nothing logged this month yet/.test(c.logEmpty||''));
check('footer: Last synced / stale -> "CUSP not reachable since" / none -> "Not synced yet"', /^<div class="lt-foot">Last synced /.test(c.footFresh||'') && !/not reachable/.test(c.footFresh) && (c.footStale||'').includes('Last synced '+c.syncT+' — CUSP not reachable since') && c.footNone==='<div class="lt-foot lt-stale">Not synced yet</div>');
check('page: filters row (search, 4 chips, sort note)', c.pSearch==='Find a brand or ticket…' && c.pFilters==='All brands:true,Needs attention:false,Live now:false,Starting soon:false' && c.pSort==='Sorted: problems first, then A → Z');
check('page: cards, Who set what, What happened', c.pCards==='Alpha,Beta,Aaron,Gamma,Zeta' && c.pBoxes==='Who set what|What happened, latest first' && c.pLog===6 && c.pPeople===3);
check('page: chip re-renders only #lt-cards, state in LT.filter', c.pAtt==='Alpha,Beta' && c.pSame===true && c.pPressed==='true/false' && c.LTf===J({chip:'attention',q:''}));
check('page: search input re-renders cards, keeps the input', c.pQ==='Zeta' && c.pQkeep===true);
check('popover: title, ids, dates, status, SKUs, PIC, overlap with other id + PIC', c.popShown && ['Alpha · Shopee · PDP+Frame campaign','CUSP 802 · ticket CFR-0602','Set (approved in CUSP)','SKUs9','AOD · logged','4 SKUs with 801 (May S)'].every(x=>(c.pop||'').includes(x)));
check('popover: Open ticket / ↻ Re-check; no "Open in CUSP ↗" while LT_CUSP_URL is null', c.cuspNull===true && c.popCusp===null && c.popTicket==='#/t/CFR-0602' && c.popBtns==='×|Open ticket|↻ Re-check');
check('popover: Escape and outside click close; one element reused', c.popEsc===true && c.popOutside===true && c.popOne===1 && /Live \(active in CUSP\)/.test(c.pop1||'') && /802 \(AOD\)/.test(c.pop1||''));
check('popover: unknown row -> closed', c.popMissing===true);
check('popover Re-check: lookup+skus, lt_sync_apply for that row, month reloaded', c.rcFn==='lookup:802,skus:802' && c.rcSync==='ta2:802' && c.rcReload===1);
check('card Notify: shared handler -> notification to AOD + comments on both tickets', c.cNotif==='u3:ta2:listing_overlap' && c.cComments==='ta1,ta2' && c.cLabel==='Notified AOD:true');
check('card Mark as intended: shared ack -> lt_ack_overlap(a1, 802), month reloaded', c.cAck==='a1:802:intended' && c.cAckReload===1);
check('page: stale last_synced -> "CUSP not reachable since"', /^Last synced .* — CUSP not reachable since$/.test(c.pStale||''));
check('page: activity load error shows in the log box, cards stay', /log denied/.test(c.pLogErr||'') && c.pLogErrCards===5);
check('navrace: nav bumped during the activity load -> log box untouched', c.raceLog===true);
return w.eval('window.__run6()').then(x=>{ r=x;
const H=['Category','Brand','Country','Platform','PIC','Note','Start Campaign','Status','Campaign End','Campaign ID','Ticket No.'];
check('export: no error', !x.error);
check('export header: exact, 5-column block repeated N=2 times', J(x.header)===J(H.concat(H.slice(6))));
check('export header: minimum one block when the month is empty', J(x.header1)===J(H) && x.empty===1);
check('export: one row per brand x platform, brands A-Z, platforms Shopee, Lazada, TikTok', (x.ov||[]).map(o=>o[1]+'/'+o[3]).join(',')==='Kiehls/TikTok,Ultima II/Shopee,Ultima II/Lazada');
check('export: Ultima II Shopee = 20–27 PDP Live then 25–31 PDP+Frame Set', J((x.ov||[])[1])===J(['','Ultima II','TH','Shopee','AOD','PDP/PDP+Frame','20 Oct 00:00','Live','27 Oct 23:00',1001,'CFR-1001','25 Oct 00:00','Set','31 Oct 23:00',1002,'CFR-1002']));
check('export: single-campaign row has empty strings in block 2; Country from [SG], TH default', J((x.ov||[])[2])===J(['','Ultima II','TH','Lazada','May S','Frame','25 Oct 00:00','Set','31 Oct 23:00',1003,'CFR-1003','','','','','']) && J((x.ov||[])[0])===J(['',"Kiehls",'SG','TikTok','May S','Frame','1 Oct 00:00','Done','5 Oct 23:00',1004,'CFR-1004','','','','','']));
check('export Log: exact 13-column header', J(x.logHead)===J(['Brand','Platform','Type','Campaign Name (in CUSP)','Campaign ID','Start Date','Start Time','End Date','End Time','PIC','Status','Ticket No.','Logged at']));
check('export Log: one row per campaign in start order, Bangkok dates/times', (x.log||[]).length===4 && (x.log||[]).every(l=>l.length===13) && J((x.log||[])[1])===J(['Ultima II','Shopee','PDP','CFR-1001 SHP 20-27 OCT 26 (PDP)',1001,'20 Oct 2026','00:00','27 Oct 2026','23:00','AOD','Live','CFR-1001','19 Oct 2026 10:00']) && (x.log||[]).map(l=>l[4]).join(',')==='1004,1001,1002,1003');
check('Bangkok input <-> ISO explicit +07:00', x.toIso==='2026-10-08T12:30:00.000Z' && x.toInput==='2026-10-08T19:30' && x.badIso===null);
check('freeze text: same day and across midnight', x.fzSame==='⚠︎ Lazada content freeze 8 Oct 19:30–20:30' && x.fzCross==='⚠︎ All platforms content freeze 8 Oct 23:30–9 Oct 00:30');
check('downloadXLSX legacy 2-arg call: one sheet "Export"', x.legacy===J({sheets:['Export'],file:'legacy.xlsx',aoa:[[['A'],['1']]]}));
check('⇩ Excel: sheets "Oct 2026" + "Log", filename Listing Tracker 2026-10', x.xSheets==='Oct 2026|Log' && /^Listing Tracker 2026-10 - \d{4}-\d{2}-\d{2}\.xlsx$/.test(x.xFile||'') && x.xHead===J(['Category','Brand','Country','Platform','PIC','Note','Start Campaign','Status','Campaign End','Campaign ID','Ticket No.','Start Campaign','Status','Campaign End','Campaign ID','Ticket No.']) && JSON.parse(x.xLogHead||'[]').length===13);
check('legend: freeze windows from listing_freeze_windows', (x.pills||[]).includes('⚠︎ Lazada content freeze 8 Oct 19:30–20:30') && (x.pills||[]).includes('⚠︎ Lazada content freeze 26 Oct 23:30–27 Oct 00:30') && /Frame/.test(x.legend||''));
check('strip: amber lt-fz marker on the Lazada strip only (8, 26, 27 Oct)', x.fzLzd==='8,26,27' && x.fzShp==='');
check('freeze load error: page renders, no pills', x.fzErrCards===2 && x.fzErrPills===0);
check('admin: tab button + help + two hook lines in renderAdmin', /class="tab active"/.test(x.tabBtn||'') && /Listing Tracker/.test(x.tabBtn||'') && !/active/.test(x.tabBtnOff||'') && x.help===true && x.hook===true);
check('admin tab: rows + add row, Bangkok datetime-local values, platform options', x.aRows===2 && x.aAdd===true && x.a1==='Lazada|2026-10-08T19:30|2026-10-08T20:30|LZD sync' && x.aOpts==='Shopee,Lazada,TikTok,All');
check('admin add: To before From refused; insert converts Bangkok -> ISO', x.badIns===0 && x.ins===J({platform:'Lazada',starts_at:'2026-10-15T16:30:00.000Z',ends_at:'2026-10-15T17:30:00.000Z',note:'Mega sale'}));
check('admin save: update with converted times', x.upd===J({platform:'Lazada',starts_at:'2026-10-08T12:30:00.000Z',ends_at:'2026-10-08T13:30:00.000Z',note:'LZD sync 2'}));
check('admin delete: confirm modal first, then delete by id', /Delete this freeze window\?/.test(x.mdl||'') && x.delBefore===0 && x.dels==='listing_freeze_windows,id=f2' && x.mdlGone===true);
check('admin: read-only for non admin/management', x.roInputs===0 && x.roAdd===false && /Lazada/.test(x.roText||'') && /8 Oct 19:30/.test(x.roText||''));
check('admin: note escaped', x.esc===true);
if(!ok) process.exit(1); }); }); }); }); }); });
