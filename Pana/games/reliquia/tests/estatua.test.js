// La Estatua (games/reliquia/public/estatua.js): it only moves while no
// standing pana has it on screen (view cone and a clear line of sight, on the
// host, for everyone), in short snapped strides along real paths; it strikes
// on contact, then stands still a while; seen, it is frozen, wind-up and all;
// hits only stagger it. Its poses (engine/models/props/statue-pose.js) are
// finite numbers for any time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { spawnEnemy, ESTATUA_CAP } from '../public/enemies.js';
import { seenBy, ESTATUA, POSES } from '../public/estatua.js';
import { generateRun, ESTATUA_ROOMS } from '../public/deck.js';
import { distance } from '../public/layout.js';
import { inViewCone, watcher } from '../../../engine/play/sight.js';
import { statuePose, STATUE_POSES, STATUE_POSE_NAMES } from '../../../engine/models/props/statue-pose.js';

function library(seed = 21, players = 1) {
  const g = new Expedition(seed); for (let i = 1; i <= players; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed); g.completeLevel();
  assert.equal(g.layout.run.theme, 'biblioteca');
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.enemies = [];
  return g;
}
const calm = g => { g.director.phase = 'rest'; g.director.time = 0; g.director.duration = 999; };
function step(g, seconds, each = () => {}) { for (let t = 0; t < seconds - 1e-4; t += .05) { calm(g); g.update(.05, new Map()); each(t); } }
const face = (p, to) => { p.h = Math.atan2(to.x - p.x, to.z - p.z); p.pitch = 0; };
// The pana in front of the lift, the statue `gap` metres further in.
function scene(g, gap = 7) {
  const stop = g.layout.run.lifts.find(l => l.floor === 1), p = g.players[0];
  Object.assign(p, { x: stop.x, z: stop.z - 5, h: Math.PI, pitch: 0 });
  const e = spawnEnemy(g, 'estatua', stop.x, stop.z - 5 - gap); assert.ok(e, 'a statue spawns'); e.born = -9;
  return { p, e };
}

test('the view cone: heading, pitch, range and the target’s own width', () => {
  const eye = watcher({ x: 0, z: 0, h: 0, pitch: 0 }, 1.45), body = { x: 0, z: 6, y0: 0, y1: 2.1, r: .45 };
  assert.ok(inViewCone(eye, body));
  assert.ok(!inViewCone(watcher({ x: 0, z: 0, h: Math.PI, pitch: 0 }, 1.45), body), 'behind');
  assert.ok(!inViewCone(watcher({ x: 0, z: 0, h: 1.4, pitch: 0 }, 1.45), body), 'off to the side');
  assert.ok(!inViewCone(watcher({ x: 0, z: 0, h: 0, pitch: 1.1 }, 1.45), body), 'looking at the ceiling');
  assert.ok(!inViewCone(eye, { ...body, z: 40 }), 'too far');
  assert.ok(inViewCone(watcher({ x: 0, z: 0, h: 1.05, pitch: 0 }, 1.45), body), 'at the edge of a wide screen still counts');
});

test('seen, it is frozen; nobody looking, it strides closer', () => {
  const g = library(), { p, e } = scene(g);
  face(p, e); const at = { x: e.x, z: e.z };
  step(g, 3, () => assert.equal(e.frozen, true));
  assert.ok(distance(e, at) < 1e-9, 'not a millimetre while watched');
  assert.ok(!(e.steps > 0));
  p.h += Math.PI;
  const d0 = distance(e, p); let jumps = 0, last = { x: e.x, z: e.z };
  step(g, 2.5, () => { const moved = distance(e, last); if (moved > 1e-6) { jumps++; assert.ok(moved > 1 && moved <= ESTATUA.step[1] + 1e-6, `a stride of ${moved.toFixed(2)} m`); } last = { x: e.x, z: e.z }; });
  assert.ok(jumps >= 2, `${jumps} strides`); assert.ok(distance(e, p) < d0 - 3, 'closer');
  assert.equal(e.steps, jumps);
});

test('one of two panas looking is enough; looking away from both, it moves', () => {
  const g = library(21, 2), { p, e } = scene(g, 8), q = g.players[1];
  Object.assign(q, { x: p.x + 1.5, z: p.z });
  p.h = .3; face(q, e);   // p faces away (south), q watches
  const at = { x: e.x, z: e.z };
  step(g, 2.5);
  assert.ok(distance(e, at) < 1e-9 && e.frozen, 'frozen by the other pana');
  assert.equal(seenBy(g, e)?.id, q.id);
  q.h += Math.PI; step(g, 2);
  assert.ok(distance(e, at) > 1, 'moves once nobody looks');
});

test('a bookcase between hides it: it comes around, never through', () => {
  let tried = 0;
  for (const seed of [21, 22, 23, 24, 25]) {
    const g = library(seed), L = g.layout, run = L.run;
    const shelf = run.solids.find(s => s.kind === 'shelf' && s.axis === 'x' && s.rect[2] - s.rect[0] >= 5 && run.rooms.find(r => r.id === s.room)?.kind === 'estanterias'
      && L.walkable((s.rect[0] + s.rect[2]) / 2, s.rect[1] - 1.1, g, .5) && L.walkable((s.rect[0] + s.rect[2]) / 2, s.rect[3] + 1.1, g, .5));
    if (!shelf) continue;
    tried++;
    const mx = (shelf.rect[0] + shelf.rect[2]) / 2, p = g.players[0];
    Object.assign(p, { x: mx, z: shelf.rect[1] - 1.1 });
    const e = spawnEnemy(g, 'estatua', mx, shelf.rect[3] + 1.1); e.born = -9; face(p, e);
    assert.ok(inViewCone(watcher(p, 1.45), { x: e.x, z: e.z, y0: 0, y1: 2.1, r: .45 }), 'in the cone');
    assert.equal(seenBy(g, e), null, 'but the bookcase hides it');
    let last = { x: e.x, z: e.z };
    step(g, 6, () => {
      assert.ok(L.walkable(e.x, e.z, g, .45), 'always on open floor');
      assert.ok(L.lineClear(last, e, g, .1), 'each stride stays clear of the case');
      last = { x: e.x, z: e.z };
    });
    assert.ok(distance(e, { x: mx, z: shelf.rect[3] + 1.1 }) > 1, 'it moved');
  }
  assert.ok(tried >= 2, `${tried} stacks rooms tried`);
});

test('it strikes on contact, once, then stands still; the wind-up freezes when seen', () => {
  const g = library(), { p, e } = scene(g, 1.2);
  face(p, { x: p.x, z: p.z + 5 });   // back to it: it stands north, at smaller z
  e.cooldown = 0; step(g, .2);
  assert.ok(e.windup > 0, 'winding up');
  // Turn and look: the wind-up holds.
  face(p, e); const w = e.windup; step(g, 1);
  assert.equal(e.windup, w, 'frozen mid wind-up'); assert.equal(p.hp, 100);
  face(p, { x: p.x, z: p.z + 5 }); step(g, .8);
  assert.ok(p.hp < 100, `struck (${p.hp})`);
  const hp = p.hp; step(g, ESTATUA.pause[0] + 1);
  assert.equal(p.hp, hp, 'one hit, then it stands');
});

test('hits only stagger it: stone does not break', () => {
  const g = library(), { p, e } = scene(g, 1.6);
  face(p, e); p.invulnerable = 99;
  const hp = e.hp;
  for (let i = 0; i < 6; i++) { p.cooldown = 0; assert.ok(g.action(1, 'use', { hand: 0 }) !== false); step(g, .1); }
  assert.equal(e.hp, hp); assert.ok(e.hp > 0);
  assert.ok(g.enemies.includes(e));
});

test('placed in library rooms, never with the guardian, the camp or a seal; capped', () => {
  let placed = 0;
  for (let seed = 1; seed <= 30; seed++) for (const depth of [2, 5, 8]) {
    const run = generateRun(seed, { depth }), statues = run.sleepers.filter(s => s.kind === 'estatua');
    assert.ok(statues.length <= (depth >= 5 ? 2 : 1));
    for (const s of statues) {
      const room = run.rooms.find(r => r.id === s.room);
      assert.ok(ESTATUA_ROOMS.includes(room.kind), room.kind);
      assert.ok(!run.seals.some(q => q.room === room.id) && room.floor > 0);
    }
    placed += statues.length;
  }
  assert.ok(placed >= 90, `${placed} statues`);
  // The deal is the same every time.
  assert.deepEqual(JSON.parse(JSON.stringify(generateRun(7, { depth: 5 }).sleepers)), JSON.parse(JSON.stringify(generateRun(7, { depth: 5 }).sleepers)));
  // It stands asleep from the start of the jornada until its room is entered.
  const g = new Expedition(9); g.addPlayer(1, 'Ana'); g.start(9); g.completeLevel();
  const e = g.enemies.find(e => e.kind === 'estatua');
  assert.ok(e && !e.awake, 'there from the start, asleep');
  const stop = g.layout.run.lifts.find(l => l.floor === 1);
  for (let i = 0; i < ESTATUA_CAP + 2; i++) spawnEnemy(g, 'estatua', stop.x + i * .1, stop.z - 6);
  assert.ok(g.enemies.filter(e => e.kind === 'estatua').length <= ESTATUA_CAP);
});

test('every pose is finite for any time; the stone holds still while frozen', () => {
  for (let i = 0; i < STATUE_POSES.length; i++) for (const t of [0, .016, 1, 7.7, 1e5, NaN, -3, Infinity]) {
    const pose = statuePose(i, { t, seed: 3 });
    for (const [k, v] of Object.entries(pose)) assert.ok(Number.isFinite(v), `${i} ${t} ${k}=${v}`);
  }
  const a = { ...statuePose(2, { t: 1, seed: 4, frozen: true }) }, b = { ...statuePose(2, { t: 50, seed: 4, frozen: true }) };
  assert.deepEqual(a, b, 'frozen: the same pose whatever the time');
  assert.notDeepEqual({ ...statuePose(0, { seed: 4 }) }, { ...statuePose(3, { seed: 4 }) }, 'the poses differ');
});

test('each pose is its own body language: the head swings 30°+ and the arms move', () => {
  assert.equal(STATUE_POSE_NAMES.length, STATUE_POSES.length);
  for (const i of [...POSES.far, POSES.near, POSES.close, POSES.strike]) assert.ok(STATUE_POSES[i], `pose ${i}`);
  const head = ['headRx', 'headRy', 'spineRx'], arms = Object.keys(STATUE_POSES[0]).filter(k => /^[lr][A-Z]/.test(k));
  const most = (a, b, keys) => Math.max(...keys.map(k => Math.abs(a[k] - b[k])));
  for (const seed of [1, 2, 9]) for (let i = 0; i < STATUE_POSES.length; i++) for (let j = i + 1; j < STATUE_POSES.length; j++) {
    const a = { ...statuePose(i, { seed }) }, b = { ...statuePose(j, { seed }) };
    assert.ok(most(a, b, head) >= .5, `${STATUE_POSE_NAMES[i]} vs ${STATUE_POSE_NAMES[j]}: head or lean ${most(a, b, head).toFixed(2)} rad`);
    assert.ok(most(a, b, arms) >= .3, `${STATUE_POSE_NAMES[i]} vs ${STATUE_POSE_NAMES[j]}: arms ${most(a, b, arms).toFixed(2)} rad`);
  }
  // The book only shows in the reading pose.
  assert.deepEqual(STATUE_POSES.map(p => p.book), [0, 1, 0, 0, 0]);
});
