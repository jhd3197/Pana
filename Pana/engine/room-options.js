import { icon } from './icons.js';
import { isRoomFieldVisible } from './room-option-fields.js';
import { loc, locn } from './i18n.js';
const panels = new WeakMap();

// Existing map/camera/help controls keep their handlers and authoritative state.
// Entry calls this after the game has created them, before exposing the lobby.
export function finalizeRoomOptions(lobby) {
  const container = lobby?.querySelector('.pk-room-primary')?.parentElement;
  panels.get(container)?.adopt(lobby);
}

// "W A S D / ↑ ↓" → one <kbd> per key, " / " between alternatives (like the pause menu).
function keycaps(keys) {
  return String(keys).split(' / ').flatMap((group, i) => [i ? ' / ' : null, ...group.split(' ').filter(Boolean).map(k => {
    const kbd = document.createElement('kbd'); kbd.className = 'pk-kbd'; kbd.textContent = k; return kbd;
  })]).filter(Boolean);
}

// Room choices use each game's existing authoritative action/snapshot flow.
// This component owns presentation only; values are never updated optimistically.
// `help` ({ controls, tips, title } or a function returning it, the same arrays
// createGameMenu takes) turns the adopted [data-room-help] button into a layer
// inside the dialog; without it the button closes the dialog as before.
export function createRoomOptions(container, { title, fields, change, reset, help = null }) {
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const primary = make('div', 'pk-room-primary');
  const more = make('button', 'pk-room-more'); more.type = 'button'; more.id = 'pana-room-more';
  const count = make('small', ''); more.append(icon('gear'), make('span', '', loc('Más ajustes')), count, icon('chevronRight'));
  const dialog = make('dialog', 'pk-room-dialog'); dialog.id = 'pana-room-dialog'; dialog.setAttribute('aria-labelledby', 'pana-room-title');
  const heading = make('div', 'pk-room-heading'), names = make('div', 'pk-room-names');
  const name = make('h2', 'pk-room-title', title); name.id = 'pana-room-title';
  names.append(make('span', 'pk-eyebrow', loc('Más ajustes')), name);
  const notice = make('p', 'pk-room-notice'), close = make('button', 'pk-btn pk-room-close'); close.type = 'button'; close.setAttribute('aria-label', loc('Cerrar ajustes')); close.append(icon('close'));
  heading.append(names, notice, close);
  // Schema fields first, then adopted extras (map, bot aim, roles…) as cards of the same grid.
  const grid = make('div', 'pk-room-grid'), foot = make('div', 'pk-room-footer'), links = make('div', 'pk-room-links');
  const restore = make('button', 'pk-btn pk-room-reset', loc('Restablecer sala')), done = make('button', 'pk-btn pk-btn--primary pk-room-done', loc('Listo'));
  restore.type = done.type = 'button'; restore.id = 'pana-room-reset'; done.id = 'pana-room-done';
  const layer = make('section', 'pk-room-help'); layer.id = 'pana-room-help'; layer.hidden = true; layer.setAttribute('aria-labelledby', 'pana-room-help-title');
  foot.append(restore, links, done); dialog.append(heading, grid, layer, foot); document.body.append(dialog);
  container.append(primary, more);
  let enabled = false, values = {}, previousFocus, helpFocus, extraCount = 0;
  const controls = fields.map(field => {
    const group = make('fieldset', 'pk-room-field'), legend = make('legend', '', field.label), choices = make('div', 'pk-seg');
    choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', field.label);
    const buttons = field.choices.map(([value, label]) => {
      const button = make('button', '', label); button.type = 'button'; button.dataset.roomOption = field.id; button.dataset.value = String(value);
      button.addEventListener('click', () => { if (enabled) change({ [field.id]: value }); });
      choices.append(button); return { button, value };
    });
    group.append(legend, choices); (field.advanced ? grid : primary).append(group);
    return { field, group, buttons };
  });
  const advanced = fields.filter(f => f.advanced); more.hidden = !advanced.length;
  function updateCount() {
    const applicable = advanced.filter(f => isRoomFieldVisible(f, values));
    const changed = applicable.filter(f => values[f.id] !== f.default).length;
    const total = applicable.length + extraCount;
    count.textContent = changed ? locn(changed, '{n} cambio', '{n} cambios') : locn(total, '{n} opción', '{n} opciones');
    more.hidden = !applicable.length && !extraCount && !links.children.length;
  }
  panels.set(container, { adopt(lobby) {
    for (const node of lobby.querySelectorAll('[data-room-primary]')) primary.prepend(node);
    for (const node of lobby.querySelectorAll('[data-room-extra], [data-room-help]')) {
      if (node.closest('[data-pana-roster]')) continue;
      if (node.matches('[data-room-help]')) links.append(node);
      else { node.classList.add('pk-room-card'); grid.append(node); extraCount++; }
    }
    // The settings panel always ends with the single advanced-settings entry.
    lobby.append(container);
    updateCount();
  } });

  function list(cls, label, nodes) {
    const box = make('div', cls); box.append(make('span', 'pk-eyebrow', label), ...nodes); return box;
  }
  function openHelp(trigger) {
    const data = (typeof help === 'function' ? help() : help) || {};
    const back = make('button', 'pk-btn pk-room-back'); back.type = 'button'; back.append(icon('chevronLeft'), make('span', '', loc('Volver')));
    back.addEventListener('click', closeHelp);
    const head = make('div', 'pk-room-help-head'), heading = make('h3', '', data.title || trigger?.textContent.trim() || loc('Cómo se juega'));
    heading.id = 'pana-room-help-title'; head.append(back, heading);
    const body = make('div', 'pk-room-help-body');
    if (data.controls?.length) {
      const keys = make('dl', 'pk-room-keys');
      for (const [caps, text] of data.controls) { const dt = make('dt', ''), dd = make('dd', '', text); dt.append(...keycaps(caps)); keys.append(dt, dd); }
      body.append(list('pk-room-help-keys', loc('Teclado'), [keys]));
    }
    if (data.tips?.length) {
      const tips = make('ul', 'pk-room-tips'); for (const tip of data.tips) tips.append(make('li', '', tip));
      body.append(list('pk-room-help-tips', loc('Consejos de juego'), [tips]));
    }
    layer.replaceChildren(head, body);
    helpFocus = trigger; layer.hidden = false; dialog.classList.add('is-help'); layer.scrollTop = 0; back.focus({ preventScroll: true });
  }
  function closeHelp() {
    if (layer.hidden) return;
    layer.hidden = true; dialog.classList.remove('is-help'); layer.replaceChildren();
    helpFocus?.focus({ preventScroll: true }); helpFocus = null;
  }
  function closeDialog() { closeHelp(); if (dialog.open) dialog.close(); previousFocus?.focus({ preventScroll: true }); }
  // A help button with a help renderer opens the layer and never reaches the
  // game's own handler (capture phase); without one the dialog steps aside.
  links.addEventListener('click', event => {
    const trigger = event.target.closest('[data-room-help] button, button[data-room-help]');
    if (!trigger) return;
    if (help) { event.preventDefault(); event.stopPropagation(); openHelp(trigger); } else closeDialog();
  }, true);
  more.addEventListener('click', () => { previousFocus = document.activeElement; dialog.showModal(); close.focus(); });
  for (const button of [close, done]) button.addEventListener('click', closeDialog);
  restore.addEventListener('click', () => { if (enabled) reset(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (layer.hidden) closeDialog(); else closeHelp(); });
  // Chrome may close a modal on a second Escape without a cancel event.
  dialog.addEventListener('close', () => { if (!layer.hidden) closeHelp(); });
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    // Escape steps back out of the help layer before it closes the dialog.
    if (event.key === 'Escape' && !layer.hidden) { event.preventDefault(); closeHelp(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  });
  return {
    get isOpen() { return dialog.open; },
    get helpOpen() { return !layer.hidden; },
    close: closeDialog,
    update(next, mayEdit) {
      values = next; enabled = mayEdit;
      updateCount();
      notice.textContent = enabled ? loc('Tus panas ven los cambios al momento.') : loc('El anfitrión elige los ajustes de la sala.');
      restore.disabled = !enabled;
      for (const { field, group, buttons } of controls) {
        group.hidden = !isRoomFieldVisible(field, values);
        group.classList.toggle('is-changed', values[field.id] !== field.default);
        for (const { button, value } of buttons) { button.disabled = !enabled || group.hidden; button.setAttribute('aria-pressed', String(values[field.id] === value)); }
      }
    },
    dispose() { panels.delete(container); dialog.remove(); primary.remove(); more.remove(); },
  };
}
