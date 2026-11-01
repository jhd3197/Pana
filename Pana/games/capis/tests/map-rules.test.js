// The generated maps over a sweep of seeds on every size (SWEEP a size, every
// kind): each passes its checks, the teams can walk (or hop) to each other,
// spawns have room, nothing floats but the roofs over tunnels, every cave is
// reachable, the ground is interesting, the two sides are fair by measure,
// every kind shows up, and the same seed gives the same cells. The numbers
// (generation time, re-rolls, kinds, fairness) are printed as diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spawnStats, planMap, buildMap, inspectPlan, MAP_SIZES, FAIR, ATTEMPTS, KINDS, WATER } from '../public/map-rules.js';
import { surfaceY } from '../../../engine/play/terrain-mask.js';
import { dropFloating, headroom, floorGraph } from '../../../engine/play/terrain-gen.js';

const SWEEP = Number(process.env.CAPIS_SWEEP) || 300;
const GAP = { small: 5, medium: 7, large: 8 };
const seedOf = i => 1 + (i * 7919 + 13) % 99991;
const maps = {}, timing = {};
for (const size of Object.keys(MAP_SIZES)) {
  const list = [], start = performance.now();
  for (let i = 0; i < SWEEP; i++) list.push(generateMap(seedOf(i), size));
  timing[size] = (performance.now() - start) / SWEEP;
  maps[size] = list;
}
const all = Object.values(maps).flat();
const label = g => `seed ${g.map.seed} ${g.map.size} ${g.map.kind}`;
const pct = (n, d) => `${(100 * n / d).toFixed(1)} %`;
const quantiles = list => { const s = [...list].sort((a, b) => a - b), q = k => s[Math.min(s.length - 1, Math.floor(k * s.length))]; return `median ${q(.5).toFixed(2)}, p90 ${q(.9).toFixed(2)}, max ${s.at(-1).toFixed(2)}`; };

test('generation is fast, every seed passes, re-rolls are few, and the same seed gives the same cells', t => {
  for (const [size, ms] of Object.entries(timing)) {
    const list = maps[size], rerolled = list.filter(g => g.map.attempt).length, fallback = list.filter(g => g.map.kind === 'suave').length, reasons = {};
    for (const g of list) for (const r of g.map.rejected) reasons[r] = (reasons[r] || 0) + 1;
    const attempts = list.reduce((n, g) => n + g.map.attempt + 1, 0) / list.length;
    t.diagnostic(`${size}: ${list.length} seeds, ${ms.toFixed(1)} ms a map, ${attempts.toFixed(2)} attempts a map, ${pct(rerolled, list.length)} re-rolled, ${fallback} on the fallback; rejected ${JSON.stringify(reasons)}`);
    assert.ok(ms < 120, `${size} maps take ${ms.toFixed(0)} ms`);
    assert.ok(list.every(g => !g.map.failed), `${size}: every seed passes within ${ATTEMPTS} attempts`);
    assert.ok(rerolled / list.length < .5, `${size}: ${pct(rerolled, list.length)} of the seeds re-roll`);
    assert.ok(fallback / list.length < .03, `${size}: ${fallback} seeds fall back to the safe map`);
  }
  for (const size of Object.keys(MAP_SIZES)) for (const g of maps[size].slice(0, 25)) {
    const again = generateMap(g.map.seed, size);
    assert.ok(Buffer.from(again.mask.solid).equals(Buffer.from(g.mask.solid)), `${label(g)}: solid`);
    assert.ok(Buffer.from(again.mask.hollow).equals(Buffer.from(g.mask.hollow)), `${label(g)}: hollow`);
    assert.deepEqual(again.map.spawns, g.map.spawns);
  }
  // A re-roll is part of the seed: building the passing attempt directly gives the same ground.
  const rerolled = all.find(g => g.map.attempt > 0);
  assert.ok(rerolled, 'some seed re-rolls');
  const { mask } = buildMap(planMap(rerolled.map.seed, rerolled.map.size, rerolled.map.attempt));
  assert.ok(Buffer.from(mask.solid).equals(Buffer.from(rerolled.mask.solid)));
  assert.notDeepEqual(generateMap(1).mask.solid, generateMap(2).mask.solid, 'another seed, another map');
  assert.deepEqual(Object.keys(MAP_SIZES), ['small', 'medium', 'large']);
});

test('every kind of map shows up on every size, each with its own landmark', t => {
  for (const size of Object.keys(MAP_SIZES)) {
    const kinds = {};
    for (const g of maps[size]) kinds[g.map.kind] = (kinds[g.map.kind] || 0) + 1;
    t.diagnostic(`${size}: ${JSON.stringify(kinds)}`);
    for (const kind of KINDS) assert.ok(kinds[kind] >= SWEEP * .08, `${size}: ${kind} on ${kinds[kind] || 0} of ${SWEEP}`);
  }
  for (const g of all) {
    const p = g.map.plan, types = p.features.map(f => f.type);
    if (p.kind === 'cuevas') assert.ok(types.includes('mountain') && p.tunnels.length === 1 && p.tunnels[0].rooms.length >= 1, label(g));
    if (p.kind === 'islas') assert.ok(types.filter(k => k === 'island').length >= 3 && p.bridges.length === types.filter(k => k === 'island').length - 1, label(g));
    if (p.kind === 'valle') assert.ok(types.includes('valley') && types.includes('pond') && p.arch?.a, label(g));
    if (p.kind === 'terrazas') assert.ok(types.includes('tepuy'), label(g));
    if (p.kind === 'cerros') assert.ok(p.hills.length >= 3, label(g));
  }
});

test('the land runs across the map: water only at the shores, in ponds and under bridges', t => {
  const land = {};
  for (const g of all) {
    (land[g.map.kind] ||= []).push(g.map.fair.land);
    assert.ok(g.map.fair.land > .8, `${label(g)}: ${pct(g.map.fair.land, 1)} of the top is dry land`);
    // Between the front capis the top surface is dry, except between islands.
    const { map, mask } = g;
    let wet = 0;
    for (let x = map.spawns[0][0]; x <= map.spawns[1][0]; x += .25) if (!(surfaceY(mask, x) >= WATER)) wet += .25;
    if (map.kind !== 'islas') assert.ok(wet <= 1, `${label(g)}: ${wet} units of open water between the fronts`);
  }
  t.diagnostic(Object.entries(land).map(([k, v]) => `${k} land ${quantiles(v)}`).join('; '));
});

test('spawns stand on dry ground with headroom, spread out, each with room to walk', () => {
  for (const g of all) {
    const { map, mask } = g;
    assert.equal(map.spawns.length, 2); assert.equal(map.spawns[0].length, 3);
    for (const xs of map.spawns) {
      for (const x of xs) {
        const y = surfaceY(mask, x);
        assert.ok(y !== null && y > map.water + 2.5, `${label(g)}: spawn ${x.toFixed(1)} above the water (${y})`);
        assert.ok(headroom(mask, x, y, 2.6), `${label(g)}: room to stand at ${x.toFixed(1)}`);
      }
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < 3; i++) assert.ok(sorted[i] - sorted[i - 1] >= GAP[map.size] - 1e-9, `${label(g)}: capis ${GAP[map.size]} apart`);
    }
    assert.ok(Math.max(...map.spawns[0]) < map.width / 2 && Math.min(...map.spawns[1]) > map.width / 2, label(g));
    assert.ok(map.spawns[1][0] - map.spawns[0][0] > 28, `${label(g)}: the front capis are ${(map.spawns[1][0] - map.spawns[0][0]).toFixed(1)} apart`);
    for (const s of spawnStats(map, mask).flat()) assert.ok(s.span >= FAIR.span, `${label(g)}: ${s.span.toFixed(1)} units to walk at ${s.x.toFixed(1)}`);
  }
});

test('nothing floats in the air but the roof over a tunnel', () => {
  for (const g of all) {
    const { map, mask } = g, copy = { ...mask, solid: mask.solid.slice() };
    const loose = dropFloating(copy, 0);
    assert.ok(loose.floating.length <= map.plan.tunnels.length, `${label(g)}: ${loose.floating.length} floating pieces`);
    for (const n of loose.floating) assert.ok(n > 4000, `${label(g)}: a floating piece of ${n} cells`);
  }
});

test('the teams can walk (or hop) to each other both ways, and every cave and tunnel is reachable', t => {
  let foot = 0;
  for (const g of all) {
    const f = g.map.fair, [there, back] = f.route;
    assert.ok(Number.isFinite(there) && Number.isFinite(back), `${label(g)}: the way across ${there} / ${back}`);
    if (f.foot) foot++;
    for (const c of f.caves) assert.ok(c.reached, `${label(g)}: a ${c.what} no capi walks into`);
  }
  const caves = all.reduce((n, g) => n + g.map.fair.caves.length, 0);
  t.diagnostic(`${pct(foot, all.length)} of the maps walkable both ways without a hop; ${caves} caves, tunnels and rooms, all reachable`);
  // The walk is measured again on its own: a few maps of every kind, from scratch.
  const sample = KINDS.flatMap(kind => all.filter(g => g.map.kind === kind).slice(0, 4));
  for (const g of sample) {
    const graph = floorGraph(g.mask, { water: WATER }), ys = g.map.spawns.map(xs => xs.map(x => surfaceY(g.mask, x)));
    const a = graph.near(g.map.spawns[0][0], ys[0][0], .6), b = graph.near(g.map.spawns[1][0], ys[1][0], .6);
    assert.ok(graph.reach(a)[b] && graph.reach(b)[a], `${label(g)}: the front capis reach each other`);
  }
  // A tunnel is walked through end to end.
  const tunnel = all.find(g => g.map.kind === 'cuevas'), graph = floorGraph(tunnel.mask, { water: WATER }), tt = tunnel.map.plan.tunnels[0];
  const inside = graph.near(tt.points[2].x, tt.points[2].y, 1), mouths = [tt.points[0], tt.points[4]].map(pt => graph.near(pt.x, surfaceY(tunnel.mask, pt.x) ?? pt.y, 3));
  assert.ok(inside >= 0 && mouths.every(m => m >= 0 && graph.reach(m)[inside] && graph.reach(inside)[m]), `${label(tunnel)}: the tunnel is walked through`);
});

test('every map is interesting: relief, landmarks, caves, ground on more than one level', t => {
  const by = {};
  for (const g of all) {
    (by[g.map.kind] ||= []).push(g.map.fair.interest);
    assert.ok(g.map.fair.interest >= FAIR.interest, `${label(g)}: interest ${g.map.fair.interest.toFixed(2)}`);
  }
  t.diagnostic(Object.entries(by).map(([k, v]) => `${k} interest ${quantiles(v)}`).join('; '));
  // A flat field scores well under the bar.
  const flat = planMap(5, 'medium', 0);
  Object.assign(flat, { kind: 'cerros', features: [], hills: [], tunnels: [], bridges: [], ledges: [], outer: null, lf: { ...flat.lf, amp: 0 }, detail: 0 });
  const plain = inspectPlan(flat);
  assert.ok(!plain.measured || plain.measured.interest.score < FAIR.interest, 'a flat field is bland');
});

test('the two sides are fair by measure: heights, sky, cover, distance, the walk and the shots', t => {
  const worst = {}, front = [], mean = [];
  for (const g of all) {
    const f = g.map.fair;
    for (const k of ['meanHeight', 'front', 'exposure', 'cover', 'distance', 'walk', 'shots']) {
      worst[k] = Math.max(worst[k] || 0, f[k]);
      assert.ok(f[k] <= FAIR[k] + 1e-9, `${label(g)}: ${k} ${f[k].toFixed(2)} > ${FAIR[k]}`);
    }
    assert.ok(f.shooters[0].some(Boolean) && f.shooters[1].some(Boolean), `${label(g)}: each team has a shot`);
    front.push(f.front); mean.push(f.meanHeight);
  }
  t.diagnostic(`spawn height difference, front capis: ${quantiles(front)}; team means: ${quantiles(mean)}`);
  t.diagnostic(`worst over ${all.length} maps: ${JSON.stringify(Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(2)])))}`);
});

test('the last attempt, the mirrored safe map, always passes its checks', () => {
  for (const size of Object.keys(MAP_SIZES)) for (let i = 0; i < 60; i++) {
    const p = planMap(seedOf(i), size, ATTEMPTS - 1), r = inspectPlan(p);
    assert.equal(p.kind, 'suave');
    assert.equal(r.failed, null, `seed ${seedOf(i)} ${size}: the fallback fails with ${r.failed}`);
    assert.deepEqual(r.spawns[1], r.spawns[0].map(x => p.width - x), 'mirrored spawns');
  }
});
