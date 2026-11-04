// The diving suit is looks only: every seat reads as a different colour, what
// would poke through the helmet is off, the head fits behind the porthole, and
// nothing that decides play can even see the suit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLASS, HELMET, SEAT_COLORS, SUIT_HEAD, SUIT_PARTS, TONES, portRadius, seatColor, suitedAvatar } from '../public/suit-look.js';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const apart = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test('every seat wears a colour clearly its own, and seats wrap around', () => {
  assert.equal(new Set(SEAT_COLORS).size, 8);
  for (const [i, a] of SEAT_COLORS.entries()) for (const b of SEAT_COLORS.slice(i + 1)) assert.ok(apart(a, b) > 30, `${a} and ${b} look alike`);
  for (const [i, a] of SEAT_COLORS.slice(0, 4).entries()) for (const b of SEAT_COLORS.slice(i + 1, 4)) assert.ok(apart(a, b) > 80, `seats ${a} and ${b} are too close for a small party`);
  assert.equal(seatColor(8), seatColor(0)); assert.equal(seatColor(undefined), SEAT_COLORS[0]);
  for (const c of SEAT_COLORS) { assert.ok(apart(c, TONES.boot) > 100, `${c} melts into the boots`); assert.ok(apart(c, TONES.brass) > 55, `${c} melts into the brass`); }
});

test('the suited avatar keeps the face and takes off what clips the helmet', () => {
  const glasses = 'sol', fur = '#d4914f', extras = { pecas: true };
  const worn = suitedAvatar({ fur, glasses, face: 'wow', hat: 'corona', outfit: 'chef', extra: 'cadena',
    wardrobe: { fur, glasses: 'sun', face: 'laugh', extras, hat: 'copa', top: 'chef', print: 'x', neck: 'cadena', back: 'mochila', wrist: true } });
  assert.deepEqual([worn.fur, worn.glasses, worn.face], [fur, glasses, 'wow']);
  assert.deepEqual([worn.hat, worn.outfit, worn.extra], ['none', 'franela', 'none']);
  assert.deepEqual([worn.wardrobe.glasses, worn.wardrobe.face, worn.wardrobe.extras], ['sun', 'laugh', extras]);
  assert.deepEqual([worn.wardrobe.hat, worn.wardrobe.top, worn.wardrobe.neck, worn.wardrobe.back], ['none', 'shirt', 'none', 'none']);
  assert.equal(suitedAvatar(undefined).hat, 'none');
  const saved = { hat: 'corona', wardrobe: { hat: 'copa' } }; suitedAvatar(saved);
  assert.deepEqual(saved, { hat: 'corona', wardrobe: { hat: 'copa' } }, 'the saved look is not touched');
});

test('the helmet holds the head, ears and muzzle included, and the porthole shows the face', () => {
  // Extremes of the sculpt in the head's units: skull, muzzle tip, back of the
  // skull, and the far corner of a cupped ear.
  const [cx, cy, cz] = HELMET.center;
  const points = [[.94, 0, 0], [0, .8, 0], [0, -.8, 0], [0, -.04, 1.112], [0, -.4, .98], [0, 0, -.7], [.89, .84, -.12]];
  for (const [x, y, z] of points) assert.ok(Math.hypot(x - cx, y - cy, z - cz) < HELMET.radius, `(${x}, ${y}, ${z}) pokes out`);
  assert.ok(SUIT_HEAD <= .58, 'the head never grows');
  assert.ok(portRadius() > .75, 'the porthole is big enough for the whole face');
  assert.ok(GLASS.clear <= .15, 'the face shows through');
});

test('the body is chubby, its limbs stubby, and it bottoms out on the floor', () => {
  const widest = list => Math.max(...list.filter(p => p.shape === 'turned').flatMap(p => p.profile.map(([r]) => r)));
  const longest = list => -Math.min(...list.filter(p => p.shape === 'turned').flatMap(p => p.profile.map(([, y]) => y)));
  assert.ok(widest(SUIT_PARTS.torso) >= .75, 'a round belly');
  assert.ok(widest(SUIT_PARTS.arm) >= .2 && longest(SUIT_PARTS.arm) <= .6, 'short, fat arms');
  assert.ok(widest(SUIT_PARTS.leg) >= .25 && longest(SUIT_PARTS.leg) <= .45, 'short, fat legs');
  // Bottom up, or the lathe's surface faces inwards.
  for (const list of Object.values(SUIT_PARTS)) for (const p of list) if (p.shape === 'turned') p.profile.forEach(([, y], i, all) => { if (i) assert.ok(y > all[i - 1][1], 'profile runs bottom up'); });
  // Boots stand on the floor where the bare paws did.
  const boot = SUIT_PARTS.leg.find(p => p.tone === 'boot');
  assert.ok(Math.abs(boot.at[1] - boot.size[1] + .635) < .02);
});

test('the suit has its brass: porthole, rivets, side ports, lamp, tank, trims and brown boots', () => {
  const { torso, arm, leg, helmet, lens } = SUIT_PARTS;
  assert.ok(helmet.filter(p => p.shape === 'shell').length === 2, 'a brass skin with a dark inside');
  assert.ok(helmet.some(p => p.shape === 'ring' && p.facing === 'z' && p.radius === portRadius()), 'the porthole ring');
  assert.equal(helmet.filter(p => p.facing === 'x').length, 2, 'two side ports');
  assert.ok(helmet.filter(p => p.shape === 'rivet').length >= 16, 'rivets');
  assert.ok(helmet.some(p => p.shape === 'can' && p.at[1] > HELMET.center[1] + HELMET.radius) && lens.length === 1, 'a lamp on top');
  assert.ok(torso.some(p => p.shape === 'can' && p.at[2] < -.6 && p.tone === 'brass'), 'a small tank on the back');
  assert.ok(torso.some(p => p.shape === 'ring' && p.tone === 'brass') && arm.some(p => p.shape === 'ring') && leg.some(p => p.shape === 'ring'), 'brass trims');
  assert.ok(leg.some(p => p.tone === 'boot'), 'boots');
  for (const list of Object.values(SUIT_PARTS)) for (const p of list) assert.ok(p.tone === 'main' || p.tone === 'shade' || TONES[p.tone], `unknown tone ${p.tone}`);
});

test('a suit stays cheap: no lights of its own, and a small fixed pool of real lamps', () => {
  const suit = fs.readFileSync(new URL('../public/explorer-suit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(suit, /new THREE\.\w*Light/);
  const view = fs.readFileSync(new URL('../public/view.js', import.meta.url), 'utf8');
  const lamps = view.match(/DIVER_LAMPS = \{([^}]*)\}/)[1].match(/\d+/g).map(Number);
  assert.ok(Math.max(...lamps) <= 3, 'three real lamps at most');
});

test('nothing that decides play imports the suit', () => {
  for (const file of ['rules', 'enemies', 'layout', 'network', 'deck', 'game']) {
    const code = fs.readFileSync(new URL(`../public/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /suit-look|explorer-suit/, `${file}.js`);
  }
});
