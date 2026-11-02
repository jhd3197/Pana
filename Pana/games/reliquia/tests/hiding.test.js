// The library's hiding spots: relics hide in drawers, trunks, wardrobes,
// draped furniture, heaps of fallen books, behind shelves and ladders and in
// corners an old lantern lights. Every spot is dealt from the seed, reachable,
// gives what it hides exactly once and keeps the jornada winnable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor } from '../public/layout.js';
import { generateRun, inRect } from '../public/deck.js';
import { Expedition, interaction, visibleItems, quotaFor, spotFront, compassTarget } from '../public/rules.js';
import { ITEMS, valueOf } from '../public/items.js';

const LIBRARY = [2, 5, 8];
const opened = L => ({ open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), lift: { floor: 1, moving: false } });
function reachable(L, state, from, step = .5, radius = .45) {
  const key = (i, j) => `${i},${j}`, seen = new Set(), queue = [[Math.round(from.x / step), Math.round(from.z / step)]];
  seen.add(key(...queue[0]));
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + di, j + dj); if (!seen.has(k) && L.walkable((i + di) * step, (j + dj) * step, state, radius)) { seen.add(k); queue.push([i + di, j + dj]); } }
  }
  return p => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => seen.has(key(Math.round(p.x / step) + di, Math.round(p.z / step) + dj)));
}
const relicValue = kinds => kinds.reduce((n, k) => n + (ITEMS[k].tool ? 0 : valueOf(k)), 0);

test('the same seed deals the same hiding spots on every client', async () => {
  const fresh = await import('../public/deck.js?fresh');
  for (const [seed, depth] of [[3, 2], [9, 5], [21, 8]]) {
    const a = generateRun(seed, { depth }), b = fresh.generateRun(seed, { depth });
    assert.ok(a.spots.length >= 6, `seed ${seed}/${depth}: spots dealt`);
    assert.deepEqual(JSON.parse(JSON.stringify(a.spots)), JSON.parse(JSON.stringify(b.spots)));
  }
  assert.equal(generateRun(3, { depth: 1 }).spots.length, 0, 'the mine keeps its look for now');
});

test('every hiding spot is reachable and its mouth is clear', () => {
  for (let seed = 1; seed <= 25; seed++) for (const depth of LIBRARY) {
    const L = layoutFor(seed, depth), state = opened(L), stop = L.run.lifts.find(l => l.floor === 1);
    const walker = reachable(L, state, { x: stop.x, z: stop.z - 5 });
    for (const sp of L.run.spots) {
      const front = spotFront(sp), room = L.run.rooms.find(r => r.id === sp.room);
      assert.ok(inRect(sp.x, sp.z, room.rect), `seed ${seed}/${depth}: ${sp.id} in its room`);
      assert.ok(L.walkable(front.x, front.z, state, .3) && walker(front), `seed ${seed}/${depth}: ${sp.kind} ${sp.id} in ${room.kind} can be reached`);
      if (sp.reveal) assert.ok(L.walkable(sp.reveal.x, sp.reveal.z, state, .12), `seed ${seed}/${depth}: the lantern's corner`);
    }
  }
});

test('relics hide in the spots, decoys and empties exist, and the quota stays reachable', () => {
  let decoys = 0, empty = 0, hard = 0, easy = 0;
  for (let seed = 1; seed <= 40; seed++) for (const depth of LIBRARY) {
    const run = layoutFor(seed, depth).run, rooms = run.rooms.filter(r => r.floor === 1);
    const plain = run.loot.filter(l => l.floor === 1), hidden = run.spots.filter(s => !s.decoy).flatMap(s => s.content);
    // Plain-sight value is mostly the big treasures, the sealed chamber's
    // scatter and the cursed piece on its lectern; the hand-sized relics hide.
    const inSight = plain.filter(l => rooms.some(r => r.id === l.room) && !l.cursed && ITEMS[l.kind].size !== 'big' && !ITEMS[l.kind].tool && valueOf(l.kind) >= 60);
    assert.equal(inSight.length, 0, `seed ${seed}/${depth}: ${inSight.map(l => l.kind)} lie in plain sight`);
    const handSized = relicValue(hidden.filter(k => ITEMS[k].size !== 'big'));
    assert.ok(handSized > 2 * relicValue(plain.filter(l => rooms.some(r => r.id === l.room) && ITEMS[l.kind].size !== 'big' && !l.cursed).map(l => l.kind)), `seed ${seed}/${depth}: hidden relics are worth at least twice what lies in sight`);
    const total = relicValue(plain.map(l => l.kind)) + relicValue(hidden);
    assert.ok(total >= quotaFor(depth, 5), `seed ${seed}/${depth}: Bs. ${total} on the floor, quota ${quotaFor(depth, 5)}`);
    for (const s of run.spots) {
      if (s.decoy) decoys++; else if (!s.content.length && !s.reveals) empty++;
      if (s.content.length && !s.decoy) { if (s.hard >= .6) hard++; if (s.hard <= .3) easy++; }
    }
  }
  assert.ok(decoys > 50 && empty > 50, `decoys ${decoys}, empty ${empty}`);
  assert.ok(hard > 100 && easy > 40, `relics behind hard (${hard}) and easy (${easy}) spots`);
});

// A library jornada with one pana, nothing awake.
function library(seed) {
  const g = new Expedition(seed); g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Beto'); g.start(seed); g.completeLevel();
  assert.equal(g.layout.run.theme, 'biblioteca');
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  return g;
}
// Stand in front of a spot looking at it; null when the crosshair picks something else.
function aim(g, id, sp) {
  const p = g.players.find(p => p.id === id), front = spotFront(sp), x = front.x + Math.sin(sp.h) * .5, z = front.z + Math.cos(sp.h) * .5;
  if (!g.layout.walkable(x, z, g, .42)) return null;
  Object.assign(p, { x, z, h: Math.atan2(sp.x - x, sp.z - z), pitch: -.35, invulnerable: 99 });
  const t = interaction(g, p);
  return t?.kind === 'search' && t.id === sp.id ? p : null;
}
const hold = (g, id, seconds) => { for (let t = 0; t < seconds; t += .05) { g.director.duration = 999; g.update(.05, new Map([[id, { hold: true }]])); } };

test('searching takes a moment and gives what a spot hides exactly once', () => {
  let checked = 0;
  for (const seed of [11, 12, 13, 14]) {
    const g = library(seed);
    const sp = g.layout.run.spots.find(s => s.content.length && !s.trap && !s.reveal && aim(g, 1, s)); if (!sp) continue;
    const before = g.items.length;
    hold(g, 1, sp.need * .5);
    assert.equal(g.spots[sp.id], undefined, 'half a search opens nothing');
    assert.ok(g.searching[sp.id] > 0 && interaction(g, g.players[0]).progress > .3, 'the prompt fills');
    hold(g, 1, sp.need * .6 + .1);
    assert.equal(g.spots[sp.id], 1);
    const found = g.items.slice(before);
    assert.deepEqual(found.map(i => i.kind).sort(), [...sp.content].sort(), 'its contents tumble out');
    assert.ok(g.events.some(e => e.kind === 'search' && e.spot === sp.id && e.player === 1));
    hold(g, 1, 2);
    assert.equal(g.items.filter(i => found.some(f => f.id === i.id)).length + g.players[0].hands.filter(Boolean).length >= found.length, true);
    assert.equal(g.items.length - before <= found.length, true, 'holding on gives nothing more');
    assert.ok(!(interaction(g, g.players[0])?.kind === 'search' && interaction(g, g.players[0]).id === sp.id), 'an open spot is not offered again');
    checked++;
  }
  assert.ok(checked >= 3, `searched ${checked} spots`);
});

test('a lit lantern beside the secret bookcase opens the passage', () => {
  let lit = 0;
  for (let seed = 1; seed <= 40 && lit < 2; seed++) {
    const g = library(seed), sp = g.layout.run.spots.find(s => s.reveals); if (!sp || !aim(g, 1, sp)) continue;
    assert.equal(g.revealed[sp.reveals], undefined);
    hold(g, 1, sp.need + .2);
    assert.equal(g.revealed[sp.reveals], 1, `seed ${seed}: revealed`);
    lit++;
  }
  assert.ok(lit >= 1);
});

test('the opened state reaches a guest through the snapshot; the compass knows what is hidden', () => {
  const g = library(12), sp = g.layout.run.spots.find(s => s.content.length && !s.decoy && !s.trap && aim(g, 1, s));
  assert.ok(sp);
  const target = compassTarget(g, g.players[0]);
  assert.ok(target, 'something to point at');
  hold(g, 1, sp.need + .2);
  const guest = new Expedition(); guest.restore(g.snapshot(), new Map([[1, { id: 1, name: 'Ana' }], [2, { id: 2, name: 'Beto' }]]));
  assert.deepEqual(guest.spots, g.spots);
  assert.equal(guest.spots[sp.id], 1);
  const p = guest.players.find(q => q.id === 1), t = interaction(guest, p);
  assert.ok(!(t?.kind === 'search' && t.id === sp.id), 'the guest sees it open too');
  assert.deepEqual(visibleItems(guest).map(i => i.id).sort(), visibleItems(g).map(i => i.id).sort());
  // The next jornada starts with every spot shut again.
  g.completeLevel(); assert.deepEqual(g.spots, {}); assert.deepEqual(g.searching, {});
});
