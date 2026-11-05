// El Silbón, its hiding nooks and the roosting bats: nothing kills it, sight
// and noise steer it, the pit drops it, and how hard it looks inside a nook is
// one table per difficulty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { layoutFor, distance } from '../public/layout.js';
import { NOOK, nookAt, nookDepth } from '../public/deck.js';
import { spawnEnemy, wound, stagger, KINDS } from '../public/enemies.js';
import { PEEK, peekRule, willPeek, peekFinds, startPeek, stepPeek, peekCueDue, SILBON_BODY } from '../public/silbon.js';
import { diffState, patchState } from '../../../engine/state-delta.js';

function setup({ seed = 4242, difficulty = 'normal', place = 'mina', players = 1 } = {}) {
  const g = new Expedition(seed, { difficulty, place }); for (let i = 1; i <= players; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed);
  // Quiet floor: nobody else wakes, the Director rests, panas take no chip damage.
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6; for (const p of g.players) p.invulnerable = 1e6;
  return g;
}
const pitRoom = g => g.layout.run.rooms.find(r => r.kind === 'puente');
const nooks = g => g.layout.run.nooks;
function boss(g, x, z, extra = {}) { const e = spawnEnemy(g, 'silbon', x, z, { born: -9, mode: 'wander', ...extra }); assert.ok(e, 'the Silbón spawns'); return e; }
function stand(g, id, q) { Object.assign(g.players.find(p => p.id === id), { x: q.x, z: q.z, y: 0 }); }
function step(g, seconds, each) { for (let t = 0; t < seconds; t += .05) { g.update(.05); each?.(); } }
// A stand inside a nook: `depth` metres in from the opening.
const inside = (n, depth = 1) => ({ x: n.mouth.x - n.nx * depth, z: n.mouth.z - n.nz * depth });
// A spot well away from a nook in its room, with a clear walk to its front.
const nearNook = (g, n, away = 4) => openNear(g, { x: n.front.x + n.nx * away, z: n.front.z + n.nz * away });
// The nearest open floor around a point (rooms are furnished differently per seed).
function openNear(g, q, radius = .8) {
  for (let r = 0; r < 6; r += .5) for (let a = 0; a < 8; a++) { const x = q.x + Math.cos(a * .785) * r, z = q.z + Math.sin(a * .785) * r; if (g.layout.walkable(x, z, g, radius)) return { x, z }; }
  throw new Error('no open floor');
}

test('every jornada has a pit arena, the Silbón on its rim, nooks and a bat colony', () => {
  for (let seed = 1; seed <= 15; seed++) for (const depth of [1, 2, 3, 5]) for (const theme of ['mina', 'biblioteca']) {
    const run = layoutFor(seed, depth, theme).run, pit = run.rooms.find(r => r.kind === 'puente');
    assert.ok(pit, `seed ${seed}/${depth}/${theme}: a pit room`);
    assert.ok(run.sleepers.some(s => s.kind === 'silbon' && s.room === pit.id), `seed ${seed}/${depth}/${theme}: the boss sleeps by the pit`);
    assert.ok(run.nooks.filter(n => n.room === pit.id).length >= 2, `seed ${seed}/${depth}/${theme}: nooks in the arena`);
    assert.ok(run.sleepers.some(s => s.kind === 'bat' && s.room === pit.id), `seed ${seed}/${depth}/${theme}: bats roost there`);
    assert.ok(!run.rooms.every(r => r.floor === 0 || run.nooks.some(n => n.room === r.id)), 'not every room has one');
  }
});

test('the map is the same on every difficulty', () => {
  const nooksOf = difficulty => JSON.stringify(setup({ difficulty }).layout.run.nooks);
  assert.equal(nooksOf('easy'), nooksOf('normal')); assert.equal(nooksOf('hard'), nooksOf('normal'));
});

test('a pana fits in a nook and slips out; the boss never fits', () => {
  for (let seed = 1; seed <= 25; seed++) for (const depth of [1, 2, 3, 5, 8]) for (const theme of ['mina', 'biblioteca']) {
    const L = layoutFor(seed, depth, theme), state = { open: {}, revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), lift: { floor: 1, moving: false } };
    for (const n of L.run.nooks) {
      const tag = `seed ${seed}/${depth}/${theme} ${n.id}`, deep = inside(n, 1), out = { x: n.mouth.x + n.nx, z: n.mouth.z + n.nz };
      assert.ok(L.walkable(deep.x, deep.z, state, .42), `${tag}: a pana stands inside`);
      assert.ok(L.lineClear(deep, out, state, .42), `${tag}: and walks straight out`);
      assert.ok(!L.walkable(deep.x, deep.z, state, SILBON_BODY) && !L.crossable(n.front, deep, state, SILBON_BODY), `${tag}: the boss does not fit`);
      assert.ok(L.walkable(n.front.x, n.front.z, state, SILBON_BODY), `${tag}: it can stand at the opening`);
      assert.ok(nookAt(L.run, deep.x, deep.z)?.id === n.id && Math.abs(nookDepth(n, deep) - 1) < 1e-9);
      assert.ok(NOOK.gap > .84 && NOOK.gap < SILBON_BODY * 2);
    }
  }
});

test('nothing kills it: a machete and paint only stagger it, and not twice in a row', () => {
  assert.equal(KINDS.silbon.unkillable, true);
  const g = setup(), [a] = g.players, room = pitRoom(g), at = [0, 2, -2, 4, -4, 6, -6].map(dx => ({ x: room.x + dx, z: room.rect[1] + 1.6 })).find(q => g.layout.walkable(q.x, q.z, g, .5) && g.layout.walkable(q.x + 1.5, q.z, g, .42));
  const e = boss(g, at.x, at.z);
  assert.equal(wound(e, 1e9), false); assert.equal(e.hp, e.maxHp);
  assert.equal(stagger(e, .9), true); assert.ok(e.stun > 0); assert.equal(stagger(e, .9), false, 'no stun lock');
  e.stun = 0; e.immune = 0; stand(g, 1, { x: at.x + 1.5, z: at.z }); a.h = Math.atan2(e.x - a.x, e.z - a.z); a.hands[0] = { id: 1, kind: 'machete' };
  const hp = e.hp; assert.equal(g.action(1, 'use', { hand: 0 }), true);
  assert.equal(e.hp, hp, 'the blow does nothing to its health'); assert.ok(e.stun > 0, 'it staggers');
  assert.equal(g.enemies.includes(e), true);
});

test('it chases what it sees; break its sight and it searches, then wanders off', () => {
  const g = setup({ difficulty: 'easy' }), n = nooks(g)[0], start = nearNook(g, n);
  const e = boss(g, start.x, start.z); stand(g, 1, n.front);
  step(g, .2); assert.equal(e.mode, 'chase');
  stand(g, 1, inside(n, 1)); step(g, .1); assert.equal(g.players[0].hidden, n.id);
  const modes = new Set(); step(g, 40, () => modes.add(e.mode));
  assert.ok(modes.has('search'), 'it goes looking'); assert.ok(modes.has('sniff'), 'it sniffs at the nook'); assert.ok(modes.has('wander'), 'then loses interest');
  assert.ok(!modes.has('peek'), 'on easy it never looks inside');
  assert.equal(g.players[0].hidden, n.id); assert.equal(g.players[0].hp, 100);
});

test('hiding keeps its blows off you', () => {
  const g = setup({ difficulty: 'hard' }), [a] = g.players, n = nooks(g)[0];
  a.invulnerable = 0; const e = boss(g, n.front.x, n.front.z); stand(g, 1, inside(n, 1.1));
  e.cooldown = 0; step(g, 3);
  assert.equal(e.windup > 0 && e.mode === 'chase', false); assert.equal(a.hp, 100);
});

test('the pit: chasing straight across it drops the boss, opens the seal, leaves loot', () => {
  const g = setup({ place: 'mina' }), room = pitRoom(g), pit = g.layout.run.pits.find(p => p.room === room.id), seal = g.layout.run.seals[0];
  // West rim to east rim, the pit between them.
  // Both inside its sight, so it charges whichever way a wander would have taken it.
  const e = boss(g, pit.rect[0] - .8, room.z); stand(g, 1, { x: pit.rect[2] + .5, z: room.z });
  const items = g.items.length; let fell = false;
  for (let t = 0; t < 12 && g.enemies.includes(e); t += .05) { g.update(.05); fell ||= e.mode === 'fall'; }
  assert.ok(fell, 'it fell'); assert.ok(!g.enemies.includes(e), 'and it is gone');
  assert.ok(g.events.some(ev => ev.kind === 'silbon-down'));
  assert.equal(g.kills, 1); assert.ok(g.items.length > items, 'it drops loot');
  if (seal) assert.equal(g.open[seal.id], 1, 'the seal opens');
});

test('walking around, it never steps in the pit by accident', () => {
  const g = setup({ place: 'mina' }), room = pitRoom(g), pit = g.layout.run.pits.find(p => p.room === room.id);
  const e = boss(g, pit.rect[0] - 1.6, pit.rect[1] - 1.2); stand(g, 1, g.layout.run.lifts.find(l => l.floor === 1));
  e.mode = 'wander'; step(g, 25); assert.ok(g.enemies.includes(e) && e.mode !== 'fall');
});

test('a screech draws it: bats disturbed by a noise bring it over, even from a nook', () => {
  const g = setup({ difficulty: 'easy' }), n = nooks(g)[0], room = pitRoom(g);
  // The pana hides; a roosting bat near the boss, a thrown book lands by it.
  const e = boss(g, n.front.x, n.front.z); stand(g, 1, inside(n, 1));
  const perch = nearNook(g, n), bat = spawnEnemy(g, 'bat', perch.x, perch.z, { hanging: true, born: -9 }); assert.ok(bat);
  g.update(.05); assert.equal(bat.hanging, true, 'it sleeps while nobody disturbs it');
  g.noisy('drop', bat, null, 6); g.update(.05);
  assert.equal(bat.hanging, false, 'a noise wakes it'); assert.ok(g.events.some(ev => ev.kind === 'screech'));
  g.update(.05); assert.equal(e.mode, 'hunt', 'the boss heads for the screech'); assert.ok(room);
  assert.ok(Math.hypot(e.goalX - bat.x, e.goalZ - bat.z) < 3);
});

test('roosting bats drop when a pana passes under them', () => {
  const g = setup(), n = nooks(g)[0], perch = nearNook(g, n), bat = spawnEnemy(g, 'bat', perch.x, perch.z, { hanging: true, born: -9 }); assert.ok(bat);
  stand(g, 1, g.layout.run.lifts.find(l => l.floor === 1));
  g.update(.05); assert.equal(bat.hanging, true);
  stand(g, 1, openNear(g, { x: bat.x + 2, z: bat.z })); g.update(.05); assert.equal(bat.hanging, false);
});

// ---------- Difficulty gating, the one table ----------
test('PEEK: easy never checks, normal sometimes and only the entrance, hard really looks', () => {
  assert.equal(willPeek('easy', 0), false);
  assert.equal(peekFinds('easy', 0), false); assert.equal(peekFinds('easy', .1), false);
  assert.equal(peekRule('easy').windup, 0, 'easy has no windup at all');
  assert.equal(willPeek('normal', .2), true); assert.equal(willPeek('normal', .8), false);
  assert.equal(peekFinds('normal', .3), true, 'visible in the entrance'); assert.equal(peekFinds('normal', 1.2), false, 'safe at the back');
  assert.equal(willPeek('hard', .5), true); assert.equal(willPeek('hard', .95), false);
  assert.equal(peekFinds('hard', 1.4), true, 'nowhere is deep enough');
  assert.ok(PEEK.hard.windup > 0 && PEEK.hard.windup < PEEK.normal.windup, 'hard warns, but less');
  assert.ok(PEEK.hard.windup >= .6 && PEEK.normal.windup <= 1, 'the warning is 0.6 to 1 s');
  assert.deepEqual(peekRule('nonsense'), PEEK.normal);
});

test('the windup counts down and only then lands; the cue plays once per peek', () => {
  const peek = startPeek('hard', 'n3', 7);
  assert.deepEqual(peek, { spot: 'n3', t: PEEK.hard.windup, of: PEEK.hard.windup, seq: 7 });
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(peek))), JSON.stringify(peek), 'plain JSON');
  let ticks = 0; while (!stepPeek(peek, .05)) ticks++;
  assert.ok(ticks >= 12 && ticks <= 14, `${ticks} ticks of warning`); assert.equal(peek.t, 0);
  const e = { peek: startPeek('normal', 'n1', 3) };
  assert.equal(peekCueDue(e, 2), true); assert.equal(peekCueDue(e, 3), false, 'already heard');
  assert.equal(peekCueDue({ peek: null }, 2), false);
});

function peekAt(difficulty, depth, seed = 4242) {
  const g = setup({ difficulty, seed }), [a] = g.players, n = nooks(g)[0], e = boss(g, n.front.x, n.front.z, { mode: 'peek' });
  a.invulnerable = 0; stand(g, 1, inside(n, depth));
  e.peek = startPeek(difficulty, n.id, 1); e.h = n.h + Math.PI; g.update(.05);
  return { g, a, n, e };
}

test('the check lands only after the windup: slip out in time and it finds nothing', () => {
  for (const difficulty of ['normal', 'hard']) {
    const { g, a, n, e } = peekAt(difficulty, .3);
    assert.equal(a.stun, 0, `${difficulty}: nothing yet`); assert.equal(a.hidden, n.id);
    assert.ok(e.peek.t > 0, 'the windup is running');
    step(g, peekRule(difficulty).windup + .1);
    assert.equal(e.peek, null); assert.ok(a.exposed > 0, `${difficulty}: flushed at the end`); assert.ok(a.stun > 0);
    assert.ok(nookDepth(n, a) < 0, 'pushed out through the opening');
    const late = peekAt(difficulty, .3);
    stand(late.g, 1, { x: late.n.front.x + late.n.nx * 6, z: late.n.front.z + late.n.nz * 6 });
    step(late.g, peekRule(difficulty).windup + .1);
    assert.equal(late.a.stun, 0, `${difficulty}: slipped out, nothing happens`); assert.equal(late.a.exposed || 0, 0);
  }
});

test('deep inside: normal misses you, hard pulls you out and it hurts', () => {
  const normal = peekAt('normal', 1.2); step(normal.g, 1.2); assert.equal(normal.a.stun, 0); assert.equal(normal.a.hidden, normal.n.id);
  const hard = peekAt('hard', 1.2); step(hard.g, 1); assert.ok(hard.a.stun > 0); assert.ok(hard.a.hp < 100); assert.equal(hard.a.hidden, null);
  assert.ok(hard.g.events.some(ev => ev.kind === 'flush'));
});

test('easy: right at the opening it still never looks in', () => {
  const g = setup({ difficulty: 'easy' }), [a] = g.players, n = nooks(g)[0];
  a.invulnerable = 0; stand(g, 1, inside(n, .3)); const e = boss(g, n.front.x, n.front.z, { mode: 'search', searchLeft: 14, lastX: n.front.x, lastZ: n.front.z });
  let peeked = false; step(g, 20, () => { peeked ||= !!e.peek; });
  assert.equal(peeked, false); assert.equal(a.stun, 0); assert.equal(a.hp, 100);
});

test('hard reaches the check through the search itself', () => {
  const g = setup({ difficulty: 'hard' }), [a] = g.players, n = nooks(g)[0], near = nearNook(g, n, 1);
  a.invulnerable = 0; stand(g, 1, inside(n, 1.2)); const e = boss(g, near.x, near.z, { mode: 'search', searchLeft: 14, lastX: n.front.x, lastZ: n.front.z });
  let peeked = false; for (let t = 0; t < 8 && !a.exposed; t += .05) { g.update(.05); peeked ||= !!e.peek; }
  assert.ok(peeked, 'it winds up first'); assert.ok(a.exposed > 0, 'and pulls the pana out');
});

// ---------- Networking ----------
test('the boss survives a host change: its state is plain JSON and restores whole', () => {
  const g = setup({ difficulty: 'hard', players: 2 }), n = nooks(g)[0], e = boss(g, n.front.x, n.front.z, { mode: 'peek' });
  stand(g, 1, inside(n, 1)); e.peek = startPeek('hard', n.id, 4); g.update(.05);
  const snapshot = g.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'nothing but plain data');
  const carried = snapshot.enemies.find(q => q.kind === 'silbon'); assert.equal(carried.peek.spot, n.id); assert.equal(snapshot.players[0].hidden, n.id);
  const next = new Expedition(snapshot.seed, snapshot.options);
  next.restore(snapshot, new Map(snapshot.players.map(p => [p.id, { id: p.id, name: p.name, avatar: {} }])));
  const again = next.enemies.find(q => q.kind === 'silbon'); assert.ok(again.peek.t > 0);
  next.update(.05); for (let t = 0; t < 1 && !next.players[0].exposed; t += .05) next.update(.05);
  assert.ok(next.players[0].exposed > 0, 'the new host lands the same check');
});

test('deltas carry the peek to a guest and clear it again', () => {
  const g = setup({ difficulty: 'hard' }), n = nooks(g)[0], e = boss(g, n.front.x, n.front.z, { mode: 'peek' });
  stand(g, 1, inside(n, 1)); const before = g.snapshot();
  e.peek = startPeek('hard', n.id, 9); const during = g.snapshot();
  const patched = patchState(before, diffState(before, during)), guest = patched.enemies.find(q => q.kind === 'silbon');
  assert.equal(guest.peek.seq, 9); assert.equal(guest.peek.spot, n.id);
  e.peek = null; const after = g.snapshot(), cleared = patchState(patched, diffState(during, after)).enemies.find(q => q.kind === 'silbon');
  assert.ok(!cleared.peek); assert.ok(distance(e, n.front) < 1);
});
