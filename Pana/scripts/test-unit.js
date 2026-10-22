// Runs the unit and convention tests (Pana/**/*.test.js), optionally narrowed
// by substring filters: `npm test -- carreritas feats` runs only the files whose
// path contains one of the filters. No filters runs everything, like before.
// `--help` prints the cheat sheet for choosing the fastest check for a change.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');

const HELP = `Pana tests — pick the fastest check that covers your change

FAST (seconds to ~2 min total):
  npm run check                 syntax check of every served module (seconds)
  npm test                      every unit + conventions test (~2 min)
  npm test -- carreritas           only test files whose path contains "carreritas"
  npm test -- feats rules       union of several filters (seconds)
  npm test -- catalog-registry  Studio catalog ids, sources, factory exports (seconds)
  npm run budget [-- carreritas]   first-load modules and game.js lines vs their caps

BROWSER (minutes PER SUITE — never run the whole set locally):
  npm run test:browser -- carreritas          only suites matching "carreritas"
  npm run test:browser -- --changed        only suites for what changed since dev
  npm run test:browser -- carreritas --fresh  ignore the pass cache for those suites
  npm run test:browser -- carreritas --baseline  failures rerun on the merge-base with dev
  Known failures (Pana/tests/known-failures.json) report as KNOWN, not FAIL.
  A suite that already passed for the same files is skipped (cached).
  The full set runs nightly in CI; local full runs just burn hours.

LOOK (seconds — screenshots from the real frame loop, no assertions):
  npm run shots -- carreritas --track chuao --at gate-60   drive into Chuao's lancha gate
  npm run shots -- carreritas --track choroni --at 0.5 --shots 10 --every 200
  npm run shots -- pintura --query room=demo            any game: a burst of PNGs
  npm run shots -- carreritas --track tovar,sabana --lap 0.1,0.4,0.7   driver views around the lap
  npm run shots -- carreritas --track sabana --menu                    menu art (.webp + thumb + sources.json)
  npm run shots -- --help                               every option

MAKE (scaffolds that do every registration step):
  npm run new-game -- <id>                          a new game from the templates
  npm run new-track -- morrocoy --name "Morrocoy"   a Carreritas circuit, registered everywhere (--dry-run)
  npm run launcher-art -- <id> <image> --row Mesa   hub art: both JPEGs + registration (--dry-run)
  npm run inventory                                  regenerate docs/knowledge/model-inventory.md

Same through the Windows entry point:
  .\\dev.ps1 check                     syntax + unit tests
  .\\dev.ps1 check -Browser derrape    ...plus only the derrape suites
  .\\dev.ps1 check -Help               this text
`;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.test.js')) yield full;
  }
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const filters = argv.map(f => f.toLowerCase());
const all = [...walk(app)];
const files = filters.length
  ? all.filter(f => filters.some(filter => f.toLowerCase().includes(filter)))
  : all;

if (!files.length) {
  console.error(`No test files match ${filters.join(', ')}. Try --help for usage.`);
  process.exit(1);
}
if (filters.length) {
  console.log(`${files.length} of ${all.length} test files match ${filters.join(', ')}:`);
  for (const f of files) console.log('  ' + path.relative(repo, f));
}

const result = spawnSync(
  process.execPath,
  ['--import', './Pana/scripts/register-paths.js', '--test',
   // node --test wants relative specifiers on Windows; absolute paths choke the ESM loader.
   ...files.map(f => path.relative(repo, f))],
  { cwd: repo, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
