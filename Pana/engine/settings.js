// Player settings shared by the hub and every game, saved as `pana:settings`.
// Games read them through the menu in /engine/ui.js; the hub edits the same
// values. Storage can be disabled, so every value has a working default.

const KEY = 'pana:settings';

export const QUALITY = {
  alta: { label: 'Nítida', ratio: 2, shadow: 1 },
  media: { label: 'Equilibrada', ratio: 1.5, shadow: 0.5 },
  baja: { label: 'Rápida', ratio: 1, shadow: 0.25 },
};

// A phone (touch only) starts on Equilibrada: at Nítida it draws four pixels
// per CSS pixel. Desktops start sharp. A saved choice always wins.
const TOUCH_ONLY = typeof matchMedia === 'function'
  && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

export const DEFAULTS = Object.freeze({
  sound: true,     // all game sound on or off
  volume: 0.8,     // master volume, 0–1
  music: 0.5,      // music level under the master volume, 0–1
  quality: TOUCH_ONLY ? 'media' : 'alta', // render resolution, see QUALITY
  hints: true,     // on-screen keyboard reminders ([data-pana-hint])
  orientation: 'juego', // phones: 'juego' (each game's own default), 'horizontal' or 'vertical'
});
const ORIENTATION_CHOICES = ['juego', 'horizontal', 'vertical'];

function normalize(raw = {}) {
  const out = { ...DEFAULTS };
  if (typeof raw.sound === 'boolean') out.sound = raw.sound;
  if (Number.isFinite(raw.volume)) out.volume = Math.min(1, Math.max(0, raw.volume));
  if (Number.isFinite(raw.music)) out.music = Math.min(1, Math.max(0, raw.music));
  if (raw.quality in QUALITY) out.quality = raw.quality;
  if (typeof raw.hints === 'boolean') out.hints = raw.hints;
  if (ORIENTATION_CHOICES.includes(raw.orientation)) out.orientation = raw.orientation;
  return out;
}

let current = (() => {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return normalize(); }
})();
const listeners = new Set();

export function getSettings() { return { ...current }; }

export function setSettings(patch) {
  const next = normalize({ ...current, ...patch });
  const changed = Object.keys(next).filter(k => next[k] !== current[k]);
  if (!changed.length) return current;
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* Keep it for this page. */ }
  for (const fn of listeners) fn(getSettings(), changed);
  return current;
}

// Calls fn now and after every change. Returns an unsubscribe function.
export function onSettings(fn) {
  listeners.add(fn);
  fn(getSettings(), Object.keys(current));
  return () => listeners.delete(fn);
}

// Another tab changed the settings: follow it.
addEventListener('storage', event => {
  if (event.key !== KEY) return;
  try { setSettings(JSON.parse(event.newValue || '{}')); } catch { /* Ignore malformed values. */ }
});

// Device pixel ratio capped by the game's own limit and the quality setting,
// lowered by the frame-rate guard below (never under 1 CSS pixel per pixel).
export function pixelRatio(max = 2) {
  const ratio = Math.min(devicePixelRatio || 1, max, QUALITY[current.quality].ratio);
  return Math.max(Math.min(1, ratio), ratio * renderScale);
}

// Shadow map edge for a light designed at `size` (Nítida), smaller at lower
// quality. Scenes read it when they are built; a new quality applies to the next one.
export function shadowSize(size = 2048) {
  return Math.max(256, Math.round(size * QUALITY[current.quality].shadow));
}

// Frame-rate guard. When the median frame stays slower than ~45 fps, every
// bound renderer draws 15% fewer pixels per side, down to RENDER_SCALES' last
// step. It only goes down: at 60 Hz a frame arrives every 16.7 ms however much
// headroom is left, so there is no signal for going back up. Picking a quality
// in the menu starts again at full scale.
const RENDER_SCALES = [1, 0.85, 0.7, 0.55], SLOW_MS = 1000 / 45, WINDOW = 90;
let renderScale = 1, scaleStep = 0;
const refits = new Set();
const frames = [];
let lastFrame = 0, settleUntil = 0, watching = false;
function watchFrames(now) {
  requestAnimationFrame(watchFrames);
  const dt = now - lastFrame; lastFrame = now;
  // Hidden tabs, loading hitches and the first frames after a resize say nothing about the steady rate.
  if (document.hidden || dt > 250 || now < settleUntil || !refits.size) { frames.length = 0; return; }
  frames.push(dt);
  if (frames.length < WINDOW) return;
  const median = [...frames].sort((a, b) => a - b)[WINDOW >> 1];
  frames.length = 0;
  if (median > SLOW_MS && scaleStep < RENDER_SCALES.length - 1) setRenderScale(scaleStep + 1);
}
function setRenderScale(step) {
  if (step === scaleStep) return;
  scaleStep = step; renderScale = RENDER_SCALES[step];
  settleUntil = performance.now() + 2000;
  for (const refit of refits) refit();
}
// The guard's current step (0 = full resolution); suites read it.
export const renderStep = () => scaleStep;

// Keeps a renderer's pixel ratio in step with the quality setting and the
// frame-rate guard. fit 'window' (full-screen games) sizes the canvas to the
// window, inline styles included; fit 'canvas' (a stage inside the page, e.g.
// table-world) keeps the canvas's own CSS box and only sets its resolution.
export function bindRenderer(renderer, max = 2, { fit = 'window' } = {}) {
  const refit = () => {
    renderer.setPixelRatio(pixelRatio(max));
    const canvas = renderer.domElement;
    if (fit === 'canvas') renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
    else renderer.setSize(innerWidth, innerHeight);
  };
  refits.add(refit);
  if (!watching && typeof requestAnimationFrame === 'function') { watching = true; requestAnimationFrame(watchFrames); }
  const unbind = onSettings((s, changed) => {
    if (!changed.includes('quality')) return;
    if (scaleStep) { setRenderScale(0); return; }   // refits every renderer, this one included
    refit();
  });
  return () => { unbind(); refits.delete(refit); };
}

// Wires the shared fx.js sound object to the saved sound settings.
export function bindSound(sound) {
  return onSettings(s => {
    sound.muted = !s.sound;
    sound.setVolume?.(s.volume);
    sound.setMusicVolume?.(s.music);
  });
}
