import http from 'node:http';
import { config } from './config.js';
import { createRequestHandler } from './app.js';
import { attachColyseus, isColyseusPath } from './colyseus.js';

const startedAt = Date.now();
const colyseus = { handle: null, snapshot: async () => [] };

const server = http.createServer(createRequestHandler(startedAt, colyseus));
// /colyseus/* upgrades belong to Colyseus' own filtered listener; anything else is refused.
server.on('upgrade', (req, socket) => {
  if (!isColyseusPath(req.url.split('?')[0])) socket.destroy();
});

Object.assign(colyseus, await attachColyseus(server));

server.listen(config.port, config.host, () => {
  console.log(`Pana server listening on http://${config.host}:${config.port}`);
  console.log(`  hub:    http://localhost:${config.port}/`);
  console.log(`  api:    http://localhost:${config.port}/api/health`);
  console.log(`  rooms:  ${colyseus.games.join(', ') || 'none'} at /colyseus`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await colyseus.shutdown().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', stop);
// Rooms report their own errors (PanaRoom.onUncaughtException). Anything that
// still escapes is logged; one party's bad packet must not end everyone's game.
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('SIGTERM', stop);
