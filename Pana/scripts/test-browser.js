// Runs every Playwright suite (*.browser.js / *.browser.mjs, games/*/tests/*.mjs)
// one at a time against a Pana server.
// Usage: npm run test:browser [-- <filter>...]   e.g. npm run test:browser -- domino caida
// Playwright comes from the repo devDependencies; PANA_PLAYWRIGHT_PATH overrides it.
// Env: PANA_TEST_URL (reuse that server instead of starting a fresh one),
//      PANA_SUITE_TIMEOUT (ms per suite).
// Without PANA_TEST_URL the runner starts its own server on a free loopback port,
// so a stale server left on :8461 can never answer for the code under test.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');
const timeout = Number(process.env.PANA_SUITE_TIMEOUT) || 10 * 60_000;
const filters = process.argv.slice(2).map(f => f.toLowerCase());

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

const suites = ['engine', 'games', 'web']
  .flatMap(dir => collect(path.join(app, dir)))
  .map(file => path.relative(repo, file).split(path.sep).join('/'))
  .filter(file => !filters.length || filters.some(f => file.toLowerCase().includes(f)))
  .sort()
  .flatMap(runsOf);

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

let current = null;
const cleanup = () => { killTree(current); killTree(server); };
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(130); });

function run({ file, args, label }) {
  return new Promise(done => {
    const started = Date.now();
    const env = { ...process.env, PANA_TEST_URL: base, PANA_QA_URL: base };
    const child = current = spawn(process.execPath, [file, ...args], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const timer = setTimeout(() => { log += `\nTimed out after ${timeout} ms`; killTree(child); }, timeout);
    child.on('close', code => {
      clearTimeout(timer); current = null;
      done({ label, ok: code === 0, seconds: ((Date.now() - started) / 1000).toFixed(1), log });
    });
  });
}

const results = [];
for (const suite of suites) {
  const result = await run(suite);
  results.push(result);
  console.log(`${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}  (${result.seconds}s)`);
  if (!result.ok) console.log(result.log.trim().split('\n').slice(-15).map(line => `      ${line}`).join('\n'));
}
cleanup();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser suites passed`);
if (failed.length && server) console.log(`Server log: ${serverLog}`);
process.exit(failed.length ? 1 : 0);
