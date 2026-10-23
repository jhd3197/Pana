import { holdButton, drawIcons } from '/engine/touch.js';
import { toggleMute } from '/engine/ui.js';
const BINDINGS = { a: 'left', d: 'right', w: 'up', s: 'down', arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down', ' ': 'jump', j: 'attack', k: 'special', shift: 'shield', l: 'grab', i: 'grab' };
export function createControls(menu) {
  const keys = new Set(), touch = new Set(), taps = {};
  const active = a => [...keys].some(k => BINDINGS[k] === a) || touch.has(a);
  const down = e => {
    if (menu.isOpen || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const key = e.key.toLowerCase(), a = BINDINGS[key];
    if (key === 'm' && !e.repeat) toggleMute();
    if (!a) return;
    e.preventDefault();
    if (!keys.has(key) && !active(a)) taps[a] = ((taps[a] ?? 0) + 1) >>> 0;
    keys.add(key);
  };
  const up = e => keys.delete(e.key.toLowerCase());
  const clear = () => { keys.clear(); touch.clear(); };
  addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', clear);
  drawIcons();
  for (const a of ['up', 'down', 'left', 'right', 'jump', 'attack', 'special', 'shield', 'grab']) {
    holdButton(document.getElementById(a), { down: () => { if (!active(a)) taps[a] = ((taps[a] ?? 0) + 1) >>> 0; touch.add(a); }, up: () => touch.delete(a), paused: () => menu.isOpen });
  }
  return {
    read() {
      const held = menu.isOpen ? [] : Object.values(BINDINGS).filter((a, i, all) => all.indexOf(a) === i && active(a));
      return { held, taps: { ...taps }, x: Number(held.includes('right')) - Number(held.includes('left')), y: Number(held.includes('up')) - Number(held.includes('down')) };
    },
    dispose() { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', clear); },
  };
}
