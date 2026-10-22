import { ICONS } from '/engine/icons.js';
import { setMenuImage, trackArt } from './menu-art.js';
import { cupById } from './cup-definitions.js';

// The room gathers in the shared lobby (engine/game-entry.js); the host's
// start takes everyone to Copa and Taller, and ¡Vámonos! on Taller races.
const STEPS = ['track', 'car'];
const LABELS = ['Copa', 'Taller'];
const MODES = { race: ['Una carrera', 'La pista que tú quieras', 'estadio'], pana: ['Copa Pana', '4 pistas · de la ciudad al mar', 'plaza'], aventura: ['Copa Aventura', '4 pistas · descubre lo salvaje', 'selva'], agua: ['Copa del Agua', '4 pistas · salta, cruza, derrapa', 'salto'], battle: ['Globos', 'Aguanta hasta el final', 'bululu'] };

// The flow only arranges existing controls. Race setup and room authority stay in game.js.
// start(): the lobby's start was pressed; back(): Atrás on Copa, back to the lobby.
export function createMenuFlow({ tracks, getState, pickTrack, prepared, openTaller, start, back }) {
  const $ = id => document.getElementById(id);
  const root = $('garage');
  let step = 'track', stage = 'lobby';
  root.classList.add('menu-flow');
  const sections = document.createElement('main');
  sections.className = 'menu-pages';
  sections.innerHTML = `
    <section class="menu-page car-page" data-page="car" aria-label="Elige tu carro">
      <div class="car-picker"><div class="car-tabs pk-seg" role="group" aria-label="Personalizar carro">
        <button type="button" data-car-tab="cars" aria-pressed="true">Carros</button>
        <button type="button" data-car-tab="wheels" aria-pressed="false">Cauchos</button>
      </div></div>
    </section>
    <section class="menu-page track-page" data-page="track" aria-labelledby="track-heading">
      <div class="page-heading"><div><p class="pk-eyebrow">Elige tu aventura</p><h1 id="track-heading" tabindex="-1">¿Dónde corremos?</h1></div><p id="track-authority" role="status"></p></div>
      <div class="track-layout"><div class="track-feature"><img id="circuit-art" alt="" decoding="async"><div class="circuit-caption"></div></div>
        <div class="track-options"><div id="format-options"></div><div class="circuit-list"><p id="circuit-list-title" class="pk-eyebrow">Los 12 circuitos</p><div id="circuit-grid" aria-label="Circuitos"></div></div></div>
      </div>
    </section>`;
  root.append(sections);
  const move = (node, target) => target.append(node);
  const page = name => sections.querySelector(`[data-page="${name}"]`);
  const bar = root.querySelector('.bar');
  bar.querySelector('.brand span').textContent = 'Gran Premio';
  bar.querySelector('.steps').innerHTML = STEPS.map((id, i) => `<button type="button" class="step" data-step="${id}"><span>${i + 1}</span>${LABELS[i]}</button>`).join('');
  move($('settings'), bar);
  // Playing alone (no ?room=), the lobby can open an online room to invite panas.
  const online = $('go-online');
  online.className = 'pk-btn';
  online.innerHTML = `${ICONS.share} Jugar con panas online`;
  $('room-lobby').querySelector('.pk-lobby-foot').prepend(online, $('lobby-solo'));
  move(root.querySelector('.info'), page('car'));
  $('car-name').tabIndex = -1;
  move(root.querySelector('.tools'), page('car'));
  const picker = sections.querySelector('.car-picker');
  for (const node of [$('car-lineup'), root.querySelector('.wheel-info'), $('wheel-lineup')]) move(node, picker);
  for (const node of [root.querySelector('.track-pick'), root.querySelector('.track-map')]) move(node, sections.querySelector('.circuit-caption'));
  move($('mode-pick'), $('format-options'));
  move($('cup-stages'), sections.querySelector('.circuit-list'));
  move($('setup-note'), sections.querySelector('.track-options'));
  $('mode-pick').className = 'format-picker';
  for (const button of $('mode-pick').querySelectorAll('button')) {
    const [title, subtitle, id] = MODES[button.dataset.mode];
    const label = document.createElement('span');
    label.innerHTML = `<b>${title}</b><small>${subtitle}</small>`;
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; setMenuImage(img, trackArt(id, true));
    // renderSetup has already restored earned and legacy trophies on startup.
    const trophies = [...button.querySelectorAll('.mode-trophy, .mode-legacy')];
    button.replaceChildren(img, label, ...trophies);
    if (['pana', 'aventura', 'agua'].includes(button.dataset.mode)) {
      const cup = cupById(button.dataset.mode);
      const collage = document.createElement('div'); collage.className = 'cup-collage';
      const route = document.createElement('span'); route.className = 'cup-route';
      for (const [i, stage] of cup.stages.entries()) {
        const shot = new Image(); shot.alt = ''; shot.loading = 'lazy';
        setMenuImage(shot, trackArt(stage.track, true)); collage.append(shot);
        const stop = document.createElement('small'); stop.textContent = `${i + 1} ${tracks.find(t => t.id === stage.track)?.name || stage.track}`; route.append(stop);
      }
      img.replaceWith(collage); label.append(route); button.classList.add('cup-choice');
    }
  }
  // Preserve #setup for its existing online visibility and options handlers:
  // rivals, laps, mirror and split screen are room settings in the lobby.
  $('setup').querySelector('.setup-row').remove();
  for (const id of ['launch-note', 'setup', 'lobby']) move($(id), $('lobby-settings'));
  // Every lobby setting reads the same: a label and its choices. The old
  // switches and the bots checkbox stay (game.js drives them) but hide;
  // these rows press them. Split screen is how many panas share this one
  // screen, up to two, and only while you are alone in the room.
  const choiceRows = [];
  function choiceRow(id, label, choices, control, isOn, pick) {
    const row = document.createElement('div'); row.className = 'setup-row lobby-choice'; row.id = id;
    const name = document.createElement('span'); name.className = 'pk-eyebrow'; name.textContent = label;
    const seg = document.createElement('div'); seg.className = 'pk-seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', label);
    const buttons = choices.map(([on, text]) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.dataset.choice = String(on);
      button.onclick = () => { if (isOn() !== on) pick(on); refreshChoices(); };
      return button;
    });
    seg.append(...buttons); row.append(name, seg); $('setup').append(row);
    // Out of the laps row, which hides online, so only its own state hides this row.
    const original = control.closest('label'); original.classList.add('is-proxied'); $('setup').append(original);
    choiceRows.push(() => {
      // Hidden by its own label, or by Carreritas's room panel when offline (not by the lobby itself hiding for a race).
      const off = control.closest('[hidden]:not(label)');
      row.hidden = control.closest('label').hidden || !!(off && $('lobby-settings').contains(off));
      for (const b of buttons) { b.setAttribute('aria-pressed', String(b.dataset.choice === String(isOn()))); b.disabled = control.disabled; }
    });
  }
  const switched = id => () => $(id).getAttribute('aria-checked') === 'true';
  choiceRow('lobby-grid', 'Parrilla', [[true, 'Con rivales'], [false, 'Solo panas']], $('lobby-bots'), () => $('lobby-bots').checked,
    on => { $('lobby-bots').checked = on; $('lobby-bots').dispatchEvent(new Event('change')); });
  choiceRow('lobby-split', 'En esta pantalla', [[false, '1 pana'], [true, '2 panas']], $('split'), switched('split'), () => $('split').click());
  choiceRow('lobby-mirror', 'Pista', [[false, 'Normal'], [true, 'Espejo']], $('mirror'), switched('mirror'), () => $('mirror').click());
  const refreshChoices = () => choiceRows.forEach(refresh => refresh());
  const play = $('play');   // ¡Vámonos! moves to the footer below
  root.querySelector('.launch').remove();
  const footer = document.createElement('footer');
  footer.className = 'menu-footer';
  footer.innerHTML = `<button id="menu-back" class="pk-btn" type="button" data-pad-back>Atrás</button><button id="menu-summary" type="button" aria-label="Cambiar circuito"></button><button id="menu-next" class="pk-btn pk-btn--primary" type="button">Elegir circuito</button>`;
  root.append(footer);
  move(play, footer);
  const gridButtons = tracks.map((track, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'circuit-choice'; button.dataset.circuit = track.id;
    button.setAttribute('aria-pressed', 'false');
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; setMenuImage(img, trackArt(track.id, true));
    const label = document.createElement('span'); label.textContent = track.name;
    button.append(img, label); button.onclick = () => { if (!button.disabled) pickTrack(index); };
    $('circuit-grid').append(button);
    return button;
  });
  function carTab(tab) {
    root.dataset.carTab = tab;
    $('car-lineup').hidden = tab !== 'cars';
    $('wheel-lineup').hidden = tab !== 'wheels';
    root.querySelector('.wheel-info').hidden = tab !== 'wheels';
    for (const b of root.querySelectorAll('[data-car-tab]')) b.setAttribute('aria-pressed', String(b.dataset.carTab === tab));
  }
  function refresh() {
    const state = getState(), cup = state.cup;
    page('track').classList.toggle('is-cup', !!cup);
    const format = MODES[state.mode]?.[0] || 'Carrera';
    const launchTrack = cup ? tracks.find(t => t.id === cup.stages[0].track) : state.track;
    setMenuImage($('circuit-art'), trackArt(state.track.id));
    $('menu-summary').textContent = `${format}: ${cup?.name || launchTrack.name} · ${state.car.name}${state.split && !state.online ? ' · dos panas' : ''}`;
    $('circuit-list-title').textContent = cup ? 'Las 4 paradas · en este orden' : 'Los 12 circuitos';
    $('circuit-grid').hidden = !!cup;
    $('track-authority').textContent = state.online ? state.canConfigure ? 'Tú eliges la aventura para la sala.' : 'El anfitrión elige la aventura.' : '';
    for (const button of gridButtons) {
      button.disabled = !state.canConfigure;
      button.setAttribute('aria-pressed', String(button.dataset.circuit === state.track.id));
    }
    refreshChoices();
    $('menu-next').hidden = step === 'car';
    $('play').hidden = step !== 'car';
    $('menu-next').textContent = 'Siguiente · Taller';
    // Only who runs the room takes it back to the lobby.
    $('menu-back').hidden = step === 'track' && !state.canConfigure;
  }
  // The lobby shows while the room gathers, never over the race.
  const lobby = $('room-lobby');
  let lastMode = 'garage';
  function sync(mode = 'garage') {
    // The taller belongs to the Taller page: it closes when the race loads
    // and opens again when the race comes back to it.
    if (mode !== lastMode) {
      if (mode !== 'garage' && !$('shop').hidden) $('shop-close').click();
      else if (mode === 'garage' && step === 'car') openTaller?.();
      lastMode = mode;
    }
    const hide = stage !== 'lobby' || mode !== 'garage';
    if (lobby.hidden !== hide) { lobby.hidden = hide; if (!hide) refreshChoices(); }
  }
  // The garage screen hides when a race takes over (also with ?manual, which
  // stops the frame loop that calls sync).
  new MutationObserver(() => sync(root.classList.contains('hidden') ? 'race' : 'garage')).observe(root, { attributes: true, attributeFilter: ['class'] });
  function enter(next) {
    if (next === stage) return;
    stage = next;
    if (stage === 'garage') show('track');
    sync();
  }
  function show(next, focus = true) {
    if (!STEPS.includes(next)) return;
    step = next; root.dataset.menuStep = next;
    for (const panel of sections.children) panel.hidden = panel.dataset.page !== next;
    for (const button of bar.querySelectorAll('[data-step]')) {
      if (button.dataset.step === next) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    // The Taller page is the taller: it opens docked; other pages close it.
    if (next === 'car') openTaller?.(); else $('shop').hidden = true;
    refresh();
    if (focus) (page(next).querySelector('h1') || $('next')).focus({ preventScroll: true });
  }
  for (const button of bar.querySelectorAll('[data-step]')) button.onclick = () => show(button.dataset.step);
  for (const button of root.querySelectorAll('[data-car-tab]')) button.onclick = () => carTab(button.dataset.carTab);
  $('menu-summary').onclick = () => show('track');
  $('menu-back').onclick = () => step === 'track' ? back() : show(STEPS[STEPS.indexOf(step) - 1]);
  $('menu-next').onclick = () => show(STEPS[STEPS.indexOf(step) + 1]);
  $('start').onclick = () => start();
  carTab('cars'); show('track', false); sync();
  prepared.then(() => {
    root.classList.remove('menu-pending'); $('menu-boot').remove();
    performance.mark('carreritas:garage-ready');
  }).catch(error => {
    console.error('Garage preparation failed', error);
    const boot = $('menu-boot'); boot.replaceChildren();
    const message = document.createElement('p'); message.textContent = 'No pudimos preparar el taller.';
    const retry = document.createElement('button'); retry.className = 'pk-btn'; retry.textContent = 'Volver a intentar'; retry.onclick = () => location.reload();
    boot.append(message, retry);
  });
  return { refresh, show, enter, sync, ready: prepared, get step() { return step; }, get stage() { return stage; } };
}
