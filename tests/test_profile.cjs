/* My profile: the sidebar shows the position when there is one and opens the profile dialog;
   Save writes exactly full_name, job_title and avatar_color to the person's own row and the
   sidebar updates. Email and role are read-only. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window; w.__calls=[];
w.eval(`window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;}, select(){return q;}, single(){return q;},
 eq(c,v){q._eq[c]=v;return q;}, neq(){return q;}, not(){return q;}, is(){return q;}, in(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}}); return Promise.resolve({data:[],error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April N',email:'april@example.test',job_title:'',avatar_color:'#0F766E',active:true,company_id:'c'},
   profiles:[{id:'me',role:'admin',full_name:'April N',email:'april@example.test',avatar_color:'#0F766E',active:true}], workspaces:[], projects:[], company:{name:'CREA'}, route:{view:'home'}});
 renderSidebar(); const who=()=>[...document.querySelectorAll('#sidebar-user .who > *')].map(e=>e.textContent.trim()).join(' | '); r.sideBefore=who();
 myProfileModal();
 r.fields={name:document.getElementById('mp-name').value, title:document.getElementById('mp-title').value, emailDisabled:[...document.querySelectorAll('.modal input[disabled]')].map(i=>i.value)};
 document.getElementById('mp-name').value='April Niramol'; document.getElementById('mp-title').value='CX Team Lead';
 [...document.querySelectorAll('.mp-swatch')].forEach(x=>x.classList.remove('sel')); document.querySelector('.mp-swatch[data-c="#6E56B8"]').classList.add('sel');   // inline onclick does not run in jsdom outside-only mode
 window.__calls.length=0; document.getElementById('mp-save').click(); await new Promise(x=>setTimeout(x,0));
 r.call=window.__calls.find(c=>c.table==='profiles'); r.me={n:S.me.full_name,t:S.me.job_title,c:S.me.avatar_color}; r.prof=S.profiles[0].job_title;
 r.sideAfter=who(); r.modalClosed=!document.querySelector('#mp-save');
 return JSON.stringify(r);};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{ const r=JSON.parse(j); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('sidebar falls back to the role when there is no position', r.sideBefore==='April N | admin');
 check('dialog prefilled; email and role read-only', r.fields.name==='April N' && r.fields.title==='' && r.fields.emailDisabled.join(',')==='april@example.test,admin');
 check('save updates own row with exactly name, position, colour', r.call && r.call.op==='update' && r.call.eq.id==='me' && JSON.stringify(r.call.payload)==='{"full_name":"April Niramol","job_title":"CX Team Lead","avatar_color":"#6E56B8"}');
 check('local state and sidebar reflect the change', r.me.n==='April Niramol' && r.me.t==='CX Team Lead' && r.prof==='CX Team Lead' && r.sideAfter==='April Niramol | CX Team Lead' && r.modalClosed);
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
