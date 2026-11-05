// Playtest fixes: fear wears off, the hands-full prompt says what to do, the
// end of a jornada is short and bats are few.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction } from '../public/rules.js';
import { spawnEnemy, lightOn, BRAVE } from '../public/enemies.js';
import { SPECIES, BODIES } from '../public/ecology.js';
import { say } from '../public/items.js';
import { TRUCK } from '../public/deck.js';

function setup(seed = 4242) {
  const g = new Expedition(seed, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.start(seed);
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6; g.sucesoIn = 1e6; g.collapseIn = 1e6; g.swarmAt = 1e9; g.enemies = [];
  return g;
}
const step = (g, seconds, each = () => {}) => { for (let t = 0; t < seconds - 1e-4; t += .05) { g.director.duration = 1e6; g.sucesoIn = 1e6; g.collapseIn = 1e6; g.update(.05, new Map()); each(); } };
// A pana in the entrance hall with a farol, and a creature six metres off.
function lit(g, kind, extra = {}) {
  const stop = g.layout.run.lifts.find(l => l.floor === 1), p = g.players[0];
  Object.assign(p, { x: stop.x, z: stop.z - 2, h: Math.PI, hands: [{ id: 1, kind: 'farol' }, null], hp: 100 }); g.lift.floor = 1; g.deepest = 1;
  const e = spawnEnemy(g, kind, p.x, p.z - 6, { born: -9, ...extra }); assert.ok(e, `${kind} spawned`);
  return { p, e, aim: () => { p.h = Math.atan2(e.x - p.x, e.z - p.z); } };
}

test('a mummy held in the beam breaks free, comes on and hits', () => {
  const g = setup(), { p, e, aim } = lit(g, 'mummy'); aim(); step(g, .2, aim);
  assert.equal(lightOn(g, e), 'beam'); assert.equal(e.frozen, true, 'at first the beam holds it');
  const z = e.z; step(g, BRAVE.after - 1, aim); assert.ok(Math.abs(e.z - z) < .01, 'still held');
  step(g, BRAVE.lasts + 2, aim);
  assert.ok(p.hp < 100, `it reached the pana through the beam: hp ${p.hp}`);
});

test('a flare holds it for good: nothing gets used to one', () => {
  const g = setup(), { p, e } = lit(g, 'mummy'); p.hands = [null, null];
  g.flares = [{ id: 1, x: e.x + 2, z: e.z, y: 0, vx: 0, vy: 0, vz: 0, life: 1e6 }];
  const z = e.z; step(g, BRAVE.after + BRAVE.lasts, () => { g.flares[0].life = 1e6; });
  assert.equal(e.frozen, true); assert.ok(Math.abs(e.z - z) < .01, 'never moved');
});

test('a bat scattered by the beam comes back and bites with the beam still on it', () => {
  const g = setup(), { p, e, aim } = lit(g, 'bat', { hanging: false, y: 2 }); aim();
  const start = Math.hypot(e.x - p.x, e.z - p.z), seen = new Set(); let far = 0;
  step(g, 12, () => { aim(); far = Math.max(far, Math.hypot(e.x - p.x, e.z - p.z)); for (const v of g.events) if (v.kind === 'scatter') seen.add(v.id); });
  assert.ok(far > start, `it did flee: ${far}`); assert.ok(p.hp < 100, `it bit: hp ${p.hp}`);
  assert.ok(seen.size <= 3, `it does not scatter on a loop: ${seen.size}`);
});

test('a bat of the food chain does not forget you once scared off', () => {
  const g = setup(), { p, e, aim } = lit(g, 'bat', { hanging: false, y: 2, eco: 9999, sight: 0, hearing: 0, pace: 1, siteX: 0, siteZ: 0 });
  e.seenT = 5; aim(); step(g, 12, aim);
  assert.ok(p.hp < 100, `hp ${p.hp}`);
});

test('hands full, the prompt names what you hold and how to drop it', () => {
  const g = setup(), p = g.players[0]; Object.assign(p, { x: -2, z: 14, h: 0, pitch: -.5, hands: [{ id: 1, kind: 'farol' }, { id: 2, kind: 'mask', worth: 1 }] });
  g.items = [{ id: 77, kind: 'cup', x: -2, z: 15.2, y: 0, state: 'ground', carriers: [], worth: 1 }];
  const t = interaction(g.snapshot(), p); assert.equal(t?.kind, 'pick');
  const text = say(t.text, t.vars); assert.match(text, /farol/i); assert.match(text, /máscara/i); assert.match(text, /Q suelta farol/i);
});

test('the ride home with the quota met, and leaving, are short', () => {
  const g = setup(), stop = g.layout.run.lifts.find(l => l.floor === 1);
  Object.assign(g.players[0], { x: stop.x, z: stop.z }); g.lift.floor = 1; g.deepest = 1; g.delivered = g.quota; const level = g.level;
  g.depart(0, true); assert.ok(g.lift.duration <= 2.5, `ride ${g.lift.duration}`);
  step(g, g.lift.duration + .1); assert.equal(g.level, level + 1, 'the next jornada is dealt');
  const q = setup(); q.delivered = 0; q.lift.floor = 1; Object.assign(q.players[0], { x: stop.x, z: stop.z }); q.depart(0, true);
  assert.ok(q.lift.duration > 4, 'without the quota the ride is the long one');
  const l = setup(); Object.assign(l.players[0], { x: TRUCK.x + 3, z: TRUCK.z, h: -Math.PI / 2, pitch: 0 }); l.haul = 10;
  for (let t = 0; t < 1.7; t += .05) { l.director.duration = 1e6; l.update(.05, new Map([[1, { hold: true }]])); }
  assert.equal(l.phase, 'results');
});

test('bats are few, on the map and in the air', () => {
  assert.ok(SPECIES.bat.cap <= 10); assert.ok(BODIES.bat <= 3);
  for (const seed of [11, 22, 33, 44, 55]) {
    const g = setup(seed); assert.ok((g.eco?.counts.bat || 0) <= SPECIES.bat.cap);
    const f = g.layout.run.rooms.find(r => r.floor === 1); g.players[0].x = f.x; g.players[0].z = f.z;
    let most = 0;
    for (let i = 0; i < 40; i++) { g.wave(1, 3); most = Math.max(most, g.enemies.filter(e => e.kind === 'bat' && e.eco == null).length); g.enemies = []; }
    assert.ok(most <= 2, `waves bring at most two: ${most}`);
  }
});
