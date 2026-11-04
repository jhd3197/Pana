// The swarm's budget: 150 snakes x 12 points on a real floor, in the open and
// crowded around one pana, the worst case. Prints ms per step; the numbers
// asserted are well above a normal machine so a busy CI does not flake. Also:
// no garbage in the hot loop. The draw calls are checked in swarm.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Expedition } from '../public/rules.js';
import { SWARM, startSwarm, swarmField, SwarmFollower } from '../public/swarm.js';
import { VerletChains } from '../../../engine/play/verlet-chains.js';

const SNAKES = 150, BUDGET_MS = 6;
const median = list => [...list].sort((a, b) => a - b)[list.length >> 1];
function setup(count) {
  const g = new Expedition(4242); g.addPlayer(1, 'Pana'); g.start(4242);
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  const stop = g.layout.run.lifts.find(l => l.floor === 1), me = g.players[0];
  Object.assign(me, { x: stop.x, z: stop.z - 5, invulnerable: 1e6 });
  assert.ok(startSwarm(g, 1, count));
  return g;
}
function pour(g) { for (let t = 0; t < SWARM.telegraph + SNAKES / 25 + 1; t += .05) { g.director.duration = 1e6; g.update(.05); } }
// One full step on its own: steering, integration, constraints, walls, separation.
function timed(g, frames) {
  const sim = g.swarmSim, out = [], s = g.swarm;
  for (let f = 0; f < frames; f++) { const t = performance.now(); sim.steer(g, s, sim.chains.h, SWARM.speed); sim.chains.step(); out.push(performance.now() - t); }
  return out;
}

test(`${SNAKES} snakes x ${SWARM.segments} points stay inside ${BUDGET_MS} ms a step`, () => {
  const g = setup(SNAKES); pour(g);
  timed(g, 120);   // warm the JIT
  const open = median(timed(g, 300));
  // Every snake around one pana: the hash's worst case.
  const me = g.players[0], c = g.swarmSim.chains;
  for (let i = 0; i < SNAKES; i++) { const a = i * 2.4, r = .5 + Math.sqrt(i) * .22; c.place(i, me.x + Math.cos(a) * r, me.z + Math.sin(a) * r, Math.cos(a), Math.sin(a), SWARM.link); }
  const crowded = median(timed(g, 300));
  const follower = new SwarmFollower(); follower.sync(JSON.parse(JSON.stringify(g.swarm)), g.layout, g);
  const client = []; for (let f = 0; f < 300; f++) { const t = performance.now(); follower.advance(follower.chains.h, g.layout, g.swarm, g); client.push(performance.now() - t); }
  // A tunnel falls in: the field is baked again, the one hitch a swarm can cause.
  const bakeAt = performance.now(); swarmField(g.layout, 1, { rubble: { [g.layout.run.corridors.find(q => q.floor === 1).id]: 0 } }); const bake = performance.now() - bakeAt;
  console.log(`swarm ${SNAKES} x ${SWARM.segments}: host open ${open.toFixed(3)} ms/step, host crowded ${crowded.toFixed(3)} ms/step, client ${median(client).toFixed(3)} ms/step, field bake ${bake.toFixed(1)} ms`);
  assert.ok(open < BUDGET_MS, `open ${open} ms`);
  assert.ok(crowded < BUDGET_MS, `crowded ${crowded} ms`);
  assert.ok(median(client) < BUDGET_MS, `client ${median(client)} ms`);
});

test('the solver makes no garbage: bytes per step, measured between collections', () => {
  const count = 150, chains = new VerletChains({ chains: count, points: 12, rest: .17, gap: .16, grid: { cell: .4, x0: -40, z0: -40, w: 200, h: 200 } });
  for (let i = 0; i < count; i++) chains.place(i, (i % 15) * .5, Math.floor(i / 15) * .5, 1, 0, .17);
  const run = n => { for (let f = 0; f < n; f++) { for (let i = 0; i < count; i++) chains.nudge(i, .05, .01); chains.step(); } };
  run(2000);   // warm: interpreted code may box doubles, compiled code does not
  // A collection in a window shows as a drop; the median window has none.
  const windows = [];
  for (let w = 0; w < 21; w++) { const before = process.memoryUsage().heapUsed; run(50); windows.push((process.memoryUsage().heapUsed - before) / 50); }
  const bytes = median(windows);
  console.log(`swarm garbage: ${bytes.toFixed(1)} bytes/step`);
  assert.ok(bytes < 256, `${bytes} bytes a step`);
});

test('steps scale with the snakes, not with their square', () => {
  const measure = count => {
    const chains = new VerletChains({ chains: count, points: 12, rest: .17, gap: .16, grid: { cell: .4, x0: -80, z0: -80, w: 400, h: 400 } }), side = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) chains.place(i, (i % side) * 2.4, Math.floor(i / side) * 2.4, 1, 0, .17);
    for (let f = 0; f < 200; f++) chains.step();
    const list = [];
    for (let f = 0; f < 200; f++) { const t = performance.now(); chains.step(); list.push(performance.now() - t); }
    return median(list);
  };
  const small = measure(40), large = measure(160);
  console.log(`swarm scaling: 40 snakes ${small.toFixed(3)} ms, 160 snakes ${large.toFixed(3)} ms`);
  assert.ok(large < Math.max(small, .05) * 9, `four times the snakes took ${large / small} times as long`);
});
