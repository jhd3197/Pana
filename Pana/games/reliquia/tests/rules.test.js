import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction } from '../public/rules.js';
import { findPath, moveBody, walkable, lineClear, CAMP, ALTAR, distance } from '../public/layout.js';
import { updateDirector, random } from '../public/director.js';
function setup(n = 2) { const game = new Expedition(728); for (let i = 1; i <= n; i++) game.addPlayer(i, `Pana ${i}`); game.start(); return game; }
function step(g, seconds, inputs = new Map()) { for (let t = 0; t < seconds - 0.0001; t += 0.05) g.update(Math.min(0.05, seconds - t), inputs); }
function place(g, id, x, z) { Object.assign(g.players.find(p => p.id === id), { x, z }); }
test('route requires the gate and returns through the shortcut after taking the relic', () => {
  const closed = { gateOpen: false, relicTaken: false }, open = { gateOpen: true, relicTaken: false };
  assert.ok(findPath(CAMP, { x: 33, z: -36 }, closed).length);
  const altarApproach = { x: ALTAR.x, z: ALTAR.z + 2.5 };
  assert.equal(findPath(CAMP, altarApproach, closed).length, 0);
  assert.ok(findPath(CAMP, altarApproach, open).length);
  assert.equal(walkable(40, -48, closed), false);
  assert.equal(walkable(26, -65, open), false);
  assert.equal(walkable(26, -65, { ...open, relicTaken: true }), true);
  const p = { x: 0, z: 6 }; moveBody(p, 200, 0, closed); assert.ok(p.x < 11);
});
test('two players activate timed winches; one player can reach the second alone', () => {
  const g = setup(); place(g, 1, 33, -36); place(g, 2, 47, -36);
  step(g, 1.7, new Map([[1, { hold: true }], [2, { hold: true }]])); assert.equal(g.gateOpen, true);
  const solo = setup(1); place(solo, 1, 33, -36); step(solo, 1.7, new Map([[1, { hold: true }]]));
  const path = findPath(solo.players[0], { x: 47, z: -36 }, solo); assert.ok(path.length);
  const travel = 14 / 5.8; step(solo, travel); place(solo, 1, 47, -36); step(solo, 1.7, new Map([[1, { hold: true }]])); assert.equal(solo.gateOpen, true);
});
test('combat validates reach, cooldown and duplicate actions; dodge prevents damage', () => {
  const g = setup(1); const p = g.players[0]; place(g, 1, 0, -4); const e = g.spawn(0, -6);
  assert.equal(g.accept(1, 1, 'attack'), true); assert.equal(e.hp, 30);
  assert.equal(g.accept(1, 1, 'attack'), false); assert.equal(g.accept(1, 2, 'attack'), false); assert.equal(e.hp, 30);
  step(g, 0.6); g.accept(1, 3, 'attack'); assert.equal(g.kills, 1);
  const far = g.spawn(0, -16); p.cooldown = 0; g.accept(1, 4, 'attack'); assert.equal(far.hp, 60);
  g.action(1, 'dodge'); g.damage(p, 30); assert.equal(p.hp, 100);
  step(g, 0.5); g.damage(p, 30); assert.equal(p.hp, 70); g.action(1, 'heal'); assert.equal(p.hp, 100); assert.equal(p.heals, 1);
});
test('revive requires a nearby holding teammate and restores health once', () => {
  const g = setup(); const p = g.players[0]; g.damage(p, 100); place(g, 2, p.x + 1.5, p.z);
  assert.equal(interaction(g, g.players[1]).kind, 'revive');
  step(g, 2.5, new Map([[2, { hold: true }]])); assert.equal(p.downed, false); assert.equal(p.hp, 55); assert.equal(g.players[1].revives, 1);
  step(g, 1, new Map([[2, { hold: true }]])); assert.equal(g.players[1].revives, 1);
});
test('guardian, relic handoff, party extraction and replay form a complete loop', () => {
  const g = setup(); g.gateOpen = true; place(g, 1, 40, -96); place(g, 2, 42, -96); step(g, 0.05);
  const boss = g.enemies.find(e => e.kind === 'guardian'); assert.ok(boss);
  assert.equal(g.action(1, 'interact'), false);
  place(g, 1, boss.x, boss.z + 2); g.players[0].invulnerable = 100;
  while (boss.hp > 0) { g.players[0].cooldown = 0; g.action(1, 'attack'); }
  assert.equal(g.guardianDefeated, true);
  place(g, 1, ALTAR.x, ALTAR.z + 2); g.action(1, 'interact'); assert.equal(g.carrier, 1); assert.equal(g.relicTaken, true);
  g.players[0].invulnerable = 0; g.damage(g.players[0], 100); assert.equal(g.carrier, null);
  place(g, 2, ALTAR.x + 1, ALTAR.z + 2); g.players[0].spectator = true; g.action(2, 'interact'); assert.equal(g.carrier, 2);
  place(g, 2, CAMP.x, CAMP.z); step(g, 3.1, new Map([[2, { hold: true }]])); assert.equal(g.outcome, 'win');
  g.start(123); assert.equal(g.phase, 'playing'); assert.equal(g.carrier, null); assert.equal(g.gateOpen, false); assert.equal(g.players[0].hp, 100); assert.equal(g.enemies.length, 0);
});
test('extraction waits for the carrier and every teammate to return alive', () => {
  const g = setup(); g.relicTaken = true; g.carrier = 1; place(g, 1, 0, 17); place(g, 2, 0, -10);
  step(g, 4, new Map([[1, { hold: true }]])); assert.equal(g.phase, 'playing'); assert.equal(g.extraction, 0);
  place(g, 2, 6, 17); g.damage(g.players[1], 100);
  step(g, 4, new Map([[1, { hold: true }]])); assert.equal(g.phase, 'playing'); assert.equal(g.extraction, 0);
});
test('a team wipe ends the run and snapshot recovery preserves simulation and RNG', () => {
  const g = setup(); g.gateOpen = true; g.director.phase = 'peak'; g.director.time = 1.2; g.ledger[2] = 99; g.carrier = 1; g.relicTaken = true;
  const snap = g.snapshot(), recovered = new Expedition(); recovered.restore(snap, new Map([[2, { id: 2, name: 'Pana 2' }]]));
  assert.equal(recovered.players.length, 1); assert.equal(recovered.carrier, null); assert.equal(recovered.director.time, 1.2); assert.equal(recovered.ledger[2], 99);
  assert.equal(random(recovered), random(g)); assert.equal(recovered.accept(2, 99, 'heal'), false);
  recovered.damage(recovered.players[0], 100); step(recovered, 3.1); assert.equal(recovered.outcome, 'loss');
});
test('Director completes its cycle, respects caps and avoids visible ambient spawns', () => {
  const g = setup(); const d = g.director; d.phase = 'build'; g.players[0].intensity = 0.9;
  updateDirector(g, 0.05, () => false); assert.equal(d.phase, 'peak');
  updateDirector(g, 5, () => false); assert.equal(d.phase, 'fade');
  g.players.forEach(p => { p.intensity = 0; }); updateDirector(g, 0.05, () => false); assert.equal(d.phase, 'rest');
  updateDirector(g, 36, () => false); assert.equal(d.phase, 'build');
  place(g, 1, 33, -36); place(g, 2, 34, -35); assert.equal(g.wave(3), true); assert.ok(g.enemies.length > 0);
  for (const e of g.enemies) for (const p of g.players) { assert.ok(distance(p, e) > 10); assert.equal(lineClear(p, e, g, 0.05), false); }
  for (const e of g.enemies) assert.ok(g.players.some(p => findPath(e, p, g).length));
  for (let i = 0; i < 25; i++) g.spawn(2, -12); assert.equal(g.enemies.length, g.options.mummies);
  const a = setup(), b = setup(); a.gateOpen = b.gateOpen = true;
  step(a, 10); step(b, 10); assert.deepEqual(a.snapshot(), b.snapshot());
});

test('actual movement traverses camp, both wheels, sanctuary and the return tunnel', () => {
  const g = setup(1), p = g.players[0]; p.invulnerable = 1000;
  function walk(x, z) {
    const path = findPath(p, { x, z }, g); assert.ok(path.length, `route to ${x},${z}`);
    for (const target of path) {
      let ticks = 0;
      while (distance(p, target) > 0.16) {
        const d = distance(p, target), speed = g.carrier === p.id ? 4.6 : 5.8;
        const scale = Math.min(1, d / (speed * 0.05));
        g.update(0.05, new Map([[p.id, { x: (target.x - p.x) / d * scale, z: (target.z - p.z) / d * scale }]]));
        assert.ok(walkable(p.x, p.z, g), 'movement stays on the usable floor');
        assert.ok(++ticks < 400, `stuck en route to ${target.x},${target.z}`);
      }
    }
    assert.ok(distance(p, { x, z }) < 0.2);
  }
  walk(33, -36); step(g, 1.7, new Map([[1, { hold: true }]]));
  walk(47, -36); step(g, 1.7, new Map([[1, { hold: true }]])); assert.equal(g.gateOpen, true);
  walk(40, -107.5); assert.ok(g.enemies.some(e => e.kind === 'guardian'));
  // Combat has separate coverage. This test isolates route clearance.
  g.guardianDefeated = true; g.enemies = []; g.action(1, 'interact'); assert.equal(g.carrier, 1);
  for (const [x, z] of [[40, -65], [17, -65], [4, -64], [4, -42], [0, 17]]) walk(x, z);
  step(g, 3.1, new Map([[1, { hold: true }]])); assert.equal(g.outcome, 'win');
});
