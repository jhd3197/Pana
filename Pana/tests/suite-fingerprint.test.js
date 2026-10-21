import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFingerprinter } from '../scripts/suite-fingerprint.js';

const repo = path.resolve(import.meta.dirname, '..', '..');
const fp = createFingerprinter(repo);
const games = fs.readdirSync(path.join(repo, 'Pana', 'games')).filter(g => fs.existsSync(path.join(repo, 'Pana', 'games', g, 'public', 'game.js')));
const gamesIn = files => games.filter(g => files.includes(`Pana/games/${g}/public/game.js`));

test("a game's suite depends on its game and the engine it loads, not on other games", () => {
  const files = fp.files('Pana/games/domino/tests/browser.mjs');
  assert.deepEqual(gamesIn(files), ['domino']);
  for (const f of ['Pana/engine/net.js', 'Pana/engine/worlds/table-world.js', 'Pana/games/domino/public/index.html',
    'Pana/server/src/relay-room.js', 'Pana/tests/browser-kit.js', 'package-lock.json']) assert.ok(files.includes(f), f);
});

test('a suite that loops over every game depends on every game', () => {
  assert.deepEqual(gamesIn(fp.files('Pana/engine/tests/all-games.browser.js')), games);
});

test('a link to another game is not a dependency; why() shows the chain to one', () => {
  assert.equal(fp.why('Pana/games/domino/tests/browser.mjs', 'Pana/games/derrape/public/game.js'), null);
  const chain = fp.why('Pana/games/domino/tests/browser.mjs', 'Pana/engine/net.js');
  assert.equal(chain[0], 'Pana/games/domino/tests/browser.mjs');
  assert.equal(chain.at(-1), 'Pana/engine/net.js');
});

test('fingerprints are stable, and differ by suite and by variant', () => {
  const a = fp('Pana/games/domino/tests/browser.mjs');
  assert.equal(createFingerprinter(repo)('Pana/games/domino/tests/browser.mjs'), a);
  assert.notEqual(fp('Pana/games/derrape/tests/loading.browser.js'), a);
  assert.notEqual(fp('Pana/engine/tests/rural.browser.js', ['llanos']), fp('Pana/engine/tests/rural.browser.js', ['desierto']));
});
