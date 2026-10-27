# Deployment

## Local dev

```powershell
.\dev.ps1          # installs deps if needed, starts the server
```

Default port is **8461** (override with `PANA_PORT` or `.\dev.ps1 -Port 9000`).
Friends on the same network join via your LAN IP: `http://<tu-ip>:8461`.

## Self-hosting

These instructions run the open-source application on your own server.

1. From the repository root, run `npm ci --omit=dev`, then `npm start`.
   The entry point is `Pana/server/src/index.js`.
2. Set `PANA_PORT` to the port your environment expects (default: **8461**).
3. For HTTPS, configure your own reverse proxy to forward HTTP and WebSocket
   connections. The browser uses secure WebSockets when the page uses HTTPS.
4. Joining a room is limited per visitor address (a burst of 20, then 20 a
   minute). Behind a reverse proxy every request comes from the proxy, so set
   `PANA_CLIENT_IP_HEADER` to the header it fills with the visitor's address
   (`X-Forwarded-For`, `CF-Connecting-IP`). Requests from the machine itself
   are not limited when no header is set.

## Requirements

Large images and textures use per-game ZIPs from the `asset-packs` release.
Original URLs are preserved. The first request installs only that game's pinned
pack, with archive and file checksum verification. Set `PANA_ASSET_CACHE` to a
writable persistent directory. No checkout files need to be writable.
See `docs/knowledge/asset-packs.md` for editing and publishing packs.

QQSMP narration is distributed separately in the GitHub `voice-packs` release.
The first question-audio request downloads the pinned ZIP, verifies SHA-256,
and caches it. No MP3s or ZIPs are committed to Git and no build step is needed.
Set `PANA_VOICE_CACHE` to a writable persistent directory for the audio cache.
The host needs outbound HTTPS to GitHub for the first download. Cached packs
work offline; an unavailable pack affects narration only, not gameplay.

- Node.js 22+ (Colyseus 0.18)
- `@colyseus/core`, `@colyseus/ws-transport` and `@colyseus/schema`. `express` and `ws`
  arrive as the transport's own dependencies; nothing in Pana imports them.
- Never set `PANA_DEBUG_ROOMS=1` in production: it enables test-only room options
  (Embuste's `?quick` nights with teleports). `dev.ps1` and the browser runner set it.

## What NOT to add (yet)

- No database: rooms are ephemeral by design.
- No build step: `web/` and `games/*/public/` ship as-is.
- No auth: room links are the access control. Revisit only if public abuse appears.
