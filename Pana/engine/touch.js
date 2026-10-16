// On-screen touch controls and screen orientation, shared by every game.
//
//   <button class="pk-touch" data-icon="left" aria-label="Girar a la izquierda"></button>
//   <button class="pk-touch pk-touch--go" aria-label="Acelerar">Gas</button>
//
//   import { holdButton } from '/engine/touch.js';
//   holdButton(button, { down: () => held.add('a'), up: () => held.delete('a'), paused: () => paused });
//
// Direction and jump buttons get a drawn icon from ICONS (glyphs like ◀ ▲ turn into emoji on some
// phones); action buttons keep a short word. Styles live in kit.css under "touch controls".
// Orientation: createGameMenu({ orientation: 'horizontal' }) calls guardOrientation for the game's
// default, and the player can change it in Ajustes (settings.js `orientation`).

import { getSettings, onSettings, setSettings } from './settings.js';

const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const arrow = d => svg(`<path d="${d}" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>`);

export const ICONS = {
  left: arrow('M16.5 4.5v15L6 12z'),
  right: arrow('M7.5 4.5v15L18 12z'),
  up: arrow('M4.5 16.5h15L12 6z'),
  down: arrow('M4.5 7.5h15L12 18z'),
  jump: svg('<path d="M12 3.5 19 11h-4.2v5.2H9.2V11H5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M5.5 20.5h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
};

const TOUCH = matchMedia('(pointer: coarse)');

// Fills every [data-icon] touch button under `root` with its icon (idempotent).
export function drawIcons(root = document) {
  for (const button of root.querySelectorAll('.pk-touch[data-icon]')) {
    if (button.querySelector('svg') || !ICONS[button.dataset.icon]) continue;
    button.insertAdjacentHTML('afterbegin', ICONS[button.dataset.icon]);
  }
}

// A button that is held, not clicked: `down` when a finger lands, `up` when it lifts, slides off
// the screen or the browser takes the touch. Each finger is tracked by its pointer, so steering and
// the gas can be held together. A short buzz confirms the press where phones allow it.
export function holdButton(button, { down, up, paused = () => false, buzz = true } = {}) {
  const fingers = new Set();
  const release = e => {
    if (!fingers.delete(e.pointerId)) return;
    if (!fingers.size) { button.classList.remove('is-held'); up?.(e); }
  };
  button.addEventListener('pointerdown', e => {
    if (paused()) return;
    e.preventDefault();
    try { button.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ }
    const first = !fingers.size;
    fingers.add(e.pointerId);
    if (first) {
      button.classList.add('is-held');
      if (buzz && e.pointerType === 'touch') navigator.vibrate?.(8);
      down?.(e);
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  button.addEventListener('contextmenu', e => e.preventDefault());
  return {
    release() { if (fingers.size) { fingers.clear(); button.classList.remove('is-held'); up?.(); } },
    get held() { return fingers.size > 0; },
  };
}

// Long-presses on the controls must never open the copy/share callout or select the words.
addEventListener('contextmenu', e => { if (e.target.closest?.('.pk-touch, .pk-touch-zone')) e.preventDefault(); }, true);
addEventListener('selectstart', e => { if (e.target.closest?.('.pk-touch, .pk-touch-zone')) e.preventDefault(); }, true);
drawIcons();
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => drawIcons(), { once: true });

// ---------- orientation ----------

export const ORIENTATIONS = { horizontal: 'Horizontal', vertical: 'Vertical' };
const PORTRAIT = matchMedia('(orientation: portrait)');
let guarded = false;

// The orientation this game should be played in: the player's choice, else the game's own.
export function wantedOrientation(gameDefault) {
  const choice = getSettings().orientation;
  return choice === 'juego' ? gameDefault : choice;
}

// On a phone held the other way, a "turn your phone" screen. On Android it can also go full screen
// and lock the orientation (that needs a tap); iOS Safari cannot lock, so there it only asks.
// "Jugar así" lets the player keep going as they are until they leave the page.
export function guardOrientation(gameDefault = 'libre') {
  if (guarded) return;
  guarded = true;
  let dismissed = false, overlay = null;
  const canLock = !!(document.documentElement.requestFullscreen && screen.orientation?.lock);

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'pana-rotate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pana-rotate-title');
    overlay.innerHTML = `
      <div class="pana-rotate-card">
        <svg class="pana-rotate-phone" viewBox="0 0 64 64" aria-hidden="true">
          <rect x="20" y="8" width="24" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/>
          <path d="M29 46h6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <h2 id="pana-rotate-title"></h2>
        <p></p>
        <div class="pana-rotate-actions">
          ${canLock ? '<button type="button" class="pk-btn pk-btn--primary" data-act="lock">Pantalla completa</button>' : ''}
          <button type="button" class="pk-btn pk-btn--ghost" data-act="stay">Jugar así</button>
        </div>
      </div>`;
    overlay.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'stay') { dismissed = true; update(); }
      if (act === 'lock') {
        const wanted = wantedOrientation(gameDefault);
        try {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          await screen.orientation.lock(wanted === 'horizontal' ? 'landscape' : 'portrait');
        } catch { dismissed = true; }
        update();
      }
    });
    document.body.append(overlay);
  }

  function update() {
    const wanted = wantedOrientation(gameDefault);
    document.documentElement.dataset.panaOrientation = wanted;
    const wrongWay = (wanted === 'horizontal' && PORTRAIT.matches) || (wanted === 'vertical' && !PORTRAIT.matches);
    const show = TOUCH.matches && wrongWay && !dismissed;
    if (show && !overlay && document.body) build();
    if (!overlay) return;
    overlay.hidden = !show;
    overlay.classList.toggle('to-landscape', wanted === 'horizontal');
    overlay.querySelector('h2').textContent = 'Gira tu teléfono';
    overlay.querySelector('p').textContent = wanted === 'horizontal'
      ? 'Este juego se ve mejor en horizontal. Puedes cambiarlo en Ajustes.'
      : 'Elegiste jugar en vertical. Puedes cambiarlo en Ajustes.';
  }

  PORTRAIT.addEventListener('change', () => { dismissed = false; update(); });
  TOUCH.addEventListener('change', update);
  onSettings((s, changed) => { if (changed.includes('orientation')) { dismissed = false; update(); } });
  if (document.body) update(); else addEventListener('DOMContentLoaded', update, { once: true });
}

// For the hub and tests: forget a "Jugar así" and choose again.
export function setOrientation(value) { setSettings({ orientation: value }); }
export const isTouch = () => TOUCH.matches;
