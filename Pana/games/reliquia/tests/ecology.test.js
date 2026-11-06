// Fosa's food chain: where it lives on the map, who a body is, who hides, what a
// wipe does to the floor, and that it all survives a snapshot and a new host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { layoutFor } from '../public/layout.js';
import { THEMES } from '../public/deck.js';
import { spawnEnemy, lightOn } from '../public/enemies.js';
import { BODIES, COVER, SPECIES, attention, crowdRoost, ecoWorldFor, glowNear, hiddenFrom, wipeSpecies } from '../public/ecology.js';
import { SILBON } from '../public/silbon.js';
import { advanceEcosystem, coverOf, dimmed, removeCreature } from '../../../engine/ai/ecosystem.js';
import { diffState, patchState } from '../../../engine/state-delta.js';

function setup({ seed = 4242, place = 'mina', players = 1 } = {}) {
  const g = new Expedition(seed, { difficulty: 'normal', place }); for (let i = 1; i <= players; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed);
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6; for (const p of g.players) p.invulnerable = 1e6;
  return g;
}
const step = (g, seconds, each) => { for (let t = 0; t < seconds; t += .05) { g.update(.05); each?.(); } };
const W = g => ecoWorldFor(g.layout);
const firstSite = (g, kind) => W(g).sites.find(s => s.kind === kind);
const stand = (g, q, id = 1) => { Object.assign(g.players.find(p => p.id === id), { x: q.x, z: q.z, y: 0 }); };
const bodies = g => g.enemies.filter(e => e.eco != null);

test('every jornada deals walkable hiding patches, a roost, and the same map to everyone', () => {
  for (const theme of THEMES) for (const depth of [1, 2, 5]) for (const seed of [7, 99, 4242]) {
    const L = layoutFor(seed, depth, theme), sites = L.run.ecoSites, tag = `${theme}/${depth}/${seed}`;
    assert.ok(sites.filter(s => s.kind === 'mushroom').length >= 2, `${tag}: mushrooms`);
    assert.ok(sites.some(s => s.kind === 'roots'), `${tag}: roots`);
    assert.ok(sites.some(s => s.kind === 'roost'), `${tag}: a roost`);
    for (const s of sites.filter(q => q.hides)) {
      assert.ok(L.walkable(s.x, s.z, {}, .42), `${tag}: ${s.kind} at ${s.x},${s.z} can be walked into`);
      assert.ok(!L.overPit(s.x, s.z), `${tag}: not over a pit`);
      const room = L.run.rooms.find(r => r.id === s.room);
      assert.ok(room && !room.hidden && room.kind !== 'entrada' && room.kind !== 'boveda', `${tag}: in a public room`);
    }
  }
  assert.deepEqual(layoutFor(5, 2, 'mina').run.ecoSites, layoutFor(5, 2, 'mina').run.ecoSites);
});

test('a jornada starts with a living chain, mid-story, and a new one starts over', () => {
  const g = setup();
  assert.ok(g.eco.t >= 100, 'simulated before anyone arrives');
  assert.ok(g.eco.counts.bat + g.eco.counts.snake > 0);
  const before = g.eco;
  g.completeLevel();
  assert.notEqual(g.eco, before); assert.equal(g.level, 2);
  assert.ok(W(g).sites.length, 'the new floor has its sites');
});

test('the deeper the founders, the less they see and the more they hear', () => {
  const at = level => {
    let sum = 0, n = 0;
    for (const seed of [11, 22, 33, 44]) { const g = new Expedition(seed, { place: 'mina' }); g.addPlayer(1, 'A'); g.start(seed); for (let i = 1; i < level; i++) g.completeLevel(); for (const c of g.eco.pop) if (c.sp === 'bat') { sum += c.sight; n++; } }
    return sum / (n || 1);
  };
  assert.ok(at(6) < at(1) * .6, `${at(6)} vs ${at(1)}`);
});

test('a creature only gets a body near a pana, in a woken room, under the caps', () => {
  const g = setup(); wipeSpecies(g, 'snake');
  const roost = firstSite(g, 'roost'); crowdRoost(g, { x: roost.x, z: roost.z }, 30);
  stand(g, { x: 0, z: 3 }); step(g, 2.2);
  assert.equal(bodies(g).length, 0, 'nobody is near up at the camp');
  stand(g, roost); step(g, 2.2);
  const n = bodies(g).filter(e => e.kind === 'bat').length;
  assert.ok(n > 0, 'the crowd around you has bodies'); assert.ok(n <= BODIES.bat, `at most ${BODIES.bat}: ${n}`);
  for (const e of bodies(g)) assert.ok(g.eco.pop.some(c => c.id === e.eco && c.body === e.id));
  // Far from everyone they are numbers again, and alive.
  const alive = g.eco.counts.bat; stand(g, { x: 0, z: 3 }); step(g, 2.2);
  assert.equal(bodies(g).length, 0); assert.ok(g.eco.counts.bat >= alive - 3 && g.eco.pop.every(c => !c.body));
});

test('killing a body kills the creature; killing the last one says so', () => {
  const g = setup(); wipeSpecies(g, 'snake');
  const roost = firstSite(g, 'roost'); crowdRoost(g, roost, 3); stand(g, roost); step(g, 1.5);
  const target = bodies(g)[0]; assert.ok(target, 'a body');
  const before = g.eco.counts.bat, id = target.eco; target.hp = 0; step(g, 1.2);
  assert.ok(!g.eco.pop.some(c => c.id === id)); assert.ok(g.eco.counts.bat <= before);
  wipeSpecies(g, 'bat'); step(g, .1);
  assert.equal(g.eco.counts.bat, 0); assert.ok(g.events.some(e => e.kind === 'eco' && e.eco === 'gone' && e.sp === 'bat'));
});

test('quiet in a thicket or the roots, a pana is hidden until something is on top of them', () => {
  const g = setup(), patch = firstSite(g, 'mushroom'), roots = firstSite(g, 'roots'), p = g.players[0];
  // A patch the moths have not eaten down: how much of it is left is what hides you.
  step(g, .05); g.eco.food[W(g).sites.indexOf(patch)] = 1;
  stand(g, patch); step(g, .1); assert.ok(p.covered, 'covered among the mushrooms');
  stand(g, roots); step(g, .1); assert.ok(p.covered, 'covered in the roots');
  const bat = { kind: 'bat', x: p.x + 8, z: p.z }, mummy = { kind: 'mummy', x: p.x + 8, z: p.z };
  assert.ok(hiddenFrom(g, bat, p)); assert.ok(!hiddenFrom(g, mummy, p), 'mummies go by smell');
  assert.ok(!hiddenFrom(g, { kind: 'bat', x: p.x + COVER.feel - .3, z: p.z }, p), 'not at arm\'s length');
  g.noisy('run', p, p.id); assert.ok(!hiddenFrom(g, bat, p), 'not while making noise');
  stand(g, { x: 0, z: 3 }); step(g, .1); assert.ok(!p.covered);
});

test('a stripped patch hides nobody, lights nothing, and roots still do', () => {
  const g = setup(), i = W(g).sites.findIndex(s => s.kind === 'mushroom'), patch = W(g).sites[i], p = g.players[0];
  g.eco.food[i] = 1; stand(g, patch); step(g, .1); assert.ok(p.covered);
  assert.ok(glowNear(g, patch), 'a healthy patch is light, for a mummy');
  g.eco.food[i] = .05; step(g, .1);
  assert.ok(!p.covered); assert.ok(coverOf(g.eco, W(g), i) < .2); assert.ok(!glowNear(g, patch));
  g.suceso = { kind: 'apagon', t: 99 }; // No torches: only the patch is left to light it.
  const m = spawnEnemy(g, 'mummy', patch.x, patch.z, { born: -9 }); g.eco.food[i] = 1; assert.equal(lightOn(g, m), 'glow'); g.eco.food[i] = .05; assert.equal(lightOn(g, m), 'dark');
});

test('El Silbón does not see a quiet pana in cover, but hears one and feels one', () => {
  const g = setup(), patch = firstSite(g, 'mushroom'), p = g.players[0]; g.eco.food[W(g).sites.indexOf(patch)] = 1;
  stand(g, patch); step(g, .1);
  const spot = [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4]].map(([x, z]) => ({ x: patch.x + x, z: patch.z + z })).find(q => g.layout.walkable(q.x, q.z, g, .8) && g.layout.sightClear(q, p, g)); assert.ok(spot, 'room to stand');
  const boss = spawnEnemy(g, 'silbon', spot.x, spot.z, { born: -9, mode: 'wander', wx: spot.x, wz: spot.z, wUntil: 1e9, pause: 99 });
  g.update(.05); assert.notEqual(boss.mode, 'chase', 'hidden: it does not chase');
  Object.assign(p, { x: spot.x + 1, z: spot.z }); g.update(.05); assert.equal(boss.mode, 'chase', 'out in the open it does');
  assert.ok(SILBON.sight < 20, 'and its eyes are short now');
});

test('a body lives its life until it notices someone, mostly by ear and up close', () => {
  const g = setup(); wipeSpecies(g, 'snake'); const roost = firstSite(g, 'roost');
  const open = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([x, z]) => ({ x: roost.x + x, z: roost.z + z })).find(q => g.layout.walkable(q.x, q.z, g, .5)) || roost;
  const bat = spawnEnemy(g, 'bat', open.x, open.z, { eco: 9999, born: -9, hanging: false, sight: 3, hearing: 12, pace: 1, siteX: open.x, siteZ: open.z }), p = g.players[0];
  stand(g, { x: open.x + 8, z: open.z });
  assert.equal(attention(g, bat, p, .05), null, 'beyond its eyes, quiet: nothing');
  g.noisy('run', p, p.id); assert.equal(attention(g, bat, p, .05), p, 'noisy within its ears');
  g.noise = { list: [], last: {} }; bat.seenT = 0;
  stand(g, { x: open.x + 1.5, z: open.z }); assert.equal(attention(g, bat, p, .05), p, 'right next to it');
  // Far beyond its ears a noise means nothing.
  stand(g, { x: open.x + 30, z: open.z }); g.noisy('run', p, p.id); bat.seenT = 0;
  assert.equal(attention(g, bat, p, .05), null);
});

test('a screech still lures El Silbón: the bait is still there while there are bats', () => {
  const g = setup(), roost = firstSite(g, 'roost');
  const bat = spawnEnemy(g, 'bat', roost.x, roost.z, { eco: 9998, born: -9, hanging: true, perch: true, hearing: 12, sight: 4, siteX: roost.x, siteZ: roost.z });
  g.noisy('shot', bat, 1); g.update(.05);
  assert.equal(bat.hanging, false); assert.ok(g.events.some(e => e.kind === 'screech'));
});

test('wipe the bats: moths strip the mushrooms, the team is told, the hiding is gone and no bats in waves', () => {
  const g = setup(); wipeSpecies(g, 'bat');
  const patch = firstSite(g, 'mushroom'), p = g.players[0], W0 = W(g); stand(g, patch);
  const before = g.eco.glow ?? 100;
  step(g, 180);
  assert.ok(dimmed(g.eco, W0) >= .5, `stripped: ${dimmed(g.eco, W0)}`); assert.ok(g.eco.glow < before || g.eco.glow < 50, `glow ${g.eco.glow}`);
  assert.ok(g.eco.moths > 25, `moths ${g.eco.moths}`);
  assert.ok(g.eco.said.dim, 'the team was told once');
  const bare = W0.sites.find((q, i) => q.plant && coverOf(g.eco, W0, i) < COVER.least); assert.ok(bare, 'a thicket was stripped'); stand(g, bare); step(g, .1);
  assert.ok(!p.covered, 'that thicket hides nobody now');
  const count = g.events.filter(e => e.kind === 'eco' && e.eco === 'dim').length; assert.ok(count <= 1);
  g.director.duration = 1e6;
  for (let i = 0; i < 12; i++) { const n = g.enemies.length; g.wave(1, 2); for (const e of g.enemies.slice(n)) assert.notEqual(e.kind, 'bat'); g.enemies.length = n; }
});

test('wipe the cuaimas: over the seeds, the floor holds more bats, and a crowd says so', () => {
  let without = 0, withThem = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const a = setup({ seed: seed * 97 }), b = setup({ seed: seed * 97 }); wipeSpecies(a, 'snake');
    const Wa = W(a), Wb = W(b), keep = g => { for (const c of g.eco.pop) c.age = Math.min(c.age, 200); };
    for (let t = 0; t < 240; t++) { advanceEcosystem(a.eco, Wa, 1); advanceEcosystem(b.eco, Wb, 1); keep(a); keep(b); }
    without += a.eco.counts.bat; withThem += b.eco.counts.bat;
  }
  assert.ok(without > withThem, `${without} vs ${withThem}`);
  const g = setup(); wipeSpecies(g, 'snake'); const roost = firstSite(g, 'roost'); crowdRoost(g, roost, 20); stand(g, roost); step(g, 2.2);
  assert.ok(g.eco.said.boom, 'the team is told'); assert.ok(g.events.some(e => e.eco === 'boom') || g.eco.said.boom);
  assert.ok(bodies(g).some(e => e.touchy), 'a crowded roost is touchy');
});

test('a farol\'s beam drives moths off a patch', () => {
  const g = setup(), i = W(g).sites.findIndex(s => s.kind === 'mushroom'), s = W(g).sites[i], p = g.players[0];
  const spot = [[4, 0], [-4, 0], [0, 4], [0, -4]].map(([x, z]) => ({ x: s.x + x, z: s.z + z })).find(q => g.layout.lineClear(q, s, g, .1)); assert.ok(spot);
  stand(g, spot); p.hands[0] = { id: 1, kind: 'farol' }; p.h = Math.atan2(s.x - p.x, s.z - p.z);
  g.eco.pests[i] = .8; for (let t = 0; t < 2.1; t += .05) { g.update(.05); p.h = Math.atan2(s.x - p.x, s.z - p.z); }
  assert.ok(g.eco.pests[i] < .6, `pests ${g.eco.pests[i]}`);
});

test('the Director keeps its own cap: bodies do not crowd out its waves', () => {
  const g = setup(), s = firstSite(g, 'roost');
  for (let i = 0; i < 18; i++) assert.ok(spawnEnemy(g, 'bat', s.x, s.z, { eco: 5000 + i }));
  assert.ok(spawnEnemy(g, 'mummy', s.x, s.z), 'a mummy still fits');
});

test('it all travels: deltas patch to the same state, a new host carries on the same', () => {
  const g = setup({ players: 2 }), roost = firstSite(g, 'roost'); stand(g, roost, 1); step(g, 3);
  let previous = g.snapshot(), held = previous, bytes = 0, publishes = 0;
  for (let i = 0; i < 80; i++) {
    g.update(.05); const next = g.snapshot(), d = diffState(previous, next);
    if (d !== undefined) { held = patchState(held, d); bytes += JSON.stringify(d.eco ?? '').length; publishes++; }
    previous = next;
  }
  assert.deepEqual(held.eco, g.snapshot().eco); assert.ok(bytes / 4 < 3000, `${Math.round(bytes / 4)} bytes a second`);
  assert.ok(JSON.stringify(g.snapshot().eco).length < 8000, 'a whole state stays small');
  const heir = new Expedition(g.seed, g.options); heir.restore(g.snapshot(), new Map(g.players.map(p => [p.id, { id: p.id, name: p.name, avatar: {} }])));
  assert.deepEqual(heir.eco, g.eco);
  const a = JSON.parse(JSON.stringify(g.eco)), b = JSON.parse(JSON.stringify(heir.eco));
  for (const w of [a, b]) advanceEcosystem(w, W(g), 30);
  assert.deepEqual(a, b, 'the same chain on the new host');
  step(heir, 3); assert.ok(heir.eco.t > g.eco.t);
});

test('the host\'s ears stay out of the snapshot, and a save without a chain grows one', () => {
  const g = setup(), s = g.snapshot(); assert.equal(s.noise, undefined);
  const old = setup(); old.eco = null; stand(old, firstSite(old, 'roost')); old.update(.05); assert.ok(old.eco, 'an old save simply starts one');
});

test('removing a creature with no body and a floor with no players cost nothing', () => {
  const g = setup(), c = g.eco.pop[0], n = g.eco.pop.length; removeCreature(g.eco, c); assert.equal(g.eco.pop.length, n - 1);
  const t = g.eco.t; stand(g, { x: 0, z: 3 }); step(g, 3); assert.equal(g.eco.t, t, 'it waits for someone to come down');
});

test('a host step with the chain running stays cheap', () => {
  const g = setup(), roost = firstSite(g, 'roost'); crowdRoost(g, roost, 30); stand(g, roost);
  const t0 = performance.now(), steps = 400; for (let i = 0; i < steps; i++) { advanceEcosystem(g.eco, W(g), 1); }
  assert.ok((performance.now() - t0) / steps < 2, 'under 2 ms a simulated second');
  assert.ok(SPECIES.bat.cap <= 30 && SPECIES.snake.cap <= 10);
});
