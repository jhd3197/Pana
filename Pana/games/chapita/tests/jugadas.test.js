import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapitaGame } from '../public/rules.js';
import { JUGADAS, JUGADA_IDS, chooseJugada, roll, jugadaSeconds, pitchFlavor, beaned } from '../public/jugadas.js';

const until = (game, check, limit = 600) => { for (let t = 0; t < limit && !check(game); t += .05) game.advance(.05); return check(game); };
function batting(seed = 9) {
  const game = new ChapitaGame(seed); game.options.houseRules = 'ninguna'; game.start();
  until(game, g => g.phase === 'flight', 30); return game;
}

test('a jugada pick is a pure function of the seed, the count and the situation', () => {
  assert.equal(chooseJugada(42, 7, 'jonron'), 'home');
  assert.equal(chooseJugada(42, 7, 'window'), 'window');
  assert.equal(chooseJugada(42, 7, 'sencillo'), chooseJugada(42, 7, 'sencillo'));
  assert.equal(chooseJugada(42, 7, 'nothing-here'), null);
  for (let n = 0; n < 200; n++) { const r = roll(1234, n, 'foul'); assert(r >= 0 && r < 1); }
  // Over many pitches every situation reaches each of its jugadas, all known ids.
  const seen = new Set();
  for (const situation of ['strikeout-swinging', 'strikeout-looking', 'strike-swinging', 'strike-looking', 'ball-doblada', 'foul', 'foul-ground', 'short', 'sencillo', 'wall', 'azotea', 'post', 'jonron', 'window', 'cambio', 'weak-contact'])
    for (let n = 0; n < 400; n++) { const id = chooseJugada(99, n, situation); if (id) { assert(JUGADAS[id], id); seen.add(id); } }
  for (const id of ['miss', 'helicopter', 'argue', 'pitch', 'slip', 'boomerang', 'grandpa', 'drain', 'dog', 'roof', 'pinball', 'home', 'window', 'dinner', 'broken']) assert(seen.has(id), id);
  assert.equal(JUGADA_IDS.length, 21, 'the workbench\'s twenty-one plays');
});

test('a jugada keeps the result on screen long enough to play', () => {
  assert.equal(jugadaSeconds(null, 1.1), 1.1);
  assert.equal(jugadaSeconds('pinball', 2), JUGADAS.pinball.seconds);
  assert.equal(jugadaSeconds('pitch', 2), 2);
});

test('pitch flavours: fire with two strikes, crazy when bent, a slow globito', () => {
  assert.equal(pitchFlavor({ kind: 'cae', cap: 'plana' }, 2), 'fuego');
  assert.equal(pitchFlavor({ kind: 'curva', cap: 'doblada' }, 0), 'loca');
  assert.equal(pitchFlavor({ kind: 'planea', cap: 'plana' }, 2), 'globito');
  assert.equal(pitchFlavor({ kind: 'cae', cap: 'plana' }, 1), null);
  const game = batting(); assert('flavor' in game.pitch);
});

test('a pitch high and inside is a chapazo: tuyuyo, a stat and a walk to first', () => {
  assert.equal(beaned({ arrives: null, target: { x: -1, y: 1.4 } }, false), true);
  assert.equal(beaned({ arrives: null, target: { x: -1, y: 1.4 } }, true), false, 'away from a zurdo');
  assert.equal(beaned({ arrives: null, target: { x: 1.1, y: 1.4 } }, true), true);
  assert.equal(beaned({ arrives: null, target: { x: -1, y: .4 } }, false), false, 'low misses the batter');
  assert.equal(beaned({ arrives: 'alto', target: { x: -.5, y: 1.4 } }, false), false);
  const game = batting(), seat = game.batter, p = game.players[seat];
  Object.assign(game.pitch, { arrives: null, target: { x: p.zurdo ? 1.2 : -1.2, y: 1.5 } });
  assert(game.swingAt({ height: 'alto', t: game.pitch.time }));
  assert.equal(game.result.kind, 'hbp'); assert.equal(game.result.jugada, 'bean');
  assert.equal(p.tuyuyo, true); assert.equal(p.stats.chapazos, 1);
  assert.equal(game.bases[0], seat, 'the batter walks to first');
  assert.equal(game.outs, 0); assert.equal(game.strikes, 0);
});

test('results carry their jugada: the jonrón and the window always play', () => {
  const game = batting(), hit = { id: game.pitch.id, from: { x: 0, y: 1, d: .3 }, vel: { x: 0, y: 1, d: 10 }, q: .9, at: game.clock, caught: null, chapazo: false };
  game.phase = 'hit'; game.hit = { ...hit, end: { kind: 'jonron', t: 1, point: { x: 0, y: 5, d: 26 } } }; game.finishPlay();
  assert.equal(game.result.jugada, 'home');
  assert(game.result.until - game.clock >= JUGADAS.home.seconds - 1e-9);
  const again = batting(5); again.phase = 'hit'; again.hit = { ...hit, end: { kind: 'window', t: 1, point: { x: 1.5, y: 2, d: 26 } } }; again.finishPlay();
  assert.equal(again.result.jugada, 'window'); assert.equal(again.holdNext, 'senora');
  assert(again.result.n > 0, 'each result is numbered, so a screen starts its jugada once');
});

test('a catch or a chapazo marks the hit for the fielder\'s jugada', () => {
  const game = batting(); game.phase = 'hit';
  game.hit = { id: 1, from: { x: 0, y: 1, d: .3 }, vel: { x: 0, y: 3, d: 14 }, q: .8, at: game.clock, caught: null, chapazo: false, after: null,
    chance: { fielder: 0, seat: game.fielders[0], t: 1, speed: 13, point: { x: -2.4, y: 1.5, d: 15 } }, end: { kind: 'sencillo', t: 1.4, point: { x: 0, y: 0, d: 18 } } };
  game.catchTry(1); assert.equal(game.hit.after, 'catch');
  game.hit.caught = null; game.catchTry(1.3); assert.equal(game.hit.after, 'bean');
});

test('all-bot games play every kind of jugada and still finish', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const game = new ChapitaGame(seed * 7919); game.start(); let n = 0;
    for (let t = 0; t < 3600 && game.phase !== 'finished'; t += .05) {
      game.advance(.05);
      if (game.result?.n !== n) { n = game.result?.n; if (game.result?.jugada) seen.add(game.result.jugada); }
      if (game.hit?.after) seen.add(game.hit.after);
      if (game.hit?.jugada) seen.add(game.hit.jugada);
    }
    assert.equal(game.phase, 'finished');
  }
  for (const id of ['miss', 'pitch', 'catch', 'bean', 'dog', 'roof', 'drain', 'grandpa', 'broken', 'dinner']) assert(seen.has(id), id);
});
