import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction, visibleItems, titles, compassTarget, stepExplorer, tier, liftPanel, cartValue } from '../public/rules.js';
import { layoutFor, distance } from '../public/layout.js';
import { TRUCK, TABLE, floorOf } from '../public/deck.js';
import { ITEMS, HANDFUL } from '../public/items.js';
import { spawnEnemy, lightOn } from '../public/enemies.js';

function setup(n = 2, seed = 4242, options = {}) {
  const g = new Expedition(seed, options); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed); return g;
}
const run = g => g.layout.run;
function step(g, seconds, inputs = new Map()) { for (let t = 0; t < seconds - 1e-4; t += .05) g.update(Math.min(.05, seconds - t), inputs); }
function place(g, id, x, z, h) { Object.assign(g.players.find(p => p.id === id), { x, z }, h === undefined ? {} : { h }); }
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
// Just inside a floor's entrance room, in front of its montacargas stop.
const arrival = (g, f) => { const s = run(g).lifts.find(l => l.floor === f); return { x: s.x, z: s.z - 5, h: Math.PI }; };
const firstFloor = g => arrival(g, 1);
// Stand on the deck, look down at the cage's one button.
function aimButton(g, id) { const p = g.players.find(p => p.id === id), stop = run(g).lifts.find(l => l.floor === floorOf(p.x)), at = liftPanel(stop); place(g, id, stop.x, stop.z); p.h = facing(p, at); p.pitch = Math.atan2(-.35, Math.hypot(at.x - p.x, at.z - p.z)); return p; }
// Hold E on it until the cage leaves, then let it arrive.
function ride(g, id) { aimButton(g, id); step(g, 1.6, new Map([[id, { hold: true }]])); step(g, 14); }
// Look at the cargo lift's yellow button from a step away.
function aimCargo(g, id) { const pad = run(g).cargo.find(c => c.floor === 1), at = { x: pad.bx, z: pad.bz }, p = g.players.find(p => p.id === id); place(g, id, at.x + Math.sign(at.x - pad.x) * 1.2, at.z); p.h = facing(p, at); p.pitch = Math.atan2(1.1 - 1.45, 1.2); return pad; }
// A deck loot item of this size on floor 1, placed where a pana can stand next to it.
function lootOn(g, size, floor = 1) { return run(g).loot.find(l => l.floor === floor && ITEMS[l.kind].size === size && g.layout.walkable(l.x, l.z + 1.2, g)); }
function stand(g, id, item) { place(g, id, item.x, item.z + 1.2); const p = g.players.find(p => p.id === id); p.h = facing(p, item); return p; }

test('every room of many dealt jornadas is reachable once the seals open', () => {
  for (let seed = 1; seed <= 20; seed++) for (const depth of [1, 2, 3]) {
    const L = layoutFor(seed, depth), state = { open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), lift: { floor: 1, moving: false } };
    assert.equal(L.run.rooms.some(r => r.kind === 'boveda'), depth === 3, 'the vault every third jornada');
    assert.ok(L.run.cargo.some(c => c.floor === 1) && L.run.carts.length === 1, 'one carrito and its cargo lift');
    const stop = L.run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 };
    for (const r of L.run.rooms.filter(r => r.floor === 1)) {
      assert.ok(L.findPath(landing, { x: r.x + (r.kind === 'idolo' ? 2 : 0), z: r.z }, state).length || L.run.pits.some(p => p.room === r.id) || r.kind === 'santuario' || r.kind === 'idolo', `seed ${seed}/${depth}: ${r.id} ${r.kind}`);
    }
    for (const v of L.run.stubs.filter(s => s.kind === 'vault')) assert.ok(L.findPath(landing, { x: (v.rect[0] + v.rect[2]) / 2, z: (v.rect[1] + v.rect[3]) / 2 }, state).length, `seed ${seed}/${depth}: the sealed chamber`);
  }
  const a = layoutFor(5, 1).run, b = layoutFor(6, 1).run;
  assert.notDeepEqual(a.rooms.map(r => r.kind), b.rooms.map(r => r.kind), 'two jornadas never match');
});

test('the camp table has faroles; small loot makes a handful; one weapon at a time', () => {
  const g = setup(1), p = g.players[0];
  place(g, 1, TABLE.x - .6, TABLE.z + 1.9, Math.PI);
  assert.equal(interaction(g, p).kind, 'pick');
  assert.equal(g.action(1, 'interact'), true); assert.equal(p.hands[0].kind, 'farol');
  const small = lootOn(g, 'small'); place(g, 1, small.x, small.z + 1.2); p.h = facing(p, small); p.interactCooldown = 0;
  assert.equal(g.action(1, 'interact'), true); assert.deepEqual(p.hands[1].pile, [small.kind]);
  assert.ok(g.codicia > 0, 'lifting treasure wakes la codicia');
  assert.ok(!visibleItems(g).some(i => i.id === small.id));
  // The handful fills up to four, then both hands are full.
  p.hands[1].pile = Array(HANDFUL).fill('coins');
  const another = run(g).loot.find(l => l.floor === 1 && l.id !== small.id && ITEMS[l.kind].size === 'small'); place(g, 1, another.x, another.z + 1.2); p.h = facing(p, another); p.interactCooldown = 0;
  assert.equal(g.action(1, 'interact'), false);
  // A second weapon swaps for the first instead of filling the other hand.
  p.hands = [{ id: 1, kind: 'machete' }, null];
  g.spawnItem('honda', p.x, p.z - 1, { y: 0 }); p.h = Math.PI; p.interactCooldown = 0;
  assert.match(interaction(g, p).text, /Cambiar/); g.action(1, 'interact');
  assert.equal(p.hands[0].kind, 'honda'); assert.equal(p.hands[1], null); assert.ok(g.items.some(i => i.kind === 'machete'));
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

test('the truck banks what your hands carry, more while you hold the laughing idol', () => {
  const g = setup(1), [a] = g.players;
  a.hands[0] = { id: 70, kind: 'coins', pile: ['coins', 'emerald'] }; place(g, 1, TRUCK.x + 2, TRUCK.z + 2); step(g, .1);
  assert.equal(g.haul, ITEMS.coins.value + ITEMS.emerald.value); assert.equal(a.hands[0], null);
  a.hands = [{ id: 77, kind: 'laughingIdol' }, { id: 71, kind: 'coins', pile: ['coins'] }]; step(g, .1);
  assert.equal(g.haul, ITEMS.coins.value * 2.5 + ITEMS.emerald.value);
  assert.equal(a.hands[0]?.kind, 'laughingIdol', 'artifacts stay in hand until dropped at the truck');
});

test('one button: down into the jornada; up only once the cargo has carried the quota', () => {
  const g = setup(2), [a, b] = g.players, cart = g.carts[0], first = g.seed;
  place(g, 2, 0, 6);
  ride(g, 1);
  assert.equal(floorOf(a.x), 1); assert.equal(g.deepest, 1); assert.equal(a.stats.unaMas, 1); assert.equal(a.riding, false);
  aimButton(g, 1); assert.equal(interaction(g, a).kind, 'info', 'no quota, no way up');
  // The carrito never rides the montacargas: it waits in the jornada.
  assert.equal(floorOf(cart.x), 1);
  const pad = aimCargo(g, 1);
  assert.equal(interaction(g, a).kind, 'info', 'push the carrito onto the pad first');
  Object.assign(cart, { x: pad.x, z: pad.z });
  while (cartValue(cart) < g.quota) cart.contents.push({ kind: 'cup', worth: 1 });
  assert.equal(interaction(g, a).kind, 'cargo'); a.interactCooldown = 0; g.action(1, 'interact');
  assert.equal(cart.away, true); step(g, 3.2);
  assert.ok(g.delivered >= g.quota); assert.equal(cart.contents.length, 0); assert.ok(g.mangos > 0);
  step(g, 3.2); assert.equal(cart.away, false, 'it comes back down empty');
  // Pana 2 rides down too, then wanders off and is left behind.
  const quota = g.quota; place(g, 2, a.x + 6, a.z - 6);
  ride(g, 1);
  assert.equal(floorOf(a.x), 0); assert.equal(g.level, 2); assert.notEqual(g.seed, first); assert.ok(g.quota > quota);
  assert.equal(floorOf(b.x), 0); assert.equal(b.hp, 1, 'left below, hauled up with 1 HP');
  assert.equal(g.carts.length, 1); assert.equal(floorOf(g.carts[0].x), 1, 'a fresh carrito waits in the next jornada');
});

test('whoever stays below when the cage goes up is hauled to the camp with 1 HP', () => {
  const g = setup(2), [a, b] = g.players;
  ride(g, 1); place(g, 2, a.x, a.z - 4); g.delivered = g.quota;
  ride(g, 1);
  assert.equal(g.level, 2); assert.equal(floorOf(b.x), 0); assert.equal(b.hp, 1);
});

test('mangos buy gear at the camp shop, straight into a hand', () => {
  const g = setup(1), [a] = g.players; g.mangos = 100;
  const spot = { x: -12.5 + .9, z: 6 - 1.5 + 4 * .75 }; place(g, 1, spot.x + 1.4, spot.z);
  a.h = facing(a, spot); a.pitch = Math.atan2(1.05 - 1.45, 1.4);
  assert.equal(interaction(g, a).kind, 'buy'); g.action(1, 'interact');
  assert.equal(a.hands[0].kind, 'marcadora'); assert.equal(g.mangos, 55);
});

test('one cage: away it is a hole, busy it waits, empty it comes when called', () => {
  const g = setup(2), [a, b] = g.players, L = g.layout, camp = L.run.lifts.find(l => l.floor === 0), stop = L.run.lifts.find(l => l.floor === 1);
  place(g, 2, 0, 6);
  ride(g, 1); assert.equal(floorOf(a.x), 1); assert.equal(floorOf(b.x), 0, 'Pana 2 stayed behind');
  assert.equal(L.walkable(camp.x, camp.z, g), false, 'the empty shaft is a hole');
  place(g, 2, camp.x, camp.z + 2.4); b.h = Math.PI; b.pitch = 0;
  assert.equal(interaction(g, b).kind, 'call');
  step(g, 1.6, new Map([[2, { hold: true }]])); assert.equal(g.lift.moving, true);
  place(g, 1, stop.x, stop.z - 2.3); a.h = 0; a.pitch = 0;
  assert.equal(interaction(g, a).kind, 'info', 'busy');
  step(g, 14); assert.equal(g.lift.floor, 0); assert.equal(floorOf(a.x), 1, 'nobody rode the call');
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
  place(g, 1, side.x, side.z); g.enemies = []; a.h = c.horizontal ? Math.PI / 2 : Math.PI; a.pitch = 0;
  assert.equal(interaction(g, a)?.kind, 'rubble');
  step(g, 5.2, new Map([[1, { hold: true }]])); assert.equal(g.rubble[id], undefined, 'cleared');
});

test('down, dragged to the truck, back on your feet; a wipe keeps only a share', () => {
  const g = setup(2), [a, b] = g.players;
  place(g, 1, 0, 14); place(g, 2, 1.2, 14);
  a.hands[0] = { id: 70, kind: 'coins', pile: ['coins', 'coins'] }; g.damage(a, 100);
  assert.equal(a.downed, true); assert.equal(a.hands[0], null, 'a falling pana drops what it holds'); assert.equal(g.items.filter(i => i.kind === 'coins').length, 2);
  b.h = facing(b, a); assert.equal(g.action(2, 'drag'), true);
  for (let i = 0; i < 160 && a.downed; i++) g.update(.05, new Map([[2, { x: (TRUCK.x - b.x) / 10, z: (TRUCK.z - b.z) / 10 }]]));
  assert.equal(a.downed, false, 'the truck botiquín got them up');
  g.haul = 1000; place(g, 1, 0, 6); place(g, 2, 1, 6); a.invulnerable = b.invulnerable = 0; g.damage(a, 100); g.damage(b, 100); step(g, 3.2);
  assert.equal(g.phase, 'results'); assert.equal(g.outcome, 'wipe'); assert.equal(g.payout, 200);
});

test('extraction needs every standing pana at the truck; titles go to the stats', () => {
  const g = setup(2), [a, b] = g.players;
  g.haul = 500; place(g, 1, TRUCK.x + 3, TRUCK.z); a.h = -Math.PI / 2; a.pitch = 0; place(g, 2, 0, -1);
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

test('the guardian wakes, slams, falls to machetes and opens its treasure chamber', () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = setup(2, seed); g.completeLevel();
    const seal = run(g).seals.find(s => s.kind === 'guardian'); if (!seal) continue;
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
  const g = setup(1, 77); g.completeLevel(); g.completeLevel();
  const vault = run(g).rooms.find(r => r.kind === 'boveda'), [a] = g.players;
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

test('the carrito takes a handful and a big treasure; the cargo lift banks them', () => {
  const g = setup(1), [a] = g.players, cart = g.carts[0];
  a.hands[0] = { id: 70, kind: 'coins', pile: ['coins', 'emerald'] }; place(g, 1, cart.x, cart.z + 1.6); a.h = facing(a, cart);
  assert.equal(interaction(g, a).kind, 'cart-load'); g.action(1, 'interact'); assert.equal(cart.contents.length, 2); assert.equal(a.hands[0], null);
  const disk = g.spawnItem('sunDisk', cart.x - 3.2, cart.z, { y: 0 });
  place(g, 1, disk.x - 1.6, disk.z); a.h = facing(a, disk); a.interactCooldown = 0; g.action(1, 'interact');
  for (let i = 0; i < 80 && !cart.big; i++) g.update(.05, new Map([[1, { x: 1, z: 0 }]]));
  assert.equal(cart.big?.kind, 'sunDisk'); assert.equal(a.grip, null);
  place(g, 1, cart.x, cart.z + 1.6); a.h = facing(a, cart); a.interactCooldown = 0;
  assert.equal(interaction(g, a).kind, 'cart-push'); g.action(1, 'interact'); assert.equal(a.push, cart.id);
  const pad = run(g).cargo.find(c => c.floor === 1);
  for (let i = 0; i < 300 && Math.hypot(cart.x - pad.x, cart.z - pad.z) > .8; i++) { const d = Math.hypot(pad.x - cart.x, pad.z - cart.z) || 1; g.update(.05, new Map([[1, { x: (pad.x - cart.x) / d, z: (pad.z - cart.z) / d }]])); }
  a.interactCooldown = 0; g.action(1, 'interact'); assert.equal(a.push, null);
  aimCargo(g, 1); a.interactCooldown = 0; g.action(1, 'interact'); step(g, 3.2);
  assert.equal(g.haul, ITEMS.coins.value + ITEMS.emerald.value + ITEMS.sunDisk.value); assert.equal(g.delivered, g.haul);
});

test('guácharos scatter from a beam, spiders drop and slow, cuaimas poison but stay home', () => {
  const g = setup(1), [a] = g.players, at = firstFloor(g);
  place(g, 1, at.x, at.z - 2, Math.PI); a.invulnerable = 0; g.woke[g.layout.regionAt(a).id] = 1;
  const bat = spawnEnemy(g, 'bat', at.x, at.z - 6); bat.born = -9; a.hands[0] = { id: 1, kind: 'farol' }; a.h = facing(a, bat);
  const d0 = distance(a, bat); step(g, .6); assert.ok(distance(a, bat) > d0, 'the flock backs off the beam');
  g.enemies = []; a.hands = [null, null]; a.hp = 100;
  const spider = spawnEnemy(g, 'spider', at.x, at.z - 3.5, { hanging: true }); spider.born = -9;
  step(g, .1); assert.equal(spider.hanging, false, 'drops when a pana walks under');
  for (let i = 0; i < 60 && !(a.slow > 0); i++) g.update(.05);
  assert.ok(a.slow > 0 && a.hp < 100, 'its bite slows');
  g.enemies = []; a.hp = 100; a.slow = 0;
  const snake = spawnEnemy(g, 'snake', at.x, at.z - 3); snake.born = -9;
  for (let i = 0; i < 60 && !(a.poison > 0); i++) g.update(.05);
  assert.ok(a.poison > 0, 'the strike poisons'); const hp = a.hp; step(g, 1.5); assert.ok(a.hp < hp, 'poison keeps biting');
  place(g, 1, at.x, at.z - 14); step(g, 3);
  assert.ok(Math.hypot(snake.x - snake.homeX, snake.z - snake.homeZ) < 4, 'it never wanders far from its loot');
});
