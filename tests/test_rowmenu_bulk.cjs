const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.__calls=[];
w.eval(`
window.scrollTo=()=>{};
window.__mkQuery=(t)=>{const q={_t:t,_op:'select',_p:null,_eq:{},
 update(p){q._op='update';q._p=p;return q;}, insert(p){q._op='insert';q._p=p;return q;},
 delete(){q._op='delete';return q;}, select(){return q;}, single(){return q;},
 eq(c,v){q._eq[c]=v;return q;}, in(){return q;}, order(){return q;}, limit(){return q;},
 then(r,j){window.__calls.push({table:t,op:q._op,payload:q._p,eq:{...q._eq}});
  const data = q._op==='insert' ? Object.assign({id:'dup1'},Array.isArray(q._p)?q._p[0]:q._p) : [];
  return Promise.resolve({data,error:null}).then(r,j);}};return q;};
window.supabase={createClient:()=>({from:window.__mkQuery,
 auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
 storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 Object.assign(S,{me:{id:'me',role:'admin',full_name:'April'},route:{view:'project',id:'p1'},
  workspaces:[{id:'w1',name:'W',color:'#0F766E'}],
  projects:[{id:'p1',workspace_id:'w1',name:'CS Inquiries',status:'active',color:'#08e'},
            {id:'p2',workspace_id:'w1',name:'Escalations',status:'active',color:'#e80'}],
  profiles:[{id:'me',full_name:'April',role:'admin',active:true,avatar_color:'#0F766E'}],
  _groups:[{id:'g1',name:'Case Open',color:'#2273C9',position:0},{id:'g2',name:'Solved',color:'#12915E',position:1}],
  _fields:[], _subs:{},
  _tasksAll:[1,2,3,4].map(i=>({id:'t'+i,project_id:'p1',title:'Ticket '+i,status:'todo',priority:'normal',group_id:'g1',custom:{},position:i}))});
 S._tasks=S._tasksAll.slice();
 document.getElementById('content').innerHTML='<div id="board-body"></div>';
 boardMode='table'; renderBoardBody('p1');
 const a=document.querySelector('.tv-dots');
 const labels=()=>[...document.querySelectorAll('#tvmenu .opt')].map(o=>o.textContent.trim());
 // single (nothing ticked): unchanged labels
 rowMenu(a,'t2'); r.single=labels(); document.getElementById('tvmenu').remove();
 // t1,t2,t3 ticked, menu opened from t2 → bulk labels, no Duplicate/New task below
 tvSel.clear(); ['t1','t2','t3'].forEach(i=>tvSel.add(i));
 rowMenu(a,'t2'); r.bulk=labels(); document.getElementById('tvmenu').remove();
 // right-click on an UNticked row (t4) while others ticked → single menu
 rowMenu(a,'t4'); r.unticked=labels(); document.getElementById('tvmenu').remove();
 // move to group applies to all three
 window.__calls.length=0;
 const a2=document.createElement('span'); document.body.appendChild(a2);
 taskBulkMoveGroup(a2, tvBulkTargets('t2'));
 const pickG=[...document.querySelectorAll('#tvmenu .opt')].find(o=>/Solved/.test(o.textContent));
 pickG.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true,cancelable:true}));
 await new Promise(x=>setTimeout(x,80));
 r.groupMoved = ['t1','t2','t3'].every(i=>S._tasksAll.find(t=>t.id===i).group_id==='g2') && S._tasksAll.find(t=>t.id==='t4').group_id==='g1';
 r.groupCalls = window.__calls.filter(c=>c.op==='update'&&c.payload.group_id==='g2').length>=1;
 r.selClearedAfterGroup = tvSel.size===0;
 // move to board applies to all ticked
 tvSel.clear(); ['t1','t3'].forEach(i=>tvSel.add(i));
 taskBulkMoveBoard(a2, tvBulkTargets('t1'));
 const pickB=[...document.querySelectorAll('#tvmenu .opt')].find(o=>/Escalations/.test(o.textContent));
 pickB.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true,cancelable:true}));
 await new Promise(x=>setTimeout(x,80));
 r.boardRemoved = !S._tasksAll.some(t=>t.id==='t1'||t.id==='t3') && S._tasksAll.some(t=>t.id==='t2');
 // move to top keeps relative order, all above peers
 tvSel.clear(); ['t2','t4'].forEach(i=>tvSel.add(i)); S._tasksAll.find(t=>t.id==='t2').group_id='g1';
 await taskBulkMoveTop(tvBulkTargets('t2'));
 const p=id=>S._tasksAll.find(t=>t.id===id).position;
 r.topOrder = p('t2')<p('t4');
}catch(e){r.error=e.message+' | '+(e.stack||'').split('\\n').slice(0,4).join(' / ');}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);}
(async()=>{try{const r=await w.eval('window.__run()');console.log(JSON.stringify(r,null,2));const bad=r.error||['groupMoved','groupCalls','selClearedAfterGroup','boardRemoved','topOrder'].some(k=>r[k]!==true)||!r.bulk.includes('Move 3 tasks to group…')||r.bulk.includes('Duplicate')||r.unticked.includes('Move 3 tasks to group…');process.exit(bad?1:0);}catch(e){console.log('RUN ERROR:',e.message);process.exit(1);}})();
