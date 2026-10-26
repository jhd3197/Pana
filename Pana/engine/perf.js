// What a frame costs, for every renderer bound in settings.js: frame times,
// draw calls, triangles, CPU submit time, GPU time (when the browser has a
// timer query) and the resolution actually drawn. The overlay (Ajustes >
// Imagen > Mostrar rendimiento, or ?pana-stats) and benchmarks read the same
// numbers; benchmarks through window.PANA_PERF. Nothing is measured until
// someone starts it, so loading it costs nothing.
import { watchRenderers, boundRenderers, drawNow, getSettings, onSettings, renderStep, renderScaleNow } from './settings.js';
import { loc } from './i18n.js';
const KEEP = 600;           // frames kept, ~10 s at 60 Hz
const FREEZE_MS = 50;
const frames = [];          // { at, dt, drawn, draws, triangles, cpu }
const gpu = [];             // GPU ms of drawn frames, when the timer query exists
let running = false, last = 0, now = { drawn: false, draws: 0, triangles: 0, cpu: 0 };

const timers = new WeakMap();   // renderer → { gl, ext, pending: [query] }
function instrument(renderer) {
  if (timers.has(renderer)) return;
  const gl = renderer.getContext?.(), ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  const timer = { gl, ext, pending: [], open: false };
  timers.set(renderer, timer);
  const render = renderer.render;
  renderer.render = function (scene, camera) {
    if (renderer.getRenderTarget() === null) timer.last = [scene, camera];
    if (!running || renderer.getRenderTarget() !== null) return render.call(this, scene, camera);
    const info = renderer.info.render, before = info.frame, t = performance.now();
    const query = ext && !timer.open && timer.pending.length < 4 ? gl.createQuery() : null;
    if (query) { gl.beginQuery(ext.TIME_ELAPSED_EXT, query); timer.open = true; }
    try { render.call(this, scene, camera); } finally {
      if (query) { gl.endQuery(ext.TIME_ELAPSED_EXT); timer.open = false; timer.pending.push(query); }
    }
    if (info.frame === before) return;      // skipped by the FPS cap
    now.drawn = true; now.cpu += performance.now() - t;
    now.draws += info.calls; now.triangles += info.triangles;
  };
}
watchRenderers(instrument);

// The cost of one frame, whether or not the game is drawing: redraws each
// renderer's last screen frame `count` times, waiting for the GPU each time,
// and sums the renderers. For scenes that only draw when something changes
// (a table between turns) this is the only number there is.
export async function measureFrame(count = 30) {
  const totals = { cpu: [], gpu: [], draws: 0, triangles: 0, renderers: 0 };
  for (const renderer of boundRenderers()) {
    const timer = timers.get(renderer);
    if (!timer?.last) continue;
    const [scene, camera] = timer.last, { gl, ext } = timer, pixel = new Uint8Array(4);
    totals.renderers++;
    for (let i = 0; i < count; i++) {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);   // waits for earlier work
      const query = ext && !timer.open ? gl.createQuery() : null, t = performance.now();
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      drawNow(renderer, scene, camera);
      if (query) gl.endQuery(ext.TIME_ELAPSED_EXT);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      (totals.cpu[i] ??= 0); totals.cpu[i] += performance.now() - t;
      if (query) {
        for (let k = 0; k < 200 && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise(r => setTimeout(r, 2));
        if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) { (totals.gpu[i] ??= 0); totals.gpu[i] += gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6; }
        gl.deleteQuery(query);
      }
    }
    totals.draws += renderer.info.render.calls; totals.triangles += renderer.info.render.triangles;
  }
  return { renderers: totals.renderers, cpuMs: quantile(totals.cpu, 0.5), gpuMs: quantile(totals.gpu.filter(Number.isFinite), 0.5), draws: totals.draws, triangles: totals.triangles };
}

function collectGpu() {
  for (const renderer of boundRenderers()) {
    const timer = timers.get(renderer);
    if (!timer?.ext) continue;
    const { gl, ext } = timer, disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (timer.pending.length && gl.getQueryParameter(timer.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = timer.pending.shift();
      if (!disjoint) gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query);
    }
  }
  if (gpu.length > KEEP) gpu.splice(0, gpu.length - KEEP);
}

function tick(at) {
  if (!running) return;
  requestAnimationFrame(tick);
  if (last) frames.push({ at, dt: at - last, ...now });
  if (frames.length > KEEP) frames.splice(0, frames.length - KEEP);
  last = at; now = { drawn: false, draws: 0, triangles: 0, cpu: 0 };
  collectGpu();
}

export function startPerf() {
  if (running || typeof requestAnimationFrame !== 'function') return;
  running = true; last = 0; requestAnimationFrame(tick);
}
export function stopPerf() { running = false; }
export function resetPerf() { frames.length = 0; gpu.length = 0; last = 0; }

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
};

// The biggest bound canvas: its CSS size, pixel ratio and drawn pixels.
function resolution() {
  let best = null;
  for (const renderer of boundRenderers()) {
    const canvas = renderer.domElement, pixels = canvas.width * canvas.height;
    if (!best || pixels > best.pixels) best = { pixels, css: [canvas.clientWidth, canvas.clientHeight], drawn: [canvas.width, canvas.height], ratio: renderer.getPixelRatio() };
  }
  return best && { css: best.css, drawn: best.drawn, ratio: best.ratio };
}

// Everything measured since the last reset (or the last `seconds`).
export function snapshot({ seconds } = {}) {
  startPerf();
  const from = seconds ? performance.now() - seconds * 1000 : -Infinity;
  const seen = frames.filter(f => f.at >= from), drawn = seen.filter(f => f.drawn);
  const span = seen.reduce((sum, f) => sum + f.dt, 0);
  const memory = boundRenderers()[0]?.info.memory, programs = boundRenderers()[0]?.info.programs?.length;
  const s = getSettings();
  return {
    frames: seen.length, drawnFrames: drawn.length,
    fps: span ? (boundRenderers().length ? drawn.length : seen.length) / (span / 1000) : null,
    frameMs: { p50: quantile(seen.map(f => f.dt), 0.5), p95: quantile(seen.map(f => f.dt), 0.95), worst: seen.length ? Math.max(...seen.map(f => f.dt)) : null },
    freezes: seen.filter(f => f.dt > FREEZE_MS).length,
    draws: quantile(drawn.map(f => f.draws), 0.5), triangles: quantile(drawn.map(f => f.triangles), 0.5),
    cpuMs: quantile(drawn.map(f => f.cpu), 0.5), gpuMs: quantile(gpu, 0.5),
    geometries: memory?.geometries ?? null, textures: memory?.textures ?? null, programs: programs ?? null,
    resolution: resolution(), autoStep: renderStep(), autoScale: renderScaleNow(),
    settings: { quality: s.quality, resolution: s.resolution, shadows: s.shadows, detail: s.detail, fpsCap: s.fpsCap, autoScale: s.autoScale, antialias: s.antialias },
  };
}

// ---------- overlay ----------
let overlay = null, timer = 0;
const fmt = (n, digits = 1) => n == null ? '–' : n.toFixed(digits);
const thousands = n => n == null ? '–' : n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(Math.round(n));
function paint() {
  const p = snapshot({ seconds: 2 }), r = p.resolution;
  overlay.textContent = [
    loc('{fps} fps · {p50} ms (p95 {p95} · peor {worst})', { fps: fmt(p.fps, 0), p50: fmt(p.frameMs.p50), p95: fmt(p.frameMs.p95), worst: fmt(p.frameMs.worst, 0) }),
    `CPU ${fmt(p.cpuMs)} ms${p.gpuMs != null ? ` · GPU ${fmt(p.gpuMs)} ms` : ''}`,
    loc('{draws} llamadas · {triangles} triángulos', { draws: thousands(p.draws), triangles: thousands(p.triangles) }),
    r ? `${r.drawn[0]}×${r.drawn[1]} (×${fmt(r.ratio, 2)})${p.autoStep ? ` · auto ${Math.round(p.autoScale * 100)} %` : ''}` : loc('Sin escena 3D'),
  ].join('\n');
}
export function showPerf() {
  if (overlay || typeof document === 'undefined') return;
  overlay = document.createElement('pre');
  overlay.className = 'pana-perf'; overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;margin:0;padding:6px 8px;pointer-events:none;'
    + 'font:12px/1.35 ui-monospace,Consolas,monospace;color:var(--pk-ink,#fff);background:rgba(13,11,33,.78);border-radius:4px;white-space:pre';
  document.body.append(overlay);
  resetPerf(); startPerf(); paint(); timer = setInterval(paint, 500);
  const stop = onSettings(s => {
    if (s.perfOverlay) return;
    clearInterval(timer); overlay.remove(); overlay = null; stopPerf(); queueMicrotask(stop);
  });
}

globalThis.PANA_PERF = { snapshot, measureFrame, reset: resetPerf, start: startPerf, stop: stopPerf };
