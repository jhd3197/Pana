import test from 'node:test';
import assert from 'node:assert/strict';
import { QuizGame, SEATS, LADDER, TOP, TIMES, safeFloor, resolveAnswer, revealOrder, ranking, score, titles } from '../public/rules.js';
import { QUESTIONS, CATEGORIES, PACKS } from '../public/questions.js';
import fs from 'node:fs';
import { voiceKey, narrationLines } from '../public/voice-key.js';

let seq = 0;
const act = (game, id, action, values = {}) => game.accept(id, { action, seq: ++seq, q: game.index, ...values }, 1);
const humans = (n = SEATS) => { const game = new QuizGame(9); for (let i = 1; i <= n; i++) game.addPlayer(i, `P${i}`); return game; };
const run = (game, until) => { for (let i = 0; i < 20000 && !until(game); i++) game.tick(.05); };
const toReveal = (game) => run(game, g => g.phase === 'reveal' && g.reveal.done);
const right = (game) => game.question.correct, wrong = (game) => (game.question.correct + 1) % 4;

test('every question has four different answers and a category', () => {
  for (const [cat, list] of Object.entries(QUESTIONS)) {
    assert.ok(CATEGORIES[cat], cat);
    for (const [text, ...answers] of list) {
      assert.equal(answers.length, 4, text);
      assert.equal(new Set(answers).size, 4, text);
    }
  }
});

test('each Tema deals only its own categories', () => {
  for (const [id, pack] of Object.entries(PACKS)) {
    for (const cat of pack.cats) assert.ok(QUESTIONS[cat]?.length >= 8, `${id}: ${cat}`);
    const game = humans(); game.options.pack = id; game.start();
    assert.ok(game.deck.every(([cat]) => pack.cats.includes(cat)), id);
    assert.equal(new Set(game.deck.slice(0, 6).map(d => d[0])).size, 6, `${id} rotates categories`);
  }
  assert.deepEqual(Object.keys(QUESTIONS).sort(), [...PACKS.todo.cats].sort(), 'De todo covers every category');
});

test('room options are host-only and validated', () => {
  const game = humans(2);
  assert.equal(act(game, 2, 'options', { options: { seconds: 10 } }), false);
  assert.equal(act(game, 1, 'options', { options: { seconds: 11 } }), false);
  assert.ok(act(game, 1, 'options', { options: { seconds: 10, questions: 8 } }));
  assert.ok(act(game, 1, 'start'));
  assert.equal(game.total, 8);
  assert.equal(act(game, 1, 'options', { options: { seconds: 15 } }), false, 'locked once playing');
});

test('a game deals the planned number of distinct questions, rotating categories', () => {
  const game = humans(); game.start();
  assert.equal(game.deck.length, 13);
  assert.equal(new Set(game.deck.map(d => d.join(':'))).size, 13);
  assert.equal(new Set(game.deck.slice(0, 6).map(d => d[0])).size, 6);
});

test('rematches exhaust each pack before reusing questions, including after handoff', () => {
  for (const pack of Object.keys(PACKS)) {
    let game = humans(); game.options.pack = pack;
    const size = PACKS[pack].cats.reduce((n, cat) => n + QUESTIONS[cat].length, 0);
    const seen = new Set();
    for (let round = 0; round < 24; round++) {
      game.start();
      assert.equal(new Set(game.deck.map(d => d.join(':'))).size, game.deck.length);
      for (const entry of game.deck) {
        const key = entry.join(':');
        if (seen.size < size) assert.ok(!seen.has(key), `${pack}: repeated ${key} before exhausting the bank`);
        seen.add(key);
      }
      game = QuizGame.restore(game.snapshot(), new Map(game.players.map(p => [p.id, {}])));
    }
    assert.equal(seen.size, size);
  }
});

test('switching from Venezuela to De todo uses fresh questions first', () => {
  const game = humans(); game.start();
  const seen = new Set(game.deck.map(d => d.join(':')));
  game.options.pack = 'todo'; game.start();
  assert.ok(game.deck.every(d => !seen.has(d.join(':'))));
});

test('the default timer leaves thirty seconds to listen and answer', () => {
  const game = humans(); game.start();
  assert.equal(game.timeLeft, 30);
  game.tick(20); assert.equal(game.phase, 'question'); assert.equal(game.timeLeft, 10);
  game.tick(10); assert.equal(game.phase, 'pause');
});

test('every question and its choices have Spanish recordings within the default timer', () => {
  const dir = new URL('../public/audio/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
  const texts = [...new Set(Object.values(QUESTIONS).flat().flatMap(([text, ...answers]) => narrationLines({ text, answers })))];
  assert.equal(new Set(texts.map(voiceKey)).size, texts.length, 'no hash collisions');
  for (const text of texts) {
    const key = voiceKey(text), entry = manifest.lines[key];
    assert.equal(entry?.text, text);
    assert.ok(entry.seconds > 0 && entry.seconds < 15, `time to answer after ${text}`);
  }
  for (const [text, ...answers] of Object.values(QUESTIONS).flat()) {
    const seconds = narrationLines({ text, answers }).reduce((sum, line) => sum + manifest.lines[voiceKey(line)].seconds, 0);
    assert.ok(seconds < 25, `time to answer after all choices: ${text} (${seconds}s)`);
  }
  const pack = JSON.parse(fs.readFileSync(new URL('pack.json', dir)));
  assert.equal(pack.files, texts.length);
  assert.match(pack.sha256, /^[a-f0-9]{64}$/);
});

test('answers stay secret in snapshots until the reveal, while allowing changes', () => {
  const game = humans(); game.start();
  assert.ok(act(game, 1, 'answer', { choice: 2 }));
  assert.ok(act(game, 1, 'answer', { choice: 1 }));
  const snap = game.snapshot();
  assert.equal(snap.players[0].locked, true);
  assert.equal(snap.players[0].answer, null);
  assert.equal(game.players[0].answer, 1);
  assert.equal(act(game, 2, 'answer', { choice: 1, q: 99 }), false, 'answer for another question');
});

test('the full timer remains after everyone answers, then reveals and settles', () => {
  const game = humans(); game.start();
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: i === 3 ? right(game) : wrong(game) });
  assert.equal(game.phase, 'question');
  game.tick(game.timeLeft);
  assert.equal(game.phase, 'pause');
  assert.equal(game.hostLine, '¿Esa es su respuesta final?');
  run(game, g => g.phase === 'reveal');
  assert.equal(game.reveal.shown, 1);
  toReveal(game);
  assert.match(game.hostLine, /Solo P3 se la sabía/);
  assert.equal(game.players[2].step, 1);
  assert.equal(game.players[0].step, 0);
});

test('a wrong answer drops to the last safe step; doble o nada drops one safe step more', () => {
  assert.deepEqual([0, 3, 4, 7, 8, 11].map(safeFloor), [0, 0, 4, 4, 8, 8]);
  const game = humans(); game.start();
  game.players[0].step = 7; game.players[1].step = 10; game.players[2].step = 6;
  act(game, 3, 'doble');
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: wrong(game) });
  toReveal(game);
  assert.deepEqual(game.players.slice(0, 3).map(p => p.step), [4, 8, 0]);
  assert.ok(game.callouts.some(c => /chivo y sin el mecate/.test(c.text) && c.seat === 0));
  assert.match(game.hostLine, /fuera de base/);
});

test('a right answer climbs, doble climbs two, and speed earns bonus mangos', () => {
  const game = humans(); game.start();
  act(game, 1, 'doble'); act(game, 1, 'answer', { choice: right(game) });
  game.tick(5);
  for (let i = 2; i <= SEATS; i++) act(game, i, 'answer', { choice: right(game) });
  toReveal(game);
  assert.equal(game.players[0].step, 2);
  assert.equal(game.players[1].step, 1);
  assert.ok(game.players[0].bonus > game.players[1].bonus);
  assert.match(game.hostLine, /Palo/);
});

test('copiarse follows the pana, chains through copies, and the host calls it out', () => {
  const game = humans(); game.start();
  act(game, 2, 'answer', { choice: wrong(game) });
  assert.ok(act(game, 1, 'copy', { target: 1 }));
  assert.ok(act(game, 3, 'copy', { target: 0 }));
  assert.ok(act(game, 4, 'copy', { target: 2 }));
  assert.equal(act(game, 5, 'copy', { target: 4 }), false, 'self copy');
  assert.equal(resolveAnswer(game.players, 2), wrong(game));
  assert.deepEqual(revealOrder(game.players).slice(-3), [0, 2, 3]);
  for (let i = 5; i <= SEATS; i++) act(game, i, 'answer', { choice: right(game) });
  toReveal(game);
  assert.equal(game.players[1].stats.betrayed, 1);
  assert.ok(game.callouts.some(c => c.text.startsWith('P1 se copió de P2… ¡y P2 puso la')));
  assert.equal(act(game, 1, 'copy', { target: 1 }), false, 'one use per game');
});

test('mitad y mitad hides two wrong answers for that pana only', () => {
  const game = humans(); game.start();
  assert.ok(act(game, 1, 'half'));
  const hidden = game.players[0].half;
  assert.equal(hidden.length, 2);
  assert.ok(!hidden.includes(right(game)));
  assert.equal(act(game, 1, 'answer', { choice: hidden[0] }), false);
  assert.equal(game.players[1].half, null);
});

test('plantarse keeps the mangos whatever the answer', () => {
  const game = humans(); game.start();
  game.players[0].step = 6;
  assert.ok(act(game, 1, 'plant'));
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: wrong(game) });
  toReveal(game);
  assert.equal(game.players[0].step, 6);
  assert.equal(game.players[0].stats.wrong, 1);
});

test('reaching the top step wins the Mango de oro before the final', () => {
  const game = humans(); game.start();
  game.players[4].step = TOP - 1;
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: i === 5 ? right(game) : wrong(game) });
  toReveal(game);
  assert.equal(game.gold, 4);
  assert.equal(ranking(game)[0].seat, 4);
  assert.equal(LADDER[game.players[4].step], LADDER[TOP]);
});

test('the final takes secret bets, adds or subtracts them, and crowns the highest total', () => {
  const game = humans(); game.options.questions = 8; game.start();
  game.index = game.total - 1; game.ask();
  game.players.forEach((p, i) => { p.step = 5; p.bonus = i * 10; });
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: wrong(game) });
  toReveal(game); run(game, g => g.phase === 'bet');
  assert.equal(game.final, true);
  assert.ok(act(game, 1, 'bet', { choice: 3 }));
  assert.equal(game.snapshot().players[0].bet, null, 'bets are secret');
  for (let i = 2; i <= SEATS; i++) act(game, i, 'bet', { choice: i === 2 ? 3 : 0 });
  assert.equal(game.phase, 'question');
  const before = game.players.map(score);
  act(game, 1, 'answer', { choice: right(game) }); act(game, 2, 'answer', { choice: wrong(game) });
  for (let i = 3; i <= SEATS; i++) act(game, i, 'answer', { choice: right(game) });
  toReveal(game);
  assert.equal(score(game.players[0]), before[0] * 2);
  assert.equal(score(game.players[1]), 0);
  run(game, g => g.phase === 'finished');
  assert.equal(game.winner, 0);
  assert.ok(game.titles[0].includes('Cuarto bate'));
});

test('bots play a whole game on their own, and titles go to someone', () => {
  const game = new QuizGame(21); game.options.questions = 8; game.start();
  run(game, g => g.phase === 'finished');
  assert.equal(game.phase, 'finished');
  assert.ok(game.players.some(p => p.step > 0));
  assert.ok(game.players.some(p => p.used.copy || p.used.half));
  const all = Object.values(titles(game)).flat();
  assert.ok(all.includes('Cuarto bate') && all.includes('Gafo'));
});

test('a new host restores an open question and lets panas lock again', () => {
  const game = humans(2); game.start();
  act(game, 1, 'answer', { choice: 1 });
  const copy = QuizGame.restore(game.snapshot(), new Map([[1, {}]]));
  assert.equal(copy.phase, 'question');
  assert.equal(copy.players[0].locked, false);
  assert.equal(copy.players[1].id, null, 'the missing pana is a bot again');
  assert.ok(copy.timeLeft > 0 && copy.timeLeft <= 6);
  run(copy, g => g.phase === 'pause');
  assert.equal(copy.phase, 'pause');
});

test('the reveal waits a beat per name', () => {
  const game = humans(); game.start();
  for (let i = 1; i <= SEATS; i++) act(game, i, 'answer', { choice: 0 });
  run(game, g => g.phase === 'reveal');
  let ticks = 0; run(game, g => (ticks++, g.reveal.done));
  assert.ok(ticks * .05 >= TIMES.revealStep * (SEATS - 1));
});

test('changing and cancelling use the latest timestamp and stop at the deadline', () => {
  const game = humans(); game.start(); const p = game.players[0];
  act(game, 1, 'answer', { choice: wrong(game) });
  game.tick(10);
  assert.ok(act(game, 1, 'answer', { choice: right(game) }));
  assert.equal(p.lockedLeft, 20);
  game.tick(5);
  assert.equal(act(game, 1, 'answer', { choice: right(game) }), false);
  assert.equal(p.lockedLeft, 20, 'repeated clicks do not change the bonus');
  assert.ok(act(game, 1, 'cancel'));
  assert.equal(p.locked, false); assert.equal(p.answer, null); assert.equal(p.lockedLeft, 0);
  assert.equal(act(game, 1, 'cancel'), false);
  assert.ok(act(game, 1, 'answer', { choice: right(game) }));
  assert.equal(p.lockedLeft, 15);
  game.tick(15);
  assert.equal(act(game, 1, 'cancel'), false);
  assert.equal(act(game, 1, 'answer', { choice: wrong(game) }), false);
  toReveal(game); assert.equal(p.outcome.bonus, 50);
});

test('cancelling a copy spends the comodin but permits an independent answer', () => {
  const game = humans(); game.start(); const p = game.players[0];
  act(game, 1, 'copy', { target: 1 });
  assert.ok(act(game, 1, 'cancel'));
  assert.equal(p.copy, null); assert.equal(p.used.copy, true);
  assert.equal(act(game, 1, 'copy', { target: 2 }), false);
  assert.ok(act(game, 1, 'answer', { choice: right(game) }));
  assert.equal(resolveAnswer(game.players, 0), right(game));
});

test('narration follows displayed order without exposing the right answer', () => {
  assert.deepEqual(narrationLines({ text: 'Ave', answers: ['Guacamayo', 'Cardenal', 'Colibrí', 'Turpial'], correct: 3 }),
    ['Ave', 'Opción A.', 'Guacamayo', 'Opción B.', 'Cardenal', 'Opción C.', 'Colibrí', 'Opción D.', 'Turpial']);
});

test('replacing a copy follows the new choice and half still excludes hidden choices', () => {
  const game = humans(); game.start(); const p = game.players[0];
  act(game, 1, 'half'); act(game, 1, 'copy', { target: 1 });
  assert.equal(act(game, 1, 'answer', { choice: p.half[0] }), false);
  assert.ok(act(game, 1, 'answer', { choice: right(game) }));
  assert.equal(p.copy, null); assert.equal(p.used.copy, true);
  act(game, 1, 'cancel');
  assert.equal(act(game, 1, 'half'), false);
  assert.equal(act(game, 1, 'answer', { choice: p.half[0] }), false);
});
