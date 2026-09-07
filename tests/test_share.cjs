/* Board sharing: the Share modal (copy link, send to colleagues, public link on/off/reset) and the
   read-only public page behind #/share/<token>, which works without a login. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/#/share/abcdefabcdefabcdefabcdef12345678'});
const w=dom.window; w.__calls=[]; w.__sel={}; w.__rpc={};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},update(p){q._op='update';q._p=p;return px;},insert(p){q._op='insert';q._p=p;return px;},eq(c,v){q._eq[c]=v;return px;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}}); return Promise.resolve({data:window.__sel[t]||[],error:null}).then(r,j);}};
 const px=new Proxy(q,{get(o,k){ return k in o? o[k] : (()=>px); }}); return px;};
window.supabase={createClient:()=>({from:window.__mkQuery,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{},
 rpc:async(name,args)=>{ window.__calls.push({rpc:name,args}); const h=window.__rpc[name]; return h? h(args) : {data:null,error:null}; }})};
window.navigator.clipboard={writeText:async(t)=>{window.__copied=t;}};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const board={board:{id:'p1',name:'Creative Queue',description:'Briefs',color:'#08e',workspace:'Creative',company:'CREA',field_config:{priority:{hidden:true},due_date:{label:'Deadline'}}},
 groups:[{id:'g1',name:'Campaigns',color:'#333',position:1},{id:'g2',name:'Empty',color:'#444',position:2}],
 fields:[{id:'f1',label:'Brand',ftype:'select',options:['Mars'],position:1}],
 tasks:[{id:'t1',title:'Mars SIS',status:'review',priority:'urgent',due_date:'2026-01-01',group_id:'g1',assignee:'Vee T',custom:{f1:'Mars'}},{id:'t2',title:'Loose one',status:'todo',priority:'normal',due_date:null,group_id:null,assignee:null,custom:{}}],
 generated_at:new Date().toISOString()};
const driver=String.raw`window.__run=async function(){const r={};try{ const tick=()=>new Promise(x=>setTimeout(x,10));
 // A. anonymous visitor on a share link: public page rendered, login hidden
 window.__rpc.public_board = ({tok})=> ({data: tok==='abcdefabcdefabcdefabcdef12345678'? ${JSON.stringify(board)} : null, error:null});
 await tick(); r.loginHiddenAtLoad = document.getElementById('login-screen').classList.contains('hidden');   // the load-time render ran before the mock existed
 await renderShareView('abcdefabcdefabcdefabcdef12345678'); await tick();
 const sc=document.getElementById('share-screen');
 r.anonPage = !!sc && !sc.hidden && r.loginHiddenAtLoad;
 const txt=sc.textContent;
 r.content = /Creative Queue/.test(txt) && /CREA · Creative/.test(txt) && /Shared view · read-only/.test(txt) && /2 tasks · 2 open/.test(txt);
 r.groups = [...sc.querySelectorAll('.share-gh')].map(g=>g.textContent.trim().replace(/\s+/g,' ')).join('|');
 const heads=[...sc.querySelectorAll('.share-tv thead th')].map(h=>h.textContent);
 r.heads = heads.slice(0,5).join('|');
 r.rowMars = /Mars SIS/.test(txt) && /Vee T/.test(txt) && /Review/.test(txt) && sc.querySelectorAll('.share-late').length===1;
 r.noEdit = sc.querySelectorAll('select, input, button').length===0;
 // bad token → friendly card
 await renderShareView('wrong-token-wrong-token-wrong'); await tick();
 r.badToken = /doesn’t work any more/.test(document.getElementById('share-screen').textContent);
 // leaving the share view brings the login back for an anonymous visitor
 location.hash='#/home'; await tick();
 r.loginBack = document.getElementById('share-screen').hidden && !document.getElementById('login-screen').classList.contains('hidden');

 // B. signed-in owner: Share modal
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'c'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Creative',color:'#333'}],
  projects:[{id:'p1',name:'Creative Queue',workspace_id:'w1',status:'active',color:'#08e',share_enabled:false,share_token:null}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true},{id:'u2',full_name:'Vee T',role:'internal',active:true,job_title:'Creative lead'},{id:'u3',full_name:'Prim V',role:'internal',active:true},{id:'u4',full_name:'Gone',role:'internal',active:false}], boardOwners:[], wsOwners:[]});
 shareBoardModal('p1'); await tick();
 const B=document.getElementById('share-body');
 r.sections = [...B.querySelectorAll('.share-sec > label')].map(l=>l.textContent.trim().split(' ')[0]+' '+l.textContent.trim().split(' ')[1]).join('|');
 r.boardLink = B.querySelector('.share-row input').value;
 r.peopleListed = [...B.querySelectorAll('.share-person span:nth-of-type(1)')].length;
 r.noSelfNoInactive = !/April/.test(B.querySelector('.share-people').textContent) && !/Gone/.test(B.querySelector('.share-people').textContent);
 r.sendDisabled = document.getElementById('share-send').disabled;
 // search filters, tick two people, send
 document.getElementById('share-q').value='v'; shareDraw('p1');
 r.searched = [...document.querySelectorAll('.share-person')].length;
 document.getElementById('share-q').value=''; shareDraw('p1');
 _shareSel.add('u2'); _shareSel.add('u3'); shareCount(); r.sendEnabled = !document.getElementById('share-send').disabled && /2 selected/.test(document.getElementById('share-count').textContent);
 document.getElementById('share-note').value='Please review';
 window.__rpc.share_board_with = ()=>({data:2,error:null}); window.__calls.length=0;
 await shareSend('p1'); await tick();
 const sent = window.__calls.find(c=>c.rpc==='share_board_with');
 r.sent = sent && sent.args.pid==='p1' && sent.args.uids.sort().join()==='u2,u3' && sent.args.note==='Please review' && _shareSel.size===0;
 // public link off by default, toggle on → token + enabled written, link shown
 r.publicOff = /Off/.test(B.textContent) && !/#\/share\//.test(B.textContent);
 window.__calls.length=0; await shareToggle('p1', true); await tick();
 const upd = window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.toggledOn = upd && upd.payload.share_enabled===true && /^[0-9a-f]{48}$/.test(upd.payload.share_token) && upd.eq.id==='p1';
 const tok = upd && upd.payload.share_token;
 const linkVals=()=>[...document.querySelectorAll('#share-body input[readonly]')].map(i=>i.value).join(' ');
 r.linkShown = tok && linkVals().includes('#/share/'+tok) && /visible to anyone/.test(document.getElementById('share-body').textContent);
 // reset makes a different token
 window.__calls.length=0; await shareRotate('p1'); await tick();
 const rot = window.__calls.find(c=>c.table==='projects'&&c.op==='update');
 r.rotated = rot && rot.payload.share_token && rot.payload.share_token!==tok && linkVals().includes(rot.payload.share_token);
 // copy uses the clipboard
 await copyText('https://x/y'); r.copied = window.__copied==='https://x/y';
 // toggle off clears the banner state
 await shareToggle('p1', false); await tick(); r.toggledOff = S.projects[0].share_enabled===false && /Off/.test(document.getElementById('share-body').textContent);
 closeModals();
 // C. a non-owner internal user cannot turn the public link on but can copy/send
 S.me={id:'u3',role:'internal',full_name:'Prim V',company_id:'c'}; shareBoardModal('p1'); await tick();
 r.internalNoPublic = /Only a board owner or an admin/.test(document.getElementById('share-body').textContent) && !!document.getElementById('share-send');
 closeModals();
 // D. bell line + click target
 r.notif = notifLine({kind:'share',title:'Creative Queue',body:'Please review'},{full_name:'April'});
}catch(e){r.error=e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('no runtime error', !r.error);
 check('anonymous share link renders the read-only page and hides login', r.anonPage && r.content);
 check('groups incl. empty and "Other"; board labels/hidden fields respected; late date flagged; nothing editable', /Campaigns\s*1/.test(r.groups) && /Empty\s*0/.test(r.groups) && /Other\s*1/.test(r.groups) && r.heads==='Task|Status|Assignee|Deadline|Brand' && r.rowMars && r.noEdit);
 check('bad token shows a friendly card; leaving the view brings login back', r.badToken && r.loginBack);
 check('share modal: three sections, board link, people list excludes self/inactive, send disabled until someone is ticked', /Board link\|Send to\|Public link/.test(r.sections) && /#\/project\/p1$/.test(r.boardLink) && r.peopleListed===2 && r.noSelfNoInactive && r.sendDisabled);
 check('search filters, ticking enables, send calls the RPC with uids + note and clears', r.searched===2 && r.sendEnabled && r.sent);
 check('public link: off by default, on writes token+flag and shows link, reset rotates, off again', r.publicOff && r.toggledOn && r.linkShown && r.rotated && r.toggledOff);
 check('copy writes to clipboard', r.copied);
 check('non-owner cannot switch the public link on but can send', r.internalNoPublic);
 check('bell wording for a shared board', /April<\/b> shared the board <b>Creative Queue<\/b> with you/.test(r.notif) && /Please review/.test(r.notif));
 if(!ok) process.exit(1); });
