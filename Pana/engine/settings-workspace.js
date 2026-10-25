// Loaded only when Ajustes opens. Existing audio/video/game controls are moved
// here, retaining their handlers, IDs and each game's pause lifecycle.
import { getSettings, setSettings, onSettings, INPUT_RANGES, resetInputSettings } from './settings.js';
import { onInputDevice, inputState, firstPad, readPad, formatPadLabel, testVibration, NAMES } from './gamepad.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
const button = (label, action, className = '') => {
  const node = el('button', className, label); node.type = 'button'; node.onclick = action; return node;
};

export function createSettingsWorkspace(root, legacy) {
  const workspace = el('div', 'pana-settings-workspace');
  const nav = el('nav', 'pana-settings-nav'); nav.setAttribute('aria-label', 'Categorías de ajustes');
  const main = el('div', 'pana-settings-main');
  const aside = el('aside', 'pana-input-monitor');
  const status = el('p', 'pana-device-status'); status.setAttribute('role', 'status');
  const device = el('h3', 'pana-device-name');
  const connected = el('p', 'pana-device-detail');
  const foot = el('div', 'pana-settings-foot');
  const saved = el('span', '', 'Se guarda al cambiar · En todos tus juegos');
  const reset = button('Restablecer controles', () => {
    resetInputSettings(); saved.textContent = 'Controles restablecidos · Audio e imagen conservados';
  }, 'pana-reset');
  foot.append(saved, reset);
  const pages = new Map(), refreshers = [];
  let category = { keyboard: 'mouse', gamepad: 'pad', touch: 'touch' }[inputState().detected], ticking = false;

  function page(key, label, description) {
    const section = el('section', 'pana-settings-section');
    section.dataset.settingsCategory = key;
    const heading = el('h3', '', label); heading.id = `pana-category-${key}`;
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading, el('p', 'pana-category-description', description));
    const link = button(label, () => choose(key)); link.setAttribute('aria-controls', `pana-settings-${key}`);
    section.id = `pana-settings-${key}`; nav.append(link); main.append(section); pages.set(key, { section, link });
    return section;
  }
  function choose(key) {
    category = key;
    saved.textContent = key === 'game' ? 'Solo para ti en este juego' : 'Se guarda al cambiar · En todos tus juegos';
    for (const [id, p] of pages) { p.section.hidden = id !== key; p.link.setAttribute('aria-current', String(id === key)); }
    main.scrollTop = 0;
    aside.hidden = key !== 'pad';
    workspace.classList.toggle('without-monitor', key !== 'pad');
    if (key !== 'pad') setTesting(false);
  }
  function row(parent, label, detail, control) {
    const node = el('div', 'pana-setting-line');
    const copy = el('div', 'pana-setting-copy'); copy.append(el('span', 'pana-setting-label', label), el('small', '', detail));
    node.append(copy, control); parent.append(node); return node;
  }
  function range(parent, key, label, detail) {
    const wrap = el('div', 'pana-setting-range');
    const input = el('input'); input.type = 'range'; input.id = `pana-input-${key}`;
    [input.min, input.max] = INPUT_RANGES[key]; input.step = key === 'padDeadzone' ? '.01' : '.05';
    input.setAttribute('aria-label', label);
    const output = el('output'); output.htmlFor = input.id;
    input.oninput = () => setSettings({ [key]: Number(input.value) });
    refreshers.push(s => { input.value = s[key]; output.value = key === 'padDeadzone' ? `${Math.round(s[key] * 100)}%` : `${s[key].toFixed(2)}×`; });
    wrap.append(input, output); row(parent, label, detail, wrap);
  }
  function toggle(parent, key, label, detail) {
    const control = button('', () => setSettings({ [key]: !getSettings()[key] }), 'pana-switch');
    control.setAttribute('role', 'switch'); control.setAttribute('aria-label', label);
    refreshers.push(s => control.setAttribute('aria-checked', String(s[key]))); row(parent, label, detail, control);
  }
  function choices(parent, key, label, detail, values) {
    const group = el('div', 'pana-segments'); group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', label);
    const buttons = values.map(([value, name]) => {
      const b = button(name, () => setSettings({ [key]: value })); b.setAttribute('role', 'radio'); b.dataset.value = value; group.append(b); return b;
    });
    group.onkeydown = event => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]; if (!step) return;
      event.preventDefault(); const next = buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length]; next.click(); next.focus();
    };
    refreshers.push(s => buttons.forEach(b => { const on = b.dataset.value === s[key]; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }));
    row(parent, label, detail, group);
  }

  const input = el('details', 'pana-input-advanced');
  input.append(el('summary', '', 'Opciones de las ayudas'));
  choices(input, 'inputHints', 'Ayudas en pantalla', 'Automático sigue tu actividad. Elegir uno solo cambia las ayudas; puedes seguir usando los demás.', [['auto', 'Automático'], ['keyboard', 'Teclado'], ['gamepad', 'Mando'], ['touch', 'Táctil']]);
  input.append(legacy.hints);
  const mouse = page('mouse', 'Ratón y teclado', 'Ajusta cómo miras y apuntas en los juegos con cámara libre. El movimiento con teclas conserva la velocidad del juego.');
  range(mouse, 'mouseSensitivity', 'Sensibilidad del ratón', 'Velocidad horizontal de la cámara.');
  range(mouse, 'mouseVertical', 'Velocidad vertical', 'Multiplica la sensibilidad al mirar arriba y abajo.');
  toggle(mouse, 'mouseInvertY', 'Invertir eje vertical', 'Mueve el ratón hacia abajo para mirar arriba.');
  const pad = page('pad', 'Mando', 'Afina los sticks y comprueba su respuesta aquí. La zona muerta elimina pequeños movimientos involuntarios.');
  choices(pad, 'padFamily', 'Nombres de los botones', 'Detección por el nombre que informa tu navegador. Puedes corregirla si tu mando aparece como genérico.', [['auto', 'Automático'], ['xbox', 'Xbox'], ['playstation', 'PlayStation'], ['nintendo', 'Nintendo'], ['generic', 'Genérico']]);
  range(pad, 'padDeadzone', 'Zona muerta', 'Sube este valor si la cámara o el personaje se mueven solos.');
  range(pad, 'padMoveSensitivity', 'Respuesta al mover y girar', 'Acelera la respuesta del stick izquierdo. En juegos con teclas, cambia cuándo empieza el movimiento.');
  choices(pad, 'padCurve', 'Curva de los sticks', 'Suave permite apuntar con más precisión cerca del centro; rápida responde antes.', [['lineal', 'Lineal'], ['suave', 'Suave'], ['rapida', 'Rápida']]);
  range(pad, 'padLookSensitivity', 'Sensibilidad al mirar', 'Velocidad de la cámara con el stick derecho.');
  range(pad, 'padVertical', 'Velocidad vertical', 'Multiplica la velocidad al mirar arriba y abajo.');
  toggle(pad, 'padInvertY', 'Invertir eje vertical', 'Empuja el stick hacia abajo para mirar arriba.');
  range(pad, 'padCursorSpeed', 'Velocidad del cursor', 'Para juegos que apuntan o eligen con un puntero.');
  toggle(pad, 'padVibration', 'Vibración al confirmar', 'Respuesta al elegir con el mando, cuando el navegador y el mando lo permiten.');
  const vibrationStatus = el('span'); vibrationStatus.setAttribute('role', 'status');
  const vibration = button('Probar vibración', async () => { vibrationStatus.textContent = await testVibration() ? 'Prueba enviada al mando' : 'Este mando o navegador no ofrece vibración'; }, 'pana-test-button');
  const vibrationRow = el('div', 'pana-vibration-test'); vibrationRow.append(vibration, vibrationStatus); pad.append(vibrationRow);
  const touch = page('touch', 'Pantalla táctil', 'La sensibilidad se aplica al arrastrar para mirar. Los botones y joysticks de cada juego mantienen sus acciones.');
  range(touch, 'touchSensitivity', 'Sensibilidad al arrastrar', 'Velocidad de la cámara al deslizar el dedo.');
  toggle(touch, 'touchInvertY', 'Invertir eje vertical', 'Arrastra hacia abajo para mirar arriba.'); touch.append(...legacy.touch);
  const image = page('image', 'Imagen', 'Elige nitidez o rendimiento. La resolución se adapta al instante; las sombras se actualizan al cargar la siguiente escena.'); image.append(...legacy.image);
  const audio = page('audio', 'Audio', 'El volumen general controla todo el sonido. La música se mezcla por debajo de ese nivel.'); audio.append(...legacy.audio);
  if (legacy.game.length) page('game', legacy.title, 'Opciones personales de este juego. No cambian los ajustes de la sala.').append(...legacy.game);
  for (const [key, section] of [['keyboard', mouse], ['gamepad', pad], ['touch', touch]]) {
    const help = legacy.help?.[key];
    if (help) {
      // Each device has its own page: its instructions remain visible when a
      // mouse is used to tune a controller, without a second Controls screen.
      help.dataset.settingsHelp = key;
      const copy = el('div', 'pana-device-help');
      copy.append(el('h4', '', 'Cómo se juega'), help);
      section.insertBefore(copy, section.children[2] || null);
      const tips = (legacy.tips || []).filter(tip => key === 'keyboard' || !/\b(?:Shift|Esc|WASD)\b|pulsa [A-Z]\b|clic|ratón/i.test(tip));
      if (tips.length) {
        const advice = el('details', 'pana-input-advanced');
        advice.append(el('summary', '', 'Consejos de juego'), ...tips.map(tip => el('p', 'pana-tip', tip)));
        section.append(advice);
      }
    }
  }
  const advancedPad = el('details', 'pana-input-advanced');
  advancedPad.append(el('summary', '', 'Más ajustes del mando'));
  for (const row of [...pad.children]) if (row.matches('.pana-setting-line,.pana-vibration-test') && !row.querySelector('#pana-input-padDeadzone,#pana-input-padMoveSensitivity,#pana-input-padLookSensitivity')) advancedPad.append(row);
  pad.append(advancedPad);
  // One shared disclosure follows whichever device page is selected.
  const movePreferences = () => pages.get(category)?.section.append(input);

  // The tester uses the same shaping as gameplay, with raw input underneath.
  aside.append(el('small', 'pana-monitor-eyebrow', 'ENTRADA EN VIVO'), device, status, connected);
  const sticks = el('div', 'pana-stick-pair');
  const stickNodes = ['Izquierdo', 'Derecho'].map(label => {
    const box = el('div', 'pana-stick-block'), disc = el('div', 'pana-stick-disc');
    const dead = el('span', 'pana-stick-deadzone'), raw = el('span', 'pana-stick-raw'), dot = el('span', 'pana-stick-dot');
    disc.append(dead, raw, dot); const values = el('output', 'pana-stick-values', '0.00 / 0.00');
    box.append(el('span', '', label), disc, values); sticks.append(box); return { dead, raw, dot, values };
  });
  const buttons = el('div', 'pana-pad-buttons');
  const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3', '↑', '↓', '←', '→'];
  const caps = NAMES.map((name, index) => { const cap = el('span', 'pana-test-cap', names[index]); cap.dataset.button = name; buttons.append(cap); return cap; });
  const test = button('Probar sticks y botones', () => { choose('pad'); setTesting(!test.hasAttribute('data-pad-test-active')); }, 'pana-test-button');
  const testNote = el('p', 'pana-device-detail', 'El punto claro es la entrada del mando; el amarillo, la respuesta con tus ajustes.');
  function setTesting(on) {
    test.toggleAttribute('data-pad-test-active', on);
    test.setAttribute('aria-pressed', String(on)); test.textContent = on ? 'Terminar prueba' : 'Probar sticks y botones';
    testNote.textContent = on ? 'Mueve los sticks y pulsa botones sin navegar. B / Start termina la prueba.' : 'El punto claro es la entrada del mando; el amarillo, la respuesta con tus ajustes.';
  }
  aside.append(sticks, buttons, test, testNote);
  onInputDevice(state => {
    device.textContent = state.connected ? ({xbox:'Mando Xbox',playstation:'Mando PlayStation',nintendo:'Mando Nintendo'}[state.family] || 'Tu mando') : 'Tu mando';
    status.textContent = state.connected ? 'Mando conectado' : 'Sin mando conectado';
    connected.textContent = state.id || 'Conecta tu mando y pulsa un botón para que el navegador lo reconozca.';
    caps.forEach((cap, index) => { cap.textContent = formatPadLabel(names[index], state.family); });
    test.disabled = !state.connected;
    if (!state.connected) setTesting(false);
    if (test.hasAttribute('data-pad-test-active')) testNote.textContent = `Mueve los sticks y pulsa botones sin navegar. ${formatPadLabel('B / Start', state.family)} termina la prueba.`;
  });
  onSettings(s => { refreshers.forEach(fn => fn(s)); stickNodes.forEach(n => { n.dead.style.width = n.dead.style.height = `${s.padDeadzone * 96}px`; }); });
  workspace.append(nav, main, aside, foot); root.replaceChildren(workspace); root.classList.add('pana-settings-panel');
  choose(category);
  movePreferences();
  nav.addEventListener('click', movePreferences);
  function tick() {
    ticking = false;
    if (!root.getClientRects().length || document.hidden) { setTesting(false); return; }
    const raw = firstPad(), tuned = readPad(raw);
    stickNodes.forEach((n, i) => {
      const xy = tuned?.[i ? 'right' : 'left'] || { x: 0, y: 0 };
      n.raw.style.transform = `translate(${(raw?.axes[i * 2] || 0) * 48}px, ${(raw?.axes[i * 2 + 1] || 0) * 48}px)`;
      n.dot.style.transform = `translate(${Math.max(-1, Math.min(1, xy.x)) * 48}px, ${Math.max(-1, Math.min(1, xy.y)) * 48}px)`;
      n.values.value = `${xy.x.toFixed(2)} / ${xy.y.toFixed(2)}`;
    });
    caps.forEach((cap, i) => { const b = raw?.buttons[i]; cap.classList.toggle('pressed', !!b && (b.pressed || b.value > .4)); cap.style.setProperty('--pressure', `${(b?.value || 0) * 100}%`); });
    ticking = true; requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  function refresh() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  return { refresh };
}
