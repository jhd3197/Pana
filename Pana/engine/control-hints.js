// One-time control hints for play: a compact line of "key action" pairs that
// shows the keys of the device the player is using (keyboard and mouse, a
// controller, a touch screen), switches live when that device changes, and
// goes away for good on the first press, click or touch. Each hint shows at
// most once per session (sessionStorage; a page without storage keeps the
// memory for its own lifetime).
//
//   const hints = mountControlHints($('control-hints'), { game: 'pintura', hints: [
//     { id: 'fire', label: loc('pintar'), keys: { keyboard: 'Clic', gamepad: 'RT', touch: null } },
//     …
//   ] });
//   hints.show();        // when play starts: the hints not seen yet this session
//   hints.done('fire');  // the player did it: that hint goes now
//
// The device comes from engine/gamepad.js (onInputDevice), loaded lazily like
// ui.js does; gamepad keys are written with Xbox names and shown in the
// controller's own (formatPadLabel: Cruz, Círculo… on a PlayStation pad).
// A key of null hides that hint on that device.

export const HINT_DEVICES = ['keyboard', 'gamepad', 'touch'];

// The key text a hint shows on a device, or null when it has none there.
export function hintKey(hint, device, format = text => text) {
  const key = hint?.keys?.[HINT_DEVICES.includes(device) ? device : 'keyboard'];
  if (key == null || key === '') return null;
  return device === 'gamepad' ? format(key) : key;
}

// The rows a set of hints shows on a device: [{ id, key, label }], skipping
// hints with no key there.
export function hintRows(hints, device, format) {
  return hints.map(h => ({ id: h.id, key: hintKey(h, device, format), label: h.label })).filter(h => h.key !== null);
}

// Dismissed hint ids, kept in storage under one key. Storage that throws
// (private mode, blocked cookies, a full quota) falls back to memory only.
export function createHintMemory(storage, key = 'pana:hints') {
  const seen = new Set();
  try { for (const id of JSON.parse(storage?.getItem(key) || '[]')) seen.add(String(id)); } catch { /* memory only */ }
  const save = () => { try { storage?.setItem(key, JSON.stringify([...seen])); } catch { /* memory only */ } };
  return {
    has: id => seen.has(id),
    dismiss(...ids) { const before = seen.size; for (const id of ids) seen.add(id); if (seen.size !== before) save(); },
    // The hints still to show, in order.
    fresh: hints => hints.filter(h => !seen.has(h.id)),
  };
}

// engine/gamepad.js, loaded once on a page (it starts reading pads).
let padFormat = text => text;
const pad = globalThis.document ? import('./gamepad.js').then(m => { padFormat = text => m.formatPadLabel(text); return m; }).catch(() => null) : Promise.resolve(null);
const currentDevice = () => globalThis.document?.documentElement.dataset.panaInput || 'keyboard';
// The key for the device in use right now: keyFor({ keyboard: 'R', gamepad: 'X', touch: null }).
export function keyFor(keys) { return hintKey({ keys }, currentDevice(), padFormat); }

function sessionStore() { try { return globalThis.sessionStorage ?? null; } catch { return null; } }
const INPUTS = ['keydown', 'pointerdown', 'touchstart'];

// node: an empty element for the line. Options: game (storage key), hints,
// timeout (ms the line stays without input; 0 keeps it until input),
// storage (sessionStorage by default).
export function mountControlHints(node, { game, hints, timeout = 12000, storage = sessionStore() } = {}) {
  const memory = createHintMemory(storage, `pana:hints:${game}`);
  let device = currentDevice(), shown = [], timer = 0, stopDevice = () => {}, disposed = false;
  node.classList.add('pk-control-hints'); node.setAttribute('role', 'note'); node.hidden = true;

  function draw() {
    const rows = hintRows(hints.filter(h => shown.includes(h.id)), device, padFormat);
    node.hidden = !rows.length; node.dataset.device = device;
    node.replaceChildren(...rows.map(h => {
      const item = document.createElement('span'), key = document.createElement('b');
      item.dataset.hint = h.id; key.textContent = h.key; item.append(key, ` ${h.label}`);
      return item;
    }));
  }
  function hide() { clearTimeout(timer); shown = []; draw(); }
  // Any press, click or touch dismisses the line. A controller counts too:
  // engine/gamepad.js turns its buttons and sticks into key events.
  const onInput = event => { if (shown.length && !event.repeat) hide(); };
  for (const type of INPUTS) addEventListener(type, onInput, { capture: true, passive: true });
  pad.then(m => { if (m && !disposed) stopDevice = m.onInputDevice(state => { device = state.device; if (shown.length) draw(); }); });

  return {
    // Shows the hints not seen this session. They count as seen right away,
    // so a reload or the next round never brings them back.
    show() {
      const fresh = memory.fresh(hints).map(h => h.id);
      if (!fresh.length) return false;
      memory.dismiss(...fresh); shown = fresh; draw();
      clearTimeout(timer); if (timeout) timer = setTimeout(hide, timeout);
      return !node.hidden;
    },
    done(id) { memory.dismiss(id); shown = shown.filter(s => s !== id); if (shown.length) draw(); else hide(); },
    hide,
    get visible() { return !node.hidden; },
    dispose() { disposed = true; hide(); stopDevice(); for (const type of INPUTS) removeEventListener(type, onInput, { capture: true }); },
  };
}
