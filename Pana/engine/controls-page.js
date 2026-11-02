// The "Instrucciones" page of the shared pause menu (engine/ui.js): the goal,
// how to play, the controls and a few tips, for the device the player is
// using. Instructions never go on the HUD; this page is where they live.
//
// A game declares them as data in public/instructions.js, next to its
// index.html. The menu imports that file the first time the page opens:
//
//   import { loc } from '/engine/i18n.js';
//   export default {
//     goal: loc('Llega primero a la meta.'),
//     howTo: [loc('Cada vuelta suma…')],                 // short paragraphs
//     sections: [{ title: loc('Moverte'), rows: [
//       { action: loc('Caminar'), keyboard: 'W A S D / Flechas', gamepad: 'Stick izq.', touch: loc('Joystick') },
//       { action: loc('Saltar'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Saltar') },
//     ] }],
//     tips: [loc('…')],
//   };
//
// Keys: alternatives are separated by " / "; each alternative is one keycap.
// Gamepad keys use Xbox names (A, B, X, Y, LB, RT, Stick izq., Cruceta…) and
// show the connected pad's own names (formatPadLabel: Cruz, Círculo… on a
// PlayStation pad). A key of null (or a missing one) leaves that row out on
// that device. When no row names a gamepad key, the page shows the rows the
// menu's `pad` setup produces (padHelp) instead.
import { loc } from './i18n.js';

export const DEVICES = ['keyboard', 'gamepad', 'touch'];
export const deviceLabel = device => ({ keyboard: loc('Ratón y teclado'), gamepad: loc('Mando'), touch: loc('Pantalla táctil') })[device] || device;

const text = value => typeof value === 'string' ? value.trim() : '';
const list = value => (Array.isArray(value) ? value : value ? [value] : []).map(text).filter(Boolean);
const key = value => value == null ? null : text(String(value)) || null;

// The instructions with every optional part filled in and empty parts gone.
export function normalizeInstructions(data) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    goal: text(source.goal),
    howTo: list(source.howTo),
    sections: (Array.isArray(source.sections) ? source.sections : []).map(section => ({
      title: text(section?.title),
      rows: (Array.isArray(section?.rows) ? section.rows : []).filter(row => text(row?.action))
        .map(row => ({ action: text(row.action), keyboard: key(row.keyboard), gamepad: key(row.gamepad), touch: key(row.touch) })),
    })).filter(section => section.rows.length),
    tips: list(source.tips),
  };
}

// The instructions a menu built only from createGameMenu's older options
// (controls: [[keys, action]], tips) still shows.
export function fromLegacy({ controls = [], tips = [] } = {}) {
  const rows = controls.filter(row => Array.isArray(row) && row[1]).map(([keys, action]) => ({ action, keyboard: keys }));
  return normalizeInstructions({ sections: rows.length ? [{ title: loc('Controles'), rows }] : [], tips });
}

// The key a row shows on a device, or null when it has none there.
export function rowKey(row, device, format = value => value) {
  const value = row?.[DEVICES.includes(device) ? device : 'keyboard'];
  if (value == null || value === '') return null;
  return device === 'gamepad' ? format(value) : value;
}

// The sections a device shows: [{ title, rows: [{ action, key }] }], rows
// without a key there left out. padRows ([[button, action]], from padHelp)
// stand in on a gamepad when the data names no buttons.
export function sectionsFor(data, device, { format = value => value, padRows = [] } = {}) {
  const shown = data.sections.map(section => ({ title: section.title,
    rows: section.rows.map(row => ({ action: row.action, key: rowKey(row, device, format) })).filter(row => row.key !== null) }))
    .filter(section => section.rows.length);
  if (device === 'gamepad' && !shown.length && padRows.length)
    return [{ title: loc('Con mando'), rows: padRows.map(([button, action]) => ({ action, key: format(button) })) }];
  return shown;
}

// The devices worth a button on the page: those with at least one row, plus
// the one in use (so it always has a view, even an empty one).
export function devicesFor(data, current, { padRows = [] } = {}) {
  return DEVICES.filter(device => device === current || sectionsFor(data, device, { padRows }).length);
}

// ---------- the page (browser only) ----------

function h(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}
// "W A S D / Flechas" → a keycap per alternative, " / " between them.
function caps(value, device) {
  if (device === 'touch') return [h('span', 'pana-help-touch', value)];
  return value.split(' / ').flatMap((part, i) => {
    const cap = h('kbd', '', part);
    if (device === 'gamepad') cap.dataset.padKey = '';
    return i ? [h('span', 'pana-help-or', '/'), cap] : [cap];
  });
}

// Loads a game's declared instructions: an object, a function returning one
// (or a promise), or the URL of a module whose default export is either.
export async function loadInstructions(source) {
  let value = typeof source === 'function' ? await source() : source;
  if (typeof value === 'string' || value instanceof URL) value = (await import(String(value))).default;
  if (typeof value === 'function') value = await value();
  return value && typeof value === 'object' ? value : null;
}

// Fills `panel` with the page. Options: instructions (see loadInstructions),
// legacy ({ controls, tips } from createGameMenu, used when the game has no
// instructions file), pad (the menu's pad setup, for padHelp).
export function mountControlsPage(panel, { instructions, legacy = {}, pad } = {}) {
  let data = null, device = 'keyboard', family = 'xbox', chosen = null, gamepad = null, stop = null;
  const body = h('div', 'pana-help');
  panel.classList.add('pana-help-panel');
  panel.replaceChildren(body);
  const padRows = () => gamepad && pad ? gamepad.padHelp(pad) : [];
  const format = value => gamepad ? gamepad.formatPadLabel(value, family) : value;

  function draw() {
    if (!data) return;
    const view = chosen || device;
    const devices = devicesFor(data, device, { padRows: padRows() });
    const switcher = h('div', 'pana-help-devices');
    switcher.setAttribute('role', 'radiogroup'); switcher.setAttribute('aria-label', loc('Controles para'));
    for (const d of devices) {
      const button = h('button', '', deviceLabel(d));
      button.type = 'button'; button.setAttribute('role', 'radio'); button.dataset.helpDevice = d;
      button.setAttribute('aria-checked', String(d === view)); button.tabIndex = d === view ? 0 : -1;
      button.onclick = () => { chosen = d; draw(); body.querySelector(`[data-help-device="${d}"]`)?.focus(); };
      switcher.append(button);
    }
    switcher.onkeydown = event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]; if (!step) return;
      event.preventDefault();
      const next = devices[(devices.indexOf(view) + step + devices.length) % devices.length];
      switcher.querySelector(`[data-help-device="${next}"]`)?.click();
    };

    const about = h('div', 'pana-help-about');
    if (data.goal) about.append(h('h3', 'pana-help-title', loc('Objetivo')), h('p', 'pana-help-goal', data.goal));
    if (data.howTo.length) about.append(h('h3', 'pana-help-title', loc('Cómo se juega')), ...data.howTo.map(line => h('p', 'pana-help-copy', line)));
    if (data.tips.length) {
      const tips = h('ul', 'pana-help-tips');
      for (const tip of data.tips) tips.append(h('li', '', tip));
      about.append(h('h3', 'pana-help-title', loc('Consejos')), tips);
    }

    const controls = h('div', 'pana-help-controls');
    controls.dataset.device = view;
    controls.append(switcher);
    const sections = sectionsFor(data, view, { format, padRows: padRows() });
    for (const section of sections) {
      const rows = h('div', 'pana-help-rows'); rows.setAttribute('role', 'list');
      for (const row of section.rows) {
        const item = h('div', 'pana-help-row'); item.setAttribute('role', 'listitem');
        const keys = h('span', 'pana-help-keys'); keys.append(...caps(row.key, view));
        item.append(h('span', 'pana-help-action', row.action), keys);
        rows.append(item);
      }
      controls.append(...(section.title ? [h('h3', 'pana-help-title', section.title)] : []), rows);
    }
    if (!sections.length) controls.append(h('p', 'pana-help-copy', view === 'touch'
      ? loc('Usa los botones y el joystick que aparecen en la pantalla del juego.')
      : loc('Este juego no usa controles especiales con este dispositivo.')));
    body.replaceChildren(...(about.childElementCount ? [about] : []), controls);
    body.classList.toggle('is-single', !about.childElementCount);
  }

  const ready = Promise.all([
    loadInstructions(instructions).catch(() => null),
    import('./gamepad.js').catch(() => null),
  ]).then(([declared, module]) => {
    data = declared ? normalizeInstructions(declared) : fromLegacy(legacy);
    gamepad = module;
    if (module) stop = module.onInputDevice(state => {
      if (state.device !== device) chosen = null;   // a new device in hand: show its controls
      device = state.device; family = state.family; draw();
    });
    draw();
    panel.dataset.ready = '';
    return data;
  });

  return {
    ready,
    refresh: draw,
    get device() { return chosen || device; },
    dispose() { stop?.(); },
  };
}
