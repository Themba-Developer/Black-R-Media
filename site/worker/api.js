const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});const uid=()=>crypto.randomUUID();const token=()=>uid()+uid();const err=(m,s=400)=>{throw Object.assign(Error(m),{status:s})};const text=(v,n)=>{if(typeof v!=='string'||!v.trim()||v.length>n)err('Please complete the required fields.');return v.trim()};
async function body(r){if(Number(r.headers.get('content-length'))>3000000)err('Upload too large.',413);const s=await r.text();if(s.length>3000000)err('Upload too large.',413);try{return JSON.parse(s)}catch{err('Invalid request.')}}
export async function api(r,env){try{if(!env.DB)err('Service is being set up. Please try again shortly.',503);const db=env.DB,p=new URL(r.url).pathname,method=r.method;const run=(q,...v)=>db.prepare(q).bind(...v).run(),first=(q,...v)=>db.prepare(q).bind(...v).first(),all=async(q,...v)=>(await db.prepare(q).bind(...v).all()).results;
if(method!=='GET'&&r.headers.get('Origin')!==new URL(r.url).origin)err('Request origin not allowed.',403);
if(p==='/api/login'&&method==='POST'){const ip=r.headers.get('CF-Connecting-IP')||'local',now=Date.now(),a=await first('SELECT * FROM attempts WHERE ip=?',ip);if(a&&a.reset>now&&a.count>=8)err('Too many attempts. Please try again in 15 minutes.',429);const d=await body(r);if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD)err('Admin login is not configured.',503);if(d.email!==env.ADMIN_EMAIL||d.password!==env.ADMIN_PASSWORD){await run('INSERT INTO attempts(ip,count,reset) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END',ip,now+900000,now,now,now+900000);err('Incorrect email or password.',401)}await run('DELETE FROM attempts WHERE ip=?',ip);const t=token();await run('DELETE FROM sessions WHERE expires<?',now);await run('INSERT INTO sessions VALUES(?,?)',t,now+28800000);return json({ok:true},200,{'Set-Cookie':'brm_session='+t+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800'})}
const session=r.headers.get('Cookie')?.match(/(?:^|; )brm_session=([^;]+)/)?.[1];const admin=async()=>{if(!session||!await first('SELECT token FROM sessions WHERE token=? AND expires>?',session,Date.now()))err('Please sign in.',401)};
if(/^\/api\/(admin\/)?voice(?:\/|$)/.test(p))return await callsApi(r,env,{db,admin,body,json,err,text,uid});
if(p==='/api/logout'&&method==='POST'){if(session)await run('DELETE FROM sessions WHERE token=?',session);return json({ok:true},200,{'Set-Cookie':'brm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'})}
if(p==='/api/clients'&&method==='GET')return json(await all('SELECT * FROM clients ORDER BY created DESC'));
if(p.startsWith('/api/admin/')){await admin();if(p==='/api/admin/session')return json({ok:true});
if(p==='/api/admin/chats'&&method==='GET'){
 await archiveChats(db);const params=new URL(r.url).searchParams,archived=params.get('archived')==='1',search=(params.get('search')||'').slice(0,200).trim(),offset=Math.max(0,Math.min(1000000,Number(params.get('offset'))||0));
 return json(await all(`SELECT c.id,c.name,c.created,c.last_activity,c.archived_at,
 (SELECT count(*) FROM messages m WHERE m.chat=c.id) count,
 (SELECT sender FROM messages m WHERE m.chat=c.id ORDER BY created DESC,rowid DESC LIMIT 1) last_sender
 FROM chats c WHERE c.archived_at IS ${archived?'NOT NULL':'NULL'}
 AND (?='' OR instr(lower(c.name),lower(?))>0 OR EXISTS(SELECT 1 FROM messages m WHERE m.chat=c.id AND instr(lower(m.body),lower(?))>0))
 ORDER BY ${archived?'c.archived_at':'c.last_activity'} DESC,c.id DESC LIMIT 50 OFFSET ?`,search,search,search,Math.floor(offset)));
}
if(p.startsWith('/api/admin/chats/')){
 await archiveChats(db);const id=p.split('/').pop(),conversation=await first('SELECT id,archived_at FROM chats WHERE id=?',id);if(!conversation)err('Conversation not found.',404);
 if(method==='GET')return json(await all('SELECT id,sender,body,created FROM messages WHERE chat=? ORDER BY created,rowid',id));
 if(method==='POST'){
  if(conversation.archived_at!==null)err('This conversation is archived. Its history is read-only.',409);
  const d=await body(r),result=await run("INSERT INTO messages(id,chat,sender,body,created) SELECT ?,id,'team',?,? FROM chats WHERE id=? AND archived_at IS NULL",uid(),text(d.body,2000),Date.now(),id);
  if((result.meta?.changes??result.changes)===0)err('This conversation is archived. Its history is read-only.',409);return json({ok:true});
 }
}
if(p==='/api/admin/clients'&&method==='POST'){const d=await body(r),id=d.id||uid(),old=d.id?await first('SELECT * FROM clients WHERE id=?',id):null;if(d.id&&!old)err('Client not found.',404);let image=d.image||old?.image;if(!image||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>2800000)err('Please upload a PNG, JPEG or WebP image smaller than 2 MB.');const links=['google','apple','huawei'].map(k=>{if(!d[k])return '';let url;try{url=new URL(d[k])}catch{err('Please enter a valid store URL.')}const hosts={google:['play.google.com'],apple:['apps.apple.com'],huawei:['appgallery.huawei.com','appgallery.cloud.huawei.com']};if(url.protocol!=='https:'||!hosts[k].includes(url.hostname))err('Please use the official '+k+' store HTTPS link.');return url.href});await run('INSERT INTO clients VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,image=excluded.image,google=excluded.google,apple=excluded.apple,huawei=excluded.huawei',id,text(d.name,120),text(d.description,2000),image,...links,old?.created||Date.now());return json({ok:true})}
if(p.startsWith('/api/admin/clients/')&&method==='DELETE'){await run('DELETE FROM clients WHERE id=?',p.split('/').pop());return json({ok:true})}err('Not found.',404)}
if(p==='/api/chat'&&method==='POST'){const d=await body(r);const ip=r.headers.get('CF-Connecting-IP')||'local',now=Date.now(),key='chat:'+ip;const a=await first('SELECT * FROM attempts WHERE ip=?',key);if(a&&a.reset>now&&a.count>=10)err('Please wait before starting another conversation.',429);await run('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END',key,now+3600000,now,now,now+3600000);const id=uid(),t=token();await run('INSERT INTO chats(id,token,name,created,last_activity) VALUES(?,?,?,?,?)',id,t,text(d.name,80),now,now);return json({id,token:t})}
if(p.startsWith('/api/chat/')){
 const id=p.split('/').pop(),d=method==='POST'?await body(r):{},t=r.headers.get('X-Chat-Token')||d.token;
 if(!t||!await first('SELECT id FROM chats WHERE id=? AND token=?',id,t))err('Conversation unavailable. Please use the browser where you started this chat.',403);
 await archiveChats(db);const conversation=await first('SELECT archived_at FROM chats WHERE id=?',id);
 if(conversation.archived_at!==null)return json({archived:true,error:'Your previous conversation has been archived. Start a new chat to contact the team.'},410);
 if(method==='GET')return json(await all('SELECT id,sender,body,created FROM messages WHERE chat=? ORDER BY created,rowid',id));
 if(method==='POST'){
  const recent=await first('SELECT count(*) n FROM messages WHERE chat=? AND sender=? AND created>?',id,'visitor',Date.now()-60000);if(recent.n>=20)err('Please wait a moment before sending more messages.',429);
  const result=await run("INSERT INTO messages(id,chat,sender,body,created) SELECT ?,id,'visitor',?,? FROM chats WHERE id=? AND archived_at IS NULL",uid(),text(d.body,2000),Date.now(),id);
  if((result.meta?.changes??result.changes)===0)return json({archived:true,error:'Your previous conversation has been archived. Start a new chat to contact the team.'},410);return json({ok:true});
 }
}
err('Not found.',404)}catch(e){return json({error:e.status?e.message:'The service is temporarily unavailable. Please try again.'},e.status||500)}}
