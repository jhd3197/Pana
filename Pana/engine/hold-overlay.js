// Hold a key to show a layer, let go to hide it: a map, the round's numbers,
// the team. The HUD stays small the rest of the time.
//
//   import { createHoldOverlay } from '/engine/hold-overlay.js';
//   const info = createHoldOverlay({ keys: ['Tab'], enabled: () => playing(), change: on => hud.info(on) });
//   info.toggle('touch');   // a touch button: tap to show, tap again to hide
//   info.release();         // a menu opened, the round ended
//   info.held; info.dispose();
//
// A controller reaches it through the key its button presses:
// createGameMenu({ pad: { keys: { view: ['Tab', label] } } }) makes View
// (standard button 8) press and release Tab, and engine/gamepad.js lets go of
// it when a menu opens or the window loses focus. No polling here.
//
// While enabled, the keydown is preventDefault'ed, so Tab never walks the
// focus. Letting go, the window losing focus, the page hiding and the pointer
// lock ending all hide the layer, so it never stays stuck on screen.

// Who holds the layer open: a key, a touch toggle. Pure, no DOM.
export function createHold(change = () => {}) {
  const sources = new Set();
  let on = false;
  const sync = () => { const next = sources.size > 0; if (next !== on) { on = next; change(on); } };
  return {
    get held() { return on; },
    press(source) { sources.add(source); sync(); },
    lift(source) { sources.delete(source); sync(); },
    toggle(source) { if (sources.has(source)) sources.delete(source); else sources.add(source); sync(); },
    release() { sources.clear(); sync(); },
  };
}

// e.code or e.key: real keys and the pad's synthetic ones carry both.
export const holdKeyOf = (event, keys) => keys.includes(event.code) ? event.code : keys.includes(event.key) ? event.key : null;
const typing = target => !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''));

export function createHoldOverlay({ keys = ['Tab'], change, enabled = () => true, target = globalThis, doc = globalThis.document } = {}) {
  const hold = createHold(change);
  const down = e => {
    const key = holdKeyOf(e, keys);
    if (!key || typing(e.target) || !enabled()) return;
    e.preventDefault();
    hold.press(`key:${key}`);
  };
  const up = e => { const key = holdKeyOf(e, keys); if (key) hold.lift(`key:${key}`); };
  const lost = () => hold.release();
  const hidden = () => { if (doc?.hidden) hold.release(); };
  const unlocked = () => { if (!doc?.pointerLockElement) hold.release(); };
  target.addEventListener('keydown', down); target.addEventListener('keyup', up); target.addEventListener('blur', lost);
  doc?.addEventListener('visibilitychange', hidden); doc?.addEventListener('pointerlockchange', unlocked);
  return {
    get held() { return hold.held; },
    toggle(source = 'touch') { if (hold.held || enabled()) hold.toggle(source); },
    release: hold.release,
    // Hide it once the game stops allowing it (call each frame or on a phase change).
    check() { if (hold.held && !enabled()) hold.release(); },
    dispose() {
      hold.release();
      target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', lost);
      doc?.removeEventListener('visibilitychange', hidden); doc?.removeEventListener('pointerlockchange', unlocked);
    },
  };
}
