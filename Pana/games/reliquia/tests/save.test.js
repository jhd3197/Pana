import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, saveable, validSave, recordRows } from '../public/rules.js';
import { floorOf } from '../public/deck.js';

const me = (id, name) => ({ id, name, avatar: {} });
function session(names = ['Juan', 'Ana', 'Beto', 'Luis'], seed = 4242) {
  const g = new Expedition(seed, { place: 'alternar' });
  names.forEach((n, i) => g.addPlayer(`old-${i}`, n, { color: i }));
  g.start(seed);
  return g;
}
// Through JSON, as localStorage does.
const stored = g => JSON.parse(JSON.stringify(g.snapshot()));
const named = (g, name) => g.players.find(p => p.name === name);
const open = (data, members) => { const g = new Expedition(data.seed, data.options); g.loadSave(data, members); return g; };

test('saves only between floors', () => {
  const g = session(), stop = g.layout.run.lifts.find(l => l.floor === 1);
  assert.equal(saveable(g), true, 'everyone at the camp');
  Object.assign(g.players[1], { x: stop.x, z: stop.z - 5 });
  assert.equal(saveable(g), false, 'someone below');
  g.completeLevel();
  assert.equal(saveable(g), true, 'a finished jornada brings everyone up');
  g.lift.moving = true; assert.equal(saveable(g), false, 'the cage on its way');
  g.lift.moving = false; g.phase = 'results'; assert.equal(saveable(g), false, 'over');
});

test('the whole session comes back: jornada, place order, mangos, tools, numbers', () => {
  const g = session();
  g.completeLevel(); g.completeLevel();
  g.mangos = 73; g.encargosWon = 2;
  const ana = named(g, 'Ana');
  ana.hands[0] = { kind: 'machete' }; ana.stats.revives = 3; ana.avatar = { color: 'red' };
  const data = stored(g);
  assert.equal(validSave(data), true);

  const r = open(data, [me('n1', 'Juan'), me('n2', 'Ana'), me('n3', 'Beto'), me('n4', 'Luis')]);
  assert.equal(r.phase, 'lobby'); assert.equal(r.resumed, true);
  assert.equal(r.level, 3); assert.equal(r.origin, g.origin); assert.equal(r.seed, g.seed);
  assert.equal(r.mangos, 73); assert.equal(r.encargosWon, 2); assert.equal(r.quota, g.quota);
  assert.deepEqual(r.encargo, g.encargo);
  assert.deepEqual(r.layout.run.rooms.map(x => x.id), g.layout.run.rooms.map(x => x.id), 'the same deck');
  const back = named(r, 'Ana');
  assert.equal(back.id, 'n2'); assert.equal(back.seat, ana.seat); assert.equal(back.hands[0].kind, 'machete');
  assert.equal(back.stats.revives, 3); assert.equal(back.stats.rounds, 2); assert.equal(back.held, false);

  r.resume();
  assert.equal(r.phase, 'playing'); assert.equal(r.resumed, false);
  assert.equal(r.players.some(p => 'saved' in p), false);
  for (let t = 0; t < 2; t += .05) r.update(.05, new Map());   // and it runs
  assert.equal(r.phase, 'playing');
});

test('a resumed expedition carries on where a played one would: the next jornada', () => {
  const g = session();
  g.completeLevel();
  const r = open(stored(g), [me('n1', 'Juan')]);
  r.resume();
  r.completeLevel();
  g.completeLevel();
  assert.equal(r.level, g.level); assert.equal(r.seed, g.seed);
  assert.deepEqual(r.layout.run.rooms.map(x => x.id), g.layout.run.rooms.map(x => x.id));
});

test('missing panas keep their slot; the numbers still count', () => {
  const g = session();
  g.completeLevel();
  named(g, 'Luis').hands[1] = { kind: 'farol' };
  const r = open(stored(g), [me('n1', 'Juan')]);
  const luis = named(r, 'Luis');
  assert.equal(luis.held, true); assert.equal(luis.spectator, true);
  assert.equal(luis.hands[1].kind, 'farol', 'a saved slot keeps its tools');
  r.resume();
  assert.equal(r.players.length, 4);
  assert.equal(recordRows(r, 'n1').length, 4);
  // A held slot never holds the team back: only Juan needs to stand to play on.
  r.down(named(r, 'Juan'));
  for (let t = 0; t < 4; t += .05) r.update(.05, new Map());
  assert.equal(r.outcome, 'wipe');
});

test('a late pana lands in their slot by name, in the lobby and in play', () => {
  const g = session();
  g.completeLevel();
  const r = open(stored(g), [me('n1', 'Juan')]);
  const seat = named(r, 'Ana').seat;
  const ana = r.addPlayer('n2', ' ana', { color: 'new' });
  assert.equal(ana.seat, seat); assert.equal(ana.id, 'n2'); assert.equal(ana.held, false);
  assert.deepEqual(ana.avatar, { color: 'new' });
  r.resume();
  const beto = r.addPlayer('n3', 'Beto');
  assert.equal(beto.held, false); assert.equal(beto.spectator, false);
  assert.equal(r.players.length, 4, 'no extra diver');
  assert.ok(r.events.some(e => e.kind === 'slot-back'));
});

test('a slot does not answer to its old room id: ids are seat numbers and come back', () => {
  const g = new Expedition(4242);
  g.addPlayer(0, 'Juan'); g.addPlayer(1, 'Ana'); g.start(4242);
  const r = open(stored(g), [me(1, 'Juan')]);   // next week Juan sits where Ana sat
  assert.equal(named(r, 'Juan').id, 1); assert.equal(named(r, 'Juan').held, false);
  assert.equal(named(r, 'Ana').held, true);
  const carla = r.addPlayer(0, 'Carla');        // and someone else where Juan sat
  assert.equal(carla.name, 'Carla'); assert.equal(r.players.length, 3);
});

test('someone new gets their own diver; Tomar gives them a missing slot', () => {
  const g = session();
  g.completeLevel();
  const r = open(stored(g), [me('n1', 'Juan')]);
  const carla = r.addPlayer('n9', 'Carla');
  assert.equal(r.players.length, 5); assert.equal(carla.saved, undefined);
  const beto = named(r, 'Beto'), seat = beto.seat;
  beto.stats.banked = 500;
  assert.equal(r.takeSlot('n9', seat), true);
  assert.equal(r.players.length, 4, 'the new diver went away');
  const taken = r.players.find(p => p.seat === seat);
  assert.equal(taken.id, 'n9'); assert.equal(taken.name, 'Carla'); assert.equal(taken.stats.banked, 500); assert.equal(taken.held, false);
  assert.equal(r.takeSlot('n9', seat), false, 'not held any more');
  assert.equal(r.takeSlot('ghost', named(r, 'Ana').seat), false);
  // Swapping a saved slot for another holds the first for its owner.
  assert.equal(r.takeSlot('n1', named(r, 'Ana').seat), true);
  assert.equal(r.players.filter(p => p.held).length, 2, 'Juan\'s slot and Luis\'s');
  r.resume();
  assert.equal(r.takeSlot('n9', named(r, 'Luis').seat), false, 'only in the resumed lobby');
});

test('leaving mid-session holds the slot, drops the loot, and coming back claims it', () => {
  const g = session(['Juan', 'Ana']), [, ana] = g.players, stop = g.layout.run.lifts.find(l => l.floor === 1);
  ana.stats.banked = 300;
  Object.assign(ana, { x: stop.x, z: stop.z - 5 });
  ana.hands[0] = { kind: 'mask' }; ana.hands[1] = { kind: 'machete' };
  const seat = ana.seat;
  g.leave(ana.id);
  assert.equal(g.players.length, 2);
  assert.equal(ana.held, true); assert.equal(ana.spectator, true);
  assert.equal(floorOf(ana.x), 0, 'waits at the camp');
  assert.equal(ana.hands[0], null); assert.ok(g.items.some(i => i.kind === 'mask'), 'the treasure stays below');
  assert.equal(ana.hands[1].kind, 'machete', 'the tools stay with the slot');
  assert.ok(g.events.some(e => e.kind === 'slot-held'));
  const back = g.addPlayer('new-id', 'Ana');
  assert.equal(back, ana); assert.equal(back.seat, seat); assert.equal(back.stats.banked, 300); assert.equal(back.spectator, false);
});

test('leaving outside a session still just leaves', () => {
  const g = new Expedition(1); g.addPlayer('a', 'Juan'); g.addPlayer('b', 'Ana');
  g.leave('b');
  assert.equal(g.players.length, 1);
  const s = session(['Juan', 'Ana']); s.finish('extracted');
  s.leave(s.players[1].id);
  assert.equal(s.players.length, 1);
  assert.equal(s.addPlayer('z', 'Ana').spectator, true);
});

test('a new pana in a resumed lobby who leaves is gone; a saved one stays held', () => {
  const g = session(['Juan', 'Ana']);
  const r = open(stored(g), [me('n1', 'Juan'), me('n2', 'Ana')]);
  r.addPlayer('n3', 'Carla');
  r.leave('n3');
  assert.equal(named(r, 'Carla'), undefined);
  r.leave('n2');
  assert.equal(named(r, 'Ana').held, true);
});

test('a new host keeps the slots and the resumed lobby', () => {
  const g = session(['Juan', 'Ana', 'Beto']);
  const r = open(stored(g), [me('n1', 'Juan'), me('n2', 'Ana')]);
  const snap = r.snapshot(), next = new Expedition(snap.seed, snap.options);
  next.restore(snap, new Map([['n2', me('n2', 'Ana')]]));
  assert.equal(next.resumed, true); assert.equal(next.phase, 'lobby');
  assert.equal(next.players.length, 3);
  assert.equal(named(next, 'Juan').held, true); assert.equal(named(next, 'Beto').held, true); assert.equal(named(next, 'Ana').held, false);
  // In play, the same for a host who walked out.
  r.resume();
  const live = r.snapshot(), after = new Expedition(live.seed, live.options);
  after.restore(live, new Map([['n2', me('n2', 'Ana')]]));
  assert.equal(after.players.length, 3); assert.equal(named(after, 'Juan').held, true);
});

test('the options of a resumed expedition are locked', () => {
  const g = session();
  const r = open(stored(g), [me('n1', 'Juan')]);
  assert.equal(r.configure({ place: 'mina' }), false);
  assert.equal(r.options.place, 'alternar');
});

test('nonsense does not pass as a save', () => {
  for (const bad of [null, {}, { phase: 'lobby', players: [{}], level: 1, origin: 1 }, { phase: 'playing', players: [], level: 1, origin: 1 }, { phase: 'playing', players: [{}], origin: 1 }])
    assert.equal(validSave(bad), false);
});
