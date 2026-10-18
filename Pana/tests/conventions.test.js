// Pana's house rules, checked instead of remembered. Each test names the rule
// and lists every file that breaks it. See AGENTS.md and docs/knowledge/pana-kit.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isOnline, gameUrl } from '../web/games.js';

const app = path.resolve(import.meta.dirname, '..');
const rel = (file) => path.relative(app, file).split(path.sep).join('/');
const read = (file) => fs.readFileSync(file, 'utf8');
const gamesDir = path.join(app, 'games');
const games = fs.readdirSync(gamesDir).filter(id => fs.existsSync(path.join(gamesDir, id, 'public', 'index.html')));

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'tests', 'vendor'].includes(entry.name)) walk(full, keep, out); }
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const pub = (id, file) => path.join(gamesDir, id, 'public', file);
const meta = (id) => JSON.parse(read(path.join(gamesDir, id, 'game.json')));

test('every game has the files the hub and the kit expect', () => {
  const problems = [];
  for (const id of games) {
    const json = meta(id), html = read(pub(id, 'index.html'));
    if (typeof json.name !== 'string' || !json.name) problems.push(`${id}: game.json needs a name`);
    if (typeof json.description !== 'string' || !json.description) problems.push(`${id}: game.json needs a description`);
    if (!Number.isInteger(json.players) || json.players < 1 || json.players > 8) problems.push(`${id}: game.json players must be 1–8`);
    if (!/^#[0-9a-f]{6}$/i.test(json.color || '')) problems.push(`${id}: game.json color must be #rrggbb`);
    if (!fs.existsSync(pub(id, 'card.js'))) problems.push(`${id}: no public/card.js for the hub tile`);
    if (!/href=["']\/engine\/kit\.css["']/.test(html)) problems.push(`${id}: index.html does not link /engine/kit.css`);
  }
  assert.deepEqual(problems, []);
});

test('each game sets --pk-game to its game.json color', () => {
  const problems = [];
  for (const id of games) {
    const css = [pub(id, 'style.css'), pub(id, 'index.html')].filter(fs.existsSync).map(read).join('\n');
    const set = [...css.matchAll(/--pk-game\s*:\s*(#[0-9a-f]{3,8})/gi)].map(m => m[1].toLowerCase());
    if (!set.length) problems.push(`${id}: never sets --pk-game`);
    else if (!set.includes(meta(id).color.toLowerCase())) problems.push(`${id}: --pk-game ${set.join('/')} ≠ game.json ${meta(id).color}`);
  }
  assert.deepEqual(problems, []);
});

test('every game links back to the hub', () => {
  const problems = games.filter(id => {
    const page = walk(path.join(gamesDir, id, 'public'), n => /\.(html|js)$/.test(n)).map(read).join('\n');
    return !/href\s*=\s*["'`]\/["'`]|\.href\s*=\s*["'`]\/["'`]|location\.href\s*=\s*["'`]\/["'`]/.test(page);
  });
  assert.deepEqual(problems, [], 'no href="/" back to Pana');
});

test('single-player games advertise no rooms', () => {
  const problems = [];
  for (const id of games) {
    const json = { ...meta(id), url: `/g/${id}/` };
    if (isOnline(json)) continue;
    if (fs.existsSync(pub(id, 'network.js'))) problems.push(`${id}: players 1 but ships network.js`);
    if (gameUrl(json, 'abc', 'Juan').includes('room=')) problems.push(`${id}: hub link carries ?room=`);
  }
  const hub = read(path.join(app, 'web', 'hub.js'));
  if (!/getElementById\('create-room'\)\.hidden\s*=\s*!isOnline\(/.test(hub)) problems.push('web/hub.js: "Crear sala" is not hidden for single-player games');
  assert.deepEqual(problems, []);
});

test('online games use the shared room kit', () => {
  const problems = [];
  for (const id of games) {
    if (!fs.existsSync(pub(id, 'network.js'))) continue;
    const net = read(pub(id, 'network.js'));
    if (/new WebSocket\(|\/ws['"`]/.test(net)) problems.push(`${id}: network.js opens its own socket`);
    if (!/\/engine\/(net|table-room|live-room)\.js/.test(net)) problems.push(`${id}: network.js does not use the room kit (/engine/net.js, table-room.js or live-room.js)`);
  }
  for (const id of games) {
    const code = walk(path.join(gamesDir, id, 'public'), n => n.endsWith('.js')).map(read).join('\n');
    if (/searchParams\.set\(['"]room['"]/.test(code.replace(/history\.replaceState[^\n]*/g, '')) && !/\/engine\/invite\.js/.test(code)) {
      problems.push(`${id}: builds invite links by hand; use inviteUrl() from /engine/invite.js`);
    }
  }
  assert.deepEqual(problems, []);
});

// Studio's catalog loads without Three.js (a bare 'three' import would fail
// here), so the library page stays light; every entry must point at real code.
// Building each model needs WebGL: web/studio/tests/studio.browser.js previews
// every entry and engine/tests/model-library.browser.js builds every model.
test('every Studio catalog entry is complete and points at real source', async () => {
  const { ASSETS, CATEGORIES, sourcePath } = await import('/studio/catalog.js');
  const repo = path.resolve(app, '..'), problems = [], ids = new Set();
  for (const asset of ASSETS) {
    const name = asset.id || '(no id)';
    if (ids.has(asset.id)) problems.push(`${name}: duplicate id`);
    ids.add(asset.id);
    for (const key of ['id', 'name', 'category', 'source', 'factory']) if (typeof asset[key] !== 'string' || !asset[key]) problems.push(`${name}: no ${key}`);
    if (!CATEGORIES.includes(asset.category)) problems.push(`${name}: unknown category ${asset.category}`);
    if (!Array.isArray(asset.usedBy)) problems.push(`${name}: usedBy must be a list`);
    if (typeof asset.build !== 'function') problems.push(`${name}: no build()`);
    for (const url of [asset.source, ...(asset.dependencies || [])]) {
      const file = path.join(repo, sourcePath(url).replace(/^\/engine\//, 'Pana/engine/').replace(/^\/studio\//, 'Pana/web/studio/'));
      if (url && !fs.existsSync(file.split('#')[0])) problems.push(`${name}: ${url} does not exist`);
    }
  }
  assert.deepEqual(problems, []);
});

// Every absolute import (/engine/…, /studio/…, /g/<game>/…) points at a real
// file, so moving or deleting a module can't leave a page importing nothing.
test('absolute imports resolve to real files', () => {
  const toFile = (url) => url.startsWith('/engine/') ? path.join(app, url)
    : url.startsWith('/studio/') ? path.join(app, 'web', url)
      : url.replace(/^\/g\/([^/]+)\//, (_, id) => `${path.join(gamesDir, id, 'public')}/`);
  const problems = [];
  const files = ['engine', 'games', 'web', 'tests'].flatMap(dir => walk(path.join(app, dir), n => /\.(m?js|html)$/.test(n)));
  for (const file of files) {
    const src = read(file);
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\/(?:engine|studio|g)\/[^'"`$]+\.js)['"]/g)) {
      if (!fs.existsSync(toFile(m[1]))) problems.push(`${rel(file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(problems, []);
});

// Characters some phones draw as colour emoji. Plain arrows (← →) and
// typographic marks are fine; anything with the Unicode Emoji property is not.
const EMOJI = /(?![0-9#*©®™])\p{Emoji}/gu;

test('no emoji or emoji-prone glyphs in the interface', () => {
  const files = [
    ...games.flatMap(id => walk(path.join(gamesDir, id, 'public'), n => /\.(html|js|css)$/.test(n))),
    ...['web/index.html', 'web/hub.js', 'web/pana.js', 'web/games.js', 'engine/ui.js', 'engine/kit.js', 'engine/touch.js', 'engine/results.js'].map(f => path.join(app, f)),
  ];
  const problems = [];
  for (const file of files) {
    read(file).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;          // comments may say anything
      for (const m of line.matchAll(EMOJI)) problems.push(`${rel(file)}:${i + 1} ${m[0]} (U+${m[0].codePointAt(0).toString(16).toUpperCase()})`);
    });
  }
  assert.deepEqual(problems, []);
});

// Colours belong in custom properties (the kit's --pk-* tokens, or a game's own
// named --vars on its `body { --pk-game … }` rule), so a palette change is one
// edit. Outside a custom property, only neutrals (white, black, greys, with any
// alpha) may be written as raw hex.
const NEUTRAL = /^#(?:f{3}|f{6}|0{3}|0{6}|111|888)(?:[0-9a-f]{1,2})?$/i;

test('game stylesheets keep raw colours in custom properties', () => {
  const problems = [];
  for (const id of games) {
    const file = pub(id, 'style.css');
    if (!fs.existsSync(file)) continue;
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const decl of css.split(/[;{}]/)) {
      const value = decl.includes(':') ? decl.slice(decl.indexOf(':') + 1) : '';
      if (/^\s*--/.test(decl)) continue;
      const raw = (value.match(/#[0-9a-f]{3,8}\b/gi) || []).filter(hex => !NEUTRAL.test(hex));
      if (raw.length) problems.push(`${rel(file)}: ${decl.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(problems, []);
});
