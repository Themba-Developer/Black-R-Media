async function callsApi(r,env,{db,admin,body,json,err,text,uid}){
 // SDP is a wire format: preserve its CRLF line endings, including the final one.
 const description=value=>{if(typeof value!=='string'||value.length>30000||!value.startsWith('v=0\r\n')||!value.endsWith('\r\n'))err('Invalid call description. Please start a new call.');return value};
 const p=new URL(r.url).pathname,method=r.method,now=Date.now();
 const run=(q,...v)=>db.prepare(q).bind(...v).run(),first=(q,...v)=>db.prepare(q).bind(...v).first(),all=async(q,...v)=>(await db.prepare(q).bind(...v).all()).results;
 const isAdmin=p.startsWith('/api/admin/voice');if(isAdmin)await admin();
 let d=method==='POST'?await body(r):{},chat=r.headers.get('X-Chat-Id')||d.chat;
 if(!isAdmin){const t=r.headers.get('X-Chat-Token')||d.token;if(!chat||!t||!await first('SELECT id FROM chats WHERE id=? AND token=?',chat,t))err('Please start a chat before calling.',403)}
 await run("UPDATE calls SET state='ended' WHERE (state='ringing' AND created<?) OR (state='connected' AND (visitor_seen<? OR admin_seen<?))",now-45000,now-25000,now-25000);
 const route=p.replace(/^\/api\/(admin\/)?voice\/?/,'');
 if(route==='ice'&&method==='GET'){
  if(env.TURN_KEY_ID&&env.TURN_KEY_API_TOKEN){
   const response=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+env.TURN_KEY_ID+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+env.TURN_KEY_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)err('Call connection service unavailable. Please use chat for now.',503);
   return json(await response.json());
  }
  return json({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}],relay:false});
 }
 if(route==='presence'){
  if(isAdmin&&method==='POST'){if(d.available===false)await run('DELETE FROM call_presence WHERE id=?','team');else await run('INSERT INTO call_presence VALUES(?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen','team',now)}
  return json({available:!!await first('SELECT id FROM call_presence WHERE id=? AND seen>?','team',now-18000),busy:!!await first("SELECT id FROM calls WHERE state IN ('ringing','connected')")});
 }
 if(route==='incoming'&&isAdmin&&method==='GET')return json(await first("SELECT calls.id,calls.chat,calls.state,chats.name FROM calls JOIN chats ON chats.id=calls.chat WHERE state IN ('ringing','connected') LIMIT 1")||null);
 if(route==='start'&&!isAdmin&&method==='POST'){
  if(!await first('SELECT id FROM call_presence WHERE id=? AND seen>?','team',now-18000))err('The team is not taking calls right now. Please leave a message.',409);
  const recent=await first('SELECT count(*) n FROM calls WHERE chat=? AND created>?',chat,now-300000);if(recent.n>=5)err('Please wait a few minutes before calling again.',429);
  if(await first("SELECT id FROM calls WHERE state IN ('ringing','connected')"))err('The team is on another call. Please try again shortly.',409);
  const offer=description(d.offer);const id=uid();try{await run("INSERT INTO calls(id,chat,state,offer,created,visitor_seen) VALUES(?,?,'ringing',?,?,?)",id,chat,offer,now,now)}catch{err('The team is on another call. Please try again shortly.',409)}return json({id});
 }
 const parts=route.split('/'),id=parts[0],action=parts[1];const c=await first('SELECT * FROM calls WHERE id=?',id);if(!c||(!isAdmin&&c.chat!==chat))err('Call not found.',404);
 if(method==='GET'){
  if(!['ended','declined'].includes(c.state))await run('UPDATE calls SET '+(isAdmin?'admin_seen':'visitor_seen')+'=? WHERE id=?',now,id);
  const after=Number(new URL(r.url).searchParams.get('after')||0);const signals=await all('SELECT seq,candidate FROM call_signals WHERE call=? AND sender=? AND seq>? ORDER BY seq LIMIT 100',id,isAdmin?'visitor':'admin',Number.isSafeInteger(after)?after:0);
  return json({id,state:c.state,offer:isAdmin?c.offer:undefined,answer:c.answer,signals});
 }
 if(method==='POST'&&action==='end'){await run("UPDATE calls SET state=? WHERE id=? AND state IN ('ringing','connected')",d.decline&&isAdmin?'declined':'ended',id);await run('DELETE FROM call_signals WHERE call=?',id);return json({ok:true})}
 if(method==='POST'&&action==='answer'&&isAdmin){if(c.state!=='ringing')err('This call is no longer ringing.',409);const answer=description(d.answer);const result=await run("UPDATE calls SET answer=?,state='connected',admin_seen=? WHERE id=? AND state='ringing'",answer,now,id);if(result.meta?.changes===0)err('Call already answered.',409);return json({ok:true})}
 if(method==='POST'&&action==='candidate'){if(!['ringing','connected'].includes(c.state))err('Call ended.',409);const n=await first('SELECT count(*) n FROM call_signals WHERE call=?',id);if(n.n>=150)err('Too many connection updates.',429);const candidate=text(d.candidate,4000);try{const parsed=JSON.parse(candidate);if(typeof parsed.candidate!=='string')err('Invalid connection update.')}catch{err('Invalid connection update.')}await run('INSERT INTO call_signals(call,sender,candidate) VALUES(?,?,?)',id,isAdmin?'admin':'visitor',candidate);return json({ok:true})}
 if(route==='ice')err('Not found.',404);err('Not found.',404);
}
