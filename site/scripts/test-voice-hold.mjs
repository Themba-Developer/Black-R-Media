import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/voice.js',import.meta.url),'utf8');
async function caller(withAudio=true){
 const elements=new Map(),intervals=new Map(),notes=[];let intervalId=0,state='ringing',peer;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,dataset:{},setAttribute(){},append(){}});return elements.get(id)};
 class Stream{getTracks(){return [{enabled:true,stop(){}}]}getAudioTracks(){return this.getTracks()}}
 class Peer{constructor(){peer=this;this.connectionState='new'}addTrack(){}async createOffer(){return {type:'offer',sdp:'offer'}}async setLocalDescription(d){this.localDescription=d}async setRemoteDescription(d){this.remoteDescription=d}close(){}}
 class AudioContext{currentTime=0;destination={};async resume(){}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}createOscillator(){const note={frequency:{},connect(){},disconnect(){},start(){},stop(at){if(at===undefined)this.stopped=true}};notes.push(note);return note}}
 const document={querySelector:s=>s==='#visitor-voice'?el('visitor-voice'):null,getElementById:el,body:{append(){}},createElement:()=>({setAttribute(){},play:()=>Promise.resolve()})};
 vm.runInNewContext(source,{document,window:{RTCPeerConnection:Peer,...(withAudio?{AudioContext}:{}),addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>new Stream()}},RTCPeerConnection:Peer,MediaStream:Stream,localStorage:{getItem:()=>JSON.stringify({id:'chat',token:'test'})},setInterval(fn,ms){intervals.set(++intervalId,{fn,ms});return intervalId},clearInterval(id){intervals.delete(id)},setTimeout,clearTimeout,api:async path=>path.endsWith('/presence')?{available:true,busy:false}:path.endsWith('/ice')?{iceServers:[]}:path.endsWith('/start')?{id:'call'}:{state,answer:state==='connected'?'answer':undefined,signals:[]}});
 await new Promise(setImmediate);
 await el('voice-start').onclick();
 return {el,notes,peer,intervals,async poll(next){state=next;await [...intervals.values()].find(i=>i.ms===2500).fn()}};
}
for(const ending of ['connected','declined','ended']){
 const c=await caller();assert.ok(c.notes.length>0,'Waiting music plays after call starts');assert.ok([...c.intervals.values()].some(i=>i.ms===8000));
 await c.poll(ending);assert.ok(c.notes.every(n=>n.stopped),'Answer, decline and timeout stop every scheduled note');assert.ok(![...c.intervals.values()].some(i=>i.ms===8000),'Music cannot restart after answer or termination');
}
const c=await caller();await c.el('voice-end').onclick();assert.ok(c.notes.every(n=>n.stopped),'Caller hangup stops waiting music');
const silent=await caller(false);assert.equal(silent.notes.length,0);await silent.poll('connected');assert.ok(silent.peer.remoteDescription,'Music support is optional and cannot prevent a call');
console.log('PASS: caller waiting music starts, loops, stops on answer/decline/timeout/hangup, and degrades without Web Audio.');
