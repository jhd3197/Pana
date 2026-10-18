// Player settings shared by the hub and every game, saved as `pana:settings`.
// Games read them through the menu in /engine/ui.js; the hub edits the same
// values. Storage can be disabled, so every value has a working default.

const KEY = 'pana:settings';

export const QUALITY = {
  alta: { label: 'Nítida', ratio: 2 },
  media: { label: 'Equilibrada', ratio: 1.5 },
  baja: { label: 'Rápida', ratio: 1 },
};

export const DEFAULTS = Object.freeze({
  sound: true,     // all game sound on or off
  volume: 0.8,     // master volume, 0–1
  quality: 'alta', // render resolution, see QUALITY
  hints: true,     // on-screen keyboard reminders ([data-pana-hint])
  orientation: 'juego', // phones: 'juego' (each game's own default), 'horizontal' or 'vertical'
});
const ORIENTATION_CHOICES = ['juego', 'horizontal', 'vertical'];

function normalize(raw = {}) {
  const out = { ...DEFAULTS };
  if (typeof raw.sound === 'boolean') out.sound = raw.sound;
  if (Number.isFinite(raw.volume)) out.volume = Math.min(1, Math.max(0, raw.volume));
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

// Device pixel ratio capped by the game's own limit and the quality setting.
export function pixelRatio(max = 2) {
  return Math.min(devicePixelRatio || 1, max, QUALITY[current.quality].ratio);
}

// Keeps a renderer's pixel ratio in step with the quality setting.
// fit 'window' (full-screen games) sizes the canvas to the window, inline
// styles included; fit 'canvas' (a stage inside the page, e.g. table-world)
// keeps the canvas's own CSS box and only sets its resolution.
export function bindRenderer(renderer, max = 2, { fit = 'window' } = {}) {
  return onSettings((s, changed) => {
    if (!changed.includes('quality')) return;
    renderer.setPixelRatio(pixelRatio(max));
    const canvas = renderer.domElement;
    if (fit === 'canvas') renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
    else renderer.setSize(innerWidth, innerHeight);
  });
}

// Wires the shared fx.js sound object to the saved sound settings.
export function bindSound(sound) {
  return onSettings(s => {
    sound.muted = !s.sound;
    sound.setVolume?.(s.volume);
  });
}
