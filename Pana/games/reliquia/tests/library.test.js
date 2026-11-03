// La biblioteca sepultada: the theme is dealt from the depth and the room's Lugar, bookcases are
// solid, and every room, aisle, piece of loot and chest stays reachable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor } from '../public/layout.js';
import { generateRun, themeFor, themeOf, jornadaName, LIBRARY_NAME, inRect } from '../public/deck.js';
import { Expedition } from '../public/rules.js';
import { ITEMS } from '../public/items.js';

// Flood fill on a grid (no search cap, unlike findPath): every cell a body of
// `radius` can reach from `from`, as a test function.
function reachable(L, state, from, step = .5, radius = .45, off = 0) {
  const key = (i, j) => `${i},${j}`, seen = new Set(), queue = [[Math.round((from.x - off) / step), Math.round((from.z - off) / step)]];
  const ok = (i, j) => L.walkable(i * step + off, j * step + off, state, radius);
  seen.add(key(...queue[0]));
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + di, j + dj); if (!seen.has(k) && ok(i + di, j + dj)) { seen.add(k); queue.push([i + di, j + dj]); } }
  }
  return p => { const i = Math.round((p.x - off) / step), j = Math.round((p.z - off) / step); return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => seen.has(key(i + di, j + dj))); };
}
const opened = L => ({ open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), lift: { floor: 1, moving: false } });

test('Alternar opens in the library and swaps every jornada; Mina and Biblioteca stay put', () => {
  const depths = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(depths.map(d => themeFor(d)), ['biblioteca', 'mina', 'biblioteca', 'mina', 'biblioteca', 'mina']);
  assert.deepEqual(depths.map(d => themeFor(d, 'alternar')), depths.map(d => themeFor(d)));
  assert.ok(depths.every(d => themeFor(d, 'mina') === 'mina' && themeFor(d, 'biblioteca') === 'biblioteca'));
  assert.equal(themeOf({ level: 1, options: { place: 'alternar' } }), 'biblioteca');
  assert.equal(themeOf({ level: 1, options: { place: 'mina' } }), 'mina');
  assert.equal(themeOf({ level: 2, options: {} }), 'mina');
  assert.equal(jornadaName(1), LIBRARY_NAME);
  assert.equal(jornadaName(1, 'mina'), 'Las afueras de la mina');
  // A fresh expedition's first jornada is the library; the next one the mine.
  const g = new Expedition(4); g.addPlayer(1, 'Ana'); g.start(4);
  assert.equal(g.layout.run.theme, 'biblioteca'); g.completeLevel(); assert.equal(g.layout.run.theme, 'mina');
  const mine = new Expedition(4, { place: 'mina' }); mine.addPlayer(1, 'Ana'); mine.start(4);
  assert.equal(mine.layout.run.theme, 'mina');
  for (const seed of [1, 2, 3]) {
    const run = generateRun(seed, { depth: 2, theme: 'biblioteca' });
    assert.equal(run.theme, 'biblioteca');
    assert.ok(run.rooms.some(r => ['estanterias', 'lectura', 'archivo', 'copistas'].includes(r.kind)), 'library rooms');
    assert.ok(!run.rooms.some(r => ['veta', 'columnas', 'tesoro', 'cripta'].includes(r.kind)), 'no mine rooms');
    assert.ok(run.lights.every(l => l.kind === 'candelabra'), 'candles, not braziers');
    assert.equal(generateRun(seed, { depth: 1, theme: 'mina' }).theme, 'mina');
    assert.equal(generateRun(seed, { depth: 1, theme: 'mina' }).solids.length, 0);
  }
  // Same seed, same library on every client.
  assert.deepEqual(JSON.parse(JSON.stringify(generateRun(9, { depth: 5, theme: 'biblioteca' }).solids)), JSON.parse(JSON.stringify(generateRun(9, { depth: 5, theme: 'biblioteca' }).solids)));
});

test('bookcases are solid and the stacks keep narrow aisles', () => {
  let stacks = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const L = layoutFor(seed, 2, 'biblioteca');
    for (const s of L.run.solids) {
      const x = (s.rect[0] + s.rect[2]) / 2, z = (s.rect[1] + s.rect[3]) / 2;
      assert.equal(L.walkable(x, z, {}, .1), false, `seed ${seed}: inside a ${s.kind}`);
      assert.equal(L.lineClear({ x, z: s.rect[1] - 1.1 }, { x, z: s.rect[3] + 1.1 }, {}, .2), false, `seed ${seed}: nothing sees through a ${s.kind}`);
    }
    for (const room of L.run.rooms.filter(r => r.kind === 'estanterias')) {
      stacks++;
      const rows = L.run.solids.filter(s => s.room === room.id && s.kind === 'shelf' && s.axis === 'x');
      const zs = [...new Set(rows.map(s => (s.rect[1] + s.rect[3]) / 2))].sort((a, b) => a - b);
      for (let i = 1; i < zs.length; i++) {
        const aisle = zs[i] - zs[i - 1] - .8;
        assert.ok(aisle >= 1.8 && aisle <= 2.3, `seed ${seed}: aisle ${aisle}`);
      }
    }
  }
  assert.ok(stacks > 10, 'the stacks are common in the library');
});

test('every room, aisle, loot and chest is reachable in many library and mine jornadas', () => {
  for (let seed = 1; seed <= 25; seed++) for (const depth of [1, 2, 3, 5, 8]) for (const theme of ['mina', 'biblioteca']) {
    const L = layoutFor(seed, depth, theme), state = opened(L), stop = L.run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 };
    const walker = reachable(L, state, landing), enemy = reachable(L, state, landing, 1, .5, .5);
    const reach = (to, radius = .45) => radius >= .5 ? enemy(to) : walker(to);
    for (const r of L.run.rooms.filter(r => r.floor === 1)) {
      if (L.run.pits.some(p => p.room === r.id) || r.kind === 'santuario' || r.kind === 'idolo') continue;
      assert.ok(reach({ x: r.x, z: r.z }) || L.findPath(landing, r, state).length, `seed ${seed}/${depth}: ${r.id} ${r.kind}`);
    }
    // Every aisle of the stacks: an enemy can walk into it.
    for (const r of L.run.rooms.filter(r => r.kind === 'estanterias')) for (const aisle of [-4.5, -1.5, 1.5, 4.5]) for (const x of [-5, 5]) {
      const at = { x: r.x + x + .5, z: r.z + aisle };
      if (L.walkable(at.x, at.z, state, .5)) assert.ok(reach(at, .5), `seed ${seed}/${depth}: aisle ${aisle} at ${x} in ${r.id}`);
    }
    for (const l of L.run.loot.filter(l => l.floor === 1 && !l.y)) {
      const big = ITEMS[l.kind].size === 'big';
      // A pana reaches within a metre (big treasures: two) of every piece.
      const ok = reach(l, .45) || [0, 1, 2, 3, 4, 5, 6, 7].some(i => reach({ x: l.x + Math.cos(i * Math.PI / 4) * (big ? 1.8 : .9), z: l.z + Math.sin(i * Math.PI / 4) * (big ? 1.8 : .9) }, .45));
      if (!ok && L.run.pits.some(p => inRect(l.x, l.z, p.rect))) continue;
      assert.ok(ok, `seed ${seed}/${depth}: loot ${l.kind} ${l.id} in ${l.room}`);
    }
    for (const l of L.run.loot.filter(l => l.floor === 1 && l.y)) {
      assert.ok([0, 1, 2, 3, 4, 5, 6, 7].some(i => reach({ x: l.x + Math.cos(i * Math.PI / 4) * 1.2, z: l.z + Math.sin(i * Math.PI / 4) * 1.2 }, .45)), `seed ${seed}/${depth}: table loot ${l.id}`);
    }
    for (const c of L.run.chests.filter(c => c.floor === 1)) {
      assert.ok([0, 1, 2, 3, 4, 5, 6, 7].some(i => reach({ x: c.x + Math.cos(i * Math.PI / 4) * 1.3, z: c.z + Math.sin(i * Math.PI / 4) * 1.3 }, .45)), `seed ${seed}/${depth}: chest ${c.id}`);
    }
    for (const s of L.run.sleepers.filter(s => s.floor === 1 && s.kind !== 'spider')) assert.ok(L.walkable(s.x, s.z, state, .3), `seed ${seed}/${depth}: ${s.kind} stands free`);
  }
});

test('the hidden room in the library still opens with the echo mask', () => {
  let found = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const L = layoutFor(seed, 2, 'biblioteca'), wall = L.run.hidden[0]; if (!wall) continue;
    found++;
    const room = L.run.rooms.find(r => r.id === wall.room), stop = L.run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 };
    const shut = { open: {}, revealed: {}, lift: { floor: 1, moving: false } };
    assert.equal(L.findPath(landing, room, shut).length, 0, `seed ${seed}: shut`);
    assert.ok(L.findPath(landing, room, { ...shut, revealed: { [wall.id]: 1 } }).length, `seed ${seed}: open`);
  }
  assert.ok(found > 10);
});
