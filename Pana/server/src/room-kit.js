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
//
// Helpers for rooms that run the game themselves (poquer, pintura, embuste):
// seatOf(client), connectedMembers(), onHostMessage(type, fn), memberAvatar(),
// fillBots() and InputBuffer. The room's cap comes from game.json `players`
// (colyseus.js), so a room never sets maxClients itself.

import { Room, CloseCode, ServerError } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { normalizeAvatar, randomAvatar } from '../../engine/avatar.js';

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

// A stored avatar JSON string back to an object, never throwing.
export const memberAvatar = (member) => { try { return JSON.parse(member?.avatar || '{}'); } catch { return {}; } };

export const BOT_NAMES = ['Coco', 'Lola', 'Cheo', 'Nena', 'Toño', 'Mari', 'Pepe'];
export const BOT_SEAT = 1000;
// Adds `count` bots through add(seat, { name, avatar, bot: true }); bot seats
// start at BOT_SEAT so they never collide with member seats.
export function fillBots(count, add, { seat = BOT_SEAT, names = BOT_NAMES, avatar = randomAvatar } = {}) {
  for (let i = 0; i < count; i++) add(seat + i, { name: names[i % names.length], avatar: avatar(), bot: true });
}

// Latest input per seat; inputs older than ttl ms count as released keys, so a
// tab that stops sending (closed lid, lost Wi-Fi) stops moving.
export class InputBuffer {
  constructor(ttl = 600) { this.ttl = ttl; this.inputs = new Map(); }
  set(seat, value) { if (seat != null) this.inputs.set(seat, { value, at: Date.now() }); }
  delete(seat) { this.inputs.delete(seat); }
  clear() { this.inputs.clear(); }
  fresh(now = Date.now()) {
    const out = new Map();
    for (const [seat, input] of this.inputs) {
      if (now - input.at > this.ttl) this.inputs.delete(seat); else out.set(seat, input.value);
    }
    return out;
  }
}

export const Member = schema({
  seat: t.uint16(),         // never reused within a room
  name: t.string(),
  avatar: t.string(),       // normalized avatar JSON
  joinedAt: t.number(),
  connected: t.boolean().default(true),
  assetsReady: t.boolean().default(true), // old clients have no illustrated loading lobby
  lobbyReady: t.boolean().default(true),
}, 'Member');

export function roomState(fields = {}, memberClass = Member, name = 'PanaState') {
  return schema({ host: t.string().default(''), players: t.map(memberClass), ...fields }, name);
}

// One line per room event on stdout (the hosted gateway keeps it in its log):
// "[room] carreritas:kcsvnm join seat=3 name=Neeu lead=0 members=3/3".
// PANA_ROOM_LOG=0 silences it.
export function roomLog(room, event, details = {}) {
  if (process.env.PANA_ROOM_LOG === '0') return;
  const fields = Object.entries(details).filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'string' && /\s/.test(v) ? JSON.stringify(v) : v}`);
  console.log(['[room]', `${room.roomName}:${room.code || room.roomId}`, event, ...fields].join(' '));
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
    if (this.code && open.has(key)) { roomLog(this, 'refused', { reason: 'code-taken' }); throw new ServerError(ROOM_FULL, 'full'); }
    if (this.code) { open.set(key, this.roomId); this.openKey = key; }
    this.lead = '';
    this.createdAt = Date.now();
    this.nextSeat = 1;
    this.peak = 0;
    roomLog(this, 'create', { id: this.roomId });
    this.onMessage('me', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m !== 'object') return;
      if ('name' in m) p.name = cleanName(m.name);
      if ('avatar' in m) p.avatar = avatarJson(m.avatar);
      this.updateMetadata();
    });
    this.onMessage('ping', (client, m) => client.send('pong', { c: m?.c, s: Date.now() }));
    this.onMessage('lobby-ready', (client, message) => {
      const member = this.state.players.get(client.sessionId);
      if (!member || !message || typeof message !== 'object') return;
      if (typeof message.loaded === 'boolean') member.assetsReady = message.loaded;
      if (typeof message.ready === 'boolean') member.lobbyReady = message.ready;
    });
    this.updateMetadata();
  }

  onDispose() {
    roomLog(this, 'dispose', { lived: `${Math.round((Date.now() - this.createdAt) / 1000)}s`, peak: this.peak });
    this.releaseCode();
  }

  releaseCode() {
    if (this.openKey && open.get(this.openKey) === this.roomId) open.delete(this.openKey);
  }

  // Colyseus sends every message handler, clock timer and lifecycle error here
  // once a room defines this method, instead of letting one bad payload end
  // the whole server. The offending call is skipped; the room keeps running.
  onUncaughtException(error, method) {
    const cause = error?.cause ?? error;
    if (cause instanceof ServerError) return;                // expected, e.g. "full"
    console.error(`[room ${this.roomName}:${this.code || this.roomId}] ${method} failed:`, cause?.stack || cause);
    // A room that never finished creating must not hold its code as "full".
    if (method === 'onCreate') this.releaseCode();
  }

  // A new arrival never inherits a departed pana's seat, so per-seat game data
  // (ledgers, scores) can't leak to them. A reconnect keeps its own seat.
  createMember(client, options) {
    return new this.memberClass({
      seat: this.nextSeat++, name: cleanName(options.name), avatar: avatarJson(options.avatar), joinedAt: Date.now(),
      assetsReady: !options.lobbyLoading,
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
    this.peak = Math.max(this.peak, this.state.players.size);
    roomLog(this, 'join', { seat: member.seat, name: member.name, lead: options.lead ? 1 : 0, host: this.state.host === client.sessionId ? 1 : 0, ...this.counts() });
    this.updateMetadata();
  }

  counts() {
    const all = [...this.state.players.values()];
    return { members: `${all.filter(p => p.connected).length}/${all.length}` };
  }

  onDrop(client, code) {
    const member = this.state.players.get(client.sessionId);
    if (member) member.connected = false;
    roomLog(this, 'drop', { seat: member?.seat, code, ...this.counts() });
    // Whatever the host runs must keep running while their tab reconnects.
    if (this.state.host === client.sessionId) this.setHost(this.nextHost(client.sessionId));
    this.dropped?.(client, member);
    if (code === CloseCode.SERVER_SHUTDOWN) return;
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => {});
  }

  onReconnect(client) {
    const member = this.state.players.get(client.sessionId);
    if (member) member.connected = true;
    roomLog(this, 'reconnect', { seat: member?.seat, ...this.counts() });
    if (!this.state.host) this.setHost(client.sessionId);
    this.returned?.(client, member);
  }

  onLeave(client, code) {
    const id = client.sessionId, member = this.state.players.get(id);
    this.state.players.delete(id);
    roomLog(this, 'leave', { seat: member?.seat, code, ...this.counts() });
    if (this.lead === id) this.lead = '';
    this.left?.(client, member);
    if (this.state.host === id || !this.state.players.has(this.state.host)) this.setHost(this.nextHost(id));
    this.updateMetadata();
  }

  isHost(client) { return client.sessionId === this.state.host; }

  seatOf(client) { return this.state.players.get(client.sessionId)?.seat; }

  // A message only the host may send (start, map, options); others are ignored.
  onHostMessage(type, fn) {
    this.onMessage(type, (client, message) => { if (this.isHost(client)) fn(client, message); });
  }

  // Connected members by arrival, as [sessionId, member] pairs.
  connectedMembers(except) {
    return [...this.state.players.entries()].filter(([id, p]) => id !== except && p.connected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
  }

  nextHost(except) { return this.connectedMembers(except)[0]?.[0] || ''; }

  setHost(id) {
    const changed = this.state.host !== (id || '');
    const from = this.state.players.get(this.state.host)?.seat;
    this.state.host = id || '';
    if (changed) {
      if (this.createdAt) roomLog(this, 'host', { from, to: this.state.players.get(this.state.host)?.seat ?? 'none' });
      this.hostChanged?.(this.state.host);
    }
  }

  memberBySeat(seat) {
    for (const [id, p] of this.state.players) if (p.seat === seat) return [id, p];
    return [];
  }

  updateMetadata() {
    this.setMetadata({ code: this.code, names: [...this.state.players.values()].map(p => p.name) }).catch(() => {});
  }
}
