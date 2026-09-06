/* Scanner-proof reset link: opening #/reset?token_hash=…&type=recovery turns the sign-in
   card into a "new password" card; Save verifies the token THEN sets the password (nothing
   is consumed by merely opening the link); a dead token puts the card back with a message. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/done/#/reset?token_hash=abc123&type=recovery'});
const w=dom.window; w.__calls=[];
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}}),
       verifyOtp:async(o)=>{ window.__calls.push(['verifyOtp',o]); return {data:{},error: o.token_hash==='dead'? {message:'Token has expired or is invalid'}:null}; },
       updateUser:async(o)=>{ window.__calls.push(['updateUser',o]); return {data:{},error:null}; }},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 const $=s=>document.querySelector(s);
 r.flow=S._resetFlow; r.emailHidden=$('#li-email').classList.contains('hidden'); r.btn=$('#li-btn').textContent; r.passLbl=$('#li-pass-lbl').textContent;
 r.forgotHidden=$('#li-forgot').classList.contains('hidden'); r.sub=$('#li-sub').textContent;
 $('#li-pass').value='short'; await signIn(); r.shortMsg=$('#li-err').textContent; r.callsAfterShort=window.__calls.length;
 $('#li-pass').value='correct-horse-9'; await signIn(); r.calls=JSON.stringify(window.__calls); r.flowAfter=S._resetFlow; r.emailBack=!$('#li-email').classList.contains('hidden'); r.hash=location.hash; r.btnAfter=$('#li-btn').textContent;
 window.__calls.length=0; showResetCard({token_hash:'dead',type:'recovery'}); $('#li-pass').value='correct-horse-9'; await signIn();
 r.deadMsg=$('#li-err').textContent; r.deadCalls=JSON.stringify(window.__calls); r.deadFlow=S._resetFlow; r.deadEmailBack=!$('#li-email').classList.contains('hidden');
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{ const r=JSON.parse(j); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('link opens the new-password card', r.flow && r.flow.token_hash==='abc123' && r.emailHidden && r.btn==='Save new password' && r.passLbl==='New password' && r.forgotHidden && /new password/i.test(r.sub));
 check('short password refused before any call', /8 characters/.test(r.shortMsg) && r.callsAfterShort===0);
 check('save: verifyOtp with the hash, then updateUser', r.calls==='[["verifyOtp",{"type":"recovery","token_hash":"abc123"}],["updateUser",{"password":"correct-horse-9"}]]');
 check('card returns to sign-in, hash cleaned', r.flowAfter===null && r.emailBack && r.hash==='#/home' && r.btnAfter==='Sign in');
 check('dead token: message, no password set, card back', /invalid or has already been used/.test(r.deadMsg) && r.deadCalls==='[["verifyOtp",{"type":"recovery","token_hash":"dead"}]]' && r.deadFlow===null && r.deadEmailBack);
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
