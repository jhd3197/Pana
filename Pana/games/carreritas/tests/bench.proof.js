// Carreritas benchmark: the working tree against a base commit on the same
// machine, same seed, measurements interleaved so background load hits both.
//
//   npm run bench                         # base = main, six maps (~4 min each)
//   npm run bench -- --base 1ec0a26 --maps chuao,selva --throttle 4
//
// Per map: time to the first race frame; at three fixed points of the route
// (8 racers on the grid) draw calls, triangles, GPU time (timer query) and
// CPU submit time; an autopilot drive with frame intervals, p95, the worst
// frame and freezes over 50 ms (optionally with the CPU throttled to mimic a
// phone); and a look check: scenery-only screenshots (cars and HUD hidden)
// compared pixel by pixel. Draws and triangles are exact on any machine; the
// milliseconds compare only within one run. Results land in art/bench/.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'main');
const MAPS = arg('maps', 'chuao,selva,llanos,chichi,plaza,salinas').split(',');
const VIEWS = [0, 0.33, 0.62], DRIVE_SECONDS = Number(arg('drive', 40)), THROTTLE = Number(arg('throttle', 0));
const ROUNDS = 4, FRAMES = 12, SEED = 0x56a55eed;
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = path.join(repo, 'art', 'bench', stamp);
fs.mkdirSync(outDir, { recursive: true });

const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).stdout.trim();
const baseSha = git('rev-parse', '--short', BASE), headSha = git('rev-parse', '--short', 'HEAD');
if (!baseSha) { console.error(`--base ${BASE}: no such commit`); process.exit(1); }
const dirty = git('status', '--porcelain', '--untracked-files=no') ? '+changes' : '';

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const healthy = async url => { try { return (await fetch(`${url}/api/health`)).ok; } catch { return false; } };
const children = [];
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}
async function serve(tree) {
  const port = await freePort(), url = `http://localhost:${port}`;
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd: path.join(tree, 'Pana'), env: { ...process.env, PANA_PORT: String(port), PANA_HOST: '127.0.0.1' }, stdio: 'ignore' });
  children.push(child);
  for (let i = 0; i < 100 && !(await healthy(url)); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy(url))) throw new Error(`server in ${tree} did not start`);
  return url;
}

// The base runs from a temporary detached worktree that borrows node_modules
// through a junction (never copied; unlinked before the worktree is removed).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pana-bench-')), tree = path.join(tmp, 'tree'), modules = path.join(tree, 'node_modules');
spawnSync('git', ['worktree', 'add', '--detach', tree, baseSha], { cwd: repo, stdio: 'ignore' });
function cleanup() {
  children.forEach(killTree);
  try { fs.unlinkSync(modules); } catch { try { fs.rmdirSync(modules); } catch { /* not linked */ } }
  if (!fs.existsSync(modules)) { spawnSync('git', ['worktree', 'remove', '--force', tree], { cwd: repo, stdio: 'ignore' }); spawnSync('git', ['worktree', 'prune'], { cwd: repo, stdio: 'ignore' }); }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
fs.symlinkSync(path.join(repo, 'node_modules'), modules, 'junction');

const sides = { base: { label: `${BASE} ${baseSha}`, url: await serve(tree) }, head: { label: `${headSha}${dirty}`, url: await serve(repo) } };
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const paced = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function open(b, url, query) {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  await page.addInitScript(seed => {
    localStorage.setItem('pana:settings', JSON.stringify({ quality: 'alta', sound: false, autoScale: false }));
    let s = seed; Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }, SEED);
  await page.goto(`${url}/g/carreritas/?${query}`);
  await page.waitForFunction(() => window.garage?.car, null, { timeout: 120000 });
  return page;
}

// In the page: build the map, fill the grid to eight racers, expose helpers.
const setUp = async ({ id, grid }) => {
  toGarage(); setup.mode = 'race';
  const start = performance.now(); buildTrack(id); await startRace(0);
  const loadMs = performance.now() - start;
  race.state = 'go'; race.count = 0;
  if (grid) { for (let i = race.cars.length; i < 8; i++) race.cars.push(makeRacer(i, false, `R${i}`)); race.cars.forEach((c, i) => placeRacer(c, i % 2 ? -3.5 : 3.5, Math.floor(i / 2))); }
  const gl = renderer.getContext(), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'), pixel = new Uint8Array(4);
  window.__bench = {
    async view(u) {
      const T = getActiveTrack(), p = T.pointAt(T.TOTAL * u), q = T.pointAt(T.TOTAL * u + 1), c = race.player;
      Object.assign(c, { x: p.x, z: p.y, y: T.groundAt(p.x, p.y), h: Math.atan2(q.x - p.x, q.y - p.y), vx: 0, vz: 0, vf: 0 }); race.camPos = null;
      for (let i = 0; i < 20; i++) { Object.assign(c, { x: p.x, z: p.y, vx: 0, vz: 0, vf: 0 }); updateRace(1 / 60); renderer.render(race.scene, race.camera); await new Promise(requestAnimationFrame); }
    },
    async measure(frames) {
      const cpu = [], gpu = [];
      for (let i = 0; i < frames; i++) {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        const query = timer && gl.createQuery(), t = performance.now();
        if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
        renderer.render(race.scene, race.camera);
        if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
        cpu.push(performance.now() - t);
        if (query) {
          for (let k = 0; k < 200 && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise(r => setTimeout(r, 2));
          if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(query);
        }
      }
      return { cpu, gpu, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    },
    scenery(only) {
      for (const c of race.cars) c.car.root.visible = !only;
      document.querySelectorAll('body > *:not(canvas)').forEach(e => { e.style.visibility = only ? 'hidden' : ''; });
      renderer.render(race.scene, race.camera);
    },
  };
  return { loadMs, gpuTimer: !!timer, renderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
};

// Autopilot through the real animation loop, vsync-paced like a player's.
const drive = async ({ id, seconds }) => {
  toGarage(); setup.mode = 'race'; buildTrack(id); await startRace(0);
  await new Promise(r => { const wait = () => race.state === 'go' ? r() : setTimeout(wait, 50); wait(); });
  const frames = []; let last = performance.now();
  const end = last + seconds * 1000;
  while (performance.now() < end) { const now = await new Promise(requestAnimationFrame); frames.push(now - last); last = now; }
  return frames;
};

const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))]; };
const median = a => a.length ? quantile(a, 0.5) : NaN;

// Pixel difference of two PNG screenshots, computed in a blank page.
async function difference(page, a, b, file) {
  return page.evaluate(async ([a, b, file]) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]), w = ia.width, h = ia.height;
    const ca = new OffscreenCanvas(w, h), cb = new OffscreenCanvas(w, h);
    ca.getContext('2d').drawImage(ia, 0, 0); cb.getContext('2d').drawImage(ib, 0, 0);
    const da = ca.getContext('2d').getImageData(0, 0, w, h).data, db = cb.getContext('2d').getImageData(0, 0, w, h).data;
    let sum = 0, changed = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
      sum += d; if (d > 24) changed++;
    }
    const sheet = new OffscreenCanvas(w * 2 + 8, h), ctx = sheet.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sheet.width, h); ctx.drawImage(ia, 0, 0); ctx.drawImage(ib, w + 8, 0);
    const blob = await sheet.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { mean: sum / (w * h), changed: changed / (w * h), sheet: btoa(binary), file };
  }, [a, b, file]);
}

const results = [];
const tool = await browser.newPage();
try {
  for (const id of MAPS) {
    console.log(`\n${id}`);
    const pages = {}, info = {};
    for (const side of ['base', 'head']) {
      pages[side] = await open(browser, sides[side].url, 'debug&auto&manual');
      info[side] = await pages[side].evaluate(setUp, { id, grid: true });
    }
    const map = { id, load: { base: info.base.loadMs, head: info.head.loadMs }, renderer: info.head.renderer, views: [], look: [] };
    for (const u of VIEWS) {
      const acc = { base: { cpu: [], gpu: [] }, head: { cpu: [], gpu: [] } }, last = {};
      for (const side of ['base', 'head']) await pages[side].evaluate(u => __bench.view(u), u);
      for (let round = 0; round < ROUNDS; round++) for (const side of round % 2 ? ['head', 'base'] : ['base', 'head']) {
        const m = await pages[side].evaluate(n => __bench.measure(n), FRAMES);
        acc[side].cpu.push(...m.cpu); acc[side].gpu.push(...m.gpu); last[side] = m;
      }
      const view = { u };
      for (const side of ['base', 'head']) view[side] = { cpuMs: median(acc[side].cpu), gpuMs: median(acc[side].gpu), draws: last[side].draws, triangles: last[side].triangles, geometries: last[side].geometries, textures: last[side].textures };
      map.views.push(view);
      const shots = {};
      for (const side of ['base', 'head']) {
        await pages[side].evaluate(() => __bench.scenery(true));
        shots[side] = `data:image/png;base64,${(await pages[side].screenshot()).toString('base64')}`;
        await pages[side].evaluate(() => __bench.scenery(false));
      }
      const diff = await difference(tool, shots.base, shots.head, `${id}-${u}.jpg`);
      fs.writeFileSync(path.join(outDir, diff.file), Buffer.from(diff.sheet, 'base64'));
      map.look.push({ u, meanDifference: diff.mean, changedPixels: diff.changed });
      console.log(`  u=${u}  draws ${view.base.draws} → ${view.head.draws}  triangles ${(view.base.triangles / 1e6).toFixed(2)}M → ${(view.head.triangles / 1e6).toFixed(2)}M  GPU ${view.base.gpuMs.toFixed(2)} → ${view.head.gpuMs.toFixed(2)} ms  CPU ${view.base.cpuMs.toFixed(2)} → ${view.head.cpuMs.toFixed(2)} ms  look Δ ${(diff.changed * 100).toFixed(1)}% px`);
    }
    for (const side of ['base', 'head']) { map.errors = [...(map.errors || []), ...pages[side].errors.map(e => `${side}: ${e}`)]; await pages[side].close(); }
    map.drive = {};
    for (const rate of THROTTLE > 1 ? [1, THROTTLE] : [1]) for (const side of ['base', 'head']) {
      const page = await open(paced, sides[side].url, 'debug&auto');
      if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
      const frames = await page.evaluate(drive, { id, seconds: DRIVE_SECONDS });
      (map.drive[`cpu×${rate}`] ??= {})[side] = { frames: frames.length, p50: quantile(frames, 0.5), p95: quantile(frames, 0.95), worst: Math.max(...frames), freezes: frames.filter(f => f > 50).length };
      await page.close();
    }
    for (const [rate, d] of Object.entries(map.drive))
      console.log(`  drive ${rate}: p95 ${d.base.p95.toFixed(1)} → ${d.head.p95.toFixed(1)} ms  worst ${d.base.worst.toFixed(0)} → ${d.head.worst.toFixed(0)} ms  freezes>50ms ${d.base.freezes} → ${d.head.freezes}`);
    console.log(`  load ${(map.load.base / 1000).toFixed(2)} → ${(map.load.head / 1000).toFixed(2)} s${map.errors.length ? `  ERRORS ${map.errors.length}` : ''}`);
    results.push(map);
  }
} finally {
  await browser.close(); await paced.close();
}

// Summary: geometric mean of head/base per metric across every view.
const ratios = key => results.flatMap(m => m.views.map(v => v.head[key] / v.base[key])).filter(Number.isFinite);
const geo = a => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);
const pct = r => `${r < 1 ? '−' : '+'}${Math.abs((1 - r) * 100).toFixed(0)} %`;
const summary = Object.fromEntries(['draws', 'triangles', 'gpuMs', 'cpuMs'].map(k => [k, geo(ratios(k))]));
summary.loadMs = geo(results.map(m => m.load.head / m.load.base));
const freezes = side => results.reduce((s, m) => s + Object.values(m.drive).reduce((t, d) => t + d[side].freezes, 0), 0);
console.log(`\n${sides.base.label} → ${sides.head.label}, ${results.length} maps, ${results[0]?.renderer}, ${os.cpus()[0].model.trim()}`);
for (const [k, r] of Object.entries(summary)) console.log(`  ${k.padEnd(10)} ${pct(r)}`);
console.log(`  freezes   ${freezes('base')} → ${freezes('head')} (over 50 ms while driving)`);
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ base: sides.base.label, head: sides.head.label, at: new Date().toISOString(), cpu: os.cpus()[0].model, maps: results, summary }, null, 2));
console.log(`\nSaved ${path.relative(repo, outDir)} (results.json, side-by-side look sheets).`);
