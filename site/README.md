# Black R Media

Public landing page at `/`, management at `/admin`. Cloudflare Worker with D1 persistence. No visitor account or verification flow.

Admin credentials are configured through the `ADMIN_EMAIL` and `ADMIN_PASSWORD` Cloudflare runtime secrets. No login credentials are stored in source control. For local testing set these values in an ignored `.dev.vars` file. Sessions use HttpOnly, Secure cookies, expire after eight hours, and login attempts are rate-limited.

Clients are real admin-managed records; no invented customers are seeded. Admins can upload a PNG/JPEG/WebP up to 2 MB, edit/delete clients, and supply official HTTPS links to Google Play, Apple App Store and Huawei AppGallery. Images are stored as data in D1 for this initial implementation.

Visitor chat uses a private conversation token saved in the visitor's browser; messages persist in D1. Visitors need the same browser to resume. Visitor messages refresh every four seconds; management refreshes every five seconds. Team availability is not implied. No email or push notifications are configured.

Build: `node scripts/compile.mjs && bash scripts/build.sh`.
Verify: `node scripts/test.mjs && node scripts/validate-artifact.mjs` (Node 22+ for SQLite).
Schema migrations live in `drizzle/`; apply pending migrations with `npm run db:migrate` before deploying. Source logo was rendered from the supplied PDF using macOS sips.

## Direct Cloudflare deployment

`wrangler.jsonc` targets the authorized mahlangu843@gmail.com account and the dedicated `black-r-media` D1 database. Run `npm run db:migrate` for pending schema migrations, and `npm run deploy` to rebuild and deploy. The public workers.dev URL is printed after deployment. This deployment is independent of the earlier Sites preview.

## Voice calling

Visitors start a chat, then use “Call the team” when an admin has enabled “Available for voice calls”. The dashboard must stay open. Calls use WebRTC microphone audio (no video, recording or transcription), authenticated D1 signalling, a single active call, 45-second ringing timeout and heartbeat expiry. Audio travels between browsers; signalling records contain connection information, not recorded audio. Browser microphone permission is required. Keep chat available as a fallback.

Default connectivity uses Cloudflare STUN. Restricted networks may require TURN. To enable Cloudflare TURN, provision a Realtime TURN key in Cloudflare, then set Worker secrets `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` with Wrangler. The server generates short-lived relay credentials; long-lived credentials stay server-side. The currently authorized OAuth token does not have access to the Realtime TURN API, so relay provisioning is not completed. No real two-device audio test has been performed in this environment.

Voice migration: `npm run db:migrate`. For local preview also run `npx wrangler d1 migrations apply black-r-media --local`.
