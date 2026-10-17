// What every Pana room on Colyseus shares: one room per invite code, members
// with stable numeric seats, a host the room chooses (a pana.sh party's Pana
// Mayor when they join with `lead`), host handoff the moment a host drops, a
// reconnection window, server clock pings and the listing for /api/rooms.
//
// A game's room extends PanaRoom and builds its state with roomState():
//
//   const Player = Member.extend({ car: t.uint8() }, 'Player');
//   class MyRoom extends PanaRoom {
//     memberClass = Player;
//     state = new (roomState({ phase: t.string() }, Player))();
//   }
//
// Hooks a subclass may define: joined(client, member, options),
// dropped(client, member), returned(client, member), left(client, member),
// hostChanged(id). Call super.onCreate(options) first in onCreate.

import { Room, CloseCode, ServerError } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { normalizeAvatar } from '../../engine/avatar.js';

export const MAX_MEMBERS = 8;
export const RECONNECT_SECONDS = 20;
// onCreate failures travel over HTTP matchmaking. Colyseus 0.18's Node
// adapter treats this as an HTTP status; a WebSocket close code becomes 404.
export const ROOM_FULL = 409;
// The lead (party's Pana Mayor) takes the host only while the room is new,
// i.e. during the party's move. Later they join like anyone else, so a game
// already running never hands over to a host without its state.
export const LEAD_WINDOW_MS = 15000;

export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'pana';
export const cleanCode = (s) => String(s ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 24);
export const avatarJson = (a) => {
  try { return JSON.stringify(normalizeAvatar(a && typeof a === 'object' ? a : {})).slice(0, 2048); } catch { return '{}'; }
};

export const Member = schema({
  seat: t.uint16(),         // never reused within a room, like the /ws relay's ids
  name: t.string(),
  avatar: t.string(),       // normalized avatar JSON
  joinedAt: t.number(),
  connected: t.boolean().default(true),
}, 'Member');

export function roomState(fields = {}, memberClass = Member, name = 'PanaState') {
  return schema({ host: t.string().default(''), players: t.map(memberClass), ...fields }, name);
}

// One live room per game and code in this process. joinOrCreate would
// otherwise open a second room under the same code once the first is full.
const open = new Map();

export class PanaRoom extends Room {
  maxClients = MAX_MEMBERS;
  maxMessagesPerSecond = 80;
  memberClass = Member;

  onCreate(options = {}) {
    this.code = cleanCode(options.code);
    const key = `${this.roomName}:${this.code}`;
    if (this.code && open.has(key)) throw new ServerError(ROOM_FULL, 'full');
    if (this.code) { open.set(key, this.roomId); this.openKey = key; }
    this.lead = '';
    this.createdAt = Date.now();
    this.nextSeat = 1;
    this.onMessage('me', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m !== 'object') return;
      if ('name' in m) p.name = cleanName(m.name);
      if ('avatar' in m) p.avatar = avatarJson(m.avatar);
      this.updateMetadata();
    });
    this.onMessage('ping', (client, m) => client.send('pong', { c: m?.c, s: Date.now() }));
    this.updateMetadata();
  }

  onDispose() {
    if (this.openKey && open.get(this.openKey) === this.roomId) open.delete(this.openKey);
  }

  // A new arrival never inherits a departed pana's seat, so per-seat game data
  // (ledgers, scores) can't leak to them. A reconnect keeps its own seat.
  createMember(client, options) {
    return new this.memberClass({
      seat: this.nextSeat++, name: cleanName(options.name), avatar: avatarJson(options.avatar), joinedAt: Date.now(),
    });
  }

  onJoin(client, options = {}) {
    const member = this.createMember(client, options);
    this.state.players.set(client.sessionId, member);
    // The party's Pana Mayor hosts, even when a guest's tab got here first.
    if (options.lead && !this.lead && Date.now() - this.createdAt < LEAD_WINDOW_MS) {
      this.lead = client.sessionId;
      this.setHost(client.sessionId);
    } else if (!this.state.host) this.setHost(client.sessionId);
    this.joined?.(client, member, options);
    this.updateMetadata();
  }

  onDrop(client, code) {
    const member = this.state.players.get(client.sessionId);
    if (member) member.connected = false;
    // Whatever the host runs must keep running while their tab reconnects.
    if (this.state.host === client.sessionId) this.setHost(this.nextHost(client.sessionId));
    this.dropped?.(client, member);
    if (code === CloseCode.SERVER_SHUTDOWN) return;
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => {});
  }

  onReconnect(client) {
    const member = this.state.players.get(client.sessionId);
    if (member) member.connected = true;
    if (!this.state.host) this.setHost(client.sessionId);
    this.returned?.(client, member);
  }

  onLeave(client) {
    const id = client.sessionId, member = this.state.players.get(id);
    this.state.players.delete(id);
    if (this.lead === id) this.lead = '';
    this.left?.(client, member);
    if (this.state.host === id || !this.state.players.has(this.state.host)) this.setHost(this.nextHost(id));
    this.updateMetadata();
  }

  isHost(client) { return client.sessionId === this.state.host; }

  nextHost(except) {
    const live = [...this.state.players.entries()].filter(([id, p]) => id !== except && p.connected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    return live[0]?.[0] || '';
  }

  setHost(id) {
    const changed = this.state.host !== (id || '');
    this.state.host = id || '';
    if (changed) this.hostChanged?.(this.state.host);
  }

  memberBySeat(seat) {
    for (const [id, p] of this.state.players) if (p.seat === seat) return [id, p];
    return [];
  }

  updateMetadata() {
    this.setMetadata({ code: this.code, names: [...this.state.players.values()].map(p => p.name) }).catch(() => {});
  }
}
