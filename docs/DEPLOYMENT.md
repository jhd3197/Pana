# Deployment

## Local dev

```powershell
.\dev.ps1          # installs deps if needed, starts the server
```

Default port is **8461** (override with `PANA_PORT` or `.\dev.ps1 -Port 9000`).
Friends on the same network join via your LAN IP: `http://<tu-ip>:8461`.

## Production (pana.sh)

One process serves everything (hub, games, API, WebSocket), so any Node host works.
Fly.io or Railway are the simplest paths:

1. Deploy the repo root; start command is `npm start` (which runs `node server/src/index.js`).
2. Set the port via env: the host gives you `PORT`, so map it — `PANA_PORT=$PORT`
   or run with `PANA_PORT` set to the host's expected port.
3. DNS: add a `CNAME` record for `pana.sh` (or the chosen subdomain) → your app's hostname.
4. HTTPS terminates at the host; the client auto-switches to `wss://` when the page
   is served over HTTPS, so no code change is needed.

## Requirements

- Node.js 22+ (Colyseus 0.18)
- `@colyseus/core`, `@colyseus/ws-transport` and `@colyseus/schema`. `express` and `ws`
  arrive as the transport's own dependencies; nothing in Pana imports them.
- Never set `PANA_DEBUG_ROOMS=1` in production: it enables test-only room options
  (Embuste's `?quick` nights with teleports). `dev.ps1` and the browser runner set it.

## What NOT to add (yet)

- No database: rooms are ephemeral by design.
- No build step: `web/` and `games/*/public/` ship as-is.
- No auth: room links are the access control. Revisit only if public abuse appears.
