import http from 'node:http';
import { config } from './config.js';
import { RoomManager, createRelay } from './rooms.js';
import { createRequestHandler } from './app.js';
import { attachColyseus, isColyseusPath } from './colyseus.js';

const startedAt = Date.now();
const rooms = new RoomManager();
const colyseus = { handle: null, snapshot: async () => [] };

const server = http.createServer(createRequestHandler(rooms, startedAt, colyseus));
const relay = createRelay(rooms);
// One upgrade router: /ws is the relay, /colyseus/* belongs to Colyseus'
// own filtered listener, anything else is refused.
server.on('upgrade', (req, socket, head) => {
  const pathname = req.url.split('?')[0];
  if (pathname === '/ws') return relay.handleUpgrade(req, socket, head, (ws) => relay.emit('connection', ws, req));
  if (isColyseusPath(pathname)) return;
  socket.destroy();
});

Object.assign(colyseus, await attachColyseus(server));

server.listen(config.port, config.host, () => {
  console.log(`Pana server listening on http://${config.host}:${config.port}`);
  console.log(`  hub:    http://localhost:${config.port}/`);
  console.log(`  api:    http://localhost:${config.port}/api/health`);
  console.log(`  ws:     ws://localhost:${config.port}/ws`);
  console.log(`  rooms:  ${colyseus.games.join(', ') || 'none'} at /colyseus`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await colyseus.shutdown().catch(() => {});
  relay.clients.forEach((ws) => ws.terminate());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
