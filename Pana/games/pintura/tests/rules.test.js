import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, blocked, cleanInput, segmentBox, coverFor, COVER, SIZE } from '../public/rules.js';
const arena = (options = { toughness: 1 }) => { const g = new Arena('plaza', 'normal', options); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.start(); g.go(); return g; };
test('inputs are finite, bounded and diagonal movement is normalized', () => {
  assert.deepEqual(cleanInput(null), { x: 0, z: 0, ax: 0, az: -1, weapon: null, alt: false, grenade: false, pitch: 0, charge: 0, fire: false, aim: false, reload: false, sprint: false, jump: 0, look: false });
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
  assert.ok(g.toLobby()); g.start(); g.go(); assert.equal(g.round, 2); assert.equal(g.time, 180); assert.equal(g.players[0].score, 0);
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
    g.start(); g.go(); const target = g.players[0], bot = g.players[1];
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
  const { PAINT_ARENAS, ARENAS } = await import('../../../engine/worlds/arena-layouts.js');
  const { coverFor, spawnsFor, sizeFor } = await import('../public/rules.js');
  assert.ok(!ARENAS.some(m => m.id === 'muelle'), 'the container yard stays out of the shared hunt/table maps');
  for (const { id } of PAINT_ARENAS) for (const variant of [0, 1, 2]) {
    const cover = coverFor(id, variant), size = sizeFor(id);
    assert.ok(size >= SIZE && size >= 27, `${id}: the larger court`);
    cover.forEach((a, i) => cover.slice(i + 1).forEach(b => assert.ok(Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2) >= 2.2, `${id}: passage between ${a.x},${a.z} and ${b.x},${b.z}`)));
    for (const s of spawnsFor(id)) assert.equal(blocked(s.x, s.z, 2, id, variant), false, `${id}/${variant}: spawn ${s.x},${s.z} has room`);
    const key = (x, z) => `${x},${z}`, free = new Set();
    for (let x = 1 - size; x < size; x += .5) for (let z = 1 - size; z < size; z += .5) if (!blocked(x, z, .55, id, variant)) free.add(key(x, z));
    const start = spawnsFor(id)[0], queue = [[start.x, start.z]], seen = new Set([key(start.x, start.z)]);
    while (queue.length) { const [x, z] = queue.pop(); for (const [dx, dz] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) { const k = key(x + dx, z + dz); if (free.has(k) && !seen.has(k)) { seen.add(k); queue.push([x + dx, z + dz]); } } }
    assert.equal(seen.size, free.size, `${id}/${variant}: every free cell is reachable`);
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

test('El Puerto: a long court, mirrored yards and bots that cross it', async () => {
  const { coverFor, spawnsFor, boundsFor, sizeFor } = await import('../public/rules.js');
  const { PAINT_ARENAS } = await import('../../../engine/worlds/arena-layouts.js');
  assert.equal(new Arena().mapId, 'terminal', 'El Puerto is the default map'); assert.equal(PAINT_ARENAS[0].id, 'terminal', 'and leads the picker');
  assert.deepEqual(boundsFor('terminal'), { x: 58, z: 32 }); assert.equal(sizeFor('terminal'), 58);
  assert.equal(blocked(50, 0, .55, 'terminal'), false, 'open well past a square court'); assert.equal(blocked(0, 31.8, .55, 'terminal'), true, 'the fence runs along z = ±32');
  spawnsFor('terminal').forEach((s, i) => assert.equal(Math.sign(s.x), i % 2 ? 1 : -1, 'even seats start west, odd seats east'));
  for (const variant of [0, 1, 2]) for (const o of coverFor('terminal', variant)) assert.ok(coverFor('terminal', variant).some(m => Math.abs(m.x + o.x) < 1e-9 && m.z === o.z && m.w === o.w), `variant ${variant}: ${o.x},${o.z} has its mirror`);
  for (const variant of [0, 1, 2]) {
    const g = new Arena('terminal', 'normal', { mode: 'teams' });
    g.add(1, { name: 'Pana', avatar: {} }); g.add(2, { name: 'Bot', avatar: {}, bot: true });
    g.round = variant; g.start(); g.go(); assert.equal(g.variant, variant);
    const [me, rival] = g.players; let found = false;
    for (let i = 0; i < 600 && !found; i++) { g.step(.05, new Map([[1, {}]])); found = Math.hypot(rival.x - me.x, rival.z - me.z) < 25; assert.equal(blocked(rival.x, rival.z, .55, 'terminal', variant), false); }
    assert.ok(found, `variant ${variant}: the rival bot walks the lanes to a pana it cannot see within 30 s`);
  }
});

test('aguante: three pepazos take a pana out, quiet seconds wash the paint off', () => {
  const g = arena({}), [a, b] = g.players;
  const shoot = () => { Object.assign(a, { x: -3, z: -4, shield: 0, cooldown: 0, reload: 0, ammo: 12 }); Object.assign(b, { x: 3, z: -4, shield: 0 }); g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]])); for (let i = 0; i < 4; i++) g.step(.05); };
  shoot(); shoot(); assert.equal(b.paint, 2); assert.equal(b.stains.length, 2); assert.equal(b.respawn, 0); assert.equal(a.score, 0);
  assert.deepEqual(g.events.map(e => [e.type, e.owner, e.victim, e.distance]), [['hit', 1, 2, 6], ['hit', 1, 2, 6]]);
  for (let i = 0; i < 120; i++) g.step(.05); assert.equal(b.paint, 0, 'paint washes off');
  shoot(); shoot(); shoot(); assert.ok(b.respawn > 0); assert.equal(a.score, 1);
  const out = g.events.at(-1); assert.equal(out.type, 'out'); assert.equal(out.distance, 6); assert.equal(out.streak, 1);
  for (let i = 0; i < 60; i++) g.step(.05); assert.equal(b.paint, 0); assert.deepEqual(b.stains, []);
});
test('knockouts track streaks and revenge', () => {
  const g = arena(), [a, b] = g.players;
  g.hit(b, a, a.color); assert.equal(g.events.at(-1).streak, 1); b.respawn = 0;
  g.hit(b, a, a.color); assert.equal(g.events.at(-1).streak, 2); b.respawn = 0;
  g.hit(a, b, b.color); assert.equal(g.events.at(-1).revenge, true); assert.equal(a.streak, 0);
});
test('each round plays the next of three fixed layouts', () => {
  const g = arena(); assert.equal(g.variant, 0);
  const again = () => { g.phase = 'finished'; assert.ok(g.toLobby()); assert.ok(g.start()); };
  again(); assert.equal(g.view().variant, 1);
  again(); assert.equal(g.variant, 2);
  again(); assert.equal(g.variant, 0);
  assert.notDeepEqual(coverFor('plaza', 1), coverFor('plaza', 0)); assert.ok(coverFor('muelle', 2).length !== coverFor('muelle', 0).length);
});

test('Shift sprints faster for three seconds, holds fire, then recovers', () => {
  const g = arena(), p = g.players[0]; Object.assign(p, { x: -20, z: 20 });
  for (let i = 0; i < 20; i++) g.step(.05, new Map([[1, { x: 1, sprint: true }]]));
  assert.ok(p.x > -20 + 7 * 1.4 * .95, `sprinted to ${p.x}`); assert.ok(p.stamina < .7); assert.equal(p.sprint, true);
  const ammo = p.ammo; g.step(.05, new Map([[1, { x: 1, sprint: true, fire: true }]])); assert.equal(p.ammo, ammo - 1, 'firing cancels the sprint');
  for (let i = 0; i < 80; i++) g.step(.05, new Map([[1, { x: -1, sprint: true }]])); assert.ok(p.stamina < .05); assert.equal(p.sprint, false);
  for (let i = 0; i < 40; i++) g.step(.05); assert.ok(p.stamina > .35);
});

test('Otra ronda returns to the lobby and the next round plays the map picked there', () => {
  const g = new Arena('plaza', 'normal', { mode: 'teams' });
  g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.add(1000, { name: 'Coco', avatar: {}, bot: true });
  assert.ok(g.start()); g.go(); const seats = g.players.map(p => [p.id, p.seat, p.team]);
  g.time = .01; g.step(.05); assert.equal(g.phase, 'finished');
  // The old path: restarting from the results is refused, so the map never repeats silently.
  assert.equal(g.start(), false); assert.equal(g.phase, 'finished'); assert.equal(g.round, 1);
  assert.equal(g.selectMap('muelle'), false, 'no map change on the results screen');
  assert.ok(g.toLobby({ keepBots: true })); assert.equal(g.phase, 'lobby'); assert.equal(g.toLobby(), false);
  assert.deepEqual(g.players.map(p => [p.id, p.seat, p.team]), seats, 'seats and teams stay');
  assert.deepEqual(g.balls, []); assert.deepEqual(g.flags, []); assert.equal(g.loading, 0);
  assert.ok(g.selectMap('muelle')); assert.ok(g.start());
  assert.equal(g.phase, 'playing'); assert.equal(g.mapId, 'muelle'); assert.equal(g.round, 2); assert.equal(g.variant, 1);
  assert.ok(g.players.every(p => p.score === 0));
});

test('an online room leaves its bots behind on the way to the lobby', () => {
  const g = new Arena('plaza'); g.add(1, { name: 'A', avatar: {} }); g.add(1000, { name: 'Coco', avatar: {}, bot: true });
  g.start(); g.phase = 'finished';
  assert.ok(g.toLobby()); assert.deepEqual(g.players.map(p => p.id), [1]);
  assert.equal(g.toLobby(), false, 'only from a finished round');
});
