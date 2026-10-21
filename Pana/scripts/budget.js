// How close each game is to its size budgets, before you write the code that
// breaks them: first-load modules (static imports reachable from game.js),
// their bytes and depth, and game.js lines, against the caps the conventions
// test enforces (Pana/tests/budgets.js).
//
//   npm run budget                       every game, tightest first
//   npm run budget -- derrape            one game, plus its five heaviest imports
//   npm run budget -- derrape --base dev the change since another commit
//
// The heaviest imports are game.js's direct static imports ranked by how many
// first-load modules each one pulls in: the ones worth turning into import().
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { staticImports } from '../tests/import-graph.js';
import { FIRST_LOAD_MODULES, gameJsCap } from '../tests/budgets.js';
import { resolve, specifiers } from '../tests/import-graph.js';

const app = path.resolve(import.meta.dirname, '..'), repo = path.resolve(app, '..');
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(fs.readFileSync(import.meta.filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(0);
}
const baseAt = argv.indexOf('--base'), base = baseAt >= 0 ? argv[baseAt + 1] : null;
const filters = argv.filter((a, i) => !a.startsWith('--') && !(baseAt >= 0 && i === baseAt + 1));
const games = fs.readdirSync(path.join(app, 'games')).filter(id => fs.existsSync(path.join(app, 'games', id, 'public', 'game.js')))
  .filter(id => !filters.length || filters.some(f => id.includes(f)));
if (!games.length) { console.error(`No game matches ${filters.join(', ')}.`); process.exit(1); }

// Readers for another commit: `git show <base>:<path>`, cached.
const atBase = base && (() => {
  const cache = new Map();
  const rel = (f) => path.relative(repo, f).split(path.sep).join('/');
  const read = (f) => {
    if (!cache.has(f)) { try { cache.set(f, execFileSync('git', ['show', `${base}:${rel(f)}`], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { cache.set(f, null); } }
    return cache.get(f);
  };
  return { read: (f) => read(f) ?? '', exists: (f) => read(f) !== null };
})();

const measure = (id, io) => {
  const entry = path.join(app, 'games', id, 'public', 'game.js');
  const graph = staticImports(entry, io);
  const lines = (io ? io.read(entry) : fs.readFileSync(entry, 'utf8')).split('\n').length;
  return { modules: graph.files.size, kb: Math.round(graph.bytes / 1024), depth: graph.depth, lines };
};
const pct = (n, cap) => `${String(Math.round(n / cap * 100)).padStart(3)}%`;
const delta = (now, then) => then == null ? '' : now === then ? '  (=)' : `  (${now > then ? '+' : ''}${now - then})`;

const rows = games.map(id => {
  const now = measure(id), then = atBase ? measure(id, atBase) : null;
  return { id, now, then, cap: gameJsCap(id), room: Math.min(FIRST_LOAD_MODULES - now.modules, gameJsCap(id) - now.lines) };
}).sort((a, b) => a.room - b.room);

console.log(`first load ≤ ${FIRST_LOAD_MODULES} modules · game.js ≤ its cap${base ? ` · change since ${base}` : ''}\n`);
for (const { id, now, then, cap } of rows) {
  const warn = now.modules > FIRST_LOAD_MODULES || now.lines > cap ? '  OVER' : FIRST_LOAD_MODULES - now.modules < 5 || cap - now.lines < 15 ? '  tight' : '';
  console.log(`${id.padEnd(14)} modules ${String(now.modules).padStart(3)}/${FIRST_LOAD_MODULES} ${pct(now.modules, FIRST_LOAD_MODULES)}${delta(now.modules, then?.modules)}`
    + `  ·  game.js ${String(now.lines).padStart(4)}/${cap} ${pct(now.lines, cap)}${delta(now.lines, then?.lines)}`
    + `  ·  ${now.kb} KB, depth ${now.depth}${warn}`);
}

// One game: which direct imports cost the most first-load modules.
if (games.length === 1) {
  const entry = path.join(app, 'games', games[0], 'public', 'game.js');
  const direct = specifiers(fs.readFileSync(entry, 'utf8')).map(s => resolve(entry, s)).filter(f => f && fs.existsSync(f));
  const dynamic = new Set([...fs.readFileSync(entry, 'utf8').matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g)].map(m => resolve(entry, m[1])));
  const heavy = [...new Set(direct)].filter(f => !dynamic.has(f)).map(f => ({ f, n: staticImports(f).files.size })).sort((a, b) => b.n - a.n).slice(0, 5);
  console.log('\nheaviest static imports (modules each pulls in; candidates for import()):');
  for (const { f, n } of heavy) console.log(`  ${String(n).padStart(3)}  ${path.relative(app, f).split(path.sep).join('/')}`);
  console.log('\nlazy pattern: a stub on race/game state, swapped when import() lands (see docs/knowledge/derrape.md).');
}
