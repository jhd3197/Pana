// What the friends' playtest asked for: grenades, classes and the Correa that read
// at a glance, a grape that looks like one, and a shooter who always hears a ball land.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR, FINISHES, GRENADES, cleanKit, kitStats, partDeltas } from '../public/armory-data.js';
import { PAINT_SOLIDS } from '../../../engine/play/paint-arsenal.js';
import { Arena } from '../public/rules.js';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function hue(hex) {
  const [r, g, b] = rgb(hex), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function duel(kit = {}) {
  const g = new Arena('terminal', 'normal', { mode: 'teams' });
  g.add(1, { name: 'A' }); g.add(2, { name: 'B' });
  assert.ok(g.selectKit(1, kit)); g.start(); g.go();
  const [a, b] = g.players; b.team = 1 - a.team; a.shield = b.shield = 0;
  return { g, a, b };
}

test('each grenade has its own colour and a one-line note', () => {
  assert.equal(new Set(GRENADES.map(g => g.color)).size, GRENADES.length);
  for (const g of GRENADES) {
    assert.match(g.color, /^#[0-9a-f]{6}$/, g.id);
    assert.ok(g.blurb.length <= 25, `${g.id}: "${g.blurb}" stays one short line`);
  }
  // Far apart on the wheel, so no two read as the same bomb at a glance.
  const hues = GRENADES.map(g => hue(g.color));
  for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) {
    const gap = Math.abs(hues[i] - hues[j]);
    assert.ok(Math.min(gap, 360 - gap) > 60, `${GRENADES[i].id} and ${GRENADES[j].id} are ${gap} degrees apart`);
  }
});

test('every class names its perk on the card', () => {
  const perks = Object.fromEntries(ARMOR.map(c => [c.id, c.perk]));
  assert.deepEqual(perks, { base: 'Equilibrado', rapido: 'Más velocidad', tanque: 'Chaleco', regenera: 'Cura rápido', sigiloso: 'Pasos quietos', granadero: '2 granadas' });
});

test('Balanceado sprints a second longer and Rápido refills its sprint sooner', () => {
  const sprint = armor => { const { sprintDrain, sprintRegen } = kitStats({ armor }); return [sprintDrain, sprintRegen]; };
  assert.deepEqual(sprint('base'), [4, 5]); assert.deepEqual(sprint('rapido'), [3, 3]); assert.deepEqual(sprint('tanque'), [3, 5]);
  const left = armor => { const { g, a } = duel({ armor }); for (let i = 0; i < 40; i++) g.step(.05, new Map([[1, { x: 1, sprint: true }]])); return a.stamina; };
  assert.ok(left('base') > .4 && left('tanque') < .4, 'two seconds of sprint: half left against a third');
});

test('a Regenera who knocks a rival out washes a pepazo off', () => {
  const after = armor => {
    const { g, a, b } = duel({ armor }); a.paint = 2; a.stains = ['#111', '#222'];
    g.hit(b, a, a.color, {}, Infinity); assert.ok(b.respawn > 0);
    return [a.paint, a.stains.length];
  };
  assert.deepEqual(after('regenera'), [1, 1]); assert.deepEqual(after('base'), [2, 2]);
});

test('La Correa trades mobility for swings, and for the return on La Chancleta', () => {
  const chips = weapon => Object.fromEntries(partDeltas(cleanKit({ weapon }), 'pommel', 'strap').map(d => [d.key, d]));
  const bat = chips('bat');
  assert.ok(bat.swing.gain && bat.swing.delta >= .3, `El Bate swings ${bat.swing.delta}/s faster`);
  assert.ok(!bat.mobility.gain); assert.equal(Math.round(bat.mobility.delta), -4);
  const sandal = chips('sandal');
  assert.ok(sandal.recall.gain); assert.ok(Math.abs(sandal.recall.delta + 1.2) < 1e-9, 'the chancla is back in about half the time');
  assert.ok(sandal.swing.gain && sandal.swing.delta > 0, 'and it swings faster too');
  assert.ok(!sandal.mobility.gain); assert.deepEqual(Object.keys(sandal), ['recall', 'swing', 'mobility']);
});

test('Uva is a real grape, on the finish and the solid camo', () => {
  const uva = FINISHES.find(f => f.id === 'uva').color;
  assert.equal(PAINT_SOLIDS['liso-uva'], uva);
  const [r, g, b] = rgb(uva), h = hue(uva);
  assert.ok(h >= 262 && h <= 290, `purple, not periwinkle or magenta: hue ${h}`);
  assert.ok(g < 80 && b < 190 && r < b, `deep, not lavender: ${uva}`);
});

test('a ball that only soaks in still tells the shooter; a whole hit says how many pepazos', () => {
  const { g, a, b } = duel();
  g.hit(b, a, a.color, { weapon: 'sprayer' }, .2);
  assert.equal(g.events.at(-1).type, 'soak'); assert.equal(g.events.at(-1).owner, a.id); assert.equal(b.paint, 0);
  g.hit(b, a, a.color, { weapon: 'sixshooter' }, 2);
  assert.equal(g.events.at(-1).type, 'hit'); assert.equal(g.events.at(-1).damage, 2);
  g.hit(b, a, a.color, { weapon: 'bazooka' }, Infinity);
  assert.equal(g.events.at(-1).type, 'out'); assert.equal(g.events.at(-1).damage, null);
});
