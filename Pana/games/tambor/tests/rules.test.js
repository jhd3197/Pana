import test from 'node:test';
import assert from 'node:assert/strict';
import { Rueda, cleanInput, callWindow, callPace, awardTitles, RUEDA_SIZE, GOLPE_SIZE, MOVES, eventSpoken, eventShown } from '../public/rules.js';
import { SONGS, STATIONS, chart, songFor, secondsPerBeat, songBeats, isGolpeBeat, golpePattern, playable } from '../public/songs.js';
import { Judge, GOOD } from '../public/judge.js';
import { rng } from '/engine/random.js';

// A game whose clock we drive: `at(beat)` moves the host's server clock there.
function game(options = {}, people = 1) {
  const g = new Rueda(7);
  for (let i = 1; i <= people; i++) g.addPlayer(i, ['Ana', 'Bruno', 'Caro', 'Dani'][i - 1]);
  if (Object.keys(options).length) assert(g.configure(options));
  g.now = 1000; g.start();
  return g;
}
const ms = (g, beat) => g.song.startAt + beat * secondsPerBeat(g.track) * 1000;
function at(g, beat, inputs = new Map()) { g.now = ms(g, beat); g.update(.05, inputs); }
function run(g, from, to, step = .25, inputs) { for (let b = from; b <= to; b += step) at(g, b, inputs?.(b)); }

test('charts are deterministic, sorted and stay inside the playable song', () => {
  for (const song of SONGS) for (const station of STATIONS) {
    const notes = chart(song, station);
    assert.ok(notes.length > 0, `${song.id} ${station} has notes`);
    notes.forEach((n, i) => { assert.equal(n.i, i); if (i) assert.ok(n.beat >= notes[i - 1].beat); assert.ok(n.beat + n.len <= songBeats(song)); });
    assert.ok(notes.every(n => n.beat >= 8));
  }
  assert.ok(chart(SONGS[2], 'mano').length > chart(SONGS[0], 'mano').length, 'the fast song asks for more');
  const a = golpePattern(3, rng(5)), b = golpePattern(3, rng(5));
  assert.deepEqual(a, b); assert.equal(a.notes.length, 5); assert.equal(a.notes[0][0], 0);
  assert.equal(golpePattern(6, rng(1)).len, 8);
});

test('a solo start fills the rueda with bots: two dancers, four drums, the rest in line', () => {
  const g = game();
  assert.equal(g.players.length, RUEDA_SIZE);
  assert.equal(g.players.filter(p => p.role === 'dancer').length, 2);
  assert.deepEqual(g.players.filter(p => p.role === 'drum').map(p => p.station).sort(), [...STATIONS].sort());
  assert.equal(g.line.length, 2);
  assert.equal(g.player(1).role, 'dancer', 'the pana dances first');
  assert.ok(g.song.startAt > g.now, 'the song starts after a count-in');
});

test('room choices are validated, survive restore and change the game', () => {
  const g = new Rueda(3); g.addPlayer(1, 'Ana');
  assert.equal(g.configure({ songs: '3' }), false);
  assert(g.configure({ mode: 'relevo', songs: 1, misses: 2 }));
  g.start();
  assert.equal(g.slots.length, 1);
  assert.deepEqual(Rueda.restore(g.snapshot(), new Map()).options, g.options);
  assert.equal(g.configure({ songs: 5 }), false, 'no changes mid-game');
});

test('junk input is an empty counter set', () => {
  assert.deepEqual(cleanInput({ song: -2, drum: { p: 'x', g: 1.5, m: 3 }, calls: [[1, 'perfect'], ['a', 'good'], [2, 'wow']], golpe: { round: 2, ok: 1 } }),
    { song: 0, drum: { p: 0, g: 0, m: 3, s: 0 }, clap: { on: 0, off: 0 }, calls: [[1, 'perfect']], golpe: { round: 2, ok: false } });
});

test('Sabor follows the drummers, and a low Sabor makes calls faster and tighter', () => {
  const g = game();
  const drummer = g.players.find(p => p.role === 'drum');
  g.drummed(drummer, 0, 0, 30);
  assert.ok(g.sabor < .3, 'thirty misses sink the beat');
  assert.deepEqual(callPace(g.sabor), { lead: 2, every: 4 });
  g.drummed(drummer, 60, 0, 0);
  assert.ok(g.sabor > .85);
  assert.deepEqual(callPace(g.sabor), { lead: 4, every: 8 });
  assert.ok(callWindow(.2, 0) < callWindow(.9, 0));
  assert.ok(callWindow(.5, 1) > callWindow(.5, 0), 'the crowd buys time');
});

test('three missed calls: ¡Sal de la rueda! and the next pana in line jumps in', () => {
  const g = game();
  const ana = g.player(1), next = g.line[0];
  run(g, -4, 9);
  const misses = new Map();
  let sent = [];
  // Ana answers every call addressed to her with a miss.
  run(g, 9, 60, .25, () => {
    sent = [...sent, ...g.calls.filter(c => c.to === 1 && !c.res && g.beatNow() > c.beat).map(c => [c.id, 'miss'])];
    misses.set(1, cleanInput({ song: g.song.n, calls: sent.slice(-8) }));
    return misses;
  });
  assert.equal(ana.role, 'crowd');
  assert.equal(g.line.at(-1), 1, 'she goes to the back of the line');
  assert.ok(g.events.some(e => e.kind === 'kick' && eventSpoken(e) === '¡Sal de la rueda, Ana!' && eventShown(e) === eventSpoken(e)));
  assert.ok(g.events.some(e => e.kind === 'enter' && e.id === next));
  assert.equal(g.player(next).role, 'dancer');
  assert.ok(ana.stats.fastestKick > 0);
});

test('a pana who never answers is a miss too (no stalling the rueda)', () => {
  const g = game();
  run(g, -4, 70, .5);
  assert.equal(g.player(1).role, 'crowd');
});

test('hits score and keep you dancing; perfect calls count for ¡Palo!', () => {
  const g = game({ songs: 1 });
  let sent = [];
  run(g, -4, songBeats(g.track) + 1, .25, () => {
    sent = [...sent, ...g.calls.filter(c => c.to === 1 && !c.res && g.beatNow() > c.beat).map(c => [c.id, 'perfect'])];
    return new Map([[1, cleanInput({ song: g.song.n, calls: sent.slice(-8) })]]);
  });
  const ana = g.player(1);
  assert.equal(g.phase, 'finished');
  assert.ok(ana.stats.perfect >= 5, `perfect calls: ${ana.stats.perfect}`);
  assert.equal(ana.stats.missed, 0);
  assert.ok(ana.stats.danceBeats > 80);
  assert.ok(g.titles.some(t => t.key === 'palo' && t.id === 1));
  assert.ok(g.titles.some(t => t.key === 'rey'));
});

test('a duelo phrase gives the two dancers different calls', () => {
  const byBeat = new Map(), all = [];
  const g2 = game({ songs: 1 });
  run(g2, -4, 90, .25, () => { for (const c of g2.calls) if (!all.some(x => x.id === c.id)) all.push({ ...c }); return new Map(); });
  for (const c of all) { if (!byBeat.has(c.beat)) byBeat.set(c.beat, []); byBeat.get(c.beat).push(c); }
  const pairs = [...byBeat.values()].filter(list => list.length === 2);
  assert.ok(pairs.some(([a, b]) => a.duelo && a.move !== b.move), 'duelo calls differ');
  assert.ok(pairs.filter(([a]) => !a.duelo).every(([a, b]) => a.move === b.move), 'normal calls match');
  assert.ok(g2.events.some(e => e.kind === 'duelo'));
});

test('drum counters score once and the crowd claps fill the Bulla', () => {
  const g = game();
  const ana = g.player(1);
  // Second song: Ana drums (she danced the first).
  g.endSong(); g.update(8); g.now = ms(g, 10);
  assert.equal(ana.role, 'drum');
  assert.equal(ana.station, 'mano', 'her second drum station rotates');
  const input = cleanInput({ song: g.song.n, drum: { p: 4, g: 2 } });
  g.update(.05, new Map([[1, input]])); g.update(.05, new Map([[1, input]]));
  assert.equal(ana.stats.drum, 16, 'the same counters count once');
  const crowd = g.players.find(p => p.role === 'crowd' && p.bot);
  const before = g.bulla;
  g.clapped(crowd, 5, 0);
  assert.ok(g.bulla > before);
});

test('¡Quiero entrar! cuts the line once per song', () => {
  const g = game({}, 1);
  g.endSong(); g.update(8);
  g.endSong(); g.update(8); // song 3: Ana waits in the crowd
  const ana = g.player(1);
  assert.equal(ana.role, 'crowd');
  assert.ok(g.wantIn(1));
  assert.equal(g.line[0], 1);
  assert.equal(g.wantIn(1), false, 'only once');
});

test('relevo: jump in on the golpe beat, or get thrown out for jumping off it', () => {
  const h = game({ mode: 'relevo', songs: 3 }, 2);
  h.endSong(); h.update(8); h.endSong(); h.update(8);
  const waiting = h.players.find(p => !p.bot && p.role === 'crowd');
  assert.ok(waiting, 'a pana waits in the crowd');
  h.now = ms(h, 16);
  const dancer = h.player(h.slots[0]);
  assert.ok(isGolpeBeat(h.track, 16));
  assert.ok(h.jump(waiting.id, 16, true));
  assert.equal(waiting.role, 'dancer'); assert.equal(dancer.role, 'crowd');
  const other = h.players.find(p => p.role === 'crowd' && !p.benched && p.id !== dancer.id);
  assert.ok(h.jump(other.id, 20, true), 'a jump on a beat that is not a golpe');
  assert.equal(other.benched, true);
  assert.equal(h.wantIn(other.id), false, 'a benched pana sits out the song');
});

test('toque libre: everyone drums, nobody is thrown out', () => {
  const g = game({ mode: 'toque', songs: 1 }, 2);
  assert.ok([1, 2].every(id => g.player(id).role === 'drum'));
  assert.equal(g.players.filter(p => p.role === 'drum').length, 4);
  run(g, -4, songBeats(g.track) + 1, .5);
  assert.equal(g.phase, 'finished');
  assert.ok(!g.events.some(e => e.kind === 'kick'));
  assert.ok(g.team > 0);
});

test('¡Golpe!: whoever misses the pattern is out until one pana is left', () => {
  const g = game({ mode: 'golpe' }, 2);
  assert.equal(g.players.length, GOLPE_SIZE);
  let beat = -4;
  while (g.phase === 'song' && beat < 400) {
    beat += .5;
    const gp = g.golpe, inputs = new Map();
    // Ana always repeats right, Bruno never answers.
    if (gp.notes) inputs.set(1, cleanInput({ song: g.song.n, golpe: { round: gp.round, ok: true } }));
    at(g, beat, inputs);
  }
  assert.equal(g.phase, 'finished');
  assert.equal(g.player(2).role, 'out');
  assert.ok(g.golpe.round >= 1);
  assert.ok(g.ranking()[0].id === 1 || g.golpe.alive.includes(1));
});

test('restore drops panas who left and frees their spot in the center', () => {
  const g = game({}, 2);
  const dancer = g.players.find(p => !p.bot && p.role === 'dancer');
  const copy = Rueda.restore(g.snapshot(), new Map([[dancer.id === 1 ? 2 : 1, {}]]));
  assert.equal(copy.player(dancer.id), undefined);
  assert.equal(copy.slots[dancer.slot], null);
  assert.equal(copy.entering.length, 1, 'the next pana is on the way in');
  assert.ok(copy.players.every(p => p.bot || p.id !== dancer.id));
});

test('titles go to the pana who earned each one', () => {
  const p = (id, stats) => ({ id, stats: { danceBeats: 0, longest: 0, fastestKick: null, perfect: 0, drum: 0, wait: 0, ...stats } });
  const titles = awardTitles([p(1, { danceBeats: 90, longest: 60 }), p(2, { drum: 300, fastestKick: 6, wait: 80 }), p(3, { perfect: 7, fastestKick: 20 })]);
  const who = Object.fromEntries(titles.map(t => [t.key, t.id]));
  assert.deepEqual(who, { rey: 1, mano: 2, suda: 1, plomo: 2, mocho: 2, palo: 3 });
});

// ---------- the local judge ----------
function judgeFor(role, station, extra = {}) {
  const j = new Judge();
  const state = { round: 1, song: { n: 1, track: 1 }, options: { mode: 'rueda' }, calls: [], golpe: null,
    players: [{ id: 1, role, station }], ...extra };
  j.sync(state, 1);
  return j;
}

test('judge: drum hits are perfect, good, stray or missed by their own clock', () => {
  const j = judgeFor('drum', 'palo'), spb = secondsPerBeat(songFor(1));
  const [a, b, c] = chart(songFor(1), 'palo');
  assert.equal(j.press('space', a.beat * spb + .01).grade, 'perfect');
  assert.equal(j.press('space', b.beat * spb + .09).grade, 'good');
  assert.equal(j.press('space', (b.beat + c.beat) / 2 * spb).grade, 'stray');
  j.update(c.beat * spb + GOOD + .01);
  assert.deepEqual(j.input().drum, { p: 1, g: 1, m: 1, s: 1 });
});

test('judge: charrasca holds must last to the end of the note', () => {
  const j = judgeFor('drum', 'charrasca'), spb = secondsPerBeat(songFor(1));
  const [a, b] = chart(songFor(1), 'charrasca');
  j.press('space', a.beat * spb); j.release('space', a.beat * spb + .1);
  j.press('space', b.beat * spb); j.release('space', (b.beat + b.len) * spb);
  assert.deepEqual(j.input().drum, { p: 1, g: 0, m: 1, s: 0 });
});

test('judge: dance calls need the right key, direction, hold and stillness', () => {
  const spb = secondsPerBeat(songFor(1));
  const call = (id, move, beat, extra = {}) => ({ id, to: 1, move, beat, len: MOVES[move].len, w: .15, dir: 'right', ...extra });
  const calls = [call(1, 'cadera', 12), call(2, 'vuelta', 20), call(3, 'panuelo', 28), call(4, 'golpe', 36), call(5, 'pegate', 44), call(6, 'abajo', 52)];
  const j = judgeFor('dancer', null, { calls });
  const t = (beat) => beat * spb;
  assert.equal(j.press('left', t(12) + .02).grade, 'perfect');
  j.press('left', t(19.5)); assert.equal(j.press('space', t(20)).grade, 'miss', 'wrong way');
  j.press('space', t(28)); j.update(t(29)); j.release('space', t(30.1)); j.update(t(30.2));
  j.press('space', t(36)); j.press('down', t(36.5)); // moved during the golpe
  j.press('up', t(44)); j.update(t(45.1));
  j.press('down', t(52)); j.release('down', t(52.5));
  j.update(t(60));
  assert.deepEqual(Object.fromEntries(j.input().calls), { 1: 'perfect', 2: 'miss', 3: 'perfect', 4: 'miss', 5: 'perfect', 6: 'miss' });
});

test('judge: claps on the beat fill Bulla, off the beat they do not', () => {
  const j = judgeFor('crowd', null), spb = secondsPerBeat(songFor(1));
  j.press('space', 16 * spb + .03); j.press('space', 16.5 * spb);
  assert.deepEqual(j.input().clap, { on: 1, off: 1 });
  assert.equal(j.jump(16 * spb).ok, true);
  assert.equal(j.jump(12 * spb).ok, false);
  assert.ok(playable(songFor(1), 16));
});

test('judge: ¡Golpe! answers must match every note and add nothing', () => {
  const golpe = { round: 1, start: 8, len: 4, notes: [[0, 0], [1, 1], [2.5, 0]] };
  const spb = secondsPerBeat(songFor('golpe'));
  const make = () => { const j = judgeFor('drum', 'mano', { golpe, options: { mode: 'golpe' }, song: { n: 1, track: 'golpe' } }); return j; };
  const right = make();
  for (const [off, lane] of golpe.notes) right.press(lane ? 'right' : 'left', (12 + off) * spb + .03);
  right.update(16 * spb + .3);
  assert.deepEqual(right.input().golpe, { round: 1, ok: true });
  const extra = make();
  for (const [off, lane] of golpe.notes) extra.press(lane ? 'right' : 'left', (12 + off) * spb);
  extra.press('left', 15.5 * spb); extra.update(16 * spb + .3);
  assert.deepEqual(extra.input().golpe, { round: 1, ok: false });
});
