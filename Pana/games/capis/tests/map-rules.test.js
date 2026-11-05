// The generated maps over a sweep of seeds on every size (SWEEP a size, every
// kind): each passes its checks, the teams can walk (or hop) to each other,
// spawns have room, nothing floats but the roofs over tunnels, every cave is
// reachable, islands have tapered shores, the summit of the cave mountain is
// reached from every spawn, the ground is interesting, the two sides are fair
// by measure, every kind shows up, and the same seed gives the same cells. The numbers
// (generation time, re-rolls, kinds, fairness) are printed as diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spawnStats, planMap, buildMap, inspectPlan, heightAt, floorsOf, MAP_SIZES, FAIR, ATTEMPTS, KINDS, WATER } from '../public/map-rules.js';
import { surfaceY, solidAt } from '../../../engine/play/terrain-mask.js';
import { stepSideWalker } from '../../../engine/play/side-walker.js';
import { RULES } from '../public/rules.js';
import { dropFloating, headroom } from '../../../engine/play/terrain-gen.js';

// The ground under a bridge or an arch at x: the lowest floor above the water.
const groundUnderArch = (mask, x, map) => { for (let y = map.water + .1; y < map.height; y += .1) if (!solidAt(mask, x, y)) return y; return map.water; };
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
    const graph = floorsOf(g.mask), ys = g.map.spawns.map(xs => xs.map(x => surfaceY(g.mask, x)));
    const a = graph.near(g.map.spawns[0][0], ys[0][0], .6), b = graph.near(g.map.spawns[1][0], ys[1][0], .6);
    assert.ok(graph.reach(a)[b] && graph.reach(b)[a], `${label(g)}: the front capis reach each other`);
  }
  // A tunnel is walked through end to end.
  const tunnel = all.find(g => g.map.kind === 'cuevas'), graph = floorsOf(tunnel.mask), tt = tunnel.map.plan.tunnels[0];
  const inside = graph.near(tt.points[2].x, tt.points[2].y, 1), mouths = [tt.points[0], tt.points[4]].map(pt => graph.near(pt.x, surfaceY(tunnel.mask, pt.x) ?? pt.y, 3));
  assert.ok(inside >= 0 && mouths.every(m => m >= 0 && graph.reach(m)[inside] && graph.reach(inside)[m]), `${label(tunnel)}: the tunnel is walked through`);
});

test('islands have tapered shores: no sheer side, no undercut, a beach at the waterline', t => {
  const steep = [];
  for (const g of all) {
    if (g.map.kind !== 'islas') continue;
    const p = g.map.plan, { mask } = g;
    let worst = 0;
    for (const f of p.features) if (f.type === 'island') for (const [edge, out] of [[f.from, -1], [f.to, 1]]) {
      if (edge <= .01 || edge >= p.width - .01) continue;
      // The bank's steepest rise over one unit (a sheer side was 15 to 28), and earth under it all the way down (no undercut).
      for (let x = edge - out * 8; out * (x - edge) < 1.6; x += out * .1) {
        worst = Math.max(worst, Math.abs(heightAt(p, x + out) - heightAt(p, x)));
        const cx = (Math.floor(x / mask.cell) + .5) * mask.cell, h = heightAt(p, cx);
        for (let y = WATER + .3; y < h - .3; y += .25) assert.ok(solidAt(mask, cx, y), `${label(g)}: the bank at ${cx.toFixed(2)} is undercut at ${y.toFixed(1)}`);
      }
      // A beach: ground just above the water a little out from the edge.
      const beach = heightAt(p, edge + out * .2);
      assert.ok(beach > WATER - 1 && beach < WATER + 2, `${label(g)}: a beach at ${edge.toFixed(1)} (${beach.toFixed(1)})`);
    }
    steep.push(worst);
    assert.ok(worst < 9, `${label(g)}: a bank rises ${worst.toFixed(1)} in one unit`);
  }
  t.diagnostic(`islas, steepest rise of a bank over one unit: ${quantiles(steep)} (${steep.length} maps)`);
});

test('the summit of the cave mountain is reached on foot (or with hops) from every spawn', t => {
  let n = 0, foot = 0;
  for (const g of all) {
    if (g.map.kind !== 'cuevas') continue;
    n++;
    const s = g.map.fair.summit;
    assert.ok(s && s.from.flat().every(Boolean), `${label(g)}: the summit at ${s?.x.toFixed(1)} from ${JSON.stringify(s?.from)}`);
  }
  // Measured again from scratch on a few maps: from the back capi on each side, up the climbing flank.
  for (const g of all.filter(g => g.map.kind === 'cuevas').slice(0, 12)) {
    const graph = floorsOf(g.mask), s = g.map.fair.summit, top = graph.near(s.x, s.y, .2);
    for (const team of [0, 1]) {
      const x = g.map.spawns[team][2], from = graph.near(x, surfaceY(g.mask, x), .6);
      assert.ok(top >= 0 && graph.reach(from)[top], `${label(g)}: team ${team}'s back capi reaches the summit`);
      if (graph.reach(from, { hops: false })[top]) foot++;
    }
  }
  t.diagnostic(`${n} cuevas maps, the summit reached from all 6 spawns on every one; back capis that get there without a hop: ${foot} of 24 (the way up starts with a hop onto the ledge)`);
});

test('the ledge over the mouth of the cave mountain is one hop from the lowland, and the mouth is walked through', () => {
  const list = all.filter(g => g.map.kind === 'cuevas').slice(0, 24), fixed = generateMap(6, 'medium');
  assert.equal(fixed.map.kind, 'cuevas', 'seed 6 is a cave mountain');
  for (const g of [fixed, ...list]) {
    const { mask } = g, f = g.map.plan.features.find(k => k.type === 'mountain'), c = f.climb, edge = f.at + c.side * c.tip, O = { water: WATER, airControl: RULES.airControl, airSpeed: RULES.airSpeed };
    const body = d => ({ x: edge + c.side * d, y: surfaceY(mask, edge + c.side * d), vx: 0, vy: 0, grounded: true, facing: -c.side, jumpPress: 0, slide: 0 });
    assert.ok(c.lip - c.low < 1.2, `${label(g)}: the ledge is under a hop over the lowland (${(c.lip - c.low).toFixed(2)})`);
    // From anywhere on the rim, the key held towards the ledge.
    for (const d of [2.1, 2.4, 2.7, 3]) {
      const p = body(d);
      for (let i = 0; i < 90; i++) stepSideWalker(p, { x: -c.side, jump: 1 }, 1 / 60, mask, O);
      assert.ok(p.y > c.lip - .3, `${label(g)}: a hop ${d} from the ledge lands on it (feet at ${p.y.toFixed(2)}, ledge ${c.lip.toFixed(2)})`);
    }
    // Walking on instead, a capi goes down the ramp and in under the ledge without getting stuck.
    const w = body(4);
    for (let i = 0; i < 240; i++) stepSideWalker(w, { x: -c.side }, 1 / 60, mask, O);
    assert.ok((w.x - edge) * c.side < -1, `${label(g)}: the walk stopped ${((w.x - edge) * c.side).toFixed(2)} from the ledge's tip`);
    // And out again.
    for (let i = 0; i < 300; i++) stepSideWalker(w, { x: c.side }, 1 / 60, mask, O);
    assert.ok((w.x - edge) * c.side > 2, `${label(g)}: the walk back out stopped at ${((w.x - edge) * c.side).toFixed(2)}`);
  }
});

test('the ledge in a valley is walked up to from the valley floor', () => {
  const list = all.filter(g => g.map.kind === 'valle' && g.map.plan.ledges.length);
  assert.ok(list.length);
  for (const g of list) {
    const graph = floorsOf(g.mask), f = g.map.plan.features.find(k => k.type === 'valley'), l = g.map.plan.ledges[0];
    const near = (x, y) => graph.near(x, y, 1.5);
    // Most of the way down its buttress, towards the middle of the valley.
    const x = l.x - l.side * (l.out + (l.y - g.map.plan.base) * .3), y = groundUnderArch(g.mask, x, g.map);
    const top = near(l.x - l.side * l.out * .5, groundUnderArch(g.mask, l.x - l.side * l.out * .5, g.map)), foot = near(x, y);
    // A pond's bowl filling a small valley may eat the buttress (nothing to walk up from then).
    const pond = g.map.plan.features.find(k => k.type === 'pond');
    if (Math.abs(x - pond.at) < pond.half + 3.5) continue;
    assert.ok(top >= 0 && foot >= 0, `${label(g)}: floors on the ledge and its buttress`);
    assert.ok(graph.reach(foot)[top], `${label(g)}: the buttress at ${x.toFixed(1)} reaches the ledge at ${l.x.toFixed(1)}`);
  }
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
