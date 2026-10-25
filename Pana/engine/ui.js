// The pause menu, settings and invite flow shared by every Pana game (and the
// hub's settings dialog). Games keep their own HUD and decide what pausing
// means; this module owns the dialog, Esc, focus, and the saved settings.
//
//   const menu = createGameMenu({ title: 'Cocina', sound, controls, onOpen, onClose });
//   nav.append(menu.createButton({ id: 'menu' }));
//
// See docs/knowledge/pana-ui.md for the full option list.

import { getSettings, setSettings, onSettings, bindSound, QUALITY } from './settings.js';
import { ORIENTATIONS, guardOrientation, isTouch } from './touch.js';
import { icon } from './icons.js';
import './navigation.js';

// From next to this module, so a versioned copy (pana.sh's /_v/<version>/engine/) loads its own kit.
for (const name of ['kit.css', 'ui.css']) {
  if (document.querySelector(`link[href*="/engine/${name}"]`)) continue;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL(name, import.meta.url).pathname;
  document.head.append(link);
}
// [data-pana-hint] marks keyboard reminders the player can hide in Ajustes.
onSettings(s => document.documentElement.classList.toggle('pana-no-hints', !s.hints));

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
  return node;
}

// "W A S D / ↑ ↓" → one <kbd> per key, with " / " between alternatives.
// Pad buttons have spaces in their names ("Stick izq."): one <kbd> per group.
function keycaps(keys, whole = false) {
  return keys.split(' / ').flatMap((group, i) => [i ? ' / ' : null, ...(whole ? [group] : group.split(' ')).map(k => h('kbd', { text: k, 'data-pad-key': whole }))]).filter(Boolean);
}

let toastNode, toastTimer;
function defaultNotify(text) {
  toastNode ??= document.body.appendChild(h('div', { class: 'pana-toast', role: 'status', 'aria-live': 'polite' }));
  toastNode.textContent = text; toastNode.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3000);
}

let menuCount = 0;

export function createGameMenu({
  title = 'Pana',             // game name, shown above the heading
  heading = 'Un momentico',   // headline while paused
  note,                       // () => string: what pausing means right now
  controls = [],              // [['W A S D', 'Moverte'], …] for keyboard instructions
  tips = [],                  // extra lines under the controls
  actions = [],               // [{ id, label, run, kind, visible, keepOpen }]
  options = [],               // game settings: [{ id, label, choices: [[value, label]], get, set }]
  sound,                      // the fx.js sound object; follows the saved settings
  invite,                     // () => link to share; adds the invite buttons
  notify = defaultNotify,     // in-game toast for "link copied"
  resumeLabel = 'Seguir jugando',
  exitHref = '/',
  exitLabel = 'Salir a Pana',
  hotkey = true,              // Esc opens and closes the menu
  canOpen = () => true,
  onOpen, onClose,
  pause = true,               // false: a plain settings dialog (used by the hub)
  orientation = 'libre',      // phones: 'horizontal', 'vertical' or 'libre' (either works)
  pad,                        // game controller setup, see engine/gamepad.js
} = {}) {
  // Loaded only for a game that sets up a pad, to keep the others' first load small.
  const padRows = h('div', { hidden: true });
  const padHint = h('p', { class: 'pana-menu-pad-hint', hidden: true });
  import('./gamepad.js').then(({ padControls, padHelp, onInputDevice, formatPadLabel }) => {
    if (pad && pause) padControls(pad);
    onInputDevice(state => {
      const rows = padHelp(pad).map(([key, label]) => [formatPadLabel(key, state.family), label]);
      padRows.replaceChildren(h('h3', { class: 'pana-keys-title', text: 'Con mando' }), keyList(rows, true));
      padRows.hidden = state.device !== 'gamepad';
      keyboardRows.hidden = state.device !== 'keyboard';
      touchHelp.hidden = state.device !== 'touch';
      padHint.hidden = state.device !== 'gamepad';
      padHint.textContent = `${formatPadLabel('A', state.family)} · Elegir    ${formatPadLabel('B', state.family)} · Volver${pause ? `    ${formatPadLabel('LB / RB', state.family)} · Secciones` : ''}`;
    });
  });
  const uid = menuCount++ ? `-${menuCount}` : '';
  const id = name => `pana-${name}${uid}`;
  if (sound) {
    bindSound(sound);
    // Browsers only start audio after a gesture: the first one unlocks it.
    for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => sound.unlock(), { capture: true, once: true });
    if (!sound._uiClicksBound) {
      sound._uiClicksBound = true;
      addEventListener('pointerdown', e => {
        const btn = e.target?.closest?.('button, .pk-btn');
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          sound.unlock?.();
          sound.clickDown?.();
        }
      }, { passive: true });
      addEventListener('pointerup', e => {
        const btn = e.target?.closest?.('button, .pk-btn');
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          sound.clickUp?.();
        }
      }, { passive: true });
    }
  }
  let isOpen = false, returnFocus = null;

  // ---------- Juego ----------
  const shareInput = h('input', { readonly: true, id: id('share-url') });
  const shareLabel = h('label', { class: 'pana-share', hidden: true }, 'Enlace de la sala', shareInput);
  const status = h('p', { class: 'pana-menu-status', role: 'status', 'aria-live': 'polite' });
  const actionButtons = actions.map(a => {
    const button = h('button', { type: 'button', id: a.id, class: a.kind === 'primary' ? 'pana-primary' : a.kind === 'link' ? 'pana-link' : 'pana-secondary', text: a.label });
    button.addEventListener('click', () => { if (!a.keepOpen) close(); a.run?.(); });
    return { def: a, button };
  });
  const resume = h('button', { type: 'button', id: id('resume'), class: 'pana-primary', text: resumeLabel, onclick: () => close() });
  const gamePanel = h('section', { class: 'pana-panel', role: 'tabpanel', id: id('panel-game'), 'aria-labelledby': id('tab-game') },
    resume, actionButtons.map(a => a.button),
    invite && h('button', { type: 'button', id: id('copy-room'), class: 'pana-secondary', text: 'Copiar invitación', onclick: () => share() }),
    shareLabel, status,
    h('a', { class: 'pana-exit', href: exitHref, text: exitLabel }));

  // ---------- Ajustes ----------
  const soundSwitch = h('button', { type: 'button', role: 'switch', id: id('set-sound'), class: 'pana-switch', 'aria-labelledby': id('set-sound-label') });
  const volume = h('input', { type: 'range', id: id('set-volume'), min: 0, max: 100, step: 5, 'aria-label': 'Volumen' });
  const music = h('input', { type: 'range', id: id('set-music'), min: 0, max: 100, step: 5, 'aria-label': 'Música' });
  const hintsSwitch = h('button', { type: 'button', role: 'switch', id: id('set-hints'), class: 'pana-switch', 'aria-labelledby': id('set-hints-label') });
  const qualityGroup = choiceGroup(id('set-quality'), 'Calidad', Object.entries(QUALITY).map(([v, q]) => [v, q.label]),
    () => getSettings().quality, value => setSettings({ quality: value }));
  const gameOptions = options.map(o => choiceGroup(id(`opt-${o.id}`), o.label, o.choices, o.get, o.set));
  // Phones only: how to hold it. "Según el juego" names this game's own default.
  const ownWay = ORIENTATIONS[orientation] ? `Según el juego (${ORIENTATIONS[orientation].toLowerCase()})` : 'Como prefieras';
  const orientationGroup = isTouch() && choiceGroup(id('set-orientation'), 'Orientación',
    [['juego', ownWay], ...Object.entries(ORIENTATIONS)], () => getSettings().orientation, value => setSettings({ orientation: value }));
  if (pause) guardOrientation(orientation);
  soundSwitch.onclick = () => {
    const on = !getSettings().sound; setSettings({ sound: on });
    if (on && sound) { sound.unlock(); sound.tone?.(660, 0, 0.1, 'sine', 0.08); }
  };
  volume.oninput = () => setSettings({ volume: Number(volume.value) / 100 });
  volume.onchange = () => { if (sound) { sound.unlock(); sound.tone?.(880, 0, 0.08, 'sine', 0.1); } };
  music.oninput = () => setSettings({ music: Number(music.value) / 100 });
  hintsSwitch.onclick = () => setSettings({ hints: !getSettings().hints });
  const settingsPanel = h('section', { class: 'pana-panel', role: 'tabpanel', id: id('panel-settings'), 'aria-labelledby': id('tab-settings') },
    h('div', { class: 'pana-row' }, h('span', { id: id('set-sound-label'), text: 'Sonido' }), soundSwitch),
    h('label', { class: 'pana-row pana-volume', for: id('set-volume') }, h('span', { text: 'Volumen' }), volume),
    h('label', { class: 'pana-row pana-volume', for: id('set-music') }, h('span', { text: 'Música' }), music),
    qualityGroup.node,
    orientationGroup && orientationGroup.node,
    h('div', { class: 'pana-row' }, h('span', { id: id('set-hints-label'), text: 'Ayudas de controles en pantalla' }), hintsSwitch),
    gameOptions.map(o => o.node),
    h('p', { class: 'pana-fine', text: 'Audio, imagen y controles se guardan en este navegador para todos tus juegos. Las opciones del juego solo afectan tu vista.' }),
    !pause && h('button', { type: 'button', id: id('done'), class: 'pana-primary', text: 'Listo', onclick: () => close() }));

  function choiceGroup(groupId, label, choices, get, set) {
    const buttons = choices.map(([value, text]) => h('button', { type: 'button', role: 'radio', 'data-value': value, text,
      onclick: () => { set(value); refresh(); } }));
    const node = h('div', { class: 'pana-row pana-choice' }, h('span', { id: `${groupId}-label`, text: label }),
      h('div', { class: 'pana-segments', role: 'radiogroup', id: groupId, 'aria-labelledby': `${groupId}-label` }, buttons));
    // Arrow keys move between options, like native radio buttons.
    node.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!step) return;
      e.preventDefault(); const i = buttons.indexOf(document.activeElement);
      const next = buttons[(Math.max(0, i) + step + buttons.length) % buttons.length]; next.click(); next.focus();
    });
    function refresh() {
      const value = get();
      for (const b of buttons) { const on = b.dataset.value === String(value); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    }
    return { node, refresh };
  }

  // ---------- Controles ----------
  function keyList(rows, whole) {
    return h('div', { class: 'pana-keys', role: 'list' }, rows.map(([keys, text]) => h('div', { class: 'pana-key', role: 'listitem' },
      h('span', { class: 'pana-key-caps' }, keycaps(keys, whole)), h('span', { class: 'pana-key-text', text }))));
  }
  const keyboardRows = keyList(controls);
  const touchHelp = h('p', { class: 'pana-tip', hidden: true, text: 'Usa los controles táctiles del juego. Puedes ajustar la cámara y la orientación en Ajustes.' });
  // ---------- dialog ----------
  const tabs = [pause && ['game', 'Juego', gamePanel], ['settings', 'Mis ajustes', settingsPanel]].filter(Boolean);
  const tabButtons = tabs.map(([key, label]) => h('button', { type: 'button', role: 'tab', id: id(`tab-${key}`), 'aria-controls': id(`panel-${key}`), 'data-tab': key, text: label, onclick: () => showTab(key) }));
  const noteNode = h('p', { class: 'pana-menu-note', id: id('menu-note') });
  const dialog = h('dialog', { class: 'pana-menu', id: id('menu-dialog'), 'aria-labelledby': id('menu-title') },
    h('div', { class: 'pana-menu-head' },
      h('small', { text: title }), h('h2', { id: id('menu-title'), text: pause ? heading : 'Mis ajustes' }), noteNode, padHint,
      h('button', { type: 'button', class: 'pana-close', 'aria-label': 'Cerrar menú', text: 'Volver', onclick: () => close() })),
    tabs.length > 1 && h('div', { class: 'pana-tabs', role: 'tablist', 'aria-label': 'Secciones del menú' }, tabButtons,
      h('span', { class: 'pana-tabs-hint', 'data-pana-hint': true }, keycaps('Esc'), ' cerrar')),
    tabs.map(([, , panel]) => panel));
  document.body.append(dialog);
  let tab = tabs[0][0];
  let workspace, workspaceLoading;
  function prepareSettings() {
    if (workspace) { workspace.refresh(); return; }
    workspaceLoading ??= import('./settings-workspace.js').then(({ createSettingsWorkspace }) => {
      workspace = createSettingsWorkspace(settingsPanel, {
        audio: [soundSwitch, volume, music].map(n => n.closest('.pana-row')),
        image: [qualityGroup.node], touch: orientationGroup ? [orientationGroup.node] : [],
        hints: hintsSwitch.closest('.pana-row'), game: gameOptions.map(o => o.node), title,
        help: { keyboard: keyboardRows, gamepad: padRows, touch: touchHelp }, tips,
      });
      workspace.refresh();
    }).catch(() => { workspaceLoading = null; defaultNotify('No se pudieron cargar los controles. Vuelve a abrir Ajustes.'); });
  }

  function showTab(key) {
    if (key === 'controls') key = 'settings';
    tab = key;
    for (const [k, , panel] of tabs) panel.hidden = k !== key;
    for (const b of tabButtons) { const on = b.dataset.tab === key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
    dialog.querySelector('h2').textContent = key === 'settings' ? 'A tu manera' : heading;
    if (key === 'settings') prepareSettings();
  }
  dialog.querySelector('.pana-tabs')?.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!step) return;
    const i = tabButtons.findIndex(b => b.dataset.tab === tab), next = tabButtons[(i + step + tabButtons.length) % tabButtons.length];
    showTab(next.dataset.tab); next.focus();
  });

  function update() {
    const text = note?.() || '';
    noteNode.textContent = text; noteNode.hidden = !text;
    for (const { def, button } of actionButtons) {
      button.hidden = def.visible ? !def.visible() : false;
      if (typeof def.label === 'function') button.textContent = def.label();
    }
  }
  onSettings(s => {
    soundSwitch.setAttribute('aria-checked', String(s.sound)); soundSwitch.dataset.state = s.sound ? 'Sí' : 'No';
    hintsSwitch.setAttribute('aria-checked', String(s.hints)); hintsSwitch.dataset.state = s.hints ? 'Sí' : 'No';
    volume.value = String(Math.round(s.volume * 100)); volume.disabled = !s.sound;
    music.value = String(Math.round(s.music * 100)); music.disabled = !s.sound;
    qualityGroup.refresh();
    if (orientationGroup) orientationGroup.refresh();
  });

  function open(which = tab) {
    if (which === 'controls') which = 'settings';
    if (isOpen) { showTab(which); return; }
    if (!canOpen()) return;
    isOpen = true; returnFocus = document.activeElement;
    status.textContent = ''; shareLabel.hidden = true;
    update(); for (const o of gameOptions) o.refresh();
    showTab(tabs.some(t => t[0] === which) ? which : tabs[0][0]);
    dialog.showModal();
    (tab === 'game' ? resume : tabButtons.find(b => b.dataset.tab === tab) || dialog.querySelector('button')).focus();
    onOpen?.();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; dialog.close();
    if (returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
    onClose?.();
  }
  const toggle = () => (isOpen ? close() : open('game'));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  // Clicking the backdrop (outside the panel) closes the menu.
  dialog.addEventListener('pointerdown', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
  // While the menu is open, game key handlers never see keys: those aimed
  // at the menu stop at the dialog, everything else stops here (capture).
  dialog.addEventListener('keydown', e => e.stopPropagation());
  addEventListener('keydown', e => {
    if (isOpen) {
      if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) close(); }
      if (e.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button, summary, a[href], input, select, textarea, [tabindex]')]
          .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (first && ((!e.shiftKey && document.activeElement === last) || (e.shiftKey && document.activeElement === first))) {
          e.preventDefault(); (e.shiftKey ? last : first).focus();
        }
      }
      if (!dialog.contains(e.target)) e.stopImmediatePropagation();
      return;
    }
    if (!hotkey || e.key !== 'Escape' || e.repeat || !canOpen()) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault(); e.stopImmediatePropagation(); open('game');
  }, true);

  async function share() {
    const href = invite();
    try {
      await navigator.clipboard.writeText(href);
      if (isOpen) status.textContent = '¡Enlace copiado! Pásaselo a tus panas.'; else notify('¡Enlace copiado! Pásaselo a tus panas.');
    } catch {
      open('game'); shareLabel.hidden = false; shareInput.value = href; shareInput.focus(); shareInput.select();
    }
  }

  // ---------- buttons a game places in its own HUD ----------
  function createButton({ id: buttonId = id('open'), label = 'Menú', kbd = 'Esc', className = '' } = {}) {
    const button = h('button', { type: 'button', id: buttonId, class: `pana-hud-button ${className}`, 'aria-haspopup': 'dialog', 'aria-controls': dialog.id },
      label, kbd && h('kbd', { text: kbd, 'data-pana-hint': true }));
    button.addEventListener('click', () => (pause ? toggle() : open()));
    return button;
  }
  function createSoundButton({ id: buttonId = id('sound'), className = '' } = {}) {
    const button = h('button', { type: 'button', id: buttonId, class: `pana-hud-button ${className}` });
    button.addEventListener('click', () => soundSwitch.click());
    onSettings(s => {
      button.textContent = `Sonido: ${s.sound ? 'sí' : 'no'}`;
      button.setAttribute('aria-pressed', String(s.sound));
      button.setAttribute('aria-label', s.sound ? 'Silenciar sonido' : 'Activar sonido');
    });
    return button;
  }
  function createInviteButton({ id: buttonId = id('invite'), label = 'Invitar panas', className = '' } = {}) {
    return h('button', { type: 'button', id: buttonId, class: `pana-hud-button ${className}`, title: 'Copiar enlace de la sala', onclick: () => share() },
      label, ' ', icon('share'));
  }

  return {
    open, close, toggle, update, share, dialog,
    get isOpen() { return isOpen; },
    createButton, createSoundButton, createInviteButton,
  };
}

// Toggles the shared mute setting (games bind M to this).
export function toggleMute() { setSettings({ sound: !getSettings().sound }); }
