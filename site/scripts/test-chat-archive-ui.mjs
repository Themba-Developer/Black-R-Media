import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),admin=fs.readFileSync(new URL('../web/admin.js',import.meta.url),'utf8');
const drain=()=>new Promise(setImmediate);
function surface(){const nodes=new Map();function el(selector){if(!nodes.has(selector))nodes.set(selector,{hidden:false,dataset:{},innerHTML:'',textContent:'',value:'',scrollTop:0,scrollHeight:0,clientHeight:0,focus(){},setAttribute(k,v){this[k]=v},querySelector(){return {disabled:false,focus(){}}}});return nodes.get(selector)}return {el,nodes}}
{
 const {el}=surface(),saved=new Map([['brm-chat',JSON.stringify({id:'old-chat',token:'old-token'})]]),intervals=[];
 el('#chat-messages').innerHTML='Previous confidential history';
 const context={document:{querySelector:el,addEventListener(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},setInterval:fn=>intervals.push(fn),fetch:async path=>path==='/api/chat/old-chat'?Response.json({archived:true,error:'Archived'}, {status:410}):path==='/api/chat'?Response.json({id:'fresh-chat',token:'fresh-token'}):Response.json([])};
 vm.runInNewContext(app,context);await drain();await intervals[0]();
 assert.equal(saved.has('brm-chat'),false);assert.equal(el('#chat-start').hidden,false);assert.equal(el('#chat-send').hidden,true);assert.equal(el('#voice-start').disabled,true);
 assert.ok(!el('#chat-messages').innerHTML.includes('Previous confidential history'));assert.match(el('#chat-messages').innerHTML,/archived/);
 await el('#chat-start').onsubmit({preventDefault(){},target:{name:{value:'Returning visitor'},querySelector(){return {disabled:false}}}});
 assert.equal(JSON.parse(saved.get('brm-chat')).id,'fresh-chat');assert.equal(el('#chat-send').hidden,false);
}
{
 const {el}=surface();let searchHandler;
 const active={id:'active',name:'Active artist',count:1,last_activity:Date.now(),archived_at:null,last_sender:'visitor'},archived={...active,id:'archived',name:'Archived artist',archived_at:Date.now()};
 const context={document:{querySelector:s=>s==='#client-list'?null:el(s)},setInterval(){},clearTimeout(){},setTimeout(fn){searchHandler=fn},fetch:async path=>Response.json(path.startsWith('/api/admin/chats?')?(path.includes('archived=1')?[archived]:[active]):path.startsWith('/api/admin/chats/')?[{sender:'visitor',body:'Saved agreement',created:Date.now()}]:path==='/api/clients'?[]:{ok:true}),location:{reload(){}}};
 vm.runInNewContext(app+'\n'+admin,context);await drain();
 el('#archive-tab').onclick();await drain();assert.equal(el('#archive-tab')['aria-pressed'],'true');assert.equal(el('#archive-search-label').hidden,false);assert.match(el('#conversations').innerHTML,/Archived artist/);
 el('#conversations').onclick({target:{closest:()=>({dataset:{id:'archived'},querySelector:()=>({textContent:'Archived artist'})})}});await drain();
 assert.equal(el('#reply-form').hidden,true);assert.equal(el('#archive-note').hidden,false);assert.match(el('#admin-messages').innerHTML,/Saved agreement/);
 el('#archive-search').value='agreement';el('#archive-search').oninput();searchHandler();await drain();assert.equal(el('#chat-title').textContent,'Select a conversation');
 el('#inbox-tab').onclick();await drain();assert.equal(el('#archive-search-label').hidden,true);assert.equal(el('#archive-note').hidden,true);assert.match(el('#conversations').innerHTML,/Active artist/);
}
console.log('PASS: visitor expired history clears and restarts a fresh chat; admin archive browsing/search shows read-only retained messages.');
