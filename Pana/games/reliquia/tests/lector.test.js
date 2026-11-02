// El Lector (games/reliquia/public/lector.js): blind, it hunts by ear. Quiet
// panas walk past it; running, jumping, a thrown book, a search or a fight
// bring it; it claws whoever it bumps into or whoever is noisy in its reach;
// the farol does nothing to it; the Sustos setting never changes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction, spotFront, NOISE } from '../public/rules.js';
import { spawnEnemy, lightOn, lectorCap } from '../public/enemies.js';
import { LECTOR } from '../public/lector.js';
import { generateRun, LECTOR_ROOMS } from '../public/deck.js';
import { distance } from '../public/layout.js';
import { pressJump } from '../../../engine/play/jump.js';

// A library jornada with every room already awake and nothing else hunting.
function library(seed = 21, players = 1) {
  const g = new Expedition(seed); for (let i = 1; i <= players; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed); g.completeLevel();
  assert.equal(g.layout.run.theme, 'biblioteca');
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.enemies = [];
  return g;
}
const calm = g => { g.director.phase = 'rest'; g.director.time = 0; g.director.duration = 999; };
function step(g, seconds, inputs = () => new Map(), each = () => {}) {
  for (let t = 0; t < seconds - 1e-4; t += .05) { calm(g); g.update(.05, inputs(t)); each(t); }
}
// An open stretch of the entrance room: the pana in front of the lift, the Lector further in.
function scene(g, gap = 6) {
  const stop = g.layout.run.lifts.find(l => l.floor === 1), p = g.players[0];
  Object.assign(p, { x: stop.x, z: stop.z - 5, h: Math.PI, pitch: 0 });
  const e = spawnEnemy(g, 'lector', stop.x, stop.z - 5 - gap); assert.ok(e, 'a Lector spawns');
  e.born = -9; e.pause = 99;   // it stands where it is unless something calls it
  return { p, e, stop };
}
const north = { x: 0, z: -1 }, still = () => new Map();

test('a still pana and a walking one are not heard, even passing close', () => {
  const g = library(), { p, e } = scene(g, 2.2);
  const at = { x: e.x, z: e.z };
  step(g, 3, still);
  assert.equal(e.mode, 'prowl'); assert.equal(p.hp, 100);
  assert.ok(distance(e, at) < .01, 'it did not move');
  // Walk across in front of it, 1.6 m away, without running.
  Object.assign(p, { x: e.x - 3, z: e.z + 1.6 });
  step(g, 1.2, () => new Map([[1, { x: 1, z: 0, h: Math.PI / 2 }]]), () => assert.notEqual(e.mode, 'listen', 'walking is silent'));
  assert.ok(p.x > e.x + 1, 'walked past it'); assert.equal(p.hp, 100); assert.equal(e.windup, 0);
  assert.ok(!g.noise.list.length, 'no noise at all');
});

test('running is heard: it stops to listen, then homes in on the spot', () => {
  const g = library(), { p, e } = scene(g, 8);
  const x0 = p.x, z0 = p.z, spot = { x: e.x, z: e.z };
  step(g, .3, () => new Map([[1, { ...north, x: 0, z: 1, sprint: true }]]));
  assert.ok(g.noise.list.some(n => n.kind === 'run'), 'a run noise');
  assert.equal(e.mode, 'listen', 'the tell: it stops dead');
  assert.ok(distance(e, spot) < .01, 'standing still while it listens');
  assert.ok(Math.abs(e.look) > 0 || Math.abs(Math.atan2(x0 - e.x, z0 - e.z) - e.h) < .05, 'head turned toward the noise');
  const before = distance(e, { x: x0, z: z0 });
  step(g, LECTOR.listen + .1);
  assert.equal(e.mode, 'hunt');
  step(g, 1);
  assert.ok(distance(e, { x: e.goalX, z: e.goalZ }) < before - 2, 'closing on the noise');
});

test('jumping, a thudding book and a search all make noise', () => {
  const g = library(), { p } = scene(g, 12);
  // A jump: the landing is loud.
  step(g, 1.2, () => new Map([[1, { jump: pressJump(0) }]]));
  assert.ok(g.noise.list.some(n => n.kind === 'land' && n.source === 1), 'landing');
  // A book thrown on the boards.
  p.hands[0] = { id: 999001, kind: 'oldBook' };
  assert.ok(g.action(1, 'throw', {}));
  step(g, 1.5);
  const book = g.noise.list.find(n => n.kind === 'book');
  assert.ok(book && book.radius > NOISE.drop * NOISE.book, `a book thud (${book?.radius})`);
  // A search in progress.
  let searched = false;
  for (const sp of g.layout.run.spots) {
    const front = spotFront(sp), x = front.x + Math.sin(sp.h) * .5, z = front.z + Math.cos(sp.h) * .5;
    if (!g.layout.walkable(x, z, g, .42)) continue;
    Object.assign(p, { x, z, h: Math.atan2(sp.x - x, sp.z - z), pitch: -.35 });
    const t = interaction(g, p); if (t?.kind !== 'search' || t.id !== sp.id) continue;
    step(g, .2, () => new Map([[1, { hold: true }]]));
    searched = g.noise.list.some(n => n.kind === 'search' && n.source === 1); break;
  }
  assert.ok(searched, 'searching is heard');
});

test('a thrown book lures it away from a quiet pana', () => {
  const g = library(), { p, e } = scene(g, 6);
  p.hands[0] = { id: 999002, kind: 'oldBook' };
  // Throw it to the side, then stand still.
  p.h = Math.PI / 2; assert.ok(g.action(1, 'throw', {}));
  step(g, 1);
  const thud = g.noise.list.find(n => n.kind === 'book'); assert.ok(thud, 'it landed with a thud');
  assert.ok(['listen', 'hunt'].includes(e.mode));
  step(g, 6);
  assert.ok(Math.hypot(e.x - thud.x, e.z - thud.z) < 3.5, `it went to the book (${Math.hypot(e.x - thud.x, e.z - thud.z).toFixed(1)} m)`);
  assert.equal(p.hp, 100, 'the quiet pana was left alone');
});

test('it claws a noisy pana in reach and anyone it bumps into', () => {
  const g = library(), { p, e } = scene(g, 1.4);
  step(g, 1.5, () => new Map([[1, { x: 0, z: 0, sprint: true, jump: pressJump(0) }]]));
  // Noisy within reach: jump and land beside it.
  assert.ok(p.hp < 100, `a noisy pana is hit (${p.hp})`);
  const g2 = library(), s2 = scene(g2, .9);
  step(g2, 1.5, still);
  assert.ok(s2.p.hp < 100, 'bumping into it is enough');
  assert.ok(100 - s2.p.hp > 12 * .75, 'it hits harder than a mummy');
});

test('the farol does nothing to it; a hit staggers it', () => {
  const g = library(), { p, e } = scene(g, 5);
  p.hands[0] = { id: 999003, kind: 'farol' };
  step(g, .3, () => new Map([[1, { x: 0, z: 1, sprint: true }]]));
  step(g, 1.2);
  assert.notEqual(e.frozen, true); assert.equal(e.mode, 'hunt', 'it comes through the beam');
  assert.equal(lightOn(g, e), 'beam'); assert.equal(e.lit, 'dark', 'it ignores the light');
  e.stun = 1; const at = { x: e.x, z: e.z }; step(g, .5);
  assert.ok(distance(e, at) < .01, 'stunned, it stands');
});

test('Sustos never changes what it does', () => {
  const runWith = mode => {
    const store = new Map([['pana:reliquia:sustos', mode]]);
    globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const g = library(33), { e } = scene(g, 7);
    step(g, 4, t => new Map([[1, t < 1 ? { x: 0, z: 1, sprint: true } : {}]]));
    delete globalThis.localStorage;
    return JSON.stringify([e.x, e.z, e.mode, g.players[0].hp]);
  };
  assert.equal(runWith('normal'), runWith('apagados'));
  assert.equal(runWith('normal'), runWith('suaves'));
});

test('the library deals Lectores into its shelves and archives, capped; the mine none', () => {
  let dealt = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (const depth of [1, 3, 4]) assert.ok(!generateRun(seed, { depth }).sleepers.some(s => s.kind === 'lector' || s.kind === 'estatua'), 'none in the mine');
    for (const depth of [2, 5]) {
      const run = generateRun(seed, { depth }), lectores = run.sleepers.filter(s => s.kind === 'lector');
      assert.ok(lectores.length <= lectorCap(depth), `${lectores.length} on jornada ${depth}`);
      for (const s of lectores) assert.ok(LECTOR_ROOMS.includes(run.rooms.find(r => r.id === s.room).kind));
      dealt += lectores.length;
    }
  }
  assert.ok(dealt > 30, `${dealt} dealt`);
  const g = library();
  const stop = g.layout.run.lifts.find(l => l.floor === 1);
  assert.ok(spawnEnemy(g, 'lector', stop.x, stop.z - 8));
  assert.equal(spawnEnemy(g, 'lector', stop.x, stop.z - 10), null, 'one at a time on jornada 2');
});
