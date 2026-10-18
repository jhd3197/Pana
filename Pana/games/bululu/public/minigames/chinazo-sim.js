// The pure core of ¡Chinazo!: iguana paths, the stones, the guacamaya and the
// AI shooters. No THREE here: minigames/chinazo.js draws it, and
// tests/chinazo.test.js plays hundreds of rounds for balance.
//
// Everything lives in world units (the patio, the mango tree, the wall). Aiming
// happens on screen: a reticle in NDC, so the sim carries its own copy of the
// fixed camera (CAMERA) and projects with it. A stone lands where the reticle
// was when it left the china; whatever is under that spot when it arrives gets
// hit, so moving iguanas must be led.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export const CHINAZO = Object.freeze({
  time: 40, plaga: 30,                // ¡Plaga! for the last 10 s
  ammo: 3, reload: 0.9,               // three mamones a load, like Duck Hunt's three shots
  minPull: 0.15, fullPull: 0.6,       // a tap still waits 0.15 s; 0.6 s is a full pull
  scale: 2.2,                         // iguanas are drawn bigger than life
  hitbox: 1.3,                        // forgiving: 1.3× the body
  golden: 3, bird: -2,
});

// The fixed camera: behind the panas, low, looking up into the tree.
export const CAMERA = Object.freeze({ pos: [0, 2.4, 7.6], look: [0, 5.9, -5], fov: 56 });
export const seatsFor = count => Array.from({ length: count }, (_, i) => [(i - (count - 1) / 2) * Math.min(2.2, 8.8 / (count - 1)), 0, 1.0]);
export const SEATS = Object.freeze(seatsFor(4));

// The patio, shared with the scene so paths sit on what's drawn.
export const TRUNK = Object.freeze({ x: 0, z: -4.6, r: 0.55, top: 6.4 });
export const BRANCHES = Object.freeze([
  { a: [-0.5, 6.0, -4.1], b: [-8.5, 5.1, -3.5], r: 0.22 },
  { a: [0.5, 6.2, -4.1], b: [8.4, 5.3, -3.5], r: 0.22 },
  { a: [-0.5, 8.6, -4.4], b: [-6.8, 9.7, -3.9], r: 0.17 },
  { a: [0.5, 8.7, -4.4], b: [6.8, 9.9, -3.9], r: 0.17 },
]);
export const WALL = Object.freeze({ x0: -14, x1: 14, top: 2.6, z: -9.6 });
export const ROOF = Object.freeze({ x0: 3.4, x1: 13.6, front: [3.5, -10.6], ridge: [5.2, -14.2] });   // [y, z], behind the wall
export const BUSHES = Object.freeze({ z: -2.7, top: 1.15 });
// Mangos hanging under the branches: a hit knocks one down (no points, a wasted stone).
export const MANGOS = Object.freeze(BRANCHES.flatMap((br, i) => [0.38, 0.66, 0.9].map((k, j) => {
  const p = mix(br.a, br.b, k);
  return [p[0] + (j - 1) * 0.15, p[1] - br.r - 0.42 - ((i + j) % 2) * 0.15, p[2] + 0.25];
})));

// A pinhole camera matching THREE.PerspectiveCamera + lookAt (up = +Y).
export function makeCamera(aspect = 16 / 9, { pos, look, fov } = CAMERA) {
  const f = norm(sub(look, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const t = Math.tan((fov / 2) * Math.PI / 180);
  return {
    aspect,
    project(p) {
      const d = sub(p, pos), z = dot(d, f);
      return { x: dot(d, r) / (z * t * this.aspect), y: dot(d, u) / (z * t), depth: z };
    },
    unproject(x, y, depth) { return add(add(add(pos, f, depth), r, x * t * this.aspect * depth), u, y * t * depth); },
    // a world radius at a depth, in NDC-y units (screen distances use x·aspect)
    size(radius, depth) { return radius / (depth * t); },
  };
}
const screenDist = (cam, a, b) => Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y);

// ---------- iguana paths: where an iguana is at time `s` since it appeared ----------
// Each returns { dur, at(s) → { pos, fwd, up, pose, gait } }. `pos` is on the
// surface under its belly; the body centre is a little above (see bodyAt).
const UP = [0, 1, 0];
function branchPath(br, { speed, eat, from }) {
  const len = Math.hypot(...sub(br.b, br.a));
  const eatAt = from;                             // 0..1 along tip → trunk
  const t1 = (len * eatAt) / speed, t2 = t1 + eat, t3 = t2 + (len * (1 - eatAt)) / speed;
  const dir = norm(sub(br.a, br.b));
  return {
    dur: t3, kind: 'rama',
    at(s) {
      const k = s < t1 ? (s / t1) * eatAt : s < t2 ? eatAt : eatAt + ((s - t2) / (t3 - t2)) * (1 - eatAt);
      const p = mix(br.b, br.a, clamp(k, 0, 1));
      const moving = s < t1 || s >= t2;
      return { pos: [p[0], p[1] + br.r * 0.9, p[2]], fwd: dir, up: UP, pose: moving ? 'run' : 'perch', gait: moving ? s * speed * 7 : 0, eating: !moving };
    },
  };
}
// Pops up over the wall somewhere and runs 11–15 m along the top.
function wallPath({ speed, start, run }) {
  const x0 = start, x1 = clamp(start + (start < 0 ? run : -run), WALL.x0 + 0.5, WALL.x1 - 0.5);
  const dur = Math.abs(x1 - x0) / speed;
  return { dur, kind: 'pared',
    at: (s) => ({ pos: [lerp(x0, x1, s / dur), WALL.top, WALL.z], fwd: [Math.sign(x1 - x0), 0, 0], up: UP, pose: 'run', gait: s * speed * 6 }) };
}
function trunkPath({ speed, phase }) {
  const y0 = 0.9, y1 = TRUNK.top, dur = (y1 - y0) / speed, z = TRUNK.z + TRUNK.r + 0.04;
  return { dur, kind: 'tronco',
    at(s) {
      const y = y0 + s * speed, zig = Math.sin(y * 2.4 + phase);
      return { pos: [TRUNK.x + zig * 0.42, y, z], fwd: norm([Math.cos(y * 2.4 + phase) * 0.42 * 2.4, 1, 0]), up: [0, 0, 1], pose: 'run', gait: s * speed * 7 };
    } };
}
// The leaves rustle for half a second (RUSTLE), then it drops: on screen 0.6 s.
export const RUSTLE = 0.5;
function fallPath({ x, y0 }) {
  const drop = y0 - BUSHES.top, fall = 0.6, g = (2 * drop) / (fall * fall), z = BUSHES.z - 0.6;
  return { dur: RUSTLE + fall, kind: 'caida', x,
    at(s) {
      const f = Math.max(0, s - RUSTLE);
      return { pos: [x, y0 - 0.5 * g * f * f, z], fwd: [0, 0, 1], up: UP, pose: 'perch', gait: 0, spin: f * 9, hidden: s < RUSTLE };
    } };
}
// Sunning: on the zinc roof (right) or on the wall top (left). Still, far
// away, then off over the ridge or down behind the wall.
const roofAt = (z) => ROOF.front[0] + ((z - ROOF.front[1]) / (ROOF.ridge[1] - ROOF.front[1])) * (ROOF.ridge[0] - ROOF.front[0]);
const ROOF_UP = norm([0, ROOF.front[1] - ROOF.ridge[1], ROOF.ridge[0] - ROOF.front[0]]);
function sunPath({ x, still }) {
  if (x < 0) {
    const leave = 0.45, dur = still + leave;
    return { dur, kind: 'sol', x,
      at(s) {
        const k = Math.max(0, s - still) / leave;
        return { pos: [x, WALL.top - k * k * 1.4, WALL.z - k * 0.7], fwd: k ? [0, 0, -1] : [1, 0, 0], up: UP, pose: k ? 'run' : 'sun', gait: k * 12 };
      } };
  }
  const z0 = ROOF.front[1] - 0.9, z1 = ROOF.ridge[1] + 0.2, leave = 0.7, dur = still + leave;
  return { dur, kind: 'sol', x,
    at(s) {
      if (s < still) return { pos: [x, roofAt(z0), z0], fwd: [1, 0, 0], up: ROOF_UP, pose: 'sun', gait: 0 };
      const z = lerp(z0, z1, (s - still) / leave);
      return { pos: [x, roofAt(z), z], fwd: norm([0, ROOF.ridge[0] - ROOF.front[0], ROOF.ridge[1] - ROOF.front[1]]), up: ROOF_UP, pose: 'run', gait: (s - still) * 30 };
    } };
}

// The guacamaya crossing the sky in front of the tree. Hitting it costs 2.
function birdPath(random) {
  const left = random() < 0.5, y = 7 + random() * 3.6, z = -1.6 - random() * 1.6, speed = 5.4 + random() * 1.2;
  const x0 = left ? -13 : 13, dur = 26 / speed;
  return { dur, at: (s) => ({ pos: [x0 + (left ? 1 : -1) * speed * s, y + Math.sin(s * 3) * 0.35, z], fwd: [left ? 1 : -1, 0, 0] }) };
}

// AI shooters (Step 3 of plan 57). A profile is how good the aim is.
export const AI = Object.freeze({
  bot: { react: [0.22, 0.34], lead: [0.15, 0.3], miss: 0.08, birdRisk: 0.05, pull: [0.2, 0.32], move: 8, maxSpeed: 3, fireAt: 0.7, roam: 0.6, perfect: false },
  // the "decent human" used by the balance test: perfect lead, 0.2 s reactions
  ace: { react: [0.2, 0.2], lead: [0, 0], miss: 0, birdRisk: 0, pull: [0.2, 0.32], move: 8, maxSpeed: 3, fireAt: 0.35, roam: 0.6, perfect: true },
});

// Each pana keeps an eye on one half of the screen, two panas per half (like
// Atrapa's AIs favour their side). Four separate home spots made the outer seats
// win ~30% and the middle ones ~19%: the middle ones have two rivals each.

export function chinazoSim({ humans = new Set(), random = Math.random, aspect = 16 / 9, profiles = [], count = 4 } = {}) {
  const cam = makeCamera(aspect);
  const seats = seatsFor(count), home = Array.from({ length: count }, (_, i) => i < count / 2 ? -0.3 : 0.3);
  const rnd = (a, b) => a + random() * (b - a);
  let time = 0, plaga = false, nextWave = 0.6, nextBird = rnd(5, 8), golden = false, uid = 0;
  const goldenAt = rnd(21, 29);
  const iguanas = [], birds = [], stones = [], events = [];
  const mangos = MANGOS.map((pos, i) => ({ i, pos, down: false }));
  const shooters = Array.from({ length: count }, (_, i) => ({
    i, aim: { x: home[i], y: i % 2 ? 0.25 : -0.05 }, ammo: CHINAZO.ammo, reload: 0, pulling: false, queued: false, holdT: 0,
    score: 0, shots: 0, hits: 0, birdHits: 0, mangoHits: 0,
    ai: humans.has(i) ? null : { profile: profiles[i] || AI.bot, wait: rnd(0.3, 0.7), target: null, goal: null, pullGoal: 0, err: 0, miss: null, reckless: false, v: { x: 0, y: 0 } },
  }));

  const order = [...shooters];
  const value = (ig) => (ig.golden ? CHINAZO.golden : 1);
  const radiusOf = (ig) => 0.42 * CHINAZO.scale * CHINAZO.hitbox;
  // the body centre, a little above the surface along `up` and forward of the origin
  const bodyAt = (st) => add(add(st.pos, st.up, 0.13 * CHINAZO.scale), st.fwd, 0.05 * CHINAZO.scale);
  const live = (ig) => !ig.hit && !ig.gone;
  const stateOf = (ig, at = time) => ig.path.at(clamp(at - ig.born, 0, ig.path.dur));

  // ---------- spawning ----------
  function freeBranch() {
    const busy = new Set(iguanas.filter((g) => live(g) && g.branch != null).map((g) => g.branch));
    const free = BRANCHES.map((_, i) => i).filter((i) => !busy.has(i));
    return free.length ? free[Math.floor(random() * free.length)] : null;
  }
  function spawn({ gold = false } = {}) {
    const fast = gold ? 1.6 : 1;
    const weights = plaga ? [['rama', 3], ['pared', 2], ['tronco', 2.5], ['caida', 2.5], ['sol', 1]] : [['rama', 3], ['pared', 2], ['tronco', 2], ['caida', 1.4], ['sol', 1.2]];
    let kind = gold ? (random() < 0.5 ? 'rama' : 'pared') : null;
    if (!kind) {
      let r = random() * weights.reduce((n, w) => n + w[1], 0);
      kind = weights.find((w) => (r -= w[1]) < 0)?.[0] || 'rama';
    }
    let path, branch = null;
    if (kind === 'rama') {
      branch = freeBranch();
      if (branch == null) kind = 'pared';
      else path = branchPath(BRANCHES[branch], { speed: rnd(2.2, 2.7) * fast, eat: gold ? rnd(0.4, 0.6) : rnd(0.8, 1.3), from: rnd(0.3, 0.5) });
    }
    if (kind === 'pared') path = wallPath({ speed: rnd(4.8, 5.6) * fast, start: rnd(WALL.x0 + 1, WALL.x1 - 1), run: rnd(11, 15) });
    if (kind === 'tronco') {
      if (iguanas.some((g) => live(g) && g.path.kind === 'tronco')) return spawn({ gold });
      path = trunkPath({ speed: rnd(1.9, 2.3), phase: rnd(0, 6) });
    }
    if (kind === 'caida') path = fallPath({ x: rnd(-7, 6.5), y0: rnd(8.8, 10.2) });
    if (kind === 'sol') {
      const taken = iguanas.filter((g) => live(g) && g.path.kind === 'sol').map((g) => g.x);
      const x = random() < 0.5 ? -rnd(ROOF.x0 + 1.2, ROOF.x1 - 1.8) : rnd(ROOF.x0 + 1.2, ROOF.x1 - 1.8);
      if (taken.some((t) => Math.abs(t - x) < 2.4)) return spawn({ gold });
      path = sunPath({ x, still: rnd(2.2, 3.2) });
    }
    const ig = { id: uid++, path, born: time, branch, golden: gold, x: path.x, hit: null, gone: false, seed: Math.floor(random() * 1000) };
    iguanas.push(ig);
    events.push({ type: 'spawn', iguana: ig });
    return ig;
  }

  // ---------- stones ----------
  function fire(sh) {
    const power = clamp((sh.holdT - CHINAZO.minPull) / (CHINAZO.fullPull - CHINAZO.minPull), 0, 1);
    // the stone heads for whatever is near the reticle now, or the tree behind it
    let depth = 15.5;
    for (const t of targets()) {
      const p = cam.project(t.body);
      if (screenDist(cam, p, sh.aim) < cam.size(t.r, p.depth) * 2) depth = Math.min(depth, p.depth);
    }
    const dur = clamp((0.27 + depth * 0.008) * (1.12 - 0.3 * power), 0.25, 0.42);
    const from = add(seats[sh.i], [0.25, 1.55, -0.45]);
    const stone = { seat: sh.i, intended: sh.ai?.shotAt || null, aim: { ...sh.aim }, from, to: cam.unproject(sh.aim.x, sh.aim.y, depth), t: 0, dur, power, born: time };
    stones.push(stone);
    sh.ammo--; sh.shots++; sh.pulling = sh.queued = false; sh.holdT = 0;
    if (!sh.ammo) sh.reload = CHINAZO.reload;
    // what it will hit if nothing changes, so AIs leave that one alone
    const doomed = targets(time + dur).filter((t) => t.kind === 'iguana').find((t) => {
      const p = cam.project(t.body);
      return screenDist(cam, p, stone.aim) <= cam.size(t.r, p.depth);
    });
    stone.target = doomed?.it || null;
    events.push({ type: 'shot', seat: sh.i, stone });
    return stone;
  }
  // Everything a stone can hit, with its body centre and world radius.
  function targets(at = time) {
    const list = [];
    for (const ig of iguanas) if (live(ig) && at - ig.born <= ig.path.dur && !stateOf(ig, at).hidden) list.push({ kind: 'iguana', it: ig, body: bodyAt(stateOf(ig, at)), r: radiusOf(ig) });
    for (const b of birds) if (!b.hit && at - b.born <= b.path.dur) list.push({ kind: 'bird', it: b, body: b.path.at(at - b.born).pos, r: 0.62 * CHINAZO.hitbox });
    for (const m of mangos) if (!m.down) list.push({ kind: 'mango', it: m, body: m.pos, r: 0.26 * CHINAZO.hitbox });
    return list;
  }
  function land(stone) {
    // nearest thing to the camera that sits under where the stone was aimed
    let best = null;
    for (const t of targets()) {
      const p = cam.project(t.body);
      if (p.depth <= 0 || screenDist(cam, p, stone.aim) > cam.size(t.r, p.depth)) continue;
      if (!best || p.depth < best.depth) best = { ...t, depth: p.depth };
    }
    const sh = shooters[stone.seat];
    stone.hit = best;
    if (!best) return events.push({ type: 'miss', seat: sh.i, stone });
    if (best.kind === 'iguana') {
      const ig = best.it;
      ig.hit = { seat: sh.i, at: time, state: stateOf(ig) };
      sh.score += value(ig); sh.hits++;
      events.push({ type: 'hit', seat: sh.i, iguana: ig, stone });
    } else if (best.kind === 'bird') {
      best.it.hit = { seat: sh.i, at: time };
      sh.score += CHINAZO.bird; sh.birdHits++;
      events.push({ type: 'bird', seat: sh.i, bird: best.it, stone });
    } else {
      best.it.down = time;
      sh.mangoHits++;
      events.push({ type: 'mango', seat: sh.i, mango: best.it, stone });
    }
  }

  // ---------- AI ----------
  function aiTick(sh, dt) {
    const ai = sh.ai, P = ai.profile;
    const tracked = ai.target && live(ai.target) && time - ai.target.born < ai.target.path.dur - 0.05
      && !stones.some((s) => s.target === ai.target);   // someone's stone is already on its way
    if (!tracked) {
      ai.target = ai.prevGoal = null;
      ai.wait -= dt;
      if (ai.wait <= 0) pick(sh);
    }
    // where to put the reticle: the lead point, or drift back toward the middle
    let goal = null;
    if (ai.target) {
      const ig = ai.target, dur = flightGuess(sh);
      let at;
      if (P.perfect) at = bodyAt(stateOf(ig, time + dur));
      else {
        const now = bodyAt(stateOf(ig)), prev = bodyAt(stateOf(ig, time - 0.06));
        const v = sub(now, prev).map((c) => c / 0.06);
        at = add(now, v, dur * (1 + ai.err));
      }
      goal = cam.project(at);
      if (ai.miss) goal = { x: goal.x + ai.miss.x, y: goal.y + ai.miss.y, depth: goal.depth };
      ai.goal = goal;
    }
    const want = goal || { x: lerp(sh.aim.x, home[sh.i], 0.03), y: lerp(sh.aim.y, 0.1, 0.03) };
    // follow the goal's own motion (like a hand tracking it), then close the gap
    const prev = ai.prevGoal, drift = goal && prev && dt > 0 ? { x: (goal.x - prev.x) / dt, y: (goal.y - prev.y) / dt } : { x: 0, y: 0 };
    ai.prevGoal = goal;
    const k = Math.min(1, dt * P.move);
    let vx = (((want.x - sh.aim.x) * k) / dt || 0) + clamp(drift.x, -3, 3), vy = (((want.y - sh.aim.y) * k) / dt || 0) + clamp(drift.y, -3, 3);
    const sp = Math.hypot(vx, vy);
    if (sp > P.maxSpeed) { vx *= P.maxSpeed / sp; vy *= P.maxSpeed / sp; }
    sh.aim.x = clamp(sh.aim.x + vx * dt, -1, 1);
    sh.aim.y = clamp(sh.aim.y + vy * dt, -1, 1);
    // pull while lining up, let go once close enough
    if (sh.reload > 0 || !ai.target) return { pull: false, fire: false };
    if (!sh.pulling) return { pull: true, fire: false };
    const r = cam.size(radiusOf(ai.target), goal.depth);
    const close = screenDist(cam, sh.aim, goal) < r * (ai.miss ? 0.4 : P.fireAt);
    if (!close || sh.holdT < ai.pullGoal) return { pull: true, fire: false };
    if (!ai.reckless && birdInTheWay(sh)) return { pull: true, fire: false };
    // shot away: aim for something else next, after a moment
    ai.shotAt = ai.target;
    ai.target = null;
    ai.wait = 0.05;
    return { pull: false, fire: true };
  }
  function flightGuess(sh) {
    const power = clamp((Math.max(sh.holdT, sh.ai?.pullGoal || 0) - CHINAZO.minPull) / (CHINAZO.fullPull - CHINAZO.minPull), 0, 1);
    const depth = sh.ai?.goal?.depth || 14;
    return clamp((0.27 + depth * 0.008) * (1.12 - 0.3 * power), 0.25, 0.42);
  }
  function birdInTheWay(sh) {
    const dur = flightGuess(sh);
    return birds.some((b) => {
      if (b.hit || time + dur - b.born > b.path.dur) return false;
      const p = cam.project(b.path.at(time + dur - b.born).pos);
      return screenDist(cam, p, sh.aim) < cam.size(0.62 * CHINAZO.hitbox, p.depth) * 1.3;
    });
  }
  function pick(sh) {
    const ai = sh.ai, P = ai.profile;
    let best = null, bestScore = 0;
    for (const ig of iguanas) {
      if (!live(ig)) continue;
      const left = ig.path.dur - (time - ig.born);
      if (left < 0.5 || stateOf(ig).hidden) continue;
      // don't chase one our own stone is already flying at
      // nor one a stone is already flying at (anyone's: you can see it coming)
      if (stones.some((s) => s.target === ig)) continue;
      const now = bodyAt(stateOf(ig)), soon = bodyAt(stateOf(ig, time + 0.25));
      const p = cam.project(now), q = cam.project(soon);
      if (Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) continue;
      const speed = screenDist(cam, p, q) / 0.25;
      const dist = screenDist(cam, p, sh.aim);
      // leave it to a pana whose reticle is clearly closer (Atrapa's AIs do the same)
      const beaten = shooters.some((o) => o !== sh && screenDist(cam, p, o.aim) < dist - 0.15);
      const roam = 1 + Math.abs(p.x - home[sh.i]) * P.roam;
      const score = (value(ig) / (speed + 0.35)) / (dist + 0.4) / roam * (0.75 + random() * 0.5) * (beaten ? 0.2 : 1);
      if (score > bestScore) { bestScore = score; best = ig; }
    }
    if (!best) { ai.wait = 0.12; return; }
    ai.target = best;
    ai.pullGoal = rnd(...P.pull);
    const [e0, e1] = P.lead;
    ai.err = (random() < 0.5 ? -1 : 1) * rnd(e0, e1);
    const a = random() * Math.PI * 2, r = 0.22 + random() * 0.12;
    ai.miss = random() < P.miss ? { x: (Math.cos(a) * r) / cam.aspect, y: Math.sin(a) * r } : null;
    ai.reckless = random() < P.birdRisk;
    ai.delay = rnd(...P.react);       // reaction before the reticle starts moving
  }

  // ---------- the clock ----------
  function update(dt, inputs = []) {
    time += dt;
    if (!plaga && time >= CHINAZO.plaga) { plaga = true; events.push({ type: 'plaga' }); }
    // waves: 2 at first, 2–3 later, a crawling tree for the ¡Plaga!
    nextWave -= dt;
    const alive = iguanas.filter(live).length;
    const cap = plaga ? 9 : time < 12 ? 4 : 6;
    if (nextWave <= 0 && time < CHINAZO.time - 0.6) {
      const n = plaga ? 3 + Math.floor(random() * 2) : time < 12 ? 2 : 2 + Math.floor(random() * 2);
      for (let k = 0; k < Math.min(n, cap - alive); k++) spawn();
      nextWave = plaga ? rnd(1.1, 1.6) : rnd(2.1, 2.7);
    }
    if (!golden && time >= goldenAt) { golden = true; spawn({ gold: true }); }
    nextBird -= dt;
    if (nextBird <= 0 && time < CHINAZO.time - 3) {
      const b = { id: uid++, path: birdPath(random), born: time, hit: null };
      birds.push(b);
      events.push({ type: 'birdIn', bird: b });
      nextBird = rnd(7, 11);
    }
    // escapes
    for (const ig of iguanas) if (live(ig) && time - ig.born > ig.path.dur) { ig.gone = time; events.push({ type: 'escape', iguana: ig }); }

    // a fresh order every frame, so no seat always gets the first shot in
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    for (const sh of order) {
      if (sh.reload > 0 && (sh.reload -= dt) <= 0) { sh.reload = 0; sh.ammo = CHINAZO.ammo; events.push({ type: 'reloaded', seat: sh.i }); }
      let input;
      if (sh.ai) {
        if (sh.ai.delay > 0) { sh.ai.delay -= dt; input = { pull: sh.pulling, fire: false }; }
        else input = aiTick(sh, dt);
      } else {
        input = inputs[sh.i] || {};
        if (input.aim) { sh.aim.x = clamp(input.aim.x, -1, 1); sh.aim.y = clamp(input.aim.y, -1, 1); }
      }
      // pull → release; a release before the minimum pull fires once it's reached
      const can = sh.ammo > 0 && sh.reload <= 0;
      if (!sh.pulling && input.pull && can) { sh.pulling = true; sh.holdT = 0; }
      if (sh.pulling) {
        sh.holdT += dt;
        if (input.fire) sh.queued = true;
        else if (!input.pull && !sh.queued) { sh.pulling = false; sh.holdT = 0; }
        if (sh.queued && sh.holdT >= CHINAZO.minPull) {
          fire(sh);
        }
      }
    }
    for (const s of stones) {
      s.t += dt;
      if (!s.done && s.t >= s.dur) { s.done = true; land(s); }
    }
    for (let k = stones.length - 1; k >= 0; k--) if (stones[k].done) stones.splice(k, 1);
  }

  const scores = () => shooters.map((s) => s.score);
  return {
    cam, iguanas, birds, mangos, stones, shooters, events,
    get time() { return time; }, get plaga() { return plaga; },
    update, scores, stateOf, bodyAt, live,
    // top score wins; nobody wins at 0 or below
    winners() {
      const s = scores(), best = Math.max(...s);
      return best > 0 ? s.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0) : [];
    },
    stats: () => ({ shots: shooters.map((s) => s.shots), hits: shooters.map((s) => s.hits), birds: shooters.map((s) => s.birdHits),
      mangos: shooters.map((s) => s.mangoHits), iguanas: iguanas.length, escaped: iguanas.filter((g) => g.gone).length }),
  };
}
