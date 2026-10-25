// Picture benchmark for any game. Opens the game with the picture settings in
// the address (?pana-quality=…, never saved; engine/settings.js), lets the real
// loop run and reads engine/perf.js: frame times, draws, triangles, CPU submit
// and GPU time, and the resolution drawn. The frame-rate guard is off so every
// run draws at the resolution it asked for.
//
//   npm run perf -- carreritas                    # Nítida, Equilibrada and Rápida
//   npm run perf -- carreritas --tiers            # ...plus each knob alone from Nítida
//   npm run perf -- domino --base main            # a base commit against this tree
//   npm run perf -- carreritas --views chuao,selva --seconds 10 --rounds 2 --throttle 4
//
// A game can say where to measure in games/<id>/tests/perf.views.js (default
// export { query, views, enter(page, view) }); without it the scene behind the
// lobby is measured once the game is prepared. Draws, triangles and resolution
// are exact on any machine; milliseconds compare only within one run, so
// variants and sides are interleaved round by round. Results: art/perf/<time>/.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const app = path.resolve(import.meta.dirname, '..'), repo = path.resolve(app, '..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
const VALUED = ['--base', '--views', '--seconds', '--rounds', '--throttle', '--size'];
const game = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
if (!game || !fs.existsSync(path.join(app, 'games', game, 'public', 'index.html'))) {
  console.error('usage: npm run perf -- <game> [--tiers] [--base <ref>] [--views a,b] [--seconds 8] [--rounds 1] [--throttle 4] [--size 1280x800]');
  process.exit(1);
}
const SECONDS = Number(arg('seconds', 8)), ROUNDS = Number(arg('rounds', 1)), THROTTLE = Number(arg('throttle', 0));
const [WIDTH, HEIGHT] = arg('size', '1280x800').split('x').map(Number);
const BASE = arg('base', null);

// What each variant puts in the address. --tiers adds one knob at a time from Nítida.
const VARIANTS = [
  ['Nítida', 'pana-quality=alta'], ['Equilibrada', 'pana-quality=media'], ['Rápida', 'pana-quality=baja'],
  ...(flag('tiers') ? [
    ['Nítida, resolución 100 %', 'pana-quality=alta&pana-resolution=1'],
    ['Nítida, sombras medias', 'pana-quality=alta&pana-shadows=media'],
    ['Nítida, sin sombras', 'pana-quality=alta&pana-shadows=off'],
    ['Nítida, detalle bajo', 'pana-quality=alta&pana-detail=baja'],
    ['Nítida, sin suavizado', 'pana-quality=alta&pana-antialias=0'],
  ] : []),
].filter(([name]) => !BASE || name === 'Nítida' || flag('tiers'));

const hookFile = path.join(app, 'games', game, 'tests', 'perf.views.js');
const hook = fs.existsSync(hookFile) ? (await import(pathToFileURL(hookFile))).default : {};
const VIEWS = arg('views', null)?.split(',') ?? hook.views ?? ['lobby'];
const enter = hook.enter ?? (() => {});

// ---------- servers: this tree, and the base commit from a temporary worktree ----------
const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).stdout.trim();
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const healthy = async url => { try { return (await fetch(`${url}/api/health`)).ok; } catch { return false; } };
const children = [];
const killTree = child => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
};
async function serve(tree) {
  const port = await freePort(), url = `http://localhost:${port}`;
  children.push(spawn(process.execPath, ['server/src/index.js'], { cwd: path.join(tree, 'Pana'), env: { ...process.env, PANA_PORT: String(port), PANA_HOST: '127.0.0.1' }, stdio: 'ignore' }));
  for (let i = 0; i < 150 && !(await healthy(url)); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy(url))) throw new Error(`server in ${tree} did not start`);
  return url;
}
let cleanupTree = () => {};
process.on('exit', () => { children.forEach(killTree); cleanupTree(); });
process.on('SIGINT', () => process.exit(130));

const headSha = git('rev-parse', '--short', 'HEAD'), dirty = git('status', '--porcelain', '--untracked-files=no') ? '+changes' : '';
const sides = [{ key: 'head', label: `${headSha}${dirty}`, url: await serve(repo) }];
if (BASE) {
  const baseSha = git('rev-parse', '--short', BASE);
  if (!baseSha) { console.error(`--base ${BASE}: no such commit`); process.exit(1); }
  // The worktree borrows node_modules through a junction (unlinked before removal).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pana-perf-')), tree = path.join(tmp, 'tree'), modules = path.join(tree, 'node_modules');
  spawnSync('git', ['worktree', 'add', '--detach', tree, baseSha], { cwd: repo, stdio: 'ignore' });
  fs.symlinkSync(path.join(repo, 'node_modules'), modules, 'junction');
  cleanupTree = () => {
    try { fs.unlinkSync(modules); } catch { try { fs.rmdirSync(modules); } catch { /* not linked */ } }
    if (!fs.existsSync(modules)) { spawnSync('git', ['worktree', 'remove', '--force', tree], { cwd: repo, stdio: 'ignore' }); spawnSync('git', ['worktree', 'prune'], { cwd: repo, stdio: 'ignore' }); }
  };
  sides.unshift({ key: 'base', label: `${BASE} ${baseSha}`, url: await serve(tree) });
}

// Unpaced: vsync and the frame-rate limit off, so cheaper settings show as more frames.
const gpuArgs = process.platform === 'win32' ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: [...gpuArgs, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });

async function measure(side, query, view) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('pana:name', 'Perf');
    let s = 0x56a55eed; Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  });
  try {
    if (THROTTLE > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const started = Date.now();
    await page.goto(`${side.url}/g/${game}/?${[hook.query, query, 'pana-autoscale=0&pana-sound=0'].filter(Boolean).join('&')}`);
    await page.waitForFunction(() => (window.PANA_PREPARED === true && window.PANA_LOBBY_LOADING !== true) || window.garage?.car, null, { timeout: 180_000 });
    await enter(page, view);
    const loadMs = Date.now() - started;
    // Settle (shader compiles, first uploads), then measure the real loop.
    return { loadMs, errors, ...(await page.evaluate(async seconds => {
      const perf = await import('/engine/perf.js');
      const frames = n => new Promise(r => { const step = () => (--n > 0 ? requestAnimationFrame(step) : r()); requestAnimationFrame(step); });
      perf.startPerf(); await frames(90); perf.resetPerf();
      const end = performance.now() + seconds * 1000;
      while (performance.now() < end) await frames(30);
      const loop = perf.snapshot();
      return { loop, frame: await perf.measureFrame(30) };
    }, SECONDS)) };
  } finally { await page.close(); }
}

// ---------- run: interleaved rounds per view ----------
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
// fps and p95 come from the real loop; GPU, CPU, draws and triangles from
// redrawing the same frame (perf.measureFrame), which also works for scenes
// that only draw when something changes.
const runs = sides.flatMap(side => VARIANTS.map(([name, query]) => ({ side, name, query })));
const results = [];
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = path.join(repo, 'art', 'perf', `${game}-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });
const fmt = (n, d = 1) => n == null ? '–' : n.toFixed(d);
const big = n => n == null ? '–' : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n));
try {
  for (const view of VIEWS) {
    console.log(`\n${game} · ${view}  (${WIDTH}×${HEIGHT} at ×2, ${SECONDS} s × ${ROUNDS}${THROTTLE > 1 ? `, CPU ÷${THROTTLE}` : ''})`);
    const samples = new Map(runs.map(r => [r, []]));
    for (let round = 0; round < ROUNDS; round++) for (const run of round % 2 ? [...runs].reverse() : runs) {
      process.stdout.write(`  ${round + 1}/${ROUNDS} ${run.side.key} ${run.name}…\r`);
      samples.get(run).push(await measure(run.side, run.query, view));
    }
    console.log(`  ${'variant'.padEnd(BASE ? 34 : 26)} ${'fps'.padStart(6)} ${'p95 ms'.padStart(7)} ${'GPU ms'.padStart(7)} ${'CPU ms'.padStart(7)} ${'draws'.padStart(7)} ${'tris'.padStart(7)}  drawn`);
    for (const run of runs) {
      const s = samples.get(run), pick = f => median(s.map(f)), last = s.at(-1);
      const row = { view, side: run.side.key, sideLabel: run.side.label, variant: run.name, query: run.query,
        // The loop's numbers only mean something when the game kept drawing.
        fps: pick(x => x.loop.drawnFrames ? x.loop.fps : NaN), p95: pick(x => x.loop.drawnFrames ? x.loop.frameMs.p95 : NaN),
        worst: pick(x => x.loop.drawnFrames ? x.loop.frameMs.worst : NaN), freezes: pick(x => x.loop.freezes),
        gpuMs: pick(x => x.frame.gpuMs), cpuMs: pick(x => x.frame.cpuMs), draws: last.frame.draws, triangles: last.frame.triangles,
        drawn: last.loop.resolution?.drawn, ratio: last.loop.resolution?.ratio, loadMs: pick(x => x.loadMs), errors: s.flatMap(x => x.errors) };
      results.push(row);
      const label = BASE ? `${run.side.key} ${run.name}` : run.name;
      console.log(`  ${label.padEnd(BASE ? 34 : 26)} ${fmt(row.fps, 0).padStart(6)} ${fmt(row.p95).padStart(7)} ${fmt(row.gpuMs, 2).padStart(7)} ${fmt(row.cpuMs, 2).padStart(7)} ${big(row.draws).padStart(7)} ${big(row.triangles).padStart(7)}  ${row.drawn ? row.drawn.join('×') : '–'}${row.errors.length ? `  ERRORS ${row.errors.length}` : ''}`);
    }
  }
} finally { await browser.close(); }

fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ game, at: new Date().toISOString(), cpu: os.cpus()[0].model.trim(), size: [WIDTH, HEIGHT], seconds: SECONDS, rounds: ROUNDS, throttle: THROTTLE, sides: sides.map(s => s.label), results }, null, 2));
console.log(`\nSaved ${path.relative(repo, path.join(outDir, 'results.json'))}`);
