// First-person look input shared by the action games: pointer lock with the
// mouse, drag-to-look on touch (or when a browser refuses the lock), and one
// sensitivity for each device. The game owns its yaw/pitch; this only reports deltas.
//
//   const look = createLookControls(canvas, { enabled, look: (yaw, pitch) => …,
//     press: event => …, release: event => …, unlocked: () => menu.open('game') });
//
// Esc releases pointer lock before the page sees the key, so `unlocked` is how a
// game opens its menu. Call `release()` when a menu or results screen opens.
import { padLook } from '../gamepad.js';
import { getSettings, setSettings } from '../settings.js';

export const SENSITIVITY = { baja: .0014, media: .0024, alta: .0038 };
export const SENSITIVITY_CHOICES = [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']];

export function loadSensitivity() {
  const value=getSettings().mouseSensitivity*.0024;
  return Object.keys(SENSITIVITY).reduce((a,b)=>Math.abs(SENSITIVITY[a]-value)<Math.abs(SENSITIVITY[b]-value)?a:b);
}
export function saveSensitivity(value) { if(SENSITIVITY[value])setSettings({mouseSensitivity:SENSITIVITY[value]/.0024}); }

export function createLookControls(canvas, { enabled = () => true, look, press, release, unlocked } = {}) {
  let drag = null;
  const locked = () => document.pointerLockElement === canvas;
  function onLockChange() {
    document.body.classList.toggle('mouse-locked', locked());
    if (!locked() && enabled()) unlocked?.();
  }
  function onMove(event) {
    if (!enabled()) return;
    const s=getSettings(),mouse=.0024*s.mouseSensitivity;
    if (locked()) look(-event.movementX * mouse, -event.movementY * mouse*s.mouseVertical*(s.mouseInvertY?-1:1));
    else if (drag?.id === event.pointerId) {
      const touch=drag.touch,k=touch ? .006*s.touchSensitivity : mouse;
      look(-(event.clientX - drag.x) * k, -(event.clientY - drag.y) * k*(touch?(s.touchInvertY?-1:1):s.mouseVertical*(s.mouseInvertY?-1:1)));
      drag.x = event.clientX; drag.y = event.clientY;
    }
  }
  function onDown(event) {
    if (!enabled()) return;
    event.preventDefault(); canvas.focus?.({ preventScroll: true });
    if (locked()) { press?.(event); return; }
    canvas.setPointerCapture?.(event.pointerId); drag = { id: event.pointerId, x: event.clientX, y: event.clientY, touch:event.pointerType==='touch' };
    if (event.pointerType === 'mouse' && canvas.requestPointerLock) try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {}
  }
  function onUp(event) {
    if (drag?.id === event.pointerId) drag = null;
    release?.(event);
  }
  // A controller's right stick turns at a steady speed, with its own sensitivity and vertical settings.
  const stopPad = padLook((x, y, dt) => {
    if (!enabled()) return;
    const s=getSettings();
    look(-x * 2.8 * dt, -y * 1.9 * dt*s.padVertical*(s.padInvertY?-1:1));
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
    get sensitivity() { return loadSensitivity(); },
    set sensitivity(value) { saveSensitivity(value); },
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
