// The eighteen markers stay inside their class's envelope. The numbers and the
// reasons are the BALANCING section of docs/knowledge/pintura.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKERS, CLASSES, WEAPON_CYCLE, ATTACHMENTS, ATTACHMENT_RULES, ATTACHMENT_SLOTS, ARMOR, GRENADES, OPTICS, kitStats, kitRating, opticOf, shotInterval, dpsOf, cycleWeapon } from '../public/armory-data.js';
import { Arena } from '../public/rules.js';
import { PAINT_WEAPONS, PAINT_CLASSES, PAINT_OPTICS, PAINT_KIT_BORE, classOf } from '../../../engine/play/paint-arsenal.js';

// Per class: pepazos a second with every ball landing (dpsOf) and reach in metres
// (speed × life), checked for the bare marker and every allowed attachment set.
const ENVELOPE = {
  pistolas: { dps: [3, 5], range: [30, 60] },
  subfusiles: { dps: [5, 10], range: [20, 36] },
  fusiles: { dps: [4, 7], range: [45, 70] },
  ametralladoras: { dps: [5, 10], range: [30, 60] },
  escopetas: { dps: [3, 5.5], range: [8, 20] },
  francotiradores: { dps: [1.2, 2.5], range: [55, 80] },
  lanzadores: { dps: [.8, 2.5], range: [25, 50] },
  especiales: { dps: [1, 4], range: [8, 50] },
};
// No marker kills fast and far at once.
const REACH_BUDGET = 360;
const combos = parts => { const out = []; for (let mask = 0; mask < 1 << parts.length; mask++) { const c = parts.filter((_, i) => mask & (1 << i)); if (c.length <= ATTACHMENT_SLOTS) out.push(c); } return out; };

test('every marker has a model, a name from it and a class', () => {
  assert.deepEqual(MARKERS.map(m => m.id), Object.keys(PAINT_WEAPONS), 'menu order follows the kit');
  for (const m of MARKERS) {
    assert.equal(m.name, PAINT_WEAPONS[m.id]);
    assert.equal(m.class, classOf(m.id).id);
    assert.ok(CLASSES.some(c => c.id === m.class) && ENVELOPE[m.class], `${m.id} has a class with an envelope`);
    assert.ok(m.blurb, `${m.id} has a blurb`);
    assert.ok(PAINT_KIT_BORE[m.id] > 0, `${m.id} has a bore`);
    assert.ok(OPTICS[PAINT_OPTICS[m.id]], `${m.id} has a known Mira kind`);
  }
  // Classes with no marker (granadas, melee) have no chip in the armory.
  assert.deepEqual(CLASSES.map(c => c.id), PAINT_CLASSES.filter(c => c.weapons.some(id => PAINT_WEAPONS[id])).map(c => c.id));
  assert.ok(!CLASSES.some(c => c.id === 'granadas'));
});

test('every marker stays inside its class envelope, with any attachments', () => {
  for (const m of MARKERS) {
    const { dps, range } = ENVELOPE[m.class];
    for (const parts of combos(ATTACHMENT_RULES[m.id])) {
      const s = kitStats({ weapon: m.id, attachments: parts }), d = dpsOf(s), r = s.speed * s.life;
      assert.ok(d >= dps[0] && d <= dps[1], `${m.id} ${parts} dps ${d.toFixed(2)} not in ${dps}`);
      assert.ok(r >= range[0] && r <= range[1], `${m.id} ${parts} range ${r.toFixed(1)} not in ${range}`);
      assert.ok(d * r <= REACH_BUDGET, `${m.id} ${parts} dps × range ${(d * r).toFixed(0)} over ${REACH_BUDGET}`);
    }
  }
});

test('the role trade-offs hold', () => {
  for (const m of MARKERS) {
    const s = kitStats({ weapon: m.id }), d = dpsOf(s);
    // High rate of paint costs accuracy or mobility.
    if (d > 7) assert.ok(s.spread >= .08 || s.mobility <= .75, `${m.id} pays for ${d} pepazos/s`);
    // Several pellets fly short.
    if (s.pellets > 1) assert.ok(s.life <= .2 && s.speed * s.life <= 20, `${m.id} pellets fly short`);
    if (m.class === 'francotiradores') assert.ok(s.speed >= 110 && s.scope >= 2 && s.cadence >= .4 && s.aimSpread < .01, `${m.id} is a rifle`);
    if (m.class === 'lanzadores') assert.ok(s.splash > 0 && s.heavy && s.reserve > 0 && !s.sprint, `${m.id} is a launcher`);
    if (s.heavy) assert.ok(s.mobility <= .85, `${m.id} is heavy`);
  }
  const sling = kitStats({ weapon: 'slingshot' }), spray = kitStats({ weapon: 'sprayer' }), drum = kitStats({ weapon: 'revolver' });
  assert.ok(sling.magazine >= 40 && sling.reload <= 1 && sling.damage < 1, 'La China: plenty of stones, half a pepazo each');
  assert.ok(spray.magazine >= 100 && spray.damage <= .25 && shotInterval(spray.cadence) === .05, 'La Fumigadora: a stream of tiny drops');
  assert.ok(drum.magazine === 6 && drum.splash > 2 && drum.speed * drum.life >= 25, 'El Tambor: six grenades at mid range');
});

test('shotInterval is the rate the arena really fires at', () => {
  for (const m of MARKERS) {
    const g = new Arena('plaza'); g.add(1, { name: 'A' }); g.add(2, { name: 'B' }); g.selectKit(1, { weapon: m.id }); g.start(); g.go();
    const p = g.players[0]; Object.assign(p, { x: -22, z: -22 }); Object.assign(g.players[1], { x: 22, z: 22 });
    const times = [];
    for (let i = 0; i < 60 && times.length < 3; i++) { const before = p.fired; g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]])); if (p.fired > before) times.push(i); if (!p.ammo) break; }
    if (times.length > 1) assert.ok(Math.abs((times[1] - times[0]) * .05 - shotInterval(m.cadence)) < 1e-9, `${m.id} fires every ${shotInterval(m.cadence)} s`);
  }
});

test('kit ratings are bounded integers for every marker, armour, grenade and attachment set', () => {
  for (const m of MARKERS) for (const parts of combos(ATTACHMENT_RULES[m.id])) for (const armor of ARMOR) for (const grenade of GRENADES) {
    const score = kitRating({ weapon: m.id, attachments: parts, armor: armor.id, grenade: grenade.id });
    assert.ok(Number.isInteger(score) && score >= 100 && score <= 800, `${m.id} ${parts} ${armor.id} ${grenade.id}: ${score}`);
  }
});

test('the Mira: zoom, steadier aim and slower look by kind', () => {
  for (const [kind, o] of Object.entries(OPTICS)) {
    assert.ok(o.zoom >= 1 && o.zoom <= 2.5, `${kind} zoom`); assert.ok(o.aimSpread > 0 && o.aimSpread <= 1, `${kind} aimSpread`);
    assert.ok(o.sens > 0 && o.sens <= 1, `${kind} sens`);
  }
  for (const m of MARKERS) {
    const base = kitStats({ weapon: m.id }), sighted = kitStats({ weapon: m.id, attachments: ['optic'] }), o = OPTICS[opticOf(m.id)];
    assert.equal(sighted.optic, opticOf(m.id)); assert.equal(sighted.aims, true); assert.equal(sighted.sens, o.sens);
    assert.ok(Math.abs(sighted.zoom - (base.scope ? base.scope * (o.scopeBoost || 1) : o.zoom)) < 1e-9, `${m.id} zoom`);
    assert.ok(sighted.aimSpread <= (base.aimSpread ?? base.spread) + 1e-12, `${m.id} aims at least as straight`);
    assert.ok(Math.abs(sighted.mobility - (base.mobility - .02)) < 1e-9, `${m.id} carries the Mira`);
    assert.equal(base.optic, null); assert.equal(base.sens, 1);
  }
  assert.equal(kitStats({ weapon: 'sniper', attachments: ['optic'] }).zoom, 3.5 * 1.3, 'La Lejana gets the long-range scope');
  assert.ok(kitStats({ weapon: 'rapid', attachments: ['optic'] }).spread < kitStats({ weapon: 'rapid' }).spread, 'the laser tightens hip fire');
});

test('a Mira lets any marker aim on the server: steadier shot, slower walk', () => {
  const shot = (attachments, aim) => {
    const g = new Arena('plaza'); g.add(1, { name: 'A' }); g.add(2, { name: 'B' }); g.selectKit(1, { weapon: 'smg', attachments }); g.start(); g.go();
    const p = g.players[0]; Object.assign(p, { x: -22, z: -22, shots: 1 }); g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true, aim }]]));
    return { angle: Math.abs(Math.atan2(g.balls[0].vz, g.balls[0].vx)), aim: p.aim };
  };
  assert.equal(shot([], true).aim, false, 'without a Mira aiming does nothing');
  const hip = shot(['optic'], false), aimed = shot(['optic'], true);
  assert.equal(aimed.aim, true); assert.ok(aimed.angle < hip.angle * .8, 'aimed through the Mira it flies straighter');
});

test('La Corneta fans five pellets evenly across its spread', () => {
  const g = new Arena('plaza'); g.add(1, { name: 'A' }); g.add(2, { name: 'B' }); g.selectKit(1, { weapon: 'blunderbuss' }); g.start(); g.go();
  Object.assign(g.players[0], { x: -22, z: -22 }); g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]]));
  const angles = g.balls.map(b => Math.atan2(b.vz, b.vx)).sort((a, b) => a - b);
  assert.equal(angles.length, 5);
  for (let i = 0; i < 5; i++) assert.ok(Math.abs(angles[i] - (-.28 + .14 * i)) < 1e-9);
});

test('drops under a pepazo soak in: five of La Fumigadora make one, and they wash off', () => {
  const g = new Arena('plaza'); g.add(1, { name: 'A' }); g.add(2, { name: 'B' }); g.start(); g.go();
  const [a, b] = g.players; b.shield = 0;
  for (let i = 0; i < 4; i++) g.hit(b, a, a.color, {}, .2);
  assert.equal(b.paint, 0); assert.ok(Math.abs(b.soak - .8) < 1e-9);
  assert.equal(g.events.filter(e => e.type === 'hit').length, 0, 'no hit is announced before a whole pepazo');
  g.hit(b, a, a.color, {}, .2);
  assert.equal(b.paint, 1); assert.equal(b.soak, 0); assert.equal(g.events.at(-1).type, 'hit');
  g.hit(b, a, a.color, {}, .5); assert.equal(b.paint, 1);
  for (let i = 0; i < 90; i++) g.step(.05);
  assert.equal(b.soak, 0, 'four quiet seconds wash the soak off with the stain');
});

test('Z/X cycle through every marker in class order and wrap', () => {
  assert.equal(new Set(WEAPON_CYCLE).size, 18);
  assert.deepEqual(WEAPON_CYCLE, CLASSES.flatMap(c => c.weapons));
  assert.equal(cycleWeapon('pistol', 1), 'rapid'); assert.equal(cycleWeapon('pistol', -1), WEAPON_CYCLE.at(-1));
  assert.equal(cycleWeapon(WEAPON_CYCLE.at(-1), 1), 'pistol'); assert.equal(cycleWeapon('nope', 1), WEAPON_CYCLE[0]);
  let id = 'pistol'; for (let i = 0; i < WEAPON_CYCLE.length; i++) id = cycleWeapon(id, 1); assert.equal(id, 'pistol');
  assert.ok(ATTACHMENTS.some(a => a.id === 'optic'));
});
