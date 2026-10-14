// RoomManager: ephemeral game rooms over WebSocket.
// Rooms are keyed `${game}:${code}` so two games never collide on the same code.
// Clients simulate their own entity and relay state through us at ~20 Hz.

import { WebSocketServer } from 'ws';
import { config } from './config.js';

const COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5', '#00bbf9', '#8ac926'];

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // key -> Map<playerId, socket>
    this.nextId = 1;
  }

  key(game, code) {
    return `${game}:${code}`;
  }

  join(ws, msg) {
    const game = String(msg.game || 'pana').slice(0, 24);
    const code = String(msg.room || 'lobby').slice(0, config.roomCodeMaxLength);
    const key = this.key(game, code);

    if (!this.rooms.has(key)) this.rooms.set(key, new Map());
    const members = this.rooms.get(key);
    if (members.size >= config.maxPlayersPerRoom) {
      ws.send(JSON.stringify({ t: 'full' }));
      return;
    }

    ws.pana = {
      id: this.nextId++,
      key,
      game,
      room: code,
      name: String(msg.name || 'pana').slice(0, config.playerNameMaxLength),
      color: COLORS[members.size % COLORS.length],
    };
    members.set(ws.pana.id, ws);

    ws.send(JSON.stringify({
      t: 'welcome',
      id: ws.pana.id,
      color: ws.pana.color,
      players: [...members.values()]
        .filter((p) => p !== ws)
        .map((p) => ({ id: p.pana.id, name: p.pana.name, color: p.pana.color })),
    }));
    this.broadcast(key, ws, { t: 'joined', id: ws.pana.id, name: ws.pana.name, color: ws.pana.color });
  }

  relayState(ws, msg) {
    if (!ws.pana) return;
    this.broadcast(ws.pana.key, ws, {
      t: 'state', id: ws.pana.id, x: msg.x, z: msg.z, h: msg.h, v: msg.v,
    });
  }

  leave(ws) {
    if (!ws.pana) return;
    const { key, id } = ws.pana;
    const members = this.rooms.get(key);
    if (!members) return;
    members.delete(id);
    this.broadcast(key, null, { t: 'left', id });
    if (members.size === 0) this.rooms.delete(key);
  }

  broadcast(key, exclude, msg) {
    const members = this.rooms.get(key);
    if (!members) return;
    const out = JSON.stringify(msg);
    for (const p of members.values()) {
      if (p !== exclude && p.readyState === 1) p.send(out);
    }
  }

  snapshot() {
    return [...this.rooms.entries()].map(([key, members]) => {
      const first = members.values().next().value;
      return {
        game: first?.pana.game,
        room: first?.pana.room,
        players: members.size,
        max: config.maxPlayersPerRoom,
        names: [...members.values()].map((p) => p.pana.name),
      };
    });
  }
}

export function attachWebSocket(server, rooms) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t === 'join') rooms.join(ws, msg);
      else if (msg.t === 'state') rooms.relayState(ws, msg);
    });
    ws.on('close', () => rooms.leave(ws));
  });
  return wss;
}
