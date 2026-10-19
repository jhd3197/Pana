// River geometry and water, pure JS. Shared by Curiara and Lancha: their
// simulations, the scenery and the minimaps. Each game owns its courses. A river is a point-to-point spline with distance `s`
// downstream and a signed `offset` across (positive = right bank, looking
// downstream). Everything else is a function of (s, offset): width, water
// level (raudales drop it), the current, eddies, the whirlpool and rocks.
// Heading `h` follows Galope: forward is (sin h, cos h); h grows to the left.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function seededRandom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A sampled Catmull-Rom path, about one sample per metre.
export function makePath(nodes) {
  const pts = [nodes[0].map((v, i) => 2 * v - nodes[1][i]), ...nodes, nodes.at(-1).map((v, i) => 2 * v - nodes.at(-2)[i])];
  const curve = t => {
    const k = Math.min(Math.floor(t), nodes.length - 2), u = t - k, p = [0, 1, 2, 3].map(i => pts[k + i]);
    return [0, 1].map(a => .5 * (2 * p[1][a] + (-p[0][a] + p[2][a]) * u + (2 * p[0][a] - 5 * p[1][a] + 4 * p[2][a] - p[3][a]) * u * u + (-p[0][a] + 3 * p[1][a] - 3 * p[2][a] + p[3][a]) * u * u * u));
  };
  const rough = [];
  for (let i = 1; i < nodes.length; i++) rough.push(Math.hypot(nodes[i][0] - nodes[i - 1][0], nodes[i][1] - nodes[i - 1][1]));
  const count = Math.ceil(rough.reduce((a, b) => a + b, 0) * 1.4), samples = [];
  let length = 0;
  for (let i = 0; i <= count; i++) {
    const [x, z] = curve(i / count * (nodes.length - 1));
    if (i) length += Math.hypot(x - samples[i - 1].x, z - samples[i - 1].z);
    samples.push({ x, z, s: length });
  }
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    samples[i].h = Math.atan2(b.x - a.x, b.z - a.z);
  }
  // Signed curvature (rad/m, > 0 bends left), smoothed over ~12 m.
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 6)], b = samples[Math.min(samples.length - 1, i + 6)];
    samples[i].k = angle(b.h - a.h) / Math.max(1, b.s - a.s);
  }
  const index = s => {
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].s < s) lo = mid; else hi = mid; }
    return lo;
  };
  function at(s, offset = 0) {
    s = clamp(s, 0, length);
    const i = index(s), a = samples[i], b = samples[i + 1] || a, t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    const h = a.h + angle(b.h - a.h) * t;
    return { x: lerp(a.x, b.x, t) - Math.cos(h) * offset, z: lerp(a.z, b.z, t) + Math.sin(h) * offset, h, s, k: lerp(a.k, b.k, t) };
  }
  function project(x, z, i) {
    const a = samples[i], b = samples[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    return { d2: (x - px) ** 2 + (z - pz) ** 2, x: px, z: pz, s: a.s + (b.s - a.s) * t, i };
  }
  // Closest point. `hint` (a recent s) keeps boats on their own reach where
  // the river doubles back on itself.
  function nearest(x, z, hint) {
    let best = { d2: Infinity }, lo = 0, hi = samples.length - 2;
    if (hint != null) {
      const k = index(clamp(hint, 0, length));
      lo = Math.max(0, k - 70); hi = Math.min(samples.length - 2, k + 70);
      for (let i = lo; i <= hi; i++) { const p = project(x, z, i); if (p.d2 < best.d2) best = p; }
    } else {
      for (let i = 0; i <= hi; i += 8) { const p = project(x, z, i); if (p.d2 < best.d2) best = p; }
      const c = best.i;
      for (let i = Math.max(0, c - 14); i <= Math.min(hi, c + 14); i++) { const p = project(x, z, i); if (p.d2 < best.d2) best = p; }
    }
    const h = at(best.s).h, distance = Math.sqrt(best.d2);
    return { x: best.x, z: best.z, s: best.s, h, distance, offset: -(x - best.x) * Math.cos(h) + (z - best.z) * Math.sin(h) };
  }
  return { samples, length, at, nearest };
}

export const TONINA = Object.freeze({ period: 3.2, life: 3, rise: .55, boost: 2, length: 15, width: 1.9, push: 2.4 });

// A course definition becomes the river: see AMAZONAS below.
export function buildRiver(def) {
  const main = makePath(def.nodes), LENGTH = main.length;
  def.setup?.(main);
  const halfWidth = s => def.width(clamp(s, 0, LENGTH)) / 2;
  // Igapó: a narrow cut that leaves the river at `from` and rejoins at `to`.
  let branch = null;
  if (def.branch) {
    const b = def.branch, a = main.at(b.from), z = main.at(b.to);
    const lead = (p, d) => [p.x + Math.sin(p.h) * d, p.z + Math.cos(p.h) * d];
    const path = makePath([[a.x, a.z], lead(a, 6), ...b.nodes, lead(z, -6), [z.x, z.z]]);
    branch = { ...b, path, length: path.length, half: b.width / 2, mainLength: b.to - b.from };
    // Flooded trunks stand in the igapó: the cut is short but easy to snag.
    branch.snags = [];
    const r = seededRandom(17);
    for (let u = 14; u < path.length - 12; u += 7 + r() * 4) { const side = branch.snags.length % 2 ? 1 : -1, p = path.at(u, side * (branch.half - 1.2 - r() * 1.6)); branch.snags.push({ x: p.x, z: p.z, r: .55, u }); }
  }
  // Which channel a point is in. Main and branch overlap at the two mouths.
  function locate(x, z, hint) {
    const onBranch = hint?.channel === 'branch';
    const m = main.nearest(x, z, onBranch ? null : hint?.s);
    const out = { channel: 'main', s: m.s, offset: m.offset, distance: m.distance, h: m.h, half: halfWidth(m.s), x: m.x, z: m.z, u: 0 };
    out.edge = m.distance - out.half;
    if (branch) {
      const b = branch.path.nearest(x, z, onBranch ? hint.u : null), edge = b.distance - branch.half;
      if (edge < out.edge) {
        const u = b.s / branch.length;
        return { channel: 'branch', s: branch.from + branch.mainLength * u, u: b.s, offset: b.offset, distance: b.distance, h: b.h, half: branch.half, x: b.x, z: b.z, edge };
      }
    }
    return out;
  }
  // Raudales: each lane falls in its own steps; level is continuous elsewhere.
  const drops = (def.drops || []).map(d => ({ ...d, total: d.lanes[0].steps.reduce((a, [, h]) => a + h, 0) }));
  const laneOf = (d, offset) => { let best = d.lanes[0], gap = Infinity; for (const lane of d.lanes) { const g = offset < lane.from ? lane.from - offset : offset > lane.to ? offset - lane.to : 0; if (g < gap) { gap = g; best = lane; } } return best; };
  function levelAt(s, offset = 0) {
    let y = def.top - def.slope * s;
    for (const d of drops) {
      if (s < d.s - d.span) continue;
      if (s > d.s + d.span) { y -= d.total; continue; }
      for (const [ds, h] of laneOf(d, offset).steps) y -= h * smooth(-.4, .4, s - d.s - ds);
    }
    return y;
  }
  const list = v => typeof v === 'function' ? v.call(def, main) : v || [];
  const rocks = list(def.rocks).map(r => { const p = main.at(r.s, r.offset); return { ...r, x: p.x, z: p.z }; });
  const eddies = list(def.eddies).map(e => { const p = main.at(e.s, e.offset); return { ...e, x: p.x, z: p.z }; });
  let whirl = null;
  if (def.whirl) {
    const w = def.whirl, c = main.at(w.s, w.offset), inner = main.at(w.s, w.offset - w.r);
    // Spin so the edge facing the river's centre runs downstream: the shortcut.
    const rx = inner.x - c.x, rz = inner.z - c.z, fx = Math.sin(c.h), fz = Math.cos(c.h);
    whirl = { ...w, x: c.x, z: c.z, spin: Math.sign(-rz * fx + rx * fz) || 1 };
  }
  // Downstream current (x, z) in m/s at a point; also reports what made it.
  function currentAt(x, z, where = locate(x, z)) {
    let speed, fx = Math.sin(where.h), fz = Math.cos(where.h);
    if (where.channel === 'branch') speed = branch.current;
    else {
      const s = where.s;
      speed = def.current(s);
      const line = def.chorro(s), across = where.offset - line;
      speed += def.chorroBoost(s) * Math.exp(-across * across / 4.5);
      for (const d of drops) if (Math.abs(s - d.s) < d.span + 6) speed += laneOf(d, where.offset).boost * (1 - smooth(d.span, d.span + 6, Math.abs(s - d.s)));
      // Slower near the banks.
      speed *= .55 + .45 * smooth(0, 2.5, -where.edge);
    }
    let cx = fx * speed, cz = fz * speed, eddy = 0;
    for (const e of eddies) {
      const d = Math.hypot(x - e.x, z - e.z);
      if (d < e.r) { const w = smooth(0, .55, 1 - d / e.r); eddy = Math.max(eddy, w); cx -= fx * speed * e.k * w; cz -= fz * speed * e.k * w; }
    }
    let swirl = 0;
    if (whirl) {
      const dx = x - whirl.x, dz = z - whirl.z, d = Math.hypot(dx, dz) || 1e-3;
      if (d < whirl.r * 1.4) {
        const inside = d < whirl.r, tangential = whirl.swirl * (inside ? smooth(0, 1, d / whirl.r) : 1 - smooth(whirl.r, whirl.r * 1.4, d));
        const pull = inside ? whirl.pull * (1 - d / whirl.r) : 0, tx = -dz / d * whirl.spin, tz = dx / d * whirl.spin;
        cx += tx * tangential - dx / d * pull; cz += tz * tangential - dz / d * pull;
        swirl = whirl.spin * tangential / Math.max(d, 2);
      }
    }
    return { x: cx, z: cz, speed: Math.hypot(cx, cz), eddy, swirl };
  }
  // Terrain: the bed under the water and the banks above it.
  function groundAt(x, z) {
    const w = locate(x, z), level = levelAt(w.s, w.offset), q = w.edge, deep = def.depth(w.s);
    if (q < 0) return level - .15 - deep * smooth(0, 3.5, -q);
    const bank = def.bank(w.s, w.offset);
    return level - .15 + bank.lip * smooth(0, bank.run, q) + bank.rise * smooth(bank.run, bank.run + 40, q) * (.6 + .4 * Math.sin(x * .031 + Math.cos(z * .027) * 2));
  }
  const waterDepth = (x, z) => { const w = locate(x, z); return Math.max(0, levelAt(w.s, w.offset) - groundAt(x, z)); };
  const logs = list(def.logs).map(l => { const p = main.at(l.s, l.offset); return { ...l, x: p.x, z: p.z, h: p.h }; });
  const toninaSpots = list(def.toninas);
  // Toninas surface on a fixed clock, so every screen shows the same pods
  // without them riding in the snapshot. Their wake boosts for TONINA.boost s.
  function toninasAt(time) {
    if (!toninaSpots.length || time < 0) return [];
    const out = [], P = TONINA.period;
    for (let k = Math.max(0, Math.floor((time - TONINA.life) / P)); k <= Math.floor(time / P); k++) {
      const spot = toninaSpots[(k * 7) % toninaSpots.length], age = time - k * P;
      if (age < 0 || age > TONINA.life) continue;
      out.push({ k, s: spot.s, offset: spot.offset + (k % 2 ? 2.4 : -2.4), t0: k * P, age, wake: age > TONINA.rise && age < TONINA.rise + TONINA.boost });
    }
    return out;
  }
  // Caimanes swimming across the open river, also on a fixed clock: each one
  // crosses back and forth around its spot. `dir` is the way it swims (+1
  // toward the right bank); it faces across, a little upstream.
  const swimmers = list(def.caimanes).map((c, i) => ({ id: `n${i}`, period: 26, phase: i * 2.1, span: 6, ...c }));
  function caimanesAt(time) {
    return swimmers.map(c => {
      const u = Math.max(0, time) * TAU / c.period + c.phase, offset = c.offset + c.span * Math.sin(u), dir = Math.cos(u) >= 0 ? 1 : -1;
      const s = c.s + Math.sin(u * .5) * 2, p = main.at(s, offset);
      return { id: c.id, s, offset, dir, x: p.x, z: p.z, h: p.h - dir * (Math.PI / 2 + .35), y: levelAt(s, offset) };
    });
  }
  // The line a guide shows: the chorro, the fast lane of each raudal, the
  // remolino's downstream edge, clear of rocks and of the caimanes on the
  // banks. Sampled every metre and smoothed so it never jumps.
  const rawGuide = s => {
    const half = halfWidth(s) - 1.8;
    let line = def.chorro(s);
    for (const d of drops) if (s > d.s - d.span - 30 && s < d.s + d.span + 4) { const l = d.lanes.find(l => l.fast) || d.lanes[0]; line = (l.from + l.to) / 2; }
    if (whirl && s > whirl.s - 28 && s < whirl.s + 10) line = Math.min(line, whirl.offset - whirl.r - 1.2);
    for (const log of logs) if (log.caiman && log.s > s - 6 && log.s < s + 14 && Math.sign(line) === log.side) line = -log.side * 1.2;
    for (const r of rocks) if (Math.abs(r.s - s) < r.r + 5 && Math.abs(line - r.offset) < r.r + 2.2) line = r.offset + (Math.sign(line - r.offset) || 1) * (r.r + 2.2);
    return clamp(line, -half, half);
  };
  const guideTable = new Float32Array(Math.ceil(LENGTH) + 1);
  { const raw = Array.from(guideTable, (_, i) => rawGuide(i)); for (let i = 0; i < guideTable.length; i++) { let sum = 0, n = 0; for (let k = -6; k <= 6; k++) { const v = raw[i + k]; if (v !== undefined) { sum += v; n++; } } guideTable[i] = sum / n; } }
  const guideLine = s => { const i = clamp(s, 0, LENGTH - 1), k = Math.floor(i); return lerp(guideTable[k], guideTable[Math.min(k + 1, guideTable.length - 1)], i - k); };
  // The same line, steering round the swimming caimanes at this moment.
  function guideAt(s, time) {
    let line = guideLine(s);
    for (const c of caimanesAt(time)) if (c.s > s - 6 && c.s < s + 24 && Math.abs(line - c.offset) < 4.5) line = c.offset - c.dir * 4.5;
    return clamp(line, -(halfWidth(s) - 1.8), halfWidth(s) - 1.8);
  }
  // Channel buoys in pairs either side of the guide where the river opens up.
  const buoys = [];
  if (def.buoys) {
    const B = { every: 45, gap: 6, minHalf: 13, ...def.buoys };
    for (let s = B.from ?? 40; s < LENGTH - 40; s += B.every) {
      if (halfWidth(s) < B.minHalf || drops.some(d => Math.abs(s - d.s) < d.span + 14) || (whirl && Math.abs(s - whirl.s) < whirl.r + 12)) continue;
      for (const side of [-1, 1]) {
        const offset = clamp(guideLine(s) + side * B.gap, -halfWidth(s) + 1.2, halfWidth(s) - 1.2), p = main.at(s, offset);
        if (!rocks.some(r => Math.hypot(r.x - p.x, r.z - p.z) < r.r + 2)) buoys.push({ s, offset, side, x: p.x, z: p.z, r: .55 });
      }
    }
  }
  const gates = Array.from({ length: def.gates }, (_, i) => (i + 1) * LENGTH / (def.gates + 1));
  const sector = s => (def.sectors.filter(([v]) => s >= v).at(-1) || def.sectors[0])[1];
  return { def, main, branch, snags: branch?.snags || [], logs, toninaSpots, toninasAt, swimmers, caimanesAt, guideLine, guideAt, buoys, LENGTH, halfWidth, locate, levelAt, laneOf, drops, rocks, eddies, whirl, currentAt, groundAt, waterDepth, gates, sector, at: main.at };
}

export function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }

