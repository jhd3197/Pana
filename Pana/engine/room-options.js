import { icon } from './icons.js';

const panels = new WeakMap();

// Existing map/camera/help controls keep their handlers and authoritative state.
// Entry calls this after the game has created them, before exposing the lobby.
export function finalizeRoomOptions(lobby) {
  const container = lobby?.querySelector('.pk-room-primary')?.parentElement;
  panels.get(container)?.adopt(lobby);
}

// Room choices use each game's existing authoritative action/snapshot flow.
// This component owns presentation only; values are never updated optimistically.
export function createRoomOptions(container, { title, fields, change, reset }) {
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const primary = make('div', 'pk-room-primary');
  const more = make('button', 'pk-room-more'); more.type = 'button'; more.id = 'pana-room-more';
  const count = make('small', ''); more.append(icon('gear'), make('span', '', 'Más ajustes'), count, icon('chevronRight'));
  const dialog = make('dialog', 'pk-room-dialog'); dialog.id = 'pana-room-dialog'; dialog.setAttribute('aria-labelledby', 'pana-room-title');
  const heading = make('div', 'pk-room-heading'), names = make('div', '');
  const name = make('h2', 'pk-title', title); name.id = 'pana-room-title';
  names.append(make('p', 'pk-eyebrow', 'Más ajustes'), name);
  const notice = make('p', 'pk-copy'), close = make('button', 'pk-btn pk-room-close'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar ajustes'); close.append(icon('close'));
  heading.append(names, notice, close);
  const grid = make('div', 'pk-room-grid'), extras = make('div', 'pk-room-extras'), foot = make('div', 'pk-room-footer');
  const restore = make('button', 'pk-btn', 'Restablecer'), done = make('button', 'pk-btn pk-btn--primary pk-btn--lg', 'Listo');
  restore.type = done.type = 'button'; restore.id = 'pana-room-reset'; done.id = 'pana-room-done';
  foot.append(restore, done); dialog.append(heading, grid, extras, foot); document.body.append(dialog);
  container.append(primary, more);
  let enabled = false, values = {}, previousFocus, extraCount = 0;
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
    const changed = advanced.filter(f => values[f.id] !== f.default).length;
    count.textContent = changed ? `${changed} ${changed === 1 ? 'cambio' : 'cambios'}` : `${advanced.length + extraCount} opciones`;
    more.hidden = !advanced.length && !extras.children.length;
  }
  panels.set(container, { adopt(lobby) {
    for (const node of lobby.querySelectorAll('[data-room-primary]')) primary.prepend(node);
    for (const node of lobby.querySelectorAll('[data-room-extra], [data-room-help]')) {
      if (node.closest('[data-pana-roster]')) continue;
      extras.append(node);
    }
    extraCount = extras.querySelectorAll('[data-room-extra]').length;
    // The settings panel always ends with the single advanced-settings entry.
    lobby.append(container);
    updateCount();
  } });
  function closeDialog() { dialog.close(); previousFocus?.focus({ preventScroll: true }); }
  extras.addEventListener('click', event => {
    if (event.target.closest('[data-room-help] button, button[data-room-help]')) closeDialog();
  }, true);
  more.addEventListener('click', () => { previousFocus = document.activeElement; dialog.showModal(); close.focus(); });
  for (const button of [close, done]) button.addEventListener('click', closeDialog);
  restore.addEventListener('click', () => { if (enabled) reset(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
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
    close: closeDialog,
    update(next, mayEdit) {
      values = next; enabled = mayEdit;
      updateCount();
      notice.textContent = enabled ? 'Tus panas ven los cambios al momento.' : 'El anfitrión elige los ajustes de la sala.';
      restore.disabled = !enabled;
      for (const { field, group, buttons } of controls) {
        group.classList.toggle('is-changed', values[field.id] !== field.default);
        for (const { button, value } of buttons) { button.disabled = !enabled; button.setAttribute('aria-pressed', String(values[field.id] === value)); }
      }
    },
    dispose() { panels.delete(container); dialog.remove(); primary.remove(); more.remove(); },
  };
}
