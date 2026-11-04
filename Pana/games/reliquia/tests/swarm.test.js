// The swarm's rules: every layout gets sensible holes, snakes stay on the floor
// and out of the nooks, bites slow without touching the walk, a machete scatters,
// a farol pushes back, and a guest can take over from one snapshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, stepExplorer } from '../public/rules.js';
import { floorOf, inRect } from '../public/deck.js';
import { SWARM, startSwarm, swarmField, swarmSize, swingAtSwarm, encodeHeads, decodeHeads, SwarmFollower, HEAD } from '../public/swarm.js';
import { VerletChains } from '../../../engine/play/verlet-chains.js';
import { scaleFor } from '../public/enemies.js';

function setup({ n = 1, seed = 4242, level = 1, options = {} } = {}) {
  const g = new Expedition(seed, options);
  for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`);
  g.start(seed);
  while (g.level < level) g.completeLevel();
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6;
  const stop = g.layout.run.lifts.find(l => l.floor === 1);
  g.players.forEach((p, i) => Object.assign(p, { x: stop.x + i * .4, z: stop.z - 5, h: Math.PI }));
  return g;
}
function step(g, seconds, inputs = new Map()) { for (let t = 0; t < seconds - 1e-4; t += .05) { g.director.duration = 1e6; g.update(.05, inputs); } }
// Past the telegraph with every snake out of its hole.
function pour(g, count) { assert.ok(startSwarm(g, 1, count), 'a swarm starts'); step(g, SWARM.telegraph + count / Math.max(SWARM.pour, count / 6) + .3); assert.equal(g.swarm.out, count); }
const points = (g, fn) => { const c = g.swarmSim.chains; for (let k = 0; k < c.total; k++) if (c.alive[(k / c.points) | 0]) fn(c.x[k], c.z[k], k); };
const heads = (g, fn) => { const c = g.swarmSim.chains; for (let i = 0; i < g.swarm.out; i++) if (c.alive[i]) fn(c.x[i * c.points], c.z[i * c.points], i); };
// A pana in the middle of an open room, a snake's crawl from nothing.
function openSpot(g) { const r = g.layout.run.rooms.filter(q => q.floor === 1 && q.w > 10 && q.d > 10).sort((a, b) => b.w * b.d - a.w * a.d); const f = swarmField(g.layout, 1, g); for (const q of r) for (let i = 0; i < 40; i++) { const x = q.x + Math.sin(i) * i * .15, z = q.z + Math.cos(i) * i * .15; if (f.at(x, z) > 2.5 && g.layout.walkable(x, z, g, .5)) return { x, z }; } throw new Error('no open room'); }

test('every jornada and place: holes in rooms a snake can cross from, on open floor', () => {
  const seen = new Set();
  for (const place of ['mina', 'biblioteca', 'alternar']) for (const seed of [1, 2, 3, 7, 99, 1234]) for (const level of [1, 2, 3, 5, 8]) {
    const g = setup({ seed, level, options: { place } }), run = g.layout.run, tag = `${place} seed ${seed} jornada ${level}`;
    assert.ok(startSwarm(g, 1, 20), `${tag}: no room for a swarm`);
    const f = swarmField(g.layout, 1, g), me = g.players[0];
    for (const hole of g.swarm.holes) {
      const room = run.rooms.find(r => r.id === hole.room);
      seen.add(room.kind);
      assert.ok(!SWARM.noHole.includes(room.kind), `${tag}: a hole in the ${room.kind}`);
      assert.ok(!room.hidden || g.revealed[room.hidden], `${tag}: a hole in a sealed room`);
      assert.ok(f.at(hole.x, hole.z) >= .4, `${tag}: a hole in the wall`);
      assert.ok(Math.hypot(hole.x - me.x, hole.z - me.z) >= 5, `${tag}: a hole at their feet`);
      assert.ok(!run.nooks.some(n => n.floor === 1 && inRect(hole.x, hole.z, n.rect)), `${tag}: a hole in a nook`);
    }
    assert.equal(new Set(g.swarm.holes.map(h => h.room)).size, g.swarm.holes.length, `${tag}: two holes in one room`);
  }
  assert.ok(seen.size >= 3, `rooms used: ${[...seen]}`);
});

test('no swarm at the camp, nor with nobody on the floor', () => {
  const g = setup();
  assert.equal(startSwarm(g, 0, 10), false);
  for (const p of g.players) p.x = 0;
  assert.equal(startSwarm(g, 1, 10), false);
  assert.equal(g.swarm, null);
});

test('the telegraph comes first: an event, then nothing moves until it ends', () => {
  const g = setup(); startSwarm(g, 1, 12);
  const e = g.events.find(q => q.kind === 'swarm');
  assert.ok(e?.holes?.length, 'the hiss knows where');
  assert.equal(e.text, '', 'and says nothing on screen');
  step(g, SWARM.telegraph - .2);
  assert.equal(g.swarm.phase, 'hiss'); assert.equal(g.swarm.out, 0);
  step(g, 1);
  assert.equal(g.swarm.phase, 'crawl'); assert.ok(g.swarm.out > 0);
});

test('snakes crawl to the nearest pana, through corridors, and stay out of the walls', () => {
  for (const options of [{ place: 'mina' }, { place: 'biblioteca' }]) {
    const g = setup({ options }), f = swarmField(g.layout, 1, g), me = g.players[0], spot = openSpot(g);
    Object.assign(me, spot, { invulnerable: 1e6 });
    pour(g, 24);
    let start = 0; heads(g, (x, z) => { start += Math.hypot(x - me.x, z - me.z); });
    for (let t = 0; t < 12; t++) {
      step(g, .5);
      points(g, (x, z, k) => assert.ok(f.at(x, z) > -.02, `${options.place}: point ${k} in a wall at ${x},${z}: ${f.at(x, z)}`));
    }
    let end = 0; heads(g, (x, z) => { end += Math.hypot(x - me.x, z - me.z); });
    assert.ok(end < start * .75, `${options.place}: closing in, ${start / 24} to ${end / 24} m`);
  }
});

test('nothing gets into a hiding nook, even with the pana inside it', () => {
  const g = setup(), run = g.layout.run, n = run.nooks.find(q => q.floor === 1), me = g.players[0];
  Object.assign(me, { x: n.mouth.x + n.nx * .9, z: n.mouth.z + n.nz * .9 });
  pour(g, 30);
  const start = me.hp;
  Object.assign(me, { x: n.mouth.x - n.nx * 1.1, z: n.mouth.z - n.nz * 1.1 });
  for (let t = 0; t < 12; t++) { step(g, .5); points(g, (x, z, k) => assert.ok(!inRect(x, z, n.inner), `point ${k} inside the nook`)); }
  assert.equal(me.hidden, n.id, 'the pana counts as hidden');
  assert.equal(me.hp, start, 'and hidden nothing bites');
});

test('a bite: small damage, a short slow, and the walk speed as it was', () => {
  const g = setup(), me = g.players[0], spot = openSpot(g);
  Object.assign(me, spot, { invulnerable: 1e6 });
  pour(g, 40); me.invulnerable = 0;
  // Bring it to them: heads right at their feet.
  const c = g.swarmSim.chains; for (let i = 0; i < 6; i++) c.place(i, me.x + .1, me.z, 1, 0, .1);
  const hp = me.hp; step(g, .1);
  assert.ok(me.hp < hp && hp - me.hp <= SWARM.bite.damage + 1e-6, `${hp} to ${me.hp}`);
  assert.ok(me.slow > 0 && me.slow <= SWARM.bite.slow, `slow ${me.slow}`);
  // Measure the walk: a slowed pana moves at exactly what the slow says, and only then.
  const walk = slow => { const p = { ...me, x: spot.x, z: spot.z, slow, vx: 0, vz: 0, stamina: 1 }; stepExplorer(p, { x: 1, z: 0 }, .05, g); return Math.hypot(p.x - spot.x, p.z - spot.z) / .05; };
  assert.ok(Math.abs(walk(0) - 4.6) < .01, `walk ${walk(0)}`);
  assert.ok(Math.abs(walk(1) - 4.6 * .6) < .01, `slowed ${walk(1)}`);
  // Even slowed you can outrun them, on the hardest setting too.
  assert.ok(SWARM.speed * scaleFor({ options: { difficulty: 'hard' } }).speed < 4.6 * .6, 'snakes are slower than a slowed pana');
  // The slow wears off once they stop reaching you.
  const hurt = me.hp; c.alive.fill(0); step(g, SWARM.bite.slow + .1);
  assert.equal(me.slow, 0); assert.equal(me.hp, hurt);
});

test('bites come no faster than their clock, and a jump clears them', () => {
  const g = setup(), me = g.players[0], spot = openSpot(g);
  Object.assign(me, spot, { invulnerable: 1e6 });
  pour(g, 20); me.invulnerable = 0; me.hp = 100;
  const c = g.swarmSim.chains, pin = () => { for (let i = 0; i < 20; i++) c.place(i, me.x + .1, me.z, 1, 0, .1); };
  let hp = me.hp; pin(); step(g, .05); assert.ok(me.hp < hp); hp = me.hp;
  for (let t = 0; t < 10; t++) { pin(); step(g, .05); }
  assert.equal(me.hp, hp, 'half a second later, no second bite');
  me.snakeBite = 0; me.jumpHeight = 1.2; pin(); hp = me.hp;
  g.swarmSim.survey(g, g.swarm); g.swarmSim.chains.step(); g.swarmSim.bite(g, g.swarm, .05);
  assert.equal(me.hp, hp, 'over their heads');
});

test('a machete scatters what is in front, far more than bare hands; they reform and come back', () => {
  const g = setup(), me = g.players[0], spot = openSpot(g), c = () => g.swarmSim.chains;
  Object.assign(me, spot, { invulnerable: 1e6, h: 0, hands: [{ id: 1, kind: 'machete' }, null] });
  pour(g, 30);
  for (let i = 0; i < 12; i++) c().place(i, me.x + (i - 6) * .15, me.z + 1.4, 0, 1, SWARM.link);
  for (let i = 12; i < 30; i++) c().place(i, me.x - 8, me.z - 8, 0, 1, SWARM.link);
  const count = () => { let n = 0; for (let i = 0; i < 30; i++) if (c().loose[i] > 0) n++; return n; };
  const hands = swingAtSwarm(g, { ...me, h: 0 }, null); const bare = count();
  for (let i = 0; i < 30; i++) { c().loose[i] = 0; c().stiff[i] = 1; }
  assert.ok(g.action(1, 'use', { hand: 0 }), 'the swing lands');
  const hit = count();
  assert.ok(hit >= 10, `machete reached ${hit}`);
  assert.ok(hands <= hit && bare <= hit);
  assert.ok(g.events.some(e => e.kind === 'snake-scatter'), 'every screen hears about it');
  assert.ok(g.events.some(e => e.kind === 'hit'));
  assert.equal(c().alive.subarray(0, 30).reduce((a, b) => a + b), 30, 'nobody died');
  step(g, SWARM.swing.seconds + 1.2);
  assert.equal(count(), 0, 'all back together');
  let longest = 0;
  for (let i = 0; i < 12; i++) for (let s = 1; s < SWARM.segments; s++) { const k = i * SWARM.segments + s; longest = Math.max(longest, Math.hypot(c().x[k] - c().x[k - 1], c().z[k] - c().z[k - 1])); }
  assert.ok(longest < SWARM.link * 1.5, `reformed, longest link ${longest}`);
});

test('a swing through a wall touches nothing', () => {
  const g = setup(), me = g.players[0];
  pour(g, 10);
  const c = g.swarmSim.chains, f = swarmField(g.layout, 1, g);
  // Stand against the shaft wall and put a snake behind it.
  Object.assign(me, { h: 0 });
  for (let d = .5; d < 3; d += .1) if (f.at(me.x, me.z + d) < 0) { for (let i = 0; i < 10; i++) c.place(i, me.x, me.z + d + 2, 0, 0, 0); break; }
  if (f.clear(me.x, me.z, me.x, me.z + 3)) return;   // Nothing behind this pana on this seed.
  assert.equal(swingAtSwarm(g, me, 'machete'), 0);
});

test('a farol pushes lit snakes back; a sun crown does it all around; the dark does not', () => {
  const run = (hand, h) => {
    const g = setup(), me = g.players[0], spot = openSpot(g);
    Object.assign(me, spot, { invulnerable: 1e6, h, hands: [hand ? { id: 1, kind: hand } : null, null] });
    pour(g, 8);
    const c = g.swarmSim.chains;
    for (let i = 0; i < 8; i++) c.place(i, me.x + (i - 4) * .25, me.z + 3, 0, 1, SWARM.link);
    const before = Math.hypot(c.x[0] - me.x, c.z[0] - me.z);
    step(g, 1.2);
    return Math.hypot(c.x[0] - me.x, c.z[0] - me.z) - before;
  };
  assert.ok(run(null, 0) < -.5, 'no light: closer');
  assert.ok(run('farol', 0) > .3, `beam on them: ${run('farol', 0)}`);
  assert.ok(run('farol', Math.PI) < -.5, 'beam the other way: closer');
  assert.ok(run('sunCrown', Math.PI) > .3, 'crown: back, whichever way you look');
});

test('they go back down their holes, the swarm ends, and it does not repeat at once', () => {
  const g = setup(), me = g.players[0], spot = openSpot(g);
  Object.assign(me, spot, { invulnerable: 1e6 });
  pour(g, 12);
  step(g, SWARM.crawl + SWARM.retreat + 1);
  assert.equal(g.swarm, null);
  assert.equal(g.swarmSim, null);
  assert.ok(g.swarmAt > g.time + SWARM.rest - SWARM.crawl - SWARM.retreat - 2, 'and it rests first');
  assert.equal(startSwarm(g, 1, 12), true, 'a forced one is still welcome');
});

test('everyone up the lift: the snakes go home', () => {
  const g = setup(), me = g.players[0];
  pour(g, 12);
  me.x = 0; me.z = 6;
  step(g, .1);
  assert.equal(g.swarm.phase, 'retreat');
  step(g, SWARM.retreat + 1);
  assert.equal(g.swarm, null);
});

test('the Director sends it now and then, and only after the first stretch', () => {
  const g = setup(), me = g.players[0];
  Object.assign(me, openSpot(g), { invulnerable: 1e6 });
  g.director = { phase: 'build', time: 0, duration: 0, spawnIn: 0, waves: 0 };
  for (let t = 0; t < 40; t += .05) { me.hp = 100; g.update(.05); }
  assert.equal(g.swarm, null, 'too early');
  let saw = null;
  for (let t = 0; t < 600 && !saw; t += .05) { me.hp = 100; if (g.director.phase === 'rest') g.director.time = 1e3; g.update(.05); saw = g.swarm; }
  assert.ok(saw, 'ten minutes on, one came');
  assert.ok(saw.total >= 20 && saw.total <= SWARM.most, `${saw.total} snakes`);
  assert.ok(swarmSize(g) <= SWARM.most);
});

test('a new jornada leaves no snakes behind', () => {
  const g = setup(); pour(g, 8);
  g.completeLevel();
  assert.equal(g.swarm, null); assert.equal(g.swarmSim, null);
  assert.equal(g.snapshot().swarmSim, undefined);
  step(g, .2);
});

test('snapshots are plain JSON and small; the simulation stays out', () => {
  const g = setup(); pour(g, SWARM.most); step(g, .3);
  const snap = g.snapshot();
  assert.equal(snap.swarmSim, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(snap.swarm)), snap.swarm);
  assert.equal(snap.swarm.heads.length, SWARM.most * 5, 'five characters a head');
  const before = snap.swarm.heads;
  g.update(.02);
  assert.equal(g.snapshot().swarm.heads, before, 'heads travel a few times a second, not every tick');
  step(g, SWARM.headsEvery + .1);
  assert.notEqual(g.snapshot().swarm.heads, before);
});

test('the wire round-trips positions to 1/16 m and the flags', () => {
  const chains = new VerletChains({ chains: 4, points: 3, rest: .1 });
  chains.place(0, 220.3, -40.7); chains.place(2, 280.9, 60.2); chains.loose[2] = 1;
  const text = encodeHeads(chains, 4, 200, -110), x = new Float32Array(4), z = new Float32Array(4), flags = new Uint8Array(4);
  assert.equal(text.length, 20);
  assert.equal(decodeHeads(text, 200, -110, x, z, flags), 4);
  assert.ok(Math.abs(x[0] - 220.3) < 1 / 16 && Math.abs(z[0] + 40.7) < 1 / 16);
  assert.ok(Math.abs(x[2] - 280.9) < 1 / 16 && Math.abs(z[2] - 60.2) < 1 / 16);
  assert.deepEqual([...flags], [HEAD.alive, 0, HEAD.alive | HEAD.loose, 0]);
});

test('host migration: a new host rebuilds the swarm from one snapshot and carries on', () => {
  const g = setup({ n: 2 }), [a, b] = g.players;
  Object.assign(a, openSpot(g), { invulnerable: 1e6 }); Object.assign(b, { x: a.x + 1, z: a.z, invulnerable: 1e6 });
  pour(g, 30); step(g, 1);
  const snap = JSON.parse(JSON.stringify(g.snapshot())), wasOut = snap.swarm.out, x = new Float32Array(30), z = new Float32Array(30), flags = new Uint8Array(30);
  decodeHeads(snap.swarm.heads, snap.swarm.ox, snap.swarm.oz, x, z, flags);
  const next = new Expedition(snap.seed, snap.options);
  next.restore(snap, new Map([[2, { id: 2, name: 'Pana 2' }]]));
  assert.equal(next.swarmSim, null);
  next.update(.05);
  assert.ok(next.swarmSim, 'rebuilt');
  assert.equal(next.swarm.out, wasOut);
  const c = next.swarmSim.chains;
  for (let i = 0; i < 30; i++) {
    assert.equal(c.alive[i], flags[i] & HEAD.alive, `snake ${i} alive as it was`);
    if (c.alive[i]) assert.ok(Math.hypot(c.x[i * c.points] - x[i], c.z[i * c.points] - z[i]) < .6, `snake ${i} near where it was`);
  }
  step(next, 4);
  assert.ok(next.swarm, 'still going');
  let closest = Infinity; for (let i = 0; i < 30; i++) if (c.alive[i]) closest = Math.min(closest, Math.hypot(c.x[i * c.points] - b.x, c.z[i * c.points] - b.z));
  assert.ok(closest < 24, `still after the one who is left: ${closest}`);
});

test('a client simulates bodies from heads alone: they land where the host has them', () => {
  const g = setup(), me = g.players[0], f = swarmField(g.layout, 1, g);
  Object.assign(me, openSpot(g), { invulnerable: 1e6 });
  pour(g, 25);
  const follower = new SwarmFollower();
  for (let t = 0; t < 120; t++) { step(g, .05); follower.sync(JSON.parse(JSON.stringify(g.swarm)), g.layout, g); follower.advance(.05, g.layout, g.swarm, g); }
  const host = g.swarmSim.chains, mine = follower.chains;
  assert.equal(mine.points, host.points);
  let far = 0, stretched = 0;
  for (let c = 0; c < 25; c++) {
    assert.equal(mine.alive[c], host.alive[c]);
    far = Math.max(far, Math.hypot(mine.x[c * mine.points] - host.x[c * host.points], mine.z[c * mine.points] - host.z[c * host.points]));
    for (let s = 1; s < mine.points; s++) { const k = c * mine.points + s; stretched = Math.max(stretched, Math.hypot(mine.x[k] - mine.x[k - 1], mine.z[k] - mine.z[k - 1])); assert.ok(f.at(mine.x[k], mine.z[k]) > -.02, 'and out of the walls'); }
  }
  assert.ok(far < 1.5, `heads stay close to the host's: ${far} m`);
  assert.ok(stretched < SWARM.link * 3, `bodies hold together: ${stretched}`);
  // A swing seen on this screen, from the event alone.
  assert.ok(follower.scatter({ x: mine.x[0], z: mine.z[0], r: 2, px: mine.x[0], pz: mine.z[0] }) >= 1);
  assert.equal(floorOf(mine.x[0]), 1);
});

test('a tunnel that falls in or a wall that opens remakes the map', () => {
  const g = setup(), run = g.layout.run, a = swarmField(g.layout, 1, g);
  assert.equal(swarmField(g.layout, 1, g), a, 'the same ground is baked once');
  const c = run.corridors.find(q => q.floor === 1), mid = { x: (c.rect[0] + c.rect[2]) / 2, z: (c.rect[1] + c.rect[3]) / 2 };
  assert.ok(a.at(mid.x, mid.z) > 0);
  g.rubble[c.id] = 0;
  const b = swarmField(g.layout, 1, g);
  assert.notEqual(b, a);
  assert.ok(b.at(mid.x, mid.z) < 0, 'rubble is solid');
  delete g.rubble[c.id];
  assert.ok(swarmField(g.layout, 1, g).at(mid.x, mid.z) > 0, 'and clear again once dug out');
});
