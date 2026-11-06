# Black R Media

Public landing page at `/`, management at `/admin`. Cloudflare Worker with D1 persistence. No visitor account or verification flow.

Admin credentials are configured through the `ADMIN_EMAIL` and `ADMIN_PASSWORD` Cloudflare runtime secrets. No login credentials are stored in source control. For local testing set these values in an ignored `.dev.vars` file. Sessions use HttpOnly, Secure cookies, expire after eight hours, and login attempts are rate-limited.

Clients are real admin-managed records; no invented customers are seeded. Admins can upload a PNG/JPEG/WebP up to 2 MB, edit/delete clients, and supply official HTTPS links to Google Play, Apple App Store and Huawei AppGallery. Images are stored as data in D1 for this initial implementation.

Visitor chat uses a private conversation token saved in the visitor's browser; messages persist in D1. Visitors need the same browser to resume. Visitor messages refresh every four seconds; management refreshes every five seconds. Team availability is not implied. No email or push notifications are configured.

Build: `node scripts/compile.mjs && bash scripts/build.sh`.
Verify: `npm test && npm run validate` (Node 22+ for SQLite).
Schema migrations live in `drizzle/`; apply pending migrations with `npm run db:migrate` before deploying. Source logo was rendered from the supplied PDF using macOS sips.

## Direct Cloudflare deployment

`wrangler.jsonc` targets the authorized mahlangu843@gmail.com account and the dedicated `black-r-media` D1 database. Run `npm run db:migrate` for pending schema migrations, and `npm run deploy` to rebuild and deploy. The public workers.dev URL is printed after deployment. This deployment is independent of the earlier Sites preview.

## Voice calling

Visitors start a chat, then use “Call the team” when an admin has enabled “Available for voice calls”. The dashboard must stay open. Calls use WebRTC microphone audio (no video, recording or transcription), authenticated D1 signalling, a single active call, 45-second ringing timeout and heartbeat expiry. Audio travels between browsers; signalling records contain connection information, not recorded audio. Browser microphone permission is required. Keep chat available as a fallback.

Cloudflare TURN is configured on the live Worker through private `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` secrets. The server generates short-lived relay credentials; long-lived credentials stay server-side. The live authenticated ICE endpoint was verified to return TURN relay settings on 4 November 2026. No real two-device audio test has been performed in this environment. For another deployment, create a TURN key (separate from a Realtime SFU app) and set these two Worker secrets with Wrangler; never commit their values.

Voice migration: `npm run db:migrate`. For local preview also run `npx wrangler d1 migrations apply black-r-media --local`.

Caller waiting music uses the owner-supplied “Jam Session 1 (Live)” recording, trimmed to 6:00–6:30 (30 seconds) and encoded to `web/waiting-music.m4a`. The owner confirmed ownership of the track copyright. A spoken “Your call will be answered shortly” introduction plays once before the music. The browser decodes the combined asset once, then loops only the 30-second music excerpt while ringing, stopping when answered or ended. The loop starts at 1.995532879818594 seconds, immediately after the announcement and a short pause. Music is optional when Web Audio is unavailable. Only the selected excerpt is included in the website.

## Chat archive

After 24 hours without a new visitor message or team reply, conversations clear from the visitor chatbox and leave the active inbox. The original messages, senders and timestamps remain in D1. The authenticated dashboard’s Archive button opens read-only history with name/message search and pagination. Returning visitors start a separate conversation.

Migration `0002_chat_archive.sql` backfills existing chats from their most recent message. A message trigger records subsequent activity. A five-minute Cron Trigger archives expired conversations even when the website is closed; chat/API access enforces expiry immediately. An ongoing, healthy voice call postpones archiving until the call ends. Polling does not extend the message inactivity window. Archive history is retained without automatic deletion.

## Website domain

`blackr.co.za/*` and `www.blackr.co.za/*` route to the `black-r-media` Worker through the existing Cloudflare zone. These exact-host routes take precedence over the older Pages website without modifying DNS, nameservers, Hostinger MX, SPF, DKIM, DMARC, or mailbox settings. The older Pages project remains available at its pages.dev address. To restore its custom-domain traffic, remove these two Worker routes and remove them from `wrangler.jsonc`.

All client app store links are optional, including when creating a client. Supplied links must still be official store HTTPS URLs.

## Associates

The public associates section appears above the closing contact block. Admins can publish, edit and delete company names, public contact emails and specialties. All three fields are required. Apply migration `0003_associates.sql` before deploying this version. No example associates are seeded.
