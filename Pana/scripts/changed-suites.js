// Which browser suites a change needs (test-browser.js --changed). Narrow on
// purpose: every push to dev runs these, so a typo fix must not cost half an
// hour of software WebGL. The nightly full run catches whatever slips past.
//
//   docs, Markdown, images, unit tests, CI files → no browser suite
//   a browser suite itself                       → that suite
//   a game's code or room                        → that game's suites, plus any
//                                                  suite that loads /g/<game>/
//   an engine module                             → the every-game smoke, the suites
//                                                  that name the module, and the
//                                                  suites of the games that load it
//                                                  (when few do: a kit module most
//                                                  games load is the smoke's job)
//   web/ (hub, Studio, character)                → that page's suites and the smoke
//   server, scripts, browser-kit, dependencies   → the smoke
//
// Then a time budget (withinBudget): the suites a change names, the smoke and
// each touched game's main suite always run; the other related suites run
// cheapest first until the budget is spent, and the rest wait for the nightly run.
import fs from 'node:fs';
import path from 'node:path';
import { specifiers, resolve } from '../tests/import-graph.js';

const SMOKE = ['Pana/engine/tests/all-games.browser.js', 'Pana/engine/tests/lobby.browser.js'];
// Above this many importing games, a module counts as kit: the smoke covers it.
const FEW_GAMES = 4;

const isSuite = file => /\.browser\.m?js$/.test(file) || /^Pana\/games\/[^/]+\/tests\/[^/]+\.mjs$/.test(file);
const ignored = file => /\.(md|txt|png|jpe?g|webp|mp3|ogg|wav|svg|ico)$/i.test(file) || /\.test\.js$/.test(file)
  || /^(docs|art)\//.test(file) || /^\.github\//.test(file) || file === 'CHANGELOG.md';

// Every module a game can load (static and literal dynamic imports), as repo paths.
function gameModules(repo, game) {
  const seen = new Set(), stack = [path.join(repo, 'Pana', 'games', game, 'public', 'game.js')];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const spec of specifiers(fs.readFileSync(file, 'utf8'))) {
      const target = resolve(file, spec);
      if (target) stack.push(target);
    }
  }
  return new Set([...seen].map(f => path.relative(repo, f).split(path.sep).join('/')));
}

// files: changed repo paths; suites: every suite's repo path. Returns
// { must, may }: suites that always run, and related ones the budget may cut.
export function suitesFor(repo, files, suites) {
  const out = new Set(), must = new Set();
  const read = file => { try { return fs.readFileSync(path.join(repo, file), 'utf8'); } catch { return ''; } };
  const games = fs.readdirSync(path.join(repo, 'Pana', 'games'));
  let loads = null;   // game → modules it loads, computed on first engine change
  const mentions = (needle) => suites.filter(s => read(s).includes(needle));
  for (const file of files) {
    if (ignored(file)) continue;
    if (isSuite(file)) { if (suites.includes(file)) must.add(file); continue; }
    const game = file.match(/^Pana\/games\/([^/]+)\//)?.[1];
    if (game) {
      // A test helper or fixture: the suites that import it.
      if (/\/tests\//.test(file)) { for (const s of mentions(file.split('/').pop())) out.add(s); continue; }
      for (const s of suites) if (s.startsWith(`Pana/games/${game}/`)) out.add(s);
      must.add(`Pana/games/${game}/tests/browser.mjs`);
      for (const s of mentions(`/g/${game}/`)) if (!SMOKE.includes(s)) out.add(s);
      continue;
    }
    const engine = file.match(/^Pana\/engine\/(.+\.(?:js|css|json))$/)?.[1];
    if (engine && !engine.startsWith('tests/')) {
      SMOKE.forEach(s => must.add(s));
      const name = engine.split('/').pop();
      for (const s of mentions(name)) out.add(s);
      loads ??= Object.fromEntries(games.map(g => [g, gameModules(repo, g)]));
      const users = games.filter(g => loads[g].has(file));
      if (users.length <= FEW_GAMES) for (const g of users) for (const s of suites) if (s.startsWith(`Pana/games/${g}/`)) out.add(s);
      continue;
    }
    const web = file === 'Pana/web/personaje.html' ? 'character' : file.match(/^Pana\/web\/(studio|character)(?:\/|\.html$)/)?.[1];
    if (web) { for (const s of suites) if (s.startsWith(`Pana/web/${web}/tests/`)) out.add(s); SMOKE.forEach(s => must.add(s)); continue; }
    if (/^Pana\/web\//.test(file)) { for (const s of suites) if (s.startsWith('Pana/web/tests/')) must.add(s); SMOKE.forEach(s => must.add(s)); continue; }
    if (/^Pana\/(server|scripts|tests)\//.test(file) || /^Pana\/engine\//.test(file) || file === 'package-lock.json' || file === 'package.json') {
      SMOKE.forEach(s => must.add(s));
    }
  }
  const known = s => suites.includes(s);
  return { must: [...must].filter(known).sort(), may: [...out].filter(s => known(s) && !must.has(s)).sort() };
}

// The suites to run: every `must`, then `may` cheapest first while the total
// cost (seconds, from browser-timings.json) stays within budget. Returns { run, skipped }.
export function withinBudget({ must, may }, cost, budget) {
  let spent = must.reduce((n, s) => n + cost(s), 0);
  const run = [...must], skipped = [];
  for (const s of [...may].sort((a, b) => cost(a) - cost(b))) {
    if (spent + cost(s) <= budget) { run.push(s); spent += cost(s); } else skipped.push(s);
  }
  return { run, skipped, spent };
}
