// Keyboard, touch and gamepad feed one set of controls: a screen stick, two
// held buttons (golpe, cubrirse) and press counters, so a tap shorter than a
// tick still reaches the host. game.js turns the stick into a world direction.
import { holdButton, drawIcons } from '/engine/touch.js';
import { getSettings, inputAxis } from '/engine/settings.js';

const KEYS = {
  up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
  golpe: ['j', 'z'], cubrir: ['k', 'x'], esquivar: [' ', 'c'], agarrar: ['l', 'v'], dale: ['t'],
};
const PAD = { golpe: [0], esquivar: [1], agarrar: [2], dale: [3], cubrir: [4, 5, 6, 7] };

export function createControls({ paused = () => false, onBet = () => {} } = {}) {
  const keys = new Set(), touch = new Set(), counts = { gp: 0, e: 0, a: 0, t: 0 };
  const COUNTER = { golpe: 'gp', esquivar: 'e', agarrar: 'a', dale: 't' };
  const press = (button) => { const k = COUNTER[button]; if (k) counts[k] = (counts[k] + 1) % 256; };
  const named = (key) => Object.keys(KEYS).find(name => KEYS[name].includes(key));
  let padHeld = new Set();

  addEventListener('keydown', (event) => {
    if (paused() || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const key = event.key.toLowerCase(), name = named(key);
    if (/^[1-4]$/.test(key)) { onBet(Number(key) - 1); return; }
    if (!name) return;
    event.preventDefault();
    if (!event.repeat && !keys.has(name)) press(name);
    keys.add(name);
  });
  addEventListener('keyup', (event) => { const name = named(event.key.toLowerCase()); if (name) keys.delete(name); });
  addEventListener('blur', () => { keys.clear(); touch.clear(); });

  // Mouse on the 3D view: left button punches (hold for a trompón), right button blocks.
  const canvas = document.getElementById('world'), mouse = new Set();
  canvas?.addEventListener('pointerdown', (event) => {
    if (paused() || event.pointerType !== 'mouse') return;
    const name = event.button === 0 ? 'golpe' : event.button === 2 ? 'cubrir' : null;
    if (!name) return;
    if (!mouse.has(name)) press(name);
    mouse.add(name);
  });
  addEventListener('pointerup', (event) => { if (event.pointerType === 'mouse') mouse.delete(event.button === 0 ? 'golpe' : 'cubrir'); });
  canvas?.addEventListener('contextmenu', (event) => event.preventDefault());
  addEventListener('blur', () => mouse.clear());
  drawIcons();
  for (const id of ['up', 'down', 'left', 'right', 'golpe', 'cubrir', 'esquivar', 'agarrar', 'dale']) {
    const button = document.getElementById(`touch-${id}`); if (!button) continue;
    holdButton(button, { down: () => { touch.add(id); press(id); }, up: () => touch.delete(id), paused });
  }

  function pad() {
    const gamepad = [...(navigator.getGamepads?.() || [])].find(p => p && p.connected !== false);
    if (!gamepad) { padHeld = new Set(); return { x: 0, y: 0, held: padHeld }; }
    const held = new Set();
    for (const [name, buttons] of Object.entries(PAD)) if (buttons.some(i => gamepad.buttons[i]?.pressed)) held.add(name);
    if (gamepad.buttons[12]?.pressed) held.add('up'); if (gamepad.buttons[13]?.pressed) held.add('down');
    if (gamepad.buttons[14]?.pressed) held.add('left'); if (gamepad.buttons[15]?.pressed) held.add('right');
    for (const name of held) if (!paused() && !padHeld.has(name)) press(name);
    padHeld = held;
    const settings=getSettings(),dead = v => inputAxis(v,settings);
    return { x: dead(gamepad.axes[0] || 0), y: -dead(gamepad.axes[1] || 0), held };
  }

  // { sx, sy } is the screen stick (right, up); g and b are held; counters count presses.
  function read() {
    const p = pad(), on = (name) => keys.has(name) || touch.has(name) || p.held.has(name) || mouse.has(name);
    if (paused()) { keys.clear(); touch.clear(); mouse.clear(); return { sx: 0, sy: 0, g: false, b: false, ...counts }; }
    const sx = Number(on('right')) - Number(on('left')) + p.x, sy = Number(on('up')) - Number(on('down')) + p.y;
    return { sx: Math.max(-1, Math.min(1, sx)), sy: Math.max(-1, Math.min(1, sy)), g: on('golpe'), b: on('cubrir'), ...counts };
  }
  return { read, press, clear: () => { keys.clear(); touch.clear(); mouse.clear(); } };
}
