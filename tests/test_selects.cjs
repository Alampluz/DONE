/* Every <select> becomes the DONE menu: hidden native control + styled button; status/priority
   lists show colour dots; >7 options get a search box; choosing writes the select's value and
   fires change (so inline onchange handlers keep working); class "native" opts out. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=String.raw`window.__run=async function(){const r={}; const tick=()=>new Promise(x=>setTimeout(x,5));
 const host=document.createElement('div'); host.innerHTML=
  '<select id="st"><option value="todo">To Do</option><option value="in_progress" selected>In Progress</option><option value="review">Review</option><option value="blocked">Blocked</option><option value="done">Done</option></select>'
 +'<select id="long"><optgroup label="A">'+Array.from({length:9},(_,i)=>'<option value="v'+i+'">Item '+i+'</option>').join('')+'</optgroup><optgroup label="B"><option value="zz">Zed</option></optgroup></select>'
 +'<select id="raw" class="native"><option>x</option></select>'
 +'<select id="dis" disabled><option>Locked</option></select>';
 document.body.appendChild(host); await tick();
 const st=document.getElementById('st'), btn=st.nextElementSibling;
 // a select's own classes ride along so page styling (filter-bar chips etc.) still applies
 const bfHost=document.createElement('div'); bfHost.className='bfbar';
 bfHost.innerHTML='<select class="bf-sel on" id="bf1"><option value="">Status</option><option value="todo">To Do</option></select>';
 document.body.appendChild(bfHost); await tick();
 const bfBtn=document.getElementById('bf1').nextElementSibling;
 r.classesCarried = bfBtn.className.split(' ').sort().join(',');
 r.labelNotGreyed = !bfBtn.classList.contains('empty') && bfBtn.querySelector('.pick-cur').textContent==='Status'; st.addEventListener('change',()=>{window.__changed=st.value;});   // inline onchange does not run in jsdom outside-only mode
 r.enhanced = st.classList.contains('sel-native') && st.tabIndex===-1 && btn && btn.classList.contains('sel-pick');
 r.label = btn.querySelector('.pick-cur').textContent;
 r.dot = (btn.querySelector('.pick-dot')||{}).style?.background || '';
 btn.click();
 const m=document.getElementById('pickmenu');
 r.shortNoSearch = !!m && m.querySelector('.pick-search').hidden && m.querySelectorAll('.pick-opt').length===5;
 r.dots = m.querySelectorAll('.pick-opt .pick-dot').length;
 r.current = m.querySelector('.pick-opt.on')?.textContent.trim();
 // choose Done via mouse
 const done=[...m.querySelectorAll('.pick-opt')].find(o=>/Done/.test(o.textContent));
 done.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
 r.picked = st.value==='done' && window.__changed==='done' && !document.getElementById('pickmenu') && /Done/.test(btn.textContent);
 // programmatic change keeps the button in step via the change event
 st.value='review'; st.dispatchEvent(new window.Event('change')); r.synced=/Review/.test(btn.textContent);
 // long list: search box, groups, filter, keyboard pick
 const lb=document.getElementById('long').nextElementSibling; lb.click(); await tick();
 const m2=document.getElementById('pickmenu');
 r.longSearch = !m2.querySelector('.pick-search').hidden && m2.querySelectorAll('.pick-group').length===2;
 const inp=m2.querySelector('.pick-search'); inp.value='zed'; inp.dispatchEvent(new window.Event('input'));
 r.filtered = m2.querySelectorAll('.pick-opt').length===1;
 inp.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter'}));
 r.longPicked = document.getElementById('long').value==='zz' && /Zed/.test(lb.textContent);
 // opt-out and disabled
 r.nativeKept = !document.getElementById('raw').classList.contains('sel-native') && !document.getElementById('raw').nextElementSibling?.classList?.contains('sel-pick');
 r.disabled = document.getElementById('dis').nextElementSibling.disabled===true;
 // selects rendered later by the app are enhanced too (observer), e.g. the automation builder
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'A'},profiles:[{id:'me',full_name:'A',role:'admin',active:true}],workspaces:[],projects:[]});
 caModal(); await tick();
 r.builderEnhanced = document.querySelectorAll('#ca-body select.sel-native').length>=2 && document.querySelectorAll('#ca-body .sel-pick').length>=2;
 closeModals();
 return r;};`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(r=>{ let ok=true;
 const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
 check('select is hidden and replaced by a styled button showing the current label', r.enhanced && r.label==='In Progress');
 check('the select\'s own classes ride onto the button; first option is not greyed as a placeholder', r.classesCarried==='bf-sel,on,pick,sel-pick' && r.labelNotGreyed);
 check('status list shows colour dots on button and options', r.dot && r.dots===5);
 check('short list opens without a search box, current option marked', r.shortNoSearch && r.current==='In Progress');
 check('choosing sets the value, fires change (inline handler ran), closes, relabels', r.picked && r.synced);
 check('long grouped list gets search; filter + Enter picks', r.longSearch && r.filtered && r.longPicked);
 check('class native opts out; disabled select disables the button', r.nativeKept && r.disabled);
 check('selects rendered later (automation builder) are enhanced by the observer', r.builderEnhanced);
 if(!ok) process.exit(1); });
