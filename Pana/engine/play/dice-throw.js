// Throwing dice by hand instead of pressing a button. Two halves:
//
//   bindDiceThrow(...) — the gesture. Hold the button, Space or a finger on the
//     table to shake the dice; let go to throw. A flick on the table or out of the
//     button throws harder, and so does shaking longer. Gives a 0–1 power.
//   createToss(...) — the flight. Pure math (no Three.js) for a die thrown from
//     one point to another: an arc, bounces that shrink, a tumble that slows and
//     lands exactly on the rolled face.
//
// The rules still pick the number; power only changes how wild the throw looks.
//
//   const thrower = bindDiceThrow({ button: $('roll'), surface: canvas,
//     canThrow: () => myTurn && !rolled, onThrow: power => room.action('roll', { power }) });
//   // in the frame loop: thrower.shaking → rattle the die by thrower.power
//   const toss = createToss({ from, to, power, seed });
//   const { position, axis, turn } = toss.at(seconds);   // orientation = rotate(axis, turn) · final

const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
// Full strength after shaking this long, or with a flick this fast (px per ms).
export const FULL_SHAKE_MS = 900, FULL_FLICK = 2.4;

// Weak taps still throw; a long shake or a hard flick throws as hard as it gets.
export function throwPower(heldMs, flickSpeed = 0) {
  return .2 + .8 * Math.max(clamp01(heldMs / FULL_SHAKE_MS), clamp01(flickSpeed / FULL_FLICK));
}

// The power to send over the network: a finite 0–1 number, or the fallback.
export function cleanPower(value, fallback = .5) {
  return Number.isFinite(value) ? clamp01(value) : fallback;
}

// A mulberry32 stream, so every client tosses the same die the same way.
function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// from/to are [x, y, z] die centres; `to` is where it rests. height is the
// first arc above the higher end for a full-power throw; gravity sets the pace
// (bigger worlds want more). Returns { duration, impacts, at(t) }.
export function createToss({ from, to, power = .5, height = 1, gravity = 9.8, seed = 1 }) {
  power = clamp01(power);
  const random = stream(seed), g = Math.max(.1, gravity);
  const peak = Math.max(from[1], to[1]) + height * (.45 + power * .55);
  const arcs = [{ t0: 0, up: Math.sqrt(2 * (peak - from[1]) / g), down: Math.sqrt(2 * (peak - to[1]) / g), from: from[1], peak }];
  let air = arcs[0].up + arcs[0].down, bounce = (peak - to[1]) * .3;
  const impacts = [{ t: air, strength: 1 }];
  for (let i = 0, count = 1 + Math.round(power * 2); i < count && bounce > .01; i++, bounce *= .32) {
    const half = Math.sqrt(2 * bounce / g);
    arcs.push({ t0: air, up: half, down: half, from: to[1], peak: to[1] + bounce });
    air += half * 2; impacts.push({ t: air, strength: bounce / (peak - to[1]) });
  }
  // Spin around a random axis, mostly sideways so the die rolls forward.
  const dx = to[0] - from[0], dz = to[2] - from[2], flat = Math.hypot(dx, dz) || 1;
  const side = [-dz / flat, 0, dx / flat], wobble = [random() - .5, random() - .5, random() - .5];
  const raw = side.map((v, i) => v + wobble[i] * .9), size = Math.hypot(...raw) || 1;
  const axis = raw.map(v => v / size), spin = 9 + power * 22 + random() * 4;
  // The die keeps turning until it rests: turn falls to zero with the speed.
  const total = spin * air / 2;
  const duration = air + .12;
  function at(t) {
    t = Math.max(0, Math.min(duration, t));
    const k = Math.min(1, t / air), ease = 1 - (1 - k) * (1 - k);
    const arc = arcs.findLast(a => t >= a.t0) || arcs[0], local = Math.min(t - arc.t0, arc.up + arc.down);
    const y = local < arc.up
      ? arc.peak - .5 * g * (arc.up - local) ** 2
      : arc.peak - .5 * g * (local - arc.up) ** 2;
    const done = Math.min(t, air);
    return {
      position: [from[0] + dx * ease, t >= air ? to[1] : y, from[2] + dz * ease],
      axis, turn: total - spin * (done - done * done / (2 * air)), done: t >= duration,
    };
  }
  return { duration, impacts, at };
}

// The gesture. button: a hold-to-shake button. surface: an element where a
// flick throws (a tap there does nothing, so clicks keep their meaning).
// keys: KeyboardEvent.key values that shake while held. holdSurface: a finger
// held on the surface shakes too, and lifting it throws even without a flick.
export function bindDiceThrow({ button, surface, keys = [' '], holdSurface = false, canThrow = () => true, onStart, onThrow, onCancel }) {
  let shake = null;
  const now = () => performance.now();
  function begin(source, event) {
    if (shake || !canThrow()) return false;
    shake = { source, pointer: event?.pointerId, started: now(), samples: [], moved: 0 };
    if (event?.clientX !== undefined) shake.samples.push({ x: event.clientX, y: event.clientY, t: now() });
    button?.classList.add('is-shaking'); onStart?.();
    return true;
  }
  function flick() {
    const s = shake.samples, last = s.at(-1);
    if (!last) return 0;
    const first = s.find(p => last.t - p.t <= 110) || last;
    return last.t > first.t ? Math.hypot(last.x - first.x, last.y - first.y) / (last.t - first.t) : 0;
  }
  function power() { return shake ? throwPower(now() - shake.started, flick()) : 0; }
  function end() { shake = null; button?.classList.remove('is-shaking'); }
  function cancel() { if (shake) { end(); onCancel?.(); } }
  function release(source) {
    if (shake?.source !== source) return;
    // On the table only a real flick throws; a tap there is a click.
    if (source === 'surface' && !holdSurface && shake.moved < 24) { cancel(); return; }
    const value = power(), ok = canThrow(); end();
    if (ok) onThrow?.(value); else onCancel?.();
  }
  function move(event) {
    if (!shake || event.pointerId !== shake.pointer) return;
    const last = shake.samples.at(-1), t = now();
    if (last) shake.moved += Math.hypot(event.clientX - last.x, event.clientY - last.y);
    shake.samples.push({ x: event.clientX, y: event.clientY, t });
    while (shake.samples.length > 2 && t - shake.samples[0].t > 200) shake.samples.shift();
  }
  const listeners = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push([target, type, fn, options]); };
  if (button) {
    on(button, 'pointerdown', event => {
      if (event.button > 0 || !begin('button', event)) return;
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch { /* The pointer is already gone. */ }
      if (event.pointerType === 'touch') navigator.vibrate?.(8);
    });
    on(button, 'pointerup', event => { if (event.pointerId === shake?.pointer) release('button'); });
    on(button, 'pointercancel', cancel);
    on(button, 'contextmenu', event => event.preventDefault());
    // Keyboard users press the focused button with Enter; it throws at once.
    on(button, 'click', event => { if (event.detail === 0 && !shake && begin('click')) release('click'); });
  }
  if (surface) {
    on(surface, 'pointerdown', event => {
      if (event.button > 0 || !begin('surface', event)) return;
      try { surface.setPointerCapture(event.pointerId); } catch { /* The pointer is already gone. */ }
    });
    on(surface, 'pointerup', event => { if (event.pointerId === shake?.pointer) release('surface'); });
    on(surface, 'pointercancel', cancel);
  }
  on(window, 'pointermove', move);
  on(window, 'keydown', event => {
    if (!keys.includes(event.key) || event.target.closest?.('input, textarea, select, a, [contenteditable]')) return;
    if (event.target.closest?.('button') && event.target !== button) return;
    if (!canThrow() && !shake) return;
    event.preventDefault();
    if (!event.repeat) begin(`key:${event.key}`);
  });
  on(window, 'keyup', event => { if (shake?.source === `key:${event.key}`) { event.preventDefault(); release(shake.source); } });
  on(window, 'blur', cancel);
  on(document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  return {
    get shaking() { return !!shake; },
    get power() { return power(); },
    cancel,
    dispose() { cancel(); for (const [target, type, fn, options] of listeners) target.removeEventListener(type, fn, options); },
  };
}
