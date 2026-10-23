// Pana multiplayer, browser side. Rooms live on the server's Colyseus mount
// (/colyseus, server/src/room-kit.js); the SDK loads from the CDN only when a
// game actually goes online.
//
// - joinRoom(game, options) → RoomLink: a room joined by invite code, with
//   reconnect-after-reload, a server clock and plain state snapshots.
// - HostRoom: the base class for host-simulated games (Cocina, Galope…). It
//   owns connecting, retries, members, the host, avatars and offline practice;
//   a game's room extends it with its own rules. See docs/knowledge/pana-net.md.

import { normalizeAvatar } from './avatar.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@colyseus/sdk@0.18.5/dist/colyseus.js';
export const ROOM_FULL = 409;

let sdk;
function loadSdk() {
  sdk ??= new Promise((resolve, reject) => {
    if (window.Colyseus) return resolve(window.Colyseus);
    const script = document.createElement('script');
    script.src = SDK;
    script.onload = () => resolve(window.Colyseus);
    script.onerror = () => { sdk = null; reject(new Error('No se pudo cargar el cliente online.')); };
    document.head.append(script);
  });
  return sdk;
}

// ?lead=1: this player is a pana.sh party's Pana Mayor and hosts the room.
export const leadFromUrl = () => new URLSearchParams(location.search).has('lead');

const parseAvatar = (json) => { try { return normalizeAvatar(JSON.parse(json || '{}')); } catch { return normalizeAvatar({}); } };
const isFull = (error) => error?.code === ROOM_FULL || error?.code === 4009 || /full|lleno|locked/i.test(String(error?.message));

// options: { code, lead, name, avatar, resume = true, ...game join options }
// resume: a reload rejoins the same seat (Carreritas's own room tracks each car).
// Host-run games pass false: a reloaded page counts its actions from zero again,
// so it joins as a new pana, exactly as on the old relay.
export async function joinRoom(game, { resume = true, ...options }) {
  const Colyseus = await loadSdk();
  const client = new Colyseus.Client(`${location.origin}/colyseus`);
  const key = `pana:reconnect:${game}:${options.code}`;
  let room = null, token = null;
  // A reload keeps its seat: the reconnection token lives for this tab only.
  try { token = resume ? sessionStorage.getItem(key) : null; } catch { /* storage off */ }
  if (token) {
    try { room = await client.reconnect(token); } catch { room = null; }
  }
  try {
    room ??= await client.joinOrCreate(game, { ...options, lead: !!options.lead, lobbyLoading: !!window.PANA_LOBBY_LOADING });
  } catch (error) {
    if (isFull(error)) error.full = true;
    throw error;
  }
  const link = new RoomLink(room, options.code, key);
  document.dispatchEvent(new CustomEvent('pana:room-link', { detail: link }));
  return link;
}

export class RoomLink {
  constructor(room, code, key) {
    this.room = room;
    this.code = code;
    this.key = key;
    this.id = room.sessionId;
    this.handlers = {};
    this.offsets = [];
    this.offset = 0;
    this.state = { host: '', players: [] };
    this.waiters = new Set();
    this.saveToken();

    let queued = false;
    room.onStateChange(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; this.refresh(); });
    });
    room.onMessage('pong', (m) => this.pong(m));
    room.onMessage('*', (type, message) => { if (type !== 'pong') this.emit(type, message); });
    room.onDrop?.(() => this.emit('status', 'Se perdió la conexión. Reconectando…', true));
    room.onReconnect?.(() => { this.saveToken(); this.emit('status', '', false); this.sync(); });
    room.onLeave((code) => {
      this.left = true;
      clearInterval(this.syncTimer); clearTimeout(this.resync);
      try { sessionStorage.removeItem(this.key); } catch { /* storage off */ }
      for (const w of this.waiters) w();
      this.emit('left', code);
    });
    // A page often joins while it is still loading, and pongs read then arrive
    // late: measure again a few seconds in, before anything is timed on it.
    this.sync();
    this.resync = setTimeout(() => this.sync(), 3000);
    this.syncTimer = setInterval(() => this.sync(), 15000);
    this.refresh();
  }

  saveToken() {
    try { sessionStorage.setItem(this.key, this.room.reconnectionToken); } catch { /* storage off */ }
  }

  on(event, fn) {
    const list = (this.handlers[event] ??= []);
    list.push(fn);
    // Calling the returned unsubscribe twice must not remove someone else's handler.
    return () => { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); };
  }
  emit(event, ...args) { for (const fn of this.handlers[event] ?? []) fn(...args); }

  // Plain copy of the room state. Every map becomes an array of
  // { id, ...fields }; players are sorted by arrival.
  refresh() {
    const s = this.room.state;
    if (!s?.players) return;
    const next = {};
    for (const [field, value] of Object.entries(s.toJSON())) {
      next[field] = value && typeof value === 'object' && !Array.isArray(value) && s[field]?.forEach
        ? Object.entries(value).map(([id, v]) => ({ id, ...v })) : value;
    }
    next.players.sort((a, b) => a.joinedAt - b.joinedAt);
    this.state = next;
    for (const w of this.waiters) w();
    this.emit('state', this.state);
  }

  get isHost() { return this.state.host === this.id; }
  get me() { return this.state.players.find(p => p.id === this.id); }

  // Resolves true once test(state) holds, false if the link closes first.
  until(test, progress) {
    return new Promise((resolve) => {
      const check = () => {
        if (this.left) { this.waiters.delete(check); return resolve(false); }
        progress?.(this.state);
        if (test(this.state)) { this.waiters.delete(check); resolve(true); }
      };
      this.waiters.add(check);
      check();
    });
  }

  // Server clock estimate: a few pings, the lowest-latency ones count.
  sync() {
    for (let i = 0; i < 5; i++) setTimeout(() => this.send('ping', { c: Date.now() }), i * 120);
  }
  pong({ c, s }) {
    const now = Date.now(), rtt = now - c;
    if (!(rtt >= 0 && rtt < 5000)) return;
    this.offsets.push([rtt, s + rtt / 2 - now]);
    this.offsets.sort((a, b) => a[0] - b[0]).splice(8);
    const best = this.offsets.slice(0, 3);
    this.offset = best.reduce((n, [, o]) => n + o, 0) / best.length;
  }
  now() { return Date.now() + this.offset; }

  send(type, data) { if (!this.left) this.room.send(type, data); }
  leave() {
    clearInterval(this.syncTimer); clearTimeout(this.resync);
    try { sessionStorage.removeItem(this.key); } catch { /* storage off */ }
    return this.left ? Promise.resolve() : this.room.leave(true);
  }
}

// ---------------------------------------------------------------------------
// HostRoom: one peer (the room's host) simulates the game and publishes
// snapshots; everyone else sends inputs and actions. Members are keyed by
// their seat number, as on the old /ws relay, so game rules keep plain ids.
//
// Subclass hooks (all optional):
//   entered(alone)              you just joined a room (alone: nobody else is in it)
//   takeOver(previousHostId)    you just became host: build or restore the game
//   memberJoined(member, already)  a pana arrived (or came back); already: they
//                               were in the room when you joined (skip "X llegó")
//   memberLeft(id, member)      a pana left (or dropped)
//   memberHello(id, member)     their hello arrived; member has avatar + extras
//   receive(id, data)           any other message from a member
//   hello()                     extra fields for your own hello
//   statusText()                the connected status line
// texts: { connecting, full, lost, offline }
// ---------------------------------------------------------------------------
const HELLO_RESERVED = new Set(['game', 'kind', 'avatar', 'id', 'name', '__proto__', 'constructor', 'prototype']);
const TEXTS = {
  connecting: 'Conectando con tus panas…',
  full: 'Sala llena. Puedes jugar en local.',
  lost: 'Se cortó la conexión. Reconectando…',
  offline: 'Sin conexión. Puedes jugar en local.',
};

export class HostRoom {
  constructor({ game, protocol, code, name, avatar, texts = {}, onState = () => {}, onStatus = () => {}, onNotice = () => {} }) {
    // `game` is the room type ('cocina'); this.game stays free for the game's own simulation.
    Object.assign(this, { roomType: game, protocol, code, name, avatar, onState, onStatus, onNotice });
    this.texts = { ...TEXTS, ...texts };
    this.members = new Map();
    this.id = null;
    this.hostId = null;
    this.connected = false;
    this.offline = false;
    this.attempts = 0;
  }

  get isHost() { return this.id != null && this.id === this.hostId; }

  async connect() {
    this.stopped = false;
    this.onStatus(this.texts.connecting);
    let link;
    try {
      link = await joinRoom(this.roomType, { code: this.code, lead: leadFromUrl(), name: this.name, avatar: this.avatar, resume: false });
    } catch (error) {
      if (this.stopped || this.offline) return;
      if (error.full) { this.stopped = true; this.onStatus(this.texts.full, true); return; }
      return this.retryLater();
    }
    if (this.stopped || this.offline) { link.leave(); return; }
    this.link = link;
    this.attempts = 0;
    // A (re)joined room may be a fresh one: its seats are not the old room's,
    // and whoever it makes host takes over anew.
    for (const [id, member] of [...this.members]) if (id !== this.id) { this.members.delete(id); this.memberLeft?.(id, member); }
    this.members.clear();
    this.id = null;
    this.hostId = null;
    this.hosting = false;
    link.on('state', (s) => this.sync(s));
    link.on('relay', ({ id, v }) => {
      if (v?.game !== this.protocol || !this.members.has(id)) return;
      if (v.kind === 'hello') this.hello_(id, v);
      else this.receive?.(id, v);
    });
    link.on('status', (text) => {
      if (this.offline) return;
      if (text) { this.connected = false; this.onStatus(this.texts.lost, true); } else { this.connected = true; this.status(); }
    });
    link.on('left', (code) => {
      if (link !== this.link || this.stopped || this.offline) return;
      this.connected = false;
      if (code !== 4000) this.retryLater();
    });
    if (link.state.players.length) this.sync(link.state);
  }

  retryLater() {
    this.connected = false;
    if (++this.attempts <= 3) {
      this.onStatus(this.texts.lost, true);
      this.retry = setTimeout(() => this.connect(), 1500);
    } else this.onStatus(this.texts.offline, true);
  }

  // Room state → members and host. A dropped pana counts as gone until it
  // returns, so the game moves on without waiting for its tab.
  sync(s) {
    const mine = s.players.find(p => p.id === this.link.id);
    if (!mine) return;
    const first = this.id !== mine.seat;
    this.id = mine.seat;
    this.connected = true;
    const live = new Map(s.players.filter(p => p.connected || p.id === this.link.id).map(p => [p.seat, p]));
    for (const [id, member] of [...this.members]) {
      if (!live.has(id)) { this.members.delete(id); this.memberLeft?.(id, member); }
    }
    const arrived = [];
    for (const [id, p] of live) {
      const known = this.members.get(id);
      if (known) { known.name = p.name; continue; }
      const member = { id, name: p.name, avatar: id === this.id ? this.avatar : parseAvatar(p.avatar) };
      this.members.set(id, member);
      if (id !== this.id) arrived.push(member);
    }
    if (first) this.entered?.(live.size === 1);
    const hostSeat = s.players.find(p => p.id === s.host)?.seat ?? null;
    this.elect(hostSeat);
    for (const member of arrived) this.memberJoined?.(member, first);
    if (first || arrived.length) this.send({ kind: 'hello', avatar: this.avatar, ...this.hello?.() });
    this.status();
  }

  elect(next) {
    const previous = this.hostId;
    this.hostId = next;
    if (this.isHost && (previous !== next || !this.hosting)) {
      this.hosting = true;
      this.takeOver?.(previous);
    } else if (!this.isHost) this.hosting = false;
  }

  hello_(id, v) {
    const member = this.members.get(id);
    member.avatar = normalizeAvatar(v.avatar || member.avatar || {});
    // A hello's extras never overwrite who the member is.
    for (const [k, value] of Object.entries(v)) if (!HELLO_RESERVED.has(k)) member[k] = value;
    this.memberHello?.(id, member);
  }

  status() {
    if (this.offline) return;
    const n = this.members.size;
    this.onStatus(this.statusText?.() ?? `Sala ${this.code} · ${n} pana${n === 1 ? '' : 's'} conectado${n === 1 ? '' : 's'}`);
  }

  // dest: 'host' for what only the host reads (inputs, actions), a seat for one
  // member, nothing for everyone. The room delivers it only there.
  send(data, dest) {
    if (this.offline || !this.link) return;
    this.link.send('relay', dest == null ? { game: this.protocol, ...data } : { game: this.protocol, ...data, dest });
  }

  // Local play: you are seat 1 and the host, nothing touches the network.
  practice(text) {
    this.stopped = true;
    this.offline = true;
    clearTimeout(this.retry);
    this.link?.leave();
    this.link = null;
    this.id = 1;
    this.hostId = null;
    this.hosting = false;
    this.members = new Map([[1, { id: 1, name: this.name, avatar: this.avatar }]]);
    this.connected = true;
    this.elect(1);
    if (text) this.onStatus(text);
  }

  // Lose the connection for good, as a dead network would after every retry
  // (tests use it to reach the offline fallback).
  cut() {
    this.attempts = 3;
    const room = this.link?.room;
    if (!room) return this.retryLater();
    room.reconnection.enabled = false;   // the SDK would otherwise rejoin quietly
    room.leave(false);
  }

  dispose() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.link?.leave();
  }
}
