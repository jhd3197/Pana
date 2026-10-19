import test from 'node:test';
import assert from 'node:assert/strict';
import { CaidaGame } from '../public/rules.js';
import { FIELDS, DEFAULT_OPTIONS } from '../public/options.js';
const members = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Pana ${i + 1}`, avatar: {} }));
test('reset includes the adopted map and retains all six humans', () => {
  const g = new CaidaGame(); g.syncMembers(members(6)); g.configure({ format: 'teams', mapId: 'puerto', cantos: false });
  assert(g.configure({ ...DEFAULT_OPTIONS, mapId: 'plaza' }));
  assert.equal(g.mapId, 'plaza'); assert.equal(g.options.format, 'individual'); assert.equal(g.players.length, 6);
  assert.deepEqual(g.players.map(p => p.id), members(6).map(m => m.id));
});
test('Caída shows only Individual/Equipos and sizes both formats from actual humans', () => {
  assert.deepEqual(FIELDS.find(f => f.id === 'format').choices, [['individual', 'Individual'], ['teams', 'Equipos']]);
  assert.equal(FIELDS.some(f => f.id === 'mode'), false);
  for (const format of ['individual', 'teams']) {
    const g = new CaidaGame(); g.configure({ format });
    for (const count of [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]) {
      g.syncMembers(members(count));
      const expected = format === 'teams' ? count > 4 ? 6 : 4 : count > 4 ? 6 : Math.max(2, count);
      assert.equal(g.players.length, expected); assert.equal(g.options.format, format);
      assert.deepEqual(g.players.filter(p => p.id !== null).map(p => p.id).sort(), members(count).map(m => m.id));
      assert.equal(g.scores.length, format === 'teams' ? 2 : expected);
    }
  }
});
test('switching format compacts humans from outer seats without losing identities', () => {
  const g = new CaidaGame(); g.configure({ format: 'teams' }); g.syncMembers(members(2)); g.reseat(1, 3);
  assert(g.configure({ format: 'individual' })); assert.deepEqual(g.players.map(p => p.id), [1, 2]);
  g.syncMembers(members(6)); assert(g.configure({ format: 'teams' })); assert.equal(g.players.length, 6);
  const before = g.snapshot(); assert.equal(g.configure({ mode: 'duel', mapId: 'plaza' }), false); assert.deepEqual(g.snapshot(), before);
  g.start(); const mode = g.options.mode; g.syncMembers(members(3)); assert.equal(g.options.mode, mode); assert.equal(g.players.length, 6);
});
test('shrinking a team table keeps an outer player on the same team when a matching place is free', () => {
  const g = new CaidaGame(); g.configure({ format: 'teams' }); g.syncMembers(members(6));
  g.syncMembers([members(6)[5]]);
  assert.equal(g.players.length, 4); assert.equal(g.players.find(p => p.id === 6).seat % 2, 1);
});
