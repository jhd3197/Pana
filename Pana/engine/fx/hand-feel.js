// The same weight for a hand of cards drawn as HTML buttons. A hand is usually rebuilt on
// every render, so its state is keyed by card, not by element: call after() once the new
// buttons are in, and whoever moved springs over from where it was, closing the gap.
// Everything is on the CSS longhands (translate, rotate, scale), so a game's own transform
// (a fan, a hover lift) still applies underneath.
//
//   const feel = bindHandFeel(handEl, { keyOf: (el) => el.dataset.card });
//   handEl.replaceChildren(...buttons); feel.after();
import { calm } from './feel.js';
import { clampTo, springStep } from './card-feel.js';

const TILT_DEG = 16, SCALE_HOVER = 1.08, SCALE_HELD = 1.16, GAP_MS = 520, GAP_SAMPLES = 16, SWAY_PER_PX = .22, SWAY_MAX = 14;
const STEP = 1 / 60, NEAR = .001;
const audio = (use) => { import('../sfx.js').then(({ sfx }) => use(sfx)).catch(console.warn); };

// The path a card takes from `from` px back to 0: a spring that overshoots, with the lean
// its speed gives it. Plain numbers, so the keyframes can be checked without a browser.
export function gapPath(from, samples = GAP_SAMPLES, ms = GAP_MS) {
  const dt = ms / 1000 / samples, out = [];
  let x = from, v = 0;
  for (let i = 0; i <= samples; i++) {
    out.push({ x, lean: clampTo(-v * SWAY_PER_PX * dt * 6, SWAY_MAX) });
    for (let k = 0; k < Math.round(dt / STEP) || (!k); k++) [x, v] = springStep(x, v, 0, Math.min(dt, STEP));
  }
  out[samples] = { x: 0, lean: 0 };
  return out;
}

export function bindHandFeel(hand, { keyOf = (el) => el.dataset.card ?? el.dataset.tile, selector = 'button' } = {}) {
  const states = new Map(), lefts = new Map();
  let frame = 0, last = 0;
  hand.style.perspective = '700px';
  const stateOf = (key) => {
    let s = states.get(key);
    if (!s) { s = { x: 0, y: 0, vx: 0, vy: 0, scale: 1, sv: 0, wantX: 0, wantY: 0, over: false, held: false }; states.set(key, s); }
    return s;
  };
  const elementOf = (key) => [...hand.querySelectorAll(selector)].find((el) => keyOf(el) === key);
  const paint = (el, s) => {
    const angle = Math.hypot(s.x, s.y) * TILT_DEG;
    el.style.rotate = angle > .05 ? `${(-s.y).toFixed(3)} ${s.x.toFixed(3)} 0 ${angle.toFixed(2)}deg` : '';
    el.style.scale = Math.abs(s.scale - 1) > NEAR ? s.scale.toFixed(3) : '';
    // The shadow grows with how far off the table it has come.
    const lift = Math.max(0, s.scale - 1) * 60;
    el.style.boxShadow = lift > .5 ? `${(5 + lift).toFixed(1)}px ${(5 + lift).toFixed(1)}px ${(lift * .7).toFixed(1)}px rgba(0,0,0,.4)` : '';
  };
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    let busy = false;
    for (const [key, s] of states) {
      [s.x, s.vx] = springStep(s.x, s.vx, s.over ? s.wantX : 0, dt, 170, 17);
      [s.y, s.vy] = springStep(s.y, s.vy, s.over ? s.wantY : 0, dt, 170, 17);
      [s.scale, s.sv] = springStep(s.scale, s.sv, s.held ? SCALE_HELD : s.over ? SCALE_HOVER : 1, dt, 240, 20);
      const resting = !s.over && !s.held && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.scale - 1) + Math.abs(s.sv) < .004;
      const el = elementOf(key);
      if (resting) { s.x = s.y = s.vx = s.vy = s.sv = 0; s.scale = 1; }
      if (el) paint(el, s);
      if (resting) states.delete(key); else busy = true;
    }
    frame = busy ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!frame && !calm()) { last = performance.now(); frame = requestAnimationFrame(tick); } };
  const live = (target) => { const el = target?.closest?.(selector); return el && hand.contains(el) && !el.disabled ? el : null; };
  const move = (event) => {
    const el = live(event.target);
    for (const s of states.values()) if (s.over && (!el || s !== states.get(keyOf(el)))) s.over = false;
    if (el) {
      const key = keyOf(el), s = stateOf(key), box = el.getBoundingClientRect();
      if (!s.over) audio((sfx) => sfx.cardFlick(.45));
      s.over = true;
      s.wantX = clampTo((event.clientX - box.left) / box.width * 2 - 1, 1);
      s.wantY = -clampTo((event.clientY - box.top) / box.height * 2 - 1, 1);
    }
    wake();
  };
  const leave = () => { for (const s of states.values()) s.over = false; wake(); };
  hand.addEventListener('pointermove', move);
  hand.addEventListener('pointerleave', leave);
  return {
    // After the game has rebuilt the hand: who is taken, and who has to close a gap.
    after() {
      const reduced = calm(), now = new Map();
      for (const el of hand.querySelectorAll(selector)) {
        const key = keyOf(el);
        if (key == null) continue;
        const box = el.getBoundingClientRect();
        now.set(key, box.left);
        const held = el.classList.contains('selected');
        if (held || states.has(key)) {
          const s = stateOf(key);
          if (held && !s.held && !reduced) audio((sfx) => sfx.cardFlick(1));
          s.held = held;
          paint(el, s);
        }
        const was = lefts.get(key), from = was == null ? 0 : was - box.left;
        if (!reduced && Math.abs(from) > 1 && el.animate) {
          const path = gapPath(from);
          el.animate({
            translate: path.map((p) => `${p.x.toFixed(1)}px 0`),
            rotate: path.map((p) => `0 0 1 ${p.lean.toFixed(2)}deg`),
          }, { duration: GAP_MS, easing: 'linear' });
        }
      }
      lefts.clear();
      for (const [key, left] of now) lefts.set(key, left);
      wake();
    },
    dispose() {
      cancelAnimationFrame(frame);
      hand.removeEventListener('pointermove', move); hand.removeEventListener('pointerleave', leave);
    },
  };
}
