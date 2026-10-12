const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script src=[^>]+><\/script>/g,''),{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.eval(`window.supabase={createClient:()=>({from:()=>({}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},storage:{from:()=>({})},functions:{}})};`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const driver=`window.__run=async function(){const r={};try{
 window.__copied=null; Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied=t;}},configurable:true});
 const host=document.createElement('div'); host.innerHTML='<div id="row">'+ticketTag({ticket_no:'BD-260830-021'})+'</div>'; document.body.appendChild(host);
 const el=host.querySelector('.tkt'); r.wired=/onclick="copyTicketNo[(]event,this[)]"/.test(host.innerHTML);
 let stopped=false; await copyTicketNo({stopPropagation(){stopped=true;},preventDefault(){}}, el);
 r.copied=window.__copied; r.bubbled=!stopped; r.blank=ticketTag({})==='';
}catch(e){r.error=e.message;}return r;};`;
try{w.eval(scripts.join('\n')+'\n'+driver);}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1);}
(async()=>{const r=await w.eval('window.__run()');console.log(JSON.stringify(r));process.exit(r.wired&&r.copied==='BD-260830-021'&&r.bubbled===false&&r.blank&&!r.error?0:1);})();
