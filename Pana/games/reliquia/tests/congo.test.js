// El Congo and El Mokele: a sixth place wired in without changing the other five, vine
// channels every body still fits, and a monster with the Silbón's shape that is heard,
// then seen as a shape, then seen far too close.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { layoutFor, distance } from '../public/layout.js';
import { generateRun, roomName, jornadaName, themeFor, themeOf, bossKind, inRect, THEMES, PLACES, VINE_ROOMS, OLD_PLACES } from '../public/deck.js';
import { spawnEnemy, wound, stagger, KINDS, loadMokele, MOKELE_RISE } from '../public/enemies.js';
import { FIELDS, validOptions } from '../public/options.js';
import { SUCESO_POOL } from '../public/sucesos.js';
import { SILBON_BODY, startPeek, peekRule } from '../public/silbon.js';
import { MOKELE, STALK, REVEAL, stalkEvery, revealStage, teethAmount, headScale, cueFor } from '../public/mokele.js';
import { PACTO } from '../public/pactos.js';
import { diffState, patchState } from '../../../engine/state-delta.js';

await loadMokele();
const SEEDS = 24, DEPTHS = [1, 2, 3, 5, 8];
const opened = L => ({ open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])), revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), strung: Object.fromEntries([...L.run.bridges, ...L.run.ropes].filter(b => b.needs).map(b => [b.id, 1])), lift: { floor: 1, moving: false } });
function setup({ seed = 4242, difficulty = 'normal', place = 'congo', players = 1 } = {}) {
  const g = new Expedition(seed, { difficulty, place }); for (let i = 1; i <= players; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed);
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  g.director.duration = 1e6; g.sucesoIn = 1e6; for (const p of g.players) p.invulnerable = 1e6;
  return g;
}
const stand = (g, id, q) => Object.assign(g.players.find(p => p.id === id), { x: q.x, z: q.z, y: 0 });
const step = (g, seconds, each) => { for (let t = 0; t < seconds; t += .05) { g.update(.05); each?.(); } };
const boss = (g, x, z, extra = {}) => { const e = spawnEnemy(g, 'mokele', x, z, { born: -9, mode: 'wander', ...extra }); assert.ok(e, 'the Mokele spawns'); return e; };
function openNear(g, q, radius = .8) {
  for (let r = 0; r < 8; r += .5) for (let a = 0; a < 8; a++) { const x = q.x + Math.cos(a * .785) * r, z = q.z + Math.sin(a * .785) * r; if (g.layout.walkable(x, z, g, radius)) return { x, z }; }
  throw new Error('no open water');
}
const pitRoom = g => g.layout.run.rooms.find(r => r.kind === 'puente');

// ---------- A place like the others ----------
test('Congo is on the Lugar list, in the rotation, and named', () => {
  assert.ok(THEMES.includes('congo') && PLACES.includes('congo'));
  assert.ok(FIELDS.find(f => f.id === 'place').choices.some(([id]) => id === 'congo'));
  assert.ok(validOptions({ place: 'congo' }));
  assert.equal(themeFor(3, 'congo', 9), 'congo', 'it stays put when chosen');
  assert.equal(jornadaName(1, 'congo'), 'El Congo');
  assert.equal(roomName('puente', 'congo'), 'El remolino'); assert.equal(roomName('canal', 'congo'), 'El caño ciego');
  for (let origin = 1; origin <= 40; origin++) {
    const order = THEMES.map((_, i) => themeFor(i + 1, 'alternar', origin));
    assert.deepEqual([...order].sort(), [...THEMES].sort(), 'each place once before any repeats');
  }
  for (const kind of SUCESO_POOL.congo) assert.ok(kind !== 'creciente', 'nothing rises to hide the loot in opaque water');
});

test('a save from before the Congo keeps its five-place order; a new expedition has six', () => {
  // Fixed by the original five-place shuffle: a saved jornada must deal the same place it left.
  const before = { 77: ['inundada', 'biblioteca', 'templo', 'mina', 'hongos'] }, order = o => Array.from({ length: OLD_PLACES }, (_, i) => themeFor(i + 1, 'alternar', o, OLD_PLACES));
  assert.deepEqual(order(77), before[77]);
  assert.ok(!Array.from({ length: 40 }, (_, o) => order(o + 1)).flat().includes('congo'), 'no Congo in an old rotation');
  const g = new Expedition(77); g.addPlayer(1, 'Ana'); g.start(77); g.completeLevel();
  const fresh = g.snapshot(); assert.equal(fresh.places, THEMES.length);
  const { places, ...old } = fresh, loaded = new Expedition(1); loaded.loadSave(JSON.parse(JSON.stringify(old)), new Map([[1, { id: 1, name: 'Ana', avatar: {} }]]));
  assert.equal(loaded.places, OLD_PLACES); assert.equal(themeOf(loaded), before[77][1], 'jornada 2 is what it was');
  const again = new Expedition(77); again.addPlayer(1, 'Ana'); again.start(77); assert.equal(again.places, THEMES.length, 'the next dive has every place');
  const mid = new Expedition(1); mid.loadSave(JSON.parse(JSON.stringify(fresh)), new Map()); assert.equal(mid.places, THEMES.length, 'a new save stays new');
});

test('only the Congo deals vines, canals, the Mokele; everywhere else keeps the Silbón', () => {
  for (let seed = 1; seed <= SEEDS; seed++) for (const depth of DEPTHS) for (const theme of THEMES) {
    const run = generateRun(seed, { depth, theme }), tag = `${theme} ${seed}/${depth}`, congo = theme === 'congo';
    assert.equal(run.solids.some(s => s.kind === 'vine'), congo, `${tag}: vines`);
    assert.equal(run.rooms.some(r => VINE_ROOMS.includes(r.kind)), congo && run.rooms.some(r => VINE_ROOMS.includes(r.kind)), `${tag}: maze rooms`);
    assert.ok(run.sleepers.some(s => s.kind === bossKind(theme)), `${tag}: its boss sleeps there`);
    assert.ok(!run.sleepers.some(s => s.kind === (congo ? 'silbon' : 'mokele')), `${tag}: and no other`);
    if (congo) { assert.ok(run.rooms.some(r => VINE_ROOMS.includes(r.kind)), `${tag}: a maze`); assert.ok(!run.sleepers.some(s => s.kind === 'spider' || s.kind === 'lector' || s.kind === 'estatua'), `${tag}: nothing from a roof or a library`); }
  }
});

// ---------- The channels ----------
test('every channel carries a pana, a carrito and the Mokele, and every room and loot is reached', () => {
  for (let seed = 1; seed <= SEEDS; seed++) for (const depth of DEPTHS) {
    const L = layoutFor(seed, depth, 'congo'), run = L.run, state = opened(L), stop = run.lifts.find(l => l.floor === 1), landing = { x: stop.x, z: stop.z - 5 }, tag = `${seed}/${depth}`;
    for (const c of run.corridors.filter(q => !q.hidden)) {
      const mx = (c.rect[0] + c.rect[2]) / 2, mz = (c.rect[1] + c.rect[3]) / 2, lanes = c.horizontal ? [[mx, mz + .5], [mx, mz - .5], [mx - 1, mz + .5], [mx - 1, mz - .5]] : [[mx + .5, mz], [mx - .5, mz], [mx + .5, mz - 1], [mx - .5, mz - 1]];
      for (const [body, radius] of [['pana', .42], ['carrito', .6], ['mokele', MOKELE.body]]) assert.ok(lanes.some(([x, z]) => L.findPath(landing, { x, z }, state, radius).length), `${tag}: ${body} through ${c.id}`);
    }
    const isle = (l, p) => inRect(l.x, l.z, p.island);
    for (const l of run.loot.filter(q => q.floor === 1 && !q.y)) assert.ok(L.findPath(landing, l, state, .3).length || run.pits.some(p => isle(l, p)), `${tag}: ${l.kind} at ${l.x},${l.z}`);
    for (const r of run.rooms.filter(q => VINE_ROOMS.includes(q.kind))) {
      // Every aisle of a maze is open water a carrito can reach: nothing is walled off for good.
      for (const dz of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) {
        const free = Array.from({ length: 21 }, (_, i) => ({ x: r.x - 10 + i, z: r.z + dz })).filter(q => L.walkable(q.x, q.z, state, .6));
        assert.ok(free.length, `${tag}: ${r.kind} aisle ${dz} has water`);
        assert.ok(free.some(q => L.findPath(landing, q, state, .6).length), `${tag}: ${r.kind} aisle ${dz} reached`);
      }
    }
  }
});

test('the channels are a real maze: narrow, with dead ends and no long straight views', () => {
  let pockets = 0, mazes = 0, narrow = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const L = layoutFor(seed, 2, 'congo'), run = L.run, state = opened(L);
    for (const r of run.rooms.filter(q => VINE_ROOMS.includes(q.kind))) {
      mazes++;
      // A dead end: an aisle's end with vines on three sides.
      for (const dz of [-4.5, -1.5, 1.5, 4.5]) for (let i = -10; i <= 10; i++) { const x = r.x + i + .5, z = r.z + dz; if (!L.walkable(x, z, state, .42)) continue; const shut = [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]].filter(([a, b]) => !L.walkable(x + a, z + b, state, .42)).length; if (shut >= 3) pockets++; }
    }
    for (const c of run.corridors.filter(q => !q.hidden)) {
      const across = c.horizontal ? [c.rect[1], c.rect[3]] : [c.rect[0], c.rect[2]], mid = (across[0] + across[1]) / 2, at = (c.horizontal ? (c.rect[0] + c.rect[2]) : (c.rect[1] + c.rect[3])) / 2;
      assert.equal(across[1] - across[0], 4, 'the corridor rect keeps the shared width');
      if (c.horizontal ? !L.walkable(at, mid + 1.8, state, .1) : !L.walkable(mid + 1.8, at, state, .1)) narrow++;
    }
  }
  assert.ok(mazes > SEEDS, `${mazes} mazes`); assert.ok(pockets > mazes, `${pockets} dead ends in ${mazes} mazes`); assert.ok(narrow > SEEDS, `${narrow} narrow channels`);
  // Vines block a look as walls do.
  const L = layoutFor(4242, 2, 'congo'), v = L.run.solids.find(s => s.kind === 'vine' && s.room), mx = (v.rect[0] + v.rect[2]) / 2, mz = (v.rect[1] + v.rect[3]) / 2;
  assert.equal(L.sightClear({ x: mx, z: mz - 1.2 }, { x: mx, z: mz + 1.2 }, {}), false);
});

test('a whole jornada plays through the same rules, and the nooks keep it out', () => {
  const g = new Expedition(4242, { place: 'congo' }); g.addPlayer(1, 'Ana'); g.start(4242);
  assert.equal(g.layout.run.theme, 'congo');
  for (let i = 0; i < 200; i++) g.update(.05, new Map());
  for (let seed = 1; seed <= 15; seed++) for (const depth of DEPTHS) {
    const L = layoutFor(seed, depth, 'congo'), state = opened(L);
    for (const n of L.run.nooks) {
      const deep = { x: n.mouth.x - n.nx, z: n.mouth.z - n.nz };
      assert.ok(L.walkable(deep.x, deep.z, state, .42), 'a pana fits'); assert.ok(!L.walkable(deep.x, deep.z, state, MOKELE.body), 'its body does not');
    }
    assert.ok(!L.run.nooks.some(n => VINE_ROOMS.includes(L.run.rooms.find(r => r.id === n.room)?.kind)), 'no slabs in a channel');
  }
  assert.equal(MOKELE.body, SILBON_BODY);
});

// ---------- The monster ----------
test('nothing kills it, and no stun lock', () => {
  assert.equal(KINDS.mokele.unkillable, true);
  const g = setup(), room = pitRoom(g), at = openNear(g, { x: room.rect[0] + 1.6, z: room.z }), e = boss(g, at.x, at.z);
  assert.equal(wound(e, 1e9), false); assert.equal(e.hp, e.maxHp);
  assert.equal(stagger(e, .9), true); assert.equal(stagger(e, .9), false);
});

test('it comes up on its own after the landing, sooner with the pact, and only once', () => {
  const landed = (g, wait) => { g.lift.moving = true; g.lift.to = 1; g.lift.from = 0; g.lift.t = 0; g.lift.duration = .05; g.lift.riders = [1]; g.lift.carts = []; g.lift.items = []; const p = g.players[0]; Object.assign(p, { riding: true }); step(g, .2); stand(g, 1, openNear(g, { x: g.layout.run.lifts[1].x, z: g.layout.run.lifts[1].z - 5 }, .42)); p.riding = false; step(g, wait); };
  const g = new Expedition(4242, { place: 'congo' }); g.addPlayer(1, 'Ana'); g.start(4242); g.players[0].invulnerable = 1e6; g.director.duration = 1e6; g.sucesoIn = 1e6;
  landed(g, MOKELE_RISE - 1); assert.ok(!g.enemies.some(e => e.kind === 'mokele'), 'not yet');
  step(g, 2); const e = g.enemies.find(q => q.kind === 'mokele'); assert.ok(e, 'it rises'); assert.equal(e.mode, 'emerge');
  assert.ok(g.events.some(ev => ev.kind === 'boss' && ev.boss === 'mokele')); assert.ok(!/Mokele/.test(g.events.find(ev => ev.kind === 'boss').text), 'it is not named before it is seen');
  step(g, MOKELE.emerge + .2); assert.notEqual(e.mode, 'emerge');
  // Walking into its room later does not raise a second one.
  g.woke = {}; stand(g, 1, openNear(g, pitRoom(g), .42)); step(g, .2); assert.equal(g.enemies.filter(q => q.kind === 'mokele').length, 1);
  const pact = new Expedition(4242, { place: 'congo', 'pacto:silbon': true }); pact.addPlayer(1, 'Ana'); pact.start(4242); pact.players[0].invulnerable = 1e6; pact.director.duration = 1e6; pact.sucesoIn = 1e6;
  landed(pact, PACTO.silbonAfter + 1); assert.ok(pact.enemies.some(q => q.kind === 'mokele'), 'the pact brings it sooner');
  assert.ok(PACTO.silbonAfter < MOKELE_RISE);
});

test('wandering it keeps coming, as often as the difficulty says', () => {
  assert.ok(STALK.easy > STALK.normal && STALK.normal > STALK.hard); assert.equal(stalkEvery('nonsense'), STALK.normal);
  const g = setup({ difficulty: 'hard' }), room = g.layout.run.rooms.find(r => r.index === 0), far = g.layout.run.rooms.filter(r => r.floor === 1).at(-1);
  stand(g, 1, openNear(g, room, .42)); const at = openNear(g, far), e = boss(g, at.x, at.z);
  e.stalkIn = .1; step(g, .3); assert.equal(e.mode, 'hunt', 'it sets off'); const start = distance(e, g.players[0]);
  step(g, 6); assert.ok(distance(e, g.players[0]) < start, 'and it closes in');
});

test('it chases what it sees and surges along a straight run, then has to rest', () => {
  const g = setup({ difficulty: 'normal' }), room = g.layout.run.rooms.find(r => r.index === 0), [a] = g.players;
  const start = openNear(g, { x: room.rect[0] + 1.6, z: room.z }), goal = { x: room.rect[2] - 1.6, z: start.z };
  assert.ok(g.layout.lineClear(start, goal, g, MOKELE.body), 'a straight stretch of water'); stand(g, 1, goal);
  const e = boss(g, start.x, start.z); let burst = 0, rest = 0, moved = [];
  for (let t = 0; t < 2; t += .05) { const x = e.x; g.update(.05); a.x = goal.x; moved.push(Math.abs(e.x - x) / .05); burst = Math.max(burst, e.surgeT || 0); }
  assert.equal(e.mode, 'chase'); assert.ok(burst > 0, 'it surges from afar');
  assert.ok(Math.max(...moved) > KINDS.mokele.speed * 1.2, `${Math.max(...moved)} m/s`); assert.ok(Math.max(...moved) > 4.6, 'quicker than a walking pana for a moment');
  e.surgeT = .05; g.update(.05); g.update(.05); rest = e.surgeT; assert.ok(rest < 0, 'then rests');
  assert.ok(KINDS.mokele.speed < 4.6, 'between surges a walking pana still pulls away');
});

test('break its sight and it searches; on easy the neck never looks in a nook', () => {
  const g = setup({ difficulty: 'easy' }), n = g.layout.run.nooks[0], start = openNear(g, { x: n.front.x + n.nx * 4, z: n.front.z + n.nz * 4 });
  const e = boss(g, start.x, start.z); stand(g, 1, n.front); step(g, .2); assert.equal(e.mode, 'chase');
  stand(g, 1, { x: n.mouth.x - n.nx, z: n.mouth.z - n.nz }); step(g, .1); assert.equal(g.players[0].hidden, n.id);
  const modes = new Set(); step(g, 8, () => modes.add(e.mode));
  assert.ok(modes.has('search') || modes.has('sniff')); assert.ok(!modes.has('peek')); assert.equal(g.players[0].hp, 100);
});

test('on hard the neck finds you in a nook after its warning, by the shared table', () => {
  const g = setup({ difficulty: 'hard' }), [a] = g.players, n = g.layout.run.nooks[0], e = boss(g, n.front.x, n.front.z, { mode: 'peek' });
  a.invulnerable = 0; stand(g, 1, { x: n.mouth.x - n.nx * 1.2, z: n.mouth.z - n.nz * 1.2 }); e.peek = startPeek('hard', n.id, 1); e.h = n.h + Math.PI; g.update(.05);
  assert.equal(a.stun, 0, 'nothing yet'); step(g, peekRule('hard').windup + .1);
  assert.ok(a.exposed > 0, 'pulled out'); assert.ok(a.hp < 100, 'and it hurts');
  assert.ok(g.events.some(ev => ev.kind === 'flush' && /Mokele/.test(ev.text)), 'its own line');
});

test('the whirlpool: run straight at someone across it and it opens the seal and leaves loot', () => {
  const g = setup(), room = pitRoom(g), pit = g.layout.run.pits.find(p => p.room === room.id), seal = g.layout.run.seals[0];
  assert.equal(pit.water, true, 'it is water, drawn opaque');
  const e = boss(g, pit.rect[0] - .8, room.z); stand(g, 1, { x: pit.rect[2] + .5, z: room.z });
  const items = g.items.length; let fell = false, shout = false;
  for (let t = 0; t < 14 && g.enemies.includes(e); t += .05) { g.update(.05); fell ||= e.mode === 'fall'; shout ||= g.events.some(ev => ev.kind === 'mokele-falling'); }
  assert.ok(fell && shout, 'it went in'); assert.ok(!g.enemies.includes(e)); assert.ok(g.events.some(ev => ev.kind === 'mokele-down'));
  assert.ok(g.items.length > items); if (seal) assert.equal(g.open[seal.id], 1);
});

// ---------- Heard, then a shape, then teeth ----------
test('it is heard before it is seen, seen before it is close, and the stages only go one way', () => {
  assert.equal(revealStage(REVEAL.hear + 1, 'wander'), 'none');
  assert.equal(revealStage(40, 'wander'), 'heard'); assert.equal(revealStage(20, 'wander'), 'shape'); assert.equal(revealStage(5, 'chase'), 'teeth');
  assert.equal(revealStage(5, 'wander'), 'shape', 'a wanderer stays a shape: the close-up always means trouble');
  assert.equal(revealStage(10, 'emerge'), 'heard', 'still under water: only heard');
  const order = ['none', 'heard', 'shape', 'teeth']; let at = 0;
  for (let d = 70; d >= 1; d -= .25) { const i = order.indexOf(revealStage(d, 'chase')); assert.ok(i >= at, `stage at ${d} m`); at = i; }
  assert.equal(at, 3, 'all the way to the teeth');
  assert.ok(REVEAL.hear > REVEAL.shape + 20, 'plenty of hearing first');
  assert.ok(REVEAL.shape <= 30, 'and the fog (far 30 m) is what first shows the shape');
});

test('the teeth grow as it comes, far past life size, and Sustos scales only the look', () => {
  assert.equal(teethAmount(REVEAL.teeth + .1, 'chase'), 0); assert.equal(teethAmount(REVEAL.close, 'chase'), 1); assert.equal(teethAmount(2, 'wander'), 0);
  assert.ok(teethAmount(5, 'chase') > teethAmount(7, 'chase'));
  assert.ok(headScale(1) >= 2, 'at arm\'s length the head is twice as big as it really is');
  assert.ok(headScale(1, 'suaves') < headScale(1)); assert.equal(headScale(1, 'apagados'), 1); assert.equal(headScale(0), 1);
});

test('its cues get quicker and louder as it nears, and quiet down with Sustos', () => {
  const far = cueFor(50, 'wander'), near = cueFor(10, 'wander'), running = cueFor(10, 'chase');
  assert.ok(near.foot < far.foot && near.wake < far.wake, 'quicker'); assert.ok(near.gain > far.gain && near.drone > far.drone, 'louder');
  assert.ok(running.foot < near.foot, 'running'); assert.equal(cueFor(10, 'sniff').foot, 0, 'standing still: nothing underfoot');
  assert.equal(cueFor(REVEAL.hear + 1, 'chase').gain, 0, 'too far');
  assert.ok(cueFor(10, 'chase', 'suaves').gain < running.gain); assert.deepEqual(cueFor(10, 'chase', 'apagados'), { foot: 0, wake: 0, drone: 0, gain: 0 });
});

// ---------- Networking ----------
test('a new host carries it on: plain JSON, whole', () => {
  const g = setup({ difficulty: 'hard', players: 2 }), n = g.layout.run.nooks[0], e = boss(g, n.front.x, n.front.z, { mode: 'peek' });
  stand(g, 1, { x: n.mouth.x - n.nx, z: n.mouth.z - n.nz }); e.peek = startPeek('hard', n.id, 4); e.surgeT = 1.2; e.stalkIn = 3; g.update(.05);
  const snapshot = g.snapshot(); assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'nothing but plain data');
  const carried = snapshot.enemies.find(q => q.kind === 'mokele'); assert.equal(carried.peek.spot, n.id); assert.ok(carried.surgeT > 0);
  const next = new Expedition(snapshot.seed, snapshot.options); next.restore(snapshot, new Map(snapshot.players.map(p => [p.id, { id: p.id, name: p.name, avatar: {} }])));
  assert.equal(themeOf(next), 'congo'); for (let t = 0; t < 1.2 && !next.players[0].exposed; t += .05) next.update(.05);
  assert.ok(next.players[0].exposed > 0, 'the new host lands the same look');
});

test('deltas carry its mode to a guest', () => {
  const g = setup(), at = openNear(g, pitRoom(g)), e = boss(g, at.x, at.z, { mode: 'emerge' }), before = g.snapshot();
  e.mode = 'chase'; e.modeT = 0; const after = g.snapshot(), guest = patchState(before, diffState(before, after)).enemies.find(q => q.kind === 'mokele');
  assert.equal(guest.mode, 'chase');
});
