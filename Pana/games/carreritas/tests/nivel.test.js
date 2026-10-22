import test from 'node:test';
import assert from 'node:assert/strict';
import { NIVEL_BANDS, MATAGIGANTES_BONUS, nivelFromPoints, bandOf, badge, kitNivel, matagigantes, carNivel } from '../public/nivel.js';
import { CAR_DEFINITIONS } from '../public/car-definitions.js';

test('nivel is 100 + 16×(1.5·Vel + Acel + Man + 0.8·Agarre), peso never counts', () => {
  assert.equal(nivelFromPoints([0, 0, 0, 0, 10]), 100);
  assert.equal(nivelFromPoints([10, 10, 10, 10, 0]), 100 + 16 * 43);
  assert.equal(nivelFromPoints([4, 9, 7, 7, 3]), Math.round(100 + 16 * (6 + 9 + 7 + 5.6)));
});

test('letters follow the D C B A S bands', () => {
  assert.equal(bandOf(0).letter, 'D');
  assert.equal(bandOf(449).letter, 'D');
  assert.equal(bandOf(450).letter, 'C');
  assert.equal(bandOf(549).letter, 'C');
  assert.equal(bandOf(550).letter, 'B');
  assert.equal(bandOf(649).letter, 'B');
  assert.equal(bandOf(650).letter, 'A');
  assert.equal(bandOf(749).letter, 'A');
  assert.equal(bandOf(750).letter, 'S');
  assert.equal(bandOf(999).letter, 'S');
});

test('every band has a distinct colour and the badge carries letter and number', () => {
  assert.equal(new Set(NIVEL_BANDS.map((b) => b.color)).size, NIVEL_BANDS.length);
  const html = badge(542);
  assert.match(html, /nivel-badge/);
  assert.match(html, /<b>C<\/b>/);
  assert.match(html, /<span>542<\/span>/);
  assert.match(html, new RegExp(`--nivel:${bandOf(542).color}`));
});

test('a kit nivel averages only the pieces the track uses', () => {
  const pieces = { car: 542, boat: 480, air: 492 };
  assert.equal(kitNivel(pieces, ['car']), 542);
  assert.equal(kitNivel(pieces, ['car', 'air']), 517);
  assert.equal(kitNivel(pieces, ['car', 'boat', 'air']), Math.round((542 + 480 + 492) / 3));
  assert.ok(Number.isNaN(kitNivel({}, ['car'])));
  assert.equal(kitNivel({ car: 542 }, ['car', 'air']), 542);
});

test('matagigantes pays for every higher-nivel rival beaten', () => {
  const { giants, bonus } = matagigantes(517, [
    { name: 'La Chama', pi: 655 },
    { name: 'El Gocho', pi: 569 },
    { name: 'Yoli', pi: 480 },
  ]);
  assert.deepEqual(giants.map((g) => g.name), ['La Chama', 'El Gocho']);
  assert.equal(bonus, 2 * MATAGIGANTES_BONUS);
  assert.equal(matagigantes(700, [{ name: 'Yoli', pi: 480 }]).bonus, 0);
});

test('every stock car with street cauchos lands inside the bands', () => {
  for (const car of CAR_DEFINITIONS) {
    const pi = carNivel(car, 'calle', {});
    const band = bandOf(pi);
    assert.ok(pi >= 100 && pi <= 788, `${car.id} nivel ${pi} in range`);
    assert.ok(['D', 'C', 'B', 'A', 'S'].includes(band.letter));
  }
});
