import http from 'node:http';
import { config } from './config.js';
import { RoomManager, attachWebSocket } from './rooms.js';
import { createRequestHandler } from './app.js';

const startedAt = Date.now();
const rooms = new RoomManager();

const server = http.createServer(createRequestHandler(rooms, startedAt));
attachWebSocket(server, rooms);

server.listen(config.port, config.host, () => {
  console.log(`Pana server listening on http://${config.host}:${config.port}`);
  console.log(`  hub:    http://localhost:${config.port}/`);
  console.log(`  api:    http://localhost:${config.port}/api/health`);
  console.log(`  ws:     ws://localhost:${config.port}/ws`);
});
