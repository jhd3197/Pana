// Instructions never go on the HUD; they live in the pause menu's
// Instrucciones page (engine/controls-page.js), filled from each game's
// public/instructions.js. These checks fail when a game ships a persistent
// controls line, keycaps or a hint element again, and when a game has no
// Instrucciones data. See docs/knowledge/pana-ui.md, "Instrucciones".
//
// Contextual prompts that react to the game's state (a "Tu turno" banner, an
// "E abrir" next to a door, a countdown) are not instructions. Their key cap
// is a <kbd data-prompt> (shown only while the prompt applies); an element
// whose name looks like a hint but is one of those, or a script that builds
// such caps (`game:file.js`), goes in ALLOWED with why.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const rel = file => path.relative(app, file).split(path.sep).join('/');
const read = file => fs.readFileSync(file, 'utf8');
const gamesDir = path.join(app, 'games');
const games = fs.readdirSync(gamesDir).filter(id => fs.existsSync(path.join(gamesDir, id, 'public', 'index.html')));

function walk(dir, keep, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'tests', 'vendor', 'locales', 'images', 'audio', 'models'].includes(entry.name)) walk(full, keep, out); }
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

// Games still moving their instructions off the HUD. Empty it, never grow it.
export const PENDING = new Set([]);

// `game:#id` or `game:.class` → why it is not an instruction.
export const ALLOWED = {
  'domino:#hint': 'the Pista button: a move the player asks for, not a controls line',
  'caida:#hint': 'the Pista button: a move the player asks for, not a controls line',
  'trifulca:hud.js': "builds the tutorial card's caps: the keys of the step on screen, gone with the card",
};

// An id or class named like an instructions element.
export const HINT_NAME = /^(?:[\w-]*-)?(?:hints?|instructions?|help|legend|keys|keycaps?|tips|tutorial-keys|controls-(?:hint|help|list|legend))(?:-[\w-]*)?$/i;
// Text that reads as a controls list or a how-to line, in static markup.
export const HINT_TEXT = /\bWASD\b|\bW\s?A\s?S\s?D\b|\bClic (?:para|y arrastra)\b|\bEspacio para\b|\b[Pp]ulsa\s+\S+\s+para\b|\b[Mm]antén\s+\S+\s+para\b|\b[Aa]rrastra (?:para|el dedo)\b|\b[Uu]sa las flechas\b|\bflechas para\b/;

const tags = html => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(m => ({ tag: m[1].toLowerCase(), attrs: m[2] }));
const attr = (attrs, name) => attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const names = attrs => [...(attr(attrs, 'id') ? [`#${attr(attrs, 'id')}`] : []), ...(attr(attrs, 'class') || '').split(/\s+/).filter(Boolean).map(c => `.${c}`)];

// Problems in one game's public files: [file: what].
export function hintProblems(id, files = { html: [], css: [], js: [] }) {
  const problems = [];
  const allowed = name => ALLOWED[`${id}:${name}`];
  for (const [file, html] of files.html) {
    for (const { tag, attrs } of tags(html)) {
      if (tag === 'kbd' && !/\sdata-prompt\b/.test(attrs)) problems.push(`${file}: <kbd> keycap in the page (a contextual prompt's cap is <kbd data-prompt>)`);
      if (/\sdata-pana-hint\b/.test(attrs)) problems.push(`${file}: data-pana-hint reminder in the page`);
      for (const name of names(attrs)) if (HINT_NAME.test(name.slice(1)) && !allowed(name)) problems.push(`${file}: ${name} looks like an instructions element`);
    }
    const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
    const phrase = text.match(HINT_TEXT);
    if (phrase) problems.push(`${file}: controls text "${phrase[0]}" in the markup`);
  }
  for (const [file, css] of files.css) {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g) || [];
    for (const selector of selectors) for (const [, name] of selector.matchAll(/[#.]([\w-]+)/g)) {
      const kind = selector.includes(`#${name}`) ? '#' : '.';
      if (HINT_NAME.test(name) && !allowed(`${kind}${name}`) && !allowed(`#${name}`) && !allowed(`.${name}`)) { problems.push(`${file}: styles ${kind}${name}`); break; }
    }
  }
  for (const [file, js] of files.js) {
    if (/control-hints\.js/.test(js)) problems.push(`${file}: uses engine/control-hints.js`);
    if (/<kbd\b(?![^>]*data-prompt)|createElement\(\s*['"]kbd['"]|\(\s*['"]kbd['"]\s*[,)]/.test(js) && !allowed(file.split('/').pop())) problems.push(`${file}: builds <kbd> keycaps`);
    if (/data-pana-hint|panaHint\b/.test(js)) problems.push(`${file}: data-pana-hint reminder`);
  }
  return problems;
}

function gameFiles(id) {
  const all = walk(path.join(gamesDir, id, 'public'), name => /\.(?:html|css|js)$/.test(name));
  const of = ext => all.filter(f => f.endsWith(ext) && !f.endsWith('instructions.js')).map(f => [rel(f), read(f)]);
  return { html: of('.html'), css: of('.css'), js: of('.js') };
}

test('no game puts instructions on its HUD', () => {
  // HUD_GAMES=a,b checks those games even while they are PENDING.
  const only = process.env.HUD_GAMES?.split(',').filter(Boolean);
  assert.deepEqual(games.filter(id => only ? only.includes(id) : !PENDING.has(id)).flatMap(id => hintProblems(id, gameFiles(id))), []);
});

test('every game declares its Instrucciones page', () => {
  const problems = [];
  for (const id of games.filter(id => !PENDING.has(id) || fs.existsSync(path.join(gamesDir, id, 'public', 'instructions.js')))) {
    const file = path.join(gamesDir, id, 'public', 'instructions.js');
    if (!fs.existsSync(file)) { problems.push(`${id}: no public/instructions.js (engine/controls-page.js)`); continue; }
    const source = read(file);
    if (!/export default\b/.test(source)) problems.push(`${id}: instructions.js has no default export`);
    if (!/\bgoal\s*:/.test(source)) problems.push(`${id}: instructions.js has no goal`);
    if (!/\bsections\s*:/.test(source) || !/\baction\s*:/.test(source)) problems.push(`${id}: instructions.js lists no controls`);
    if (!/\bloc\(/.test(source)) problems.push(`${id}: instructions.js text goes through loc()`);
  }
  assert.deepEqual(problems, []);
});

test('every allowed hint-like name still exists and says why', () => {
  for (const [key, why] of Object.entries(ALLOWED)) {
    const [id, name] = key.split(':');
    assert.ok(why.length > 20, `${key}: give a reason`);
    const files = gameFiles(id);
    const used = name.endsWith('.js') ? files.js.some(([file]) => file.endsWith(`/${name}`)) : [...files.html, ...files.css].some(([, text]) => text.includes(name.slice(1)));
    assert.ok(used, `${key}: no longer in the game; drop it from ALLOWED`);
  }
});

test('the guard catches the patterns it is for', () => {
  const html = name => ({ html: [['x.html', name]], css: [], js: [] });
  assert.equal(hintProblems('x', html('<div id="controls-hint">WASD moverte</div>')).length, 2);
  assert.equal(hintProblems('x', html('<span class="keys"><kbd>W</kbd></span>')).length, 2);
  assert.equal(hintProblems('x', html('<p>Pulsa E para abrir</p>')).length, 1);
  assert.equal(hintProblems('x', html('<div id="touch-controls"></div><p>Tu turno</p>')).length, 0, 'touch pads and state prompts pass');
  assert.equal(hintProblems('x', html('<button id="action" hidden><kbd data-prompt>E</kbd> Abrir</button>')).length, 0, 'a contextual prompt keeps its cap');
  assert.equal(hintProblems('x', { html: [], css: [['x.css', '.hud .hint-line { color: red }']], js: [] }).length, 1);
  assert.equal(hintProblems('x', { html: [], css: [], js: [['x.js', "import { keyFor } from '/engine/control-hints.js';"]] }).length, 1);
});
