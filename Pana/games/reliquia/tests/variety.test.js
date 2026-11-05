// The variety pass: biomes, rope work, narrow planks, the golden chamber, the
// sucesos and el encargo. Everything through the same rules the host runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction, stepExplorer, ENCARGO_TEXT, encargoPay, SHOP } from '../public/rules.js';
import { layoutFor } from '../public/layout.js';
import { generateRun, themeFor, themeOf, THEMES, ENCARGOS, encargoFor, jornadaName, inRect } from '../public/deck.js';
import { ITEMS } from '../public/items.js';
import { startSuceso, SUCESOS, SUCESO_POOL, dropRock, CLIMB, FLARE } from '../public/sucesos.js';
import { lightOn, spawnEnemy } from '../public/enemies.js';

function setup({ n = 2, seed = 4242, place = 'mina', level = 1 } = {}) {
  const g = new Expedition(seed, { place }); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed);
  while (g.level < level) g.completeLevel();
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6; g.sucesoIn = 1e6;
  return g;
}
const step = (g, seconds, inputs = new Map()) => { for (let t = 0; t < seconds - 1e-4; t += .05) { g.director.duration = 1e6; g.update(.05, inputs); } };
const put = (g, id, x, z, extra = {}) => Object.assign(g.players.find(p => p.id === id), { x, z, y: 0, ...extra });
const look = (p, at, y = 1) => { p.h = Math.atan2(at.x - p.x, at.z - p.z); p.pitch = Math.atan2(y - (p.y + 1.45), Math.hypot(at.x - p.x, at.z - p.z)); p.interactCooldown = 0; };
// The first seed whose deal has this; every theme sweeps seeds, so none is pinned to a layout.
function findRun(test, { place = 'mina', from = 1, level = 1, n = 2 } = {}) {
  for (let seed = from; seed < from + 400; seed++) { const run = generateRun(seed, { depth: level, theme: place }); if (test(run)) return setup({ seed, place, level, n }); }
  assert.fail('no deal has it');
}
const opened = L => ({ open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), strung: Object.fromEntries([...L.run.bridges, ...L.run.ropes].filter(b => b.needs).map(b => [b.id, 1])), lift: { floor: 1, moving: false } });

test('Alternar walks all five places in an order of its own, and every expedition starts differently', () => {
  const firsts = new Set();
  for (let origin = 1; origin <= 60; origin++) {
    const order = [1, 2, 3, 4, 5].map(d => themeFor(d, 'alternar', origin));
    assert.deepEqual([...order].sort(), [...THEMES].sort(), 'each place once before any repeats');
    assert.equal(themeFor(6, 'alternar', origin), order[0], 'then round again');
    firsts.add(order[0]);
  }
  assert.equal(firsts.size, THEMES.length, 'any place can open an expedition');
  for (const theme of THEMES) assert.ok(THEMES.every(() => themeFor(3, theme, 9) === theme), `${theme} stays put when chosen`);
  const g = new Expedition(77); g.addPlayer(1, 'Ana'); g.start(77);
  assert.equal(g.layout.run.theme, themeFor(1, 'alternar', 77));
  g.completeLevel(); assert.equal(themeOf(g.snapshot()), themeFor(2, 'alternar', 77), 'a guest reads the same place from a snapshot');
  assert.equal(jornadaName(1, 'inundada'), 'Los túneles inundados');
});

test('every biome: rooms, carrito route, seal and sealed chamber stay reachable; it has its own rooms', () => {
  const own = { inundada: 'cisterna', hongos: 'bosque', templo: 'atrio' }, seen = {};
  for (let seed = 1; seed <= 24; seed++) for (const depth of [1, 2, 3, 5, 8]) for (const theme of ['inundada', 'hongos', 'templo', 'mina']) {
    const L = layoutFor(seed, depth, theme), run = L.run, state = opened(L), stop = run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 }, tag = `seed ${seed}/${depth}/${theme}`;
    assert.ok(run.rooms.some(r => r.kind === 'puente'), `${tag}: the Silbón keeps its pit`);
    assert.ok(run.sleepers.some(s => s.kind === 'silbon'), `${tag}: and the Silbón itself`);
    assert.ok(run.sleepers.some(s => s.kind === 'bat'), `${tag}: bats`);
    assert.ok(run.nooks.length > 0, `${tag}: hiding nooks`);
    for (const r of run.rooms) if (own[theme] === r.kind) seen[r.kind] = (seen[r.kind] || 0) + 1;
    // The carrito (radius .6) goes everywhere on the main path, rims and ledges included.
    const path = run.rooms.filter(r => r.floor === 1 && r.index != null).sort((a, b) => a.index - b.index);
    for (const c of run.corridors.filter(c => c.floor === 1 && !c.hidden)) {
      const mid = { x: (c.rect[0] + c.rect[2]) / 2, z: (c.rect[1] + c.rect[3]) / 2 };
      assert.ok(L.findPath(landing, mid, state, .6).length, `${tag}: a carrito reaches corridor ${c.id}`);
    }
    assert.ok(path.length >= 5, tag);
    for (const v of run.stubs.filter(s => s.kind === 'vault')) assert.ok(L.findPath(landing, { x: (v.rect[0] + v.rect[2]) / 2, z: (v.rect[1] + v.rect[3]) / 2 }, state).length, `${tag}: the chamber`);
    // Nothing that takes both hands is dealt where hands are all that can bring it back.
    for (const l of run.loot) if (ITEMS[l.kind].size === 'big') assert.ok(!L.lowAt(l.x, l.z) && !run.bridges.some(b => b.beam && b.room === l.room), `${tag}: ${l.kind} would be stuck`);
    // Nobody sleeps on a platform, and sleepers stand on real floor.
    for (const s of run.sleepers) assert.equal(L.lowAt(s.x, s.z), 0, `${tag}: ${s.kind} on a platform`);
  }
  for (const kind of Object.values(own)) assert.ok(seen[kind] > 20, `${kind} is common in its biome`);
});

test('a sima: only a rope reaches the platform, you land at its height, and loot there can be taken', () => {
  const g = findRun(r => r.ropes.some(q => !q.needs) && r.rooms.some(q => q.kind === 'sima')), L = g.layout, rope = L.run.ropes.find(q => !q.needs), [a, b] = g.players;
  const pit = L.run.pits.find(p => p.room === rope.room);
  assert.ok(pit.low > 3, 'it hangs well below the floor');
  assert.equal(L.findPath({ x: rope.x, z: rope.z }, { x: rope.bx, z: rope.bz }, g).length, 0, 'no walking down');
  assert.equal(L.walkable(rope.bx, rope.bz, g), true); assert.equal(L.groundAt(rope.bx, rope.bz), -pit.low);
  put(g, 1, rope.x, rope.z + Math.sign(rope.z - rope.bz) * .1); put(g, 2, -50, 0); look(a, { x: rope.x, z: rope.z });
  const start = interaction(g, a); assert.equal(start.kind, 'rope'); assert.equal(start.down, true);
  assert.equal(g.action(1, 'interact'), true); assert.ok(a.rope);
  // Alone it takes CLIMB.alone; nothing can be done on the rope meanwhile, and input does not move you.
  const x = a.x; step(g, CLIMB.alone / 2, new Map([[1, { x: 1, z: 0 }]])); assert.ok(a.rope); assert.ok(Math.abs(a.x - x) < .01 + Math.abs(rope.bx - rope.x));
  assert.ok(a.y < -.5 && a.y > -pit.low, 'halfway down'); assert.equal(interaction(g, a), null);
  step(g, CLIMB.alone / 2 + .15); assert.equal(a.rope, null); assert.ok(Math.abs(a.y + pit.low) < .01, `standing on the platform: ${a.y}`);
  assert.equal(a.x, rope.bx); assert.equal(a.z, rope.bz);
  // Standing still the walker keeps you at that height.
  step(g, .3); assert.ok(Math.abs(a.y + pit.low) < .01);
  // The loot down there answers to the crosshair at its own height.
  const item = L.run.loot.find(l => L.lowAt(l.x, l.z)); assert.ok(item, 'loot on the platform');
  put(g, 1, item.x, item.z + .8, { y: -pit.low }); look(a, { x: item.x, z: item.z }, .2 - pit.low);
  assert.equal(interaction(g, a)?.kind, 'pick');
  // From up top it is out of reach, even straight overhead.
  put(g, 2, item.x, item.z + .8); look(b, { x: item.x, z: item.z }, .2 - pit.low); assert.notEqual(interaction(g, b)?.id, item.id);
  // Thrown from the platform to the rim: it lands up there, not in the abyss.
  a.hands[0] = { id: 998, kind: 'mask', worth: 1 }; put(g, 1, rope.bx, rope.bz, { y: -pit.low, h: Math.atan2(rope.x - rope.bx, rope.z - rope.bz), pitch: .7 });
  g.action(1, 'throw'); step(g, 1.6);
  const flew = g.items.find(i => i.id === 998); assert.ok(flew && flew.state === 'ground', 'the mask landed');
  assert.ok(Math.abs(flew.y) < .01 && !L.lowAt(flew.x, flew.z), `on the rim: y ${flew.y}`);
  // Climbing back is the same rope.
  put(g, 1, rope.bx, rope.bz, { y: -pit.low }); look(a, { x: rope.bx, z: rope.bz }, 1.4 - pit.low); a.h = Math.PI / 2; look(a, { x: rope.bx, z: rope.bz + .0001 }, 1.4 - pit.low);
  const back = interaction(g, a); assert.equal(back?.kind, 'rope'); assert.equal(back.down, false);
  g.action(1, 'interact'); step(g, CLIMB.alone + .2); assert.ok(Math.abs(a.y) < .01); assert.equal(a.z, rope.z);
});

test('a pana holding the rope makes the climb faster', () => {
  const g = findRun(r => r.ropes.some(q => !q.needs)), rope = g.layout.run.ropes.find(q => !q.needs), [a] = g.players;
  put(g, 1, rope.x, rope.z); put(g, 2, rope.x + 1.5, rope.z); look(a, { x: rope.x, z: rope.z }); g.action(1, 'interact');
  step(g, CLIMB.belayed + .15); assert.equal(a.rope, null, 'down already'); assert.ok(Math.abs(a.y + rope.low) < .01);
  assert.ok(CLIMB.belayed < CLIMB.alone * .7);
});

test('knocked out on a rope, a pana lands at the nearer end', () => {
  const g = findRun(r => r.ropes.some(q => !q.needs)), rope = g.layout.run.ropes.find(q => !q.needs), [a] = g.players;
  put(g, 1, rope.x, rope.z); put(g, 2, -50, 0); look(a, { x: rope.x, z: rope.z }); g.action(1, 'interact'); step(g, CLIMB.alone * .75);
  g.damage(a, 1000); assert.equal(a.downed, true); assert.equal(a.rope, null); assert.equal(a.z, rope.bz); assert.equal(a.y, -rope.low);
});

test('walkers leave you alone on a platform; only wings follow', () => {
  const g = findRun(r => r.ropes.some(q => !q.needs)), rope = g.layout.run.ropes.find(q => !q.needs), [a] = g.players;
  put(g, 1, rope.bx, rope.bz, { y: -rope.low }); put(g, 2, -50, 0);
  assert.equal(spawnEnemy(g, 'mummy', rope.bx, rope.bz), null, 'no mummy spawns down there');
  const m = spawnEnemy(g, 'mummy', rope.x, rope.z, { born: -9 }), hp = a.hp; step(g, 3);
  assert.ok(m, 'a mummy on the rim'); assert.equal(a.hp, hp, 'it cannot reach');
});

test('a cuerda ties a broken bridge for everyone, once; without one the stake only says so', () => {
  const g = findRun(r => r.bridges.some(b => b.needs)), L = g.layout, span = L.run.bridges.find(b => b.needs), [a, b] = g.players, mid = { x: (span.rect[0] + span.rect[2]) / 2, z: (span.rect[1] + span.rect[3]) / 2 };
  assert.ok(L.run.loot.some(l => l.kind === 'cuerda' && l.floor === 1), 'a floor that needs a cuerda offers one');
  assert.equal(L.walkable(mid.x, mid.z, g, .42), false, 'open air until tied'); assert.equal(L.overPit(mid.x, mid.z), true);
  const before = L.findPath({ x: span.x, z: span.z }, { x: span.x, z: (L.run.pits.find(p => inRect(mid.x, mid.z, p.rect)).island[1] + L.run.pits.find(p => inRect(mid.x, mid.z, p.rect)).island[3]) / 2 }, g);
  assert.equal(before.length, 0, 'the island is cut off');
  put(g, 1, span.x, span.z); look(a, { x: span.x, z: span.z }, .6);
  assert.equal(interaction(g, a)?.kind, 'info');
  a.hands[0] = { id: 900, kind: 'cuerda' }; const tie = interaction(g, a); assert.equal(tie?.kind, 'tie');
  assert.equal(g.action(1, 'interact'), true); assert.equal(a.hands[0], null, 'the cuerda is spent'); assert.equal(g.strung[span.id], 1);
  assert.equal(L.walkable(mid.x, mid.z, g, .42), true, 'and now it holds'); assert.ok(L.groundAt(mid.x, mid.z) < 0, 'with a sag');
  // A guest's prediction reads the same snapshot.
  const snap = g.snapshot(); assert.equal(L.walkable(mid.x, mid.z, snap, .42), true);
  // A second pana walks across with no input from the first.
  put(g, 2, mid.x, span.z); b.h = mid.z > span.z ? 0 : Math.PI;
  const z0 = b.z; for (let i = 0; i < 30; i++) stepExplorer(b, { x: 0, z: Math.sign(mid.z - span.z), h: b.h }, .05, snap);
  assert.ok(Math.abs(b.z - z0) > 2, `walked ${Math.abs(b.z - z0)} m out along it`);
});

test('the plank takes a pana but no mummy; a carrito rounds the ledge instead', () => {
  const g = findRun(r => r.rooms.some(q => q.kind === 'cornisa'), { place: 'templo' }), L = g.layout, room = L.run.rooms.find(r => r.kind === 'cornisa'), pit = L.run.pits.find(p => p.room === room.id), beam = L.run.bridges.find(b => b.beam && b.room === room.id);
  const islet = { x: room.x, z: room.z }, rim = { x: room.x, z: beam.rect[1] < room.z ? beam.rect[1] - .6 : beam.rect[3] + .6 };
  assert.equal(L.walkable(room.x, (beam.rect[1] + beam.rect[3]) / 2, g, .42), true, 'a pana fits on it');
  assert.equal(L.walkable(room.x, (beam.rect[1] + beam.rect[3]) / 2, g, .6), false, 'a body as wide as a mummy does not');
  assert.equal(L.findPath(rim, islet, g, .6).length, 0, 'a mummy finds no way to the island');
  assert.equal(L.groundAt(room.x, (beam.rect[1] + beam.rect[3]) / 2), 0, 'the plank is flat');
  // The ledge goes all the way round.
  const w = (pit.rect[0] + room.rect[0]) / 2, e = (pit.rect[2] + room.rect[2]) / 2, n = (pit.rect[1] + room.rect[1]) / 2, s = (pit.rect[3] + room.rect[3]) / 2;
  for (const [a, b] of [[{ x: w, z: n }, { x: e, z: n }], [{ x: e, z: n }, { x: e, z: s }], [{ x: e, z: s }, { x: w, z: s }]]) assert.ok(L.findPath(a, b, g, .6).length, 'a carrito fits along the ledge');
});

test('the golden chamber opens to two weights at once, a carrito counts, and one is not enough', () => {
  let g = null;
  for (const place of ['mina', 'hongos', 'templo', 'inundada']) { try { g = findRun(r => r.twins.length > 0, { place }); break; } catch { /* another place */ } }
  assert.ok(g, 'some deal has a golden chamber');
  const L = g.layout, twin = L.run.twins[0], wall = L.run.hidden.find(h => h.id === twin.wall), room = L.run.rooms.find(r => r.hidden === wall.id);
  assert.equal(room.kind, 'dorada'); assert.ok(Math.hypot(twin.plates[0].x - twin.plates[1].x, twin.plates[0].z - twin.plates[1].z) >= 5, 'too far apart for one pana');
  assert.ok(L.run.chests.filter(c => c.room === room.id).length >= 3 && L.run.loot.filter(l => l.room === room.id).length >= 8, 'worth the trouble');
  assert.equal(L.walkable(wall.x, wall.z, g), false, 'walled off');
  put(g, 1, twin.plates[0].x, twin.plates[0].z); put(g, 2, -50, 0); step(g, .1);
  assert.equal(g.revealed[wall.id], undefined); assert.ok(g.events.some(e => e.kind === 'twin'), 'the plate says it wants company');
  put(g, 2, twin.plates[1].x, twin.plates[1].z); step(g, .1);
  assert.equal(g.revealed[wall.id], 1, 'both down'); assert.ok(g.events.some(e => e.kind === 'reveal'));
  assert.ok(L.walkable(wall.x, wall.z, g, .3), 'the way is open');
  // Alone: a carrito holds the other one down.
  const solo = findRun(r => r.twins.length > 0, { place: g.options.place, n: 1 }), t = solo.layout.run.twins[0];
  put(solo, 1, t.plates[0].x, t.plates[0].z); Object.assign(solo.carts[0], { x: t.plates[1].x, z: t.plates[1].z }); step(solo, .1);
  assert.equal(solo.revealed[t.wall], 1);
});

test('every suceso starts, ends and hands over; the biome decides which come', () => {
  for (const theme of THEMES) {
    for (const kind of SUCESO_POOL[theme]) assert.ok(SUCESOS[kind], `${theme}: ${kind}`);
    const g = setup({ place: theme }), stop = g.layout.run.lifts.find(l => l.floor === 1);
    for (const p of g.players) Object.assign(p, { x: stop.x, z: stop.z - 5, invulnerable: 1e6 });
    const kinds = new Set();
    g.sucesoIn = .05;
    for (let i = 0; i < 40000 && kinds.size < new Set(SUCESO_POOL[theme]).size; i++) { g.update(.05); if (g.suceso) { kinds.add(g.suceso.kind); assert.ok(SUCESO_POOL[theme].includes(g.suceso.kind)); g.suceso.t = 1e6; } if (g.sucesoIn > 1) g.sucesoIn = .05; for (const p of g.players) { p.hp = 100; p.downed = false; } g.enemies = []; }
    assert.deepEqual([...kinds].sort(), [...new Set(SUCESO_POOL[theme])].sort(), theme);
  }
  // None comes while everyone is at the camp.
  const camp = setup(); camp.sucesoIn = .05; step(camp, 1); assert.equal(camp.suceso, null);
});

test('el apagón puts out the torches for what fears the dark, and a flare burns through it', () => {
  const g = setup(), light = g.layout.run.lights.find(l => l.floor === 1), [a] = g.players; put(g, 1, -50, 0); put(g, 2, -50, 0);
  const e = { kind: 'mummy', x: light.x + 1, z: light.z };
  assert.equal(lightOn(g, e), 'glow', 'a torch keeps it calm');
  startSuceso(g, 'apagon'); assert.equal(g.suceso, null, 'not while nobody is below');
  put(g, 1, light.x + 3, light.z); startSuceso(g, 'apagon'); assert.equal(g.suceso.kind, 'apagon');
  a.hands = [null, null]; assert.equal(lightOn(g, e), 'dark', 'the torch is out');
  g.flares.push({ id: 1, x: e.x + 7, z: e.z, y: 0, vx: 0, vy: 0, vz: 0, life: 20 }); assert.equal(lightOn(g, e), 'glow');
  g.flares[0].x = e.x + 3; assert.equal(lightOn(g, e), 'beam', 'close to a flare it freezes');
  step(g, SUCESOS.apagon.dur + .2); assert.equal(g.suceso, null); g.flares = []; assert.equal(lightOn(g, e), 'glow', 'the torches come back');
});

test('a flare is thrown, burns on the floor, then is gone, and walking speed never changed', () => {
  const g = setup(), stop = g.layout.run.lifts.find(l => l.floor === 1), [a] = g.players;
  put(g, 1, stop.x, stop.z - 5, { h: Math.PI, pitch: 0 }); a.hands[0] = { id: 901, kind: 'bengala' };
  assert.equal(g.action(1, 'use', { hand: 0 }), true); assert.equal(a.hands[0], null); assert.equal(g.flares.length, 1);
  step(g, 2); const s = g.flares[0]; assert.ok(s.y < .2 && !s.vx && !s.vz, 'it lies burning'); assert.ok(Math.hypot(s.x - a.x, s.z - a.z) > 1.5, 'away from the thrower');
  step(g, FLARE.life); assert.equal(g.flares.length, 0);
  // The base walk: 4.6 m/s in every biome, in the water and during every suceso.
  // (Whichever way is clear from the spot: the fastest of the four is the pace.)
  for (const theme of THEMES) for (const kind of Object.keys(SUCESOS)) {
    const q = setup({ place: theme, n: 1 }), room = q.layout.run.rooms.find(r => r.index === 0), p = q.players[0];
    put(q, 1, room.x, room.z); startSuceso(q, kind); assert.ok(q.suceso, `${theme}/${kind} started`);
    const start = { x: p.x, z: p.z };
    const pace = Math.max(...[[0, 1], [0, -1], [1, 0], [-1, 0]].map(([x, z]) => { Object.assign(p, start, { stamina: 1 }); for (let i = 0; i < 4; i++) stepExplorer(p, { x, z, h: 0 }, .05, q); return Math.hypot(p.x - start.x, p.z - start.z) / .2; }));
    assert.ok(Math.abs(pace - 4.6) < .05, `${theme}/${kind}: ${pace} m/s`);
  }
});

test('la creciente: wading, your breath does not come back, and two cuaimas come', () => {
  const g = setup({ place: 'inundada' }), stop = g.layout.run.lifts.find(l => l.floor === 1), [a] = g.players;
  for (const p of g.players) Object.assign(p, { x: stop.x, z: stop.z - 5, stamina: .4, invulnerable: 1e6 });
  step(g, .5); assert.ok(a.stamina > .4, 'it refills normally');
  a.stamina = .4; startSuceso(g, 'creciente'); assert.ok(g.enemies.some(e => e.kind === 'snake'), 'cuaimas');
  step(g, 1); assert.ok(a.stamina <= .4 + 1e-9, `no refill: ${a.stamina}`);
  step(g, SUCESOS.creciente.dur); assert.equal(g.suceso, null); step(g, .5); assert.ok(a.stamina > .4);
});

test('a rock warns, then hits whoever stayed; cracks and puffballs fire once and rearm', () => {
  const g = setup(), stop = g.layout.run.lifts.find(l => l.floor === 1), [a, b] = g.players, at = { x: stop.x, z: stop.z - 5 };
  put(g, 1, at.x, at.z); put(g, 2, at.x + 4, at.z);
  const rock = dropRock(g, at.x, at.z); assert.ok(rock); step(g, .5); assert.equal(a.hp, 100, 'still only the warning');
  step(g, .6); assert.ok(a.hp < 100, 'it hit'); assert.equal(b.hp, 100, 'not the pana who stood clear'); assert.equal(g.rocks.length, 0);
  // A temple atrio's cracks.
  const t = findRun(r => r.cracks.length > 0, { place: 'templo' }), crack = t.layout.run.cracks[0]; put(t, 1, crack.x, crack.z); put(t, 2, -50, 0); t.players[0].invulnerable = 1e6;
  step(t, .1); assert.equal(t.rocks.length, 1); step(t, 1.2); assert.equal(t.rocks.length, 0); step(t, 3); assert.equal(t.rocks.length, 0, 'not again right away');
  // A grove's puffball turns the controls round for whoever is close, nobody further off.
  const h = findRun(r => r.puffs.length > 0, { place: 'hongos' }), puff = h.layout.run.puffs[0]; put(h, 1, puff.x, puff.z); put(h, 2, puff.x + 5, puff.z);
  step(h, .1); assert.ok(h.players[0].reversed > 0); assert.equal(h.players[1].reversed, 0); assert.ok(h.events.some(e => e.kind === 'spores'));
});

test('el encargo: every jornada has one, each kind pays or is lost by its own rule', () => {
  const kinds = new Set(); for (let s = 1; s < 200; s++) for (const d of [1, 2, 3]) kinds.add(encargoFor(s, d));
  assert.deepEqual([...kinds].sort(), [...ENCARGOS].sort(), 'all four come up');
  for (const k of ENCARGOS) assert.ok(ENCARGO_TEXT[k], `${k} says what it wants`);
  const dealt = kind => findRun(r => r.encargo === kind);
  // Sin bajas: a pana down below loses it.
  { const g = dealt('sinBajas'); put(g, 1, g.layout.run.lifts[1].x, g.layout.run.lifts[1].z - 5); g.damage(g.players[0], 1000); assert.equal(g.encargo.state, 'lost'); }
  // Pedido: the parcel is dealt on open floor and pays when it is banked.
  { const g = dealt('pedido'), L = g.layout, parcel = L.run.loot.find(l => l.kind === 'encomienda'); assert.ok(parcel && L.walkable(parcel.x, parcel.z, opened(L), .3), 'the parcel lies on open floor'); const m = g.mangos; g.bank('encomienda'); assert.equal(g.encargo.state, 'paid'); assert.ok(g.mangos >= m + encargoPay(1)); }
  // Turno: met in time pays; out of time it is lost.
  { const g = dealt('turno'); g.encargo.until = g.time + 100; g.delivered = g.quota; put(g, 1, g.layout.run.lifts[1].x, g.layout.run.lifts[1].z - 5); step(g, .1); assert.equal(g.encargo.state, 'paid'); }
  { const g = dealt('turno'); g.encargo.until = g.time + .1; put(g, 1, g.layout.run.lifts[1].x, g.layout.run.lifts[1].z - 5); step(g, .3); assert.equal(g.encargo.state, 'lost'); }
  // A new jornada deals a new one, open again, and clears what the last one left.
  { const g = dealt('sinBajas'); g.settleEncargo(false); g.strung.x = 1; g.rocks.push({ id: 1, x: 0, z: 0, t: 0, at: 9 }); g.completeLevel(); assert.equal(g.encargo.state, 'open'); assert.deepEqual(g.strung, {}); assert.deepEqual(g.rocks, []); }
});

test('the two new tools can be bought, and everything new survives a snapshot', () => {
  for (const kind of ['bengala', 'cuerda']) { assert.ok(ITEMS[kind]?.tool, kind); assert.ok(SHOP.some(([k]) => k === kind), `${kind} in the shop`); }
  const g = setup(); g.mangos = 100; const a = g.players[0];
  assert.equal(g.buy(a, 'cuerda'), true); assert.equal(a.hands[0].kind, 'cuerda'); assert.equal(g.mangos, 88);
  g.strung.span0 = 1; g.flares.push({ id: 1, x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0, life: 1 });
  const snap = JSON.parse(JSON.stringify(g.snapshot())); assert.equal(snap.strung.span0, 1); assert.equal(snap.flares.length, 1); assert.equal(snap.encargo.kind, g.encargo.kind);
  const other = new Expedition(1, g.options); other.restore(snap, new Map(g.players.map(p => [p.id, p])));
  assert.equal(other.layout.run.theme, g.layout.run.theme, 'a new host deals the same floor');
});
