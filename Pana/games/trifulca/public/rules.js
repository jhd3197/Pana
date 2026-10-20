// Trifulca: the night around the fights. Pure rules, plain data in and out
// (no DOM, no Three.js), so the host, the screen and Node tests share them.
// Ganador se queda: two panas fight, the winner stays, the queue moves; the
// rest are the ring (they shove fighters back in), bet dolitas and give the
// corner. fight-rules.js owns the punches.
import { draw, clamp, seedOf } from '/engine/random.js';
import { defaultOptions, roomOptions } from './options.js';
import { arenaOf, newBody, control, presses, stepBodies, edge, crowdSpot, scorecard, setAct, MAREO_CALMA } from './fight-rules.js';

export const INTRO = 6.5, AFTER = 7, START_DOLITAS = 50, STAKE = 10, BOT_SEAT = 1000, MAX_EVENTS = 40;
export const PAY = { win: 10, ko: 6, streak: 3, mano: 3, shove: 2, calma: 4, agua: 1 };
export const BOT_NAMES = ['Cheo', 'Lola', 'Toño', 'Nena', 'Pepe', 'Mari', 'Coco', 'Cuqui'];
export const NICKS = ['El Trompa', 'La Metralla', 'El Ciclón', 'Puño de Mango', 'El Chamo Bravo', 'La Chancleta', 'El Huracán',
  'Quijada de Hierro', 'El Tumbacocos', 'La Pimienta', 'El Pelúo', 'Cabeza de Coco', 'El Tren de Aragua', 'La Avispa'];
export const FROM = ['de Maracaibo', 'de Catia', 'de Petare', 'de Barquisimeto', 'de Valencia', 'de Maturín', 'de Puerto La Cruz',
  'de Mérida', 'de Coro', 'de Cumaná', 'de San Félix', 'de La Guaira', 'de Barinas', 'de Margarita'];

// What a member may send each tick: a world-space stick, two held buttons and
// press counters (a tap shorter than a tick still counts).
export function cleanInput(raw) {
  const axis = (v) => Number.isFinite(v) ? clamp(v, -1, 1) : 0;
  const count = (v) => Number.isInteger(v) ? ((v % 256) + 256) % 256 : 0;
  return { x: axis(raw?.x), z: axis(raw?.z), g: raw?.g === true, b: raw?.b === true,
    gp: count(raw?.gp), e: count(raw?.e), a: count(raw?.a), t: count(raw?.t) };
}

const stats = () => ({ wins: 0, streak: 0, best: 0, kos: 0, caidas: 0, trompones: 0, manos: 0, skipped: 0, betWon: 0, shoves: 0, calmas: 0, agua: 0, fights: 0 });

export class Trifulca {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = []; this.queue = []; this.bodies = [];
    this.phase = 'lobby'; this.time = 0; this.fightNo = 0; this.champion = null;
    this.result = null; this.titles = []; this.events = []; this.eventSeq = 0;
    this.fight = null; this.round = 0;
  }

  snapshot() { return JSON.parse(JSON.stringify(this)); }
  configure(patch) { const next = this.phase === 'lobby' && roomOptions(this.options, patch); if (!next) return false; this.options = next; return true; }
  get arena() { return arenaOf(this.options.arena); }

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
  fighting(id) { return this.phase !== 'lobby' && this.bodies.some(b => b.id === id); }

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
    const leaving = this.player(id); if (!leaving) return;
    this.queue = this.queue.filter(q => q !== id);
    if (this.champion === id) this.champion = null;
    const body = this.body(id);
    if (body && this.phase === 'fight') {
      const other = this.bodies.find(b => b.id !== id);
      this.endFight(other.id, id, 'abandono');
    } else if (body && this.phase === 'intro') {
      this.players = this.players.filter(p => p.id !== id);
      this.fightNo--; this.beginIntro(); return;
    }
    this.players = this.players.filter(p => p.id !== id);
  }

  // Bots join the queue when there are few panas: alone you get a ladder of
  // three; two panas fight each other straight while NPC neighbours watch.
  botCount(humans) {
    const wanted = this.options.rivales;
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
    Object.assign(this, { champion: null, fightNo: 0, result: null, titles: [], events: [], round: this.round + 1 });
    this.beginIntro();
  }

  // The next two fighters step up: the champion (if any) and the queue's head.
  beginIntro() {
    const ids = this.players.map(p => p.id);
    this.queue = this.queue.filter(id => ids.includes(id));
    for (const id of ids) if (!this.queue.includes(id) && id !== this.champion) this.queue.push(id);
    let red = this.champion && ids.includes(this.champion) ? this.champion : this.queue.shift();
    if (red === this.champion) this.queue = this.queue.filter(id => id !== red);
    const blue = this.queue.shift();
    if (red == null || blue == null) { this.phase = 'lobby'; return; }
    const arena = this.arena;
    this.bodies = [newBody(red, 'red', arena), newBody(blue, 'blue', arena)];
    const champ = this.player(red);
    if (red === this.champion) {
      this.bodies[0].mareo = Math.round(champ.carry * .35);
      // The challenger's boost against a winner on a streak.
      if (champ.stats.streak >= 3) this.bodies[0].mareo += 25;
    }
    for (const p of this.players) {
      if (p.bet) p.dolitas += p.bet.amount;   // an intro that restarts gives stakes back
      Object.assign(p, { bet: null, water: false, mano: false, cd: 0 });
    }
    this.fightNo++;
    this.fight = { time: this.options.seconds, hype: { red: 0, blue: 0 }, calma: false, close: 0,
      moto: arena.twist === 'moto' ? 14 + draw(this) * Math.max(4, this.options.seconds - 24) : -1, motoDone: false,
      bets: {}, odds: this.odds(red, blue), streak: champ.stats.streak, champion: this.champion === red ? red : null };
    this.placeCrowd();
    this.phase = 'intro'; this.time = INTRO; this.result = null;
    this.emit({ type: 'intro', red, blue, fight: this.fightNo, streak: this.fight.streak });
  }

  // Upsets pay more: betting against a pana on a streak pays triple.
  odds(red, blue) {
    const streak = this.champion === red ? this.player(red)?.stats.streak || 0 : 0;
    return streak >= 2 ? { red: 1.5, blue: 3 } : { red: 2, blue: 2 };
  }

  // The crowd spreads around the ring, away from the two corners.
  placeCrowd() {
    const crowd = this.players.filter(p => !this.bodies.some(b => b.id === p.id));
    crowd.forEach((p, i) => {
      const t = (i + .5) / Math.max(1, crowd.length);
      // Alternate the near (camera) side and the far side, never the corners.
      const side = i % 2 ? 0 : Math.PI, spread = (t - .5) * 1.5;
      p.angle = side + spread;
    });
  }

  bet(id, corner) {
    const p = this.player(id);
    if (this.phase !== 'intro' || !p || this.fighting(id) || !['red', 'blue'].includes(corner)) return false;
    if (p.bet) { p.dolitas += p.bet.amount; }
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
      const input = p.bot ? this.botInput(p, dt) : inputs.get(p.id) || cleanInput({ ...p.last, g: false, b: false });
      pressed.set(p.id, presses(p.last, input)); moves.set(p.id, input);
      p.cd = Math.max(0, p.cd - dt);
    }
    if (this.phase === 'intro') {
      this.time -= dt;
      for (const p of this.players) if (!this.fighting(p.id)) this.crowdStep(p, moves.get(p.id), pressed.get(p.id), dt, arena);
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
    this.time -= dt; f.time = this.time;
    for (const b of this.bodies) control(b, moves.get(b.id) || {}, pressed.get(b.id) || {}, (e) => this.emit(e));
    const result = stepBodies(this.bodies, arena, dt, moves, (e) => this.fightEvent(e));
    for (const p of this.players) if (!this.fighting(p.id)) this.crowdStep(p, moves.get(p.id), pressed.get(p.id), dt, arena);
    if (this.phase !== 'fight') return;   // a ¡cálmate! ended it
    this.ringEdge(arena, dt);
    this.twists(dt);
    if (result) return this.endFight(result.by, result.ko, result.how);
    if (this.time <= 0) this.bell();
  }

  fightEvent(e) {
    if (['hit', 'trompon', 'caida', 'shove'].includes(e.type)) this.fight.close = 0;
    if (e.type === 'caida') this.player(e.id) && this.player(e.id).stats.caidas++;
    this.emit(e);
  }

  // The human ring: out of the circle, whoever is near shoves you back in.
  // If no pana does it in half a second, a neighbour does.
  ringEdge(arena, dt) {
    for (const b of this.bodies) {
      if (arena.shape === 'square') continue;
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
    const f = this.fight;
    // La calle: a moto passes through the fight and splits it for a second.
    if (f.moto > 0 && !f.motoDone && this.options.seconds - this.time >= f.moto) {
      f.motoDone = true;
      const [a, b] = this.bodies, mx = (a.x + b.x) / 2, side = b.x >= a.x ? 1 : -1;
      for (const body of this.bodies) {
        if (body.act === 'down') continue;
        const s = body === b ? side : -side;
        body.vx += s * 5.5; if (body.act !== 'rise') { setAct(body, 'stun'); body.stun = .4; }
      }
      this.emit({ type: 'moto', x: mx, dir: draw(this) < .5 ? 1 : -1 });
    }
    // Clinch: too long hugging without a clean hit and the ref splits them.
    const [a, b] = this.bodies, d = Math.hypot(a.x - b.x, a.z - b.z);
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
    p.angle = Math.atan2(Math.sin(p.angle), Math.cos(p.angle));
    const spot = crowdSpot(arena, p.angle);
    if (press?.gp && this.phase === 'intro' && !p.water) {
      // Water and a towel for the fighter in the corner you stand by.
      const body = this.bodies.find(b => Math.hypot(b.x - spot.x, b.z - spot.z) < 3.2);
      if (body) {
        p.water = true; body.mareo = Math.max(0, body.mareo - 15);
        p.dolitas += PAY.agua; p.stats.agua++;
        this.emit({ type: 'agua', id: body.id, by: p.id });
      }
    } else if (press?.gp && this.phase === 'fight' && p.cd <= 0) {
      p.cd = .8;
      const body = this.bodies.map(b => ({ b, d: Math.hypot(b.x - spot.x, b.z - spot.z) })).sort((x, y) => x.d - y.d)[0];
      const e = body && edge(arena, body.b.x, body.b.z);
      if (body && body.d < 2 && e.out > -1 && body.b.act !== 'down') {
        const b = body.b; b.vx = e.nx * 6.5; b.vz = e.nz * 6.5; b.outside = 0;
        if (b.act !== 'rise') { setAct(b, 'stun'); b.stun = .3; }
        const back = e.out > -.35;
        if (back) { p.dolitas += PAY.shove; p.stats.shoves++; }
        this.emit({ type: 'empujon', id: b.id, by: p.id, back });
      } else this.emit({ type: 'empuja-aire', by: p.id });
    }
    if (press?.a && this.phase === 'fight' && !this.fight.calma) {
      const body = this.bodies.find(b => Math.hypot(b.x - spot.x, b.z - spot.z) < 2.6 && (b.mareo >= MAREO_CALMA || b.act === 'dizzy') && b.act !== 'down');
      if (body) {
        this.fight.calma = true; p.dolitas += PAY.calma; p.stats.calmas++;
        const other = this.bodies.find(b => b !== body);
        this.endFight(other.id, body.id, 'calma', p.id);
      }
    }
    if (press?.t && p.cd <= 0) {
      p.cd = 1.2;
      const corner = p.bet?.on || this.bodies.map(b => ({ c: b.corner, d: Math.hypot(b.x - spot.x, b.z - spot.z) })).sort((x, y) => x.d - y.d)[0]?.c;
      if (this.fight && corner) this.fight.hype[corner] += .5;
      this.emit({ type: 'cheer', by: p.id, corner });
    }
  }

  // The bell: the judges read the scorecard; a draw goes to the crowd.
  bell() {
    const [red, blue] = this.bodies, cards = { red: scorecard(red), blue: scorecard(blue) };
    let winner = cards.red > cards.blue ? red : blue, how = 'puntos';
    if (Math.abs(cards.red - cards.blue) < 1) {
      how = 'publico';
      const cheer = (c) => this.fight.hype[c] + this.players.filter(p => p.bet?.on === c).length;
      const hr = cheer('red'), hb = cheer('blue');
      winner = hr !== hb ? (hr > hb ? red : blue) : red.caidas !== blue.caidas ? (red.caidas < blue.caidas ? red : blue) : draw(this) < .5 ? red : blue;
    }
    this.emit({ type: 'campana', cards });
    this.endFight(winner.id, (winner === red ? blue : red).id, how, null, cards);
  }

  endFight(winnerId, loserId, how, by = null, cards = null) {
    if (this.phase !== 'fight' && this.phase !== 'intro') return;
    const winner = this.player(winnerId), loser = this.player(loserId);
    const wb = this.body(winnerId), lb = this.body(loserId);
    cards ||= wb && lb ? { [wb.corner]: scorecard(wb), [lb.corner]: scorecard(lb) } : null;
    const payouts = [];
    if (winner) {
      winner.stats.wins++; winner.stats.fights++; winner.stats.streak++;
      winner.stats.best = Math.max(winner.stats.best, winner.stats.streak);
      let pay = PAY.win + (how === 'ko' || how === 'cuenta' ? PAY.ko : 0) + (winner.stats.streak >= 2 ? PAY.streak * (winner.stats.streak - 1) : 0);
      if (how === 'ko' || how === 'cuenta') winner.stats.kos++;
      winner.dolitas += pay; payouts.push({ id: winnerId, amount: pay, why: 'pelea' });
      winner.carry = wb ? wb.mareo : 0;
      winner.stats.trompones += wb?.thrown || 0;
    }
    if (loser) {
      loser.stats.fights++; loser.stats.streak = 0; loser.carry = 0;
      loser.stats.trompones += lb?.thrown || 0;
      this.queue = this.queue.filter(id => id !== loserId); this.queue.push(loserId);
    }
    // Bets: the stake was taken when it was placed.
    const corner = wb?.corner;
    for (const p of this.players) {
      if (!p.bet) continue;
      if (p.bet.on === corner) {
        const back = Math.round(p.bet.amount * p.bet.odds);
        p.dolitas += back; p.stats.betWon += back - p.bet.amount; payouts.push({ id: p.id, amount: back, why: 'apuesta' });
      } else payouts.push({ id: p.id, amount: -p.bet.amount, why: 'apuesta' });
      p.bet = null;
    }
    this.champion = winner ? winnerId : null;
    const belt = winner && winner.stats.streak === 3;
    this.result = { winner: winnerId, loser: loserId, how, by, cards, payouts, belt, streak: winner?.stats.streak || 0 };
    this.phase = 'after'; this.time = AFTER;
    for (const b of this.bodies) if (b.act !== 'down' || b.id === winnerId) { setAct(b, b.id === winnerId ? 'win' : b.act === 'down' ? 'down' : 'idle'); }
    this.emit({ type: 'fin', ...this.result });
  }

  checkMano() {
    const [a, b] = this.bodies.map(x => this.player(x.id));
    if (!a?.mano || !b?.mano || this.result?.mano) return;
    this.result.mano = true;
    for (const p of [a, b]) { p.dolitas += PAY.mano; p.stats.manos++; }
    this.emit({ type: 'mano', ids: [a.id, b.id] });
  }

  closeAfter() {
    const skipped = this.bodies.map(b => this.player(b.id)).filter(p => p && !p.mano);
    if (!this.result?.mano) for (const p of skipped) { p.stats.skipped++; this.emit({ type: 'sinmano', id: p.id }); }
    if (this.fightNo >= this.options.peleas) return this.finish();
    this.beginIntro();
  }

  finish() {
    this.phase = 'finished'; this.time = 0;
    this.titles = titlesFor(this.players);
    const richest = [...this.players].sort((a, b) => b.dolitas - a.dolitas)[0];
    this.winner = richest?.id ?? null;
    this.emit({ type: 'noche', winner: this.winner });
  }

  // ---------- bots ----------
  botInput(p, dt) {
    const ai = p.ai ||= { think: 0, hold: 0, block: 0, plan: 0, side: 1, mash: 0, gp: 0, e: 0, a: 0, t: 0, betAt: 1 + draw(this) * 3, manoAt: .8 + draw(this) * 2 };
    const out = { x: 0, z: 0, g: false, b: false, gp: ai.gp, e: ai.e, a: ai.a, t: ai.t };
    const level = this.options.nivel, body = this.body(p.id);
    if (this.phase === 'after') {
      if (body && AFTER - this.time > ai.manoAt && !p.mano && draw(this) < .9) out.a = ai.a = (ai.a + 1) % 256;
      return out;
    }
    if (!body || this.phase === 'intro') return this.botCrowd(p, ai, out, dt);
    const other = this.bodies.find(b => b !== body);
    if (body.act === 'down') {
      ai.mash -= dt;
      if (ai.mash <= 0) { out.gp = ai.gp = (ai.gp + 1) % 256; ai.mash = 1 / (4.5 + 2 * level) * (.7 + draw(this) * .6); }
      return out;
    }
    const dx = other.x - body.x, dz = other.z - body.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
    const rx = fz, rz = -fx;
    ai.think -= dt; ai.hold -= dt; ai.block -= dt;
    if (ai.think <= 0) {
      ai.think = [.5, .32, .2][level] * (.6 + draw(this) * .8);
      const roll = draw(this);
      ai.plan = 0;
      if (other.act === 'wind' && d < 2.3) {
        if (d < 1.5 && roll < .35 + .2 * level) ai.plan = 'jab';
        else if (roll < .75) ai.plan = 'dodge';
        else ai.plan = 'block';
      } else if (other.act === 'jab' && other.at < .1 && roll < .25 + .2 * level) ai.plan = 'block';
      else if (other.act === 'block' && d < 1.4 && roll < .5) ai.plan = 'grab';
      else if (['open', 'stun', 'dizzy'].includes(other.act) && d < 1.8) ai.plan = other.act === 'stun' && roll < .6 ? 'jab' : 'trompon';
      else if (d < 1.5) {
        ai.plan = roll < .5 ? 'jab' : roll < .66 ? 'trompon' : roll < .74 ? 'grab' : roll < .86 ? 'block' : roll < .93 ? 'dodge' : roll < .96 ? 'taunt' : 0;
      }
      if (draw(this) < .25) ai.side = -ai.side;
      if (body.mareo > 75 && draw(this) < .6) ai.plan = ai.plan === 'jab' ? 'jab' : 0;
      if (ai.plan === 'jab') out.gp = ai.gp = (ai.gp + 1) % 256;
      if (ai.plan === 'trompon') { out.gp = ai.gp = (ai.gp + 1) % 256; ai.hold = .3; }
      if (ai.plan === 'dodge') out.e = ai.e = (ai.e + 1) % 256;
      if (ai.plan === 'grab') out.a = ai.a = (ai.a + 1) % 256;
      if (ai.plan === 'taunt') out.t = ai.t = (ai.t + 1) % 256;
      if (ai.plan === 'block') ai.block = .45 + draw(this) * .3;
    }
    out.g = ai.hold > 0; out.b = ai.block > 0;
    // Close in, keep a jab's distance, circle; back off when dizzy or hurt.
    let f = d > 1.3 ? 1 : d < 1 ? -.6 : 0;
    if (body.act === 'dizzy' || body.mareo > 80) f = -1;
    out.x = fx * f + rx * ai.side * .45; out.z = fz * f + rz * ai.side * .45;
    const e = edge(this.arena, body.x, body.z);
    if (e.out > -.9) { out.x += e.nx * 1.2; out.z += e.nz * 1.2; }
    // Dodge sideways along the plan's side.
    if (ai.plan === 'dodge') { out.x += rx * ai.side; out.z += rz * ai.side; }
    return out;
  }

  // A bot in the crowd: bet, walk toward trouble at the edge, shove it back in.
  botCrowd(p, ai, out, dt) {
    if (this.phase === 'intro') {
      if (!p.bet && INTRO - this.time > ai.betAt) {
        const champ = this.fight.champion ? 'red' : null;
        this.bet(p.id, champ && draw(this) < .6 ? champ : draw(this) < .5 ? 'red' : 'blue');
      }
      if (!p.water && INTRO - this.time > ai.betAt + 1 && draw(this) < .02) out.gp = ai.gp = (ai.gp + 1) % 256;
      return out;
    }
    const arena = this.arena, spot = crowdSpot(arena, p.angle);
    const near = this.bodies.map(b => ({ b, e: edge(arena, b.x, b.z) })).sort((x, y) => y.e.out - x.e.out)[0];
    if (!near || near.e.out < -1.2) return out;
    const target = Math.atan2(near.b.x, near.b.z);
    let diff = target - p.angle; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const tx = Math.cos(p.angle), tz = -Math.sin(p.angle), s = clamp(diff * 3, -1, 1);
    out.x = tx * s; out.z = tz * s;
    if (Math.hypot(near.b.x - spot.x, near.b.z - spot.z) < 1.8 && near.e.out > -.4 && p.cd <= 0 && draw(this) < dt * 4) out.gp = ai.gp = (ai.gp + 1) % 256;
    return out;
  }
}

// End of the night: who earned which title.
export function titlesFor(players) {
  const best = (score, min = 1) => {
    const top = [...players].map(p => ({ p, v: score(p) })).sort((a, b) => b.v - a.v)[0];
    return top && top.v >= min ? top.p.id : null;
  };
  const list = [
    ['campeon', 'El campeón del barrio', best(p => p.stats.best)],
    ['vidrio', 'El de la quijada de vidrio', best(p => p.stats.caidas)],
    ['caballero', 'El caballero', best(p => p.stats.skipped ? 0 : p.stats.manos)],
    ['apostador', 'El apostador', best(p => p.stats.betWon)],
    ['pacificador', 'El pacificador', best(p => p.stats.calmas * 3 + p.stats.shoves)],
    ['contodo', 'El que se fue con todo', best(p => p.stats.trompones)],
  ];
  return list.filter(([, , id]) => id != null).map(([key, title, id]) => ({ key, title, id }));
}
