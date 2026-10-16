// Practice bots for ¡Embuste!. They exist to learn the map and test the rules,
// not to be fun opponents. A brain reads the Night directly (bots run where the
// Night runs: the server room or the practice page) and returns an input. They
// only act on what their own seat could see.

import { STATIONS, distance, findPath, lineClear, near, REACH, stationById } from './layout.js';
import { taskById, WRAP_RANGE, PHRASES } from './rules.js';

export const BOT_NAMES = ['Chiguire', 'Lapa', 'Báquiro', 'Danta', 'Araguato', 'Cachicamo', 'Morrocoy', 'Perico'];
const STILL = { x: 0, z: 0 };
const toward = (p, q) => { const d = distance(p, q) || 1; return { x: (q.x - p.x) / d, z: (q.z - p.z) / d }; };

export class Brains {
  constructor(night) { this.night = night; this.minds = new Map(); }

  mind(p) {
    let m = this.minds.get(p.seat);
    if (!m) { m = { path: [], goal: null, wait: 0, working: 0, seen: new Map(), voteIn: 0, talked: false }; this.minds.set(p.seat, m); }
    return m;
  }

  // inputs: Map seat → input; fills in one for every bot.
  think(dt, inputs) {
    const night = this.night;
    for (const p of night.players.values()) {
      if (!p.bot) continue;
      const m = this.mind(p);
      if (night.phase === 'meeting') { this.meet(p, m, dt); inputs.set(p.seat, STILL); continue; }
      if (night.phase !== 'playing' || p.spectator) { m.path = []; m.goal = null; inputs.set(p.seat, STILL); continue; }
      this.remember(p, m);
      inputs.set(p.seat, this.drive(p, m, dt));
    }
    for (const seat of this.minds.keys()) if (!night.players.has(seat)) this.minds.delete(seat);
  }

  // Who this bot has seen, and where: its only evidence at a meeting.
  remember(p, m) {
    if (this.night.ghost(p)) return;
    for (const q of this.night.players.values()) if (q !== p && !this.night.ghost(q) && this.night.sees(p, q)) m.seen.set(q.seat, { x: q.x, z: q.z, t: this.night.time });
  }

  goTo(p, m, target) {
    m.goal = target;
    m.path = this.night.ghost(p) ? [{ x: target.x, z: target.z }] : findPath(p, target, this.night.terrain());
  }

  // One step along the current path; null when there is nowhere to go. A bot
  // wedged against furniture for a moment plans again from where it is.
  follow(p, m, dt = 0.05) {
    while (m.path.length && distance(p, m.path[0]) < 0.6) m.path.shift();
    if (!m.path.length) return null;
    const moved = m.last ? distance(p, m.last) : 1; m.last = { x: p.x, z: p.z };
    m.stuck = moved < 0.02 ? (m.stuck || 0) + dt : 0;
    if (m.stuck > 0.6 && m.goal) {
      m.stuck = 0;
      m.path = findPath(p, m.goal, this.night.terrain());
      const a = this.night.rand() * Math.PI * 2;
      return { x: Math.cos(a), z: Math.sin(a) };
    }
    return toward(p, m.path[0]);
  }

  // The station of the next chore on this bot's list.
  nextStation(p) {
    const t = p.tasks.find(t => t.step < taskById(t.id).stations.length);
    return t ? stationById(taskById(t.id).stations[t.step]) : null;
  }

  drive(p, m, dt) {
    const night = this.night;
    m.wait -= dt;
    if (p.task) {
      m.working -= dt;
      if (m.working <= 0) night.act(p.seat, 'done', { station: p.task.station });
      return STILL;
    }
    if (!night.ghost(p)) {
      if (p.role === 'momia') { const hunt = this.hunt(p, m); if (hunt) return hunt; }
      else { const found = this.lookForStatues(p, m); if (found) return found; }
    }
    if (m.wait > 0) return STILL;
    // Mummies wander between chores to fake; panas work through their list.
    const target = p.role === 'momia' && !night.ghost(p) ? (m.goal?.id ? m.goal : STATIONS[Math.floor(night.rand() * STATIONS.length)]) : this.nextStation(p);
    if (!target) return this.idle(p, m);
    if (m.goal !== target) this.goTo(p, m, target);
    if (near(p, target, REACH - 0.2)) {
      m.goal = null;
      const t = night.taskAt(p, target.id);
      if (t && night.act(p.seat, 'task', { station: target.id })) {
        m.working = taskById(t.id).seconds * night.timers.task + 0.5 + night.rand() * 2;
        return STILL;
      }
      m.wait = 1 + night.rand() * 2;
      return STILL;
    }
    const step = this.follow(p, m, dt);
    if (!step) { m.goal = null; m.wait = 0.5; return STILL; }
    return step;
  }

  // A mummy strikes when a pana is alone: nobody else alive has them in sight.
  hunt(p, m) {
    const night = this.night;
    if (p.cooldown > 0) return null;
    const alone = q => ![...night.players.values()].some(v => v !== q && v !== p && v.role !== 'momia' && !night.ghost(v) && night.sees(v, q));
    const prey = [...night.players.values()]
      .filter(q => q.role === 'pana' && !night.ghost(q) && night.sees(p, q) && distance(p, q) < 9 && night.wrappable(q, p) && alone(q))
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!prey) return null;
    if (distance(p, prey) <= WRAP_RANGE - 0.3) {
      if (night.act(p.seat, 'wrap')) { m.goal = null; this.goTo(p, m, STATIONS[Math.floor(night.rand() * STATIONS.length)]); }
      return STILL;
    }
    m.goal = null;
    if (lineClear(p, prey, night.terrain(), 0.45)) return toward(p, prey);
    m.path = findPath(p, prey, night.terrain());
    return this.follow(p, m) || toward(p, prey);
  }

  // A pana who sees a statue walks up and reports it.
  lookForStatues(p, m) {
    const night = this.night, statue = night.statues.find(s => night.sees(p, s));
    if (!statue) return null;
    if (night.statueNear(p)) { night.act(p.seat, 'report'); return STILL; }
    if (m.goal !== statue) this.goTo(p, m, statue);
    return this.follow(p, m) || toward(p, statue);
  }

  // Meetings: maybe say something, then vote on whatever this bot saw.
  meet(p, m, dt) {
    const night = this.night, meeting = night.meeting;
    m.path = []; m.goal = null;
    if (night.ghost(p)) return;
    if (meeting.stage === 'discuss') {
      m.voteIn = 1 + night.rand() * 3;
      if (!m.talked && night.rand() < dt * 0.4) { m.talked = true; night.act(p.seat, 'chat', { phrase: Math.floor(night.rand() * PHRASES.length) }); }
      return;
    }
    m.talked = false;
    if (meeting.stage !== 'vote' || meeting.votes.has(p.seat)) return;
    m.voteIn -= dt;
    if (m.voteIn <= 0) night.act(p.seat, 'vote', { target: this.suspect(p, m) });
  }

  suspect(p, m) {
    const night = this.night, living = [...night.players.values()].filter(q => q !== p && !night.ghost(q));
    if (p.role === 'momia') {
      const panas = living.filter(q => q.role !== 'momia');
      return night.rand() < 0.4 || !panas.length ? 'skip' : panas[Math.floor(night.rand() * panas.length)].seat;
    }
    const body = night.statues.find(s => s.seat === night.meeting.body);
    if (body) {
      const close = living.map(q => ({ q, s: m.seen.get(q.seat) })).filter(({ s }) => s && night.time - s.t < 25 && distance(s, body) < 9)
        .sort((a, b) => distance(a.s, body) - distance(b.s, body))[0];
      if (close) return close.q.seat;
    }
    return 'skip';
  }

  // Nothing left to do: drift back to the fire.
  idle(p, m) {
    if (!m.goal && distance(p, { x: 0, z: 0 }) > 7) this.goTo(p, m, { x: (this.night.rand() - 0.5) * 8, z: 6 });
    return this.follow(p, m) || STILL;
  }
}
