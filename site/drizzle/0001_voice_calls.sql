CREATE TABLE call_presence (id TEXT PRIMARY KEY, seen INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE calls (id TEXT PRIMARY KEY, chat TEXT NOT NULL, state TEXT NOT NULL, offer TEXT NOT NULL, answer TEXT, created INTEGER NOT NULL, visitor_seen INTEGER NOT NULL, admin_seen INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_call ON calls ((1)) WHERE state IN ('ringing','connected');
--> statement-breakpoint
CREATE TABLE call_signals (seq INTEGER PRIMARY KEY AUTOINCREMENT, call TEXT NOT NULL, sender TEXT NOT NULL, candidate TEXT NOT NULL);
