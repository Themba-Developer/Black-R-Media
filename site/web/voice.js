(()=>{
const isAdmin=!!document.querySelector('#admin-voice');if(!document.querySelector('#visitor-voice')&&!isAdmin)return;
const el=id=>document.getElementById(id),status=message=>el('voice-status').textContent=message;
let call=null,pc=null,stream=null,cursor=0,candidates=[],pending=[],busy=false,pollBusy=false,available=false,incoming=null,ringTimer=null,ringContext=null,ringing=false,started=0,disconnectTimer=null,generation=0,playbackBlocked=false;
const supported=!!(window.RTCPeerConnection&&navigator.mediaDevices?.getUserMedia);
const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');document.body.append(audio);
function identity(){try{return JSON.parse(localStorage.getItem('brm-chat'))}catch{return null}}
async function request(path,data){const c=identity();return api((isAdmin?'/admin/voice/':'/voice/')+path,{method:data?'POST':'GET',headers:isAdmin?{}:{'X-Chat-Id':c?.id||'','X-Chat-Token':c?.token||''},...(data?{body:JSON.stringify(data)}:{})})}
function controls(show){el('voice-controls').hidden=!show;if(el('voice-start'))el('voice-start').hidden=show;el('voice-mute').textContent='Mute';el('voice-mute').setAttribute('aria-pressed','false')}
function stopRing(){clearInterval(ringTimer);ringTimer=null;ringing=false}
function ring(){if(ringing)return;ringing=true;const tone=()=>{if(!ringContext||ringContext.state!=='running')return;const oscillator=ringContext.createOscillator(),gain=ringContext.createGain();oscillator.connect(gain);gain.connect(ringContext.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.08,ringContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ringContext.currentTime+.3);oscillator.start();oscillator.stop(ringContext.currentTime+.3)};tone();ringTimer=setInterval(tone,1800)}
// The spoken introduction plays once; only the owner-supplied 6:00–6:30 music excerpt loops.
const holdIntroSeconds=1.995532879818594;
let holdContext=null,holdSource=null,holdGain=null,holdBuffer=null,holdLoading=null,holdWanted=false;
function prepareHoldMusic(){
 if(isAdmin)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  holdContext ||= new Context();holdContext.resume().catch(()=>{});
  if(!holdBuffer&&!holdLoading){
   holdLoading=fetch('/waiting-music.m4a').then(response=>{if(!response.ok)throw Error('Waiting music unavailable');return response.arrayBuffer()})
   .then(bytes=>holdContext.decodeAudioData(bytes)).then(buffer=>{holdBuffer=buffer;holdLoading=null;if(holdWanted)startHoldMusic()})
   .catch(()=>{holdLoading=null;});
  }
 }catch{}
}
function stopHoldMusic(){
 holdWanted=false;
 if(holdSource){try{holdSource.stop()}catch{}holdSource.disconnect();holdSource=null}
 if(holdGain){holdGain.disconnect();holdGain=null}
}
function resumeHoldMusic(){
 if(!holdContext||!holdWanted)return;
 return holdContext.resume().then(()=>{if(holdWanted&&holdContext.state==='running')resume.hidden=true}).catch(()=>{if(holdWanted)resume.hidden=false});
}
function startHoldMusic(){
 holdWanted=true;if(!holdContext||!holdBuffer||holdSource)return;
 try{
  holdGain=holdContext.createGain();holdGain.gain.value=.3;holdGain.connect(holdContext.destination);
  holdSource=holdContext.createBufferSource();holdSource.buffer=holdBuffer;holdSource.loop=true;holdSource.loopStart=holdIntroSeconds;holdSource.loopEnd=holdBuffer.duration;holdSource.connect(holdGain);holdSource.start();
  if(holdContext.state!=='running'){resume.hidden=false;resumeHoldMusic()}
 }catch{stopHoldMusic()}
}
function cleanup(message){generation++;playbackBlocked=false;resume.hidden=true;stopRing();stopHoldMusic();clearTimeout(disconnectTimer);if(pc){pc.onconnectionstatechange=null;pc.onicecandidate=null;pc.close()}pc=null;stream?.getTracks().forEach(t=>t.stop());stream=null;audio.srcObject=null;call=null;cursor=0;pending=[];candidates=[];started=0;controls(false);if(el('incoming-call'))el('incoming-call').hidden=true;status(message)}
async function end(message='Call ended.',decline=false){const id=call?.id||incoming?.id;cleanup(message);incoming=null;if(id)try{await request(id+'/end',{decline})}catch{status(message+' The connection will close automatically.')}}
function checkCall(version){if(version!==generation)throw Object.assign(Error('Call cancelled.'),{name:'AbortError'});}
function prepareAudio(){audio.muted=false;audio.volume=1;audio.srcObject=new MediaStream();audio.play().catch(()=>{});}
function playRemoteAudio(){const version=generation;return audio.play().catch(()=>{if(version!==generation)return;playbackBlocked=true;resume.hidden=false;status('Tap Resume audio to hear the call.');});}
async function setup(){const version=generation;const media=await navigator.mediaDevices.getUserMedia({audio:true,video:false});if(version!==generation){media.getTracks().forEach(t=>t.stop());throw Error('Call cancelled.')}stream=media;const config=await request('ice');if(version!==generation)throw Error('Call cancelled.');const connection=new RTCPeerConnection({iceServers:config.iceServers});pc=connection;stream.getTracks().forEach(t=>pc.addTrack(t,stream));pc.ontrack=e=>{if(version!==generation)return;const remote=audio.srcObject||new MediaStream();audio.srcObject=remote;if(!remote.getTracks().some(t=>t.id===e.track.id))remote.addTrack(e.track);e.track.onunmute=()=>{if(audio.srcObject===remote)playRemoteAudio()};playRemoteAudio();};pc.onicecandidate=e=>{if(!e.candidate)return;const candidate=JSON.stringify(e.candidate.toJSON());if(call)request(call.id+'/candidate',{candidate}).catch(()=>{});else candidates.push(candidate)};pc.onconnectionstatechange=()=>{if(version!==generation||pc!==connection)return;if(pc.connectionState==='connected'){stopHoldMusic();clearTimeout(disconnectTimer);status(playbackBlocked?'Tap Resume audio to hear the call.':'On a voice call');if(!started)started=Date.now()}if(pc.connectionState==='failed')end('The call could not connect on this network. Please use chat.');if(pc.connectionState==='disconnected'){status('Connection lost. Trying to reconnect…');clearTimeout(disconnectTimer);disconnectTimer=setTimeout(()=>end('Call disconnected. Please try again or use chat.'),12000)}};
return connection;
}
async function flush(version){const id=call?.id;const batch=candidates.splice(0);for(const candidate of batch){checkCall(version);await request(id+'/candidate',{candidate});checkCall(version)}}
function failure(e){return e.name==='NotAllowedError'?'Microphone access was blocked. Open the site controls beside the browser address, set Microphone to Allow, then try again.':e.name==='NotFoundError'?'No microphone found. Connect one and try again.':e.message||'Could not start the call. Please try again.'}
if(!supported){status('Voice calls are not supported in this browser. Please use chat.');if(el('voice-available'))el('voice-available').disabled=true;return}
const resume=document.createElement('button');resume.type='button';resume.textContent='Resume audio';resume.hidden=true;audio.onpause=()=>{if(call&&audio.srcObject)resume.hidden=false};audio.onplaying=()=>{playbackBlocked=false;resume.hidden=true;if(pc?.connectionState==='connected')status('On a voice call')};resume.onclick=()=>{if(holdWanted)return resumeHoldMusic();audio.muted=false;audio.volume=1;return playRemoteAudio()};el(isAdmin?'admin-voice':'visitor-voice').append(resume);
el('voice-mute').onclick=()=>{if(!stream)return;const muted=stream.getAudioTracks().some(t=>t.enabled);stream.getAudioTracks().forEach(t=>t.enabled=!muted);el('voice-mute').textContent=muted?'Unmute':'Mute';el('voice-mute').setAttribute('aria-pressed',String(muted))};el('voice-end').onclick=()=>end();
if(isAdmin){
 el('voice-available').onchange=async e=>{const checkbox=e.target,wanted=checkbox.checked;checkbox.disabled=true;try{if(wanted){status('Please allow microphone access when your browser asks.');const permissionStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});permissionStream.getTracks().forEach(track=>track.stop());ringContext ||= new (window.AudioContext||window.webkitAudioContext)();await ringContext.resume()}await request('presence',{available:wanted});available=wanted;status(available?'Microphone allowed. Ready for calls. Keep this dashboard open.':'You are not taking calls.')}catch(error){available=false;checkbox.checked=false;request('presence',{available:false}).catch(()=>{});status(failure(error))}finally{checkbox.disabled=false}};
 el('voice-answer').onclick=async()=>{
  if(busy||!incoming)return;busy=true;el('voice-answer').disabled=true;
  const version=generation,incomingId=incoming.id;call={id:incomingId};controls(true);stopRing();el('incoming-call').hidden=true;status('Connecting…');prepareAudio();
  try{
   const connection=await setup();checkCall(version);
   const info=await request(incomingId);checkCall(version);if(info.state!=='ringing')throw Error('This call has ended.');
   await connection.setRemoteDescription({type:'offer',sdp:info.offer});checkCall(version);
   const answer=await connection.createAnswer();checkCall(version);await connection.setLocalDescription(answer);checkCall(version);
   await request(incomingId+'/answer',{answer:connection.localDescription.sdp});checkCall(version);await flush(version);
  }catch(error){if(version===generation)await end(failure(error))}finally{busy=false;el('voice-answer').disabled=false}
 };
 el('voice-decline').onclick=()=>end('Call declined.',true);
 el('logout').addEventListener('click',()=>{available=false;request('presence',{available:false}).catch(()=>{});if(call||incoming)end()});
}else{
 el('voice-start').onclick=async()=>{
  if(busy||call)return;busy=true;const version=generation;el('voice-start').disabled=true;status('Allow microphone access to call the team.');controls(true);prepareAudio();prepareHoldMusic();
  try{
   const connection=await setup();checkCall(version);const offer=await connection.createOffer();checkCall(version);
   await connection.setLocalDescription(offer);checkCall(version);
   const created=await request('start',{offer:connection.localDescription.sdp});
   if(version!==generation){await request(created.id+'/end',{});return}
   call=created;status('Calling Black R Media…');startHoldMusic();await flush(version);
  }catch(error){if(version===generation)await end(failure(error))}finally{busy=false}
 };
}
async function tick(){if(pollBusy||busy)return;pollBusy=true;try{
 if(isAdmin){if(el('dashboard').hidden){if(call||stream)cleanup('Signed out.');available=false;return}if(available)await request('presence',{available:true});if(!call){const next=await request('incoming');if(next?.state==='ringing'&&available){incoming=next;el('caller-name').textContent='Incoming call from '+next.name;el('incoming-call').hidden=false;status('Incoming voice call');ring()}else{incoming=null;el('incoming-call').hidden=true;stopRing()} }}
 else if(!call){const c=identity();if(!c){el('voice-start').disabled=true;el('voice-start').dataset.state='unavailable';el('voice-start').textContent='Call the team';return}const presence=await request('presence');const button=el('voice-start');button.disabled=!presence.available||presence.busy;button.dataset.state=presence.busy?'busy':presence.available?'available':'unavailable';button.textContent=presence.busy?'Currently on a call':'Call the team';status(presence.busy?'The team is currently on a call. Please leave a message or try again shortly.':!presence.available?'The team is not taking calls right now. You can leave a message.':'The team is available for a voice call.');}
 if(call){const version=generation,id=call.id;const info=await request(id+'?after='+cursor);if(version!==generation||call?.id!==id)return;if(['ended','declined'].includes(info.state)){cleanup(info.state==='declined'?'The team couldn’t take your call. Please leave a message.':'Call ended.');return}if(!pc)return;if(!isAdmin&&info.answer){stopHoldMusic();if(!pc.remoteDescription)await pc.setRemoteDescription({type:'answer',sdp:info.answer});if(version!==generation)return;}for(const s of info.signals){pending.push(JSON.parse(s.candidate));cursor=Math.max(cursor,s.seq)}if(pc.remoteDescription){while(pending.length){await pc.addIceCandidate(pending.shift());if(version!==generation)return}}if(info.state==='connected'&&pc.connectionState!=='connected')status('Connecting audio…');}
 }catch(error){if(call)status('Checking the call connection…');else if(isAdmin&&available){status('Connection interrupted. Check your internet connection.')} }finally{pollBusy=false}}
setInterval(tick,2500);tick();window.addEventListener('pagehide',()=>{const id=call?.id||incoming?.id;const c=identity();const headers={'Content-Type':'application/json'};if(!isAdmin){headers['X-Chat-Id']=c?.id||'';headers['X-Chat-Token']=c?.token||''}const root='/api/'+(isAdmin?'admin/':'')+'voice/';if(id)fetch(root+id+'/end',{method:'POST',headers,body:'{}',keepalive:true}).catch(()=>{});if(isAdmin&&available)fetch(root+'presence',{method:'POST',headers,body:'{"available":false}',keepalive:true}).catch(()=>{});cleanup('Call ended.');});
})();
