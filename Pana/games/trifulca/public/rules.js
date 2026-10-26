// Trifulca: the night around the fights. Pure rules, plain data in and out
// (no DOM, no Three.js), so the host, the screen and Node tests share them.
// Four ways to run the night (options.modo):
//   queda    ganador se queda: two fight, the winner stays, the queue moves
//   libre    trifulca libre: up to four in the ring with chairs and crates
//   parejas  two against two, tag your partner from the corner
//   torneo   a bracket of 4 or 8 with the final under the tent
// Whoever isn't fighting is the ring: they shove fighters back in, bet
// dolitas and give water in the corner. fight-rules.js owns the punches,
// bot-rules.js the bots.
import { draw, clamp, seedOf } from '/engine/random.js';
import { defaultOptions, roomOptions } from './options.js';
import { locKey } from '../../../engine/i18n.js';
import { arenaOf, newBody, control, presses, stepBodies, edge, crowdSpot, scorecard, setAct, addMareo, knockDown, inRing, facing, CORNERS, MAREO_CALMA } from './fight-rules.js';
import { botInput } from './bot-rules.js';

// Alone, ganador se queda is a ladder: you against five rivals, each one
// tougher (bot level), and three losses end the night.
export const LADDER = [0, 0, 1, 1, 2], LADDER_LIVES = 3;
// The tutorial: one step per move, each finished by what you do in the ring.
export const TUTORIAL = [
  { id: 'mover', need: 1 }, { id: 'jab', need: 3 }, { id: 'trompon', need: 1 }, { id: 'cubrir', need: 2 },
  { id: 'esquivar', need: 2 }, { id: 'contra', need: 1 }, { id: 'agarrar', need: 1 }, { id: 'pararse', need: 1 },
];
export const TUTORIAL_COUNTER_WINDOW = 2;
// Nobody in the crowd stands between the camera and the fight.
export const CROWD_GAP = 1.15;
const clampCrowd = (a) => Math.abs(a) < CROWD_GAP ? Math.sign(a || 1) * CROWD_GAP : a;
export const INTRO = 6.5, AFTER = 7, START_DOLITAS = 50, STAKE = 10, BOT_SEAT = 1000, MAX_EVENTS = 40;
export const PAY = { win: 10, ko: 6, streak: 3, mano: 3, shove: 2, calma: 4, agua: 1, title: 15 };
// Names, ring nicknames and hometowns are names: they stay Spanish.
export const BOT_NAMES = ['Cheo', 'Lola', 'Toño', 'Nena', 'Pepe', 'Mari', 'Coco', 'Cuqui']; // i18n-ignore
export const NICKS = ['El Trompa', 'La Metralla', 'El Ciclón', 'Puño de Mango', 'El Chamo Bravo', 'La Chancleta', 'El Huracán', // i18n-ignore
  'Quijada de Hierro', 'El Tumbacocos', 'La Pimienta', 'El Pelúo', 'Cabeza de Coco', 'El Rayo del Llano', 'La Avispa']; // i18n-ignore
export const FROM = ['de Maracaibo', 'de Catia', 'de Petare', 'de Barquisimeto', 'de Valencia', 'de Maturín', 'de Puerto La Cruz', // i18n-ignore
  'de Mérida', 'de Coro', 'de Cumaná', 'de San Félix', 'de La Guaira', 'de Barinas', 'de Margarita']; // i18n-ignore
// Things lying around in a trifulca libre: a swing hits harder, a throw flies.
export const PROPS = ['silla', 'caja', 'casco', 'chancleta'];
export const THROW = { speed: 9.5, range: 7, mareo: 22, push: 5, radius: .55 };

// What a member may send each tick: a world-space stick, two held buttons and
// press counters (a tap shorter than a tick still counts).
export function cleanInput(raw) {
  const axis = (v) => Number.isFinite(v) ? clamp(v, -1, 1) : 0;
  const count = (v) => Number.isInteger(v) ? ((v % 256) + 256) % 256 : 0;
  return { x: axis(raw?.x), z: axis(raw?.z), g: raw?.g === true, b: raw?.b === true,
    gp: count(raw?.gp), e: count(raw?.e), a: count(raw?.a), t: count(raw?.t), k: count(raw?.k), s: count(raw?.s), v: count(raw?.v) };
}

const stats = () => ({ wins: 0, streak: 0, best: 0, kos: 0, caidas: 0, trompones: 0, manos: 0, skipped: 0, betWon: 0, shoves: 0, calmas: 0, agua: 0, fights: 0, throws: 0 });
const NO_PRESS = { gp: 0, e: 0, a: 0, t: 0, k: 0, s: 0, v: 0 };

export class Trifulca {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = []; this.queue = []; this.bodies = []; this.props = [];
    this.phase = 'lobby'; this.time = 0; this.fightNo = 0; this.champion = null; this.champions = [];
    this.result = null; this.titles = []; this.events = []; this.eventSeq = 0;
    this.fight = null; this.round = 0; this.bracket = null; this.arenaNow = null; this.nextProp = 1;
  }

  snapshot() { return JSON.parse(JSON.stringify(this)); }
  configure(patch) { const next = this.phase === 'lobby' && roomOptions(this.options, patch); if (!next) return false; this.options = next; return true; }
  get arena() { return arenaOf(this.arenaNow || this.options.arena); }
  get mode() { return this.options.modo; }

  // A new host continues from the last snapshot without the panas who left.
  static restore(state, members) {
    const game = Object.assign(new Trifulca(), JSON.parse(JSON.stringify(state)));
    for (const p of [...game.players]) if (!p.bot && !members.has(p.id)) game.removePlayer(p.id);
    return game;
  }

  emit(event) {
    this.events.push({ n: ++this.eventSeq, ...event });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }
  player(id) { return this.players.find(p => p.id === id); }
  body(id) { return this.bodies.find(b => b.id === id); }
  fighting(id) { return ['intro', 'fight', 'after'].includes(this.phase) && this.bodies.some(b => b.id === id); }
  corners() { return [...new Set(this.bodies.map(b => b.team))]; }

  addPlayer(id, name, avatar = {}, bot = false) {
    const known = this.player(id);
    if (known) return Object.assign(known, { name, avatar });
    const h = seedOf(`${name}:${id}`);
    const player = { id, name, avatar, bot, nick: NICKS[h % NICKS.length], from: FROM[(h >>> 8) % FROM.length],
      dolitas: START_DOLITAS, stats: stats(), angle: 0, last: {}, cd: 0, bet: null, water: false, mano: false, carry: 0 };
    this.players.push(player);
    if (this.phase !== 'lobby' && this.phase !== 'finished') { this.queue.push(id); this.placeCrowd(); }
    return player;
  }

  removePlayer(id) {
    if (!this.player(id)) return;
    this.queue = this.queue.filter(q => q !== id);
    this.champions = this.champions.filter(c => c !== id);
    if (this.champion === id) this.champion = null;
    const body = this.body(id);
    if (body && this.phase === 'fight') {
      this.players = this.players.filter(p => p.id !== id);
      this.knockOut(body, null, 'abandono');
      return;
    }
    this.players = this.players.filter(p => p.id !== id);
    if (body && this.phase === 'intro') { this.fightNo--; this.refund(); this.beginIntro(true); }
  }

  // Bots join the queue when there are few panas: alone you get a ladder of
  // three; two panas fight each other straight while NPC neighbours watch.
  // Parejas needs four and a torneo four or eight.
  botCount(humans) {
    const wanted = this.options.rivales, mode = this.mode;
    if (mode === 'queda' && humans === 1 && wanted < 0) return LADDER.length;
    if (mode === 'parejas') return Math.max(wanted < 0 ? 0 : wanted, 4 - humans, humans % 2);
    if (mode === 'torneo') return Math.max(wanted < 0 ? 0 : wanted, (humans <= 4 ? 4 : 8) - humans);
    if (mode === 'libre' && wanted < 0) return Math.max(0, 4 - humans);
    if (wanted >= 0) return wanted;
    return humans <= 1 ? 3 : humans === 2 ? 0 : humans < 4 ? 1 : 0;
  }

  start(withBots = true) {
    this.players = this.players.filter(p => !p.bot);
    const humans = this.players.length;
    for (let i = 0, n = withBots ? this.botCount(humans) : 0; i < n || this.players.length < 2; i++) {
      this.addPlayer(BOT_SEAT + i, BOT_NAMES[i % BOT_NAMES.length], {}, true);
    }
    for (const p of this.players) Object.assign(p, { dolitas: START_DOLITAS, stats: stats(), bet: null, carry: 0, last: {} });
    // Panas first in a random order, then the bots.
    const order = this.players.map(p => ({ id: p.id, k: (p.bot ? 1 : 0) + draw(this) * .9 }));
    this.queue = order.sort((a, b) => a.k - b.k).map(o => o.id);
    Object.assign(this, { champion: null, champions: [], fightNo: 0, result: null, titles: [], events: [], round: this.round + 1, bracket: null, winner: null, tutorial: null });
    // Alone: a ladder of rivals, and the bots never fight each other.
    const humanIds = this.players.filter(p => !p.bot).map(p => p.id), bots = this.players.filter(p => p.bot);
    this.ladder = this.mode === 'queda' && humanIds.length === 1 && bots.length ? { me: humanIds[0], rivals: bots.map(b => b.id), step: 0, lives: LADDER_LIVES } : null;
    if (this.ladder) bots.forEach((b, i) => { b.level = Math.max(0, Math.min(2, (LADDER[i] ?? 2) + this.options.nivel - 1)); });
    if (this.mode === 'torneo') this.bracket = { rounds: [this.queue.slice(0, this.queue.length >= 8 ? 8 : 4)], round: 0, match: 0, next: [] };
    this.beginIntro();
  }

  // Who steps up next, by mode: [{ id, corner, team, bench }].
  lineup() {
    const ids = this.players.map(p => p.id), take = () => this.queue.shift();
    this.queue = this.queue.filter(id => ids.includes(id));
    const busy = new Set([...this.champions, this.champion].filter(id => id != null && ids.includes(id)));
    for (const id of ids) if (!this.queue.includes(id) && !busy.has(id)) this.queue.push(id);
    if (this.mode === 'torneo') {
      const b = this.bracket, round = b.rounds[b.round];
      return [round[b.match * 2], round[b.match * 2 + 1]].map((id, i) => ({ id, corner: CORNERS[i], team: CORNERS[i] }));
    }
    if (this.mode === 'parejas') {
      const stay = this.champions.filter(id => ids.includes(id));
      while (stay.length < 2 && this.queue.length) stay.push(take());
      const challengers = [take(), take()].filter(id => id != null);
      return [...stay.map((id, i) => ({ id, corner: 'red', team: 'red', bench: i > 0 })), ...challengers.map((id, i) => ({ id, corner: 'blue', team: 'blue', bench: i > 0 }))];
    }
    if (this.ladder) {
      const rival = this.ladder.rivals[this.ladder.step];
      return [{ id: this.ladder.me, corner: 'red', team: 'red' }, { id: rival, corner: 'blue', team: 'blue' }];
    }
    const champ = this.champion != null && ids.includes(this.champion) ? this.champion : null;
    const count = this.mode === 'libre' ? Math.min(4, ids.length) : 2;
    const list = champ != null ? [champ] : [];
    while (list.length < count && this.queue.length) list.push(take());
    return list.map((id, i) => ({ id, corner: CORNERS[i], team: CORNERS[i] }));
  }

  refund() { for (const p of this.players) if (p.bet) { p.dolitas += p.bet.amount; p.bet = null; } }

  // The next fighters step up for their intro.
  beginIntro() {
    if (this.mode === 'torneo') this.arenaNow = this.bracket && this.bracket.rounds[this.bracket.round].length === 2 ? 'toldo' : null;
    const arena = this.arena, line = this.lineup().filter(l => l.id != null);
    if (new Set(line.map(l => l.team)).size < 2) { this.phase = 'lobby'; return; }
    this.bodies = line.map(l => Object.assign(newBody(l.id, l.corner, arena, l.team), { bench: !!l.bench }));
    for (const b of this.bodies.filter(x => x.bench)) this.benchSpot(b);
    // The champion carries a little of the last fight; a long streak gives the challenger a boost.
    const champ = this.player(this.champion);
    const champBody = this.mode === 'queda' || this.mode === 'libre' ? this.body(this.champion) : null;
    if (champBody && champ) champBody.mareo = Math.round(champ.carry * .35) + (champ.stats.streak >= 3 ? 25 : 0);
    this.refund();
    for (const p of this.players) Object.assign(p, { water: false, mano: false, cd: 0 });
    this.fightNo++;
    this.props = this.mode === 'libre' ? this.spawnProps(arena) : [];
    const streak = champBody && champ ? champ.stats.streak : 0;
    this.fight = { time: this.options.seconds, hype: Object.fromEntries(this.corners().map(c => [c, 0])), calma: false, close: 0,
      moto: ['moto', 'toro', 'balde', 'pito'].includes(arena.twist) ? 14 + draw(this) * Math.max(4, this.options.seconds - 24) : -1, motoDone: false,
      odds: this.odds(streak), streak, champion: champBody ? this.champion : null, stage: this.stage(), out: [] };
    this.placeCrowd();
    this.phase = 'intro'; this.time = INTRO; this.result = null;
    this.emit({ type: 'intro', ids: this.bodies.map(b => b.id), red: this.bodies[0].id, blue: this.bodies.find(b => b.team !== this.bodies[0].team)?.id,
      fight: this.fightNo, streak, mode: this.mode, stage: this.fight.stage });
  }

  // The tutorial: you and the profe alone in the ring, no bell, one move at a
  // time. The profe does what each step needs (stands still, jabs, winds up,
  // blocks) and nobody can lose.
  startTutorial(id) {
    const me = this.player(id); if (!me) return false;
    this.players = this.players.filter(p => !p.bot);
    const profe = this.addPlayer(BOT_SEAT, 'Profe Cheo', {}, true);
    profe.nick = 'El Profe'; profe.level = 0; // i18n-ignore
    for (const p of this.players) Object.assign(p, { dolitas: START_DOLITAS, stats: stats(), bet: null, carry: 0, last: {} });
    const arena = this.arena;
    this.bodies = [newBody(id, 'red', arena), newBody(profe.id, 'blue', arena)];
    Object.assign(this.bodies[0], { x: -2.6 }); Object.assign(this.bodies[1], { x: 1.6 });
    Object.assign(this, { ladder: null, bracket: null, champion: null, champions: [], props: [], fightNo: 1, result: null, titles: [], events: [], winner: null });
    this.fight = { time: 999, hype: { red: 0, blue: 0 }, calma: true, close: 0, moto: -1, motoDone: true, odds: { red: 2, blue: 2 }, streak: 0, champion: null, stage: null, out: [] };
    this.tutorial = { me: id, profe: profe.id, step: 0, count: 0, clock: 0, done: false };
    this.placeCrowd();
    this.phase = 'fight'; this.time = 999;
    this.emit({ type: 'tutorial', step: 0 });
    return true;
  }

  // Counts what you did toward the current tutorial step.
  tutorialEvent(e) {
    const t = this.tutorial; if (!t || t.done) return;
    const step = TUTORIAL[t.step], me = t.me;
    if (step.id === 'contra' && e.type === 'dodged' && e.id === me) {
      this.body(me).contra = TUTORIAL_COUNTER_WINDOW;
    }
    const hit = (kind) => e.type === kind && e.by === me;
    const counts = { mover: false, jab: hit('hit') && (!e.move || e.move === 'jab') && !e.counter, trompon: hit('trompon'), cubrir: e.type === 'block' && e.id === me,
      esquivar: e.type === 'dodged' && e.id === me, contra: (e.type === 'hit' || e.type === 'trompon') && e.by === me && e.contra,
      agarrar: e.type === 'shove' && e.by === me, pararse: e.type === 'rise' && e.id === me }[step.id];
    if (counts) this.tutorialCount();
  }
  tutorialCount() {
    const t = this.tutorial; t.count++;
    if (t.count < TUTORIAL[t.step].need) { this.emit({ type: 'tutorial-bien', step: t.step, count: t.count }); return; }
    t.step++; t.count = 0; t.clock = 0;
    if (t.step >= TUTORIAL.length) { t.done = true; this.emit({ type: 'tutorial-fin' }); return; }
    this.emit({ type: 'tutorial', step: t.step });
    // Reset the ring for the next move.
    const [me, profe] = this.bodies;
    for (const b of this.bodies) Object.assign(b, { mareo: 0, caidas: 0, act: 'idle', at: 0, vx: 0, vz: 0, down: null, aguante: 100 });
    Object.assign(me, { x: -.7, z: 0 }); Object.assign(profe, { x: .7, z: 0 });
    if (TUTORIAL[t.step].id === 'pararse') { me.mareo = 100; knockDown(me, profe, (e) => this.fightEvent(e)); me.down.need = 6; }
  }
  tutorialTick(dt) {
    const t = this.tutorial; if (!t || t.done) return;
    t.clock += dt;
    const [me, profe] = this.bodies;
    // Nobody gets hurt for real while learning.
    for (const b of this.bodies) if (b.act !== 'down') b.mareo = Math.min(b.mareo, 60);
    if (me.act === 'dizzy') { me.act = 'idle'; me.at = 0; }
    if (me.down && me.down.count >= 8) me.down.count = 4;   // all the time you need to get up
    profe.caidas = 0; me.caidas = Math.min(me.caidas, 1);
    if (TUTORIAL[t.step].id === 'mover' && Math.hypot(me.x - profe.x, me.z - profe.z) < 1.6) this.tutorialCount();
  }

  // Torneo: which round this match is.
  stage() {
    if (this.mode !== 'torneo' || !this.bracket) return null;
    const n = this.bracket.rounds[this.bracket.round].length;
    return n === 2 ? 'final' : n === 4 ? 'semifinal' : 'cuartos';
  }

  // Upsets pay more: betting against a pana on a streak pays triple. In a
  // free-for-all the odds are the number of fighters.
  odds(streak) {
    const corners = this.corners(), base = corners.length;
    const odds = Object.fromEntries(corners.map(c => [c, base]));
    const champ = this.body(this.champion);
    if (streak >= 2 && champ) for (const c of corners) odds[c] = c === champ.team ? 1.5 : base + 1;
    return odds;
  }

  // The crowd spreads around the ring, away from the corners.
  placeCrowd() {
    const crowd = this.players.filter(p => !this.bodies.some(b => b.id === p.id));
    // The camera looks from +Z, so the ring stands at the two ends and across the back.
    crowd.forEach((p, i) => {
      const t = (i + .5) / Math.max(1, crowd.length);
      p.angle = clampCrowd(Math.PI + (t - .5) * 2 * (Math.PI - CROWD_GAP));
    });
  }

  // A partner waits on the apron by the team's corner.
  benchSpot(b) {
    const arena = this.arena, a = b.team === 'red' ? -Math.PI / 2 : Math.PI / 2;
    const r = arena.shape === 'square' ? arena.half + .9 : arena.r + .55, spot = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    Object.assign(b, { x: spot.x, z: spot.z, h: Math.atan2(-spot.x, -spot.z), vx: 0, vz: 0, act: 'idle' });
  }

  spawnProps(arena) {
    const r = arena.shape === 'square' ? arena.half * .7 : arena.r * .62;
    return [0, 1, 2, 3].map(i => {
      const a = Math.PI / 4 + i * Math.PI / 2 + (draw(this) - .5) * .5;
      return { id: this.nextProp++, kind: PROPS[(i + Math.floor(draw(this) * 4)) % PROPS.length], x: Math.sin(a) * r, z: Math.cos(a) * r, h: draw(this) * 6, held: null, fly: null };
    });
  }

  bet(id, corner) {
    const p = this.player(id);
    if (this.phase !== 'intro' || !p || this.fighting(id) || !this.corners().includes(corner)) return false;
    if (p.bet) p.dolitas += p.bet.amount;
    const amount = Math.min(STAKE, p.dolitas);
    if (amount <= 0) { p.bet = null; return false; }
    p.dolitas -= amount; p.bet = { on: corner, amount, odds: this.fight.odds[corner] };
    this.emit({ type: 'bet', id, corner, amount });
    return true;
  }

  update(dt, inputs = new Map()) {
    if (this.phase === 'lobby' || this.phase === 'finished') return;
    const arena = this.arena;
    // Everyone's buttons this tick (bots make their own).
    const moves = new Map(), pressed = new Map();
    for (const p of this.players) {
      const input = p.bot ? botInput(this, p, dt) : inputs.get(p.id) || cleanInput({ ...p.last, g: false, b: false });
      pressed.set(p.id, presses(p.last, input)); moves.set(p.id, input);
      p.cd = Math.max(0, p.cd - dt);
    }
    const crowd = () => this.players.filter(p => !this.fighting(p.id));
    if (this.phase === 'intro') {
      this.time -= dt;
      for (const p of crowd()) this.crowdStep(p, moves.get(p.id), pressed.get(p.id), dt, arena);
      if (this.time <= 0) {
        this.phase = 'fight'; this.time = this.options.seconds;
        this.emit({ type: 'bell', fight: this.fightNo });
      }
      return;
    }
    if (this.phase === 'after') {
      this.time -= dt;
      for (const b of this.bodies) {
        const p = this.player(b.id);
        if (p && pressed.get(p.id)?.a && !p.mano) { p.mano = true; this.emit({ type: 'mano-half', id: p.id }); this.checkMano(); }
        b.vx *= .9; b.vz *= .9;
      }
      if (this.time <= 0) this.closeAfter();
      return;
    }
    // The fight.
    const f = this.fight;
    if (!this.tutorial) { this.time -= dt; f.time = this.time; }
    this.tutorialTick(dt);
    for (const b of this.bodies) {
      if (!inRing(b)) { this.benchStep(b, dt); continue; }
      const press = { ...(pressed.get(b.id) || NO_PRESS) }, move = moves.get(b.id) || {};
      if (press.a && this.useProp(b) !== false) press.a = 0;
      if (press.a && this.tag(b)) press.a = 0;
      control(b, move, press, (e) => this.emitFight(e));
    }
    const kos = stepBodies(this.bodies, arena, dt, moves, (e) => this.fightEvent(e));
    // One on one the fight stays on a line across the camera, like a fighting
    // game: a sidestep (W/S, a dodge) moves off it and the line pulls you back.
    const duel = this.bodies.filter(inRing);
    if (duel.length === 2) for (const b of duel) if (b.act !== 'dodge') b.z -= b.z * Math.min(1, dt * 2.2);
    this.stepProps(dt, arena);
    for (const p of crowd()) this.crowdStep(p, moves.get(p.id), pressed.get(p.id), dt, arena);
    if (this.phase !== 'fight') return;   // a ¡cálmate! ended it
    this.ringEdge(arena, dt);
    this.twists(dt);
    for (const k of kos) {
      if (this.phase !== 'fight' || this.tutorial) break;
      this.knockOut(this.body(k.ko), k.by, k.how);
    }
    if (this.phase === 'fight' && this.time <= 0 && !this.tutorial) this.bell();
  }

  fightEvent(e) {
    this.tutorialEvent(e);
    if (['hit', 'trompon', 'caida', 'shove'].includes(e.type) && this.fight) this.fight.close = 0;
    if (e.type === 'caida') { const p = this.player(e.id); if (p) p.stats.caidas++; }
    this.emit(e);
  }
  emitFight(e) { this.tutorialEvent(e); this.emit(e); }

  // Parejas: the partner on the apron gets their breath back; tag them in by
  // pressing agarrar next to them.
  benchStep(b, dt) {
    if (b.out) return;
    b.mareo = Math.max(0, b.mareo - 12 * dt); b.aguante = Math.min(100, b.aguante + 30 * dt);
    this.benchSpot(b);
  }
  tag(b) {
    if (this.mode !== 'parejas') return false;
    const partner = this.bodies.find(o => o.team === b.team && o.bench && !o.out);
    if (!partner || Math.hypot(partner.x - b.x, partner.z - b.z) > 2.2 || ['down', 'dizzy', 'rise', 'kick', 'sweep', 'toss', 'tumble'].includes(b.act)) return false;
    const { x, z, h } = b;
    partner.bench = false; Object.assign(partner, { x: x * .85, z: z * .85, h, act: 'idle', at: 0, inv: .5 });
    b.bench = true; b.charge = -1; this.benchSpot(b);
    this.emit({ type: 'relevo', id: partner.id, from: b.id });
    return true;
  }

  // Trifulca libre: agarrar picks up a chair or a crate within reach, or
  // throws the one in your hands. Returns false when it does neither.
  useProp(b) {
    if (this.mode !== 'libre' || ['down', 'dizzy', 'stun', 'rise', 'kick', 'sweep', 'toss', 'tumble'].includes(b.act)) return false;
    if (b.prop) {
      const prop = this.props.find(p => p.id === b.prop);
      b.prop = null;
      if (!prop) return false;
      const { fx, fz } = facing(b);
      Object.assign(prop, { held: null, x: b.x + fx * .6, z: b.z + fz * .6, fly: { vx: fx * THROW.speed, vz: fz * THROW.speed, by: b.id, left: THROW.range } });
      setAct(b, 'throw'); this.player(b.id) && this.player(b.id).stats.throws++;
      this.emit({ type: 'throw', id: b.id, prop: prop.id, kind: prop.kind });
      return true;
    }
    const near = this.props.filter(p => !p.held && !p.fly).map(p => ({ p, d: Math.hypot(p.x - b.x, p.z - b.z) })).filter(o => o.d < 1.2).sort((x, y) => x.d - y.d)[0];
    const foeClose = this.bodies.some(o => o.team !== b.team && inRing(o) && Math.hypot(o.x - b.x, o.z - b.z) < 1.3);
    if (!near || foeClose) return false;
    near.p.held = b.id; b.prop = near.p.id;
    this.emit({ type: 'pickup', id: b.id, prop: near.p.id, kind: near.p.kind });
    return true;
  }

  stepProps(dt, arena) {
    for (const prop of this.props) {
      const holder = prop.held != null ? this.body(prop.held) : null;
      if (holder) {
        if (!inRing(holder) || holder.act === 'down') { holder.prop = null; prop.held = null; }
        else { const { fx, fz } = facing(holder); prop.x = holder.x + fx * .45; prop.z = holder.z + fz * .45; prop.h = holder.h; continue; }
      }
      if (!prop.fly) continue;
      const step = Math.hypot(prop.fly.vx, prop.fly.vz) * dt;
      prop.x += prop.fly.vx * dt; prop.z += prop.fly.vz * dt; prop.h += dt * 9; prop.fly.left -= step;
      const target = this.bodies.find(o => inRing(o) && o.id !== prop.fly.by && o.act !== 'down' && o.act !== 'rise' && o.inv <= 0
        && Math.hypot(o.x - prop.x, o.z - prop.z) < THROW.radius && !(o.act === 'dodge' && o.at < .34));
      if (target) {
        const n = Math.hypot(prop.fly.vx, prop.fly.vz) || 1, thrower = this.body(prop.fly.by);
        target.vx += prop.fly.vx / n * THROW.push; target.vz += prop.fly.vz / n * THROW.push; target.lastHit = 0;
        this.emit({ type: 'impacto', id: target.id, by: prop.fly.by, kind: prop.kind, x: prop.x, z: prop.z });
        if (target.act === 'dizzy' && thrower) knockDown(target, thrower, (e) => this.fightEvent(e));
        else { addMareo(target, THROW.mareo, (e) => this.fightEvent(e)); if (target.act !== 'dizzy') { setAct(target, 'stun'); target.stun = .6; } }
        if (thrower) thrower.score.trompones++;
        prop.fly = null;
      } else if (prop.fly.left <= 0) prop.fly = null;
      // Whatever lands in the crowd comes back in.
      const e = edge(arena, prop.x, prop.z);
      if (!prop.fly && e.out > -.4) { const k = (arena.shape === 'square' ? arena.half : arena.r) * .5; const a = draw(this) * Math.PI * 2; prop.x = Math.sin(a) * k; prop.z = Math.cos(a) * k; this.emit({ type: 'devuelto', prop: prop.id }); }
    }
  }

  // A fighter is beaten: in a free-for-all they leave the ring, otherwise
  // the fight is over (parejas: the whole team loses).
  knockOut(body, byId, how, calmedBy = null) {
    if (!body || this.phase !== 'fight') return;
    if (this.mode === 'libre') {
      body.out = true; if (body.prop) { const prop = this.props.find(p => p.id === body.prop); if (prop) prop.held = null; body.prop = null; }
      this.fight.out.push(body.id);
      this.emit({ type: 'fuera', id: body.id, by: byId, how });
      const left = this.bodies.filter(b => !b.out);
      if (left.length > 1) return;
      return this.endFight(left.map(b => b.id), [...this.fight.out].reverse(), how, calmedBy);
    }
    const losers = this.mode === 'parejas' ? this.bodies.filter(b => b.team === body.team).map(b => b.id) : [body.id];
    const winners = this.bodies.filter(b => !losers.includes(b.id)).map(b => b.id);
    this.endFight(winners, losers, how, calmedBy);
  }

  // The human ring: out of the circle, whoever is near shoves you back in.
  // If no pana does it in half a second, a neighbour does.
  ringEdge(arena, dt) {
    if (arena.shape === 'square') return;
    for (const b of this.bodies.filter(inRing)) {
      const e = edge(arena, b.x, b.z);
      if (e.out > .1) {
        if (b.outside === 0) this.emit({ type: 'out', id: b.id, angle: Math.atan2(b.x, b.z) });
        b.outside += dt;
        if (b.outside > .55) {
          b.vx = e.nx * 5; b.vz = e.nz * 5; b.outside = 0;
          if (b.act !== 'down') { setAct(b, 'stun'); b.stun = .3; }
          this.emit({ type: 'vecino', id: b.id, angle: Math.atan2(b.x, b.z) });
        }
      } else b.outside = 0;
    }
  }

  twists(dt) {
    const f = this.fight, ring = this.bodies.filter(inRing), arena = this.arena;
    // Each arena's twist, once per fight.
    if (f.moto > 0 && !f.motoDone && this.options.seconds - this.time >= f.moto && ring.length >= 2) {
      f.motoDone = true;
      const twist = arena.twist, mx = ring.reduce((n, b) => n + b.x, 0) / ring.length, mz = ring.reduce((n, b) => n + b.z, 0) / ring.length;
      const knock = (body, vx, vz, stun, mareo = 0) => {
        if (body.act === 'down') return;
        body.vx += vx; body.vz += vz; if (mareo) addMareo(body, mareo, (e) => this.fightEvent(e));
        if (body.act !== 'rise' && body.act !== 'dizzy') { setAct(body, 'stun'); body.stun = stun; }
      };
      if (twist === 'moto' && ring.length === 2) {
        // La calle: a moto passes through the fight and splits it.
        const [a, b] = ring, side = b.x >= a.x ? 1 : -1;
        knock(a, -side * 5.5, 0, .4); knock(b, side * 5.5, 0, .4);
        this.emit({ type: 'moto', x: mx, dir: draw(this) < .5 ? 1 : -1 });
      } else if (twist === 'toro') {
        // La manga: the bull gate swings open and a bull charges across.
        const dir = draw(this) < .5 ? 1 : -1;
        for (const b of ring) if (Math.abs(b.z - mz) < 1.5) knock(b, dir * 3, Math.sign(b.z - mz || 1) * 6.5, .55, 10);
        this.emit({ type: 'toro', z: mz, dir });
      } else if (twist === 'balde') {
        // La colonial: a señora on a balcony empties a bucket on the fighter nearest her.
        const side = draw(this) < .5 ? 1 : -1, target = [...ring].sort((a, b) => side * (b.z - a.z))[0];
        if (target) { target.mareo = Math.max(0, target.mareo - 12); knock(target, 0, -side * 2, .35); this.emit({ type: 'balde', id: target.id, side }); }
      } else if (twist === 'pito') {
        // El paso de cebra: a bus honks; the crowd jumps and everybody stops a beat.
        for (const b of ring) knock(b, 0, 0, .25);
        this.emit({ type: 'pito', dir: draw(this) < .5 ? 1 : -1 });
      }
    }
    // Clinch: too long hugging without a clean hit and the ref splits them.
    if (ring.length !== 2) return;
    const [a, b] = ring, d = Math.hypot(a.x - b.x, a.z - b.z);
    f.close = d < 1.05 ? f.close + dt : 0;
    if (f.close > 2.6) {
      f.close = 0;
      const nx = (b.x - a.x) / (d || 1), nz = (b.z - a.z) / (d || 1);
      a.vx -= nx * 4; a.vz -= nz * 4; b.vx += nx * 4; b.vz += nz * 4;
      this.emit({ type: 'clinch' });
    }
  }

  // A pana in the crowd: walk around the ring, shove, give water, ¡cálmate!
  crowdStep(p, input, press, dt, arena) {
    if (!input) return;
    const tx = Math.cos(p.angle), tz = -Math.sin(p.angle), r = arena.shape === 'square' ? arena.half + 1.5 : arena.r + .95;
    p.angle += (input.x * tx + input.z * tz) * 3.4 / r * dt;
    p.angle = clampCrowd(Math.atan2(Math.sin(p.angle), Math.cos(p.angle)));
    const spot = crowdSpot(arena, p.angle), ring = this.bodies.filter(inRing);
    const nearest = ring.map(b => ({ b, d: Math.hypot(b.x - spot.x, b.z - spot.z) })).sort((x, y) => x.d - y.d)[0];
    if (press?.gp && this.phase === 'intro' && !p.water) {
      // Water and a towel for the fighter in the corner you stand by.
      if (nearest && nearest.d < 3.2) {
        p.water = true; nearest.b.mareo = Math.max(0, nearest.b.mareo - 15);
        p.dolitas += PAY.agua; p.stats.agua++;
        this.emit({ type: 'agua', id: nearest.b.id, by: p.id });
      }
    } else if (press?.gp && this.phase === 'fight' && p.cd <= 0) {
      p.cd = .8;
      const e = nearest && edge(arena, nearest.b.x, nearest.b.z);
      if (nearest && nearest.d < 2 && e.out > -1 && nearest.b.act !== 'down') {
        const b = nearest.b; b.vx = e.nx * 6.5; b.vz = e.nz * 6.5; b.outside = 0;
        if (b.act !== 'rise') { setAct(b, 'stun'); b.stun = .3; }
        const back = e.out > -.35;
        if (back) { p.dolitas += PAY.shove; p.stats.shoves++; }
        this.emit({ type: 'empujon', id: b.id, by: p.id, back });
      } else this.emit({ type: 'empuja-aire', by: p.id });
    }
    if (press?.a && this.phase === 'fight' && !this.fight.calma) {
      const body = ring.find(b => Math.hypot(b.x - spot.x, b.z - spot.z) < 2.6 && (b.mareo >= MAREO_CALMA || b.act === 'dizzy') && b.act !== 'down');
      if (body) {
        this.fight.calma = true; p.dolitas += PAY.calma; p.stats.calmas++;
        this.emit({ type: 'calma', id: body.id, by: p.id });
        this.knockOut(body, null, 'calma', p.id);
      }
    }
    if (press?.t && p.cd <= 0) {
      p.cd = 1.2;
      const corner = p.bet?.on || nearest?.b.team;
      if (this.fight && corner && corner in this.fight.hype) this.fight.hype[corner] += .5;
      this.emit({ type: 'cheer', by: p.id, corner });
    }
  }

  // The bell: the judges read the scorecard; a draw goes to the crowd.
  bell() {
    const teams = this.corners(), cards = {};
    for (const t of teams) {
      const members = this.bodies.filter(b => b.team === t);
      cards[t] = Math.round(members.reduce((n, b) => n + (b.out ? 0 : scorecard(b)), 0) * 10) / 10;
    }
    const standing = teams.filter(t => this.bodies.some(b => b.team === t && !b.out));
    const ranked = standing.sort((a, b) => cards[b] - cards[a]);
    let top = ranked[0], how = 'puntos';
    if (ranked.length > 1 && Math.abs(cards[ranked[0]] - cards[ranked[1]]) < 1) {
      how = 'publico';
      const cheer = (c) => this.fight.hype[c] + this.players.filter(p => p.bet?.on === c).length;
      const [x, y] = ranked, cx = cheer(x), cy = cheer(y);
      top = cx !== cy ? (cx > cy ? x : y) : draw(this) < .5 ? x : y;
    }
    this.emit({ type: 'campana', cards });
    const winners = this.bodies.filter(b => b.team === top).map(b => b.id);
    const losers = [...this.bodies.filter(b => b.team !== top && !b.out).map(b => b.id), ...[...this.fight.out].reverse()];
    this.endFight(winners, losers, how, null, cards);
  }

  endFight(winners, losers, how, by = null, cards = null) {
    if (this.phase !== 'fight' && this.phase !== 'intro') return;
    const ko = how === 'ko' || how === 'cuenta';
    cards ||= Object.fromEntries(this.corners().map(t => [t, Math.round(this.bodies.filter(b => b.team === t).reduce((n, b) => n + scorecard(b), 0) * 10) / 10]));
    const payouts = [];
    for (const id of winners) {
      const p = this.player(id), body = this.body(id);
      if (!p) continue;
      p.stats.wins++; p.stats.fights++; p.stats.streak++; p.stats.best = Math.max(p.stats.best, p.stats.streak);
      const pay = PAY.win + (ko ? PAY.ko : 0) + (p.stats.streak >= 2 ? PAY.streak * (p.stats.streak - 1) : 0);
      if (ko) p.stats.kos++;
      p.dolitas += pay; payouts.push({ id, amount: pay, why: 'pelea' });
      p.carry = body ? body.mareo : 0; p.stats.trompones += body?.thrown || 0;
    }
    for (const id of losers) {
      const p = this.player(id), body = this.body(id);
      if (!p) continue;
      p.stats.fights++; p.stats.streak = 0; p.carry = 0; p.stats.trompones += body?.thrown || 0;
      this.queue = this.queue.filter(q => q !== id); this.queue.push(id);
    }
    // Bets: the stake was taken when it was placed.
    const team = this.body(winners[0])?.team;
    for (const p of this.players) {
      if (!p.bet) continue;
      if (p.bet.on === team) {
        const back = Math.round(p.bet.amount * p.bet.odds);
        p.dolitas += back; p.stats.betWon += back - p.bet.amount; payouts.push({ id: p.id, amount: back, why: 'apuesta' });
      } else payouts.push({ id: p.id, amount: -p.bet.amount, why: 'apuesta' });
      p.bet = null;
    }
    // Alone: a win climbs the ladder, a loss costs a life.
    if (this.ladder) {
      if (winners.includes(this.ladder.me)) this.ladder.step++; else this.ladder.lives--;
    }
    // Who fights next.
    const alive = winners.filter(id => this.player(id));
    if (this.mode === 'parejas') { this.champions = alive; this.champion = alive[0] ?? null; }
    else if (this.mode === 'torneo') { this.bracket.next.push(alive[0] ?? null); this.champion = null; }
    else this.champion = alive[0] ?? null;
    const lead = this.player(winners[0]);
    let belt = this.mode !== 'torneo' && !!lead && lead.stats.streak === 3;
    const final = this.mode === 'torneo' && this.fight?.stage === 'final';
    if (final && lead) { belt = true; lead.dolitas += PAY.title; payouts.push({ id: lead.id, amount: PAY.title, why: 'cinturón' }); } // i18n-ignore: an id
    this.result = { winner: winners[0] ?? null, loser: losers[0] ?? null, winners, losers, team, how, by, cards, payouts, belt, final, streak: lead?.stats.streak || 0 };
    this.phase = 'after'; this.time = AFTER;
    for (const b of this.bodies) {
      if (b.prop) { const prop = this.props.find(p => p.id === b.prop); if (prop) prop.held = null; b.prop = null; }
      if (winners.includes(b.id) && !b.bench) setAct(b, 'win');
      else if (b.act !== 'down') setAct(b, 'idle');
    }
    this.emit({ type: 'fin', ...this.result });
  }

  checkMano() {
    const fighters = this.bodies.map(x => this.player(x.id)).filter(Boolean);
    if (fighters.some(p => !p.mano) || this.result?.mano) return;
    this.result.mano = true;
    for (const p of fighters) { p.dolitas += PAY.mano; p.stats.manos++; }
    this.emit({ type: 'mano', ids: fighters.map(p => p.id) });
  }

  closeAfter() {
    const skipped = this.bodies.map(b => this.player(b.id)).filter(p => p && !p.mano);
    if (!this.result?.mano) for (const p of skipped) { p.stats.skipped++; this.emit({ type: 'sinmano', id: p.id }); }
    if (this.mode === 'torneo') {
      const b = this.bracket, round = b.rounds[b.round];
      if (this.result?.final) return this.finish();
      b.match++;
      if (b.match * 2 >= round.length) { b.rounds.push(b.next.filter(id => id != null && this.player(id))); b.next = []; b.round++; b.match = 0; }
      if (b.rounds[b.round].length < 2) return this.finish();
      return this.beginIntro();
    }
    if (this.ladder) {
      if (this.ladder.step >= this.ladder.rivals.length || this.ladder.lives <= 0) return this.finish();
      return this.beginIntro();
    }
    if (this.fightNo >= this.options.peleas) return this.finish();
    this.beginIntro();
  }

  finish() {
    this.phase = 'finished'; this.time = 0;
    this.titles = titlesFor(this.players);
    const richest = [...this.players].sort((a, b) => b.dolitas - a.dolitas)[0];
    this.winner = richest?.id ?? null;
    if (this.ladder) { this.ladder.won = this.ladder.step >= this.ladder.rivals.length; if (this.ladder.won) this.winner = this.ladder.me; }
    this.emit({ type: 'noche', winner: this.winner, ladder: this.ladder });
  }
}

// End of the night: who earned which title.
export function titlesFor(players) {
  const best = (score, min = 1) => {
    const top = [...players].map(p => ({ p, v: score(p) })).sort((a, b) => b.v - a.v)[0];
    return top && top.v >= min ? top.p.id : null;
  };
  const list = [
    // Titles are locKey() source; the HUD shows them through loc().
    ['campeon', locKey('El campeón del barrio'), best(p => p.stats.best)],
    ['vidrio', locKey('El de la quijada de vidrio'), best(p => p.stats.caidas)],
    ['caballero', locKey('El caballero'), best(p => p.stats.skipped ? 0 : p.stats.manos)],
    ['apostador', locKey('El apostador'), best(p => p.stats.betWon)],
    ['pacificador', locKey('El pacificador'), best(p => p.stats.calmas * 3 + p.stats.shoves)],
    ['contodo', locKey('El que se fue con todo'), best(p => p.stats.trompones + p.stats.throws)],
  ];
  return list.filter(([, , id]) => id != null).map(([key, title, id]) => ({ key, title, id }));
}
