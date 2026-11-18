// Ticket ↔ CUSP campaign matching used by the cusp-campaign edge function's sync (match.mjs, pure).
const path=require('path'), {pathToFileURL}=require('url');
let ok=true; const check=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x))); if(!c) ok=false; };
import(pathToFileURL(path.join(__dirname,'..','supabase','functions','cusp-campaign','match.mjs')).href).then(M=>{
 const {parseName,ticketKey,ticketIndex,matchCampaigns}=M;
 const J=JSON.stringify;
 check('name: monday id, platform, type', J(parseName('13512634613 SHP 11-13 NOV 2026 (PDP)'))===J({ticket:'13512634613',platform:'Shopee',ctype:'pdp'}));
 check('name: DONE ticket number, any case', J(parseName(' cfr-0412 LZD 11-13 Nov 2026 (PDP+Frame)'))===J({ticket:'CFR-0412',platform:'Lazada',ctype:'both'}));
 check('name: type bracket followed by a suffix', parseName('13439767231 SHP 7-13 NOV 2026 (Frame) V.3').ctype==='frame' && parseName('13512252493 LZD 10-13 NOV 2026 (FRAME)').ctype==='frame');
 check('name: free-text bracket is "other"; TT is TikTok', J(parseName('13512295213 TT 10-14  Nov 2026  (Nescafe gold)'))===J({ticket:'13512295213',platform:'TikTok',ctype:'other'}));
 check('name: no ticket ID', parseName('1 FF_Frame_11.11_Teasing_SHP_5').ticket===null && parseName('').ticket===null && parseName(null).ticket===null);
 check('key: only whole ticket numbers / monday ids', ticketKey(' cfr-12 ')==='CFR-12' && ticketKey('13512634613')==='13512634613' && ticketKey('see 135')===null && ticketKey('')===null && ticketKey(null)===null);
 const T=[{task_id:'a',ticket_no:'CFR-0001',monday_id:'13512634613'},{task_id:'b',ticket_no:'CFR-0002',monday_id:null},{task_id:'c',ticket_no:'CFR-0003',monday_id:'999999'},{task_id:'d',ticket_no:'CFR-0004',monday_id:'999999'}];
 const idx=ticketIndex(T);
 check('index: ticket number and monday ID both lead to the ticket; a shared ID is ambiguous', idx.get('CFR-0001').task_id==='a' && idx.get('13512634613').task_id==='a' && idx.get('CFR-0002').task_id==='b' && idx.get('999999')===null && idx.get('CFR-0003').task_id==='c');
 const C=[{id:1,name:'13512634613 SHP 11-13 NOV 2026 (PDP)'},{id:2,name:'CFR-0002 LZD 11-13 NOV 2026 (Frame)'},{id:3,name:'CFR-0001 TT 1-2 DEC 2026 (PDP+Frame)'},
          {id:4,name:'1 FF_Frame_11.11_Teasing_SHP_5'},{id:5,name:'13500000000 LZD 1 NOV 2026'},{id:6,name:'999999 SHP 1 NOV 2026 (Frame)'},{id:7,name:'CFR-0002 SHP 1 NOV 2026 (PDP)'}];
 const r=matchCampaigns(C,idx,new Set([7]));
 check('match: links by monday ID and by ticket number, several campaigns per ticket', J(r.links.map(l=>[l.campaign.id,l.ticket.task_id,l.platform,l.ctype]))===J([[1,'a','Shopee','pdp'],[2,'b','Lazada','frame'],[3,'a','TikTok','both']]), r.links);
 check('match: already logged campaigns are left alone', !r.links.concat(r.unmatched).some(x=>(x.campaign||x).id===7));
 check('match: unmatched carries the reason', J(r.unmatched.map(u=>[u.id,u.why]))===J([[4,'no ticket ID at the start of the name'],[5,'no open ticket carries 13500000000'],[6,'two tickets carry 999999']]), r.unmatched);
 check('match: nothing to do on empty input', J(matchCampaigns([],ticketIndex([]),new Set()))===J({links:[],unmatched:[]}));
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
