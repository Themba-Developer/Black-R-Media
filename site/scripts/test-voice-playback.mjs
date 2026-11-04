import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',setAttribute(){},append(child){this.child=child},addEventListener(){}});return elements.get(id)}
let allowed=false,peer,audio,tick;
class MediaStream{constructor(tracks=[]){this.tracks=tracks}getTracks(){return this.tracks}getAudioTracks(){return this.tracks}addTrack(track){this.tracks.push(track)}}
class Peer{constructor(){peer=this;this.connectionState='new'}addTrack(){}async setRemoteDescription(d){this.remoteDescription=d;this.ontrack({track:{id:'remote-audio'},streams:[]})}async createAnswer(){return {type:'answer',sdp:'answer'}}async setLocalDescription(d){this.localDescription=d}close(){this.connectionState='closed'}}
const document={querySelector:s=>s==='#admin-voice'?element('admin-voice'):null,getElementById:element,body:{append(){}},createElement:tag=>tag==='audio'?(audio={setAttribute(){},play(){if(!allowed)return Promise.reject(Object.assign(Error('Autoplay blocked'),{name:'NotAllowedError'}));this.onplaying?.();return Promise.resolve()}}):{hidden:false}};
const context={document,window:{RTCPeerConnection:Peer,addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>new MediaStream([{stop(){},enabled:true}])}},MediaStream,RTCPeerConnection:Peer,localStorage:{getItem(){return null}},setInterval(fn){tick=fn},clearInterval(){},setTimeout,clearTimeout,api:async path=>path.endsWith('/incoming')?{id:'call',state:'ringing',name:'Caller'}:path.endsWith('/ice')?{iceServers:[]}:path.endsWith('/call')?{state:'ringing',offer:'offer'}:{}};
vm.runInNewContext(fs.readFileSync(new URL('../web/voice.js',import.meta.url),'utf8'),context);
await new Promise(setImmediate);
context.window.AudioContext=class{async resume(){}};
await element('voice-available').onchange({target:{checked:true}});
await tick();
await element('voice-answer').onclick();
await new Promise(setImmediate);
const resume=element('admin-voice').child;
assert.equal(resume.hidden,false,'Rejected autoplay exposes a usable recovery button');
assert.equal(audio.srcObject.getTracks().length,1,'Streamless remote tracks reach the audio element');
peer.connectionState='connected';peer.onconnectionstatechange();
assert.match(element('voice-status').textContent,/Resume audio/,'Connected event preserves the playback warning');
allowed=true;await resume.onclick();
assert.equal(resume.hidden,true);
assert.equal(element('voice-status').textContent,'On a voice call');
await element('voice-end').onclick();
assert.equal(audio.srcObject,null);assert.equal(resume.hidden,true);
console.log('PASS: blocked admin playback, remote track attachment, resume, connection status and cleanup.');
