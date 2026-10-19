// Runs the Playwright suites (*.browser.js / *.browser.mjs, games/*/tests/*.mjs)
// against one Pana server, several at a time.
// Usage: npm run test:browser [-- <filter>...] [--jobs N] [--changed[=base]]
//                             [--shard k/n] [--retries N] [--record]
//   <filter>     only suites whose path contains it (domino caida)
//   --jobs N     suites run at once (default: an eighth of the CPUs, 1–4; PANA_BROWSER_JOBS).
//                Software WebGL is CPU-bound: 6 at once on 32 threads made suites
//                time out and the run slower than serial
//   --changed    only suites for what changed since `dev` (or =<base>), committed or not;
//                see changed-suites.js for how a change maps to suites
//   --shard k/n  run the k-th of n balanced slices (CI matrix); every shard
//                reads the same committed timings, so the slices never overlap
//   --retries N  rerun a failed suite up to N times (default 1), at half the
//                concurrency; a pass on retry is reported as flaky
//   --record     write this run's suite times to Pana/tests/browser-timings.json
// Suites already create unique rooms, so they can share the server. Slowest
// first (by the timings file), so a long suite never starts last.
// Env: PANA_TEST_URL (reuse that server instead of starting a fresh one),
//      PANA_SUITE_TIMEOUT (ms per suite), PANA_PLAYWRIGHT_PATH.
// Without PANA_TEST_URL the runner starts its own server on a free loopback port,
// so a stale server left on :8461 can never answer for the code under test.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { suitesFor, withinBudget } from './changed-suites.js';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');
const timingsFile = path.join(app, 'tests', 'browser-timings.json');
const timings = fs.existsSync(timingsFile) ? JSON.parse(fs.readFileSync(timingsFile, 'utf8')) : {};
const timeout = Number(process.env.PANA_SUITE_TIMEOUT) || 10 * 60_000;

// `--jobs 4` and `--jobs=4` both work; anything that is not a flag is a filter.
const flags = {}, filters = [], argv = process.argv.slice(2);
while (argv.length) {
  const arg = argv.shift(), flag = arg.match(/^--([a-z]+)(?:=(.*))?$/);
  if (!flag) filters.push(arg.toLowerCase());
  else flags[flag[1]] = flag[2] ?? (['jobs', 'shard', 'retries'].includes(flag[1]) ? argv.shift() : true);
}
const jobs = Math.max(1, Number(flags.jobs) || Number(process.env.PANA_BROWSER_JOBS) || Math.min(4, Math.max(1, Math.floor(os.cpus().length / 8))));
const retries = flags.retries === undefined ? 1 : Number(flags.retries) || 0;

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'vendor') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.browser\.m?js$/.test(entry.name) || (path.basename(dir) === 'tests' && entry.name.endsWith('.mjs'))) out.push(full);
  }
  return out;
}

// A suite that documents variants in its usage line (`node …/rural.browser.js
// [llanos|desierto]`) runs once per variant. Older suites read the Playwright
// path from argv[2] instead of PANA_PLAYWRIGHT_PATH; only those get it there.
function runsOf(file) {
  const source = fs.readFileSync(path.join(repo, file), 'utf8');
  const name = path.basename(file).replace(/[.]/g, '\\.');
  const usage = source.match(new RegExp(`${name}\\s+\\[([a-z0-9-]+(?:\\|[a-z0-9-]+)+)\\]`, 'i'));
  if (usage) return usage[1].split('|').map(variant => ({ file, args: [variant], label: `${file} ${variant}` }));
  const legacy = /argv\[2\]\s*\|\|\s*['"]playwright['"]/.test(source) && process.env.PANA_PLAYWRIGHT_PATH;
  return [{ file, args: legacy ? [process.env.PANA_PLAYWRIGHT_PATH] : [], label: file }];
}

// --changed: map changed paths to the suites that cover them.
function changedFilters(base) {
  const git = args => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr.trim());
    return r.stdout.split('\n').filter(Boolean);
  };
  let files;
  try { files = [...new Set([...git(['diff', '--name-only', `${base}...HEAD`]), ...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]; }
  catch (error) {   // a shallow clone or a force-pushed base: fall back to the smoke set
    console.log(`--changed could not diff against ${base} (${error.message}); running the smoke suites`);
    return ['all-games.browser', 'lobby.browser'];
  }
  const all = ['engine', 'games', 'web'].flatMap(dir => collect(path.join(app, dir))).map(file => path.relative(repo, file).split(path.sep).join('/'));
  // A file's cost is the sum of its runs' recorded times (variants run separately).
  const cost = file => Object.entries(timings).filter(([label]) => label === file || label.startsWith(file + ' ')).reduce((n, [, t]) => n + t, 0) || 60;
  const budget = (Number(process.env.PANA_CHANGED_BUDGET) || 20) * 60;
  const { run, skipped, spent } = withinBudget(suitesFor(repo, files, all), cost, budget);
  console.log(`--changed since ${base}: ${files.length} files → ${run.length ? `${run.length} suites, ~${Math.round(spent / 60)} min of suite time: ${run.join(', ')}` : 'no browser suites'}`);
  if (skipped.length) console.log(`Over the ${budget / 60} min budget, left for the nightly full run: ${skipped.join(', ')}`);
  return run.map(file => file.toLowerCase());
}
if (flags.changed) filters.push(...changedFilters(flags.changed === true ? 'dev' : flags.changed));
if (flags.changed && !filters.length) process.exit(0);

const cost = suite => timings[suite.label] ?? 60;

let suites = ['engine', 'games', 'web']
  .flatMap(dir => collect(path.join(app, dir)))
  .map(file => path.relative(repo, file).split(path.sep).join('/'))
  .filter(file => !filters.length || filters.some(f => file.toLowerCase().includes(f)))
  .sort()
  .flatMap(runsOf)
  .sort((a, b) => cost(b) - cost(a) || a.label.localeCompare(b.label));

// Longest-processing-time split: each suite goes to the lightest shard so far.
if (flags.shard) {
  const [k, n] = String(flags.shard).split('/').map(Number);
  if (!(k >= 1 && k <= n)) { console.error(`--shard wants k/n with 1 ≤ k ≤ n, got ${flags.shard}`); process.exit(1); }
  const load = Array(n).fill(0), mine = [];
  for (const suite of suites) {
    const i = load.indexOf(Math.min(...load)); load[i] += cost(suite);
    if (i === k - 1) mine.push(suite);
  }
  console.log(`Shard ${k}/${n}: ${mine.length} of ${suites.length} suites, ~${Math.round(load[k - 1] / 60)} min of suite time`);
  suites = mine;
}

// child.kill() on Windows leaves Chromium children running; end the whole tree.
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = probe.address(); probe.close(() => resolve(port));
  });
});

async function healthy(url) {
  try { return (await fetch(`${url}/api/health`)).ok; } catch { return false; }
}

if (!suites.length) { console.log('No browser suites match.'); process.exit(0); }

let base = process.env.PANA_TEST_URL, server = null;
const serverLog = path.join(os.tmpdir(), `pana-test-server-${process.pid}.log`);
if (base && !(await healthy(base))) {
  console.error(`PANA_TEST_URL=${base} does not answer /api/health. Start it, or unset PANA_TEST_URL to let the runner start one.`);
  process.exit(1);
}
if (!base) {
  const port = await freePort();
  base = `http://localhost:${port}`;
  const out = fs.openSync(serverLog, 'w');
  server = spawn(process.execPath, ['server/src/index.js'], { cwd: app, env: { ...process.env, PANA_PORT: String(port), PANA_HOST: '127.0.0.1', PANA_DEBUG_ROOMS: '1' }, stdio: ['ignore', out, out] });
  for (let i = 0; i < 75 && server.exitCode === null && !(await healthy(base)); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy(base))) {
    killTree(server);
    console.error(`Pana did not start on ${base}. Server output:\n${fs.readFileSync(serverLog, 'utf8').trim()}`);
    process.exit(1);
  }
  console.log(`Started a fresh Pana server at ${base} (log: ${serverLog}).`);
}

const running = new Set();
const cleanup = () => { running.forEach(killTree); killTree(server); };
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(130); });

function run({ file, args, label }) {
  return new Promise(done => {
    const started = Date.now();
    const env = { ...process.env, PANA_TEST_URL: base, PANA_QA_URL: base };
    const child = spawn(process.execPath, [file, ...args], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(child);
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const timer = setTimeout(() => { log += `\nTimed out after ${timeout} ms`; killTree(child); }, timeout);
    child.on('close', code => {
      clearTimeout(timer); running.delete(child);
      done({ label, ok: code === 0, seconds: (Date.now() - started) / 1000, log });
    });
  });
}

const report = (result, note = '') => {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}  (${result.seconds.toFixed(1)}s)${note}`);
  if (!result.ok) console.log(result.log.trim().split('\n').slice(-15).map(line => `      ${line}`).join('\n'));
};

const started = Date.now(), queue = [...suites], results = new Map();
console.log(`${suites.length} suites, ${jobs} at a time`);
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  for (let suite; (suite = queue.shift());) {
    const result = await run(suite);
    results.set(suite.label, result);
    if (result.ok || !retries) report(result);
    else console.log(`retry ${suite.label} (failed after ${result.seconds.toFixed(1)}s, rerunning at the end)`);
  }
}));

// Failures rerun under half the load of the parallel run (one at a time took
// longer than the whole parallel phase when many suites had timed out).
const flaky = [], again = suites.filter(suite => retries && !results.get(suite.label).ok);
await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(jobs / 2)), again.length) }, async () => {
  for (let suite; (suite = again.shift());) {
    for (let attempt = 0; attempt < retries && !results.get(suite.label).ok; attempt++) {
      const result = await run(suite);
      if (result.ok) flaky.push(suite.label);
      results.set(suite.label, result);
      report(result, result.ok ? '  · passed on retry' : '');
    }
  }
}));
cleanup();

if (flags.record) {
  // A failing suite still holds a slot that long, so its time counts too.
  for (const [label, r] of results) timings[label] = Math.round(r.seconds);
  fs.writeFileSync(timingsFile, `${JSON.stringify(Object.fromEntries(Object.entries(timings).sort()), null, 2)}\n`);
  console.log(`Recorded suite times in ${path.relative(repo, timingsFile)}`);
}

const failed = [...results.values()].filter(r => !r.ok);
console.log(`\n${results.size - failed.length}/${results.size} browser suites passed in ${((Date.now() - started) / 60000).toFixed(1)} min`);
if (flaky.length) console.log(`Flaky (passed on retry): ${flaky.join(', ')}`);
if (failed.length) console.log(`Failed: ${failed.map(r => r.label).join(', ')}`);
if (failed.length && server) console.log(`Server log: ${serverLog}`);
process.exit(failed.length ? 1 : 0);
