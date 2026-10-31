import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../public/rules.js';
import { ATTACHMENT_SLOTS, ATTACHMENT_RULES, ATTACHMENTS, MARKERS, canAttach, changeWeapon, cleanKit, kitStats, setSlot, slotsOf } from '../public/armory-data.js';

test('attachment slots keep their position', () => {
  assert.equal(ATTACHMENT_SLOTS, 2);
  assert.deepEqual(slotsOf({}), [null, null]);
  let kit = setSlot({}, 1, 'hopper');
  assert.deepEqual(kit.attachments, [null, 'hopper'], 'slot 1 filled first stays in slot 1');
  kit = setSlot(kit, 0, 'barrel');
  assert.deepEqual(kit.attachments, ['barrel', 'hopper']);
  kit = setSlot(kit, 0, null);
  assert.deepEqual(kit.attachments, [null, 'hopper'], 'clearing slot 0 leaves slot 1 in place');
  kit = setSlot(kit, 0, 'hopper');
  assert.deepEqual(kit.attachments, ['hopper', null], 'a part chosen for the other slot moves');
  assert.deepEqual(setSlot(kit, 5, 'barrel').attachments, ['hopper', null], 'out-of-range slots are ignored');
  assert.deepEqual(setSlot(kit, 1, 'bad').attachments, ['hopper', null], 'unknown parts are ignored');
});

test('cleanKit dedupes, allowlists and reads old dense kits', () => {
  assert.deepEqual(cleanKit({ attachments: ['barrel', 'barrel'] }).attachments, ['barrel', null]);
  assert.deepEqual(cleanKit({ attachments: ['bad', 'stock'] }).attachments, [null, 'stock']);
  assert.deepEqual(cleanKit({ attachments: [null, 'stock'] }).attachments, [null, 'stock']);
  // Saved before slots: dense arrays of one or two parts land in slots 0 and 1.
  assert.deepEqual(cleanKit({ attachments: ['hopper'] }).attachments, ['hopper', null]);
  assert.deepEqual(cleanKit({ attachments: ['stock', 'barrel'] }).attachments, ['stock', 'barrel']);
  assert.deepEqual(cleanKit({ attachments: 'barrel' }).attachments, [null, null]);
  for (const kit of [{}, { attachments: ['barrel', 'hopper', 'stock'] }, { attachments: [1, 2, 3, 4] }]) assert.equal(cleanKit(kit).attachments.length, ATTACHMENT_SLOTS);
  assert.deepEqual(cleanKit(cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] })), cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] }), 'idempotent');
});

test('canAttach is data-driven per marker', () => {
  for (const m of MARKERS) {
    assert.ok(Array.isArray(ATTACHMENT_RULES[m.id]), `${m.id} has rules`);
    for (const id of ATTACHMENT_RULES[m.id]) assert.ok(ATTACHMENTS.some(a => a.id === id));
    assert.ok(canAttach(m.id, 'barrel') && canAttach(m.id, 'hopper'));
  }
  assert.equal(canAttach('sniper', 'stock'), false); assert.equal(canAttach('bazooka', 'stock'), false);
  assert.equal(canAttach('pistol', 'stock'), true); assert.equal(canAttach('nope', 'barrel'), false); assert.equal(canAttach('pistol', 'nope'), false);
  assert.deepEqual(cleanKit({ weapon: 'sniper', attachments: ['stock', 'barrel'] }).attachments, [null, 'barrel']);
});

test('changing marker drops only the parts that no longer fit', () => {
  const { kit, dropped } = changeWeapon({ weapon: 'pistol', attachments: ['stock', 'hopper'] }, 'sniper');
  assert.equal(kit.weapon, 'sniper'); assert.deepEqual(kit.attachments, [null, 'hopper']); assert.deepEqual(dropped, ['stock']);
  assert.deepEqual(changeWeapon({ weapon: 'pistol', attachments: ['barrel', null] }, 'rocket').dropped, []);
});

test('a barrel moves a stat on every marker', () => {
  const look = s => [s.spread, s.aimSpread, s.speed * s.life, s.speed].join();
  for (const m of MARKERS) {
    const base = kitStats({ weapon: m.id }), barrel = kitStats({ weapon: m.id, attachments: ['barrel'] });
    assert.ok(barrel.speed * barrel.life > base.speed * base.life, `${m.id} reaches further`);
    assert.notEqual(look(barrel), look(base));
    if (!m.spread) assert.ok(barrel.speed > base.speed, `${m.id} fires faster with a barrel`);
  }
});

test('the room refuses a mid-round kit and says why; a number-key swap drops parts server-side', () => {
  const a = new Arena('plaza'); a.add(1, { name: 'Ana' }); a.add(2, { name: 'Bea' });
  assert.equal(a.kitRejection(1), ''); assert.equal(a.kitRejection(9), 'absent');
  assert.equal(a.selectKit(1, { weapon: 'pistol', attachments: ['stock', 'barrel'] }), true);
  a.start(); a.go();
  assert.equal(a.selectKit(1, { weapon: 'rapid' }), false); assert.equal(a.kitRejection(1), 'playing');
  a.step(.05, new Map([[1, { weapon: 'sniper' }]]));
  const p = a.players[0]; assert.equal(p.kit.weapon, 'sniper'); assert.deepEqual(p.kit.attachments, [null, 'barrel']);
});
