// Pure cores of Bululú's river minigames, shared with Curiara's paddle model
// (/engine/paddle.js). No THREE here: the minigame modules draw these, and
// tests/river-minigames.test.js plays thousands of rounds for balance.
//
// Every sim takes `humans`: a Set of seat indices the players drive. AIs play
// the other seats. update(dt, inputs) takes inputs[i] = {x, jump} per human.
import { paddleState, stroke, step, axisStroke, PADDLE } from '/engine/paddle.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// An AI paddler: strokes alternate near the sweet spot, with its own wobble,
// the odd same-side slip and a lost beat now and then.
function rhythm(random) {
  const skill = .55 + random() * .45;
  return { skill, next: .2 + random() * .4, side: random() < .5 ? -1 : 1,
    // Returns a side to stroke this tick, or 0.
    tick(dt) {
      this.next -= dt;
      if (this.next > 0) return 0;
      const lapse = random() < .03 + (1 - this.skill) * .05;
      this.next = lapse ? .7 + random() * .5 : Math.max(.26, PADDLE.sweet[0] + .03 + (1 - this.skill) * .2 + (random() - .5) * (.06 + (1 - this.skill) * .26));
      if (random() > .04 + (1 - this.skill) * .06) this.side = -this.side;
      return this.side;
    } };
}
// A pana's paddle driven by a Bululú stick: a stroke is x reaching ±1.
function paddler() { return { paddle: paddleState(), prevX: 0, v: 0 }; }
function strokeFrom(p, input, time) { const side = axisStroke(p.prevX, input?.x || 0); p.prevX = input?.x || 0; if (side) stroke(p.paddle, side, time); return side; }

// ---------- ¡Remada! · 4 canoes, a straight 120 m sprint ----------
export const REMADA = Object.freeze({ length: 120, time: 35, drag: .6 });
export function remadaSim({ humans = new Set(), random = Math.random, count = 4 } = {}) {
  let time = 0;
  const order = [], racers = Array.from({ length: count }, (_, i) => ({ i, ...paddler(), s: 0, finish: null, strokes: 0, ai: humans.has(i) ? null : rhythm(random) }));
  return {
    racers, order, get time() { return time; },
    update(dt, inputs = []) {
      time += dt;
      for (const r of racers) {
        if (r.finish == null) {
          const side = r.ai ? r.ai.tick(dt) : strokeFrom(r, inputs[r.i], time);
          if (r.ai && side) stroke(r.paddle, side, time);
          if (side) r.strokes++;
        }
        r.v += step(r.paddle, dt).thrust; r.v -= REMADA.drag * r.v * dt;
        if (r.finish != null) r.v *= Math.exp(-2 * dt);
        r.s += r.v * dt;
        if (r.finish == null && r.s >= REMADA.length) { r.finish = time; order.push(r.i); }
      }
    },
    over: () => racers.every(r => r.finish != null),
    scores: () => racers.map(r => Math.round(Math.min(REMADA.length, r.s))),
    // First over the line wins; on time, whoever got furthest.
    winners() {
      if (order.length) return [order[0]];
      const best = Math.max(...racers.map(r => r.s));
      return best > 0 ? racers.filter(r => r.s === best).map(r => r.i) : [];
    },
  };
}

// ---------- ¡Raudal! · parallel rapids side by side, three lanes each ----------
// The current carries everyone at the same speed over the same pattern of
// rocks, mangos and ledges. A/D switch lanes, Space jumps a ledge.
export const RAUDAL = Object.freeze({ time: 35, speed: 8, row: 7, ledgeEvery: 5, jump: [.08, .45], stun: .9, ledgeStun: .6, lanes: 3 });
export function raudalPattern(random = Math.random, length = RAUDAL.time * RAUDAL.speed + 40) {
  const rows = [];
  for (let k = 0, s = 24; s < length; k++, s += RAUDAL.row) {
    if (k % RAUDAL.ledgeEvery === RAUDAL.ledgeEvery - 1) { rows.push({ s, ledge: true }); continue; }
    const rock = Math.floor(random() * 3), second = random() < .25 ? (rock + 1 + Math.floor(random() * 2)) % 3 : -1;
    const free = [0, 1, 2].filter(l => l !== rock && l !== second);
    rows.push({ s, rocks: [rock, second].filter(l => l >= 0), mango: random() < .8 ? free[Math.floor(random() * free.length)] : -1 });
  }
  return rows;
}
export function raudalSim({ humans = new Set(), random = Math.random, count = 4, pattern = raudalPattern(random) } = {}) {
  let time = 0, s = 0;
  const canoes = Array.from({ length: count }, (_, i) => ({ i, lane: 1, x: 1, score: 0, stun: 0, jumping: 0, jumpAt: -9, prevX: 0, hits: 0, jumps: 0, splashes: 0, got: new Set(), passed: 0,
    ai: humans.has(i) ? null : { skill: .5 + random() * .5, plan: null, jumpIn: null } }));
  const ahead = (c, from, to) => pattern.filter(r => r.s > from && r.s <= to);
  function think(c, dt) {
    const ai = c.ai, input = { x: 0, jump: false };
    // Next row within reaction distance: dodge rocks, reach for mangos.
    const react = .22 + (1 - ai.skill) * .3, row = ahead(c, s, s + RAUDAL.speed * (react + .5)).find(r => !r.ledge);
    if (row && ai.plan?.row !== row) {
      const lanes = [0, 1, 2].filter(l => !row.rocks.includes(l));
      // Sometimes greedy for a mango two lanes away, sometimes asleep.
      const wantMango = row.mango >= 0 && Math.abs(row.mango - c.lane) <= (ai.skill > .8 ? 2 : 1) && random() < .5 + ai.skill * .45;
      let goal = wantMango ? row.mango : lanes.includes(c.lane) ? c.lane : lanes.sort((a, b) => Math.abs(a - c.lane) - Math.abs(b - c.lane))[0];
      if (random() < .14 - ai.skill * .1) goal = c.lane;
      ai.plan = { row, goal, at: time + react * (.6 + random() * .8) };
    }
    // A lane change is a tap, so let go between taps.
    if (ai.plan && time >= ai.plan.at && c.lane !== ai.plan.goal && c.prevX === 0) input.x = Math.sign(ai.plan.goal - c.lane);
    // Ledges: press Space a beat before the drop.
    const ledge = ahead(c, s, s + RAUDAL.speed * .7).find(r => r.ledge);
    if (ledge && ai.jumpIn?.row !== ledge) ai.jumpIn = { row: ledge, t: random() < .1 + (1 - ai.skill) * .15 ? (random() < .5 ? .02 : .6) : .12 + random() * .26 };
    if (ai.jumpIn && !ai.jumpIn.done && (ai.jumpIn.row.s - s) / RAUDAL.speed <= ai.jumpIn.t) { input.jump = true; ai.jumpIn.done = true; }
    return input;
  }
  return {
    canoes, pattern, get s() { return s; }, get time() { return time; },
    update(dt, inputs = []) {
      time += dt; const before = s; s += RAUDAL.speed * dt;
      for (const c of canoes) {
        c.stun = Math.max(0, c.stun - dt); c.jumping = Math.max(0, c.jumping - dt);
        const input = c.ai ? think(c, dt) : inputs[c.i] || {};
        // A lane switch is an edge of x, like a stroke.
        const move = input.x && input.x !== c.prevX ? Math.sign(input.x) : 0;
        c.prevX = input.x || 0;
        if (move && c.stun === 0) c.lane = clamp(c.lane + move, 0, 2);
        if (input.jump && c.jumping === 0) { c.jumping = .55; c.jumpAt = time; }
        c.x += (c.lane - c.x) * Math.min(1, dt * 12);
        for (const r of pattern) {
          if (r.s <= before || r.s > s) continue;
          if (r.ledge) {
            const early = time - c.jumpAt;
            if (early >= RAUDAL.jump[0] && early <= RAUDAL.jump[1]) { c.score++; c.jumps++; }
            else { c.stun = Math.max(c.stun, RAUDAL.ledgeStun); c.splashes++; }
            continue;
          }
          const lane = Math.round(c.x);
          if (r.rocks.includes(lane) && Math.abs(c.x - lane) < .35) { c.score = Math.max(0, c.score - 1); c.stun = RAUDAL.stun; c.hits++; }
          else if (r.mango === lane && c.stun === 0 && !c.got.has(r)) { c.got.add(r); c.score++; }
        }
      }
    },
    scores: () => canoes.map(c => c.score),
  };
}

// ---------- ¡Remolino! · paddle away from a growing whirlpool ----------
// Canoes point outward on their own; strokes push them away from the eye.
// Space shoves a neighbour toward it. Last one out of the eye wins.
export const REMOLINO = Object.freeze({ time: 35, lagoon: 13, eye: [1.6, 6.5], pull: [1.2, 6.8], radius: 1.15, shove: 2.6, reach: 2.6, cooldown: 3, stun: .45, swirl: 3.4 });
export function remolinoSim({ humans = new Set(), random = Math.random, count = 4 } = {}) {
  let time = 0, done = false;
  const canoes = Array.from({ length: count }, (_, i) => ({ i, ...paddler(), r: 8.5, a: i * TAU / count + (i % 2 ? -.5 : .5), out: null, stun: 0, cd: 1 + random(), shoves: 0, shoved: 0, ai: humans.has(i) ? null : { ...rhythm(random), mean: .4 + random() * .5 } }));
  const eye = () => REMOLINO.eye[0] + (REMOLINO.eye[1] - REMOLINO.eye[0]) * clamp(time / REMOLINO.time, 0, 1);
  const pull = c => (REMOLINO.pull[0] + (REMOLINO.pull[1] - REMOLINO.pull[0]) * clamp(time / REMOLINO.time, 0, 1)) * (.9 + .5 * (1 - c.r / REMOLINO.lagoon));
  const xy = c => [Math.cos(c.a) * c.r, Math.sin(c.a) * c.r];
  const alive = () => canoes.filter(c => c.out == null);
  function shove(c) {
    if (c.cd > 0 || c.stun > 0) return;
    c.cd = REMOLINO.cooldown;
    const [x, z] = xy(c);
    let best = null, d = Infinity;
    for (const o of alive()) { if (o === c) continue; const [ox, oz] = xy(o), e = Math.hypot(ox - x, oz - z) - 2 * REMOLINO.radius; if (e < d) { d = e; best = o; } }
    if (best && d <= REMOLINO.reach) { best.v -= REMOLINO.shove; best.stun = REMOLINO.stun; c.shoves++; best.shoved++; }
  }
  return {
    canoes, eye, get time() { return time; },
    update(dt, inputs = []) {
      if (done) return;
      time += dt;
      for (const c of canoes) {
        if (c.out != null) continue;
        c.stun = Math.max(0, c.stun - dt); c.cd = Math.max(0, c.cd - dt);
        if (c.ai) {
          const side = c.stun ? 0 : c.ai.tick(dt); if (side) stroke(c.paddle, side, time);
          const [x, z] = xy(c);
          if (c.cd === 0 && alive().some(o => o !== c && Math.hypot(xy(o)[0] - x, xy(o)[1] - z) < REMOLINO.reach + 2 * REMOLINO.radius - .2) && random() < dt * (1.2 + c.ai.mean * 2)) shove(c);
        } else {
          if (!c.stun) strokeFrom(c, inputs[c.i], time); else c.prevX = inputs[c.i]?.x || 0;
          if (inputs[c.i]?.jump) shove(c);
        }
        c.v += step(c.paddle, dt).thrust; c.v -= .6 * c.v * dt;
        c.r = Math.min(REMOLINO.lagoon, c.r + (c.v - pull(c)) * dt);
        if (c.r >= REMOLINO.lagoon) c.v = Math.min(c.v, 0);
        c.a += REMOLINO.swirl / Math.max(2, c.r) * dt;
      }
      // Circle collisions in the lagoon's plane.
      const live = alive();
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const A = live[i], B = live[j], [ax, az] = xy(A), [bx, bz] = xy(B), dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1e-3, gap = 2 * REMOLINO.radius - d;
        if (gap <= 0) continue;
        const nx = dx / d * gap / 2, nz = dz / d * gap / 2;
        for (const [c, x, z] of [[A, ax - nx, az - nz], [B, bx + nx, bz + nz]]) { c.r = Math.min(REMOLINO.lagoon, Math.hypot(x, z)); c.a = Math.atan2(z, x); }
      }
      for (const c of alive()) if (c.r < eye()) c.out = time;
      if (alive().length <= 1) done = true;
    },
    over: () => done,
    scores: () => canoes.map(c => Math.floor(c.out ?? time)),
    winners() { const live = alive(); if (live.length) return live.map(c => c.i); const last = Math.max(...canoes.map(c => c.out)); return canoes.filter(c => c.out === last).map(c => c.i); },
  };
}
