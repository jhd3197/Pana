// First-person look input shared by the action games: pointer lock with the
// mouse, drag-to-look on touch (or when a browser refuses the lock), and one
// saved sensitivity. The game owns its yaw/pitch; this only reports deltas.
//
//   const look = createLookControls(canvas, { enabled, look: (yaw, pitch) => …,
//     press: event => …, release: event => …, unlocked: () => menu.open('game') });
//
// Esc releases pointer lock before the page sees the key, so `unlocked` is how a
// game opens its menu. Call `release()` when a menu or results screen opens.
import { padLook } from '../gamepad.js';

export const SENSITIVITY = { baja: .0014, media: .0024, alta: .0038 };
export const SENSITIVITY_CHOICES = [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']];
const KEY = 'pana:look-sensitivity';

export function loadSensitivity() {
  try {
    const saved = localStorage.getItem(KEY) ?? localStorage.getItem('pana:pepazo-mouse');
    return SENSITIVITY[saved] ? saved : 'media';
  } catch { return 'media'; }
}
export function saveSensitivity(value) { try { localStorage.setItem(KEY, value); } catch {} }

export function createLookControls(canvas, { enabled = () => true, look, press, release, unlocked } = {}) {
  let sensitivity = loadSensitivity(), drag = null;
  const locked = () => document.pointerLockElement === canvas;
  const turn = () => SENSITIVITY[sensitivity];
  function onLockChange() {
    document.body.classList.toggle('mouse-locked', locked());
    if (!locked() && enabled()) unlocked?.();
  }
  function onMove(event) {
    if (!enabled()) return;
    if (locked()) look(-event.movementX * turn(), -event.movementY * turn());
    else if (drag?.id === event.pointerId) {
      look(-(event.clientX - drag.x) * turn() * 2.5, -(event.clientY - drag.y) * turn() * 2.5);
      drag.x = event.clientX; drag.y = event.clientY;
    }
  }
  function onDown(event) {
    if (!enabled()) return;
    event.preventDefault(); canvas.focus?.({ preventScroll: true });
    if (locked()) { press?.(event); return; }
    canvas.setPointerCapture?.(event.pointerId); drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.pointerType === 'mouse' && canvas.requestPointerLock) try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {}
  }
  function onUp(event) {
    if (drag?.id === event.pointerId) drag = null;
    release?.(event);
  }
  // A controller's right stick turns at a steady speed, scaled by the same setting.
  const stopPad = padLook((x, y, dt) => {
    if (!enabled()) return;
    const k = turn() / SENSITIVITY.media * dt;
    look(-x * Math.abs(x) * 2.8 * k, -y * Math.abs(y) * 1.9 * k);
  });
  const prevent = event => event.preventDefault();
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', prevent);
  return {
    get locked() { return locked(); },
    get sensitivity() { return sensitivity; },
    set sensitivity(value) { if (SENSITIVITY[value]) { sensitivity = value; saveSensitivity(value); } },
    release() { drag = null; if (locked()) document.exitPointerLock(); },
    dispose() {
      this.release(); stopPad();
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('contextmenu', prevent);
    },
  };
}
