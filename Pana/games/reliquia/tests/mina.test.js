// La mina is its own place: its deck, its drifts and its way through, and everything
// the mine's new rooms deal stays reachable. The library's deal is untouched by it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun, roomName, inRect, THEMES } from '../public/deck.js';
import { layoutFor } from '../public/layout.js';
import { Expedition } from '../public/rules.js';
import { SILBON_BODY } from '../public/silbon.js';

const MINE_ROOMS = ['socavon', 'galeria', 'pozo', 'ramal'], SEEDS = 40, DEPTHS = [1, 2, 3, 5, 8];
const width = c => c.horizontal ? c.rect[3] - c.rect[1] : c.rect[2] - c.rect[0];
const sweep = (theme, each) => { for (let seed = 1; seed <= SEEDS; seed++) for (const depth of DEPTHS) each(generateRun(seed, { depth, theme }), `${theme} ${seed}/${depth}`, seed, depth); };

test('the mine deals its own rooms, and no other place does', () => {
  const seen = new Set();
  sweep('mina', run => { for (const r of run.rooms) seen.add(r.kind); });
  for (const kind of MINE_ROOMS) assert.ok(seen.has(kind), `${kind} is dealt in the mine`);
  for (const kind of ['columnas', 'cripta', 'estanterias', 'lectura', 'archivo', 'copistas']) assert.ok(!seen.has(kind), `${kind} belongs elsewhere`);
  for (const theme of THEMES.filter(t => t !== 'mina')) sweep(theme, (run, tag) => { for (const r of run.rooms) assert.ok(!MINE_ROOMS.includes(r.kind), `${tag}: ${r.kind}`); });
});

test('mine drifts are narrower than the corridors of the library and the biomes', () => {
  sweep('mina', (run, tag) => { for (const c of run.corridors) assert.equal(width(c), 3, `${tag}: ${c.id}`); });
  for (const theme of THEMES.filter(t => t !== 'mina')) sweep(theme, (run, tag) => { for (const c of run.corridors) assert.equal(width(c), 4, `${tag}: ${c.id}`); });
});

test('the mine walks sideways and tunnels more than the library does', () => {
  const measure = theme => { let across = 0, rooms = 0, tunnel = 0, n = 0; sweep(theme, run => { const path = run.rooms.filter(r => r.index != null); across += path.filter((r, i) => i && r.cell[1] === path[i - 1].cell[1]).length; rooms += path.length; tunnel += run.corridors.reduce((s, c) => s + (c.horizontal ? c.rect[2] - c.rect[0] : c.rect[3] - c.rect[1]), 0); n++; }); return { across: across / n, rooms: rooms / n, tunnel: tunnel / n }; };
  const mine = measure('mina'), library = measure('biblioteca');
  assert.ok(mine.across > library.across + .8, `steps along a level: ${mine.across} against ${library.across}`);
  assert.ok(mine.rooms > library.rooms, `rooms on the way: ${mine.rooms} against ${library.rooms}`);
  assert.ok(mine.tunnel > library.tunnel * 1.25, `metres of tunnel in a floor: ${mine.tunnel} against ${library.tunnel}`);
});

test('every body still fits a mine drift, and every mine room is reached', () => {
  for (let seed = 1; seed <= SEEDS; seed++) for (const depth of DEPTHS) {
    const L = layoutFor(seed, depth, 'mina'), run = L.run, tag = `${seed}/${depth}`, stop = run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 };
    const state = { open: Object.fromEntries(run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(run.hidden.map(h => [h.id, 1])), strung: Object.fromEntries([...run.bridges, ...run.ropes].filter(b => b.needs).map(b => [b.id, 1])), lift: { floor: 1, moving: false } };
    for (const c of run.corridors) {
      const mid = { x: (c.rect[0] + c.rect[2]) / 2, z: (c.rect[1] + c.rect[3]) / 2 };
      // The rails run down the middle: a carrito, a mummy and the Silbón all pass.
      for (const [body, radius] of [['carrito', .6], ['mummy', .5], ['silbon', SILBON_BODY]]) assert.ok(L.findPath(landing, mid, state, radius).length, `${tag}: ${body} through ${c.id}`);
    }
    for (const r of run.rooms.filter(r => MINE_ROOMS.includes(r.kind))) {
      const pit = run.pits.find(p => p.room === r.id);
      const target = pit ? { x: r.x, z: (pit.rect[3] + r.rect[3]) / 2 } : { x: r.x + .5, z: r.z + .5 };
      assert.ok(L.findPath(landing, target, state).length, `${tag}: ${r.kind} ${r.id}`);
    }
    // Islands and planks: a pana walks a plank, the 1 m path grid does not.
    for (const l of run.loot.filter(q => q.floor === 1 && !L.lowAt(q.x, q.z) && !q.y)) assert.ok(L.findPath(landing, l, state, .3).length || run.pits.some(p => inRect(l.x, l.z, p.island)) || run.bridges.some(b => inRect(l.x, l.z, b.rect)), `${tag}: ${l.kind} at ${l.x},${l.z}`);
  }
});

test('a flooded shaft keeps its plank and its staging, and falls are still falls', () => {
  let shafts = 0;
  sweep('mina', (run, tag) => {
    for (const room of run.rooms.filter(r => r.kind === 'pozo')) {
      shafts++;
      const L = layoutFor(run.seed, run.depth, 'mina'), pit = run.pits.find(p => p.room === room.id), plank = run.bridges.find(b => b.room === room.id);
      assert.ok(pit?.water, `${tag}: water`); assert.ok(plank?.beam, `${tag}: a plank`);
      assert.equal(L.overPit((pit.rect[0] + pit.island[0]) / 2, room.z), true, `${tag}: open water around the staging`);
      assert.equal(L.walkable(room.x, (plank.rect[1] + plank.rect[3]) / 2, {}, .42), true, `${tag}: a pana crosses the plank`);
      assert.equal(L.walkable(room.x, (plank.rect[1] + plank.rect[3]) / 2, {}, .6), false, `${tag}: a mummy does not`);
    }
  });
  assert.ok(shafts > 30, `shafts dealt: ${shafts}`);
});

test('the mine calls its rooms by their own names; the library keeps its names', () => {
  assert.equal(roomName('sima', 'mina'), 'El tiro');
  assert.equal(roomName('sima', 'templo'), 'La sima');
  assert.equal(roomName('tesoro', 'mina'), 'El polvorín');
  assert.equal(roomName('galeria', 'mina'), 'La galería de máquinas');
  assert.equal(roomName('entrada', 'biblioteca'), 'El vestíbulo');
  assert.equal(roomName('puente', 'biblioteca'), 'El sótano hundido');
});

test('a whole jornada in the mine plays through the same rules', () => {
  const g = new Expedition(4242, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.start(4242);
  assert.equal(g.layout.run.theme, 'mina');
  for (let i = 0; i < 200; i++) g.update(.05, new Map());
  assert.ok(g.layout.run.rooms.length > 3);
  const snap = JSON.parse(JSON.stringify(g.snapshot())), other = new Expedition(1, g.options); other.restore(snap, new Map(g.players.map(p => [p.id, p])));
  assert.deepEqual(other.layout.run.corridors.map(c => c.rect), g.layout.run.corridors.map(c => c.rect), 'a new host deals the same drifts');
});
