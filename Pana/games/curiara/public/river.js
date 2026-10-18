// River geometry and water, pure JS. Shared by the simulation, the scenery
// and the minimap. A river is a point-to-point spline with distance `s`
// downstream and a signed `offset` across (positive = right bank, looking
// downstream). Everything else is a function of (s, offset): width, water
// level (raudales drop it), the current, eddies, the whirlpool and rocks.
// Heading `h` follows Galope: forward is (sin h, cos h); h grows to the left.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

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
  const gates = Array.from({ length: def.gates }, (_, i) => (i + 1) * LENGTH / (def.gates + 1));
  const sector = s => (def.sectors.filter(([v]) => s >= v).at(-1) || def.sectors[0])[1];
  return { def, main, branch, snags: branch?.snags || [], logs, toninaSpots, toninasAt, LENGTH, halfWidth, locate, levelAt, laneOf, drops, rocks, eddies, whirl, currentAt, groundAt, waterDepth, gates, sector, at: main.at };
}

export function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }

const GREY = { lip: .8, run: 3, rise: 3 };
const wave = (s, a, b) => Math.sin(s * a + b);
const ease = (s, a, b, from, to) => from + (to - from) * smooth(a, b, s);

// The race: Caño de la Selva → Raudal del Autana → Río Negro → la churuata.
// Raudales: each lane is [from, to] across the river with its own steps
// [ds from the raudal's s, drop m]; every lane drops the same in total.
const R1 = 398, R2 = 482, CANO = 330, NEGRO = 556;
const lanes = (fastSide) => {
  const steps3 = [[-8, .5], [0, .5], [8, .5]], steps2 = [[-5, .75], [5, .75]], fast = [[0, 1.5]];
  if (fastSide === 0) return [{ from: -12, to: -4.1, steps: steps3, boost: .5 }, { from: -3.2, to: 3.2, steps: fast, boost: 2.2, fast: true }, { from: 4.1, to: 12, steps: steps3, boost: .5 }];
  return [{ from: -12, to: -5.2, steps: fast, boost: 2.2, fast: true }, { from: -4.3, to: 3.2, steps: steps2, boost: 1.1 }, { from: 4.1, to: 12, steps: steps3, boost: .5 }];
};
export function amazonasDefinition() {
let curvature = () => 0, LEN = 1000;
return {
  nodes: [[0, 46], [0, 14], [-12, -16], [-6, -44], [10, -62], [16, -88], [30, -106], [52, -114], [66, -136], [60, -164], [40, -180], [22, -196],
    [8, -222], [2, -258], [-1, -296], [1, -334], [5, -372], [4, -408],
    [-6, -446], [-30, -486], [-42, -532], [-30, -580], [4, -620], [28, -664], [24, -712], [4, -752], [-6, -790], [-8, -818]],
  setup(main) { curvature = s => main.at(s).k; LEN = main.length; },
  width(s) {
    let w = ease(s, 22, 48, 16, 10.5 + 1.6 * wave(s, .045, 1));
    w = ease(s, CANO - 10, CANO + 30, w, 24.5);
    w = ease(s, R2 + 25, NEGRO + 20, w, 34 + 4 * wave(s, .021, .4));
    return ease(s, LEN - 70, LEN - 25, w, 42);
  },
  top: 8, slope: .0028,
  depth: s => s < CANO ? 1.5 : s < NEGRO ? 1.3 : 3,
  current: s => ease(s, CANO - 20, CANO + 20, 2.3, 2.5) + ease(s, R2 + 30, NEGRO, 0, -.3) - ease(s, LEN - 60, LEN - 20, 0, 1.2),
  // The chorro rides the outside of the caño's bends and snakes across the Río Negro.
  chorro(s) {
    const half = this.width(s) / 2;
    if (s < CANO) return clamp(-curvature(s + 6) * 45, -1, 1) * half * .45;
    if (s < R2 + 20) return 0;
    return ease(s, R2 + 20, NEGRO + 10, 0, 1) * half * .55 * wave(s, .019, 2.2);
  },
  chorroBoost: s => s < 40 ? 0 : s < CANO ? 1.5 : s < NEGRO ? 1.2 : s > LEN - 50 ? 0 : 2.6,
  drops: [{ s: R1, span: 14, lanes: lanes(0) }, { s: R2, span: 14, lanes: lanes(1) }],
  bank(s, offset) {
    if (s < CANO) return { lip: 1.3, run: 2.2, rise: 7 };
    if (s < NEGRO - 30) return { lip: 1.6, run: 1.8, rise: 11 };
    // Playas: low sand on the inside of the Río Negro's bends.
    const inside = Math.sign(offset) === Math.sign(curvature(s)) ? 0 : 1;
    return inside ? { lip: .35, run: 11, rise: 4 } : { lip: .9, run: 3.5, rise: 6 };
  },
  look(s, offset) {
    if (s < CANO - 20) return {};
    if (s < NEGRO - 30) return { rock: 1 };
    return { sand: Math.sign(offset) === Math.sign(curvature(s)) ? .2 : 1 };
  },
  branch: { from: 144, to: 296, width: 7, current: 1.25, nodes: [[19, -116], [22, -144], [23, -172]] },
  whirl: { s: 776, offset: 7.5, r: 9, swirl: 3.2, pull: 1.3 },
  eddies(main) {
    const out = [];
    // Inside of every tight caño bend, and below the raudales on both sides.
    for (let s = 50; s < CANO - 10; s += 2) {
      const k = main.at(s).k, before = main.at(s - 2).k, after = main.at(s + 2).k;
      if (Math.abs(k) > .03 && Math.abs(k) >= Math.abs(before) && Math.abs(k) >= Math.abs(after)) out.push({ s, offset: Math.sign(k) * (this.width(s) / 2 - 1.6), r: 3, k: 1.25 });
    }
    for (const d of [R1, R2]) for (const side of [-1, 1]) out.push({ s: d + 24, offset: side * 8, r: 5, k: 1.3 });
    for (const [s, offset] of [[612, -9], [690, 11], [868, 9]]) out.push({ s: s + 5, offset, r: 6, k: 1.2 });
    return out;
  },
  rocks() {
    const out = [];
    // Laja bars split each raudal into its lanes; a few boulders in the Negro.
    for (const d of this.drops) {
      // Each bar starts with a small nose stone so canoes glance off it.
      for (let i = 1; i < d.lanes.length; i++) for (let ds = -d.span - 1, k = 0; ds <= d.span - 2; ds += 1.9, k++) out.push({ s: d.s + ds, offset: (d.lanes[i - 1].to + d.lanes[i].from) / 2, r: k ? .62 + .14 * Math.abs(wave(ds, 1.7, d.s)) : .45 });
      for (const side of [-1, 1]) out.push({ s: d.s - d.span - 3, offset: side * 13.2, r: 1.4 });
    }
    for (const [s, offset, r] of [[612, -9, 1.8], [690, 11, 2.2], [868, 9, 1.7], [252, 1.5, .9], [110, 0, .8]]) out.push({ s, offset, r });
    return out;
  },
  sectors: [[0, 'Caño de la Selva'], [CANO, 'Raudal del Autana'], [NEGRO, 'Río Negro'], [910, 'La churuata']],
  tints: [R1 - 16, R2 + 16], gates: 16,
  // Logs on the caño's banks; one in three is a caimán.
  logs() {
    const out = [];
    for (let s = 58, i = 0; s < CANO - 15; s += 23 + (i * 7) % 9, i++) {
      if (s > 140 && s < 150) continue;
      const side = i % 2 ? 1 : -1;
      out.push({ id: i, s, offset: side * (this.width(s) / 2 - .35), side, caiman: i % 3 === 1 });
    }
    return out;
  },
  // Where pods of toninas surface in the Río Negro, near the chorro.
  toninas() { const out = []; for (let s = NEGRO + 25; s < LEN - 70; s += 34) out.push({ s, offset: this.chorro(s) }); return out; },
};
}
export const AMAZONAS = amazonasDefinition();
// Step 0's grey box: a straight 200 m channel to tune the paddle on.
export const GREYBOX = buildRiver({
  nodes: [[0, 0], [0, -100], [0, -200]], width: () => 14, top: 2, slope: 0, depth: () => 1.5,
  current: () => 1.5, chorro: () => 0, chorroBoost: () => 0, bank: () => GREY,
  sectors: [[0, 'Canal de prueba']], gates: 4,
});
export const RIVER = buildRiver(AMAZONAS);

// Each definition owns its curvature/length closure: building another map cannot
// mutate an active race's current, banks or shortcut geometry.
export function configuredRiver(options = {}) {
  if ((!options.river || options.river === 'amazonas') && options.falls !== false && options.items !== false) return RIVER;
  const def = amazonasDefinition(), kind = options.river || 'amazonas';
  if (kind !== 'amazonas') {
    const scale = kind === 'orinoco' ? 1.6 : .72;
    def.nodes = def.nodes.map(([x,z]) => [x * scale, z]);
    def.branch = { ...def.branch, nodes: def.branch.nodes.map(([x,z]) => [x * scale,z]) };
    const width = def.width; def.width = s => width(s) * (kind === 'orinoco' ? 1.35 : .96);
    def.sectors = [[0,kind === 'orinoco' ? 'Caño del Orinoco' : 'Caroní'], [360,'Los raudales'], [600,kind === 'orinoco' ? 'Playas del Orinoco' : 'Curvas del Caroní'], [910,'La churuata']];
    if(kind === 'orinoco'){def.look = () => ({sand:1});def.bank=()=>({lip:.6,run:9,rise:5});}
  }
  if (options.falls === false) def.drops = [];
  if(options.items === false){def.rocks=()=>[];def.logs=()=>[];def.toninas=()=>[];}
  const river=buildRiver(def);
  if(options.items === false){river.snags=[];if(river.branch)river.branch.snags=[];}
  return river;
}
