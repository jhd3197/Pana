import { sound } from '/engine/fx.js';
import { holdButton } from '/engine/touch.js';

// Keyboard, touch buttons and the aim reticle for Bululú's minigames.
// `mode()` is the running minigame's input ('2d', 'aim' or nothing), `box()`
// its drawing area in CSS pixels, `ignore(e)` skips keys meant for a focused
// control and `onKey(k, e)` gets every other keydown for the game's own keys.
//
// 1D minigames read { x, jump }; `input: '2d'` adds z (W/S, ↑/↓) and pull
// (the action held). Aim minigames get a reticle in NDC (−1..1) instead: the
// mouse moves it and a press pulls; WASD / arrows steer it and Space pulls; on
// touch, dragging anywhere aims and lifting the finger fires. Those pointer
// handlers live on the canvas only between bindAim(true) and bindAim(false),
// so the board and minimap never see them.
export const IDLE_AIM = { aim: { x: 0, y: 0 }, pull: false, fire: false };
const clampAim = (v) => Math.max(-1, Math.min(1, v));

export function createInput({ canvas, mode, box, paused, ignore, onKey }) {
  const held = {};
  let jumpPressed = false, pullPressed = false;
  const aim = { x: 0, y: 0, pull: false, keyPull: false, fire: false, keyT: 0, pointer: null, touch: null };

  addEventListener('keydown', (e) => {
    if (ignore(e)) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    held[k] = true;
    // in 2D and aim minigames W / ↑ move, so only Space is the action
    if (!e.repeat && (k === ' ' || (!mode() && (k === 'w' || k === 'arrowup')))) jumpPressed = true;
    if (!e.repeat && k === ' ' && mode() === 'aim') aim.keyPull = true;
    if (!e.repeat && k === ' ') pullPressed = true;
    onKey(k, e);
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    held[k] = false;
    // Space pulls the china while held; letting go fires
    if (k === ' ' && aim.keyPull) {
      aim.keyPull = false;
      aim.fire = true;
    }
  });
  addEventListener('pointerdown', () => sound.unlock());
  addEventListener('blur', () => clear());

  // on-screen buttons for touch screens during minigames
  // (engine/touch.js: a finger sliding off the button still lets go)
  for (const [id, key] of [['t-left', 'a'], ['t-right', 'd'], ['t-jump', ' '], ['t2-up', 'w'], ['t2-down', 's'], ['t2-left', 'a'], ['t2-right', 'd'], ['t2-go', ' ']]) {
    holdButton(document.getElementById(id), { down: () => { held[key] = true; if (key === ' ') jumpPressed = pullPressed = true; }, up: () => { held[key] = false; } });
  }

  function aimAtPointer(e) {
    const r = box();
    aim.x = clampAim(((e.clientX - r.x) / r.w) * 2 - 1);
    aim.y = clampAim(1 - ((e.clientY - r.y) / r.h) * 2);
  }
  const aimHandlers = {
    pointerdown(e) {
      if (paused() || aim.pointer != null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      sound.unlock();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
      aim.pointer = e.pointerId;
      if (e.pointerType === 'mouse') aimAtPointer(e);
      else aim.touch = { x: e.clientX, y: e.clientY };
      aim.pull = true;
    },
    pointermove(e) {
      if (e.pointerType === 'mouse') return aimAtPointer(e);
      if (aim.pointer !== e.pointerId || !aim.touch) return;
      // a finger would hide the reticle, so touch drags it (a bit faster than the finger)
      const r = box();
      aim.x = clampAim(aim.x + ((e.clientX - aim.touch.x) / r.w) * 3);
      aim.y = clampAim(aim.y - ((e.clientY - aim.touch.y) / r.h) * 3);
      aim.touch = { x: e.clientX, y: e.clientY };
    },
    pointerup(e) {
      if (aim.pointer !== e.pointerId) return;
      aim.pointer = aim.touch = null;
      if (aim.pull) aim.fire = true;
      aim.pull = false;
    },
    pointercancel(e) {
      if (aim.pointer !== e.pointerId) return;
      aim.pointer = aim.touch = null;
      aim.pull = false;
    },
  };
  function bindAim(on) {
    for (const [type, fn] of Object.entries(aimHandlers)) canvas[on ? 'addEventListener' : 'removeEventListener'](type, fn);
    Object.assign(aim, { x: 0, y: 0, pull: false, keyPull: false, fire: false, keyT: 0, pointer: null, touch: null });
  }
  // Nothing held, nothing pending: the menu opened or the window lost focus.
  function clear() {
    for (const key in held) held[key] = false;
    jumpPressed = false;
    aim.pull = aim.keyPull = aim.fire = false;
  }
  // A press during the countdown must not count once the minigame starts.
  function forgetPresses() {
    jumpPressed = false;
    aim.fire = aim.keyPull = false;
  }

  function read(dt = 0) {
    const x = (held.d || held.arrowright ? 1 : 0) - (held.a || held.arrowleft ? 1 : 0);
    const y = (held.w || held.arrowup ? 1 : 0) - (held.s || held.arrowdown ? 1 : 0);
    const jump = jumpPressed;
    jumpPressed = false;
    if (mode() === 'aim') {
      // keys steer the reticle, quick to start and faster the longer they're held
      aim.keyT = x || y ? aim.keyT + dt : 0;
      const speed = 0.8 + Math.min(1, aim.keyT / 0.45) * 1.5;
      aim.x = clampAim(aim.x + x * speed * dt);
      aim.y = clampAim(aim.y + y * speed * dt);
      const fire = aim.fire;
      aim.fire = false;
      return { aim: { x: aim.x, y: aim.y }, pull: aim.pull || aim.keyPull, fire };
    }
    if (mode() !== '2d') return { x, jump };
    // Holding the action (Bolas Criollas charges with it); a quick tap still counts once.
    const pull = !!held[' '] || pullPressed;
    pullPressed = false;
    return { x, z: y, jump, pull };
  }

  return { held, aim, read, bindAim, clear, forgetPresses };
}
