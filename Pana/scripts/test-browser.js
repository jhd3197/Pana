// Runs every Playwright suite (*.browser.js / *.browser.mjs, games/*/tests/*.mjs)
// one at a time against a Pana server, starting one if none answers.
// Usage: npm run test:browser [-- <filter>...]   e.g. npm run test:browser -- domino caida
// Playwright comes from the repo devDependencies; PANA_PLAYWRIGHT_PATH overrides it.
// Env: PANA_TEST_URL, PANA_SUITE_TIMEOUT (ms).
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

async function healthy() {
  try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; }
}

let server = null;
if (!(await healthy())) {
  console.log(`No server at ${base}; starting one.`);
  const env = { ...process.env, PANA_PORT: new URL(base).port || '80' };
  server = spawn(process.execPath, ['server/src/index.js'], { cwd: app, env, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await healthy()); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy())) { server.kill(); console.error('Pana did not start.'); process.exit(1); }
}

function run({ file, args, label }) {
  return new Promise(done => {
    const started = Date.now();
    const env = { ...process.env, PANA_TEST_URL: base, PANA_QA_URL: base };
    const child = spawn(process.execPath, [file, ...args], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const timer = setTimeout(() => { log += `\nTimed out after ${timeout} ms`; child.kill(); }, timeout);
    child.on('close', code => {
      clearTimeout(timer);
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
server?.kill();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser suites passed`);
process.exit(failed.length ? 1 : 0);
