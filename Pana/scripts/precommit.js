// The pre-commit gate (.githooks/pre-commit, installed by `npm install` through
// the "prepare" script): a few seconds of the checks that most often turn dev
// red. Syntax of the staged scripts, the conventions test (game.js line caps,
// the first-load module cap, conflict markers, the changelog lint) and the
// changelog test. The full `npm test` and browser suites stay manual.
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: repo, encoding: 'utf8' })
  .split('\n').filter(f => /\.m?js$/.test(f));
let failed = false;
for (const file of staged) {
  const r = spawnSync(process.execPath, ['--check', file], { cwd: repo, encoding: 'utf8' });
  if (r.status) { failed = true; process.stderr.write(r.stderr); }
}
const tests = spawnSync(process.execPath, [path.join(repo, 'Pana/scripts/test-unit.js'), 'conventions', 'changelog'], { cwd: repo, encoding: 'utf8' });
if (tests.status) { failed = true; process.stderr.write(tests.stdout.split('\n').filter(l => /not ok|^\s+[+-] |Error|assert/.test(l)).join('\n') + '\n'); }
if (failed) {
  console.error('\npre-commit: fix the above (or run `npm test -- conventions changelog` to see it all).');
  process.exit(1);
}
