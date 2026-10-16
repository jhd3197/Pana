// Practice bots for ¡Embuste!. They exist to learn the map and test the rules,
// not to be fun opponents. A brain reads the Night directly (bots run where the
// Night runs: the server room or the practice page) and returns an input.

import { STATIONS, distance, findPath, near, REACH, stationById } from './layout.js';
import { taskById } from './rules.js';

export const BOT_NAMES = ['Chiguire', 'Lapa', 'Báquiro', 'Danta', 'Araguato', 'Cachicamo', 'Morrocoy', 'Perico'];
const STILL = { x: 0, z: 0 };

export class Brains {
  constructor(night) { this.night = night; this.minds = new Map(); }

  mind(p) {
    let m = this.minds.get(p.seat);
    if (!m) { m = { path: [], goal: null, wait: 0, working: 0 }; this.minds.set(p.seat, m); }
    return m;
  }

  // inputs: Map seat → input; fills in one for every bot.
  think(dt, inputs) {
    const night = this.night;
    for (const p of night.players.values()) {
      if (!p.bot) continue;
      inputs.set(p.seat, night.phase === 'playing' && !p.spectator ? this.drive(p, this.mind(p), dt) : STILL);
    }
    for (const seat of this.minds.keys()) if (!night.players.has(seat)) this.minds.delete(seat);
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
    const next = m.path[0], d = distance(p, next) || 1;
    return { x: (next.x - p.x) / d, z: (next.z - p.z) / d };
  }

  // The station of the next chore on this bot's list.
  nextStation(p) {
    const t = p.tasks.find(t => t.step < taskById(t.id).stations.length);
    if (!t) return null;
    return stationById(taskById(t.id).stations[t.step]);
  }

  drive(p, m, dt) {
    const night = this.night;
    m.wait -= dt;
    if (p.task) {
      m.working -= dt;
      if (m.working <= 0) night.act(p.seat, 'done', { station: p.task.station });
      return STILL;
    }
    if (m.wait > 0) return STILL;
    // Mummies wander between their fake chores; panas work through the list.
    const target = p.role === 'momia' && !night.ghost(p) ? (m.goal || STATIONS[Math.floor(night.rand() * STATIONS.length)]) : this.nextStation(p);
    if (!target) return this.idle(p, m);
    if (m.goal !== target) this.goTo(p, m, target);
    if (near(p, target, REACH - 0.2)) {
      m.goal = null;
      const def = p.tasks.find(t => night.taskAt(p, target.id));
      if (def && night.act(p.seat, 'task', { station: target.id })) {
        m.working = taskById(def.id).seconds * night.timers.task + 0.5 + night.rand() * 2;
        return STILL;
      }
      m.wait = 1 + night.rand() * 2;
      return STILL;
    }
    const step = this.follow(p, m, dt);
    if (!step) { m.goal = null; m.wait = 0.5; return STILL; }
    return step;
  }

  // Nothing left to do: drift back to the fire.
  idle(p, m) {
    if (!m.goal && distance(p, { x: 0, z: 0 }) > 7) this.goTo(p, m, { x: (this.night.rand() - 0.5) * 8, z: 6 });
    return this.follow(p, m) || STILL;
  }
}
