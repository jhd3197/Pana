// Runs the unit and convention tests (Pana/**/*.test.js), optionally narrowed
// by substring filters: `npm test -- derrape feats` runs only the files whose
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
  npm test -- derrape           only test files whose path contains "derrape"
  npm test -- feats rules       union of several filters (seconds)

BROWSER (minutes PER SUITE — never run the whole set locally):
  npm run test:browser -- derrape          only suites matching "derrape"
  npm run test:browser -- --changed        only suites for what changed since dev
  npm run test:browser -- derrape --fresh  ignore the pass cache for those suites
  A suite that already passed for the same files is skipped (cached).
  The full set runs nightly in CI; local full runs just burn hours.

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
