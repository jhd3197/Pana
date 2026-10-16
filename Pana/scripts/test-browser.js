// Runs every Playwright suite (*.browser.js / *.browser.mjs, games/*/tests/*.mjs)
// one at a time against a Pana server, starting one if none answers.
// Usage: npm run test:browser [-- <filter>...]   e.g. npm run test:browser -- domino caida
// Env: PANA_PLAYWRIGHT_PATH (external Playwright), PANA_TEST_URL, PANA_SUITE_TIMEOUT (ms).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
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

const suites = ['engine', 'games', 'web']
  .flatMap(dir => collect(path.join(app, dir)))
  .map(file => path.relative(repo, file).split(path.sep).join('/'))
  .filter(file => !filters.length || filters.some(f => file.toLowerCase().includes(f)))
  .sort();

async function healthy() {
  try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; }
}

let server = null;
if (!(await healthy())) {
  console.log(`No server at ${base}; starting one.`);
  server = spawn(process.execPath, ['server/src/index.js'], { cwd: app, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await healthy()); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy())) { server.kill(); console.error('Pana did not start.'); process.exit(1); }
}

function run(file) {
  return new Promise(done => {
    const started = Date.now();
    // Older suites take the Playwright path as argv[2]; newer ones read the env.
    const args = process.env.PANA_PLAYWRIGHT_PATH ? [file, process.env.PANA_PLAYWRIGHT_PATH] : [file];
    const env = { ...process.env, PANA_TEST_URL: base, PANA_QA_URL: base };
    const child = spawn(process.execPath, args, { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const timer = setTimeout(() => { log += `\nTimed out after ${timeout} ms`; child.kill(); }, timeout);
    child.on('close', code => {
      clearTimeout(timer);
      done({ file, ok: code === 0, seconds: ((Date.now() - started) / 1000).toFixed(1), log });
    });
  });
}

const results = [];
for (const file of suites) {
  const result = await run(file);
  results.push(result);
  console.log(`${result.ok ? 'ok  ' : 'FAIL'}  ${file}  (${result.seconds}s)`);
  if (!result.ok) console.log(result.log.trim().split('\n').slice(-15).map(line => `      ${line}`).join('\n'));
}
server?.kill();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser suites passed`);
process.exit(failed.length ? 1 : 0);
