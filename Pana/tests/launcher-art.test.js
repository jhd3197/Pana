import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, cropBox, outputSize, parseArtwork, registerArt, registerBrowserCheck, run, CARD, MAIN } from '../scripts/launcher-art.js';

const web = path.resolve(import.meta.dirname, '..', 'web');
const artSource = fs.readFileSync(path.join(web, 'launcher-art.js'), 'utf8');
const suiteSource = fs.readFileSync(path.join(web, 'tests', 'launcher.browser.js'), 'utf8');

const art = `export const categories = ['Todos', 'Carreras', 'Mesa', 'Fiesta'];
export const artwork = {
  carreritas: ['Carreras', 'carreritas.jpg'], stop: ['Mesa'],
  domino: ['Mesa', 'domino.jpg'], stop: ['Fiesta', 'stop.jpg', 'stop-card.jpg'],
};
export const category = game => artwork[game.id]?.[0] || 'Fiesta';
`;
const suite = `  assert.equal(await page.locator('[data-row="Mesa"] .game').count(), await page.locator('[data-id="ludo"]').count() ? 7 : 6);
  assert.deepEqual(await page.locator('.game-row-title').evaluateAll(n => n.map(t => t.firstChild.textContent)), ['Carreras', 'Mesa', 'Fiesta']);
  for (const game of ['criollas', 'ludo']) {
  }
  for (const game of ['tambor', 'stop']) {
  }
`;

test('parseArgs reads the id, image, row and dry run', () => {
  assert.deepEqual(parseArgs(['trifulca', 'a b.png', '--row', 'Fiesta', '--dry-run']),
    { _: ['trifulca', 'a b.png'], dryRun: true, row: 'Fiesta', root: null });
  assert.equal(parseArgs(['x', 'y', '--row=Mesa']).row, 'Mesa');
  assert.throws(() => parseArgs(['x', 'y', '--size', '3']), /Unknown or empty option/);
  assert.throws(() => parseArgs(['x', 'y', '--row']), /Unknown or empty option/);
});

test('cropBox centers the largest 3:2 box', () => {
  assert.deepEqual(cropBox(1536, 1024), { x: 0, y: 0, w: 1536, h: 1024 });
  assert.deepEqual(cropBox(2000, 1000), { x: 250, y: 0, w: 1500, h: 1000 });
  assert.deepEqual(cropBox(1024, 1024), { x: 0, y: 170, w: 1024, h: 683 });
});

test('outputSize matches the shipped sizes and never upscales', () => {
  assert.deepEqual(outputSize(cropBox(3072, 2048), MAIN.width), { w: 1536, h: 1024 });
  assert.deepEqual(outputSize(cropBox(3072, 2048), CARD.width), { w: 640, h: 427 });
  assert.deepEqual(outputSize(cropBox(900, 600), MAIN.width), { w: 900, h: 600 });
  assert.ok(CARD.budget <= 600_000);
});

test('parseArtwork keeps the last of a duplicated key, like JS does', () => {
  const { categories, artwork } = parseArtwork(art);
  assert.deepEqual(categories, ['Todos', 'Carreras', 'Mesa', 'Fiesta']);
  assert.deepEqual([...artwork.keys()], ['carreritas', 'domino', 'stop']);
  assert.deepEqual(artwork.get('stop'), ['Fiesta', 'stop.jpg', 'stop-card.jpg']);
});

test('registerArt adds a game with both files and keeps every other entry', async () => {
  const { text, row, before, newRow } = registerArt(art, 'trifulca', 'Fiesta');
  assert.equal(row, 'Fiesta'); assert.equal(before, 'Fiesta'); assert.equal(newRow, false);
  const url = `data:text/javascript,${encodeURIComponent(text)}`;
  const mod = await import(url);
  assert.deepEqual(mod.artwork.trifulca, ['Fiesta', 'trifulca.jpg', 'trifulca-card.jpg']);
  assert.deepEqual(mod.artwork.carreritas, ['Carreras', 'carreritas.jpg']);
  assert.deepEqual(mod.artwork.stop, ['Fiesta', 'stop.jpg', 'stop-card.jpg']);
  assert.equal(mod.category({ id: 'trifulca' }), 'Fiesta');
});

test('registerArt keeps the current row, needs one for a new game, and adds new rows', () => {
  assert.equal(registerArt(art, 'domino').row, 'Mesa');
  assert.throws(() => registerArt(art, 'trifulca'), /pass --row/);
  const added = registerArt(art, 'trifulca', 'Peleas');
  assert.ok(added.newRow);
  assert.match(added.text, /categories = \['Todos', 'Carreras', 'Mesa', 'Fiesta', 'Peleas'\]/);
});

test('registerArt round-trips the real launcher-art.js', async () => {
  const before = await import(`data:text/javascript,${encodeURIComponent(artSource)}`);
  const id = Object.keys(before.artwork)[0];
  const { text } = registerArt(artSource, id);
  const after = await import(`data:text/javascript,${encodeURIComponent(text.replace(/import\.meta\.url/g, "'file:///x/'"))}`);
  assert.deepEqual(after.categories, before.categories);
  for (const [game, value] of Object.entries(before.artwork)) {
    if (game !== id) assert.deepEqual(after.artwork[game], value, game);
  }
  assert.deepEqual(after.artwork[id], [before.artwork[id][0], `${id}.jpg`, `${id}-card.jpg`]);
});

test('registerBrowserCheck lists the game once and keeps the row assertions in step', () => {
  const fiesta = registerArt(art, 'trifulca', 'Fiesta');
  const once = registerBrowserCheck(suite, { id: 'trifulca', ...fiesta });
  assert.match(once.text, /for \(const game of \['tambor', 'stop', 'trifulca'\]\)/);
  assert.match(once.text, /\? 7 : 6\)/);
  assert.deepEqual(once.warnings, []);
  assert.equal(registerBrowserCheck(once.text, { id: 'trifulca', ...fiesta }).text, once.text);
  const mesa = registerBrowserCheck(suite, { id: 'trifulca', ...registerArt(art, 'trifulca', 'Mesa') });
  assert.match(mesa.text, /\? 8 : 7\)/);
  const peleas = registerBrowserCheck(suite, { id: 'trifulca', ...registerArt(art, 'trifulca', 'Peleas') });
  assert.match(peleas.text, /\['Carreras', 'Mesa', 'Fiesta', 'Peleas'\]\)/);
  assert.equal(registerBrowserCheck(suite, { id: 'stop', ...registerArt(art, 'stop') }).text, suite);
});

test('registerBrowserCheck finds the shapes it edits in the real suite', () => {
  const { warnings } = registerBrowserCheck(suiteSource, { id: 'zzz', ...registerArt(artSource, 'zzz', 'Mesa') });
  assert.deepEqual(warnings, []);
});

test('run refuses unknown games before touching anything', async () => {
  await assert.rejects(run(['nadaquever', 'x.png'], { log: () => {} }), /Unknown game "nadaquever"/);
  await assert.rejects(run(['../web', 'x.png'], { log: () => {} }), /Unknown game/);
  await assert.rejects(run(['domino'], { log: () => {} }), /Usage/);
});
