import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../public/rules.js';
import { ATTACHMENT_SLOTS, ATTACHMENT_RULES, ATTACHMENTS, MARKERS, MELEE, canAttach, changeWeapon, cleanKit, kitStats, setSlot, slotsOf } from '../public/armory-data.js';
import { PAINT_MOUNTS } from '../../../engine/models/props/paint-arsenal.js';

test('attachment slots keep their position', () => {
  assert.equal(ATTACHMENT_SLOTS, 3);
  assert.deepEqual(slotsOf({}), [null, null, null]);
  let kit = setSlot({}, 1, 'hopper');
  assert.deepEqual(kit.attachments, [null, 'hopper', null], 'slot 1 filled first stays in slot 1');
  kit = setSlot(kit, 0, 'barrel');
  assert.deepEqual(kit.attachments, ['barrel', 'hopper', null]);
  kit = setSlot(kit, 2, 'optic');
  assert.deepEqual(kit.attachments, ['barrel', 'hopper', 'optic']);
  kit = setSlot(kit, 0, null);
  assert.deepEqual(kit.attachments, [null, 'hopper', 'optic'], 'clearing slot 0 leaves slots 1 and 2 in place');
  kit = setSlot(kit, 0, 'optic');
  assert.deepEqual(kit.attachments, ['optic', 'hopper', null], 'a part chosen for another slot moves');
  assert.deepEqual(setSlot(kit, 5, 'barrel').attachments, ['optic', 'hopper', null], 'out-of-range slots are ignored');
  assert.deepEqual(setSlot(kit, 2, 'bad').attachments, ['optic', 'hopper', null], 'unknown parts are ignored');
});

test('cleanKit dedupes, allowlists and reads old dense kits', () => {
  assert.deepEqual(cleanKit({ attachments: ['barrel', 'barrel'] }).attachments, ['barrel', null, null]);
  assert.deepEqual(cleanKit({ attachments: ['bad', 'stock'] }).attachments, [null, 'stock', null]);
  assert.deepEqual(cleanKit({ attachments: [null, 'stock'] }).attachments, [null, 'stock', null]);
  // Saved before slots, or with two slots: dense arrays land in slots 0 and 1.
  assert.deepEqual(cleanKit({ attachments: ['hopper'] }).attachments, ['hopper', null, null]);
  assert.deepEqual(cleanKit({ attachments: ['stock', 'barrel'] }).attachments, ['stock', 'barrel', null]);
  assert.deepEqual(cleanKit({ attachments: 'barrel' }).attachments, [null, null, null]);
  // A longer list (old or hostile) is packed into the three slots.
  assert.deepEqual(cleanKit({ attachments: ['barrel', 'hopper', 'stock', 'optic'] }).attachments, ['barrel', 'hopper', 'stock']);
  for (const kit of [{}, { attachments: ['barrel', 'hopper', 'stock', 'optic'] }, { attachments: [1, 2, 3, 4] }]) assert.equal(cleanKit(kit).attachments.length, ATTACHMENT_SLOTS);
  assert.deepEqual(cleanKit(cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] })), cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] }), 'idempotent');
});

test('cleanKit takes every one of the eighteen markers with every allowed combination', () => {
  assert.equal(MARKERS.length, 18);
  for (const m of MARKERS) {
    assert.equal(cleanKit({ weapon: m.id }).weapon, m.id);
    const parts = ATTACHMENT_RULES[m.id];
    for (let mask = 0; mask < 1 << parts.length; mask++) {
      const chosen = parts.filter((_, i) => mask & (1 << i)); if (chosen.length > ATTACHMENT_SLOTS) continue;
      const kit = cleanKit({ weapon: m.id, attachments: chosen });
      assert.deepEqual(kit.attachments.filter(Boolean), chosen, `${m.id} keeps ${chosen}`);
      const s = kitStats(kit);
      for (const key of ['magazine', 'reload', 'cadence', 'mobility', 'spread', 'speed', 'life', 'damage', 'zoom', 'sens']) assert.ok(Number.isFinite(s[key]), `${m.id} ${chosen} ${key}`);
    }
  }
});

test('mounts come from the model: what a marker has a mount for, it takes', () => {
  for (const m of MARKERS) {
    assert.deepEqual(ATTACHMENT_RULES[m.id], ATTACHMENTS.map(a => a.id).filter(id => PAINT_MOUNTS[m.id].includes(id)), m.id);
    for (const id of ATTACHMENT_RULES[m.id]) assert.ok(ATTACHMENTS.some(a => a.id === id));
  }
  // Every marker in today's kit has a muzzle, a feed, a stock mount and a rail or bracket.
  for (const m of MARKERS) for (const a of ATTACHMENTS) assert.equal(canAttach(m.id, a.id), !a.melee, `${m.id} ${a.id}`);
  // The melee set takes only its own three parts (grip tape, paint drips, wrist strap).
  for (const m of MELEE) for (const a of ATTACHMENTS) assert.equal(canAttach(m.id, a.id), !!a.melee, `${m.id} ${a.id}`);
  assert.equal(canAttach('nope', 'barrel'), false); assert.equal(canAttach('pistol', 'nope'), false);
});

test('a part a marker has no mount for is refused and comes off on a swap', () => {
  // No marker lacks a mount today; take the stock mount off La Lejana for this test only.
  const rules = ATTACHMENT_RULES.sniper; ATTACHMENT_RULES.sniper = rules.filter(id => id !== 'stock');
  try {
    assert.deepEqual(cleanKit({ weapon: 'sniper', attachments: ['stock', 'barrel'] }).attachments, [null, 'barrel', null]);
    const { kit, dropped } = changeWeapon({ weapon: 'pistol', attachments: ['stock', 'hopper'] }, 'sniper');
    assert.equal(kit.weapon, 'sniper'); assert.deepEqual(kit.attachments, [null, 'hopper', null]); assert.deepEqual(dropped, ['stock']);
    assert.deepEqual(setSlot({ weapon: 'sniper' }, 0, 'stock').attachments, [null, null, null]);
  } finally { ATTACHMENT_RULES.sniper = rules; }
  assert.deepEqual(changeWeapon({ weapon: 'pistol', attachments: ['barrel', null, 'optic'] }, 'rocket').dropped, []);
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

test('the room refuses a mid-round kit and says why; a number-key swap keeps the parts that fit', () => {
  const a = new Arena('plaza'); a.add(1, { name: 'Ana' }); a.add(2, { name: 'Bea' });
  assert.equal(a.kitRejection(1), ''); assert.equal(a.kitRejection(9), 'absent');
  assert.equal(a.selectKit(1, { weapon: 'pistol', attachments: ['stock', 'barrel', 'optic'] }), true);
  a.start(); a.go();
  assert.equal(a.selectKit(1, { weapon: 'rapid' }), false); assert.equal(a.kitRejection(1), 'playing');
  a.step(.05, new Map([[1, { weapon: 'lmg' }]]));
  const p = a.players[0]; assert.equal(p.kit.weapon, 'lmg'); assert.deepEqual(p.kit.attachments, ['stock', 'barrel', 'optic']);
});
