// Ajustes, one screen for the hub and every game: a rail of categories, tabs
// inside each, one row per setting (name left, value right) and a panel that
// explains the row you are on, with a live preview where there is something
// real to show: the pad tester, the stick response, what the picture costs
// right now. Loaded only when Ajustes opens; every value lives in settings.js
// (game options in the game's own get/set).
import { getSettings, setSettings, onSettings, DEFAULTS, INPUT_RANGES, QUALITY, RESOLUTIONS, SHADOWS, DETAIL, FPS_CAPS, inputAxis, boundRenderers, renderStep, renderScaleNow, urlSettings } from './settings.js';
import { onInputDevice, inputState, activePad, readPad, formatPadLabel, testVibration, NAMES } from './gamepad.js';
import { ICONS } from './icons.js';
import { loc, locn, formatNumber, LANGUAGES, language, resolveLanguage } from './i18n.js';
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
const button = (label, action, className = '') => {
  const node = el('button', className, label); node.type = 'button'; node.onclick = action; return node;
};
const svgNode = name => { const t = document.createElement('template'); t.innerHTML = ICONS[name]; return t.content.firstChild; };

// ---------- the settings, as data ----------
// choice: options are [value, name, what you notice]; range: shown as `format`;
// toggle; a help tab shows the game's instructions instead of rows.
const choice = (key, label, detail, options, extra = {}) => ({ kind: 'choice', key, label, detail, options, ...extra });
const range = (key, label, detail, extra = {}) => ({ kind: 'range', key, label, detail, ...extra });
const toggle = (key, label, detail, extra = {}) => ({ kind: 'toggle', key, label, detail, ...extra });
const REOPEN = 'pana:settings-reopen';   // read by ui.js
const nameOf = code => LANGUAGES.find(l => l.code === code).name;
// The language the page would load with the saved choice (the address's ?pana-language aside).
const chosenLanguage = () => { const s = getSettings().language; return s === 'auto' ? resolveLanguage({ browser: [...(navigator.languages || [navigator.language])] }) : s; };
const times = v => `${v.toFixed(2)}×`, percent = v => `${Math.round(v * 100)} %`;
const inputRange = (key, label, detail, extra) => range(key, label, detail, { min: INPUT_RANGES[key][0], max: INPUT_RANGES[key][1], step: key === 'padDeadzone' ? .01 : .05, format: key === 'padDeadzone' ? percent : times, ...extra });

function catalog(legacy) {
  const hints = { title: loc('Ayudas'), rows: [
    choice('inputHints', loc('Ayudas en pantalla'), loc('Qué controles muestran las ayudas. Elegir uno solo cambia lo que se ve; puedes seguir usando los demás.'), [
      ['auto', loc('Automático'), loc('Siguen lo último que usaste.')], ['keyboard', loc('Teclado'), loc('Siempre teclas.')], ['gamepad', loc('Mando'), loc('Siempre botones del mando.')], ['touch', loc('Táctil'), loc('Siempre los controles de la pantalla.')]]),
    toggle('hints', loc('Ayudas de controles en pantalla'), loc('Los recordatorios de teclas y botones en las esquinas del juego.')),
  ] };
  const help = key => legacy.help?.[key] && { title: loc('Cómo se juega'), help: key };
  const audio = legacy.sound;
  const categories = [
    { key: 'mouse', label: loc('Ratón y teclado'), icon: 'mouse', tabs: [help('keyboard'), { title: loc('Ratón'), rows: [
      inputRange('mouseSensitivity', loc('Sensibilidad del ratón'), loc('Qué tan rápido gira la cámara al mover el ratón, en los juegos con cámara libre. El movimiento con teclas no cambia.')),
      inputRange('mouseVertical', loc('Velocidad vertical'), loc('Multiplica la sensibilidad al mirar arriba y abajo.')),
      toggle('mouseInvertY', loc('Invertir eje vertical'), loc('Mueve el ratón hacia abajo para mirar arriba.')),
    ] }, hints] },
    { key: 'pad', label: loc('Mando'), icon: 'gamepad', tabs: [help('gamepad'), { title: loc('Sticks'), rows: [
      inputRange('padDeadzone', loc('Zona muerta'), loc('Ignora movimientos pequeños del stick. Súbela si tu pana camina o la cámara gira sin tocar nada.'), { curve: 'move' }),
      inputRange('padMoveSensitivity', loc('Respuesta al mover y girar'), loc('Acelera la respuesta del stick izquierdo. En juegos con teclas, cambia cuándo empieza el movimiento.'), { curve: 'move' }),
      choice('padCurve', loc('Curva de los sticks'), loc('Cómo crece el movimiento cuando empujas el stick.'), [
        ['lineal', loc('Lineal'), loc('Mitad del stick, mitad de velocidad. Predecible.')], ['suave', loc('Suave'), loc('Más precisión cerca del centro para apuntar.')], ['rapida', loc('Rápida'), loc('Llega antes a toda velocidad.')]], { curve: 'move' }),
      inputRange('padLookSensitivity', loc('Sensibilidad al mirar'), loc('Velocidad de la cámara con el stick derecho.'), { curve: 'look' }),
      inputRange('padVertical', loc('Velocidad vertical'), loc('Multiplica la velocidad al mirar arriba y abajo.')),
      toggle('padInvertY', loc('Invertir eje vertical'), loc('Empuja el stick hacia abajo para mirar arriba.')),
    ] }, { title: loc('Botones'), rows: [
      choice('padFamily', loc('Nombres de los botones'), loc('Se detectan por el nombre que da tu navegador. Corrígelo si tu mando aparece como genérico.'), [
        ['auto', loc('Automático')], ['xbox', 'Xbox'], ['playstation', 'PlayStation'], ['nintendo', 'Nintendo'], ['generic', loc('Genérico')]]),
      inputRange('padCursorSpeed', loc('Velocidad del cursor'), loc('Para juegos que apuntan o eligen con un puntero.')),
      toggle('padVibration', loc('Vibración al confirmar'), loc('El mando vibra al elegir, cuando el navegador y el mando lo permiten.'), { test: 'vibration' }),
    ] }, hints] },
    { key: 'touch', label: loc('Pantalla táctil'), icon: 'touch', tabs: [help('touch'), { title: loc('Cámara'), rows: [
      inputRange('touchSensitivity', loc('Sensibilidad al arrastrar'), loc('Velocidad de la cámara al deslizar el dedo. Los botones y joysticks de cada juego no cambian.')),
      toggle('touchInvertY', loc('Invertir eje vertical'), loc('Arrastra hacia abajo para mirar arriba.')),
      ...(legacy.orientation ? [choice('orientation', loc('Orientación'), loc('Cómo sostener el teléfono en los juegos.'), legacy.orientation)] : []),
    ] }, hints] },
    { key: 'image', label: loc('Imagen'), icon: 'picture', tabs: [{ title: loc('Calidad'), rows: [
      choice('quality', loc('Calidad'), loc('Un punto de partida que ajusta resolución, sombras y detalle. Cambiar uno de ellos la deja en Personalizada.'), [
        ['alta', QUALITY.alta.label, loc('La más nítida.')], ['media', QUALITY.media.label, loc('Buen equilibrio; la de los teléfonos.')], ['baja', QUALITY.baja.label, loc('Para equipos viejos y teléfonos sencillos.')],
        ['custom', loc('Personalizada'), loc('Cambiaste alguna opción de abajo.'), { shown: true }]]),
      choice('resolution', loc('Resolución'), loc('Puntos dibujados por cada punto de la pantalla. La tuya llega a ×{ratio}; por encima no gana nitidez.', { ratio: formatNumber(Math.round((globalThis.devicePixelRatio || 1) * 100) / 100) }), RESOLUTIONS, { child: true }),
      choice('shadows', loc('Sombras'), loc('Las sombras pesan mucho en móviles. Apagarlas es inmediato; su tamaño cambia al volver a cargar el juego.'), Object.entries(SHADOWS).map(([k, v]) => [k, v.label]), { child: true }),
      choice('detail', loc('Detalle del mundo'), loc('Hierba, árboles lejanos, lluvia y efectos en los juegos con mundos grandes.'), Object.entries(DETAIL), { child: true }),
      toggle('antialias', loc('Suavizado de bordes'), loc('Quita los dientes de sierra de los bordes. Se aplica al volver a abrir el juego.'), { child: true }),
    ] }, { title: loc('Rendimiento'), rows: [
      choice('fpsCap', loc('Límite de FPS'), loc('Ahorra batería y calor. El juego va igual de rápido; solo se dibuja menos veces.'), FPS_CAPS),
      toggle('autoScale', loc('Ajuste automático'), loc('Si el juego va lento, baja la resolución sola hasta que vaya fluido.')),
      toggle('perfOverlay', loc('Mostrar rendimiento'), loc('FPS, tiempo de cuadro, llamadas de dibujo y resolución en una esquina.')),
    ] }] },
    { key: 'audio', label: loc('Audio'), icon: 'speaker', tabs: [{ title: loc('Volumen'), rows: [
      toggle('sound', loc('Sonido'), loc('Todo el sonido del juego.'), { after: on => { if (on && audio) { audio.unlock(); audio.tone?.(660, 0, 0.1, 'sine', 0.08); } } }),
      range('volume', loc('Volumen general'), loc('Controla todo el sonido.'), { min: 0, max: 1, step: .05, format: percent, id: 'pana-set-volume', test: 'sound' }),
      range('music', loc('Música'), loc('Se mezcla por debajo del volumen general.'), { min: 0, max: 1, step: .05, format: percent, id: 'pana-set-music', child: true, test: 'sound' }),
    ] }] },
    { key: 'language', label: loc('Idioma'), icon: 'globe', tabs: [{ title: loc('Idioma'), rows: [
      choice('language', loc('Idioma'), loc('El idioma de los menús y los juegos. Los nombres de los juegos y los dichos de los panas quedan en español.'), [
        ['auto', loc('Automático'), loc('El de tu navegador: {name}.', { name: nameOf(resolveLanguage({ browser: [...(navigator.languages || [navigator.language])] })) })],
        ...LANGUAGES.map(l => [l.code, l.name])], { after: () => legacy.languageChanged?.() }),
    ] }] },
  ];
  if (legacy.options?.length) categories.push({ key: 'game', label: legacy.title, icon: 'controller', note: loc('Solo para ti en este juego'), tabs: [{ title: legacy.title, rows: legacy.options.map(o =>
    choice(o.id, o.label, o.detail || loc('Solo cambia tu vista; no cambia la sala.'), o.choices, { id: `pana-opt-${o.id}`, get: o.get, set: o.set, def: null })) }] });
  for (const c of categories) c.tabs = c.tabs.filter(Boolean);
  return categories;
}

const value = row => row.get ? row.get() : getSettings()[row.key];
const assign = (row, v) => { if (row.set) row.set(v); else setSettings({ [row.key]: v }); row.after?.(v); };
const defaultOf = row => row.def === null ? undefined : row.def ?? DEFAULTS[row.key];
const changed = row => defaultOf(row) !== undefined && String(value(row)) !== String(defaultOf(row));

export function createSettingsWorkspace(root, legacy) {
  const categories = catalog(legacy);
  // Game options live in the game, not in settings.js: nothing announces them, so redraw here.
  const apply = (row, v) => { assign(row, v); if (row.set) redraw(); };
  const workspace = el('div', 'pana-settings-workspace');
  const nav = el('nav', 'pana-settings-nav'); nav.setAttribute('aria-label', loc('Categorías de ajustes')); nav.dataset.padPages = '';
  const main = el('div', 'pana-settings-main');
  const detail = el('aside', 'pana-settings-detail');
  const foot = el('div', 'pana-settings-foot');
  const saved = el('span', 'pana-saved', loc('Se guarda solo'));
  const count = el('span', 'pana-changed-count');
  // Button hints, like the games' HUD: each is the key (or pad button) and what it does.
  const hint = (keys, pad, label, action, className = '') => {
    const node = action ? button('', action, `pana-hint-button ${className}`) : el('span', `pana-hint-button ${className}`);
    for (const key of keys) node.append(el('kbd', '', key));
    for (const key of pad) { const k = el('kbd', 'pana-pad-cap', formatPadLabel(key, inputState().family)); k.dataset.padKey = key; node.append(k); }
    node.append(label); return node;
  };
  const back = hint(['Esc'], ['B'], loc('Atrás'), () => root.closest('dialog')?.querySelector('.pana-close')?.click());
  const tabsHint = hint(['Q', 'E'], ['LB', 'RB'], loc('Pestañas'), null);
  const pagesHint = hint([], ['LT', 'RT'], loc('Categorías'), null, 'pana-pad-only');
  const reset = hint([], [], loc('Restablecer pestaña'), () => {
    for (const row of current().rows || []) if (defaultOf(row) !== undefined) apply(row, defaultOf(row));
    count.textContent = loc('Pestaña restablecida');
  }, 'pana-reset');
  foot.append(back, tabsHint, pagesHint, reset, count);
  let stepper = null;
  let state = { cat: legacy.category || { keyboard: 'mouse', gamepad: 'pad', touch: 'touch' }[inputState().detected] || 'image', tab: 0, row: null };
  const rowRefreshers = [], railRefreshers = [];
  const current = () => categories.find(c => c.key === state.cat).tabs[state.tab];

  // ---------- rail ----------
  const railButtons = categories.map(c => {
    const b = button('', () => choose(c.key), 'pana-rail-button');
    b.setAttribute('aria-controls', `pana-settings-${c.key}`); b.title = c.label;
    const dot = el('i', 'pana-changed-dot'); dot.hidden = true;
    b.append(svgNode(c.icon), el('span', 'pana-rail-label', c.label), dot);
    nav.append(b);
    railRefreshers.push(() => { dot.hidden = !c.tabs.some(t => t.rows?.some(changed)); });
    return b;
  });

  // ---------- one category: heading, tabs, rows ----------
  const pageNode = el('section', 'pana-settings-section');
  main.append(pageNode);
  function choose(key, tab = 0) {
    state = { cat: key, tab, row: null };
    const c = categories.find(x => x.key === key);
    railButtons.forEach((b, i) => b.setAttribute('aria-current', String(categories[i].key === key)));
    saved.textContent = c.note || loc('Se guarda solo');
    pageNode.id = `pana-settings-${key}`; pageNode.dataset.settingsCategory = key;
    const heading = el('h3', '', c.label); heading.id = `pana-category-${key}`;
    pageNode.setAttribute('aria-labelledby', heading.id);
    const tabs = el('div', 'pana-setting-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', c.label);
    if (c.tabs.length > 1) c.tabs.forEach((t, i) => {
      const b = button(t.title, () => { state.tab = i; renderTab(); }, 'pana-setting-tab');
      b.setAttribute('role', 'tab'); tabs.append(b);
    });
    // Q / E (LB / RB on a pad) step through the tabs, shown either side of them.
    const stepTab = d => { const all = [...tabs.children]; all[(state.tab + d + all.length) % all.length]?.click(); };
    stepper = c.tabs.length > 1 ? stepTab : null;
    const steps = c.tabs.length > 1 ? [hint(['Q'], ['LB'], '', () => stepTab(-1), 'pana-tab-step'), hint(['E'], ['RB'], '', () => stepTab(1), 'pana-tab-step')] : [];
    steps.forEach((b, i) => b.setAttribute('aria-label', i ? loc('Pestaña siguiente') : loc('Pestaña anterior')));
    tabsHint.hidden = !steps.length;
    tabs.onkeydown = event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]; if (!step) return;
      event.preventDefault(); const all = [...tabs.children], next = all[(state.tab + step + all.length) % all.length]; next.click(); next.focus();
    };
    const list = el('div', 'pana-setting-list'); list.setAttribute('role', 'tabpanel'); list.setAttribute('aria-labelledby', heading.id);
    const head = el('div', 'pana-setting-head'); head.append(heading, ...(steps.length ? [steps[0], tabs, steps[1]] : [tabs]));
    pageNode.replaceChildren(head, list);
    function renderTab() {
      [...tabs.children].forEach((b, i) => { b.setAttribute('aria-selected', String(i === state.tab)); b.tabIndex = i === state.tab ? 0 : -1; });
      rowRefreshers.length = 0;
      list.replaceChildren(...renderRows(current()));
      main.scrollTop = 0;
      setTesting(false);
      refresh(); describe(null);
    }
    renderTab();
  }

  function renderRows(tab) {
    if (tab.help) {
      const help = legacy.help[tab.help]; help.dataset.settingsHelp = tab.help;
      const tips = (legacy.tips || []).filter(tip => tab.help === 'keyboard' || !/\b(?:Shift|Esc|WASD)\b|pulsa [A-Z]\b|clic|ratón/i.test(tip));
      const block = el('div', 'pana-device-help'); block.append(help);
      if (tips.length) block.append(el('h4', 'pana-tips-title', loc('Consejos de juego')), ...tips.map(tip => el('p', 'pana-tip', tip)));
      return [block];
    }
    return tab.rows.map(renderRow);
  }

  function renderRow(row) {
    const node = el('div', `pana-setting-row${row.child ? ' is-child' : ''}`);
    const name = el('span', 'pana-setting-name', row.label), dot = el('i', 'pana-changed-dot'); dot.title = loc('Cambiado');
    name.append(dot);
    const control = el('div', 'pana-setting-value');
    node.append(name, control);
    node.addEventListener('focusin', () => describe(row));
    node.addEventListener('pointerenter', () => describe(row));
    if (row.kind === 'toggle') {
      const label = el('span', 'pana-switch-state');
      const sw = button('', () => apply(row, !value(row)), 'pana-switch');
      sw.setAttribute('role', 'switch'); sw.setAttribute('aria-label', row.label); sw.id = row.id || `pana-set-${row.key}`;
      control.append(label, sw);
      name.onclick = () => sw.click();
      rowRefreshers.push(() => { const on = !!value(row); sw.setAttribute('aria-checked', String(on)); label.textContent = on ? loc('Sí') : loc('No'); dot.hidden = !changed(row); });
    } else if (row.kind === 'range') {
      const input = el('input'); input.type = 'range'; input.id = row.id || `pana-input-${row.key}`;
      input.min = row.min; input.max = row.max; input.step = row.step; input.setAttribute('aria-label', row.label);
      const output = el('output', 'pana-setting-number'); output.htmlFor = input.id;
      input.oninput = () => apply(row, Number(input.value));
      if (row.test === 'sound') input.onchange = () => { legacy.sound?.unlock(); legacy.sound?.tone?.(880, 0, 0.08, 'sine', 0.1); };
      const def = defaultOf(row);
      if (def !== undefined) input.style.setProperty('--default', `${(def - row.min) / (row.max - row.min) * 100}%`);
      control.append(output, input);
      rowRefreshers.push(() => {
        const v = value(row); input.value = v; output.value = row.format(v); dot.hidden = !changed(row);
        input.style.setProperty('--fill', `${(v - row.min) / (row.max - row.min) * 100}%`);
      });
    } else {
      // A cycler: arrows step through the options; the pips are the options
      // themselves (radios), so arrow keys, a pad and screen readers all work.
      const options = row.options.filter(o => !o[3]?.shown);
      const shown = el('span', 'pana-cycler-value');
      const pips = el('span', 'pana-pips'); pips.setAttribute('role', 'radiogroup'); pips.setAttribute('aria-label', row.label); pips.id = row.id || `pana-set-${row.key}`;
      const radios = options.map(([v, label]) => {
        const r = button('', () => apply(row, v)); r.setAttribute('role', 'radio'); r.setAttribute('aria-label', label); r.dataset.value = String(v); r.title = label;
        pips.append(r); return r;
      });
      const step = d => {
        const i = radios.findIndex(r => r.dataset.value === String(value(row)));
        const next = radios[i < 0 ? (d > 0 ? 0 : radios.length - 1) : (i + d + radios.length) % radios.length];
        next.click(); return next;
      };
      const prev = button('', () => step(-1), 'pana-cycler-arrow'), next = button('', () => step(1), 'pana-cycler-arrow');
      prev.setAttribute('aria-label', loc('{name}: anterior', { name: row.label })); next.setAttribute('aria-label', loc('{name}: siguiente', { name: row.label })); prev.tabIndex = next.tabIndex = -1;
      prev.append(svgNode('chevronLeft')); next.append(svgNode('chevronRight'));
      pips.onkeydown = event => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[event.key]; if (!d) return;
        event.preventDefault(); step(d).focus();
      };
      const middle = el('span', 'pana-cycler-middle'); middle.append(shown, pips);
      const group = el('div', 'pana-cycler'); group.append(prev, middle, next); control.append(group);
      rowRefreshers.push(() => {
        const v = String(value(row)), option = row.options.find(o => String(o[0]) === v);
        shown.textContent = option?.[1] ?? v;
        radios.forEach(r => { const on = r.dataset.value === v; r.setAttribute('aria-checked', String(on)); r.tabIndex = on ? 0 : -1; });
        if (!radios.some(r => r.tabIndex === 0)) radios[0].tabIndex = 0;
        dot.hidden = !changed(row);
      });
    }
    return node;
  }

  // ---------- the detail panel ----------
  const vibrationStatus = el('span', 'pana-detail-note'); vibrationStatus.setAttribute('role', 'status');
  const vibration = button(loc('Probar vibración'), async () => { vibrationStatus.textContent = await testVibration() ? loc('Prueba enviada al mando') : loc('Este mando o navegador no ofrece vibración'); }, 'pana-test-button');
  const soundTest = button(loc('Probar sonido'), () => { legacy.sound?.unlock(); legacy.sound?.tone?.(523, 0, .12, 'triangle', .1); legacy.sound?.tone?.(784, .14, .14, 'triangle', .1); }, 'pana-test-button');
  function describe(row) {
    if (row && state.row === row && detail.childNodes.length) return;
    state.row = row;
    const c = categories.find(x => x.key === state.cat), tab = current();
    const parts = [el('h3', '', row ? row.label : tab.help ? loc('Cómo se juega') : c.label)];
    if (row) {
      parts.push(el('p', 'pana-detail-copy', row.detail));
      if (row.kind === 'choice' && row.options.some(o => o[2])) parts.push(optionNotes(row));
      if (row.kind === 'range' && defaultOf(row) !== undefined) parts.push(el('p', 'pana-detail-note', loc('De fábrica: {value}. Es la rayita en la barra.', { value: row.format(defaultOf(row)) })));
      if (row.curve) parts.push(curve(row.curve));
      if (row.test === 'vibration') parts.push(vibration, vibrationStatus);
      if (row.test === 'sound') parts.push(soundTest);
    } else {
      parts.push(el('p', 'pana-detail-copy', tab.help ? loc('Los controles de este juego con ese dispositivo.') : loc('Pasa por una opción para ver qué cambia.')));
    }
    // Category previews stay under whatever row is described.
    if (state.cat === 'pad') parts.push(monitor);
    if (state.cat === 'image') parts.push(picture, reload, cost);
    if (state.cat === 'audio' && !row) parts.push(soundTest);
    if (state.cat === 'language' && chosenLanguage() !== language) parts.push(languageReload);
    detail.replaceChildren(...parts);
    if (state.cat === 'image') { describePicture(); measure(); }
  }
  function optionNotes(row) {
    const options = el('div', 'pana-detail-options'), v = String(value(row));
    for (const [val, name, note] of row.options) if (note) {
      const p = el('p', String(val) === v ? 'is-current' : ''); p.append(el('b', '', `${name}: `), note); options.append(p);
    }
    return options;
  }

  // Stick response with the current shaping: how far the stick is pushed
  // (across) against what the game receives (up), deadzone shaded.
  function curve(kind) {
    const s = getSettings(), W = 300, H = 160, top = kind === 'look' ? Math.max(1, s.padLookSensitivity) : 1;
    let d = '';
    for (let i = 0; i <= 60; i++) { const x = i / 60, y = Math.min(top, Math.abs(inputAxis(x, s, kind))) / top; d += `${i ? 'L' : 'M'}${20 + x * W} ${H + 10 - y * H}`; }
    const box = el('div', 'pana-detail-preview pana-curve-box');
    box.append(el('h4', '', loc('Cómo responde')));
    box.insertAdjacentHTML('beforeend', `<svg class="pana-curve" viewBox="0 0 330 200" role="img" aria-label="${loc('Curva de respuesta del stick')}">
      <rect x="20" y="10" width="${s.padDeadzone * W}" height="${H}" class="pana-curve-dead"/>
      <path d="M20 10V${H + 10}H${W + 20}" class="pana-curve-axis"/>
      <path d="M20 ${H + 10}L${W + 20} 10" class="pana-curve-even"/>
      <path d="${d}" class="pana-curve-line"/>
      <text x="22" y="192">${loc('Stick quieto')}</text><text x="${W - 40}" y="192">${loc('Al fondo')}</text></svg>`);
    return box;
  }

  // Imagen: the size actually drawn, the reload a new size needs in a game,
  // and what the current scene costs (measured, never estimated).
  const loaded = getSettings();
  const picture = el('p', 'pana-image-status'); picture.setAttribute('role', 'status');
  const reload = el('div', 'pana-reload-note'); reload.hidden = true; reload.setAttribute('role', 'status');
  reload.append(el('p', '', loc('El suavizado y el tamaño de las sombras se aplican al volver a cargar el juego. Recargar ahora reinicia la partida en curso.')),
    button(loc('Recargar ahora'), () => location.reload(), 'pana-test-button'));
  // A new language reaches every text on the next load: the hub reloads at
  // once, a game asks first because reloading restarts the match.
  const languageReload = el('div', 'pana-reload-note'); languageReload.setAttribute('role', 'status');
  languageReload.append(el('p', '', loc('El idioma cambia al volver a cargar el juego. Recargar ahora reinicia la partida en curso.')),
    button(loc('Recargar ahora'), () => location.reload(), 'pana-test-button'));
  legacy.languageChanged = () => {
    if (legacy.game || chosenLanguage() === language) return;
    // Back on Idioma after the reload, so the player sees the change land.
    try { sessionStorage.setItem(REOPEN, 'language'); } catch { /* Storage off: the hub opens as usual. */ }
    location.reload();
  };
  const cost = el('div', 'pana-detail-preview pana-cost');
  function describePicture() {
    const s = getSettings(), dpr = globalThis.devicePixelRatio || 1;
    const canvas = boundRenderers().map(r => r.domElement).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const w = canvas?.clientWidth || innerWidth, h = canvas?.clientHeight || innerHeight;
    const ratio = canvas ? canvas.width / Math.max(1, w) : Math.max(Math.min(1, dpr, s.resolution), Math.min(dpr, s.resolution) * renderScaleNow());
    const lines = [loc('Pantalla de {w}×{h} puntos: se dibuja a {dw}×{dh}.', { w, h, dw: Math.round(w * ratio), dh: Math.round(h * ratio) })];
    if (renderStep()) lines.push(loc('El ajuste automático bajó la resolución al {percent} % porque iba lento. Elegir una resolución lo reinicia.', { percent: Math.round(renderScaleNow() * 100) }));
    if (Object.keys(urlSettings()).some(k => ['resolution', 'shadows', 'detail', 'fpsCap', 'autoScale', 'antialias', 'perfOverlay'].includes(k))) lines.push(loc('El enlace de esta página fija parte de la imagen; no se guarda.'));
    picture.textContent = lines.join(' ');
    reload.hidden = !boundRenderers().length || (s.antialias === loaded.antialias && SHADOWS[s.shadows].scale === SHADOWS[loaded.shadows].scale);
  }
  let measuring = 0;
  function measure() {
    clearTimeout(measuring);
    if (!boundRenderers().length) { cost.replaceChildren(el('h4', '', loc('Rendimiento')), el('p', 'pana-detail-note', loc('Abre un juego para medir lo que cuesta su imagen en este equipo.'))); return; }
    import('./perf.js').then(perf => {
      perf.startPerf();
      const paint = () => {
        if (state.cat !== 'image' || !root.getClientRects().length) return;
        const p = perf.snapshot({ seconds: 2 }), fps = p.fps ?? 0;
        const meter = el('div', 'pana-meter'); meter.style.setProperty('--at', `${Math.min(100, fps / 144 * 100)}%`);
        meter.dataset.level = fps >= 55 ? 'good' : fps >= 35 ? 'fair' : 'low'; meter.append(el('i'), el('u'));
        const numbers = el('p', 'pana-detail-note', p.drawnFrames
          ? loc('Medido ahora en este juego: {fps} FPS · {draws} llamadas · {time}.', { fps: Math.round(fps), draws: p.draws ?? '–', time: p.gpuMs != null ? loc('{ms} ms de GPU', { ms: p.gpuMs.toFixed(1) }) : loc('{ms} ms por cuadro', { ms: (p.frameMs.p50 ?? 0).toFixed(1) }) })
          : loc('La escena está quieta: se mide cuando el juego se mueve.'));
        cost.replaceChildren(el('h4', '', loc('Rendimiento · la raya marca 60 FPS')), meter, numbers);
        measuring = setTimeout(paint, 700);
      };
      paint();
    }).catch(() => {});
  }

  // ---------- pad tester: same shaping as gameplay, raw input underneath ----------
  const monitor = el('div', 'pana-input-monitor');
  const status = el('p', 'pana-device-status'); status.setAttribute('role', 'status');
  const device = el('h4', 'pana-device-name');
  const connected = el('p', 'pana-device-detail');
  monitor.append(el('small', 'pana-monitor-eyebrow', loc('ENTRADA EN VIVO')), device, status, connected);
  const sticks = el('div', 'pana-stick-pair');
  const stickNodes = [loc('Izquierdo'), loc('Derecho')].map(label => {
    const box = el('div', 'pana-stick-block'), disc = el('div', 'pana-stick-disc');
    const dead = el('span', 'pana-stick-deadzone'), raw = el('span', 'pana-stick-raw'), dot = el('span', 'pana-stick-dot');
    disc.append(dead, raw, dot); const values = el('output', 'pana-stick-values', '0.00 / 0.00');
    box.append(el('span', '', label), disc, values); sticks.append(box); return { dead, raw, dot, values };
  });
  const padButtons = el('div', 'pana-pad-buttons');
  const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3', '↑', '↓', '←', '→'];
  const caps = NAMES.map((name, index) => { const cap = el('span', 'pana-test-cap', names[index]); cap.dataset.button = name; padButtons.append(cap); return cap; });
  const test = button(loc('Probar sticks y botones'), () => setTesting(!test.hasAttribute('data-pad-test-active')), 'pana-test-button');
  const testNote = el('p', 'pana-device-detail');
  function setTesting(on) {
    test.toggleAttribute('data-pad-test-active', on);
    test.setAttribute('aria-pressed', String(on)); test.textContent = on ? loc('Terminar prueba') : loc('Probar sticks y botones');
    testNote.textContent = on ? loc('Mueve los sticks y pulsa botones sin navegar. {buttons} termina la prueba.', { buttons: formatPadLabel('B / Start', inputState().family) }) : loc('El punto claro es la entrada del mando; el amarillo, la respuesta con tus ajustes.');
  }
  monitor.append(sticks, padButtons, test, testNote);
  onInputDevice(s => {
    device.textContent = s.connected ? ({ xbox: loc('Mando Xbox'), playstation: loc('Mando PlayStation'), nintendo: loc('Mando Nintendo') }[s.family] || loc('Tu mando')) : loc('Tu mando');
    status.textContent = s.connected ? loc('Mando conectado') : loc('Sin mando conectado');
    connected.textContent = s.id || loc('Conecta tu mando y pulsa un botón para que el navegador lo reconozca.');
    caps.forEach((cap, index) => { cap.textContent = formatPadLabel(names[index], s.family); });
    for (const k of workspace.querySelectorAll('kbd[data-pad-key]')) k.textContent = formatPadLabel(k.dataset.padKey, s.family);
    test.disabled = !s.connected;
    if (!s.connected) setTesting(false);
  });

  // ---------- wiring ----------
  function refresh() {
    const s = getSettings();
    rowRefreshers.forEach(fn => fn(s)); railRefreshers.forEach(fn => fn(s));
    const n = categories.reduce((sum, c) => sum + c.tabs.reduce((t, tab) => t + (tab.rows || []).filter(changed).length, 0), 0);
    count.textContent = n ? locn(n, '{n} ajuste cambiado', '{n} ajustes cambiados') : loc('Todo como vino de fábrica');
    stickNodes.forEach(node => { node.dead.style.width = node.dead.style.height = `${s.padDeadzone * 96}px`; });
    if (state.cat === 'image') describePicture();
  }
  // A change redraws what the panel says about the row (current option, curve).
  function redraw() { refresh(); if (state.row) { const row = state.row; state.row = null; describe(row); } }
  onSettings(() => redraw());
  workspace.append(nav, main, detail, foot, saved); root.replaceChildren(workspace); root.classList.add('pana-settings-panel');
  // Q and E change tabs from anywhere in Ajustes, as LB and RB do on a pad.
  workspace.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !stepper || event.target.matches('input:not([type=range]), textarea')) return;
    const d = { KeyQ: -1, KeyE: 1 }[event.code]; if (!d) return;
    event.preventDefault(); stepper(d);
    workspace.querySelector('.pana-setting-tab[aria-selected=true]')?.focus();
  });
  choose(state.cat);
  let ticking = false;
  function tick() {
    ticking = false;
    if (!root.getClientRects().length || document.hidden) { setTesting(false); return; }
    if (state.cat === 'pad') {
      const raw = activePad(), tuned = readPad(raw);
      stickNodes.forEach((n, i) => {
        const xy = tuned?.[i ? 'right' : 'left'] || { x: 0, y: 0 };
        n.raw.style.transform = `translate(${(raw?.axes[i * 2] || 0) * 48}px, ${(raw?.axes[i * 2 + 1] || 0) * 48}px)`;
        n.dot.style.transform = `translate(${Math.max(-1, Math.min(1, xy.x)) * 48}px, ${Math.max(-1, Math.min(1, xy.y)) * 48}px)`;
        n.values.value = `${xy.x.toFixed(2)} / ${xy.y.toFixed(2)}`;
      });
      caps.forEach((cap, i) => { const b = raw?.buttons[i]; cap.classList.toggle('pressed', !!b && (b.pressed || b.value > .4)); cap.style.setProperty('--pressure', `${(b?.value || 0) * 100}%`); });
    }
    ticking = true; requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  function start() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  return { refresh() { refresh(); const row = state.row; state.row = null; describe(row); start(); } };
}
