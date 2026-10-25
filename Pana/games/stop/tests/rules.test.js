import test from 'node:test';
import assert from 'node:assert/strict';
import { StopGame, SEATS, TIMES, POINTS, HARD, CLASICAS, CRIOLLAS, MAX_ANSWER, PERSONALITY, cleanAnswer, cleanSheet, judge, lettersFor,
  pickCategories, ranking, seated, titles, verdictText } from '../public/rules.js';
import { letterOf } from '/engine/play/saber-match.js';

let seq = 0;
const act = (game, id, action, values = {}) => game.accept(id, { action, seq: ++seq, round: game.round, ...values }, 1);
const humans = (n = SEATS, seed = 9) => { const game = new StopGame(seed); for (let i = 1; i <= n; i++) game.addPlayer(i, `P${i}`); return game; };
const run = (game, until, max = 60000) => { for (let i = 0; i < max && !until(game); i++) game.tick(.05); };
const seatOf = (game, id) => game.players.find(p => p.id === id).seat;
// Starts a game and plays up to the writing phase with a fixed letter and categories.
function writing(game, { letter = 'C', categories = ['ciudad', 'animal', 'color'], options = {} } = {}) {
  Object.assign(game.options, options);
  game.start(); game.categories = categories;
  run(game, g => g.phase === 'letter'); game.letter = letter;
  run(game, g => g.phase === 'write');
  return game;
}
const sheetFor = (game, id, sheet) => act(game, id, 'sheet', { sheet });
// Everyone (all humans) hands in; returns the game in review.
function handIn(game, sheets) {
  const [first, ...rest] = Object.entries(sheets);
  assert.ok(act(game, Number(first[0]), 'stop', { sheet: first[1] }), 'the first full sheet stops the round');
  run(game, g => g.phase === 'collect');
  for (const [id, sheet] of rest) sheetFor(game, Number(id), sheet);
  run(game, g => g.phase === 'review');
  return game;
}
const voteAll = (game, group, yes, except = []) => {
  for (const p of game.players) if (p.id !== null && !except.includes(p.id) && !game.review.groups[group].authors.includes(p.seat)) act(game, p.id, 'vote', { index: game.review.index, group, yes: typeof yes === 'function' ? yes(p) : yes });
};

test('room options are host-only and validated, and Stop rápido plays three categories in 30 s', () => {
  const game = humans(2);
  assert.equal(act(game, 2, 'options', { options: { rounds: 3 } }), false, 'only the host');
  assert.equal(act(game, 1, 'options', { options: { rounds: 4 } }), false, 'not a choice');
  assert.equal(act(game, 1, 'options', { options: { secret: true } }), false, 'not an option');
  assert.ok(act(game, 1, 'options', { options: { mode: 'rapido', rounds: 3 } }));
  assert.ok(act(game, 1, 'start'));
  assert.equal(game.categories.length, 3);
  assert.equal(game.limit, TIMES.rapido);
  assert.equal(game.rounds, 3);
  assert.equal(act(game, 1, 'options', { options: { rounds: 5 } }), false, 'locked once playing');
  assert.equal(act(game, 2, 'start'), false, 'only the host starts');
});

test('category sets: Clásicas, Criollas, Mezcla and Al azar, 6 to 10 of them', () => {
  const state = { seed: 4 };
  assert.deepEqual(pickCategories(state, { set: 'clasicas', count: 8, mode: 'normal' }), CLASICAS);
  const criollas = pickCategories(state, { set: 'criollas', count: 8, mode: 'normal' });
  assert.ok(criollas.every(c => CRIOLLAS.includes(c)));
  const ten = pickCategories(state, { set: 'clasicas', count: 10, mode: 'normal' });
  assert.equal(ten.length, 10); assert.equal(new Set(ten).size, 10); assert.deepEqual(ten.slice(0, 8), CLASICAS);
  const mix = pickCategories(state, { set: 'mezcla', count: 6, mode: 'normal' });
  assert.equal(mix.filter(c => CLASICAS.includes(c)).length, 3);
  const azar = pickCategories(state, { set: 'azar', count: 9, mode: 'normal' });
  assert.equal(new Set(azar).size, 9);
});

test('the wheel skips the hard letters by default and never repeats a letter in a game', () => {
  assert.ok(lettersFor({ hard: false }).every(l => !HARD.includes(l)));
  assert.ok(HARD.every(l => lettersFor({ hard: true }).includes(l)));
  const game = humans(SEATS); game.start();
  const seen = [];
  for (let i = 0; i < 21; i++) { game.phase = 'spin'; game.para(null); seen.push(game.letter); }
  assert.equal(new Set(seen).size, 21, 'every soft letter once before any repeats');
  assert.ok(seen.every(l => !HARD.includes(l)));
});

test('only the turn pana stops the wheel; bots stop it themselves and a slow pana gets helped', () => {
  const game = humans(2, 3); game.start();
  const spinner = game.players[game.spinner], other = game.players.find(p => p.id !== null && p.seat !== game.spinner);
  if (spinner.id !== null) {
    if (other) assert.equal(act(game, other.id, 'para'), false, 'not your turn');
    assert.ok(act(game, spinner.id, 'para'));
    assert.equal(game.phase, 'letter');
  } else {
    run(game, g => g.phase === 'letter', 80); assert.equal(game.phase, 'letter', 'a bot stops the wheel in under four seconds');
  }
  run(game, g => g.phase === 'write');
  // A human spinner who never presses: the host stops it after TIMES.spinAuto.
  const lone = humans(SEATS); lone.start(); run(lone, g => g.phase !== 'spin');
  assert.ok(lone.phaseTime < 1 && lone.phase === 'letter');
});

test('answers are cleaned: text only, trimmed, capped', () => {
  assert.equal(cleanAnswer('  Ca\u0000ra   cas  '), 'Ca ra cas');
  assert.equal(cleanAnswer(42), '');
  assert.equal(cleanAnswer('<b>Hola</b>'), 'b Hola /b');
  assert.equal([...cleanAnswer('x'.repeat(80))].length, MAX_ANSWER);
  assert.deepEqual(cleanSheet(['Ana', 7, '  '], 4), ['Ana', '', '', '']);
  assert.deepEqual(cleanSheet('nope', 2), ['', '']);
});

test('sheets stay secret in snapshots until the review; only progress travels', () => {
  const game = writing(humans(2));
  assert.ok(act(game, 2, 'progress', { filled: 2 }));
  assert.equal(act(game, 2, 'progress', { filled: 9 }), false, 'more boxes than categories');
  assert.equal(game.snapshot().players[seatOf(game, 2)].filled, 2);
  assert.ok(act(game, 1, 'stop', { sheet: ['Caracas', 'Caimán', 'Café'] }));
  let snap = game.snapshot();
  assert.ok(snap.players.every(p => p.sheet === null), 'nobody sees the stopper sheet');
  assert.deepEqual(game.players[seatOf(game, 1)].sheet, ['Caracas', 'Caimán', 'Café']);
  assert.ok(!('plans' in snap), 'bot plans stay on the host');
  run(game, g => g.phase === 'collect');
  assert.ok(game.snapshot().players.every(p => p.sheet === null));
  sheetFor(game, 2, ['Coro', '', 'Celeste']);
  assert.equal(game.phase, 'review');
  snap = game.snapshot();
  assert.deepEqual(snap.players[seatOf(game, 2)].sheet, ['Coro', '', 'Celeste'], 'the review shows every sheet');
});

test('¡STOP! needs a full sheet, gives the rest 5 seconds, and only then pencils go down', () => {
  const game = writing(humans(2));
  assert.equal(act(game, 1, 'stop', { sheet: ['Caracas', '', 'Café'] }), false, 'an empty box');
  assert.equal(act(game, 1, 'stop', { sheet: ['C', 'C.', 'Ccc'] }), false, 'lone letters are not answers');
  assert.equal(act(game, 1, 'stop', { sheet: ['Caracas', 'Caimán', 'Café'], round: 99 }), false, 'another round');
  assert.ok(act(game, 1, 'stop', { sheet: ['Caracas', 'Caimán', 'Café'] }));
  assert.equal(game.phase, 'basta'); assert.equal(game.hostLine, '¡Basta! 5 segundos…');
  assert.equal(act(game, 2, 'stop', { sheet: ['Coro', 'Cabra', 'Crema'] }), false, 'one STOP per round');
  assert.ok(act(game, 2, 'progress', { filled: 3 }), 'the others keep writing');
  run(game, g => g.phase !== 'basta');
  assert.equal(game.phase, 'collect');
  assert.equal(act(game, 2, 'sheet', { sheet: ['Coro', 'Cabra', 'Crema'], round: 99 }), false);
  assert.ok(sheetFor(game, 2, ['Coro', 'Cabra', 'Crema']));
  assert.equal(sheetFor(game, 2, ['x', 'x', 'x']), false, 'one sheet per pana');
  assert.equal(game.players[game.stopper].stats.stops, 1);
});

test('the time limit puts the pencils down when nobody stops, and a silent pana hands in blank', () => {
  const game = writing(humans(SEATS), { options: { seconds: 60 } });
  run(game, g => g.phase !== 'write');
  assert.equal(game.phase, 'collect'); assert.equal(game.stopper, null);
  assert.match(game.hostLine, /Se acabó el tiempo/);
  assert.ok(game.writeTime >= 60 - .1);
  for (let id = 1; id < SEATS; id++) sheetFor(game, id, ['Caracas', 'Caimán', 'Café']);
  assert.equal(game.phase, 'collect', 'waits for the last pana');
  run(game, g => g.phase === 'review');
  assert.ok(game.phaseTime < 1);
  assert.deepEqual(game.players[seatOf(game, SEATS)].sheet, ['', '', '']);
});

test('judging: knowledge base, letter, empty, crude, typos, close spellings and the table', () => {
  const j = (answer, cat, letter, o) => judge(answer, cat, letter, o);
  assert.equal(j('Caracas', 'ciudad', 'C').status, 'green');
  const iron = j('Iron Man', 'nombre', 'A');
  assert.deepEqual([iron.status, iron.reason, iron.first], ['red', 'letter', 'I']);
  assert.equal(verdictText(iron), 'Se escribe con I');
  assert.equal(j('   ', 'cosa', 'C').reason, 'empty');
  assert.equal(j('Chiguire', 'animal', 'C').status, 'green', 'accents never matter');
  assert.equal(j('Pichire', 'palabra', 'P').status, 'green', 'a missing letter is a typo');
  assert.equal(j('Guanabanna', 'fruta', 'G').reason, 'known', 'a doubled letter sounds the same');
  assert.equal(j('Hormiga', 'color', 'H').status, 'yellow', 'the table decides if Hormiga is a color');
  assert.equal(j('Hormiga', 'color', 'H').reason, 'doubtful');
  assert.equal(j('Nemo', 'animal', 'N').status, 'yellow');
  assert.equal(j('Oreo', 'color', 'O').joke, 'oreo');
  assert.equal(j('Varinas', 'ciudad', 'B').reason, 'letter', 'Varinas is not with B');
  const close = j('Varinas', 'ciudad', 'V');
  assert.deepEqual([close.status, close.reason, close.word], ['yellow', 'close', 'Barinas']);
  assert.equal(j('Carinas', 'ciudad', 'C').status, 'yellow');
  assert.equal(j('Gatopardo', 'animal', 'G').reason, 'unknown');
  assert.equal(j('Pajúo', 'palabra', 'P').reason, 'crude', 'crude is out without más criollo');
  assert.equal(j('Perro marico', 'animal', 'P').reason, 'crude', 'a crude word anywhere');
  assert.equal(j('Cono', 'cosa', 'C').reason !== 'crude', true, 'a cone is a cone');
  assert.equal(j("El coño 'e la madre", 'lugar', 'E').reason, 'crude');
  assert.equal(j("El coño 'e la madre", 'lugar', 'E', { criollo: true }).status, 'yellow', 'más criollo sends it to a vote');
  assert.equal(j('Gatopardo', 'animal', 'G', { dictionary: [{ category: 'animal', word: 'Gatopardo' }] }).reason, 'mesa');
  assert.equal(j('Hormiga', 'color', 'H', { dictionary: [{ category: 'color', word: 'Hormiga' }] }).status, 'green', 'the table remembers');
  assert.equal(j('Hormiga', 'animal', 'H', { dictionary: [{ category: 'color', word: 'Hormiga' }] }).reason, 'known', 'per category');
  assert.equal(j('Ñame', 'cosa', 'N').reason, 'letter', 'Ñ is its own letter');
});

test('scoring: 100 alone, 50 shared, 0 when wrong or blank', () => {
  const game = writing(humans(SEATS), { categories: ['ciudad', 'animal'] });
  const sheets = { 1: ['Caracas', 'Caimán'], 2: ['Caracas', 'Cabra'], 3: ['Coro', 'Kabra'], 4: ['Valencia', ''], 5: ['Cumaná', 'Cucaracha'],
    6: ['Carora', 'Conejo'], 7: ['Cabimas', 'Cochino'], 8: ['Calabozo', 'Cocodrilo'] };
  handIn(game, sheets);
  const by = (id) => game.review.items[seatOf(game, id)];
  assert.equal(game.review.stage, 'show', 'no doubtful words, no vote');
  assert.deepEqual([by(1).points, by(2).points, by(3).points, by(4).points], [50, 50, 100, 0]);
  run(game, g => g.review.index === 1);
  assert.equal(by(3).status, 'red', 'Kabra starts with K');
  assert.equal(by(3).points, 0);
  assert.equal(by(2).points, 100, 'so Cabra stays alone');
});

test('votes: authors cannot vote, a tie favors the author, two thirds earn Creatividad and the table remembers', () => {
  const game = writing(humans(SEATS), { letter: 'H', categories: ['color', 'animal'] });
  const sheets = { 1: ['Hormiga', 'Hipopótamo'], 2: ['Hueso', 'Hiena'], 3: ['Hielo', 'Halcón'], 4: ['Hueso', 'Hurón'], 5: ['Hormiga', ''], 6: ['Hielo', 'Hámster'], 7: ['Hueso', 'Hulk'], 8: ['Hielo', 'Hiena'] };
  handIn(game, sheets);
  const r = game.review;
  assert.equal(r.stage, 'vote'); assert.equal(r.groups.length, 1);
  assert.deepEqual(r.groups[0].authors.sort(), [seatOf(game, 1), seatOf(game, 5)].sort(), 'one vote for the word, both authors');
  assert.equal(act(game, 1, 'vote', { index: 0, group: 0, yes: true }), false, 'the author cannot vote');
  assert.equal(act(game, 2, 'vote', { index: 1, group: 0, yes: true }), false, 'another category');
  assert.equal(act(game, 2, 'vote', { index: 0, group: 0, yes: 'si' }), false, 'a vote is yes or no');
  // 4 yes, 2 no: accepted with exactly two thirds.
  voteAll(game, 0, p => p.id !== 3 && p.id !== 4);
  assert.equal(r.stage, 'result', 'everyone voted, no need to wait');
  assert.equal(r.groups[0].accepted, true); assert.equal(r.groups[0].creative, true);
  assert.equal(game.review.items[seatOf(game, 1)].points, 50 + POINTS.creative, 'shared, plus Creatividad');
  assert.equal(game.players[seatOf(game, 3)].stats.thumbsDown, 1);
  assert.ok(game.dictionary.some(d => d.category === 'color' && d.word === 'Hormiga'));
  assert.match(game.hostLine, /Pedazo de loco/);
  run(game, g => g.review.index === 1);
  // Hulk as an animal: tie 3 to 3 (author 7 can't vote, 8 abstains) counts for the author, no bonus.
  assert.equal(game.review.stage, 'vote');
  voteAll(game, 0, p => p.id <= 3, [8]);
  assert.equal(game.review.stage, 'vote', 'still waiting for the last voter');
  run(game, g => g.review.stage !== 'vote');
  const g = game.review.groups[0];
  assert.equal(g.accepted, true); assert.equal(g.creative, false);
  assert.equal(game.review.items[seatOf(game, 7)].points, 100);
});

test('a rejected word scores nothing and counts toward El abusador', () => {
  const game = writing(humans(SEATS), { letter: 'N', categories: ['animal'] });
  handIn(game, { 1: ['Nemo'], 2: ['Nutria'], 3: ['Narval'], 4: ['Nutria'], 5: ['Ñu'], 6: [''], 7: ['Nutria'], 8: ['Narval'] });
  assert.match(game.hostLine, /abusando/);
  voteAll(game, 0, false);
  const g = game.review.groups[0], nemo = game.review.items[seatOf(game, 1)];
  assert.equal(g.accepted, false); assert.equal(nemo.points, 0);
  assert.equal(game.players[seatOf(game, 1)].stats.rejected, 1);
  assert.equal(verdictText(nemo, g), '¡Ya te estás abusando!');
  assert.equal(game.players[seatOf(game, 6)].stats.empty, 1);
});

test('Oreo shows 200 puntos, then ¡Ni lo sueñes!, and counts like any doubtful color', () => {
  const game = writing(humans(SEATS), { letter: 'O', categories: ['color'] });
  handIn(game, { 1: ['Oreo'], 2: ['Ocre'], 3: ['Oliva'], 4: ['Oro'], 5: ['Ocre'], 6: ['Oro'], 7: ['Oliva'], 8: ['Ocre'] });
  assert.match(game.hostLine, /200 puntos/);
  run(game, g => g.phaseTime > 1.5);
  assert.match(game.hostLine, /Ni lo sueñes/);
  voteAll(game, 0, p => p.id % 2 === 0);
  assert.ok(game.review.items[seatOf(game, 1)].points <= 100 + POINTS.creative, 'never 200');
});

test('bot personalities: El estricto always votes no, El pana creativo always yes', () => {
  const game = writing(humans(1), { letter: 'H', categories: ['color'] });
  assert.ok(act(game, 1, 'stop', { sheet: ['Hormiga'] }));
  run(game, g => g.phase === 'review');
  run(game, g => g.review.stage !== 'vote');
  const g = game.review.groups.find(x => x.authors.includes(seatOf(game, 1)));
  for (const [kind, yes] of [['estricto', false], ['creativo', true]]) { const seat = PERSONALITY.indexOf(kind); if (!g.authors.includes(seat)) assert.equal(g.votes[seat], yes, kind); }
  assert.ok(!(seatOf(game, 1) in g.votes));
});

test('bots write real words with the letter, fill more boxes when harder, and stay clean', () => {
  const fill = (bots) => {
    let filled = 0, stops = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const game = new StopGame(seed); game.options.bots = bots; writing(game, { letter: 'M', categories: CLASICAS });
      run(game, g => g.phase === 'review');
      for (const p of game.players) for (const [i, answer] of p.sheet.entries()) {
        if (!answer) continue;
        filled++;
        assert.equal(letterOf(answer), 'M', answer);
        const v = judge(answer, game.categories[i], 'M');
        assert.notEqual(v.status, 'red', `${answer} for ${game.categories[i]}`);
      }
      stops += game.stopper !== null;
    }
    return { filled, stops };
  };
  const easy = fill('faciles'), hard = fill('dificiles');
  assert.ok(hard.filled > easy.filled, `${hard.filled} > ${easy.filled}`);
  assert.ok(hard.stops >= easy.stops);
  assert.ok(hard.stops > 0, 'hard bots yell ¡STOP!');
});

test('a bot STOP catches slow bots with empty boxes', () => {
  const game = new StopGame(5); game.options.bots = 'dificiles';
  writing(game, { letter: 'P', categories: CLASICAS });
  run(game, g => g.phase !== 'write');
  if (game.stopper === null) return; // no bot finished in time with this seed
  assert.ok(game.barks.some(b => b.text === '¡STOP!' && b.seat === game.stopper));
  run(game, g => g.phase === 'review');
});

test('host handoff mid-writing: the new host keeps the round, sheets stay hidden and come in at pencils-down', () => {
  const game = writing(humans(2));
  act(game, 1, 'progress', { filled: 2 });
  run(game, g => g.writeTime > 5);
  const snap = game.snapshot(), members = new Map([[2, {}]]);
  const next = StopGame.restore(snap, members);
  assert.equal(next.phase, 'write'); assert.equal(next.letter, game.letter);
  assert.equal(next.players[seatOf(game, 1)].id, null, 'the old host is a bot now');
  assert.ok(next.players.every(p => p.sheet === null));
  const botFilled = next.players.filter(p => p.id === null).map(p => p.filled);
  next.tick(.05);
  next.players.filter(p => p.id === null).forEach((p, i) => assert.ok(p.filled >= botFilled[i], 'bot boxes never empty out'));
  assert.ok(next.accept(2, { action: 'stop', seq: 999, round: next.round, sheet: ['Coro', 'Cabra', 'Crema'] }, 2));
  // Another handoff during the countdown: the stopper sends the sheet again.
  const again = StopGame.restore(next.snapshot(), members);
  assert.equal(again.players[seatOf(game, 2)].submitted, false);
  run(again, g => g.phase === 'collect');
  assert.ok(again.accept(2, { action: 'sheet', seq: 1000, round: again.round, sheet: ['Coro', 'Cabra', 'Crema'] }, 2));
  assert.equal(again.phase, 'review');
  assert.deepEqual(again.players[seatOf(game, 2)].sheet, ['Coro', 'Cabra', 'Crema']);
});

test('host handoff mid-vote keeps the votes cast and lets bots finish voting', () => {
  const game = writing(humans(3), { letter: 'H', categories: ['color'] });
  handIn(game, { 1: ['Hormiga'], 2: ['Hueso'], 3: ['Hielo'] });
  if (game.phase === 'collect') run(game, g => g.phase === 'review');
  const gi = game.review.groups.findIndex(g => g.authors.includes(seatOf(game, 1)));
  act(game, 2, 'vote', { index: 0, group: gi, yes: true });
  const next = StopGame.restore(game.snapshot(), new Map([[2, {}], [3, {}]]));
  assert.equal(next.review.groups[gi].votes[seatOf(game, 2)], true);
  run(next, g => g.review.stage !== 'vote');
  assert.equal(next.review.stage, 'result');
  assert.equal(Object.keys(next.review.groups[gi].votes).length, next.voters(next.review.groups[gi]).length - 1, 'everyone but the silent pana');
});

test('a pana who leaves at pencils-down hands a bot sheet in', () => {
  const game = writing(humans(2));
  act(game, 1, 'stop', { sheet: ['Caracas', 'Caimán', 'Café'] });
  run(game, g => g.phase === 'collect');
  game.removePlayer(2);
  assert.equal(game.phase, 'review');
});

test('a full game: rounds, totals, a winner and the end titles', () => {
  const game = humans(1, 21); game.options.rounds = 3; game.options.mode = 'rapido'; game.options.bots = 'dificiles';
  game.start();
  const letters = [];
  for (let i = 0; i < 400000 && game.phase !== 'finished'; i++) {
    if (game.phase === 'letter' && letters.at(-1) !== `${game.round}${game.letter}`) letters.push(`${game.round}${game.letter}`);
    if (game.phase === 'collect') act(game, 1, 'sheet', { sheet: [] });
    game.tick(.05);
  }
  assert.equal(game.phase, 'finished');
  assert.equal(letters.length, 3);
  const order = ranking(game);
  assert.equal(game.winner, order[0].seat);
  assert.ok(game.titles[game.winner].includes('Cuarto bate'));
  assert.ok(game.players[seatOf(game, 1)].stats.empty >= 3, 'blank sheets earn Monte y culebra points');
  assert.match(game.hostLine, /Calabaza, calabaza/);
  const t = titles(game);
  assert.ok(Object.values(t).flat().includes('Monte y culebra'));
  assert.equal(game.players.reduce((n, p) => n + p.total, 0) > 0, true);
});

test('a pana who sits in a bot chair mid-round writes their own sheet', () => {
  const game = writing(humans(1));
  run(game, g => g.writeTime > 30);
  game.addPlayer(7, 'Nueva');
  const p = game.players.find(x => x.id === 7);
  assert.equal(p.filled, 0); assert.equal(game.plans[p.seat], null);
});

test('Solo panas: empty chairs never spin, write, vote or rank', () => {
  const game = humans(2);
  assert.ok(act(game, 1, 'options', { options: { withBots: false } }));
  assert.deepEqual(seated(game).map(p => p.id), [1, 2]);
  for (let round = 0; round < 6; round++) {
    if (round === 0) game.start(); else game.nextRound();
    assert.ok(seated(game).some(p => p.seat === game.spinner), 'only a pana spins');
  }
  writing(game);
  run(game, g => g.phase !== 'write', 1000);
  assert.equal(game.phase, 'write', 'no bot shouts STOP');
  handIn(game, { 1: ['Caracas', 'Caimán', 'Café'], 2: ['Cumaná', 'Conejo', 'Celeste'] });
  assert.deepEqual(game.review.items.map(i => i.seat).sort(), seated(game).map(p => p.seat).sort());
  assert.equal(game.plans.filter(Boolean).length, 0, 'no bot votes planned');
  assert.deepEqual(ranking(game).map(p => p.id).sort(), [1, 2]);
  assert.ok(Object.values(titles(game)).flat().length > 0);
});

test('Solo panas: a pana leaving mid-vote drops their answers and the vote can still finish', () => {
  const game = humans(3);
  act(game, 1, 'options', { options: { withBots: false } });
  writing(game, { categories: ['color'] });
  handIn(game, { 1: ['Celeste'], 2: ['Crema'], 3: ['Cxzq'] });
  game.removePlayer(3);
  assert.ok(!game.review.items.some(i => i.seat === seatOf({ players: game.players }, null)));
  assert.equal(seated(game).length, 2);
  run(game, g => g.phase === 'tally' || g.phase === 'spin');
  assert.ok(['tally', 'spin'].includes(game.phase));
  const fresh = humans(2); act(fresh, 1, 'options', { options: { withBots: false } });
  fresh.start(); fresh.addPlayer(9, 'Nuevo');
  assert.equal(fresh.players.find(p => p.id === 9).total, 0);
});

test('a lone letter is never an answer, even when the table would wave it through', () => {
  for (const answer of ['C', 'c.', 'C C', 'Ccc', 'Ç']) assert.deepEqual([judge(answer, 'cosa', 'C').status, judge(answer, 'cosa', 'C').reason], ['red', 'short'], answer);
  for (const answer of ['Ca', 'Col', 'Caracas']) assert.notEqual(judge(answer, 'ciudad', 'C').reason, 'short', answer);
  assert.equal(verdictText({ reason: 'short', answer: 'C' }), 'Eso no es una palabra');
  const game = writing(humans(2));
  handIn(game, { 1: ['Caracas', 'Caimán', 'Café'], 2: ['C', 'C', 'C'] });
  assert.ok(game.review.items.filter(i => i.seat === seatOf(game, 2)).every(i => i.status === 'red' && i.reason === 'short'));
  assert.equal(game.review.groups.length, 0, 'nothing for the table to vote on');
});
