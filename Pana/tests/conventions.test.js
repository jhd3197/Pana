// Pana's house rules, checked instead of remembered. Each test names the rule
// and lists every file that breaks it. See AGENTS.md and docs/knowledge/pana-kit.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isOnline, gameUrl } from '../web/games.js';
import { staticImports, resolve, specifiers } from './import-graph.js';

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

// Like walk(), but into tests/ folders too (for rules about the suites themselves).
function walkAll(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'vendor'].includes(entry.name)) walkAll(full, keep, out); }
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const pub = (id, file) => path.join(gamesDir, id, 'public', file);
const meta = (id) => JSON.parse(read(path.join(gamesDir, id, 'game.json')));

test('shared room menus include their stylesheet and use pure validated option fields', () => {
  for (const id of games) {
    const source = read(pub(id, 'game.js'));
    if (!source.includes('createRoomOptions')) continue;
    assert(read(pub(id, 'index.html')).includes('/engine/room-options.css'), `${id}: missing shared room options styles`);
    const help = read(pub(id, 'index.html')).match(/<button\b[^>]*\bid="rules"[^>]*>/)?.[0];
    if (help) assert(help.includes('data-room-help'), `${id}: lobby help must use the shared advanced panel`);
    const modules = walk(path.join(gamesDir, id, 'public'), n => n.endsWith('.js')).map(read).join('\n');
    assert(modules.includes('room-options-rules.js'), `${id}: options must use the pure typed validator`);
  }
  for (const kind of ['table', 'live']) {
    const root = path.join(app, 'scripts', 'templates', kind, 'public');
    assert(read(path.join(root, 'game.js.tmpl')).includes('createRoomOptions'), `${kind}: scaffold misses room settings`);
    assert(read(path.join(root, 'options.js.tmpl')).includes('applyRoomOptions'), `${kind}: scaffold options must be validated`);
    assert(read(path.join(root, 'index.html.tmpl')).includes('data-room-help'), `${kind}: scaffold help must follow the shared settings layout`);
  }
});

test('every game has the files the hub and the kit expect', () => {
  const problems = [];
  for (const id of games) {
    const json = meta(id), html = read(pub(id, 'index.html'));
    if (typeof json.name !== 'string' || !json.name) problems.push(`${id}: game.json needs a name`);
    if (typeof json.description !== 'string' || !json.description) problems.push(`${id}: game.json needs a description`);
    if (!Number.isInteger(json.players) || json.players < 1 || json.players > 8) problems.push(`${id}: game.json players must be 1–8`);
    if (!/^#[0-9a-f]{6}$/i.test(json.color || '')) problems.push(`${id}: game.json color must be #rrggbb`);
    if ('tileName' in json && (typeof json.tileName !== 'string' || !json.tileName || json.tileName.length > 12)) problems.push(`${id}: game.json tileName is a short name for the hub card (1–12 characters)`);
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

// ---------- Every game is 3D (AGENTS.md, "Every game is 3D") ----------
// The playable view is a Three.js scene with a perspective camera and the
// player's own pana. engine/tests/all-games.browser.js also checks, in a real
// browser, that every game draws into a WebGL canvas.
// An orthographic (isometric) main camera needs a reason here.
const ISOMETRIC = { cocina: 'isometric kitchen view (docs/knowledge/cocina.md)' };

test('every game is a 3D scene with the player\'s pana', () => {
  const problems = [];
  for (const id of games) {
    const files = walk(path.join(gamesDir, id, 'public'), n => n.endsWith('.js')).filter(f => !/[\\/](card|preview)\.js$/.test(f));
    const code = files.map(read).join('\n');
    if (!/from\s*['"]three['"]/.test(code)) problems.push(`${id}: no Three.js scene (import 'three')`);
    if (!/\/engine\/avatar\.js/.test(code)) problems.push(`${id}: never loads the player's pana (/engine/avatar.js)`);
    if (/new\s+THREE\.OrthographicCamera/.test(code) && !ISOMETRIC[id]) problems.push(`${id}: orthographic main camera; use a PerspectiveCamera (or justify an isometric view in ISOMETRIC)`);
    for (const file of files.filter(f => /[\\/]scene\.js$/.test(f))) {
      if (/getContext\(\s*['"]2d['"]\s*\)/.test(read(file))) problems.push(`${rel(file)}: draws the scene with a 2D canvas`);
    }
  }
  assert.deepEqual(problems, []);
});

// ---------- The file split (docs/ARCHITECTURE.md, "A game's files") ----------
test('rules files are pure: no DOM, no Three.js, no browser storage', () => {
  const problems = [];
  for (const id of games) {
    for (const file of walk(path.join(gamesDir, id, 'public'), n => /(^|-)rules\.js$/.test(n))) {
      const src = read(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [pattern, what] of [[/\bdocument\./, 'document'], [/\bwindow\./, 'window'], [/from\s*['"]three/, 'Three.js'], [/requestAnimationFrame/, 'requestAnimationFrame'], [/localStorage/, 'localStorage']]) {
        if (pattern.test(src)) problems.push(`${rel(file)}: uses ${what}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('every game has rules tests and a browser suite', () => {
  const problems = [];
  for (const id of games) {
    const dir = path.join(gamesDir, id, 'tests');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (!files.some(f => f.endsWith('.test.js'))) problems.push(`${id}: no tests/*.test.js for its rules`);
    if (!files.some(f => /\.browser\.m?js$/.test(f) || f.endsWith('.mjs'))) problems.push(`${id}: no browser suite in tests/`);
  }
  assert.deepEqual(problems, []);
});

// A moved or renamed module must take every importer with it: no served file
// may import a path that isn't there (it would fail only in the browser).
test('every import in served code points at a real file', () => {
  const problems = [];
  const served = [...walk(path.join(app, 'engine'), n => /\.m?js$/.test(n)), ...walk(path.join(app, 'web'), n => /\.m?js$/.test(n)),
    ...games.flatMap(id => walk(path.join(gamesDir, id, 'public'), n => /\.m?js$/.test(n)))];
  for (const file of served) for (const spec of specifiers(read(file))) {
    const target = resolve(file, spec);
    if (target && !fs.existsSync(target)) problems.push(`${rel(file)}: ${spec}`);
  }
  assert.deepEqual(problems, []);
});

// Other sites load these engine files by path (pana.sh's pages, profile and
// shop): moving one breaks them, so they stay where they are.
const PUBLIC_ENGINE = ['kit.css', 'ui.js', 'avatar.js', 'portrait.js', 'portrait-cache.js', 'wardrobe-preview.js'];
test('engine files other sites load stay at their paths', () => {
  assert.deepEqual(PUBLIC_ENGINE.filter(f => !fs.existsSync(path.join(app, 'engine', f))), []);
});

// Without a bundler every static import is a request, and each level of imports
// waits for the one above it. A game's first load stays small; worlds, maps and
// minigames that aren't on screen yet load with import() (Derrape's tracks.js,
// Bululú's minigames/index.js).
const FIRST_LOAD_MODULES = 160;
test(`a game's first load is at most ${FIRST_LOAD_MODULES} modules`, () => {
  const problems = [];
  for (const id of games) {
    const { files } = staticImports(pub(id, 'game.js'));
    if (files.size > FIRST_LOAD_MODULES) problems.push(`${id}: ${files.size} modules before game.js runs`);
  }
  assert.deepEqual(problems, []);
});

// game.js is wiring only. These files predate the limit; they may shrink, never
// grow. When one shrinks, lower its cap with it (within GAME_JS_SLACK lines), so
// the room freed by moving code out isn't quietly filled again.
const GAME_JS_LIMIT = 600, GAME_JS_SLACK = 25, GAME_JS_ALLOWED = { derrape: 2437, bululu: 1350, embuste: 650 };
test(`game.js stays wiring (at most ${GAME_JS_LIMIT} lines)`, () => {
  const problems = [];
  for (const id of games) {
    const file = pub(id, 'game.js');
    if (!fs.existsSync(file)) continue;
    const lines = read(file).split('\n').length, limit = GAME_JS_ALLOWED[id] ?? GAME_JS_LIMIT;
    if (lines > limit) problems.push(`${id}: game.js has ${lines} lines (limit ${limit}); move rules to rules.js, rendering to scene.js, DOM to ui.js`);
    else if (id in GAME_JS_ALLOWED && limit - lines > GAME_JS_SLACK) problems.push(`${id}: game.js shrank to ${lines} lines; lower GAME_JS_ALLOWED.${id} to ${lines}`);
  }
  assert.deepEqual(problems, []);
});

// ---------- Shared pieces ----------
// Games that keep their own pre-game menu instead of the shared lobby, and why.
const OWN_MENU = { derrape: 'four-step garage menu (docs/knowledge/derrape-menu.md)' };
test('every game page loads the shared UI, lobby and pinned Three.js', () => {
  const problems = [];
  for (const id of games) {
    const html = read(pub(id, 'index.html'));
    if (!/href=["']\/engine\/ui\.css["']/.test(html)) problems.push(`${id}: index.html does not link /engine/ui.css`);
    if (!OWN_MENU[id] && !/\/engine\/game-entry\.js["'][^>]*data-pana-entry/.test(html)) problems.push(`${id}: index.html does not load /engine/game-entry.js with data-pana-entry`);
    if (!html.replace(/\s/g, '').includes('"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"')) problems.push(`${id}: import map does not pin three@0.160.0`);
  }
  assert.deepEqual(problems, []);
});

test('rooms take their size from game.json', () => {
  const problems = [];
  for (const id of games) {
    for (const file of walkAll(path.join(gamesDir, id), n => n.endsWith('.js')).filter(f => /[\\/]server[\\/]/.test(f))) {
      if (/maxClients\s*=/.test(read(file))) problems.push(`${rel(file)}: sets maxClients; game.json players is the cap (server/src/colyseus.js)`);
    }
  }
  assert.deepEqual(problems, []);
});

// ---------- Everything the player sees, not just the games ----------
test('no emoji or emoji-prone glyphs anywhere in engine/ or web/', () => {
  const files = ['engine', 'web'].flatMap(dir => walk(path.join(app, dir), n => /\.(html|js|css)$/.test(n)));
  const problems = [];
  for (const file of files) {
    read(file).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const m of line.matchAll(EMOJI)) problems.push(`${rel(file)}:${i + 1} ${m[0]} (U+${m[0].codePointAt(0).toString(16).toUpperCase()})`);
    });
  }
  assert.deepEqual(problems, []);
});

test('served images stay small (at most 600 KB)', () => {
  const problems = [];
  for (const dir of [path.join(app, 'web', 'images'), ...games.map(id => path.join(gamesDir, id, 'public'))]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir, n => /\.(png|jpe?g|webp|gif)$/i.test(n))) {
      const size = fs.statSync(file).size;
      if (size > 600 * 1024) problems.push(`${rel(file)}: ${Math.round(size / 1024)} KB; export a JPEG or WebP`);
    }
  }
  assert.deepEqual(problems, []);
});

// ---------- Tests and docs that agents keep rewriting ----------
// Browser suites wait on game state, never on the clock. Existing sleeps may
// be removed; this number may only go down.
const MAX_FIXED_SLEEPS = 62;
test(`browser suites add no fixed sleeps (waitForTimeout at most ${MAX_FIXED_SLEEPS})`, () => {
  const suites = ['engine', 'games', 'web'].flatMap(dir => walkAll(path.join(app, dir), n => /\.m?js$/.test(n)));
  const count = suites.reduce((n, file) => n + (read(file).match(/waitForTimeout\(/g) || []).length, 0);
  assert.ok(count <= MAX_FIXED_SLEEPS, `${count} waitForTimeout calls; wait on state instead (tests/browser-kit.js waitFor)`);
});

test('every game has a knowledge note listed in the docs index and the README', () => {
  const repo = path.resolve(app, '..'), knowledge = path.join(repo, 'docs', 'knowledge');
  const index = read(path.join(knowledge, 'README.md')), readme = read(path.join(repo, 'README.md'));
  const problems = [];
  for (const id of games) {
    if (!fs.existsSync(path.join(knowledge, `${id}.md`))) problems.push(`${id}: no docs/knowledge/${id}.md`);
    if (!index.includes(`\`${id}.md\``)) problems.push(`${id}: missing from docs/knowledge/README.md`);
    const name = meta(id).name.split(' · ')[0].replace(/[¡!]/g, '');
    if (!readme.includes(name)) problems.push(`${id}: "${name}" missing from README.md's games table`);
  }
  assert.deepEqual(problems, []);
});

test('knowledge notes state results inline, never a local plan or log', () => {
  const knowledge = path.resolve(app, '..', 'docs', 'knowledge');
  const problems = [];
  for (const name of fs.readdirSync(knowledge).filter(n => n.endsWith('.md'))) {
    read(path.join(knowledge, name)).split('\n').forEach((line, i) => {
      if (/docs\/plans\/|\bplans\/\d\d|[\w-]+\.log\b/.test(line)) problems.push(`docs/knowledge/${name}:${i + 1} ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(problems, []);
});
