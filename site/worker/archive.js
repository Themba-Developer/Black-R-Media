// Keep the original messages; archive only changes who can view the conversation.
async function archiveChats(db,now=Date.now()){
 return db.prepare(`UPDATE chats SET archived_at=last_activity+86400000
 WHERE archived_at IS NULL AND last_activity<=?
 AND NOT EXISTS (SELECT 1 FROM calls WHERE calls.chat=chats.id AND
 ((state='ringing' AND created>?) OR (state='connected' AND visitor_seen>? AND admin_seen>?)))`)
 .bind(now-86400000,now-45000,now-25000,now-25000).run();
}
