/* Board sharing: copy the board link and send it to colleagues. There is deliberately no public /
   no-login link — that was removed on 7 Sep, so this suite also guards its absence. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__calls=[]; w.__sel={}; w.__rpc={};
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},update(p){q._op='update';q._p=p;return px;},insert(p){q._op='insert';q._p=p;return px;},eq(c,v){q._eq[c]=v;return px;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}}); return Promise.resolve({data:window.__sel[t]||[],error:null}).then(r,j);}};
 const px=new Proxy(q,{get(o,k){ return k in o? o[k] : (()=>px); }}); return px;};
window.supabase={createClient:()=>({from:window.__mkQuery,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{},
 rpc:async(name,args)=>{ window.__calls.push({rpc:name,args}); const h=window.__rpc[name]; return h? h(args) : {data:null,error:null}; }})};
window.navigator.clipboard={writeText:async(t)=>{window.__copied=t;}};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={};try{ const tick=()=>new Promise(x=>setTimeout(x,10));
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April',company_id:'c'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'Creative',color:'#333'}],
  projects:[{id:'p1',name:'Creative Queue',workspace_id:'w1',status:'active',color:'#08e'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true},
            {id:'u2',full_name:'Vee Thitiphong',role:'internal',active:true,job_title:'Creative lead'},
            {id:'u3',full_name:'Prim V',role:'internal',active:true},
            {id:'u4',full_name:'Gone',role:'internal',active:false}], boardOwners:[], wsOwners:[]});
 shareBoardModal('p1'); await tick();
 const B=document.getElementById('share-body');
 r.sections = [...B.querySelectorAll('.share-sec > label')].map(l=>l.textContent.trim().split('  ')[0]).join('|');
 r.noPublic = !/Public link/.test(B.textContent) && !/no login/.test(B.textContent) && typeof window.renderShareView==='undefined' && typeof window.shareToggle==='undefined';
 r.boardLink = B.querySelector('.share-row input').value;
 r.people = [...B.querySelectorAll('.share-person')].map(x=>x.textContent.trim().replace(/\s+/g,' ')).join('|');
 r.sendDisabled = document.getElementById('share-send').disabled;
 document.getElementById('share-q').value='vee'; shareDraw('p1');
 r.searched = [...document.querySelectorAll('.share-person')].length;
 document.getElementById('share-q').value=''; shareDraw('p1');
 _shareSel.add('u2'); _shareSel.add('u3'); shareCount();
 r.sendEnabled = !document.getElementById('share-send').disabled && /2 selected/.test(document.getElementById('share-count').textContent);
 document.getElementById('share-note').value='Please review';
 window.__rpc.share_board_with = ()=>({data:2,error:null}); window.__calls.length=0;
 await shareSend('p1'); await tick();
 const sent = window.__calls.find(c=>c.rpc==='share_board_with');
 r.sent = sent && sent.args.pid==='p1' && sent.args.uids.sort().join()==='u2,u3' && sent.args.note==='Please review' && _shareSel.size===0;
 await copyText('https://x/y'); r.copied = window.__copied==='https://x/y';
 closeModals();
 // an internal (non-owner) user shares the same way — nothing here is owner-only any more
 S.me={id:'u3',role:'internal',full_name:'Prim V',company_id:'c'}; shareBoardModal('p1'); await tick();
 r.internalSame = !!document.getElementById('share-send') && !/Public link/.test(document.getElementById('share-body').textContent);
 closeModals();
 r.notif = notifLine({kind:'share',title:'Creative Queue',body:'Please review'},{full_name:'April'});
}catch(e){r.error=e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' / ');}return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('no runtime error', !r.error);
 check('two sections only: board link + send to colleagues', /^Board link\b/.test(r.sections) && /\|Send to colleagues\b/.test(r.sections) && r.sections.split('|').length===2);
 check('no public/no-login link anywhere in the app', r.noPublic);
 check('board link is the normal in-app link', /#\/project\/p1$/.test(r.boardLink));
 check('people list shows the position, never the DONE role; self and inactive excluded',
   /Vee ThitiphongCreative lead/.test(r.people) && /Prim V/.test(r.people) && !/internal|admin|management|partner/.test(r.people) && !/April/.test(r.people) && !/Gone/.test(r.people));
 check('send is disabled until someone is ticked, then enabled with a count', r.sendDisabled && r.sendEnabled);
 check('send calls the RPC with the people and the note, then clears', r.sent);
 check('copy writes to the clipboard', r.copied);
 check('any colleague with access can share; still no public option', r.internalSame);
 check('bell wording for a shared board', /April<\/b> shared the board <b>Creative Queue<\/b> with you/.test(r.notif) && /Please review/.test(r.notif));
 if(!ok) process.exit(1); });
