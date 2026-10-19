import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, blocked, cleanInput, segmentBox, COVER, SIZE } from '../public/rules.js';
const arena = () => { const g = new Arena(); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.start(); return g; };
test('inputs are finite, bounded and diagonal movement is normalized', () => {
  assert.deepEqual(cleanInput(null), { x: 0, z: 0, ax: 0, az: -1, weapon: 'pistol', fire: false, reload: false });
  const input = cleanInput({ x: 99, z: 99, ax: Infinity, az: NaN, fire: 'yes' }); assert.ok(Math.abs(Math.hypot(input.x, input.z) - 1) < 1e-9); assert.equal(input.fire, false);
});
test('movement stops at arena walls and cover, sliding along free axes', () => {
  const g = arena(), p = g.players[0]; Object.assign(p, { x: -3, z: 0 });
  for (let i = 0; i < 60; i++) g.step(.05, new Map([[1, { x: 1 }]])); assert.ok(p.x < -2.5); assert.equal(blocked(p.x, p.z), false);
  Object.assign(p, { x: SIZE - 1, z: -15 }); for (let i = 0; i < 60; i++) g.step(.05, new Map([[1, { x: 1, z: -1 }]])); assert.ok(p.x <= SIZE - .55); assert.ok(p.z >= -SIZE + .55);
});
test('swept projectiles cannot tunnel through thin cover', () => {
  assert.notEqual(segmentBox(-10, 0, 20, 0, COVER[0]), null);
  const g = arena(); Object.assign(g.players[0], { x: -4, z: 0, shield: 0 }); Object.assign(g.players[1], { x: 4, z: 0, shield: 0 });
  for (let i = 0; i < 60; i++) g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]]));
  assert.equal(g.players[0].score, 0); assert.equal(g.players[1].hits, 0); assert.ok(g.splats.length > 0);
});
test('paint hits score once, respawn safely, and protection ends when firing', () => {
  const g = arena(); Object.assign(g.players[0], { x: -3, z: -4, shield: 0 }); Object.assign(g.players[1], { x: 3, z: -4, shield: 0 });
  g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]])); for (let i = 0; i < 10; i++) g.step(.05);
  assert.equal(g.players[0].score, 1); assert.equal(g.players[1].hits, 1); assert.ok(g.players[1].respawn > 0);
  for (let i = 0; i < 50; i++) g.step(.05); assert.equal(g.players[1].respawn, 0); assert.ok(g.players[1].shield > 0); assert.equal(blocked(g.players[1].x, g.players[1].z), false);
  g.step(.05, new Map([[2, { fire: true }]])); assert.equal(g.players[1].shield, 0);
});
test('ammo, cooldown, manual reload and automatic reload are enforced', () => {
  const g = arena(), p = g.players[0]; g.step(.05, new Map([[1, { fire: true }]])); assert.equal(p.ammo, 11);
  g.step(.05, new Map([[1, { fire: true }]])); assert.equal(p.ammo, 11);
  g.step(.05, new Map([[1, { reload: true }]])); assert.equal(p.reload, 1.3);
  for (let i = 0; i < 28; i++) g.step(.05); assert.equal(p.ammo, 12);
  p.ammo = 0; g.step(.05); assert.ok(p.reload > 0);
});
test('timer, target score and rematches produce clean rounds', () => {
  const g = arena(); g.time = .01; g.step(.05); assert.equal(g.phase, 'finished');
  g.start(); assert.equal(g.round, 2); assert.equal(g.time, 180); assert.equal(g.players[0].score, 0);
  g.players[0].score = 10; g.step(.05); assert.equal(g.phase, 'finished'); assert.equal(g.balls.length, 0);
});
test('bots move and fire without escaping the playable arena', () => {
  const g = arena(); g.players[1].bot = true; let fired = false;
  for (let i = 0; i < 1200 && g.phase === 'playing'; i++) { g.step(.05); fired ||= g.balls.length > 0; assert.equal(blocked(g.players[1].x, g.players[1].z), false); }
  assert.ok(fired); assert.ok(g.players[0].hits > 0);
});

test('bot marksmanship follows the difficulty; only the lobby or results change it', () => {
  function hits(difficulty) {
    const g = new Arena('plaza', difficulty, { lives: 0 }); g.add(1, { name: 'Blanco', avatar: {} }); g.add(2, { name: 'Bot', avatar: {}, bot: true });
    g.start(); const target = g.players[0], bot = g.players[1];
    for (let n = 0; n < 900; n++) {
      Object.assign(bot, { x: -6, z: -14 }); Object.assign(target, { x: 6, z: -14, shield: 0 });
      g.step(.05, new Map([[1, {}]])); if (g.phase !== 'playing') break;
    }
    return bot.score;
  }
  assert.ok(hits('experto') > hits('facil'), `experto ${hits('experto')} vs facil ${hits('facil')}`);
  const g = new Arena(); assert.ok(g.selectDifficulty('dificil')); assert.equal(g.view().difficulty, 'dificil');
  assert.equal(g.selectDifficulty('imposible'), false); g.add(1, { name: 'A', avatar: {} }); g.start(); assert.equal(g.selectDifficulty('facil'), false);
});

test('every Pepazo map has clear spawns, open passages and one connected court', async () => {
  const { PAINT_ARENAS, ARENAS } = await import('../../../engine/arena-layouts.js');
  const { coverFor, spawnsFor, sizeFor } = await import('../public/rules.js');
  assert.ok(!ARENAS.some(m => m.id === 'muelle'), 'the container yard stays out of the shared hunt/table maps');
  for (const { id } of PAINT_ARENAS) {
    const cover = coverFor(id), size = sizeFor(id);
    assert.ok(size >= SIZE && size >= 27, `${id}: the larger court`);
    cover.forEach((a, i) => cover.slice(i + 1).forEach(b => assert.ok(Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2) >= 2.2, `${id}: passage between ${a.x},${a.z} and ${b.x},${b.z}`)));
    for (const s of spawnsFor(id)) assert.equal(blocked(s.x, s.z, 2, id), false, `${id}: spawn ${s.x},${s.z} has room`);
    const key = (x, z) => `${x},${z}`, free = new Set();
    for (let x = 1 - size; x < size; x += .5) for (let z = 1 - size; z < size; z += .5) if (!blocked(x, z, .55, id)) free.add(key(x, z));
    const start = spawnsFor(id)[0], queue = [[start.x, start.z]], seen = new Set([key(start.x, start.z)]);
    while (queue.length) { const [x, z] = queue.pop(); for (const [dx, dz] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) { const k = key(x + dx, z + dz); if (free.has(k) && !seen.has(k)) { seen.add(k); queue.push([x + dx, z + dz]); } } }
    assert.equal(seen.size, free.size, `${id}: every free cell is reachable`);
  }
});

test('the container yard is selectable, keeps bots inside and flags at its spawns', () => {
  const g = new Arena(); assert.ok(g.selectMap('muelle'));
  for (let i = 0; i < 8; i++) g.add(i + 1, { name: `Pana ${i}`, avatar: {}, bot: i > 0 });
  g.start(); assert.equal(g.view().mapId, 'muelle');
  for (let i = 0; i < 900 && g.phase === 'playing'; i++) { g.step(.05); for (const p of g.players) assert.equal(blocked(p.x, p.z, .55, 'muelle'), false); }
  const flags = new Arena('muelle', 'normal', { flag: true }); flags.add(1, { name: 'A' }); flags.add(2, { name: 'B' }); flags.start();
  for (const f of flags.flags) assert.equal(blocked(f.homeX, f.homeZ, 1.4, 'muelle'), false);
});
