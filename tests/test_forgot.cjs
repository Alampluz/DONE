/* Forgot password: the sign-in card has the link; without an email it asks for one and
   calls nothing; with an email it asks Supabase for a reset mail that comes back to this
   page and confirms; the recovery dialog cannot be dismissed and names the account. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/done/'});
const w=dom.window; w.__reset=[];
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}}),
       resetPasswordForEmail:async(email,opts)=>{ window.__reset.push({email,opts}); return {data:{},error: email.endsWith('@bad.test')? {message:'Email rate limit exceeded'}:null}; }},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 const err=()=>document.getElementById('li-err');
 r.linkText=(document.getElementById('li-forgot')||{}).textContent;
 document.getElementById('li-email').value=''; await forgotPassword();
 r.emptyMsg=err().textContent; r.emptyCalls=window.__reset.length; r.emptyIsError=!err().classList.contains('ok');
 document.getElementById('li-email').value='april@example.test'; await forgotPassword();
 r.call=window.__reset[0]; r.okMsg=err().textContent; r.okClass=err().classList.contains('ok');
 document.getElementById('li-email').value='x@bad.test'; await forgotPassword();
 r.failMsg=err().textContent; r.failClass=err().classList.contains('ok');
 Object.assign(S,{me:{id:'me',role:'internal',full_name:'April',email:'april@example.test'},profiles:[]});
 changePasswordModal(true);
 r.recTitle=(document.querySelector('.modal-head h2')||{}).textContent; r.recClose=!!document.querySelector('.modal-head .x');
 r.recCancel=[...document.querySelectorAll('.modal-foot button')].some(b=>/Cancel/.test(b.textContent)); r.recBody=document.querySelector('.modal-body').textContent;
 closeModals(); changePasswordModal(); r.normalTitle=(document.querySelector('.modal-head h2')||{}).textContent; r.normalCancel=[...document.querySelectorAll('.modal-foot button')].some(b=>/Cancel/.test(b.textContent));
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{ const r=JSON.parse(j); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('sign-in card has the link', r.linkText==='Forgot password?');
 check('no email: asks for one, calls nothing', /Type your email/.test(r.emptyMsg) && r.emptyCalls===0 && r.emptyIsError);
 check('with email: asks Supabase, redirect back to this page', r.call && r.call.email==='april@example.test' && r.call.opts.redirectTo==='https://workos.test/done/');
 check('confirmation names the address, styled ok', /april@example\.test/.test(r.okMsg) && /reset link/.test(r.okMsg) && r.okClass);
 check('Supabase error is shown as an error', /rate limit/.test(r.failMsg) && !r.failClass);
 check('recovery dialog: no close, no cancel, names the account', r.recTitle==='Choose a new password' && !r.recClose && !r.recCancel && /april@example\.test/.test(r.recBody));
 check('normal change-password dialog unchanged', r.normalTitle==='Change password' && r.normalCancel);
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
