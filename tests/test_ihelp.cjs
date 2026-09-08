/* ⓘ help. April asked for the "Label — explanation" text to come out of the UI, so every
   optional explanation now sits behind a small clickable icon. This guards the component
   (icon markup, popover open/close/toggle, quoting) and the call sites that used to carry
   the text inline: the Add-to-workspace menu, the view picker and the Admin tabs. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://workos.test/DONE/'});
const w=dom.window;
w.eval(`window.scrollTo=()=>{};
window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})}),
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=function(){const r={};
 // 1. the icon: a real button, one glyph, the note on the element and not in the page text
 const host=document.createElement('div'); host.innerHTML='Board '+helpIcon('Tasks in groups and columns.');
 document.body.appendChild(host);
 const ico=host.querySelector('button.ihelp');
 r.isButton = !!ico && ico.tagName==='BUTTON' && ico.type==='button';
 r.glyph = ico && ico.textContent.trim();
 r.labelled = ico && !!ico.getAttribute('aria-label') && !!ico.title;
 r.note = ico && ico.dataset.help;
 r.textClean = host.textContent.indexOf('Tasks in groups') === -1;   // hidden until asked for
 // 2. quotes and & in the note survive the attribute round-trip
 const q=document.createElement('div'); q.innerHTML=helpIcon('Fields "A" & B, <b>bold</b>');
 r.quoted = q.querySelector('.ihelp').dataset.help === 'Fields "A" & B, <b>bold</b>';
 // 3. click opens one popover carrying the note; a second click on the same icon closes it
 helpPop(ico);
 let pop=document.getElementById('ihelppop');
 r.opened = !!pop && /Tasks in groups and columns/.test(pop.textContent) && ico.classList.contains('on');
 r.onePop = document.querySelectorAll('.ihelp-pop').length===1;
 helpPop(ico);
 r.toggled = !document.getElementById('ihelppop') && !ico.classList.contains('on');
 // 4. a different icon replaces the open popover rather than stacking
 helpPop(ico); helpPop(q.querySelector('.ihelp'));
 r.swapped = document.querySelectorAll('.ihelp-pop').length===1
   && /bold/.test(document.getElementById('ihelppop').textContent)
   && !ico.classList.contains('on');
 // 5. Esc closes it (the listener is attached on a timeout, hence the wait below)
 // 6. Add to workspace: labels stand alone, each with its own ⓘ
 let items=null; const _ctx=window.ctxMenu; window.ctxMenu=(a,i)=>{ items=i; _ctx(a,i); };
 S.me={id:'u1',role:'admin'}; S.profiles=[{id:'u1',role:'admin',active:true}];
 const anchor=document.createElement('button'); document.body.appendChild(anchor);
 wsAddMenu(anchor,'w1');
 r.addLabels = (items||[]).map(i=>i.label).join(',');
 r.addNotes  = (items||[]).every(i=>i.info && i.info.length>10);
 r.addNoDash = (items||[]).every(i=>i.label.indexOf('—')===-1);
 const menu=document.getElementById('tvmenu');
 r.addIcons = menu ? menu.querySelectorAll('.opt .ihelp').length : 0;
 // the icon inside a menu row must not fire the row's own action
 let fired=0; items.forEach(i=>{ const f=i.fn; i.fn=()=>{fired++;}; });
 menu.querySelector('.opt .ihelp').click();
 r.rowNotFired = fired===0;
 window.ctxMenu=_ctx; document.getElementById('tvmenu')?.remove();
 // 7. the view picker keeps its descriptions, behind the icon
 r.viewNotes = BOARD_VIEWS.every(v=>v[2] && v[2].length>5);
 const vp=document.createElement('div'); document.body.appendChild(vp);
 viewMenu(anchor,'p1');
 const vm=document.getElementById('tvmenu');
 r.viewIcons = vm ? vm.querySelectorAll('.vm-opt .ihelp').length : 0;
 r.viewNoInlineDesc = vm ? vm.querySelectorAll('.vm-txt > span:not(.ihelp)').length===0 : false;
 document.getElementById('tvmenu')?.remove();
 // 8. every Admin tab has help text, and it is keyed to the tab that is open
 r.adminTabs = Object.keys(ADMIN_HELP).sort().join(',');
 r.adminFilled = Object.values(ADMIN_HELP).every(t=>t && t.length>20);
 return new Promise(res=>setTimeout(()=>{
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
   r.escClosed = !document.getElementById('ihelppop');
   res(JSON.stringify(r)); },5));
 };`;
w.eval(scripts.join('\n')+'\n'+driver);
w.eval('window.__run()').then(s=>{ const r=JSON.parse(s); let ok=true;
const check=(n,c)=>{ console.log((c?'PASS':'FAIL')+' '+n+(c?'':' -> '+JSON.stringify(r))); if(!c) ok=false; };
check('helpIcon renders a labelled button carrying the note, not visible text', r.isButton && r.glyph==='i' && r.labelled && r.note==='Tasks in groups and columns.' && r.textClean);
check('quotes, ampersands and <b> survive the attribute', r.quoted);
check('click opens one popover with the note; clicking again closes it', r.opened && r.onePop && r.toggled);
check('a second icon replaces the popover instead of stacking', r.swapped);
check('Escape closes the popover', r.escClosed);
check('Add to workspace: three bare labels, no dashes, a note on each', r.addLabels==='Board,Report widget,Form' && r.addNotes && r.addNoDash && r.addIcons===3);
check('clicking the icon in a menu row does not trigger the row', r.rowNotFired);
check('view picker descriptions moved behind the icon', r.viewNotes && r.viewIcons===5 && r.viewNoInlineDesc);
check('every Admin tab has its own help text', r.adminTabs==='automations,brands,sla,teams,types,users,workspaces' && r.adminFilled);
if(!ok) process.exit(1); });
