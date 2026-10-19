// Colyseus rooms on the same HTTP server, under /colyseus (matchmaking HTTP
// and room sockets). Rooms are private by `code`; shared behaviour lives in
// room-kit.js.
//
// Embedded the way colyseus/vite does it, not through Colyseus' Server class:
// that one takes over every HTTP request and the process signals.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { matchMaker, createNodeMatchmakingMiddleware } from '@colyseus/core';
import { setTransport } from '@colyseus/core/Transport';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { config } from './config.js';
import { listGames } from './api.js';
import RelayRoom from './relay-room.js';
import { MAX_MEMBERS } from './room-kit.js';

export const PREFIX = '/colyseus';

// game.json `players` is the room's cap: a fifth visitor to a four-seat table
// is refused instead of sitting in a room they can't play.
export function cappedRoom(RoomClass, players) {
  const cap = Math.max(1, Math.min(MAX_MEMBERS, Number(players) || MAX_MEMBERS));
  return class extends RoomClass { maxClients = cap; };
}
export const isColyseusPath = (url) => url === PREFIX || url.startsWith(PREFIX + '/') || url.startsWith(PREFIX + '?');

export async function attachColyseus(server) {
  await matchMaker.setup();   // in-memory presence and driver: one process, like the relay
  const transport = new WebSocketTransport({ noServer: true, maxPayload: 256 * 1024 });
  transport.attachToServer(server, { filter: (req) => isColyseusPath(req.url) });
  setTransport(transport);

  // Every game gets a room under its id: its own server/room.js, or the
  // generic host-relay room (relay-room.js) that engine/net.js HostRoom uses.
  const games = [];
  for (const { id, players } of listGames()) {
    const file = path.join(config.paths.games, id, 'server', 'room.js');
    const RoomClass = fs.existsSync(file) ? (await import(pathToFileURL(file).href)).default : RelayRoom;
    matchMaker.defineRoomType(id, cappedRoom(RoomClass, players)).filterBy(['code']);
    games.push(RoomClass === RelayRoom ? id : `${id} (own room)`);
  }
  await matchMaker.accept();

  const middleware = createNodeMatchmakingMiddleware();
  // The matchmaking middleware expects /matchmake/:method/:room at the root.
  function handle(req, res) {
    req.url = req.url.slice(PREFIX.length) || '/';
    middleware(req, res, () => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  }

  async function shutdown() {
    await matchMaker.gracefullyShutdown();
    transport.shutdown();
    matchMaker.presence.shutdown();
    await matchMaker.driver.shutdown?.();
  }

  // Live rooms for /api/rooms.
  async function snapshot() {
    const rooms = await matchMaker.query({});
    return rooms.map((r) => ({
      game: r.name, room: r.metadata?.code ?? '', players: r.clients, max: r.maxClients,
      names: r.metadata?.names ?? [],
    }));
  }

  return { games, handle, shutdown, snapshot };
}
