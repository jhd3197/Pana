import assert from 'node:assert/strict';
import { FRASES, pickLine } from '../../../engine/frases.js';
import { CaidaGame } from '../public/rules.js';
import { barksFor } from '../public/barks.js';
const c = (rank, suit = 'oros') => ({ id: `${suit}-${rank}`, rank, suit });
const check = (name, run) => { run(); console.log(`PASS ${name}`); };
function fixture() {
  const g = new CaidaGame(10); g.start(); g.players.forEach(p => { p.hand = []; p.captured = []; });
  g.stock = [c(12, 'bastos')]; g.table = []; g.scores = [0, 0]; g.turn = 0; g.last = null; g.history = []; g.phase = 'playing'; return g;
}
const fresh = (g, from) => g.history.filter(e => e.id > from);

check('pickLine is stable per seed and skips crude lines by default', () => {
  assert.equal(pickLine('aplauso', 'x:1'), pickLine('aplauso', 'x:1'));
  for (let i = 0; i < 40; i++) assert.notEqual(pickLine('sapo', i), '¡Pajúo!');
  const seen = new Set(Array.from({ length: 40 }, (_, i) => pickLine('sapo', i, { crude: true })));
  assert.ok(seen.has('¡Pajúo!') && seen.has('¡Sapo!'));
  assert.equal(pickLine('no-such-pool', 1), '');
  assert.ok(Object.values(FRASES).every(pool => pool.length));
});
check('a caída makes the capturer shout and the victim complain', () => {
  const g = fixture(); g.players[0].hand = [c(5)]; g.players[1].hand = [c(5, 'copas'), c(3)];
  assert.ok(g.play(0, 'oros-5')); const from = g.eventId;
  assert.ok(g.play(1, 'copas-5'));
  const play = g.history.findLast(e => e.kind === 'play');
  assert.equal(play.victim, 0);
  const barks = barksFor(g, fresh(g, from));
  assert.deepEqual(barks.map(b => b.seat).sort(), [0, 1]);
  assert.ok(barks.every(b => b.text && b.time > 1));
});
check('a second caída on the same pana calls them salado', () => {
  const g = fixture(); g.history = [{ id: 1, kind: 'play', seat: 1, fall: 1, victim: 0 }, { id: 2, kind: 'play', seat: 1, fall: 1, victim: 0 }];
  const [victim] = barksFor(g, [g.history[1]]).filter(b => b.seat === 0);
  assert.ok(FRASES.salado.includes(victim.text));
});
check('cantos are shouted by name; plain drops stay quiet', () => {
  const g = fixture();
  assert.deepEqual(barksFor(g, [{ id: 3, kind: 'score', seat: 1, reason: 'Registro', points: 8 }]).map(b => b.text), ['¡Registro!']);
  assert.deepEqual(barksFor(g, [{ id: 4, kind: 'play', seat: 0, captured: [], fall: 0, clean: 0 }]), []);
});
check('the match ends with the winner closing the table', () => {
  const g = fixture(); g.scores = [23, 0]; g.players[0].hand = [c(5)]; g.players[1].hand = [c(3)]; g.table = [c(5, 'copas')];
  g.last = { id: 'copas-5', seat: 1 }; const from = g.eventId;
  assert.ok(g.play(0, 'oros-5')); assert.equal(g.phase, 'finished');
  const barks = barksFor(g, fresh(g, from));
  assert.ok(FRASES.cierre.includes(barks.find(b => b.seat === 0).text));
  assert.ok(FRASES.derrota.includes(barks.find(b => b.seat === 1).text));
});
