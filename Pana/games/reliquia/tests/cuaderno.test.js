import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CUADERNO_XP, sightings, fromEvent } from '../public/cuaderno.js';
import { createFosaProgress } from '../public/progress.js';
import { THEMES, floorOf } from '../public/deck.js';
import { createLogbook, logbookKey } from '../../../engine/logbook.js';

// Well below the camp, looking down +z (heading 0).
const X = 240;
assert.ok(floorOf(X) > 0);
const me = extra => ({ id: 'a', x: X, z: 0, h: 0, hands: [null, null], ...extra });
const playing = (player = me(), extra = {}) => ({ phase: 'playing', level: 1, options: { place: 'mina' }, players: [player], enemies: [], items: [], ...extra });
const enemy = (kind, extra = {}) => ({ id: 1, kind, x: X, z: 5, hp: 10, awake: true, ...extra });
function fakeStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem(key, value) { data.set(key, value); } };
}

test('the catalog has unique ids, a title each, and every place', () => {
  const ids = CATALOG.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of CATALOG) assert.ok(e.title, e.id);
  for (const theme of THEMES) assert.ok(ids.includes(`lugar:${theme}`), theme);
  for (const page of ['silbon', 'mokele', 'jaguar', 'guardian', 'mummy', 'lector', 'estatua']) assert.ok(ids.includes(`bicho:${page}`), page);
  assert.ok(CATALOG.filter(e => e.group === 'nota').length >= 3, 'notes on El Silbón');
});

test('everything sightings and fromEvent can name is in the catalog', () => {
  const ids = new Set(CATALOG.map(e => e.id));
  const p = me({ hidden: 'nook', hands: [{ kind: 'sunCrown' }, null], grip: 7 });
  const kinds = ['mummy', 'guardian', 'jaguar', 'stalker', 'bat', 'spider', 'snake', 'lector', 'estatua', 'silbon', 'mokele'];
  const seen = sightings(playing(p, { enemies: kinds.map(k => enemy(k)), items: [{ id: 7, kind: 'altar' }] }), 'a');
  for (const id of seen) assert.ok(ids.has(id), id);
  assert.equal(seen.filter(id => id.startsWith('bicho:')).length, 10, 'the stalker shares a page');
  const state = playing(me(), { enemies: [enemy('silbon')] });
  for (const e of [{ kind: 'suceso', suceso: 'apagon' }, { kind: 'suceso', suceso: 'esporada' }, { kind: 'swarm', floor: floorOf(X) }, { kind: 'vault' }, { kind: 'reveal' }, { kind: 'boss', boss: 'silbon' }, { kind: 'screech' }, { kind: 'silbon-down' }])
    for (const id of fromEvent(e, state, 'a')) assert.ok(ids.has(id), id);
});

test('going down writes the place; the camp and spectating write nothing', () => {
  assert.deepEqual(sightings(playing(), 'a'), ['lugar:mina']);
  assert.deepEqual(sightings(playing(me({ x: 0 })), 'a'), []);
  assert.deepEqual(sightings(playing(me({ spectator: true })), 'a'), []);
  assert.deepEqual(sightings({ ...playing(), phase: 'results' }, 'a'), []);
  assert.deepEqual(sightings(playing(), 'someone-else'), []);
  assert.deepEqual(sightings(playing(), 'a', { known: new Set(['lugar:mina']) }), []);
});

test('a creature counts awake, near, ahead and past the walls', () => {
  const pages = (e, clear) => sightings(playing(me(), { enemies: [e] }), 'a', { clear }).filter(id => id !== 'lugar:mina');
  assert.deepEqual(pages(enemy('lector')), ['bicho:lector']);
  assert.deepEqual(pages(enemy('estatua', { awake: false })), [], 'still just a statue');
  assert.deepEqual(pages(enemy('lector', { z: 30 })), [], 'too far');
  assert.deepEqual(pages(enemy('lector', { z: -5 })), [], 'behind you');
  assert.deepEqual(pages(enemy('lector', { x: X + 240 })), [], 'another floor');
  assert.deepEqual(pages(enemy('lector', { hp: 0 })), [], 'dead');
  assert.deepEqual(pages(enemy('lector'), () => false), [], 'behind a wall');
  assert.deepEqual(pages(enemy('stalker')), ['bicho:jaguar']);
});

test('the walls are only asked about what is still unwritten', () => {
  let asked = 0;
  const known = new Set(['lugar:mina', 'bicho:lector']);
  sightings(playing(me(), { enemies: [enemy('lector')] }), 'a', { known, clear: () => { asked++; return true; } });
  assert.equal(asked, 0);
});

test('the notes on El Silbón come from meeting it', () => {
  const near = (z, extra = {}) => sightings(playing(me(extra), { enemies: [enemy('silbon', { z })] }), 'a');
  assert.ok(near(10).includes('bicho:silbon')); assert.ok(!near(10).includes('nota:inmortal'));
  assert.ok(near(4).includes('nota:inmortal'));
  assert.ok(near(10, { hidden: 'nook' }).includes('nota:hueco'));
  assert.ok(!sightings(playing(me({ hidden: 'nook' })), 'a').includes('nota:hueco'), 'a nook alone teaches nothing');
  const state = playing(me(), { enemies: [enemy('silbon')] });
  assert.deepEqual(fromEvent({ kind: 'boss', boss: 'silbon' }, state, 'a'), ['nota:despierta']);
  assert.deepEqual(fromEvent({ kind: 'boss', boss: 'mokele' }, state, 'a'), [], 'the Mokele is not named by its noise');
  assert.deepEqual(fromEvent({ kind: 'screech' }, state, 'a'), ['nota:chillido']);
  assert.deepEqual(fromEvent({ kind: 'screech' }, playing(), 'a'), [], 'no Silbón about, nothing to learn');
  assert.deepEqual(fromEvent({ kind: 'silbon-down' }, state, 'a'), ['nota:abismo']);
});

test('treasures count held in a hand or gripped; plain loot does not', () => {
  assert.ok(sightings(playing(me({ hands: [{ kind: 'miche' }, null] })), 'a').includes('tesoro:miche'));
  assert.ok(sightings(playing(me({ grip: 7 }), { items: [{ id: 7, kind: 'goldJaguar' }] }), 'a').includes('tesoro:goldJaguar'));
  assert.deepEqual(sightings(playing(me({ hands: [{ kind: 'machete' }, { pile: ['coins'] }] })), 'a'), ['lugar:mina']);
});

test('events only teach a pana who is down there', () => {
  const camp = playing(me({ x: 0 }));
  assert.deepEqual(fromEvent({ kind: 'suceso', suceso: 'apagon' }, camp, 'a'), []);
  assert.deepEqual(fromEvent({ kind: 'suceso', suceso: 'apagon' }, playing(), 'a'), ['suceso:apagon']);
  assert.deepEqual(fromEvent({ kind: 'swarm', floor: floorOf(X) + 1 }, playing(), 'a'), [], 'another floor');
  assert.deepEqual(fromEvent({ kind: 'pick', item: 'coins' }, playing(), 'a'), []);
});

test('a first find pays once, is not a dive, and survives a reload', () => {
  const storage = fakeStorage(), diver = createFosaProgress({ storage });
  const book = createLogbook({ game: 'reliquia', entries: CATALOG, storage });
  const first = book.discover('lugar:mina');
  assert.equal(first.isNew, true);
  assert.equal(diver.earn(CUADERNO_XP, 'logbook:lugar:mina').gained, CUADERNO_XP);
  assert.equal(diver.earn(CUADERNO_XP, 'logbook:lugar:mina').gained, 0, 'the receipt holds');
  assert.equal(diver.progress.xp(), CUADERNO_XP); assert.equal(diver.progress.dives(), 0);
  assert.equal(createLogbook({ game: 'reliquia', entries: CATALOG, storage }).discover('lugar:mina').isNew, false);
  assert.ok(storage.data.has(logbookKey('reliquia')));
});
