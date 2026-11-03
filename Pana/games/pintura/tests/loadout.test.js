// Two guns and a class: Arma 1, Arma 2 (a sidearm), the swap in the simulation,
// old saves migrating, and every class's effect computed by the arena itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, SWAP_TIME } from '../public/rules.js';
import { rivalMark } from '../public/minimap.js';
import { ARMOR, LEGACY_ARMOR, MARKERS, MELEE, WEAPONS, SECONDARY, DEFAULT_SECONDARY, SLOT_RULES, GRENADES, armorOf, changeWeapon, cleanKit, cycleWeapon, gunOf, kitRating, kitStats, partsOf, setPart, dpsOf } from '../public/armory-data.js';

const duel = (kit = {}, options = {}) => {
  const g = new Arena('plaza', 'normal', { lives: 0, ...options }); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} });
  g.selectKit(1, kit); g.start(); g.go(); const [a, b] = g.players; Object.assign(a, { x: -22, z: -22 }); Object.assign(b, { x: 22, z: 22 }); return { g, a, b };
};
const step = (g, input = {}, n = 1) => { for (let i = 0; i < n; i++) g.step(.05, new Map([[1, { ax: 1, az: 0, ...input }]])); };
const allKits = weapon => Object.entries(SLOT_RULES[weapon]).reduce((kits, [slot, ids]) => kits.flatMap(k => [k, ...ids.map(id => ({ ...k, [slot]: id }))]), [{}]);

test('Arma 2 holds only a sidearm: the pistols and the melee set', () => {
  assert.deepEqual([...SECONDARY].sort(), [...MARKERS.filter(m => m.class === 'pistolas'), ...MELEE].map(w => w.id).sort());
  assert.equal(DEFAULT_SECONDARY, 'sandal'); assert.ok(SECONDARY.includes(DEFAULT_SECONDARY));
  assert.equal(cleanKit({ weapon2: 'carbine' }).weapon2, DEFAULT_SECONDARY, 'a long gun never sits in Arma 2');
  assert.equal(cleanKit({ weapon2: 'sixshooter' }).weapon2, 'sixshooter');
  const kit = cleanKit({ weapon: 'carbine' });
  assert.deepEqual(changeWeapon(kit, 'rocket', 1).kit, kit, 'Arma 2 refuses a launcher');
  assert.equal(changeWeapon(kit, 'pistol', 1).kit.weapon2, 'pistol');
  assert.equal(changeWeapon(kit, 'bat', 0).kit.weapon, 'bat', 'Arma 1 takes any weapon, melee included');
  for (const id of WEAPONS.map(w => w.id)) assert.ok(SECONDARY.includes(cycleWeapon(id, 1, 1)), `Arma 2 cycles only sidearms from ${id}`);
  // Each gun has its own typed slots.
  let two = setPart(cleanKit({ weapon: 'carbine', weapon2: 'pistol' }), 'optic', 'laser', 1);
  assert.equal(two.slots2.optic, 'laser'); assert.equal(two.slots.optic, null);
  two = setPart(two, 'optic', 'scope', 0); assert.deepEqual([partsOf(two, 0), partsOf(two, 1)], [['scope'], ['laser']]);
  assert.equal(kitStats(two, {}, 1).id, 'pistol'); assert.equal(kitStats(two, {}, 1).optic, 'laser'); assert.equal(kitStats(two, {}, 0).optic, 'scope');
});

test('pistol-only rooms make both guns La Chispa', () => {
  const kit = { weapon: 'sniper', weapon2: 'bat' };
  assert.equal(kitStats(kit, { weapons: 'pistol' }, 0).id, 'pistol'); assert.equal(kitStats(kit, { weapons: 'pistol' }, 1).id, 'pistol');
  const { g, a } = duel(kit, { weapons: 'pistol' });
  assert.equal(a.weapon, 'pistol'); step(g, { hand: 1 }, 1); assert.equal(a.hand, 1); assert.equal(a.weapon, 'pistol');
  step(g, { hand: 1, weapon: 'sandal' }, 2); assert.equal(a.kit.weapon2, 'bat', 'no weapon change mid-round in a pistol room');
});

test('old and hostile saves load into the new shape and never throw', () => {
  const old = cleanKit({ weapon: 'carbine', attachments: ['barrel', 'optic'], armor: 'padded', grenade: 'chispita' });
  assert.deepEqual(old.slots, { optic: 'holo', barrel: 'barrel', hopper: null, stock: null });
  assert.equal(old.weapon2, DEFAULT_SECONDARY); assert.deepEqual(old.slots2, { grip: null, head: null, pommel: null }); assert.equal(old.armor, 'tanque');
  for (const [from, to] of Object.entries(LEGACY_ARMOR)) assert.equal(cleanKit({ armor: from }).armor, to, `${from} → ${to}`);
  assert.equal(armorOf('nope').id, 'base'); assert.equal(armorOf({}).id, 'base'); assert.equal(armorOf('__proto__').id, 'base');
  const shape = Object.keys(cleanKit());
  for (const value of [null, undefined, 7, 'kit', [], [1, 2], { weapon2: ['pistol'] }, { weapon2: 'pistol', slots2: 'laser' }, { slots2: [1, 2] }, { slots2: { optic: { id: 'laser' } } },
    { slots2: { __proto__: { optic: 'laser' } } }, JSON.parse('{"__proto__":{"weapon2":"bat"},"armor":"constructor","weapon":"toString"}'), { armor: ['tanque'] }, { weapon: 'sandal', weapon2: 'sandal', slots2: { head: 'drip', grip: 'barrel' } }]) {
    const kit = cleanKit(value);
    assert.deepEqual(Object.keys(kit), shape, JSON.stringify(value));
    assert.ok(SECONDARY.includes(kit.weapon2)); assert.deepEqual(Object.keys(kit.slots2), Object.keys(SLOT_RULES[kit.weapon2]));
    for (const [slot, id] of Object.entries(kit.slots2)) assert.ok(id === null || SLOT_RULES[kit.weapon2][slot].includes(id));
    assert.ok(ARMOR.some(c => c.id === kit.armor));
    assert.deepEqual(cleanKit(JSON.parse(JSON.stringify(kit))), kit, 'the next save loads back the same');
    assert.ok(Number.isFinite(kitStats(value, {}, 1).mobility));
  }
  assert.deepEqual(cleanKit({ weapon: 'sandal', weapon2: 'sandal', slots2: { head: 'drip', grip: 'barrel' } }).slots2, { grip: null, head: 'drip', pommel: null });
  assert.equal(gunOf({ weapon2: 'maraca' }, 1).weapon, 'maraca');
});

test('the room migrates a kit it is sent and the swap keeps each gun its own pepas', () => {
  const { g, a } = duel({ weapon: 'carbine', weapon2: 'pistol', armor: 'wind' });
  assert.equal(a.kit.armor, 'rapido'); assert.equal(a.kit.weapon2, 'pistol');
  assert.equal(a.hand, 0); assert.equal(a.weapon, 'carbine'); assert.equal(a.ammo, kitStats(a.kit).magazine); assert.deepEqual(a.spare, { ammo: 12, reserve: 0 });
  step(g, { fire: true }, 10); const left = a.ammo; assert.ok(left < 24 && left > 0);
  step(g, { hand: 1, fire: true }); assert.equal(a.hand, 1); assert.equal(a.weapon, 'pistol'); assert.equal(a.ammo, 12, 'the pistol is full');
  assert.deepEqual(a.spare, { ammo: left, reserve: 0 }, 'the carbine keeps its pepas holstered');
  // The drawn gun waits SWAP_TIME before it fires.
  let waited = 0; while (a.ammo === 12 && waited < 40) { step(g, { hand: 1, fire: true }); waited++; }
  assert.ok(Math.abs(waited * .05 - SWAP_TIME) <= .051, `fires after ${waited * .05} s`);
  step(g, { hand: 0 }); assert.equal(a.weapon, 'carbine'); assert.equal(a.ammo, left);
  // A reload in progress is dropped by the swap; the room never trusts a hand it does not know.
  a.ammo = 0; step(g, { hand: 0 }, 10); assert.ok(a.reload > 0); step(g, { hand: 1 }); assert.equal(a.reload, 0);
  step(g, { hand: 7 }); assert.equal(a.hand, 1);
  // A new round starts on Arma 1, both guns full.
  g.phase = 'lobby'; g.start(); g.go(); assert.equal(g.players[0].hand, 0); assert.equal(g.players[0].ammo, kitStats(a.kit).magazine);
});

test('Arma 2 changes weapon from the input only to another sidearm', () => {
  const { g, a } = duel({ weapon: 'carbine', weapon2: 'sandal' });
  step(g, { hand: 1 }, 2); step(g, { hand: 1, weapon: 'sniper' }, 2); assert.equal(a.kit.weapon2, 'sandal');
  step(g, { hand: 1, weapon: 'bat' }, 2); assert.equal(a.kit.weapon2, 'bat'); assert.equal(a.kit.weapon, 'carbine'); assert.equal(a.weapon, 'bat');
});

test('every class pays for what it gets', () => {
  const base = ARMOR[0], keys = ['mobility', 'toughness', 'regen', 'stepNoise', 'markerScale', 'grenades', 'grenadeRecharge'];
  // Higher is better except for the steps, the dot and the recharge.
  const better = (k, a, b) => ['stepNoise', 'markerScale', 'grenadeRecharge'].includes(k) ? a < b : a > b;
  assert.equal(base.id, 'base'); assert.ok(ARMOR.length >= 6);
  for (const c of ARMOR) {
    for (const k of keys) assert.ok(Number.isFinite(c[k]), `${c.id} ${k}`);
    assert.ok(c.name && c.icon, `${c.id} has a name and an icon`);
    if (c === base) continue;
    assert.ok(keys.some(k => better(k, c[k], base[k])), `${c.id} gains something`);
    assert.ok(keys.some(k => better(k, base[k], c[k])), `${c.id} pays for it`);
  }
});

test('every class with every weapon and part set stays bounded and none dominates', () => {
  for (const w of WEAPONS) for (const slots of allKits(w.id)) {
    const ratings = ARMOR.map(c => kitRating({ weapon: w.id, slots, armor: c.id }));
    for (const r of ratings) assert.ok(Number.isInteger(r) && r >= 100 && r <= 800, `${w.id} ${r}`);
    assert.ok(Math.max(...ratings) - Math.min(...ratings) <= 40, `${w.id} ${JSON.stringify(slots)} class spread ${ratings}`);
    for (const c of ARMOR) {
      const s = kitStats({ weapon: w.id, slots, armor: c.id }), plain = kitStats({ weapon: w.id, slots });
      assert.ok(s.toughness >= 1 && s.mobility > .4 && s.mobility < 1.35, `${w.id} ${c.id}`);
      assert.equal(dpsOf(s), dpsOf(plain), 'a class never changes the paint a gun puts out');
      for (const g of GRENADES) assert.ok(kitRating({ weapon: w.id, slots, armor: c.id, grenade: g.id }) <= 800);
    }
  }
});

test('the arena computes every class effect from the validated kit', () => {
  const walk = armor => { const { g, a } = duel({ armor }); const from = a.x; step(g, { x: 1, z: 0, speed: 99, mobility: 9 }, 10); return a.x - from; };
  assert.ok(walk('rapido') > walk('base') && walk('base') > walk('tanque'), 'Rápido walks further than Balanceado, Tanque less');
  // Aguante: the room's 3, plus or minus the class.
  const take = armor => { const { g, a, b } = duel({}, {}); g.phase = 'lobby'; assert.ok(g.selectKit(2, { armor, toughness: 99 })); g.start(); g.go(); const v = g.players[1]; v.shield = 0; let n = 0; while (!v.respawn && n < 10) { g.hit(v, g.players[0], '#f00', {}, 1); n++; } return n; };
  assert.deepEqual([take('rapido'), take('base'), take('tanque')], [2, 3, 4]);
  // Regenera washes paint off sooner; Sigiloso later.
  const wash = armor => { const { g, a } = duel({ armor }); a.shield = 0; g.hit(a, g.players[1], '#f00', {}, 1); let n = 0; while (a.paint && n < 200) { step(g); n++; } return n; };
  assert.ok(wash('regenera') < wash('base') && wash('base') < wash('sigiloso'));
  // Granadero carries two and gets one back sooner; a thrown grenade comes back for everyone.
  const { g, a } = duel({ armor: 'granadero' });
  assert.equal(a.grenades, 2); step(g, { grenade: true }); step(g); assert.equal(a.grenades, 1); assert.equal(a.grenadeReady, true);
  step(g, { grenade: true }); assert.equal(a.grenades, 0); assert.equal(a.grenadeReady, false);
  step(g, {}, Math.ceil(18 / .05) + 1); assert.equal(a.grenades, 1); assert.equal(a.grenadeReady, true);
  const plain = duel({}); step(plain.g, { grenade: true }); assert.equal(plain.a.grenades, 0); step(plain.g, {}, Math.ceil(18 / .05) + 1); assert.equal(plain.a.grenades, 0, 'Balanceado waits longer');
  step(plain.g, {}, Math.ceil(12 / .05) + 1); assert.equal(plain.a.grenades, 1);
  // Sigiloso: quieter steps and a smaller dot, published by the room for the other clients.
  const quiet = duel({ armor: 'sigiloso' }).a; assert.ok(quiet.noise < 1 && quiet.mark < 1);
  assert.equal(duel({ armor: 'tanque' }).a.noise, 1.25);
  // The minimap reads the room's `mark`, never trusting a hostile one.
  assert.equal(rivalMark(quiet), .55); for (const bad of [undefined, -1, NaN, 'x', 0]) assert.equal(rivalMark({ mark: bad }), 1); assert.equal(rivalMark({ mark: 99 }), 2);
});

test('bots play every class and both hands without breaking', () => {
  for (const c of ARMOR) {
    const g = new Arena('plaza', 'experto', { lives: 0 }); g.add(1, { name: 'A', avatar: {} }); g.add(1001, { name: 'Bot', avatar: {}, bot: true });
    g.selectKit(1, { armor: c.id, weapon2: 'pistol' }); g.players[1].kit = cleanKit({ armor: c.id, weapon: 'smg' }); g.start(); g.go();
    for (let i = 0; i < 200; i++) g.step(.05, new Map([[1, { hand: i % 40 < 20 ? 0 : 1, fire: true, ax: 1, az: 0 }]]));
    for (const p of g.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.ammo), c.id);
  }
});
