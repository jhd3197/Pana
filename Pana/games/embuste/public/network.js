import { embusteOptions } from './options.js';
// ¡Embuste!'s two ways to play the night, with one interface for game.js:
// - OnlineNight: the game's own Colyseus room (games/embuste/server/room.js),
//   joined through the shared kit (engine/net.js). The room runs the Night and
//   sends this seat its private `view`.
// - PracticeNight: the same Night and bots, run in this browser.
//
// Both emit 'lobby' (roster, phase, options, who hosts), 'view' and 'status'.

import { joinRoom, leadFromUrl } from '/engine/net.js';
import { Night, cleanInput, debugNight, MAX_PLAYERS, QUICK } from './rules.js';
import { Brains, BOT_NAMES } from './bots.js';
import { randomAvatar } from '/engine/avatar.js';

class Emitter {
  constructor() { this.handlers = {}; }
  on(event, fn) { (this.handlers[event] ??= []).push(fn); }
  emit(event, ...args) { for (const fn of this.handlers[event] ?? []) fn(...args); }
}

export class OnlineNight extends Emitter {
  constructor({ code, name, avatar, quick = false }) {
    super();
    Object.assign(this, { code, name, avatar, quick, online: true, connected: false });
    this.lobby = { phase: 'lobby', players: [], isHost: false, bots: true, reveal: true, chat: true, round: 0 };
  }

  async connect() {
    this.emit('status', 'Buscando a tus panas…');
    try {
      this.link = await joinRoom('embuste', { code: this.code, lead: leadFromUrl(), name: this.name, avatar: this.avatar, quick: this.quick });
    } catch (error) {
      this.emit('status', error.full ? 'Sala llena. Abre otra noche desde Pana.' : 'Sin conexión. Puedes practicar en este navegador.', true);
      return false;
    }
    this.connected = true;
    this.link.on('state', (s) => this.refresh(s));
    this.link.on('view', (view) => this.emit('view', view));
    this.link.on('status', (text, error) => { this.connected = !error; this.emit('status', text || this.statusText(), !!error); });
    this.link.on('left', () => { this.connected = false; this.emit('status', 'Se cortó la conexión. Puedes practicar en este navegador.', true); });
    this.refresh(this.link.state);
    return true;
  }

  get seat() { return this.link?.me?.seat ?? null; }

  refresh(s) {
    if (!s?.players) return;
    this.lobby = {
      phase: s.phase || 'lobby', round: s.round || 0, isHost: s.host === this.link.id, bots: s.bots, reveal: s.reveal, chat: s.chat,
      players: s.players.filter(p => p.connected).map(p => ({ seat: p.seat, name: p.name, me: p.id === this.link.id, host: p.id === s.host })),
    };
    this.emit('lobby', this.lobby);
    this.emit('status', this.statusText());
  }

  statusText() {
    const n = this.lobby.players.length;
    return `Sala ${this.code} · ${n} pana${n === 1 ? '' : 's'}`;
  }

  input(i) { this.link?.send('input', cleanInput(i)); }
  act(action, data = {}) { this.link?.send('act', { ...data, action }); }
  start() { this.link?.send('start'); }
  toLobby() { this.link?.send('lobby'); }
  options(patch) { this.link?.send('options', patch); }
  debug(m) { this.link?.send('debug', m); }   // ?quick rooms only (browser suites)
  leave() { this.connected = false; return this.link?.leave(); }
}

// Local night: you are seat 1, bots fill the camp. Same rules, same views.
export class PracticeNight extends Emitter {
  constructor({ name, avatar, quick = false, bots = 5 }) {
    super();
    Object.assign(this, { name, avatar, online: false, connected: true, seat: 1, botCount: bots });
    this.night = new Night(quick ? QUICK : {});
    this.brains = new Brains(this.night);
    this.night.addPlayer(1, { name, avatar });
    this.current = { x: 0, z: 0, hold: false };
    this.cursor = 0;
    this.lobby = { phase: 'lobby', round: 0, isHost: true, bots: true, reveal: true, chat: true, players: [{ seat: 1, name, me: true, host: true }] };
  }

  connect() {
    this.emit('lobby', this.lobby);
    this.emit('status', 'Práctica en este navegador · bots en el campamento');
    // Real elapsed time in 50 ms steps: a busy page still runs the night at speed.
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now(); let dt = Math.min(0.5, (now - last) / 1000); last = now;
      for (; dt > 0.001; dt -= 0.05) this.tick(Math.min(0.05, dt), false);
      this.publish();
    }, 50);
    return true;
  }

  tick(dt, publish = true) {
    const night = this.night, inputs = new Map([[1, this.paused ? { x: 0, z: 0 } : this.current]]);
    if (night.inRound() && !this.paused) this.brains.think(dt, inputs);
    if (!this.paused) night.update(dt, inputs);
    if (publish) this.publish();
  }

  publish() {
    const night = this.night;
    if (this.lobby.phase !== night.phase || this.lobby.round !== night.round) {
      this.lobby = { ...this.lobby, phase: night.phase, round: night.round };
      this.emit('lobby', this.lobby);
    }
    const view = night.view(1, this.cursor);
    this.cursor = night.eventId;
    this.emit('view', view);
  }

  input(i) { this.current = cleanInput(i); }
  act(action, data = {}) { this.night.act?.(1, action, data); }
  start() {
    const night = this.night;
    for (const p of [...night.players.values()]) if (p.bot) night.players.delete(p.seat);
    const total = Math.min(MAX_PLAYERS, 1 + this.botCount);
    for (let i = 0; night.players.size < total; i++) night.addPlayer(200 + i, { name: BOT_NAMES[i % BOT_NAMES.length], avatar: randomAvatar(), bot: true });
    Object.assign(night.options, { reveal: this.lobby.reveal, chat: this.lobby.chat });
    this.brains.minds.clear();
    night.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }
  toLobby() {
    for (const p of [...this.night.players.values()]) if (p.bot) this.night.players.delete(p.seat);
    this.night.toLobby();
  }
  options(patch) { const next = this.night.phase === 'lobby' && embusteOptions(this.lobby, patch); if (!next) return; this.lobby = { ...this.lobby, ...next }; this.emit('lobby', this.lobby); }
  debug(m) { debugNight(this.night, 1, m); }
  leave() { clearInterval(this.timer); }
}
