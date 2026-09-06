/* Board view switcher: a styled button showing the current view (icon + label) opens a menu
   with all five views, each with an icon, a one-line description and a check on the active
   one. Choosing a view switches boardMode, remembers it per board in localStorage, and a
   later visit to the same board lands on the remembered view. Esc closes the menu. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 const PID='p1'; localStorage.removeItem('workos.view.'+PID); delete S._viewPid; boardMode='table';
 // 1. the button reflects the current view
 const host=document.createElement('div'); host.innerHTML=viewPickerHTML(PID); document.body.appendChild(host);
 const btn=host.querySelector('button.view-pick');
 r.btn=!!btn; r.btnLabel=btn&&btn.querySelector('.vp-cur').textContent; r.btnIcon=!!(btn&&btn.querySelector('.vp-ico svg')); r.noSelect=!host.querySelector('select');
 // 2. the menu lists all views, marks the active one
 viewMenu(btn, PID);
 const menu=document.getElementById('tvmenu'); const opts=menu?[...menu.querySelectorAll('.vm-opt')]:[];
 r.menu=!!menu; r.opts=opts.length; r.labels=opts.map(o=>o.querySelector('b').textContent).join(',');
 r.descs=opts.every(o=>o.querySelector('.vm-txt span').textContent.length>5);
 r.icons=opts.every(o=>o.querySelector('.vp-ico svg'));
 r.active=opts.filter(o=>o.classList.contains('on')).map(o=>o.dataset.k).join(','); r.check=menu.querySelector('.vm-opt.on .vm-check').textContent;
 r.checked=opts.filter(o=>o.getAttribute('aria-checked')==='true').length; r.btnOn=btn.classList.contains('on');
 // 3. clicking an option switches the view, persists it, closes the menu, re-renders
 let rendered=[]; const _rp=window.renderProject; window.renderProject=(id)=>{ rendered.push(id); };
 opts.find(o=>o.dataset.k==='board').click();
 r.mode=boardMode; r.saved=localStorage.getItem('workos.view.'+PID); r.closed=!document.getElementById('tvmenu'); r.rerendered=rendered.join(',');
 r.btnAfter=(()=>{ const d=document.createElement('div'); d.innerHTML=viewPickerHTML(PID); return d.querySelector('.vp-cur').textContent; })();
 // 4. a fresh visit to the same board lands on the remembered view; unknown values are ignored
 boardMode='table'; delete S._viewPid; r.loaded=viewLoad(PID);
 localStorage.setItem('workos.view.p2','nonsense'); r.bogus=viewLoad('p2');
 r.other=viewLoad('p3');
 // 5. Esc closes; toggling the button twice closes too
 window.renderProject=_rp;
 viewMenu(btn, PID); r.reopened=!!document.getElementById('tvmenu');
 return new Promise(res=>setTimeout(()=>{
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); r.escClosed=!document.getElementById('tvmenu'); r.btnOff=!btn.classList.contains('on');
   viewMenu(btn,PID); viewMenu(btn,PID); r.toggleClosed=!document.getElementById('tvmenu');
   res(JSON.stringify(r)); },5));
 };`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(s=>{ const r=JSON.parse(s); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('picker is a styled button with icon + current label, no native select', r.btn && r.btnLabel==='Table' && r.btnIcon && r.noSelect);
check('menu lists the five views in order with icons and descriptions', r.menu && r.opts===5 && r.labels==='Table,Board,Calendar,Report,Workload' && r.icons && r.descs);
check('active view marked once with a check, button highlighted', r.active==='table' && r.check==='✓' && r.checked===1 && r.btnOn);
check('choosing Board switches, saves, closes and re-renders', r.mode==='board' && r.saved==='board' && r.closed && r.rerendered==='p1' && r.btnAfter==='Board');
check('remembered per board; bogus/missing values fall back', r.loaded==='board' && r.bogus===null && r.other===null);
check('Esc closes the menu; clicking the button again closes it', r.reopened && r.escClosed && r.btnOff && r.toggleClosed);
if(!ok) process.exit(1); });
