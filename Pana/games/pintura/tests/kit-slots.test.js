import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../public/rules.js';
import { SLOTS, SLOT_RULES, PARTS, OPTICS, MARKERS, MELEE, WEAPONS, canFit, changeWeapon, cleanKit, kitStats, kitModel, opticOf, partOf, partsOf, setPart, slotsFor } from '../public/armory-data.js';
import { PAINT_MOUNTS, PAINT_OPTICS } from '../../../engine/models/props/paint-arsenal.js';
import { ICONS } from '../../../engine/icons.js';

// Every kit a weapon allows: one choice (or none) per slot.
const allKits = weapon => Object.entries(SLOT_RULES[weapon]).reduce((kits, [slot, ids]) => kits.flatMap(k => [k, ...ids.map(id => ({ ...k, [slot]: id }))]), [{}]);

test('a marker has four typed slots, a melee weapon its three', () => {
  for (const m of MARKERS) assert.deepEqual(slotsFor(m.id).map(s => s.id), ['optic', 'barrel', 'hopper', 'stock'], m.id);
  for (const m of MELEE) assert.deepEqual(slotsFor(m.id).map(s => s.id), ['grip', 'head', 'pommel'], m.id);
  assert.deepEqual(cleanKit({}).slots, { optic: null, barrel: null, hopper: null, stock: null });
  assert.deepEqual(cleanKit({ weapon: 'bat' }).slots, { grip: null, head: null, pommel: null });
  assert.deepEqual(slotsFor('nope'), []);
});

test('each slot takes only the parts declared for that weapon', () => {
  for (const w of WEAPONS) for (const [slot, ids] of Object.entries(SLOT_RULES[w.id])) {
    assert.ok(ids.length > 0, `${w.id} ${slot} has options`);
    for (const id of ids) { assert.equal(partOf(id).slot, slot, `${w.id}: ${id} belongs in ${slot}`); assert.ok(PAINT_MOUNTS[w.id].includes(partOf(id).part), `${w.id} has a mount for ${id}`); }
    for (const p of PARTS) if (!ids.includes(p.id)) assert.equal(setPart({ weapon: w.id }, slot, p.id).slots[slot], null, `${w.id} refuses ${p.id} in ${slot}`);
  }
  // A part never fits another slot, and unknown slots or parts change nothing.
  assert.equal(setPart({}, 'barrel', 'hopper').slots.barrel, null);
  assert.deepEqual(setPart({}, 'nope', 'barrel').slots, cleanKit({}).slots);
  assert.equal(canFit('pistol', 'optic', 'scope'), false); assert.equal(canFit('nope', 'optic', 'dot'), false);
  // Small markers carry small sights and the small hopper; the long ones get a scope.
  assert.deepEqual(SLOT_RULES.pistol.optic, ['dot', 'laser']); assert.deepEqual(SLOT_RULES.pistol.hopper, ['minihopper']);
  assert.deepEqual(SLOT_RULES.sniper.optic, ['scope']); assert.deepEqual(SLOT_RULES.sniper.hopper, ['minihopper', 'hopper']);
  assert.ok(SLOT_RULES.carbine.optic.includes('scope') && !SLOT_RULES.pistol.optic.includes('scope'));
  for (const id of ['rocket', 'bazooka', 'revolver']) assert.deepEqual(SLOT_RULES[id].hopper, ['hopper'], `${id} only takes the big hopper`);
});

test('every marker takes its stock Mira first', () => {
  for (const m of MARKERS) { assert.equal(SLOT_RULES[m.id].optic[0], PAINT_OPTICS[m.id], m.id); assert.equal(opticOf(m.id), PAINT_OPTICS[m.id]); }
  assert.equal(opticOf('bat'), null);
});

test('every part has a slot, a name, an icon and a model piece', () => {
  for (const s of SLOTS) { assert.ok(s.name && ICONS[s.icon], `${s.id} slot`); assert.ok(PARTS.some(p => p.slot === s.id), `${s.id} has parts`); }
  for (const p of PARTS) {
    assert.ok(SLOTS.some(s => s.id === p.slot), `${p.id} slot`); assert.ok(p.name, `${p.id} name`); assert.ok(ICONS[p.icon], `${p.id} icon ${p.icon}`);
    assert.ok(Object.values(PAINT_MOUNTS).some(m => m.includes(p.part)), `${p.id} is drawn as ${p.part} on a mount`);
    assert.ok(WEAPONS.some(w => canFit(w.id, p.slot, p.id)), `${p.id} fits some weapon`);
  }
  assert.equal(new Set(PARTS.map(p => p.id)).size, PARTS.length);
  // The model draws the chosen Mira kind and the hopper's size.
  assert.deepEqual(kitModel({ weapon: 'carbine', slots: { optic: 'scope', hopper: 'minihopper' } }), { attachments: ['optic', 'hopper'], opticKind: 'scope', hopperScale: .72 });
  assert.deepEqual(kitModel({ weapon: 'carbine', slots: { hopper: 'hopper', stock: 'stock' } }), { attachments: ['hopper', 'stock'], opticKind: null, hopperScale: 1 });
  assert.deepEqual(kitModel({ weapon: 'bat', slots: { grip: 'tape', pommel: 'strap' } }).attachments, ['tape', 'strap']);
});

test('the small hopper holds less and reloads faster; the big one the other way', () => {
  for (const m of MARKERS) {
    const base = kitStats({ weapon: m.id }), rules = SLOT_RULES[m.id].hopper;
    if (rules.includes('minihopper')) {
      const small = kitStats({ weapon: m.id, slots: { hopper: 'minihopper' } });
      assert.ok(small.magazine < base.magazine && small.magazine >= 1 && Number.isInteger(small.magazine), `${m.id} small ${small.magazine}`);
      assert.ok(small.reload < base.reload && small.mobility > base.mobility, `${m.id} small is quick and light`);
    }
    if (rules.includes('hopper')) {
      const big = kitStats({ weapon: m.id, slots: { hopper: 'hopper' } });
      assert.ok(big.reload > base.reload && big.mobility < base.mobility, `${m.id} big is slow and heavy`);
      if (base.reserve != null) assert.equal(big.reserve, base.reserve + 1, `${m.id} carries one more round`);
      else assert.ok(big.magazine > base.magazine && Number.isInteger(big.magazine), `${m.id} big ${big.magazine}`);
    }
  }
  assert.equal(kitStats({ weapon: 'carbine', slots: { hopper: 'minihopper' } }).magazine, 17);
  assert.equal(kitStats({ weapon: 'carbine', slots: { hopper: 'hopper' } }).magazine, 34);
});

test('the Mira chosen sets the aim: zoom, steadiness and look speed', () => {
  const look = kind => kitStats({ weapon: 'carbine', slots: { optic: kind } });
  const dot = look('dot'), holo = look('holo'), scope = look('scope');
  assert.equal(dot.optic, 'dot'); assert.equal(holo.optic, 'holo'); assert.equal(scope.optic, 'scope');
  assert.equal(dot.zoom, OPTICS.dot.zoom); assert.equal(holo.zoom, OPTICS.holo.zoom); assert.equal(scope.zoom, OPTICS.scope.zoom);
  assert.ok(scope.zoom > holo.zoom && holo.zoom > dot.zoom);
  assert.ok(scope.aimSpread < holo.aimSpread && holo.aimSpread < dot.aimSpread, 'a scope aims steadier');
  assert.ok(scope.sens < holo.sens && holo.sens < dot.sens, 'and turns slower');
  // The laser also tightens hip fire; a scoped marker boosts its own scope.
  assert.ok(kitStats({ weapon: 'pistol', slots: { optic: 'laser' } }).spread <= kitStats({ weapon: 'pistol' }).spread);
  assert.ok(kitStats({ weapon: 'smg', slots: { optic: 'laser' } }).spread < kitStats({ weapon: 'smg' }).spread);
  assert.ok(Math.abs(kitStats({ weapon: 'marksman', slots: { optic: 'scope' } }).zoom - 2.2 * 1.3) < 1e-9);
});

test('old saved kits load into the typed slots', () => {
  // Pre-typed kits: three positional slots of generic parts.
  assert.deepEqual(cleanKit({ weapon: 'carbine', attachments: ['barrel', 'hopper', null] }).slots, { optic: null, barrel: 'barrel', hopper: 'hopper', stock: null });
  assert.deepEqual(cleanKit({ weapon: 'carbine', attachments: [null, 'stock', 'optic'] }).slots, { optic: 'holo', barrel: null, hopper: null, stock: 'stock' }, 'the old Mira is the stock one');
  assert.deepEqual(cleanKit({ weapon: 'sniper', attachments: ['optic'] }).slots.optic, 'scope');
  assert.deepEqual(cleanKit({ weapon: 'rapid', attachments: ['optic', 'hopper'] }).slots, { optic: 'laser', barrel: null, hopper: null, stock: null }, 'the big hopper does not fit Las Gemelas and is dropped');
  assert.deepEqual(cleanKit({ weapon: 'rocket', attachments: [null, 'hopper', 'optic'] }).slots, { optic: 'holo', barrel: null, hopper: 'hopper', stock: null });
  assert.deepEqual(cleanKit({ weapon: 'sandal', attachments: ['strap', null, 'drip'] }).slots, { grip: null, head: 'drip', pommel: 'strap' });
  assert.deepEqual(cleanKit({ weapon: 'bat', attachments: ['barrel', 'tape'] }).slots, { grip: 'tape', head: null, pommel: null }, 'a marker part on a melee weapon is dropped');
  // Older dense lists, duplicates and a fourth part.
  assert.deepEqual(cleanKit({ weapon: 'lmg', attachments: ['barrel', 'barrel', 'hopper', 'stock', 'optic'] }).slots, { optic: 'dot', barrel: 'barrel', hopper: 'hopper', stock: 'stock' });
  // The new shape wins over a stale list; saving writes only `slots`.
  const kit = cleanKit({ weapon: 'carbine', slots: { optic: 'scope' }, attachments: ['barrel'] });
  assert.deepEqual(kit.slots, { optic: 'scope', barrel: null, hopper: null, stock: null }); assert.equal('attachments' in kit, false);
  assert.deepEqual(cleanKit(JSON.parse(JSON.stringify(kit))), kit, 'a saved kit loads back the same');
  assert.deepEqual(cleanKit(cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] })), cleanKit({ weapon: 'rapid', attachments: [null, 'stock'] }), 'idempotent');
});

test('hostile kits never throw and never fit what the weapon refuses', () => {
  const hostile = [null, 7, 'kit', [], { attachments: 'barrel' }, { attachments: [1, {}, [], 'optic', '__proto__', 'constructor'] }, { attachments: Array(10000).fill('barrel') },
    { slots: ['barrel'] }, { slots: 'scope' }, { slots: { optic: 'scope', barrel: 'hopper', hopper: 'big', stock: { id: 'stock' }, toString: 'x' } },
    JSON.parse('{"slots":{"__proto__":{"optic":"scope"}},"weapon":"__proto__"}'), { weapon: 'pistol', slots: { optic: 'scope', hopper: 'hopper' } },
    { weapon: 'bat', slots: { optic: 'dot', grip: 'drip' } }, { weapon: { id: 'sniper' }, slots: null }];
  for (const value of hostile) {
    const kit = cleanKit(value);
    assert.ok(WEAPONS.some(w => w.id === kit.weapon));
    assert.deepEqual(Object.keys(kit.slots), Object.keys(SLOT_RULES[kit.weapon]));
    for (const [slot, id] of Object.entries(kit.slots)) assert.ok(id === null || canFit(kit.weapon, slot, id), `${JSON.stringify(value)?.slice(0, 60)}: ${slot} ${id}`);
    assert.ok(Number.isFinite(kitStats(value).mobility));
  }
  assert.deepEqual(cleanKit({ weapon: 'pistol', slots: { optic: 'scope', hopper: 'hopper' } }).slots, { optic: null, barrel: null, hopper: null, stock: null });
  assert.equal(cleanKit({ attachments: [1, 'optic'] }).slots.optic, 'dot');
});

test('every allowed kit of every weapon gives finite stats', () => {
  assert.equal(MARKERS.length, 18);
  for (const w of WEAPONS) for (const slots of allKits(w.id)) {
    const kit = cleanKit({ weapon: w.id, slots });
    assert.deepEqual(Object.fromEntries(Object.entries(kit.slots).filter(([, id]) => id)), slots, `${w.id} keeps ${JSON.stringify(slots)}`);
    const s = kitStats(kit);
    for (const key of ['magazine', 'reload', 'cadence', 'mobility', 'spread', 'speed', 'life', 'damage', 'zoom', 'sens']) assert.ok(Number.isFinite(s[key]), `${w.id} ${JSON.stringify(slots)} ${key}`);
  }
});

test('a new weapon keeps what fits, swaps the Mira for its own and drops the rest', () => {
  let r = changeWeapon({ weapon: 'carbine', slots: { optic: 'scope', barrel: 'barrel', hopper: 'hopper', stock: 'stock' } }, 'pistol');
  assert.deepEqual(r.kit.slots, { optic: 'dot', barrel: 'barrel', hopper: null, stock: 'stock' }); assert.deepEqual(r.dropped, ['hopper']);
  r = changeWeapon({ weapon: 'carbine', slots: { optic: 'dot', hopper: 'minihopper' } }, 'smg');
  assert.deepEqual(r.kit.slots, { optic: 'dot', barrel: null, hopper: 'minihopper', stock: null }); assert.deepEqual(r.dropped, []);
  r = changeWeapon({ weapon: 'carbine', slots: { optic: 'dot', barrel: 'barrel' } }, 'bat');
  assert.deepEqual(r.kit.slots, { grip: null, head: null, pommel: null }); assert.deepEqual(r.dropped, ['dot', 'barrel']);
  assert.deepEqual(partsOf(changeWeapon({ weapon: 'smg', slots: { hopper: 'minihopper' } }, 'rocket').kit), []);
});

test('a barrel moves a stat on every marker', () => {
  const look = s => [s.spread, s.aimSpread, s.speed * s.life, s.speed].join();
  for (const m of MARKERS) {
    const base = kitStats({ weapon: m.id }), barrel = kitStats({ weapon: m.id, slots: { barrel: 'barrel' } });
    assert.ok(barrel.speed * barrel.life > base.speed * base.life, `${m.id} reaches further`);
    assert.notEqual(look(barrel), look(base));
    if (!m.spread) assert.ok(barrel.speed > base.speed, `${m.id} fires faster with a barrel`);
  }
});

test('the room refuses a mid-round kit and says why; a number-key swap keeps the parts that fit', () => {
  const a = new Arena('plaza'); a.add(1, { name: 'Ana' }); a.add(2, { name: 'Bea' });
  assert.equal(a.kitRejection(1), ''); assert.equal(a.kitRejection(9), 'absent');
  assert.equal(a.selectKit(1, { weapon: 'pistol', slots: { stock: 'stock', barrel: 'barrel', optic: 'laser', hopper: 'minihopper' } }), true);
  a.start(); a.go();
  assert.equal(a.selectKit(1, { weapon: 'rapid' }), false); assert.equal(a.kitRejection(1), 'playing');
  a.step(.05, new Map([[1, { weapon: 'lmg' }]]));
  const p = a.players[0]; assert.equal(p.kit.weapon, 'lmg'); assert.deepEqual(p.kit.slots, { optic: 'dot', barrel: 'barrel', hopper: 'minihopper', stock: 'stock' });
  // A server room also takes an old-format kit from a stale client.
  const b = new Arena('plaza'); b.add(1, { name: 'Ana' });
  assert.equal(b.selectKit(1, { weapon: 'rocket', attachments: [null, 'hopper', 'optic'] }), true);
  assert.deepEqual(b.players[0].kit.slots, { optic: 'holo', barrel: null, hopper: 'hopper', stock: null });
});
