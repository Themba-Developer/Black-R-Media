ALTER TABLE chats ADD COLUMN last_activity INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE chats ADD COLUMN archived_at INTEGER;
--> statement-breakpoint
UPDATE chats SET last_activity=COALESCE((SELECT MAX(created) FROM messages WHERE messages.chat=chats.id),created);
--> statement-breakpoint
CREATE INDEX chats_archive_activity ON chats(archived_at,last_activity);
--> statement-breakpoint
CREATE INDEX messages_chat_created ON messages(chat,created);
--> statement-breakpoint
CREATE TRIGGER chat_message_activity AFTER INSERT ON messages BEGIN
 UPDATE chats SET last_activity=MAX(last_activity,NEW.created) WHERE id=NEW.chat;
END;
