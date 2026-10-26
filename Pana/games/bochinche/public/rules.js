// Pana adapter around the imported 60 Hz platform-fighting simulation.
import { CombatGame, createEmptyInput } from './combat/engine.js';
import { CpuController } from './combat/ai.js';
import { defaultOptions, roomOptions } from './options.js';
import { clamp } from '../../../engine/random.js';
import { locKey } from '../../../engine/i18n.js';
import { PANA_IDS, fighterId } from './panas.js';

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'shield', 'grab'];
export const STYLES = ['kaykit-knight', 'platformer', 'yeti'];
// Shown through loc() where they are drawn.
export const STYLE_NAMES = [locKey('Equilibrado'), locKey('Veloz'), locKey('Pesado')];
// Per-round tallies for the results table, read from combat events.
const emptyStats = () => ({ kos: 0, falls: 0, dealt: 0, best: 0 });
export function cleanInput(raw) {
  const axis = v => Number.isFinite(v) ? clamp(v, -1, 1) : 0;
  return { x: axis(raw?.x), y: axis(raw?.y),
    held: ACTIONS.filter(a => Array.isArray(raw?.held) && raw.held.includes(a)),
    taps: Object.fromEntries(ACTIONS.map(a => [a, Number.isSafeInteger(raw?.taps?.[a]) ? raw.taps[a] >>> 0 : 0])) };
}
// Preserve combat's hit-target Sets, Maps and infinite timers through JSON.
export const pack = value => JSON.stringify(value, (key, v) =>
  v instanceof Set ? { $set: [...v] } : v instanceof Map ? { $map: [...v] } :
    typeof v === 'number' && !Number.isFinite(v) ? { $number: String(v) } : v);
export const unpack = value => JSON.parse(value, (key, v) =>
  v?.$set ? new Set(v.$set) : v?.$map ? new Map(v.$map) : v?.$number ? Number(v.$number) : v);

export class Bash {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0; this.options = defaultOptions(); this.players = [];
    this.phase = 'lobby'; this.round = 0; this.winner = null;
    this.combat = null; this.cpu = null; this.previous = {}; this.accumulator = 0; this.stats = [];
  }
  configure(patch) {
    const next = this.phase === 'lobby' && roomOptions(this.options, patch);
    if (!next) return false;
    this.options = next; return true;
  }
  addPlayer(id, name, avatar = {}) {
    const known = this.players.find(p => p.id === id);
    if (known) return Object.assign(known, { name, avatar });
    const bot = this.players.find(p => p.bot);
    if (bot) { Object.assign(bot, { id, name, avatar, bot: false }); return bot; }
    if (this.players.length >= 6 || this.phase !== 'lobby') return null;
    const p = { id, name, avatar, bot: false, style: 0, pana: PANA_IDS[this.players.length % PANA_IDS.length], traje: 0 };
    this.players.push(p); return p;
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id);
    if (this.phase !== 'lobby' && p) Object.assign(p, { id: 1000 + this.players.indexOf(p), name: 'Coco', bot: true });
    else this.players = this.players.filter(p => p.id !== id);
    delete this.previous[id];
  }
  choose(id, style) {
    const p = this.players.find(p => p.id === id);
    if (this.phase !== 'lobby' || !p || !Number.isInteger(style) || !STYLES[style]) return false;
    p.style = style; return true;
  }
  choosePana(id, pana, traje = 0) {
    const p = this.players.find(p => p.id === id);
    if (this.phase !== 'lobby' || !p || !PANA_IDS.includes(pana) || ![0, 1, 2].includes(traje)) return false;
    p.pana = pana; p.traje = traje; return true;
  }
  start() {
    if (!this.players.length) return;
    while (this.players.length < this.options.seats) {
      const slot = this.players.length;
      const pana = PANA_IDS[(this.seed + this.round * 7 + slot * 5) % PANA_IDS.length];
      this.players.push({ id: 1000 + slot, name: ['Coco', 'Mango', 'Papel', 'Tinta', 'Guayaba', 'Cacao'][slot], avatar: {}, bot: true, style: slot % STYLES.length, pana, traje: slot % 3 });
    }
    const config = { players: this.players.map((p, slot) => ({ slot, name: p.name,
      fighter: fighterId(STYLES[p.style], p.pana), skin: '00', cpu: p.bot, cpuLevel: this.options.level })),
      stocks: this.options.stocks, timeLimitSeconds: this.options.seconds,
      items: this.options.items, itemFrequency: 'medium', stage: this.options.stage ?? 'verdant-grove' };
    this.combat = new CombatGame(config, { seed: this.seed + ++this.round, countdownFrames: 180 });
    this.cpu = this.players.map((_, slot) => new CpuController(slot, this.options.level, this.seed + this.round));
    this.phase = 'playing'; this.winner = null; this.previous = {}; this.accumulator = 0;
    this.stats = this.players.map(emptyStats);
  }
  lobby() { if (this.phase === 'finished') { this.phase = 'lobby'; this.combat = null; this.cpu = null; this.players = this.players.filter(p => !p.bot); } }
  frameInput(p, raw) {
    const input = cleanInput(raw), old = this.previous[p.id] ?? cleanInput(null);
    if (raw == null) input.taps = old.taps;
    const frame = createEmptyInput();
    frame.held = new Set(input.held);
    frame.pressed = new Set(ACTIONS.filter(a => (raw != null && input.taps[a] !== old.taps[a]) || (frame.held.has(a) && !old.held.includes(a))));
    frame.released = new Set(old.held.filter(a => !frame.held.has(a)));
    frame.direction = { x: input.x, y: input.y };
    this.previous[p.id] = input; return frame;
  }
  update(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return;
    this.accumulator += Math.min(1, Math.max(0, dt));
    // LiveRoom may run several catch-up slices before publishing. Keep a bounded
    // history so events from the earlier slices travel with the final snapshot.
    const events = [...this.combat.events];
    while (this.accumulator + 1e-9 >= 1 / 60 && this.phase === 'playing') {
      this.accumulator = Math.max(0, this.accumulator - 1 / 60);
      const view = this.combat.getSnapshot();
      const frames = this.players.map((p, slot) => p.bot ? this.cpu[slot].next(view) : this.frameInput(p, inputs.get(p.id)));
      const next = this.combat.step(frames); events.push(...next.events); this.tally(next.events);
      if (next.phase === 'finished') { this.phase = 'finished'; this.winner = this.players[next.winner]?.id ?? null; }
    }
    this.combat.events = events.filter(e => e.frame > this.combat.frame - 120).slice(-96);
  }
  tally(events) {
    for (const e of events) {
      if (e.type === 'hit' && this.stats[e.slot] && e.slot !== e.target) {
        const s = this.stats[e.slot]; s.dealt += e.damage ?? 0; s.best = Math.max(s.best, e.damage ?? 0);
      }
      if (e.type === 'ko' && this.stats[e.slot]) {
        this.stats[e.slot].falls++;
        if (this.stats[e.target] && e.target !== e.slot) this.stats[e.target].kos++;
      }
    }
  }
  snapshot() {
    return { seed: this.seed, options: { ...this.options }, players: structuredClone(this.players),
      phase: this.phase, round: this.round, winner: this.winner,
      stats: this.stats.map(s => ({ kos: s.kos, falls: s.falls, dealt: Math.round(s.dealt), best: Math.round(s.best) })),
      fight: this.combat?.getSnapshot() ?? null,
      checkpoint: this.combat ? pack({ combat: this.combat, cpu: this.cpu, previous: this.previous, accumulator: this.accumulator, stats: this.stats }) : null };
  }
  static restore(state, members) {
    const game = Object.assign(new Bash(state.seed), { options: { ...state.options }, players: structuredClone(state.players), phase: state.phase, round: state.round, winner: state.winner });
    if (state.checkpoint) {
      const saved = unpack(state.checkpoint);
      game.combat = new CombatGame(saved.combat.config, saved.combat.options);
      const random = Object.assign(game.combat.random, saved.combat.random);
      Object.assign(game.combat, saved.combat, { random });
      game.cpu = saved.cpu.map((data, slot) => { const cpu = new CpuController(slot, data.level); const random = Object.assign(cpu.random, data.random); return Object.assign(cpu, data, { random }); });
      game.previous = saved.previous; game.accumulator = saved.accumulator; game.stats = saved.stats ?? game.players.map(emptyStats);
    }
    for (const p of [...game.players]) if (!p.bot && !members.has(p.id)) game.removePlayer(p.id);
    return game;
  }
}
