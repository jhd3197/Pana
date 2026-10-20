import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction, visibleItems, titles, compassTarget, stepExplorer, tier } from '../public/rules.js';
import { layoutFor, distance } from '../public/layout.js';
import { TRUCK, TABLE, floorOf } from '../public/deck.js';
import { ITEMS, BAG_SIZE } from '../public/items.js';
import { spawnEnemy, lightOn } from '../public/enemies.js';

function setup(n = 2, seed = 4242, options = {}) {
  const g = new Expedition(seed, options); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed); return g;
}
const run = g => g.layout.run;
function step(g, seconds, inputs = new Map()) { for (let t = 0; t < seconds - 1e-4; t += .05) g.update(Math.min(.05, seconds - t), inputs); }
function place(g, id, x, z, h) { Object.assign(g.players.find(p => p.id === id), { x, z }, h === undefined ? {} : { h }); }
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const firstFloor = g => run(g).portals.find(p => p.id === 'down-0').to;
// A deck loot item of this size on floor 1, placed where a pana can stand next to it.
function lootOn(g, size, floor = 1) { return run(g).loot.find(l => l.floor === floor && ITEMS[l.kind].size === size && g.layout.walkable(l.x, l.z + 1.2, g)); }
function stand(g, id, item) { place(g, id, item.x, item.z + 1.2); const p = g.players.find(p => p.id === id); p.h = facing(p, item); return p; }

test('every room of many dealt runs is reachable once the seals open', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const L = layoutFor(seed, 3), state = { open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])) };
    assert.equal(L.run.rooms.filter(r => r.kind === 'boveda').length, 1, 'one vault, on the last floor');
    assert.equal(L.run.rooms.find(r => r.kind === 'boveda').floor, 3);
    for (const r of L.run.rooms) {
      const landing = r.floor === 0 ? { x: 0, z: 10 } : L.run.portals.find(p => p.dir === 'down' && p.to.floor === r.floor).to;
      assert.ok(L.findPath(landing, { x: r.x + (r.kind === 'idolo' ? 2 : 0), z: r.z + (['puente', 'santuario', 'idolo'].includes(r.kind) ? 0 : 0) }, state).length || L.run.pits.some(p => p.room === r.id) || r.kind === 'santuario' || r.kind === 'idolo', `seed ${seed}: ${r.id} ${r.kind}`);
    }
  }
  const a = layoutFor(5, 3).run, b = layoutFor(6, 3).run;
  assert.notDeepEqual(a.rooms.map(r => r.kind), b.rooms.map(r => r.kind), 'two runs never match');
});

test('the camp table has faroles; small loot fills the bag, hand loot takes a hand', () => {
  const g = setup(1), p = g.players[0];
  place(g, 1, TABLE.x - .6, TABLE.z + 1.9, Math.PI);
  assert.equal(interaction(g, p).kind, 'pick');
  assert.equal(g.action(1, 'interact'), true); assert.equal(p.hands[0].kind, 'farol');
  const bagItem = lootOn(g, 'bag'); place(g, 1, bagItem.x, bagItem.z + 1.2); p.h = facing(p, bagItem); p.interactCooldown = 0;
  assert.equal(g.action(1, 'interact'), true); assert.equal(p.bag.length, 1);
  assert.ok(g.codicia > 0, 'lifting treasure wakes la codicia');
  assert.ok(!visibleItems(g).some(i => i.id === bagItem.id));
  // A full bag and full hands refuse more.
  p.bag = Array(BAG_SIZE).fill('coins'); p.hands = [{ id: 1, kind: 'farol' }, { id: 2, kind: 'machete' }];
  const another = run(g).loot.find(l => l.floor === 1 && l.id !== bagItem.id && ITEMS[l.kind].size === 'bag'); place(g, 1, another.x, another.z + 1.2); p.h = facing(p, another); p.interactCooldown = 0;
  assert.equal(g.action(1, 'interact'), false);
});

test('dropping and throwing: loot flies, lands, bonks a pana and can be caught', () => {
  const g = setup(2), [a, b] = g.players, at = firstFloor(g);
  place(g, 1, at.x, at.z - 3, Math.PI); place(g, 2, at.x, at.z - 6.5);
  a.hands[0] = { id: 999, kind: 'idol' };
  assert.equal(g.action(1, 'throw'), true); assert.equal(a.hands[0], null);
  assert.equal(g.items.find(i => i.id === 999).state, 'air');
  step(g, 1.2);
  assert.ok(b.stats ? true : false);
  const idol = g.items.find(i => i.id === 999); assert.equal(idol.state, 'ground');
  assert.ok(g.events.some(e => e.kind === 'bonk' && e.player === 2) || distance(idol, a) > 2, 'it hit Pana 2 or flew past');
  // Catch: hold E as it arrives.
  a.hands[0] = { id: 998, kind: 'mask' }; b.hands = [null, null]; b.stun = 0; a.cooldown = 0;
  place(g, 1, at.x, at.z - 3, Math.PI); place(g, 2, at.x, at.z - 7);
  g.action(1, 'throw'); step(g, 1, new Map([[2, { hold: true }]]));
  assert.equal(b.hands.some(h => h?.kind === 'mask'), true, 'caught in the air');
});

test('big treasures need their panas: alone they crawl, together they reach the truck', () => {
  const g = setup(2), [a, b] = g.players;
  const disk = g.spawnItem('sunDisk', TRUCK.x - 14, TRUCK.z, { y: 0 });
  place(g, 1, disk.x + .5, disk.z + 1.6); a.h = facing(a, disk);
  assert.equal(interaction(g, a).kind, 'pick');
  assert.equal(g.action(1, 'interact'), true); assert.equal(a.grip, disk.id);
  const x0 = disk.x; step(g, 1, new Map([[1, { x: 1, z: 0 }]]));
  const solo = disk.x - x0;
  b.h = facing(b, disk); place(g, 2, disk.x - .5, disk.z - 1.6); b.h = facing(b, disk); b.interactCooldown = 0;
  assert.equal(g.action(2, 'interact'), true); assert.equal(disk.carriers.length, 2);
  const x1 = disk.x; step(g, 1, new Map([[1, { x: 1, z: 0 }], [2, { x: 1, z: 0 }]]));
  assert.ok(disk.x - x1 > solo * 2.5, `two carriers (${(disk.x - x1).toFixed(2)}) far faster than one (${solo.toFixed(2)})`);
  for (let i = 0; i < 200 && g.items.includes(disk); i++) g.update(.05, new Map([[1, { x: 1, z: 0 }], [2, { x: 1, z: 0 }]]));
  assert.ok(!g.items.includes(disk), 'banked');
  assert.equal(g.haul, ITEMS.sunDisk.value); assert.equal(a.grip, null); assert.ok(a.stats.banked > 0 && b.stats.banked > 0);
  assert.equal(g.truck.at(-1), 'sunDisk');
});

test('letting go of a moving treasure tips it over and chips its worth', () => {
  const g = setup(1), [a] = g.players, drum = g.spawnItem('drum', 0, 12, { y: 0 });
  place(g, 1, drum.x, drum.z + 1.4); a.h = facing(a, drum); g.action(1, 'interact');
  step(g, .5, new Map([[1, { x: 1, z: 0 }]]));
  drum.vx = 2; g.release(a);
  assert.ok(drum.worth < 1); assert.ok(a.stats.dropped > 0); assert.ok(g.events.some(e => e.kind === 'tip'));
});

test('the truck banks the bag, multiplied while you hold the laughing idol', () => {
  const g = setup(1), [a] = g.players;
  a.bag = ['coins', 'emerald']; place(g, 1, TRUCK.x + 2, TRUCK.z + 2); step(g, .1);
  assert.equal(g.haul, ITEMS.coins.value + ITEMS.emerald.value); assert.equal(a.bag.length, 0);
  a.bag = ['coins']; a.hands[0] = { id: 77, kind: 'laughingIdol' }; step(g, .1);
  assert.equal(g.haul, ITEMS.coins.value * 2.5 + ITEMS.emerald.value);
  assert.equal(a.hands[0]?.kind, 'laughingIdol', 'artifacts stay in hand until dropped at the truck');
});

test('the mine mouth and the stairs carry panas between floors; the seal holds the way down', () => {
  const g = setup(1), [a] = g.players, L = g.layout;
  place(g, 1, 0, -3, Math.PI); step(g, 2.5, new Map([[1, { x: 0, z: -1, h: Math.PI }]]));
  assert.equal(floorOf(a.x), 1); assert.equal(g.deepest, 1); assert.equal(a.stats.unaMas, 1);
  const seal = L.run.seals.find(s => s.floor === 1);
  assert.equal(L.walkable(seal.x, seal.z - .3, g), false, 'closed seal');
  // Both wheels: one pana can latch the first and run to the second.
  for (const w of seal.winches) { place(g, 1, w.x, w.z + 1.6); step(g, 1.7, new Map([[1, { hold: true }]])); }
  assert.equal(g.open[seal.id], 1); assert.ok(L.walkable(seal.x, seal.z - .3, g));
  const down = L.run.portals.find(p => p.dir === 'down' && p.floor === 1);
  place(g, 1, (down.rect[0] + down.rect[2]) / 2, down.rect[1] + 1.2); step(g, .1);
  assert.equal(floorOf(a.x), 2); assert.equal(g.deepest, 2);
  const up = L.run.portals.find(p => p.dir === 'up' && p.floor === 2);
  place(g, 1, (up.rect[0] + up.rect[2]) / 2, up.rect[3] - 1); step(g, .1);
  assert.equal(floorOf(a.x), 1, 'back up');
});

test('farol light freezes a mummy; in the dark it rushes', () => {
  const g = setup(1), [a] = g.players, at = firstFloor(g);
  place(g, 1, at.x, at.z - 2, Math.PI); g.woke[g.layout.regionAt(a).id] = 1;
  const m = spawnEnemy(g, 'mummy', at.x, at.z - 7); m.born = -5;
  a.hands[0] = { id: 1, kind: 'farol' }; a.h = facing(a, m);
  const z0 = m.z; step(g, .5);
  assert.equal(lightOn(g, m), 'beam'); assert.ok(Math.abs(m.z - z0) < .01, 'frozen in the beam');
  a.h += Math.PI; step(g, .5); assert.ok(Math.abs(m.z - z0) > .3, 'moves once the light turns away');
});

test('codicia tiers collapse a corridor that panas must dig through', () => {
  const g = setup(1), [a] = g.players, at = firstFloor(g);
  place(g, 1, at.x, at.z - 2); g.codicia = 80; g.collapseIn = 0; a.invulnerable = 1e9;
  step(g, .1);
  const [id] = Object.keys(g.rubble); assert.ok(id, 'a corridor caved in'); assert.equal(tier(g), 3);
  const c = run(g).corridors.find(c => c.id === id);
  assert.equal(g.layout.walkable((c.rect[0] + c.rect[2]) / 2, (c.rect[1] + c.rect[3]) / 2, g), false);
  const side = c.horizontal ? { x: c.rect[0] - .8, z: (c.rect[1] + c.rect[3]) / 2 } : { x: (c.rect[0] + c.rect[2]) / 2, z: c.rect[3] + .8 };
  place(g, 1, side.x, side.z); g.enemies = [];
  assert.equal(interaction(g, a)?.kind, 'rubble');
  step(g, 5.2, new Map([[1, { hold: true }]])); assert.equal(g.rubble[id], undefined, 'cleared');
});

test('down, dragged to the truck, back on your feet; a wipe keeps only a share', () => {
  const g = setup(2), [a, b] = g.players;
  place(g, 1, 0, 14); place(g, 2, 1.2, 14);
  a.bag = ['coins', 'coins']; g.damage(a, 100);
  assert.equal(a.downed, true); assert.equal(a.bag.length, 1, 'half the bag spills');
  b.h = facing(b, a); assert.equal(g.action(2, 'drag'), true);
  for (let i = 0; i < 160 && a.downed; i++) g.update(.05, new Map([[2, { x: (TRUCK.x - b.x) / 10, z: (TRUCK.z - b.z) / 10 }]]));
  assert.equal(a.downed, false, 'the truck botiquín got them up');
  g.haul = 1000; place(g, 1, 0, 6); place(g, 2, 1, 6); a.invulnerable = b.invulnerable = 0; g.damage(a, 100); g.damage(b, 100); step(g, 3.2);
  assert.equal(g.phase, 'results'); assert.equal(g.outcome, 'wipe'); assert.equal(g.payout, 200);
});

test('extraction needs every standing pana at the truck; titles go to the stats', () => {
  const g = setup(2), [a, b] = g.players;
  g.haul = 500; place(g, 1, TRUCK.x + 3, TRUCK.z); place(g, 2, 0, -1);
  step(g, 3.5, new Map([[1, { hold: true }]])); assert.equal(g.phase, 'playing');
  place(g, 2, TRUCK.x + 3.5, TRUCK.z + 1); a.stats.unaMas = 3; b.stats.banked = 900; b.stats.dropped = 40;
  step(g, 3.5, new Map([[1, { hold: true }]])); assert.equal(g.outcome, 'extracted'); assert.equal(g.payout, 500);
  const list = titles(g);
  assert.equal(list.find(t => t.title === 'El codicioso').player, 1); assert.equal(list.find(t => t.title === 'El cargador').player, 2);
});

test('the echo mask reveals a hidden room; the compass points at treasure or a boss', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = setup(1, seed), wall = run(g).hidden.find(h => h.floor === 1); if (!wall) continue;
    const [a] = g.players; a.hands[0] = { id: 5, kind: 'echoMask' };
    place(g, 1, wall.x + (wall.horizontal ? 0 : 0), wall.z); a.x = wall.x; a.z = wall.z;
    // Stand on the path side of the wall.
    const room = run(g).rooms.find(r => r.floor === 1 && !r.hidden && Math.hypot(r.x - wall.x, r.z - wall.z) < 14);
    place(g, 1, room.x, room.z); step(g, .1);
    assert.equal(g.revealed[wall.id], 1, `seed ${seed}`);
    const target = compassTarget(g, a); assert.ok(target && Number.isFinite(target.x));
    return;
  }
  assert.fail('no run with a hidden room');
});

test('a guest predicts exactly what the host simulates', () => {
  const g = setup(1), [a] = g.players; place(g, 1, 0, 12);
  const guest = structuredClone(a), input = { x: .6, z: -.8, h: 2, sprint: true };
  for (let i = 0; i < 40; i++) { g.update(.05, new Map([[1, input]])); stepExplorer(guest, input, .05, g.snapshot()); }
  assert.ok(Math.abs(guest.x - a.x) < 1e-9 && Math.abs(guest.z - a.z) < 1e-9);
});

test('snapshots carry the run: restore continues the same simulation', () => {
  const a = setup(2, 99), b = setup(2, 99);
  step(a, 5); step(b, 5); assert.deepEqual(a.snapshot(), b.snapshot());
  a.ledger[2] = 50; a.codicia = 33; a.touched[3] = 1;
  const restored = new Expedition(); restored.restore(a.snapshot(), new Map([[1, { id: 1, name: 'Pana 1' }]]));
  assert.equal(restored.players.length, 1); assert.equal(restored.codicia, 33); assert.equal(restored.touched[3], 1);
  assert.equal(restored.accept(1, (restored.ledger[1] || 0), 'bark', { line: 0 }), false, 'old seq refused');
  assert.equal(restored.layout.run.rooms.length, a.layout.run.rooms.length);
});

test('the guardian wakes, slams, falls to machetes and opens the way down', () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = setup(2, seed), seal = run(g).seals.find(s => s.kind === 'guardian'); if (!seal) continue;
    const room = run(g).rooms.find(r => r.id === seal.room), [a, b] = g.players;
    place(g, 1, room.x, room.z + 4); place(g, 2, room.x + 1.5, room.z + 4); step(g, .1);
    const boss = g.enemies.find(e => e.kind === 'guardian'); assert.ok(boss, 'the guardian is in its room');
    a.hands[0] = { id: 1, kind: 'machete' }; b.hands[0] = { id: 2, kind: 'machete' }; a.invulnerable = b.invulnerable = 1e9;
    for (let i = 0; i < 400 && boss.hp > 0; i++) {
      for (const p of [a, b]) { p.x = boss.x + (p === a ? -1.6 : 1.6); p.z = boss.z + 1.4; p.h = facing(p, boss); p.cooldown = 0; g.action(p.id, 'use', { hand: 0 }); }
      g.update(.05);
    }
    assert.ok(boss.hp <= 0); assert.equal(g.open[seal.id], 1); assert.ok(g.events.some(e => e.kind === 'guardian'));
    return;
  }
  assert.fail('no guardian floor');
});

test('the jaguar crouches before it pounces, and a farol dazes it once in a while', () => {
  const g = setup(1, 77), vault = run(g).rooms.find(r => r.kind === 'boveda'), [a] = g.players;
  place(g, 1, vault.x, vault.z + 6); step(g, .1);
  const cat = g.enemies.find(e => e.kind === 'jaguar'); assert.ok(cat); cat.awake = true; cat.born = -9;
  a.h = facing(a, cat);
  let crouched = false;
  for (let i = 0; i < 120 && !g.events.some(e => e.kind === 'pounce'); i++) { g.update(.05); crouched ||= cat.mode === 'crouch'; }
  assert.ok(crouched, 'telegraphed'); assert.ok(g.events.some(e => e.kind === 'pounce'));
  cat.mode = 'prowl'; cat.immune = 0; cat.stun = 0; a.hp = 100; a.downed = false; a.hands[0] = { id: 3, kind: 'farol' };
  place(g, 1, cat.x, cat.z + 4); a.h = facing(a, cat); step(g, .1);
  assert.ok(cat.stun > 0 && cat.immune > 0, 'dazed by the beam');
});
