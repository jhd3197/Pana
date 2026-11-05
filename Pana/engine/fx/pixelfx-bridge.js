// Plays vendored pixelfx effects in a game: as camera-facing sprites in a Three.js
// scene, or as canvases on the HUD layer. Nothing loads until asked, so a game's
// first load doesn't grow; a play() before the code has arrived just returns false.
//
//   preloadFx('hit-spark');
//   const world = createWorldFx(THREE, scene);        // world.tick(dt) every frame
//   world.play('hit-spark', position, { pixel: .018, flip: true });
//   const hud = createScreenFx();                     // hud.tick(dt) every frame
//   hud.play('crit-number', x, y, { scale: 2, text: '24!' });  // screen pixels
import { calm, fxLayer } from './feel.js';

// Effects are named here and vendored one by one: see vendor/pixelfx/README.md.
export const EFFECTS = {
  'hit-spark': 'impacts/hit-spark',
  'crit-hit': 'impacts/crit-hit',
  'crit-number': 'ui/crit-number',
  'level-up': 'ui/level-up',
  confetti: 'ui/confetti',
};
const MAX_STEP = .1;
const vendor = (path) => new URL(`../vendor/pixelfx/${path}`, import.meta.url).href;

let core = null, corePending = null;
const modules = new Map(), pending = new Map();

export function loadFx(name) {
  if (!EFFECTS[name]) return Promise.reject(new Error(`pixelfx effect not vendored: ${name}`));
  if (!pending.has(name)) {
    corePending ??= import(vendor('core/index.js')).then((m) => { core = m; });
    pending.set(name, Promise.all([corePending, import(vendor(`fx/${EFFECTS[name]}.js`))]).then(([, mod]) => {
      modules.set(name, mod);
      return mod;
    }));
  }
  return pending.get(name);
}
export const preloadFx = (...names) => Promise.all(names.map(loadFx));

let seed = 1;
// One run of an effect into an RGBA buffer, stepped at the effect's own frame rate.
export function createRun(name, options = {}, api = core, mod = modules.get(name)) {
  const { size: [w, h], origin: [ox, oy], fps = 30 } = mod.meta;
  const frame = api.createFrame(w, h), pixels = new Uint8ClampedArray(w * h * 4);
  // `actorless`: an effect staged round a pixel hero plays without him; Pana has its own panas.
  const { actorless, ...rest } = options;
  const source = actorless ? { ...mod, meta: { ...mod.meta, actor: undefined } } : mod;
  const fx = api.createFx(source, { seed: seed++, ...rest, x: ox, y: oy });
  const period = 1 / fps;
  let owed = period;
  return {
    w, h, ox, oy, pixels,
    get done() { return fx.done(); },
    // True when the buffer changed and needs drawing.
    step(dt) {
      owed += dt;
      if (owed < period) return false;
      fx.update(Math.min(owed, MAX_STEP)); owed = 0;
      api.clearFrame(frame); fx.draw(frame);
      api.composite(frame, pixels, null);
      return true;
    },
  };
}

function ready(name) {
  if (calm()) return false;
  if (modules.has(name) && core) return true;
  loadFx(name).catch(console.warn);
  return false;
}

// A canvas sized to a run, reused while the next run has the same size.
function fit(slot, run) {
  if (slot.image?.width === run.w && slot.image?.height === run.h) return false;
  slot.canvas ??= document.createElement('canvas');
  slot.canvas.width = run.w; slot.canvas.height = run.h;
  slot.ctx = slot.canvas.getContext('2d');
  slot.image = new ImageData(run.w, run.h);
  return true;
}
const paint = (slot, run) => { slot.image.data.set(run.pixels); slot.ctx.putImageData(slot.image, 0, 0); };
// A free slot, preferring one already this size. Null at the cap: the effect skips.
const pickSlot = (slots, w, h, make, max) => {
  const free = slots.filter((s) => !s.run);
  const same = free.find((s) => s.image?.width === w && s.image?.height === h);
  if (same || free[0]) return same || free[0];
  return slots.length < max ? (slots.push(make()), slots.at(-1)) : null;
};

export function createScreenFx({ max = 4 } = {}) {
  const slots = [];
  const make = () => {
    const slot = { canvas: document.createElement('canvas'), run: null };
    slot.canvas.className = 'pk-pfx';
    return slot;
  };
  return {
    // False when the effect can't show yet (still loading, the cap, reduced motion).
    play(name, x, y, { scale = 2, ...options } = {}) {
      if (!ready(name)) return false;
      const { size: [w, h] } = modules.get(name).meta, slot = pickSlot(slots, w, h, make, max);
      if (!slot) return false;
      slot.run = createRun(name, options);
      fit(slot, slot.run);
      const { canvas } = slot, { ox, oy } = slot.run;
      canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
      canvas.style.transform = `translate(${x - ox * scale}px, ${y - oy * scale}px)`;
      slot.ctx.clearRect(0, 0, w, h);
      if (!canvas.isConnected) fxLayer().append(canvas);
      return true;
    },
    tick(dt) {
      for (const slot of slots) {
        if (!slot.run) continue;
        if (slot.run.step(dt)) paint(slot, slot.run);
        if (slot.run.done) { slot.run = null; slot.canvas.remove(); }
      }
    },
    clear() { for (const slot of slots) { slot.run = null; slot.canvas.remove(); } },
    get live() { return slots.filter((s) => s.run).length; },
  };
}

export function createWorldFx(THREE, parent, { max = 6, pixel = .018 } = {}) {
  const slots = [];
  const make = () => {
    const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false; sprite.renderOrder = 20; parent.add(sprite);
    return { sprite, material, texture: null, run: null };
  };
  const hide = (slot) => { slot.run = null; slot.sprite.visible = false; };
  return {
    play(name, position, { pixel: size = pixel, ...options } = {}) {
      if (!ready(name)) return false;
      const { size: [w, h] } = modules.get(name).meta, slot = pickSlot(slots, w, h, make, max);
      if (!slot) return false;
      slot.run = createRun(name, options);
      if (fit(slot, slot.run)) {
        // A CanvasTexture can't change size once uploaded: a new one for a new size.
        slot.texture?.dispose();
        slot.texture = new THREE.CanvasTexture(slot.canvas);
        slot.texture.colorSpace = THREE.SRGBColorSpace;
        slot.texture.magFilter = slot.texture.minFilter = THREE.NearestFilter;
        slot.texture.generateMipmaps = false;
        slot.material.map = slot.texture; slot.material.needsUpdate = true;
      }
      const { run, sprite } = slot;
      sprite.center.set(run.ox / w, 1 - run.oy / h);
      sprite.scale.set(w * size, h * size, 1);
      sprite.position.copy(position);
      return true;
    },
    tick(dt) {
      for (const slot of slots) {
        if (!slot.run) continue;
        if (slot.run.step(dt)) { paint(slot, slot.run); slot.texture.needsUpdate = true; slot.sprite.visible = true; }
        if (slot.run.done) hide(slot);
      }
    },
    clear() { slots.forEach(hide); },
    dispose() {
      for (const slot of slots) { slot.sprite.removeFromParent(); slot.texture?.dispose(); slot.material.dispose(); }
      slots.length = 0;
    },
    get live() { return slots.filter((s) => s.run).length; },
  };
}
