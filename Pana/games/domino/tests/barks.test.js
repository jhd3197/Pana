import test from 'node:test';
import assert from 'node:assert/strict';
import { FRASES } from '../../../engine/frases.js';
import { DominoGame, legalMoves } from '../public/rules.js';
import { barksFor } from '../public/barks.js';

const t = (a, b) => ({ id: `${a}-${b}`, a, b });
function table(hands) {
  const g = new DominoGame(3); g.start();
  g.players.forEach((p, i) => { p.hand = hands[i] || [t(0, 0)]; });
  g.chain = []; g.history = []; g.turn = 0; g.openingTile = null; return g;
}
const after = (g, from) => g.history.filter(e => e.id > from);

test('history events get ids that count up within the mano', () => {
  const g = table([[t(6, 6), t(1, 2)], [t(6, 3), t(0, 1)]]);
  g.play(0, '6-6', 'right'); g.play(1, '6-3', 'right');
  assert.deepEqual(g.history.map(e => e.id), [1, 2]);
  g.phase = 'round-over'; g.start(); assert.equal(g.history.length, 0);
});
test('opening with the double six is la cochina; the last tile is announced', () => {
  const g = table([[t(6, 6), t(1, 2)], [t(6, 3), t(0, 1)]]);
  g.play(0, '6-6', 'right');
  assert.match(barksFor(g, after(g, 0))[0].text, /cochina/);
  const g2 = table([[t(6, 6), t(2, 2)], [t(6, 3), t(0, 1)], [t(0, 5)], [t(0, 4)]]);
  g2.play(0, '6-6', 'right'); g2.play(1, '6-3', 'right');
  const [bark] = barksFor(g2, after(g2, 1));
  assert.equal(bark.seat, 1); assert.match(bark.text, /queda una/);
});
test('passing gets more bitter each time the same pana passes', () => {
  const g = table([[t(6, 6)], [t(0, 1)]]);
  g.history = [1, 2, 3].map(id => ({ id, kind: 'pass', seat: 1 }));
  const lines = g.history.map(e => barksFor(g, [e])[0].text);
  assert.ok(FRASES.aburrido.includes(lines[1]));
  assert.ok(FRASES.salado.includes(lines[2]));
});
test('going out shouts dominó or capicúa; the partner cheers and a rival grumbles', () => {
  const g = table([[t(2, 5)], [t(0, 1)], [t(0, 3)], [t(0, 4)]]);
  g.chain = [{ ...t(5, 3), seat: 1 }, { ...t(3, 2), seat: 2 }];
  assert.ok(legalMoves(g, 0).length);
  g.play(0, '2-5', 'left');
  const barks = barksFor(g, after(g, 0), { ended: true });
  assert.equal(barks.find(b => b.seat === 0).text, '¡Capicúa!');
  assert.ok(FRASES.aplauso.includes(barks.find(b => b.seat === 2).text));
  assert.ok(FRASES.sorpresa.includes(barks.find(b => b.seat === 1).text));
});
test('lines agree for every client and plain plays stay quiet', () => {
  const g = table([[t(1, 2), t(3, 4)], [t(2, 3)]]);
  g.play(0, '1-2', 'right');
  assert.deepEqual(barksFor(g, after(g, 0)), []);
  const e = { id: 4, kind: 'pass', seat: 1 };
  assert.deepEqual(barksFor(g, [e]), barksFor(structuredClone(g), [e]));
});
