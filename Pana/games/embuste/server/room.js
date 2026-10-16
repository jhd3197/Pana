// ¡Embuste! online: the room runs the whole night (docs/plans/54_embuste.md,
// option 2). Social deduction lives on secrets, so no client ever gets a
// snapshot of the Night: each seat gets its own `view` (its role, what its
// lantern lights up, its own events). The room state only carries what every
// lobby may know: the roster, the phase and the host's options.

import { t } from '@colyseus/schema';
import { PanaRoom, Member, roomState } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import { Night, MIN_PLAYERS, MAX_PLAYERS, cleanInput, QUICK } from '../public/rules.js';
import { Brains, BOT_NAMES } from '../public/bots.js';

const TICK = 0.05;
const INPUT_TTL_MS = 600;
const BOT_FILL = 6;
const BOT_SEAT = 200;

const EmbusteState = roomState({
  phase: t.string().default('lobby'),
  round: t.uint16().default(0),
  bots: t.boolean().default(true),
  reveal: t.boolean().default(true),
  chat: t.boolean().default(true),
}, Member, 'EmbusteState');

const parse = (json) => { try { return JSON.parse(json || '{}'); } catch { return {}; } };

export default class EmbusteRoom extends PanaRoom {
  state = new EmbusteState();

  onCreate(options = {}) {
    super.onCreate(options);
    // ?quick (browser suites only): short timers so a whole night fits a test.
    this.quick = !!options.quick;
    this.night = new Night(this.quick ? QUICK : {});
    this.brains = new Brains(this.night);
    this.inputs = new Map();     // seat → { ...input, at }
    this.cursor = new Map();     // sessionId → last event id sent

    this.onMessage('options', (client, m) => {
      if (!this.isHost(client) || this.night.phase !== 'lobby' || !m) return;
      for (const k of ['bots', 'reveal', 'chat']) if (k in m) this.state[k] = !!m[k];
    });
    this.onMessage('start', (client) => {
      if (this.isHost(client) && ['lobby', 'ended'].includes(this.night.phase)) this.startNight();
    });
    this.onMessage('lobby', (client) => {
      if (this.isHost(client) && this.night.phase === 'ended') this.toLobby();
    });
    this.onMessage('input', (client, m) => {
      const seat = this.seatOf(client);
      if (seat != null) this.inputs.set(seat, { ...cleanInput(m), at: Date.now() });
    });
    this.onMessage('act', (client, m) => {
      const seat = this.seatOf(client);
      if (seat == null || !m || typeof m.action !== 'string' || JSON.stringify(m).length > 600) return;
      this.night.act?.(seat, m.action, m);
    });
    this.clock.setInterval(() => this.tick(), TICK * 1000);
  }

  seatOf(client) { return this.state.players.get(client.sessionId)?.seat; }

  joined(client, member) {
    this.night.addPlayer(member.seat, { name: member.name, avatar: parse(member.avatar) });
    this.cursor.set(client.sessionId, this.night.eventId);
    this.sendView(client);
  }
  returned(client) { this.sendView(client); }
  dropped(client, member) { if (member) this.inputs.delete(member.seat); }
  left(client, member) {
    this.cursor.delete(client.sessionId);
    if (!member) return;
    this.inputs.delete(member.seat);
    this.night.removePlayer(member.seat);
    if (![...this.night.players.values()].some(p => !p.bot)) this.toLobby();
  }

  humans() {
    return [...this.state.players.values()].filter(p => p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
  }

  startNight() {
    const night = this.night;
    for (const p of [...night.players.values()]) if (p.bot) night.players.delete(p.seat);
    const humans = this.humans();
    const total = Math.min(MAX_PLAYERS, this.state.bots ? Math.max(BOT_FILL, humans.length) : humans.length);
    if (total < MIN_PLAYERS && !this.quick) return;
    for (const m of humans) night.addPlayer(m.seat, { name: m.name, avatar: parse(m.avatar) });
    for (let i = 0; night.players.size < total; i++) {
      night.addPlayer(BOT_SEAT + i, { name: BOT_NAMES[i % BOT_NAMES.length], avatar: randomAvatar(), bot: true });
    }
    Object.assign(night.options, { reveal: this.state.reveal, chat: this.state.chat });
    night.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    this.inputs.clear();
    this.brains.minds.clear();
    this.sync();
  }

  toLobby() {
    for (const p of [...this.night.players.values()]) if (p.bot) this.night.players.delete(p.seat);
    this.night.toLobby();
    this.sync();
  }

  sync() {
    this.state.phase = this.night.phase;
    this.state.round = this.night.round;
  }

  sendView(client) {
    const seat = this.seatOf(client);
    if (seat == null) return;
    const view = this.night.view(seat, this.cursor.get(client.sessionId) ?? 0);
    if (!view) return;
    this.cursor.set(client.sessionId, this.night.eventId);
    client.send('view', view);
  }

  tick() {
    const night = this.night, now = Date.now();
    if (night.phase === 'lobby') {
      for (const m of this.state.players.values()) { const p = night.players.get(m.seat); if (p) p.name = m.name; }
    }
    const inputs = new Map();
    for (const [seat, input] of this.inputs) {
      if (now - input.at > INPUT_TTL_MS) this.inputs.delete(seat); else inputs.set(seat, input);
    }
    if (night.inRound()) this.brains.think(TICK, inputs);
    night.update(TICK, inputs);
    if (this.state.phase !== night.phase || this.state.round !== night.round) this.sync();
    for (const client of this.clients) this.sendView(client);
  }
}
