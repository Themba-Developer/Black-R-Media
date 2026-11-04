import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/voice.js',import.meta.url),'utf8');
async function caller(withAudio=true,options={}){
 const elements=new Map(),intervals=new Map(),notes=[];let intervalId=0,state='ringing',peer;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,dataset:{},setAttribute(){},append(child){this.child=child}});return elements.get(id)};
 class Stream{getTracks(){return [{enabled:true,stop(){}}]}getAudioTracks(){return this.getTracks()}}
 class Peer{constructor(){peer=this;this.connectionState='new'}addTrack(){}async createOffer(){return {type:'offer',sdp:'offer'}}async setLocalDescription(d){this.localDescription=d;if(options.onCandidate){for(let i=0;i<2;i++)this.onicecandidate({candidate:{toJSON:()=>({candidate:'test-'+i})}})}}async setRemoteDescription(d){this.remoteDescription=d}close(){}}
 class AudioContext{currentTime=0;destination={};state=options.musicBlocked?'suspended':'running';async resume(){if(options.musicBlocked)throw Error('User gesture required');this.state='running'}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}createOscillator(){const note={frequency:{},connect(){},disconnect(){},start(){},stop(at){if(at===undefined)this.stopped=true}};notes.push(note);return note}}
 const document={querySelector:s=>s==='#visitor-voice'?el('visitor-voice'):null,getElementById:el,body:{append(){}},createElement:()=>({setAttribute(){},play:()=>Promise.resolve()})};
 vm.runInNewContext(source,{document,window:{RTCPeerConnection:Peer,...(withAudio?{AudioContext}:{}),addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>new Stream()}},RTCPeerConnection:Peer,MediaStream:Stream,localStorage:{getItem:()=>JSON.stringify({id:'chat',token:'test'})},setInterval(fn,ms){intervals.set(++intervalId,{fn,ms});return intervalId},clearInterval(id){intervals.delete(id)},setTimeout,clearTimeout,api:async path=>path.endsWith('/presence')?{available:true,busy:false}:path.endsWith('/ice')?{iceServers:[]}:path.endsWith('/start')?(options.onStart?await options.onStart():{id:'call'}):path.endsWith('/candidate')?(await options.onCandidate()):path.endsWith('/end')?(options.onEnd?.(),{}):{state,answer:state==='connected'?'answer':undefined,signals:[]}});
 await new Promise(setImmediate);
 const starting=el('voice-start').onclick();
 if(options.duringStart)await options.duringStart({el,notes,intervals});
 await starting;
 return {el,notes,peer,intervals,async poll(next){state=next;await [...intervals.values()].find(i=>i.ms===2500).fn()}};
}
for(const ending of ['connected','declined','ended']){
 const c=await caller();assert.ok(c.notes.length>0,'Waiting music plays after call starts');assert.ok([...c.intervals.values()].some(i=>i.ms===8000));
 await c.poll(ending);assert.ok(c.notes.every(n=>n.stopped),'Answer, decline and timeout stop every scheduled note');assert.ok(![...c.intervals.values()].some(i=>i.ms===8000),'Music cannot restart after answer or termination');
}
const c=await caller();await c.el('voice-end').onclick();assert.ok(c.notes.every(n=>n.stopped),'Caller hangup stops waiting music');
const silent=await caller(false);assert.equal(silent.notes.length,0);await silent.poll('connected');assert.ok(silent.peer.remoteDescription,'Music support is optional and cannot prevent a call');
const blockedOptions={musicBlocked:true};
const blocked=await caller(true,blockedOptions),resume=blocked.el('visitor-voice').child;
assert.equal(resume.hidden,false,'Paused waiting music exposes the audio recovery button');
blockedOptions.musicBlocked=false;await resume.onclick();
assert.equal(resume.hidden,true,'User action can resume waiting music');
await blocked.el('voice-end').onclick();
// Hangup while the first candidate is in flight used to read call.id on null
// when sending the next queued candidate.
let releaseCandidate,announceCandidate,candidateCount=0;
const candidateGate=new Promise(resolve=>releaseCandidate=resolve),candidateSent=new Promise(resolve=>announceCandidate=resolve);
const cancelled=await caller(true,{onCandidate:async()=>{candidateCount++;announceCandidate();await candidateGate;return {}},duringStart:async({el})=>{await candidateSent;await el('voice-end').onclick();releaseCandidate()}});
assert.equal(candidateCount,1,'Cancellation prevents sending the remaining candidates');
assert.equal(cancelled.el('voice-status').textContent,'Call ended.','Late signalling never replaces hangup with a null.id error');
assert.ok(cancelled.notes.every(n=>n.stopped),'Hangup also stops the waiting tune during signalling');
let releaseStart,announceStart,ends=0;
const startGate=new Promise(resolve=>releaseStart=resolve),startSent=new Promise(resolve=>announceStart=resolve);
const late=await caller(true,{onStart:async()=>{announceStart();await startGate;return {id:'late-call'}},onEnd:()=>ends++,duringStart:async({el})=>{await startSent;await el('voice-end').onclick();releaseStart()}});
assert.equal(ends,1,'A call created after hangup is immediately ended on the server');
assert.equal(late.notes.length,0,'Music cannot start after the caller has hung up');
assert.equal(late.el('voice-status').textContent,'Call ended.');
console.log('PASS: hangup during queued ICE updates and pending call creation preserves cancellation without null.id errors.');
console.log('PASS: caller waiting music starts, loops, stops on answer/decline/timeout/hangup, and degrades without Web Audio.');
