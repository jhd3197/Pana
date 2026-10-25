// Player settings shared by the hub and every game, saved as `pana:settings`.
// Games read them through the menu in /engine/ui.js; the hub edits the same
// values. Storage can be disabled, so every value has a working default.

const KEY = 'pana:settings';

// A quality is a preset: it sets the three picture knobs below. Changing one
// knob by hand turns the preset into 'custom' (Personalizada).
export const QUALITY = {
  alta: { label: 'Nítida', resolution: 2, shadows: 'alta', detail: 'alta' },
  media: { label: 'Equilibrada', resolution: 1.5, shadows: 'media', detail: 'media' },
  baja: { label: 'Rápida', resolution: 1, shadows: 'baja', detail: 'baja' },
};
const PRESET_KEYS = ['resolution', 'shadows', 'detail'];
// Pixel-ratio cap: rendered pixels per CSS pixel, never above the screen's own.
export const RESOLUTIONS = [[0.75, '75 %'], [1, '100 %'], [1.5, '150 %'], [2, '200 %']];
// Shadow-map edge relative to what a scene was designed with. 'off' disables
// shadows on every bound renderer at once.
export const SHADOWS = { alta: { label: 'Altas', scale: 1 }, media: { label: 'Medias', scale: 0.5 }, baja: { label: 'Bajas', scale: 0.25 }, off: { label: 'Sin sombras', scale: 0.25 } };
// World density in games that have optional detail (grass, far trees, rain).
export const DETAIL = { alta: 'Alto', media: 'Medio', baja: 'Bajo' };
// Frames drawn per second; 0 draws every frame the screen shows.
export const FPS_CAPS = [[0, 'Sin límite'], [60, '60'], [30, '30']];

// A phone (touch only) starts on Equilibrada: at Nítida it draws four pixels
// per CSS pixel. Desktops start sharp. A saved choice always wins.
const TOUCH_ONLY = typeof matchMedia === 'function'
  && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const START = TOUCH_ONLY ? 'media' : 'alta';

export const DEFAULTS = Object.freeze({
  sound: true,     // all game sound on or off
  volume: 0.8,     // master volume, 0–1
  music: 0.5,      // music level under the master volume, 0–1
  quality: START,  // preset, or 'custom' when the knobs below differ from every preset
  resolution: QUALITY[START].resolution, shadows: QUALITY[START].shadows, detail: QUALITY[START].detail,
  antialias: true, // smooth edges; renderers read it when they are created
  autoScale: true, // frame-rate guard lowers resolution when frames run slow
  fpsCap: 0,       // see FPS_CAPS
  perfOverlay: false, // frame and draw stats in a corner (engine/perf.js)
  hints: true,     // on-screen keyboard reminders ([data-pana-hint])
  orientation: 'juego', // phones: 'juego' (each game's own default), 'horizontal' or 'vertical'
  inputHints: 'auto', padFamily: 'auto',
  mouseSensitivity: 1, mouseVertical: 1, mouseInvertY: false,
  touchSensitivity: 1, touchInvertY: false,
  padDeadzone: .18, padMoveSensitivity: 1, padLookSensitivity: 1,
  padVertical: 1, padInvertY: false, padCurve: 'lineal',
  padCursorSpeed: 1, padVibration: true,
});
const ORIENTATION_CHOICES = ['juego', 'horizontal', 'vertical'];
export const INPUT_RANGES = Object.freeze({mouseSensitivity:[.25,3],mouseVertical:[.25,2],touchSensitivity:[.25,3],padDeadzone:[0,.4],padMoveSensitivity:[.5,2],padLookSensitivity:[.25,3],padVertical:[.25,2],padCursorSpeed:[.25,3]});
const INPUT_CHOICES={inputHints:['auto','keyboard','gamepad','touch'],padFamily:['auto','xbox','playstation','nintendo','generic'],padCurve:['lineal','suave','rapida']};
export const INPUT_KEYS = [...Object.keys(INPUT_RANGES),...Object.keys(INPUT_CHOICES),'mouseInvertY','touchInvertY','padInvertY','padVibration'];
const PICTURE_CHOICES = { resolution: RESOLUTIONS.map(([v]) => v), shadows: Object.keys(SHADOWS), detail: Object.keys(DETAIL), fpsCap: FPS_CAPS.map(([v]) => v) };
const SWITCHES = ['sound', 'hints', 'antialias', 'autoScale', 'perfOverlay', 'mouseInvertY', 'touchInvertY', 'padInvertY', 'padVibration'];

const presetOf = s => Object.keys(QUALITY).find(q => PRESET_KEYS.every(k => QUALITY[q][k] === s[k])) ?? 'custom';
// A preset in a patch stands for its three knobs; knobs named alongside it win.
const expand = patch => Object.hasOwn(QUALITY, patch.quality)
  ? { ...Object.fromEntries(PRESET_KEYS.map(k => [k, QUALITY[patch.quality][k]])), ...patch }
  : patch;

export function normalizeSettings(raw = {}) {
  if(!raw || typeof raw!=='object')raw={};
  const out = { ...DEFAULTS };
  if (Number.isFinite(raw.volume)) out.volume = Math.min(1, Math.max(0, raw.volume));
  if (Number.isFinite(raw.music)) out.music = Math.min(1, Math.max(0, raw.music));
  // Saved before the knobs existed: the preset alone says what they were.
  if (Object.hasOwn(QUALITY, raw.quality)) for (const k of PRESET_KEYS) out[k] = QUALITY[raw.quality][k];
  for (const [key, choices] of Object.entries(PICTURE_CHOICES)) if (choices.includes(raw[key])) out[key] = raw[key];
  out.quality = presetOf(out);
  for (const key of SWITCHES) if (typeof raw[key] === 'boolean') out[key] = raw[key];
  if (ORIENTATION_CHOICES.includes(raw.orientation)) out.orientation = raw.orientation;
  for(const [key,[min,max]] of Object.entries(INPUT_RANGES))if(Number.isFinite(raw[key]))out[key]=Math.max(min,Math.min(max,raw[key]));
  for(const [key,choices] of Object.entries(INPUT_CHOICES))if(choices.includes(raw[key]))out[key]=raw[key];
  return out;
}

// Settings named in the page's address (?pana-quality=baja&pana-stats) apply
// to this page only and are never saved, so a benchmark, a suite or a friend
// with a link sees exactly those settings without touching anyone's choices.
const URL_KEYS = { quality: String, resolution: Number, shadows: String, detail: String, fps: ['fpsCap', Number],
  autoscale: ['autoScale', Boolean], antialias: Boolean, stats: ['perfOverlay', Boolean], sound: Boolean };
export function parseUrlSettings(search = '') {
  const out = {}, params = new URLSearchParams(search);
  for (const [name, spec] of Object.entries(URL_KEYS)) {
    if (!params.has(`pana-${name}`)) continue;
    const [key, type] = Array.isArray(spec) ? spec : [name, spec], raw = params.get(`pana-${name}`);
    out[key] = type === Boolean ? !['0', 'false', 'no', 'off'].includes(raw.toLowerCase()) : type(raw);
  }
  const wanted = expand(out), valid = normalizeSettings({ ...DEFAULTS, ...wanted });
  // A preset arrives as its knobs; the preset's name is derived from them.
  return Object.fromEntries(Object.keys(wanted).filter(k => k !== 'quality' && valid[k] === wanted[k]).map(k => [k, valid[k]]));
}
const overrides = (() => { try { return parseUrlSettings(location.search); } catch { return {}; } })();

const URL_NAMES = Object.fromEntries(Object.entries(URL_KEYS).map(([name, spec]) => [Array.isArray(spec) ? spec[0] : name, name]));
function forgetUrlSettings(keys) {
  try {
    const url = new URL(location.href);
    for (const key of keys) url.searchParams.delete(`pana-${URL_NAMES[key]}`);
    // The preset expanded into these knobs; once one is chosen by hand it no longer applies.
    if (keys.some(k => PRESET_KEYS.includes(k))) url.searchParams.delete('pana-quality');
    history.replaceState(history.state, '', url);
  } catch { /* No address to tidy (tests, workers). */ }
}

// What the page address sets right now (keys the player has not changed since).
export const urlSettings = () => ({ ...overrides });

let saved = (() => {
  try {
    const raw=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
    if(raw.mouseSensitivity==null){const legacy=localStorage.getItem('pana:look-sensitivity')??localStorage.getItem('pana:pepazo-mouse');raw.mouseSensitivity={baja:.0014/.0024,media:1,alta:.0038/.0024}[legacy]??1;}
    return normalizeSettings(raw);
  } catch { return normalizeSettings(); }
})();
// The page's settings: the saved ones with the address's on top.
const compose = () => normalizeSettings({ ...saved, ...overrides });
let current = compose();
const listeners = new Set();

export function getSettings() { return { ...current }; }

export function setSettings(patch) {
  patch = expand(patch);
  // A choice made on the page replaces what the address set, and is saved;
  // the address drops it too, so a reload keeps the choice.
  const dropped = Object.keys(patch).filter(key => key in overrides);
  for (const key of dropped) delete overrides[key];
  if (dropped.length) forgetUrlSettings(dropped);
  saved = normalizeSettings({ ...saved, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Keep it for this page. */ }
  return publish();
}
function publish() {
  const next = compose();
  const changed = Object.keys(next).filter(k => next[k] !== current[k]);
  if (!changed.length) return current;
  current = next;
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
globalThis.addEventListener?.('storage', event => {
  if (event.key !== KEY) return;
  // The address's settings still win on this page.
  try { saved = normalizeSettings(JSON.parse(event.newValue || '{}')); publish(); } catch { /* Ignore malformed values. */ }
});

// Pure shaping shared by translated and native controller input. Movement is
// bounded to one; look sensitivity also scales the full-travel camera speed.
export function inputAxis(value, settings = DEFAULTS, kind = 'move') {
  const v=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0)),dead=settings.padDeadzone??DEFAULTS.padDeadzone;
  if(Math.abs(v)<=dead)return 0;
  const exponent={lineal:1,suave:1.7,rapida:.65}[settings.padCurve]??1;
  const sensitivity=kind==='look'?(settings.padLookSensitivity??1):(settings.padMoveSensitivity??1);
  const magnitude=Math.pow((Math.abs(v)-dead)/(1-dead),exponent)*sensitivity;
  return Math.sign(v)*(kind==='look'?magnitude:Math.min(1,magnitude));
}
export function resetInputSettings(){return setSettings(Object.fromEntries(INPUT_KEYS.map(k=>[k,DEFAULTS[k]])));}

// Device pixel ratio capped by the game's own limit and the resolution setting,
// lowered by the frame-rate guard below (never under 1 CSS pixel per pixel).
export function pixelRatio(max = 2) {
  const ratio = Math.min(globalThis.devicePixelRatio || 1, max, current.resolution);
  return Math.max(Math.min(1, ratio), ratio * renderScale);
}

// Shadow map edge for a light designed at `size` (Altas), smaller at lower
// settings. Scenes read it when they are built; a new size applies to the next one.
export function shadowSize(size = 2048) {
  return Math.max(256, Math.round(size * SHADOWS[current.shadows].scale));
}

// Frame-rate guard. When the median frame stays slower than ~45 fps, every
// bound renderer draws 15% fewer pixels per side, down to RENDER_SCALES' last
// step. It only goes down: at 60 Hz a frame arrives every 16.7 ms however much
// headroom is left, so there is no signal for going back up. Picking a
// resolution in the menu starts again at full scale; autoScale off stops it.
const RENDER_SCALES = [1, 0.85, 0.7, 0.55], SLOW_MS = 1000 / 45, WINDOW = 90;
let renderScale = 1, scaleStep = 0;
const refits = new Set();
const frames = [];
let lastFrame = 0, settleUntil = 0, watching = false;
function watchFrames(now) {
  requestAnimationFrame(watchFrames);
  const dt = now - lastFrame; lastFrame = now;
  // Hidden tabs, loading hitches and the first frames after a resize say nothing about the steady rate.
  if (!current.autoScale || document.hidden || dt > 250 || now < settleUntil || !refits.size) { frames.length = 0; return; }
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
// The guard's current step (0 = full resolution) and its scale; suites and the menu read them.
export const renderStep = () => scaleStep;
export const renderScaleNow = () => renderScale;

// Every renderer bound below, for engine/perf.js. fn runs for each one now and later.
const bound = new Set(), boundWatchers = new Set(), wrapped = new WeakSet();
export function watchRenderers(fn) {
  boundWatchers.add(fn); for (const r of bound) fn(r);
  return () => boundWatchers.delete(fn);
}
export const boundRenderers = () => [...bound];

// Shadows off: the renderer reports shadows disabled whatever the game set, and
// the game's own value comes back when they are turned on again.
function followShadows(renderer) {
  const map = renderer.shadowMap;
  let wanted = map.enabled;
  Object.defineProperty(map, 'enabled', { configurable: true, enumerable: true,
    get: () => wanted && current.shadows !== 'off', set: value => { wanted = !!value; } });
}

// Wraps render() for drawing to the screen: three.js compiles shadows into
// each material, so a shadow switch marks the scene's materials for update;
// with an FPS cap, frames between draws are skipped. A game that stops
// rendering still gets its last frame drawn once the interval has passed.
const painters = new WeakMap();   // renderer → draw now, past the FPS cap
export const drawNow = (renderer, scene, camera) => (painters.get(renderer) ?? renderer.render.bind(renderer))(scene, camera);
function gateRender(renderer) {
  const draw = renderer.render.bind(renderer);
  const shadowsOf = new WeakMap();   // scene → the shadow state its materials were compiled with
  let frame = -1, drawing = true, last = -Infinity, pending = null, called = 0, timer = 0;
  const refresh = o => { for (const m of [].concat(o.material || [])) m.needsUpdate = true; };
  const paint = (scene, camera) => {
    const shadows = renderer.shadowMap.enabled, was = shadowsOf.get(scene);
    if (was !== shadows) { if (was !== undefined) scene.traverse?.(refresh); shadowsOf.set(scene, shadows); }
    draw(scene, camera);
  };
  painters.set(renderer, paint);
  renderer.render = (scene, camera) => {
    if (renderer.getRenderTarget() === null) {
      const cap = current.fpsCap;
      if (cap) {
        const interval = 1000 / cap, now = document.timeline?.currentTime ?? performance.now();
        called = performance.now();
        if (now !== frame) {
          frame = now; drawing = now - last >= interval - 1;
          if (drawing) last = now - last > interval * 2 ? now : last + interval;
        }
        if (!drawing) {
          pending = [scene, camera];
          timer ||= setTimeout(function flush() {
            timer = 0;
            if (!pending) return;
            if (performance.now() - called < interval) { timer = setTimeout(flush, interval); return; }
            const [s, c] = pending; pending = null; paint(s, c);
          }, interval);
          return;
        }
        pending = null;
      }
      paint(scene, camera); return;
    }
    draw(scene, camera);
  };
}

// Options for a game's main WebGLRenderer: smoothing (antialias) follows the
// player's setting, which WebGL fixes when the context is created.
//   new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }))
export function rendererOptions(params = {}) {
  return { ...params, antialias: params.antialias !== false && current.antialias };
}

// Keeps a renderer's pixel ratio in step with the resolution setting and the
// frame-rate guard, its shadows with the shadow setting and its drawing with
// the FPS cap. fit 'window' (full-screen games) sizes the canvas to the
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
  if (!wrapped.has(renderer)) { wrapped.add(renderer); followShadows(renderer); gateRender(renderer); }
  bound.add(renderer); for (const fn of boundWatchers) fn(renderer);
  if (!watching && typeof requestAnimationFrame === 'function') { watching = true; requestAnimationFrame(watchFrames); }
  const unbind = onSettings((s, changed) => {
    const restart = changed.includes('resolution') || (changed.includes('autoScale') && !s.autoScale);
    if (!restart) return;
    if (scaleStep) { setRenderScale(0); return; }   // refits every renderer, this one included
    refit();
  });
  return () => { unbind(); refits.delete(refit); bound.delete(renderer); };
}

// The stats overlay loads only when someone asks for it.
onSettings(s => { if (s.perfOverlay && typeof document !== 'undefined') import('./perf.js').then(m => m.showPerf()).catch(() => {}); });

// Wires the shared fx.js sound object to the saved sound settings.
export function bindSound(sound) {
  return onSettings(s => {
    sound.muted = !s.sound;
    sound.setVolume?.(s.volume);
    sound.setMusicVolume?.(s.music);
  });
}
