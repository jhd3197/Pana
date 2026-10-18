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
