/* Profile page: opens from the sidebar with nav + personal-info sheet; fields are click-to-edit
   (Enter saves exactly that column to the person's own row, Escape cancels); email/role are
   read-only; the sidebar shows the position; a photo shows in avatars; admins may open others. */
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
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({getPublicUrl:(p)=>({data:{publicUrl:'https://cdn.test/'+p}}), upload:async()=>({error:null})})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={}; try{
 const me={id:'me',role:'admin',full_name:'April N',email:'april@example.test',job_title:'',avatar_color:'#0F766E',active:true,company_id:'c',phone:'',location:'Thailand'};
 const other={id:'u2',role:'internal',full_name:'Prim V',email:'prim@example.test',job_title:'CS Lead',avatar_color:'#3E5C95',active:true,company_id:'c'};
 Object.assign(S,{me, profiles:[me,other], workspaces:[], projects:[], company:{name:'CREA'}, route:{view:'home'},
   teams:[{id:'t1',name:'Customer Service',color:'#0F766E'}], teamMembers:[{team_id:'t1',user_id:'me'}]});
 renderSidebar(); r.sideBefore=[...document.querySelectorAll('#sidebar-user .who > *')].map(e=>e.textContent.trim()).join(' | ');
 myProfileModal();
 r.wide=!!document.querySelector('.modal.profile'); r.nav=[...document.querySelectorAll('#pf-nav button')].map(b=>b.textContent).join(',');
 const txt=document.getElementById('pf-main').textContent.replace(/\\s+/g,' ');
 r.shows={name:/April N/.test(txt), email:/april@example\\.test/.test(txt), role:/admin/.test(txt), location:/Thailand/.test(txt), addPhone:/Add phone/.test(txt), team:/Customer Service/.test(txt), birthday:/Birthday/.test(txt), anniv:/Work anniversary/.test(txt)};
 r.emailRO=!!document.querySelector('.pf-val.ro') && ![...document.querySelectorAll('.pf-val')].some(el=>(el.getAttribute('onclick')||'').includes("'email'"));
 // click-to-edit position, Enter saves
 pfEdit('job_title','text'); const inp=document.querySelector('#pf-main .pf-val input'); r.inputShown=!!inp;
 inp.value='CX Team Lead'; window.__calls.length=0; inp.onkeydown({key:'Enter'}); await new Promise(x=>setTimeout(x,0));
 r.saveCall=window.__calls.find(c=>c.table==='profiles'); r.meTitle=S.me.job_title;
 r.sideAfter=[...document.querySelectorAll('#sidebar-user .who > *')].map(e=>e.textContent.trim()).join(' | ');
 // Escape cancels, nothing written
 pfEdit('phone','tel'); const inp2=document.querySelector('#pf-main .pf-val input'); inp2.value='0812345678'; window.__calls.length=0; inp2.onkeydown({key:'Escape'}); await new Promise(x=>setTimeout(x,0));
 r.escCalls=window.__calls.filter(c=>c.table==='profiles').length; r.phoneStill=S.me.phone;
 // a photo renders as an image in every avatar
 S.me.avatar_url='https://cdn.test/avatars/me/1.jpg'; r.avatarImg=/<img src="https:\\/\\/cdn\\.test\\/avatars\\/me\\/1\\.jpg"/.test(avatar(S.me));
 // admin may open someone else's profile and edit; the self-only tabs are hidden
 closeModals(); profileModal('u2'); r.otherNav=[...document.querySelectorAll('#pf-nav button')].map(b=>b.textContent).join(','); r.otherName=/Prim V/.test(document.getElementById('pf-main').textContent); r.otherEditable=pfCanEdit();
 // a non-admin cannot edit someone else
 S.me.role='internal'; r.staffCanEditOther=pfCanEdit();
 return JSON.stringify(r);}catch(e){ return JSON.stringify({...r, ERR:e.name+' '+e.message+' '+String(e.stack).split('\\n').slice(0,3).join(' | ')}); } };`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(j=>{ const r=JSON.parse(j); let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('sidebar shows role until a position exists', r.sideBefore==='April N | admin');
 check('profile page: wide, nav has Personal info/Notifications/Password/Teams', r.wide && r.nav==='Personal info,Notifications,Password,Teams');
 check('sheet shows name, email, role, location, add-phone prompt, team, dates', Object.values(r.shows).every(Boolean));
 check('email is read-only', r.emailRO);
 check('click-to-edit position, Enter saves exactly that column', r.inputShown && r.saveCall && r.saveCall.op==='update' && r.saveCall.eq.id==='me' && JSON.stringify(r.saveCall.payload)==='{"job_title":"CX Team Lead"}' && r.meTitle==='CX Team Lead');
 check('sidebar shows the new position', r.sideAfter==='April N | CX Team Lead');
 check('Escape cancels without writing', r.escCalls===0 && r.phoneStill==='');
 check('photo renders in avatars', r.avatarImg);
 check('admin opens a colleague: editable, self-only tabs hidden', r.otherNav==='Personal info,Teams' && r.otherName && r.otherEditable===true);
 check('staff cannot edit a colleague', r.staffCanEditOther===false);
 if(!ok) process.exit(1);
}).catch(e=>{ console.error(e); process.exit(1); });
