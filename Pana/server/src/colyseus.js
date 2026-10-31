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
// Matchmaking per client address: `burst` requests at once, then `perMinute`.
// Every joinOrCreate with a new code makes a room, so a loop of them is the
// cheapest way to load the server. Behind a proxy, PANA_CLIENT_IP_HEADER names
// the header that carries the visitor's address (the socket is the proxy's);
// without one, this machine's own requests (dev, the browser suites) are free.
export function createLimiter({ burst = 20, perMinute = 20, max = 10000 } = {}) {
  const buckets = new Map();
  return (key, now = Date.now()) => {
    const [tokens, then] = buckets.get(key) ?? [burst, now];
    const left = Math.min(burst, tokens + (now - then) * perMinute / 60000);
    if (buckets.size >= max && !buckets.has(key)) buckets.clear();
    buckets.set(key, [left >= 1 ? left - 1 : left, now]);
    return left >= 1;
  };
}
export function clientAddress(req, header = process.env.PANA_CLIENT_IP_HEADER) {
  if (header) return String(req.headers[header.toLowerCase()] || '').split(',').pop().trim() || 'unknown';
  const peer = req.socket?.remoteAddress || 'unknown';
  return /^(127\.|::1$|::ffff:127\.)/.test(peer) ? null : peer;
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
  const allow = createLimiter();
  // The matchmaking middleware expects /matchmake/:method/:room at the root.
  function handle(req, res) {
    req.url = req.url.slice(PREFIX.length) || '/';
    const address = req.url.startsWith('/matchmake/') && req.method === 'POST' ? clientAddress(req) : null;
    if (address !== null && !allow(address)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '10' });
      return res.end(JSON.stringify({ code: 429, error: 'too many rooms, wait a moment' }));
    }
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
