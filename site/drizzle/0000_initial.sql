CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL, google TEXT, apple TEXT, huawei TEXT, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE chats (id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE messages (id TEXT PRIMARY KEY, chat TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
