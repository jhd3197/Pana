// Out of the round in Pepazo: who you watch and how to switch. The camera work
// is engine/play/spectate.js through scene.js; this file picks who may be
// watched, reads the keys, buttons and pad, and keeps the small square label.
//
// Only what every client already gets from the room is used: positions and
// aim. In team rounds the dead watch their own team (rivals only when no
// teammate is standing), so watching never shows where rivals hide.
import { createSpectator } from '/engine/play/spectate.js';
import { mountControlHints, keyFor } from '/engine/control-hints.js';
import { holdButton } from '/engine/touch.js';
import { icon } from '/engine/icons.js';
import { loc } from '/engine/i18n.js';
import { teamPlay } from './options.js';

export const KILLCAM = 1.6;
const PREV = { keyboard: 'Q', gamepad: 'LB', touch: null }, NEXT = { keyboard: 'E', gamepad: 'RB', touch: null }, VIEW = { keyboard: loc('Espacio'), gamepad: 'A', touch: null };

export function createSpectateHud(doc, { enabled = () => true } = {}) {
  const $ = id => doc.getElementById(id), spectator = createSpectator({ killcam: KILLCAM }), targets = [];
  const bar = $('spectate'), label = $('spectate-name'), swatch = $('spectate-swatch'), keys = [...bar.querySelectorAll('[data-key]')];
  const hints = mountControlHints($('spectate-hints'), { game: 'pintura:spectate', timeout: 9000, hints: [
    { id: 'spectate-cycle', label: loc('cambiar de pana'), keys: { keyboard: 'Q / E', gamepad: 'LB / RB', touch: null } },
    { id: 'spectate-view', label: loc('cancha desde arriba'), keys: { keyboard: VIEW.keyboard, gamepad: 'A', touch: null } }] });
  $('spectate-prev').prepend(icon('chevronLeft')); $('spectate-next').append(icon('chevronRight')); $('spectate-view').prepend(icon('camera'));
  let device = '';
  const press = action => { if (!spectator.active) return false; if (action === 'view') { spectator.toggle(); hints.done('spectate-view'); } else { spectator[action](); hints.done('spectate-cycle'); } return true; };
  const pads = [['spectate-prev', 'prev'], ['spectate-next', 'next'], ['spectate-view', 'view']].map(([id, action]) => holdButton($(id), { down: () => press(action), up: () => {}, paused: () => !spectator.active }));

  // Living panas that may be watched, in seat order, into one reused list.
  function fill(state, me) {
    targets.length = 0;
    const teams = teamPlay(state.options);
    for (const p of state.players) if (p.id !== me.id && p.connected && !(p.respawn > 0) && !p.eliminated && (!teams || p.team === me.team)) targets.push(p.id);
    if (teams && !targets.length) for (const p of state.players) if (p.id !== me.id && p.connected && !(p.respawn > 0) && !p.eliminated) targets.push(p.id);
  }
  const byId = (state, id) => { for (const p of state.players) if (p.id === id) return p; return null; };
  // The label and key chips change only when the target, the shot or the device does.
  let lastTarget, lastShot, lastName, lastMode;
  function draw(state) {
    const mode = spectator.mode, shot = spectator.shot, p = mode === 'watch' ? byId(state, spectator.target) : null, name = p?.name ?? null;
    const now = doc.documentElement.dataset.panaInput || 'keyboard';
    if (mode === lastMode && shot === lastShot && spectator.target === lastTarget && name === lastName && now === device) return;
    lastMode = mode; lastShot = shot; lastTarget = spectator.target; lastName = name; device = now;
    const follow = shot === 'follow' && !!p;
    bar.hidden = mode !== 'watch'; label.textContent = mode !== 'watch' ? '' : follow ? loc('Observando a {name}', { name }) : loc('Cancha desde arriba');
    swatch.style.background = follow ? p.color : ''; bar.dataset.shot = mode === 'watch' ? shot : 'off';
    for (const node of keys) { const key = keyFor(node.dataset.key === 'prev' ? PREV : node.dataset.key === 'next' ? NEXT : VIEW); node.textContent = key || ''; node.hidden = !key; }
  }
  const input = { down: false, killer: null, targets };
  return {
    spectator,
    // Every frame: out or not, who to watch, the label. killer: the id that got you.
    update(dt, state, id, killer) {
      const me = state.phase === 'playing' ? byId(state, id) : null;
      input.down = !!me && enabled() && (me.respawn > 0 || !!me.eliminated); input.killer = killer === id ? null : killer ?? null;
      if (me) fill(state, me); else targets.length = 0;
      const before = spectator.mode, mode = spectator.update(dt, input);
      if (mode === 'watch' && before !== 'watch') hints.show(); else if (mode === 'off' && before !== 'off') hints.hide();
      doc.body.classList.toggle('spectating', mode === 'watch');
      draw(state);
    },
    // Q / E or ← / → switch pana and Space the view; a controller's LB / RB and A arrive as
    // the keys engine/gamepad.js types for them (Shift, G and Space). True when used.
    key(event) {
      if (!spectator.active || !enabled() || event.repeat) return false;
      const key = event.key.toLowerCase(), pad = !event.isTrusted;
      const action = key === 'q' || key === 'arrowleft' || (pad && event.code === 'ShiftLeft') ? 'prev' : key === 'e' || key === 'arrowright' || (pad && event.code === 'KeyG') ? 'next' : key === ' ' ? 'view' : null;
      if (!action) return false;
      event.preventDefault(); return press(action);
    },
    hints,
    dispose() { hints.dispose(); pads.forEach(p => p.release?.()); },
  };
}
