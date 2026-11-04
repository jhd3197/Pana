// The swarm: dozens of snakes pouring out of cracks in the floor, renderer-free.
// The host owns it. `g.swarm` is plain JSON and travels in snapshots: phase, the
// holes, and every head's position as one compact string a few times a second.
// `g.swarmSim` (typed arrays, never in a snapshot) is the host's full simulation,
// rebuilt from that JSON when a guest takes over. Each client draws through a
// SwarmFollower: its heads chase the synced ones, its bodies are its own, on the
// same solver. Bodies never cross the wire. See docs/knowledge/reliquia.md.
import { VerletChains } from '../../../engine/play/verlet-chains.js';
import { bakeDistanceField } from '../../../engine/play/distance-field.js';
import { flowFromField } from '../../../engine/play/flow-field.js';
import { CAGE, floorOf } from './deck.js';
import { holds, scaleFor } from './enemies.js';
import { random } from './director.js';
import { pactoSwarmChance, pactoSwarmSize } from './pactos.js';

export const SWARM = {
  segments: 12, link: .17, radius: .07, gap: .16, capacity: 160, most: 90,
  telegraph: 2.4, crawl: 30, retreat: 9, rest: 75, firstAt: 45,
  speed: 2.2, hurry: 1.6, hurryPast: 16, pour: 8, headsEvery: .15, flowEvery: .4, reach: 45,
  lamp: { range: 7.5, cone: .8, crown: 5.5, hold: .7, recoil: 1.2 },
  bite: { radius: .6, damage: 3, every: .9, slow: 1.4, overhead: .7 },
  swing: { machete: 2.6, other: 1.1, ahead: 1.1, seconds: 1.1, stunned: .3 },
  // Never in a room with an authored fight waiting in it.
  noHole: ['boveda', 'guardian'],
};
const FIELD_CELL = .25, HASH_CELL = .4, HOST_STEP = 1 / 30, CLIENT_STEP = 1 / 45;
const GOLDEN = 2.39996;

// How wide a head's wiggle is right now: each snake on its own beat.
export const slither = (time, c) => Math.sin(time * (8 + (c % 5) * .6) + c * GOLDEN) * .75;

// ---------- The ground it crawls on ----------
// What is solid for a snake: the level's walls (layout.js), pits, obstacles and
// the cages, and everything that closes during a run. A hiding nook is solid
// too: gap and all, a snake cannot get in.
function blockers(run, state) {
  let sig = '';
  for (const w of run.hidden) if (!state.revealed?.[w.id]) sig += `${w.id},`;
  sig += '|';
  for (const id in state.rubble || {}) sig += `${id},`;
  return sig;
}
let baked = null;
export function swarmField(L, floor, state = {}) {
  const run = L.run, sig = blockers(run, state);
  if (baked && baked.L === L && baked.floor === floor && baked.sig === sig) return baked.field;
  const grid = L.footprint(floor), { w, h, x0, z0, res, bits } = grid, mask = new Uint8Array(w * h);
  for (let k = 0; k < mask.length; k++) mask[k] = bits[k] === 1 ? 0 : 1;
  const stamp = (r, inside = () => true) => {
    const i0 = Math.max(0, Math.floor((r[0] - x0) * res)), i1 = Math.min(w - 1, Math.ceil((r[2] - x0) * res));
    const j0 = Math.max(0, Math.floor((r[1] - z0) * res)), j1 = Math.min(h - 1, Math.ceil((r[3] - z0) * res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inside(x0 + (i + .5) / res, z0 + (j + .5) / res)) mask[j * w + i] = 1;
  };
  for (const n of run.nooks) if (n.floor === floor) stamp(n.rect);
  for (const l of run.lifts) if (l.floor === floor) stamp([l.x - CAGE, l.z - CAGE, l.x + CAGE, l.z + CAGE]);
  for (const o of grid.obstacles) stamp([o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r], (x, z) => (x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r);
  for (const wall of run.hidden) if (wall.floor === floor && !state.revealed?.[wall.id]) stamp(wall.rect);
  for (const id in state.rubble || {}) { const c = run.corridors.find(q => q.id === id); if (c?.floor === floor) stamp(c.rect); }
  const field = bakeDistanceField({ w, h, cell: 1 / res, x0, z0, solid: (i, j) => mask[j * w + i] === 1 });
  baked = { L, floor, sig, field };
  return field;
}
function makeChains(field, count, h) {
  return new VerletChains({ chains: count, points: SWARM.segments, rest: SWARM.link, h, radius: SWARM.radius, field, gap: SWARM.gap,
    grid: { cell: HASH_CELL, x0: field.x0, z0: field.z0, w: Math.ceil(field.w * field.cell / HASH_CELL), h: Math.ceil(field.h * field.cell / HASH_CELL) } });
}

// ---------- The wire ----------
// Five characters a head: 13 bits x, 13 bits z (1/16 m from the floor's corner),
// four of flags. A string, so a state delta sends it whole or not at all.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', VALUE = new Int8Array(128);
for (let i = 0; i < 64; i++) VALUE[ALPHABET.charCodeAt(i)] = i;
export const HEAD = { alive: 1, loose: 2 };
const packAxis = v => { const n = Math.round(v * 16); return n < 0 ? 0 : n > 8191 ? 8191 : n; };
export function encodeHeads(chains, count, ox, oz) {
  let out = '';
  for (let c = 0; c < count; c++) {
    const k = c * chains.points, flags = (chains.alive[c] ? HEAD.alive : 0) | (chains.loose[c] > 0 ? HEAD.loose : 0);
    const v = packAxis(chains.x[k] - ox) << 17 | packAxis(chains.z[k] - oz) << 4 | flags;
    out += ALPHABET[v >>> 24 & 63] + ALPHABET[v >>> 18 & 63] + ALPHABET[v >>> 12 & 63] + ALPHABET[v >>> 6 & 63] + ALPHABET[v & 63];
  }
  return out;
}
// Into x, z and flags; how many heads the string holds.
export function decodeHeads(text, ox, oz, x, z, flags) {
  const n = Math.floor(text.length / 5);
  for (let c = 0; c < n; c++) {
    let v = 0;
    for (let i = 0; i < 5; i++) v = v << 6 | VALUE[text.charCodeAt(c * 5 + i)];
    x[c] = (v >>> 17 & 8191) / 16 + ox; z[c] = (v >>> 4 & 8191) / 16 + oz; flags[c] = v & 15;
  }
  return n;
}
// A chain trailing out of a point, each snake its own way, for one that appears at once.
const lay = (chains, c, x, z, spacing) => chains.place(c, x, z, Math.cos(c * GOLDEN), Math.sin(c * GOLDEN), spacing);

// ---------- The host ----------
const standing = p => !p.downed && !p.spectator;
class HostSwarm {
  constructor(g, s) {
    this.field = swarmField(g.layout, s.floor, g);
    this.chains = makeChains(this.field, s.total, HOST_STEP); this.flow = flowFromField(this.field);
    this.hx = new Float32Array(s.total); this.hz = new Float32Array(s.total); this.lit = new Float32Array(s.total); this.ax = new Float32Array(s.total); this.az = new Float32Array(s.total);
    this.targets = new Float32Array(16); this.targetCount = 0; this.lamps = new Float32Array(40); this.lampCount = 0;
    this.found = new Int32Array(96); this.frame = 0; this.flowIn = 0; this.headsIn = 0; this.carry = 0; this.home = false;
    // A new host: what the old one published is enough. Bodies straighten out in a moment.
    if (s.heads) {
      const x = new Float32Array(s.total), z = new Float32Array(s.total), flags = new Uint8Array(s.total), n = decodeHeads(s.heads, s.ox, s.oz, x, z, flags);
      for (let c = 0; c < n; c++) if (flags[c] & HEAD.alive) lay(this.chains, c, x[c], z[c], SWARM.link * .5);
    }
  }
  // Where everyone is, once per tick: who can be chased and who carries a light.
  survey(g, s) {
    this.targetCount = 0; this.lampCount = 0;
    let onFloor = 0;
    for (const p of g.players) {
      if (!standing(p) || floorOf(p.x) !== s.floor) continue;
      onFloor++;
      if (p.riding || p.hidden) continue;
      if (this.targetCount < 8) { this.targets[this.targetCount * 2] = p.x; this.targets[this.targetCount * 2 + 1] = p.z; this.targetCount++; }
      const crown = holds(p, 'sunCrown');
      if ((crown || holds(p, 'farol')) && this.lampCount < 8) {
        const o = this.lampCount++ * 5;
        this.lamps[o] = p.x; this.lamps[o + 1] = p.z; this.lamps[o + 2] = Math.sin(p.h); this.lamps[o + 3] = Math.cos(p.h); this.lamps[o + 4] = crown ? 1 : 0;
      }
    }
    return onFloor;
  }
  refreshFlow(g, s, dt) {
    this.flowIn -= dt; if (this.flowIn > 0) return;
    this.flowIn = SWARM.flowEvery;
    // A wall came down or a tunnel fell in: a new map of the floor (a rare moment).
    const field = swarmField(g.layout, s.floor, g);
    if (field !== this.field) { this.field = field; this.chains.field = field; this.flow = flowFromField(field); this.home = false; }
    if (s.phase === 'retreat') {
      if (this.home) return;
      this.home = true; this.flow.reset();
      for (const hole of s.holes) this.flow.add(hole.x, hole.z);
    } else {
      this.flow.reset();
      for (let i = 0; i < this.targetCount; i++) this.flow.add(this.targets[i * 2], this.targets[i * 2 + 1]);
    }
    this.flow.compute();
  }
  // A farol's beam (or a sun crown's glow) on this head: which way is away?
  shine(c, x, z) {
    const { lamp } = SWARM, { lamps, field } = this;
    for (let l = 0; l < this.lampCount; l++) {
      const o = l * 5, dx = x - lamps[o], dz = z - lamps[o + 1], d = Math.sqrt(dx * dx + dz * dz) || 1;
      const lit = lamps[o + 4] ? d < lamp.crown : d < lamp.range && (dx * lamps[o + 2] + dz * lamps[o + 3]) / d > lamp.cone;
      if (lit && field.clear(lamps[o], lamps[o + 1], x, z)) { this.lit[c] = lamp.hold; this.ax[c] = dx / d; this.az[c] = dz / d; return; }
    }
  }
  steer(g, s, h, speed) {
    const { chains, flow, field, hx, hz, lit, targets } = this, { x, z, alive, loose, stiff, points } = chains, retreat = s.phase === 'retreat', turn = 1 - Math.exp(-8 * h);
    this.frame++;
    for (let c = 0; c < s.out; c++) {
      if (!alive[c] || loose[c] > 0 || stiff[c] < SWARM.swing.stunned) continue;
      const k = c * points, px = x[k], pz = z[k];
      let wx = 0, wz = 0, pace = speed;
      if (lit[c] > 0) lit[c] -= h;
      if (!retreat && this.lampCount && (c + this.frame) % 4 === 0) this.shine(c, px, pz);
      if (lit[c] > 0) { wx = this.ax[c]; wz = this.az[c]; pace *= SWARM.lamp.recoil; }
      else if (retreat) {
        const steps = flow.toward(px, pz);
        if (steps <= 1) { chains.remove(c); continue; }
        wx = flow.dx; wz = flow.dz; pace *= 1.3;
      } else {
        let best = Infinity, bx = 0, bz = 0;
        for (let t = 0; t < this.targetCount; t++) { const dx = targets[t * 2] - px, dz = targets[t * 2 + 1] - pz, d = dx * dx + dz * dz; if (d < best) { best = d; bx = dx; bz = dz; } }
        if (best < 9 && field.clear(px, pz, px + bx, pz + bz, .02)) { const d = Math.sqrt(best) || 1; wx = bx / d; wz = bz / d; if (d < .35) pace = 0; }
        else {
          const steps = flow.toward(px, pz);
          if (steps > 0) { wx = flow.dx; wz = flow.dz; if (steps * flow.cell > SWARM.hurryPast) pace *= SWARM.hurry; }   // A long way off, it hurries.
          else pace *= .35;   // Nobody to smell: it mills about where it is.
        }
      }
      if (wx || wz) {
        hx[c] += (wx - hx[c]) * turn; hz[c] += (wz - hz[c]) * turn;
        const len = Math.sqrt(hx[c] * hx[c] + hz[c] * hz[c]);
        if (len > 1e-3) { hx[c] /= len; hz[c] /= len; } else { hx[c] = wx; hz[c] = wz; }
      }
      const wiggle = slither(s.t, c);
      chains.nudge(c, (hx[c] - hz[c] * wiggle) * pace * h, (hz[c] + hx[c] * wiggle) * pace * h);
    }
  }
  // Teeth on ankles: a little damage and a short slow (the walk itself is untouched).
  bite(g, s, dt) {
    const { bite } = SWARM, { chains, found } = this, { x, z, loose, stiff, points, hash } = chains, reach = bite.radius * bite.radius, hurt = bite.damage * scaleFor(g).damage;
    for (const p of g.players) {
      p.snakeBite = Math.max(0, (p.snakeBite || 0) - dt);
      if (p.snakeBite > 0 || !standing(p) || floorOf(p.x) !== s.floor || p.riding || p.hidden || p.invulnerable > 0 || (p.jumpHeight || 0) > bite.overhead) continue;
      const n = hash.query(p.x, p.z, bite.radius, found);
      for (let q = 0; q < n; q++) {
        const k = found[q], c = (k / points) | 0;
        if (loose[c] > 0 || stiff[c] < SWARM.swing.stunned || !chains.alive[c]) continue;
        const dx = x[k] - p.x, dz = z[k] - p.z;
        if (dx * dx + dz * dz > reach) continue;
        p.snakeBite = bite.every; p.slow = Math.max(p.slow || 0, bite.slow);
        g.damage(p, hurt, {});
        break;
      }
    }
  }
}
const liveHeads = (sim, s) => { let n = 0; for (let c = 0; c < s.out; c++) if (sim.chains.alive[c]) n++; return n; };

// How many come: more with depth, greed, company and difficulty.
export function swarmSize(g) {
  const roster = g.players.filter(p => !p.spectator).length, greed = Math.min(4, Math.floor(g.codicia / 25));
  const base = (18 + 6 * (g.level || 1) + 3 * greed + 2 * roster) * ({ easy: .75, hard: 1.25 }[g.options?.difficulty] || 1);
  return Math.min(SWARM.most, Math.round(base * pactoSwarmSize(g.options)));   // pact 'enjambre': bigger, under the same cap
}
// Cracks at the foot of a wall, in rooms nobody is standing in, near enough to
// arrive while the swarm lasts. Each pass asks for less: out of sight and well
// away, then only away, then anywhere a snake can reach a pana from. A floor with
// no such spot gets no swarm.
export function pickHoles(g, floor, field, flow, wanted = 3) {
  const L = g.layout, run = L.run, panas = g.players.filter(p => standing(p) && floorOf(p.x) === floor);
  const rooms = run.rooms.filter(r => r.floor === floor && !SWARM.noHole.includes(r.kind) && (!r.hidden || g.revealed?.[r.hidden]));
  const holes = [];
  for (const [far, unseen, reach] of [[14, true, SWARM.reach], [9, false, SWARM.reach], [5, false, Infinity]]) {
    const shuffled = rooms.map(room => ({ room, k: random(g) })).sort((a, b) => a.k - b.k);
    for (const { room } of shuffled) {
      if (holes.length >= wanted) return holes;
      if (holes.some(h => h.room === room.id)) continue;
      for (let tries = 0; tries < 14; tries++) {
        const side = Math.floor(random(g) * 4), along = random(g), [x0, z0, x1, z1] = room.rect, inset = .8;
        const x = side < 2 ? x0 + 1 + along * (x1 - x0 - 2) : side === 2 ? x0 + inset : x1 - inset;
        const z = side > 1 ? z0 + 1 + along * (z1 - z0 - 2) : side === 0 ? z0 + inset : z1 - inset;
        if (field.at(x, z) < .4 || !L.walkable(x, z, g, .3)) continue;
        const steps = flow.toward(x, z);
        if (steps <= 0 || steps * flow.cell > reach) continue;
        if (panas.some(p => Math.hypot(p.x - x, p.z - z) < far || (unseen && field.clear(p.x, p.z, x, z)))) continue;
        holes.push({ x, z, room: room.id, h: random(g) * Math.PI * 2 });
        break;
      }
    }
    if (holes.length) return holes;
  }
  return holes;
}
// The telegraph starts here: a hiss (the 'swarm' event) and dust (swarm-view.js).
export function startSwarm(g, floor, count = swarmSize(g)) {
  if (g.swarm || floor <= 0 || !g.layout.footprint(floor)) return false;
  const panas = g.players.filter(p => standing(p) && floorOf(p.x) === floor && !p.riding);
  if (!panas.length) return false;
  const field = swarmField(g.layout, floor, g), flow = flowFromField(field);
  flow.reset(); for (const p of panas) flow.add(p.x, p.z); flow.compute();
  const holes = pickHoles(g, floor, field, flow, 2 + Math.min(2, Math.floor((g.level || 1) / 2)));
  if (!holes.length) return false;
  const total = Math.max(1, Math.min(SWARM.capacity, Math.round(count)));
  g.swarmId = (g.swarmId || 0) + 1;
  g.swarm = { id: g.swarmId, floor, phase: 'hiss', t: 0, total, out: 0, holes, ox: field.x0, oz: field.z0, heads: '' };
  g.swarmSim = null;
  g.event('swarm', '', { floor, holes: holes.map(h => ({ x: h.x, z: h.z })) });
  return true;
}
// The Director's turn: now and then a wave is the swarm instead.
export function swarmDue(g) {
  if (g.swarm || g.time < (g.swarmAt || SWARM.firstAt)) return false;
  return random(g) < .2 + .05 * Math.min(4, Math.floor(g.codicia / 25)) + pactoSwarmChance(g.options);   // pact 'enjambre': more often
}
function endSwarm(g) { g.swarm = null; g.swarmSim = null; g.swarmAt = g.time + SWARM.rest; }

export function tickSwarm(g, dt) {
  const s = g.swarm; if (!s) return;
  const sim = g.swarmSim ||= new HostSwarm(g, s), onFloor = sim.survey(g, s), speed = SWARM.speed * scaleFor(g).speed;
  s.t += dt;
  if (s.phase === 'hiss' && s.t >= SWARM.telegraph) { s.phase = 'crawl'; s.t = 0; }
  if (s.phase === 'crawl') {
    // Out of the holes in turn, a few a second.
    const due = Math.min(s.total, Math.floor(s.t * Math.max(SWARM.pour, s.total / 6)) + 1);
    for (; s.out < due; s.out++) { const hole = s.holes[s.out % s.holes.length]; lay(sim.chains, s.out, hole.x + Math.cos(s.out) * .2, hole.z + Math.sin(s.out) * .2, SWARM.link * .3); sim.hx[s.out] = Math.cos(s.out * GOLDEN); sim.hz[s.out] = Math.sin(s.out * GOLDEN); }
    if (s.t >= SWARM.crawl || !onFloor) { s.phase = 'retreat'; s.t = 0; sim.flowIn = 0; }
  }
  if (s.phase === 'hiss') return;
  sim.refreshFlow(g, s, dt);
  sim.carry += dt;
  while (sim.carry >= HOST_STEP) { sim.carry -= HOST_STEP; sim.steer(g, s, HOST_STEP, speed); sim.chains.step(); }
  sim.bite(g, s, dt);
  sim.headsIn -= dt;
  if (sim.headsIn <= 0) { sim.headsIn = SWARM.headsEvery; s.heads = encodeHeads(sim.chains, s.out, s.ox, s.oz); }
  if (s.phase === 'retreat' && (s.t >= SWARM.retreat || !liveHeads(sim, s))) endSwarm(g);
}
// A swing throws nearby snakes apart. They live: they reform and come back.
// Returns how many it reached.
export function swingAtSwarm(g, p, kind) {
  const s = g.swarm, sim = g.swarmSim;
  if (!s || !sim || floorOf(p.x) !== s.floor) return 0;
  const { swing } = SWARM, r = kind === 'machete' ? swing.machete : swing.other, x = p.x + Math.sin(p.h) * swing.ahead, z = p.z + Math.cos(p.h) * swing.ahead;
  const hit = sim.chains.scatter(x, z, r, { seconds: swing.seconds, spot: (a, b) => sim.field.clear(p.x, p.z, a, b) });
  if (hit) g.event('snake-scatter', '', { player: p.id, x, z, r, px: p.x, pz: p.z });
  return hit;
}

// ---------- A client's view of it ----------
// Heads chase the synced ones; bodies follow on the same solver. Runs on every
// screen, the host's too, and writes nothing back.
export class SwarmFollower {
  constructor() { this.id = null; this.chains = null; this.heads = ''; this.time = 0; this.fieldIn = 0; }
  sync(s, L, state) {
    if (this.id !== s.id) {
      this.id = s.id; this.heads = ''; this.time = 0; this.fieldIn = .5;
      this.field = swarmField(L, s.floor, state); this.chains = makeChains(this.field, s.total, CLIENT_STEP);
      this.tx = new Float32Array(s.total); this.tz = new Float32Array(s.total); this.flags = new Uint8Array(s.total); this.hx = new Float32Array(s.total); this.hz = new Float32Array(s.total);
    }
    if (s.heads === this.heads) return;
    this.heads = s.heads;
    const { chains, tx, tz, flags } = this, n = decodeHeads(s.heads, s.ox, s.oz, tx, tz, flags);
    this.count = n;
    for (let c = 0; c < n; c++) {
      if (flags[c] & HEAD.alive) {
        if (!chains.alive[c]) { lay(chains, c, tx[c], tz[c], SWARM.link * .3); this.hx[c] = Math.cos(c * GOLDEN); this.hz[c] = Math.sin(c * GOLDEN); }
        // The host says it was thrown and we missed the event: stop and wait, at least.
        else if (flags[c] & HEAD.loose && chains.loose[c] <= 0 && chains.stiff[c] >= 1) chains.loose[c] = .3;
      } else if (chains.alive[c]) chains.remove(c);
    }
  }
  scatter(e) {
    if (!this.chains) return 0;
    const { field } = this;
    return this.chains.scatter(e.x, e.z, e.r, { seconds: SWARM.swing.seconds, spot: (a, b) => field.clear(e.px, e.pz, a, b) });
  }
  steer(h) {
    const { chains, tx, tz, hx, hz } = this, { x, z, alive, loose, stiff, points } = chains, turn = 1 - Math.exp(-8 * h);
    this.time += h;
    for (let c = 0, n = this.count || 0; c < n; c++) {
      if (!alive[c] || loose[c] > 0 || stiff[c] < SWARM.swing.stunned) continue;
      const k = c * points, dx = tx[c] - x[k], dz = tz[c] - z[k], d = Math.sqrt(dx * dx + dz * dz);
      // Far behind (a hitch, a new host): it was over there all along.
      if (d > 4) { lay(chains, c, tx[c], tz[c], SWARM.link * .5); continue; }
      if (d < .02) continue;
      const pace = Math.min(5, d / .2), wiggle = slither(this.time, c) * Math.min(1, d * 3);
      hx[c] += (dx / d - hx[c]) * turn; hz[c] += (dz / d - hz[c]) * turn;
      const len = Math.sqrt(hx[c] * hx[c] + hz[c] * hz[c]) || 1, fx = hx[c] / len, fz = hz[c] / len;
      chains.nudge(c, (fx - fz * wiggle) * pace * h, (fz + fx * wiggle) * pace * h);
    }
  }
  advance(dt, L, s, state) {
    this.fieldIn -= dt;
    if (this.fieldIn <= 0) { this.fieldIn = .5; const field = swarmField(L, s.floor, state); if (field !== this.field) { this.field = field; this.chains.field = field; } }
    const { chains } = this, h = chains.h;
    chains.carry = Math.min(chains.carry + dt, h * 4);
    while (chains.carry >= h) { chains.carry -= h; this.steer(h); chains.step(); }
  }
}
