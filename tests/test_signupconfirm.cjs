/* Start-a-trial asks for confirmation before anything is created: the dialog names the
   company and email and offers "Back to sign in"; Back returns to sign-in mode with no
   request sent; Yes proceeds to the signup call. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__fetches=[];
w.eval(`window.scrollTo=()=>{};
window.fetch=async(url,opts)=>{ window.__fetches.push(url); return {ok:false, json:async()=>({error:'stopped by test'})}; };
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}}),signInWithPassword:async()=>({error:{message:'nope'}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 const $=s=>document.querySelector(s);
 setAuthMode(true); $('#su-company').value='Acme Co'; $('#su-name').value='Ann'; $('#li-email').value='ann@acme.test'; $('#li-pass').value='correct-horse-9';
 const p1=signIn(); await new Promise(r=>setTimeout(r,0));
 const body=($('#modal-root')||{}).textContent||''; r.dialog=body.replace(/\\s+/g,' ');
 r.noFetchYet=window.__fetches.length===0;
 $('#nc-back').click(); await p1;
 r.afterBackMode=signupMode; r.afterBackBtn=$('#li-btn').textContent; r.afterBackFetches=window.__fetches.length; r.modalGone=!$('#modal-root').textContent;
 setAuthMode(true); $('#su-company').value='Acme Co'; $('#su-name').value='Ann'; $('#li-email').value='ann@acme.test'; $('#li-pass').value='correct-horse-9';
 const p2=signIn(); await new Promise(r=>setTimeout(r,0)); $('#nc-go').click(); await p2;
 r.afterGoFetches=window.__fetches.slice(); r.err=$('#li-err').textContent;
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{ const r=JSON.parse(j); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('dialog names the company, the email and the way back', /Create a new company\?/.test(r.dialog) && /Acme Co/.test(r.dialog) && /ann@acme\.test/.test(r.dialog) && /sign in/.test(r.dialog) && /Forgot password/.test(r.dialog));
 check('nothing is sent before confirming', r.noFetchYet);
 check('Back returns to sign-in mode, nothing sent', r.afterBackMode===false && r.afterBackBtn==='Sign in' && r.afterBackFetches===0 && r.modalGone);
 check('Yes proceeds to the signup call', r.afterGoFetches.length===1 && /\/signup$/.test(r.afterGoFetches[0]) && /stopped by test/.test(r.err));
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
