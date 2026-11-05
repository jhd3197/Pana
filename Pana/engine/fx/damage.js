// Damage you can read at a glance. A health bar whose lost chunk flashes white,
// orange and red, holds a beat and drains; numbers that pop and fan out on arcs;
// sparkles at the bar's edge on a heal; a spring for a visual-only knockback.
//
//   const bar = createDamageBar(el, { max: 100, side: 'left' });
//   bar.set(hp);               // on every snapshot
//   bar.snap(hp);              // a new round: no chunk, no sparkle
//   bar.tick(dt);              // every frame
//   const numbers = createDamageNumbers();
//   numbers.pop(x, y, 12, { kind: 'crit' });  // screen pixels; 'hit', 'crit' or 'heal'
//   const knock = createKnock();
//   knock.kick(dx, dz, 2);     // then each frame: const { x, z } = knock.step(dt);
import { calm, clamp01, damp, fxLayer, useCss } from './feel.js';
useCss(new URL('damage.css', import.meta.url));

const CHUNK = { white: .07, orange: .17, hold: .5 }, HURT_RATE = 24, HEAL_RATE = 7, DRAIN_RATE = 5;
const SETTLED = .15, HEAL_SPARKS = 3;

export const barTone = (fraction) => fraction > .5 ? 'ok' : fraction > .25 ? 'warn' : 'low';
export const chunkTone = (age) => age < CHUNK.white ? 'white' : age < CHUNK.orange ? 'orange' : 'red';

// The bar without a page: testable, and what the DOM layer reads each frame.
export function createBarModel({ max = 100, value = max, reduced = false } = {}) {
  const top = (v) => Math.min(max, Math.max(0, v));
  let target = top(value), shown = target, trail = target, age = CHUNK.hold;
  return {
    get target() { return target; }, get shown() { return shown; }, get trail() { return trail; },
    get age() { return age; }, get max() { return max; },
    set(next) {
      const v = top(next), delta = v - target;
      if (v < target) { trail = Math.max(trail, shown); age = 0; }
      target = v;
      if (reduced) shown = trail = v;
      return delta;
    },
    snap(next) { target = shown = trail = top(next); age = CHUNK.hold; },
    step(dt) {
      age += dt;
      shown = damp(shown, target, target < shown ? HURT_RATE : HEAL_RATE, dt);
      if (Math.abs(shown - target) < SETTLED) shown = target;
      if (trail < target) trail = target;
      else if (age >= CHUNK.hold) { trail = damp(trail, target, DRAIN_RATE, dt); if (trail - target < SETTLED) trail = target; }
    },
  };
}

export function createDamageBar(root, { max = 100, value = max, side = 'left' } = {}) {
  const model = createBarModel({ max, value, reduced: calm() });
  const part = (name) => Object.assign(document.createElement('span'), { className: `pk-hp-${name}` });
  const chunk = part('chunk'), gain = part('gain'), fill = part('fill');
  root.classList.add('pk-hp'); root.dataset.side = side;
  root.append(chunk, gain, fill);
  let last = '';
  function draw() {
    const f = model.shown / max, t = model.trail / max, g = model.target / max, tone = barTone(g), hot = chunkTone(model.age);
    const key = `${f.toFixed(3)}|${t.toFixed(3)}|${g.toFixed(3)}|${tone}|${hot}`;
    if (key === last) return;
    last = key;
    fill.style.transform = `scaleX(${f})`; chunk.style.transform = `scaleX(${t})`; gain.style.transform = `scaleX(${g})`;
    root.dataset.tone = tone; chunk.dataset.tone = hot;
  }
  draw();
  return {
    set(next) {
      const delta = model.set(next);
      if (delta >= HEAL_SPARKS) healSparkles(root, model.target / max, side);
      draw();
    },
    snap(next) { model.snap(next); draw(); },
    tick(dt) { if (model.shown !== model.target || model.trail !== model.target || model.age < CHUNK.hold) { model.step(dt); draw(); } },
    get value() { return model.target; },
  };
}

function healSparkles(root, fraction, side, count = 6) {
  if (calm() || !root.isConnected) return;
  const box = root.getBoundingClientRect();
  const x = side === 'right' ? box.right - box.width * fraction : box.left + box.width * fraction, y = box.top + box.height / 2;
  for (let i = 0; i < count; i++) {
    const spark = Object.assign(document.createElement('i'), { className: 'pk-hp-spark' });
    spark.style.left = `${x}px`; spark.style.top = `${y + (Math.random() - .5) * box.height}px`;
    fxLayer().append(spark);
    const dx = (Math.random() - .5) * 34, dy = -14 - Math.random() * 26;
    spark.animate([
      { transform: 'translate(-50%, -50%) rotate(45deg) scale(.2)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .6}px)) rotate(45deg) scale(1.1)`, opacity: 1, offset: .35 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(45deg) scale(.2)`, opacity: 0 },
    ], { duration: 420 + Math.random() * 240, delay: i * 26, easing: 'ease-out', fill: 'backwards' }).onfinish = () => spark.remove();
  }
}

// Bigger hits read bigger, within a size that still fits on a phone.
export const numberSize = (amount, kind = 'hit') => {
  const size = .8 + clamp01(amount / 40) * .9;
  return kind === 'crit' ? size * 1.3 : size;
};
// Spread across the fan so a flurry of hits doesn't pile numbers on one spot.
const FAN = [-.35, .55, -.8, .15, .9, -.1, -.6, .35];
export const fanAt = (i) => FAN[i % FAN.length];

export function createDamageNumbers({ max = 14 } = {}) {
  const pool = [];
  let spawned = 0;
  function take() {
    if (pool.length < max) {
      const node = Object.assign(document.createElement('span'), { className: 'pk-dn' });
      node.append(document.createElement('b')); fxLayer().append(node);
      const item = { node, anim: null, born: 0 };
      pool.push(item);
      return item;
    }
    return pool.reduce((old, it) => it.born < old.born ? it : old);
  }
  function pop(x, y, amount, { kind = 'hit' } = {}) {
    const value = Math.round(amount);
    if (!value) return;
    const item = take(), { node } = item, fan = fanAt(spawned++), size = numberSize(value, kind);
    item.anim?.cancel(); item.born = spawned;
    if (!node.isConnected) fxLayer().append(node);
    node.dataset.kind = kind; node.firstChild.textContent = kind === 'heal' ? `+${value}` : `${value}`;
    node.style.left = `${x}px`; node.style.top = `${y}px`; node.style.visibility = 'visible';
    const at = (t, scale, opacity) => {
      // Up fast, then falling: a thrown arc, sideways by the fan.
      const dx = fan * 92 * t, dy = -96 * (2 * t - t * t) + 34 * t * t;
      return { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`, opacity };
    };
    const still = (opacity) => ({ transform: `translate(-50%, -50%) scale(${size})`, opacity });
    const frames = calm() ? [still(1), still(0)] : [at(0, size * .3, 1), at(.1, size * 1.45, 1), at(.24, size, 1), at(.7, size, 1), at(1, size * .85, 0)];
    item.anim = node.animate(frames, { duration: kind === 'crit' ? 1050 : 850, easing: 'linear' });
    item.anim.onfinish = () => { node.style.visibility = 'hidden'; };
  }
  return { pop, get live() { return pool.filter(i => i.node.style.visibility === 'visible').length; } };
}

// A stiff spring around zero: the model snaps back and returns to its true spot.
export function createKnock({ stiffness = 150, damping = 17 } = {}) {
  let x = 0, z = 0, vx = 0, vz = 0;
  return {
    kick(dx, dz, power = 1) { if (!calm()) { vx += dx * power; vz += dz * power; } },
    step(dt) {
      const h = Math.min(dt, .05);
      vx += (-stiffness * x - damping * vx) * h; vz += (-stiffness * z - damping * vz) * h;
      x += vx * h; z += vz * h;
      if (Math.abs(x) + Math.abs(z) + Math.abs(vx) + Math.abs(vz) < .002) x = z = vx = vz = 0;
      return { x, z };
    },
  };
}
