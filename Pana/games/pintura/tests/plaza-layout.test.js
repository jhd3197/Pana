import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAZA_COVERS, PLAZA_KINDS } from '../public/plaza-layout.js';
import { Arena, coverFor, spawnsFor, blocked, variantName, shotCover, segmentBox, SHOT_HEIGHT, VARIANTS } from '../public/rules.js';
import { FLAG_STANDS } from '../public/ctf.js';
import { DOM_ZONES } from '../public/domination.js';

const same = (a, b) => a.kind === b.kind && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9 && a.w === b.w && a.d === b.d && a.h === b.h;
const hasImage = (cover, o, fx, fz) => cover.some(m => same(m, { ...o, x: o.x * fx, z: o.z * fz }));

test('every plaza layout is the same plaza for both teams: mirrored in x and z, so also turned half a turn', () => {
  assert.equal(PLAZA_COVERS.length, VARIANTS);
  for (let variant = 0; variant < VARIANTS; variant++) {
    const cover = coverFor('plaza', variant);
    for (const o of cover) {
      assert.ok(hasImage(cover, o, -1, -1), `variant ${variant}: ${o.kind} at ${o.x},${o.z} has its half-turn twin`);
      assert.ok(hasImage(cover, o, -1, 1), `variant ${variant}: ${o.kind} at ${o.x},${o.z} has its x mirror`);
      assert.ok(hasImage(cover, o, 1, -1), `variant ${variant}: ${o.kind} at ${o.x},${o.z} has its z mirror`);
    }
  }
  // The spawns, flag stands and the outer zones turn the same way (team 0 ↔ team 1).
  const spawns = spawnsFor('plaza');
  spawns.forEach((s, i) => { const t = spawns[i ^ 1]; assert.ok(Math.abs(s.x + t.x) < 1e-9 && Math.abs(s.z + t.z) < 1e-9, `spawn ${i} and ${i ^ 1} face each other`); });
  const [a, b] = FLAG_STANDS.plaza; assert.deepEqual([a.x + b.x, a.z + b.z], [0, 0]);
  const [zoneA, , zoneC] = DOM_ZONES.plaza; assert.deepEqual([zoneA.x + zoneC.x, zoneA.z + zoneC.z], [0, 0]);
});

test('every plaza row is a known prop; low ones let shots over, the rest stop them', () => {
  const low = ['bench', 'planter', 'fountain', 'cart', 'wall'];
  for (let variant = 0; variant < VARIANTS; variant++) for (const o of coverFor('plaza', variant)) {
    assert.ok(PLAZA_KINDS[o.kind], `${o.kind} is a plaza kind`);
    assert.ok(o.w > 0 && o.d > 0 && o.h > 0 && o.height === o.h);
    // A low wall is waist high; the tall wall between the square and the street is not.
    if (low.includes(o.kind) && !(o.kind === 'wall' && o.h > 2)) assert.ok(o.h <= SHOT_HEIGHT, `${o.kind} at ${o.x},${o.z} lets shots over`);
    else assert.ok(o.h > SHOT_HEIGHT, `${o.kind} at ${o.x},${o.z} stops shots`);
  }
  const kinds = new Set(PLAZA_COVERS.flat().map(o => o.kind));
  for (const kind of ['kiosk', 'fountain', 'bench', 'planter', 'tree', 'stall', 'car', 'cart', 'wall', 'corner', 'pillar', 'crate', 'stage']) assert.ok(kinds.has(kind), `some layout has a ${kind}`);
});

test('the plaza has its own layout names; the shared courts keep theirs', () => {
  assert.deepEqual([0, 1, 2].map(v => variantName('plaza', v)), ['Clásica', 'Mercado', 'Fiesta']);
  assert.deepEqual([0, 1, 2].map(v => variantName('puerto', v)), ['Clásica', 'Girada', 'Cerrada']);
  assert.notDeepEqual(coverFor('plaza', 1), coverFor('plaza', 0)); assert.notDeepEqual(coverFor('plaza', 2), coverFor('plaza', 0));
});

test('on every plaza layout a bot walks from any spawn to a pana it cannot see', () => {
  const spawns = spawnsFor('plaza');
  for (let variant = 0; variant < VARIANTS; variant++) {
    // The bots' 1 m grid (rules.js navGrid) joins every spawn.
    const open = (x, z) => !blocked(x, z, .6, 'plaza', variant), key = (i, j) => `${i},${j}`;
    const start = [Math.floor(spawns[0].x), Math.floor(spawns[0].z)], seen = new Set([key(...start)]), queue = [start];
    while (queue.length) { const [i, j] = queue.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + di, j + dj); if (!seen.has(k) && open(i + di + .5, j + dj + .5)) { seen.add(k); queue.push([i + di, j + dj]); } } }
    for (const s of spawns) assert.ok(seen.has(key(Math.floor(s.x), Math.floor(s.z))), `variant ${variant}: the grid reaches spawn ${s.x},${s.z}`);
    const cover = shotCover(coverFor('plaza', variant));
    spawns.forEach((from, i) => {
      const to = spawns[i ^ 1], g = new Arena('plaza', 'normal', { lives: 0 });
      g.add(1, { name: 'Pana', avatar: {} }); g.add(1000, { name: 'Bot', avatar: {}, bot: true });
      g.round = variant; g.start(); g.go(); assert.equal(g.variant, variant);
      const [me, bot] = g.players; Object.assign(me, to, { shield: 99 }); Object.assign(bot, from);
      let found = false;
      for (let n = 0; n < 600 && !found; n++) {
        g.step(.05, new Map([[1, {}]])); Object.assign(me, to);
        const dist = Math.hypot(me.x - bot.x, me.z - bot.z), sees = !cover.some(o => segmentBox(bot.x, bot.z, me.x - bot.x, me.z - bot.z, o) !== null);
        found = dist < 10 || (sees && dist < 30);
      }
      assert.ok(found, `variant ${variant}: a bot from ${from.x},${from.z} finds the pana at ${to.x},${to.z} within 30 s`);
    });
  }
});
