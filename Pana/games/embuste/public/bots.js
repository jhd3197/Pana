// Practice bots for ¡Embuste!. They exist to learn the map and test the rules,
// not to be fun opponents. A brain reads the Night directly (bots run where the
// Night runs: the server room or the practice page) and returns an input.

import { STATIONS, distance, findPath, near, REACH } from './layout.js';

export const BOT_NAMES = ['Chiguire', 'Lapa', 'Báquiro', 'Danta', 'Araguato', 'Cachicamo', 'Morrocoy', 'Perico'];

export class Brains {
  constructor(night) { this.night = night; this.minds = new Map(); }

  mind(p) {
    let m = this.minds.get(p.seat);
    if (!m) { m = { path: [], goal: null, wait: 0, think: 0 }; this.minds.set(p.seat, m); }
    return m;
  }

  // inputs: Map seat → input; fills in one for every bot.
  think(dt, inputs) {
    const night = this.night;
    for (const p of night.players.values()) {
      if (!p.bot) continue;
      inputs.set(p.seat, night.phase === 'playing' ? this.drive(p, this.mind(p), dt) : { x: 0, z: 0 });
    }
    for (const seat of this.minds.keys()) if (!night.players.has(seat)) this.minds.delete(seat);
  }

  goTo(p, m, target) {
    m.goal = target;
    m.path = findPath(p, target, this.night.world());
  }

  // Walk along the current path; true when there.
  follow(p, m) {
    while (m.path.length && distance(p, m.path[0]) < 0.6) m.path.shift();
    if (!m.path.length) return null;
    const next = m.path[0], d = distance(p, next) || 1;
    return { x: (next.x - p.x) / d, z: (next.z - p.z) / d };
  }

  drive(p, m, dt) {
    m.wait -= dt;
    if (m.wait > 0) return { x: 0, z: 0 };
    if (!m.goal || (near(p, m.goal, REACH - 0.6) && !m.path.length)) {
      if (m.goal) { m.goal = null; m.wait = 1 + this.night.rand() * 3; return { x: 0, z: 0 }; }
      const s = STATIONS[Math.floor(this.night.rand() * STATIONS.length)];
      this.goTo(p, m, s);
    }
    const step = this.follow(p, m);
    if (!step) { m.goal = null; return { x: 0, z: 0 }; }
    return step;
  }
}
