// The explorer suit is looks only: every seat reads as a different colour,
// what would poke through the dome is off, the head fits in the glass, and
// nothing that decides play can even see the suit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOME, GLASS, SEAT_COLORS, SUIT_HEAD, SUIT_PARTS, TONES, domeOpening, seatColor, suitedAvatar } from '../public/suit-look.js';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const apart = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test('every seat wears a colour clearly its own, and seats wrap around', () => {
  assert.equal(new Set(SEAT_COLORS).size, 8);
  for (const [i, a] of SEAT_COLORS.entries()) for (const b of SEAT_COLORS.slice(i + 1)) assert.ok(apart(a, b) > 30, `${a} and ${b} look alike`);
  for (const [i, a] of SEAT_COLORS.slice(0, 4).entries()) for (const b of SEAT_COLORS.slice(i + 1, 4)) assert.ok(apart(a, b) > 80, `seats ${a} and ${b} are too close for a small party`);
  assert.equal(seatColor(8), seatColor(0)); assert.equal(seatColor(undefined), SEAT_COLORS[0]);
  for (const c of SEAT_COLORS) for (const t of ['trim', 'boot']) assert.ok(apart(c, TONES[t]) > 100, `${c} melts into the ${t}`);
});

test('the suited avatar keeps the face and takes off what clips the dome', () => {
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

test('the dome holds the head, ears and muzzle included', () => {
  // Extremes of the sculpt in the head's units: skull, muzzle tip, back of the
  // skull, and the far corner of a cupped ear.
  const [cx, cy, cz] = DOME.center;
  const points = [[.94, 0, 0], [0, .8, 0], [0, -.8, 0], [0, -.04, 1.112], [0, -.4, .98], [0, 0, -.7], [.89, .84, -.12]];
  for (const [x, y, z] of points) assert.ok(Math.hypot(x - cx, y - cy, z - cz) < DOME.radius, `(${x}, ${y}, ${z}) pokes out`);
  assert.ok(DOME.openAt < -.8, 'the rim stays under the chin');
  assert.ok(SUIT_HEAD <= .58, 'the head never grows');
  assert.ok(domeOpening() > .55 && domeOpening() < DOME.radius * .6, 'the rim is a narrow neck ring, well inside the bowl');
});

test('the glass stays clear over the face and shows at its edge', () => {
  assert.ok(GLASS.clear <= .15, 'the face shows through');
  assert.ok(GLASS.edge >= .6 && GLASS.streak >= .8, 'the bowl reads from across a room');
});

test('the suit fits close: no part is wider than the slim body allows', () => {
  const widest = list => Math.max(...list.filter(p => p.shape === 'turned').flatMap(p => p.profile.map(([r]) => r)));
  assert.ok(widest(SUIT_PARTS.torso) <= .65, 'the torso is not a barrel');
  assert.ok(widest(SUIT_PARTS.arm) <= .17 && widest(SUIT_PARTS.leg) <= .2, 'limbs are slim');
  // Bottom up, or the lathe's surface faces inwards.
  for (const list of Object.values(SUIT_PARTS)) for (const p of list) if (p.shape === 'turned') p.profile.forEach(([, y], i, all) => { if (i) assert.ok(y > all[i - 1][1], 'profile runs bottom up'); });
});

test('the suit has its pack, tank, hose, belt, boots, gloves and lamp', () => {
  const { torso, arm, leg, helmet, lens } = SUIT_PARTS;
  assert.equal(torso.filter(p => p.shape === 'tube').length, 1, 'one hose');
  assert.ok(torso.some(p => p.shape === 'can' && p.at[2] < -.4 && p.height > .4), 'a small tank on the back');
  assert.ok(torso.some(p => p.shape === 'ring' && p.tone === 'trim' && p.at[1] < 1.2), 'a belt');
  assert.ok(torso.some(p => p.shape === 'box' && p.at[2] > .5), 'a pack on the chest');
  assert.ok(leg.some(p => p.tone === 'boot') && arm.at(-1).at[1] < -.8, 'boots and gloves');
  assert.ok(helmet.some(p => p.shape === 'ring') && lens.length === 1, 'a rim and a lamp');
  for (const list of Object.values(SUIT_PARTS)) for (const p of list) assert.ok(p.tone === 'main' || p.tone === 'shade' || TONES[p.tone], `unknown tone ${p.tone}`);
  // Boots stand on the floor where the bare paws did.
  const boot = leg.find(p => p.tone === 'boot');
  assert.ok(Math.abs(boot.at[1] - boot.size[1] + .635) < .02);
});

test('nothing that decides play imports the suit', () => {
  for (const file of ['rules', 'enemies', 'layout', 'network', 'deck', 'game']) {
    const code = fs.readFileSync(new URL(`../public/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /suit-look|explorer-suit/, `${file}.js`);
  }
});
