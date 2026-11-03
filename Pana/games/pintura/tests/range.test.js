import test from 'node:test';
import assert from 'node:assert/strict';
import { createRangeSim, TARGETS, MARKS, FIRE, MELEE_REACH, BAY } from '../public/range-sim.js';
import { kitStats } from '../public/armory-data.js';

// Fires up to `shots` aimed shots at target t (aiming through a Mira when asked) and returns what landed on it.
function shoot(sim, t, { shots = 6, aim = false, ticks = 400 } = {}) {
  const from = sim.me.fired, hits = [], shorts = [];
  for (let i = 0; i < ticks && (sim.me.fired - from < shots || sim.arena.balls.length); i++) {
    const r = sim.tick({ ...sim.aimAt(t), fire: sim.me.fired - from < shots, aim });
    hits.push(...r.hits.filter(h => h.target.id === t.id)); shorts.push(...r.shorts);
  }
  return { hits, shorts };
}
const at = (sim, d) => sim.targets.find(t => t.d === d);

test('the distance marks cover every marker range and the targets stand on them', () => {
  assert.deepEqual(MARKS, [10, 25, 50, 75, 100]);
  for (const d of [10, 25, 50, 75, 100]) assert.ok(TARGETS.some(t => t.d === d), `a target at ${d} m`);
  assert.ok(TARGETS.length <= 7, 'the shooter and the targets fit the eight seats');
});

test('hits register at 10 and 50 m with the real distance and damage', () => {
  const sim = createRangeSim({ weapon: 'bullpup' });
  for (const d of [10, 50]) {
    const { hits } = shoot(sim, at(sim, d));
    assert.ok(hits.length > 0, `hits at ${d} m`);
    assert.ok(Math.abs(hits[0].distance - d) <= 1, `${hits[0].distance} m read at ${d} m`);
    assert.equal(hits[0].damage, kitStats({ weapon: 'bullpup' }).damage);
  }
  assert.ok(sim.counts.hits > 0 && sim.counts.shots >= sim.counts.hits);
});

test('the 100 m board is past every marker range: a shot falls short at its real range', () => {
  const sim = createRangeSim({ weapon: 'bullpup' }), stats = kitStats({ weapon: 'bullpup' });
  const { hits, shorts } = shoot(sim, at(sim, 100), { shots: 2 });
  assert.equal(hits.length, 0);
  assert.ok(shorts.length > 0);
  assert.ok(Math.abs(shorts[0].travel - stats.speed * stats.life) < 3, `fell at ${shorts[0].travel} m, range ${stats.speed * stats.life} m`);
});

test('La Lejana falls off with distance, as in a round', () => {
  const sim = createRangeSim({ weapon: 'sniper' });
  // Aimed at the chest through the scope: body hits only.
  const near = shoot(sim, at(sim, 10), { shots: 2, aim: true }).hits[0], far = shoot(sim, at(sim, 50), { shots: 4, aim: true }).hits[0];
  assert.ok(near && far);
  assert.ok(near.damage > far.damage, `${near.damage} at 10 m, ${far.damage} at 50 m`);
});

test('targets are never knocked out, popups drop out of play and the rail moves', () => {
  const sim = createRangeSim({ weapon: 'smg' }), rail = sim.targets.find(t => t.kind === 'rail'), popup = sim.targets.find(t => t.kind === 'popup');
  const offsets = new Set(), raised = new Set();
  for (let i = 0; i < 120; i++) { sim.tick({ ...sim.aimAt(at(sim, 10)), fire: true }); offsets.add(Math.round(rail.offset)); raised.add(popup.raised); }
  assert.ok(offsets.size > 2, 'the rail target slides');
  assert.deepEqual([...raised].sort(), [0, 1]);
  assert.equal(sim.arena.phase, 'playing');
  for (const p of sim.arena.players) { assert.equal(p.respawn, 0); assert.equal(p.paint, 0); }
  assert.equal(sim.me.x, FIRE.x);
});

test('magazine, reload and grenade come from the kit', () => {
  const sim = createRangeSim({ weapon: 'pistol' }), stats = kitStats({ weapon: 'pistol' }), t = at(sim, 10);
  assert.equal(sim.me.ammo, stats.magazine);
  for (let i = 0; i < 200 && !sim.me.reload; i++) sim.tick({ ...sim.aimAt(t), fire: true });
  assert.ok(sim.me.reload > 0, 'an empty magazine reloads');
  assert.ok(sim.me.grenadeReady);
  const lob = sim.arena.aimGrenade(sim.me, t.x, t.z), booms = [];
  for (let i = 0; i < 3; i++) sim.tick({ ...sim.aimAt(t), grenade: true, pitch: lob?.pitch ?? 0, charge: lob?.charge ?? .5 });
  assert.equal(sim.me.grenadeReady, false);
  for (let i = 0; i < 200 && !booms.length; i++) booms.push(...sim.tick({ ...sim.aimAt(t) }).booms);
  assert.ok(booms.length, 'the grenade blows');
  for (let i = 0; i < 5; i++) sim.tick({});
  assert.ok(sim.me.grenadeReady, 'and comes back for the next test');
});

test('a melee kit gets a target within reach and swings land on it', () => {
  const sim = createRangeSim({ weapon: 'bat' });
  assert.ok(sim.melee); assert.equal(sim.targets[0].d, MELEE_REACH);
  const { hits } = shoot(sim, sim.targets[0], { shots: 0, ticks: 1 });
  assert.equal(hits.length, 0);
  let landed = [];
  for (let i = 0; i < 40 && !landed.length; i++) landed = sim.tick({ ...sim.aimAt(sim.targets[0]), fire: true }).hits;
  assert.ok(landed.length && landed[0].melee);
});

test('reset clears the counts and the paint in flight', () => {
  const sim = createRangeSim({ weapon: 'smg' });
  shoot(sim, at(sim, 10), { shots: 3 }); assert.ok(sim.counts.shots > 0);
  sim.reset(); assert.deepEqual(sim.counts, { shots: 0, hits: 0 }); assert.equal(sim.arena.splats.length, 0);
});

test('the shooter walks the firing bay (never past the line) and distances read from where they stand', () => {
  const sim = createRangeSim({ weapon: 'bullpup' }), stats = kitStats({ weapon: 'bullpup' });
  sim.tick({ ax: 1, az: 0, x: -1, z: 0 });
  assert.ok(Math.abs(sim.stand.x - (FIRE.x - 7 * stats.mobility * .05)) < 1e-9, 'one tick of the kit\'s walk');
  for (let i = 0; i < 200; i++) sim.tick({ ax: 1, az: 0, x: 1, z: 0 });
  assert.equal(sim.stand.x, FIRE.x, 'the firing line stops the walk');
  for (let i = 0; i < 200; i++) sim.tick({ ax: 1, az: 0, x: -1, z: 1 });
  assert.deepEqual(sim.stand, { x: FIRE.x - BAY.back, z: BAY.half });
  assert.deepEqual([sim.me.x, sim.me.z], [FIRE.x - BAY.back, BAY.half]);
  const board = at(sim, 25), { hits } = shoot(sim, board, { shots: 3 });
  assert.ok(hits.length > 0, 'hits from the corner of the bay');
  assert.equal(hits[0].distance, Math.round(Math.hypot(board.x - sim.stand.x, board.z - sim.stand.z)));
  sim.reset(); assert.deepEqual(sim.stand, { x: FIRE.x - BAY.back, z: BAY.half }, 'resetting the targets leaves the shooter where they stand');
});
