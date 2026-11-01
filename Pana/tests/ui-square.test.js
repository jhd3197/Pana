// One square UI style: no rounded corners in the hub, the engine UI or any
// game's interface. See docs/knowledge/pana-kit.md, "One square style".
//
// A border-radius in a stylesheet (or in a style string a script builds) may
// only be 0, inherit, a --pk-r* token (kit.css keeps them at 0) or
// var(--pk-radius-round) for a real circle: avatar discs, status and team
// dots, colour swatches, joystick discs, spinners, balls and coins drawn in
// CSS. A literal 50% is allowed only on a selector in ROUND_SELECTORS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const rel = (file) => path.relative(app, file).split(path.sep).join('/');

// TODO: Capis is being restyled in its own branch; drop this entry once its
// HUD corners are square.
const ALLOWED_FILES = [/^games\/capis\//];
// Canvas art painted onto 3D meshes or launcher previews, not interface: a
// pool table's rails, board tiles, playing cards, a wooden track sign.
const ART_ROUND_RECT = new Set([
  'games/billar/public/preview.js',
  'games/bululu/public/board.js',
  'games/bululu/public/minigames/caida.js',
  'games/carreritas/public/track-kit.js',
  'games/poquer/public/card.js',
]);
// Selectors that may write a literal 50% (prefer var(--pk-radius-round)).
const ROUND_SELECTORS = [];
const OK = /^(0|0px|inherit|var\(--pk-r(-sm|-lg|-xl)?\)|var\(--pk-radius-round(, ?50%)?\))(\s*!important)?$/;

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 3D models paint art (cards, signs) onto textures; that is not UI.
      if (!['node_modules', 'tests', 'vendor', 'models'].includes(entry.name)) walk(full, keep, out);
    } else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const roots = ['engine', 'web', 'games'].map(d => path.join(app, d));
const files = roots.flatMap(d => walk(d, n => /\.(css|html|js)$/.test(n)))
  .filter(f => !ALLOWED_FILES.some(re => re.test(rel(f))));

test('kit radius tokens stay square', () => {
  const kit = fs.readFileSync(path.join(app, 'engine', 'kit.css'), 'utf8');
  for (const name of ['--pk-r-sm', '--pk-r', '--pk-r-lg', '--pk-r-xl']) {
    assert.match(kit, new RegExp(`${name}:\\s*0;`), `${name} must be 0 in kit.css`);
  }
  assert.match(kit, /--pk-radius-round:\s*50%;/, 'kit.css defines --pk-radius-round');
});

test('UI stylesheets and scripts keep corners square', () => {
  const problems = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const isJs = file.endsWith('.js');
    // CSS and style strings: border-radius: <value>
    for (const m of src.matchAll(/([^{};]*)border-(?:(?:top|bottom)-(?:left|right)-)?radius\s*:\s*([^;}"'`]+)/g)) {
      const value = m[2].trim();
      if (OK.test(value)) continue;
      if (value === '50%' && ROUND_SELECTORS.some(sel => m[1].includes(sel))) continue;
      problems.push(`${rel(file)}: border-radius: ${value}`);
    }
    if (!isJs) continue;
    // element.style.borderRadius / { borderRadius: '…' }
    for (const m of src.matchAll(/borderRadius\s*[:=]\s*['"`]([^'"`]+)['"`]/g)) {
      if (!OK.test(m[1].trim())) problems.push(`${rel(file)}: borderRadius ${m[1]}`);
    }
    // canvas HUD boxes: roundRect(x, y, w, h, r) with a radius
    if (ART_ROUND_RECT.has(rel(file))) continue;
    for (const m of src.matchAll(/\.roundRect\(([^)]*)\)/g)) {
      if (m[1].split(',').length > 4) problems.push(`${rel(file)}: roundRect(${m[1]})`);
    }
  }
  assert.deepEqual(problems, [], 'Use 0, a --pk-r* token or var(--pk-radius-round) for a real circle');
});
