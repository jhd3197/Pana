import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { suitesFor, withinBudget } from '../scripts/changed-suites.js';

const repo = path.resolve(import.meta.dirname, '..', '..');
const suites = [
  'Pana/engine/tests/all-games.browser.js', 'Pana/engine/tests/lobby.browser.js', 'Pana/engine/tests/fx.browser.js',
  'Pana/games/domino/tests/browser.mjs', 'Pana/games/domino/tests/options.browser.js',
  'Pana/games/carreritas/tests/loading.browser.js', 'Pana/engine/tests/farm-animals.browser.js',
  'Pana/web/studio/tests/studio.browser.js', 'Pana/web/tests/launcher.browser.js',
];
const pick = files => suitesFor(repo, files, suites);

test('docs, images, unit tests and CI files need no browser suite', () => {
  assert.deepEqual(pick(['CHANGELOG.md', 'docs/knowledge/pana-net.md', 'Pana/web/images/launcher/lancha.jpg',
    'Pana/games/domino/tests/rules.test.js', 'Pana/tests/conventions.test.js', '.github/workflows/test.yml']), { must: [], may: [] });
});

test('an edited suite runs itself, and only itself', () => {
  assert.deepEqual(pick(['Pana/games/domino/tests/options.browser.js']), { must: ['Pana/games/domino/tests/options.browser.js'], may: [] });
});

test("a game's code runs its main suite for sure and its others if the budget allows", () => {
  assert.deepEqual(pick(['Pana/games/domino/public/rules.js']),
    { must: ['Pana/games/domino/tests/browser.mjs'], may: ['Pana/games/domino/tests/options.browser.js'] });
});

test('suites that load a game from elsewhere come along with it', () => {
  assert.ok(pick(['Pana/games/carreritas/public/tracks.js']).may.includes('Pana/engine/tests/farm-animals.browser.js'));
});

test('an engine module runs the smoke and the suites that name it', () => {
  const { must, may } = pick(['Pana/engine/fx.js']);
  assert.deepEqual(must, ['Pana/engine/tests/all-games.browser.js', 'Pana/engine/tests/lobby.browser.js']);
  assert.ok(may.includes('Pana/engine/tests/fx.browser.js'));
  assert.ok(!may.includes('Pana/games/domino/tests/browser.mjs'), 'every game loads fx.js: the smoke covers it, not each game');
});

test("a game's shared test helper runs the suites that import it; Studio's page runs Studio's suites", () => {
  assert.ok(pick(['Pana/games/carreritas/tests/menu-helpers.js']).may.includes('Pana/games/carreritas/tests/loading.browser.js'));
  assert.ok(pick(['Pana/web/studio.html']).may.includes('Pana/web/studio/tests/studio.browser.js'));
});

test('the budget keeps every must and adds the cheapest maybes that fit', () => {
  const cost = s => ({ a: 300, b: 100, c: 200, d: 900 })[s];
  assert.deepEqual(withinBudget({ must: ['a'], may: ['d', 'c', 'b'] }, cost, 650), { run: ['a', 'b', 'c'], skipped: ['d'], spent: 600 });
  assert.deepEqual(withinBudget({ must: ['d'], may: ['b'] }, cost, 500).run, ['d'], 'a must runs even over budget');
});
