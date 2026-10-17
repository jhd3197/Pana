import { ICONS } from '/engine/icons.js';
import { createFestivalArt, setMenuImage, trackArt } from './menu-art.js';

const STEPS = ['welcome', 'car', 'track', 'ready'];
const LABELS = ['Panas', 'Carro', 'Circuito', '¡A correr!'];
const MODES = { race: ['Una carrera', 'La pista que tú quieras', 'estadio'], pana: ['Copa Pana', '4 pistas · de la ciudad al mar', 'plaza'], aventura: ['Copa Aventura', '4 pistas · descubre lo salvaje', 'selva'], agua: ['Copa del Agua', '4 pistas · salta, cruza, derrapa', 'salto'], battle: ['Globos', 'Aguanta hasta el final', 'bululu'] };

// The flow only arranges existing controls. Race setup and room authority stay in game.js.
export function createMenuFlow({ tracks, getState, pickTrack, localPlay, initial = 'welcome' }) {
  const $ = id => document.getElementById(id);
  const root = $('garage');
  let step = initial;
  root.classList.add('menu-flow');
  const sections = document.createElement('main');
  sections.className = 'menu-pages';
  sections.innerHTML = `
    <section class="menu-page welcome-page" data-page="welcome" aria-labelledby="welcome-title">
      <div class="welcome-copy"><p class="pk-eyebrow">El gran premio de los panas</p>
        <h1 id="welcome-title" tabindex="-1">Dale al <br><em>DERRAPE.</em></h1>
        <p>Elige tu carro. Lanza un mango.<br>Que gane el más pana.</p>
        <div class="play-choices">
          <button id="play-solo" class="pk-btn play-choice" type="button">${ICONS.car}<span><b>Un jugador</b><small>Tú contra los rivales</small></span></button>
          <button id="play-together" class="pk-btn play-choice" type="button">${ICONS.heart}<span><b>Dos en casa</b><small>Pantalla dividida · mismo teclado</small></span></button>
        </div>
        <p id="welcome-room" class="welcome-room" hidden>Ya estás en una sala. Elige tu carro para reunirte con tus panas.</p>
      </div>
      <p class="festival-caption">12 circuitos. 3 copas. Puro vacilón.</p>
    </section>
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
    </section>
    <section class="menu-page ready-page" data-page="ready" aria-labelledby="ready-title">
      <div class="ready-art"><img id="ready-art" alt="" decoding="async"><div><p id="ready-format" class="pk-eyebrow"></p><h1 id="ready-title" tabindex="-1"></h1><p id="ready-route"></p></div></div>
      <div class="ready-options"><p class="pk-eyebrow">Todo listo para la salida</p><div class="ready-driver">${ICONS.car}<div><b id="ready-car"></b><span id="ready-wheels"></span></div><button class="pk-btn pk-btn--sm" id="change-car" type="button">Cambiar</button></div><div id="race-options"></div><div id="ready-room"></div><p id="ready-controls"></p><div id="ready-launch"></div></div>
    </section>`;
  const festival = document.createElement('div');
  festival.className = 'festival-art'; festival.setAttribute('aria-hidden', 'true');
  root.prepend(festival);
  root.append(sections);
  const art = createFestivalArt(festival);
  const move = (node, target) => target.append(node);
  const page = name => sections.querySelector(`[data-page="${name}"]`);
  const bar = root.querySelector('.bar');
  bar.querySelector('.brand span').textContent = 'Gran Premio';
  bar.querySelector('.steps').innerHTML = STEPS.map((id, i) => `<button type="button" class="step" data-step="${id}"><span>${i + 1}</span>${LABELS[i]}</button>`).join('');
  move($('settings'), bar);
  const online = $('go-online');
  online.className = 'pk-btn play-choice';
  online.innerHTML = `${ICONS.share}<span><b>Con panas online</b><small>Comparte el enlace y arranquen</small></span>`;
  move(online, sections.querySelector('.play-choices'));
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
    button.replaceChildren(img, label);
  }
  // Preserve #setup for its existing online visibility and options handlers.
  $('setup').querySelector('.setup-row').remove();
  move($('setup'), $('race-options'));
  move($('lobby'), $('ready-room'));
  for (const id of ['launch-note', 'play', 'lobby-solo']) move($(id), $('ready-launch'));
  root.querySelector('.launch').remove();
  const footer = document.createElement('footer');
  footer.className = 'menu-footer';
  footer.innerHTML = `<button id="menu-back" class="pk-btn" type="button">Atrás</button><p id="menu-summary"></p><button id="menu-next" class="pk-btn pk-btn--primary" type="button">Elegir circuito</button>`;
  root.append(footer);
  move($('play'), footer);
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
    const format = MODES[state.mode]?.[0] || 'Carrera';
    const launchTrack = cup ? tracks.find(t => t.id === cup.stages[0].track) : state.track;
    setMenuImage($('circuit-art'), trackArt(state.track.id));
    setMenuImage($('ready-art'), trackArt(launchTrack.id));
    $('ready-title').textContent = cup?.name || state.track.name;
    $('ready-format').textContent = state.online ? 'Carrera con panas' : state.split ? 'Dos panas · pantalla dividida' : format;
    $('ready-route').textContent = cup ? `La primera parada: ${launchTrack.name}. ${cup.stages.length} carreras para llevarte la copa.` : state.track.blurb;
    $('ready-car').textContent = state.car.name;
    $('ready-wheels').textContent = state.wheel.name;
    $('ready-controls').textContent = state.split && !state.online ? 'Pana 1: WASD · Pana 2: flechas. También pueden usar controles.' : 'Acelera con W o ↑ · derrapa con Shift · lanza con E. En el teléfono, toca los controles.';
    $('menu-summary').textContent = `${state.car.name} · ${cup?.name || state.track.name}`;
    $('circuit-list-title').textContent = cup ? 'Las 4 paradas · en este orden' : 'Los 12 circuitos';
    $('circuit-grid').hidden = !!cup;
    $('track-authority').textContent = state.online ? state.canConfigure ? 'Tú eliges la aventura para la sala.' : 'El anfitrión elige la aventura.' : '';
    for (const button of gridButtons) {
      button.disabled = !state.canConfigure;
      button.setAttribute('aria-pressed', String(button.dataset.circuit === state.track.id));
    }
    for (const id of ['play-solo', 'play-together']) $(id).hidden = state.online;
    $('welcome-room').hidden = !state.online;
    $('menu-next').hidden = step === 'ready' || (step === 'welcome' && !state.online);
    $('play').hidden = step !== 'ready';
    $('menu-next').textContent = step === 'welcome' ? 'Elegir carro' : step === 'car' ? 'Elegir circuito' : 'Continuar';
    $('menu-back').hidden = step === 'welcome';
    footer.hidden = step === 'welcome' && !state.online;
  }
  function show(next, focus = true) {
    if (!STEPS.includes(next)) return;
    step = next; root.dataset.menuStep = next;
    for (const panel of sections.children) panel.hidden = panel.dataset.page !== next;
    for (const button of bar.querySelectorAll('[data-step]')) {
      if (button.dataset.step === next) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    art.show(next === 'welcome');
    $('shop').hidden = true;
    refresh();
    if (focus) (page(next).querySelector('h1') || $('next')).focus({ preventScroll: true });
  }
  for (const button of bar.querySelectorAll('[data-step]')) button.onclick = () => show(button.dataset.step);
  for (const button of root.querySelectorAll('[data-car-tab]')) button.onclick = () => carTab(button.dataset.carTab);
  $('menu-back').onclick = () => show(STEPS[STEPS.indexOf(step) - 1]);
  $('menu-next').onclick = () => show(STEPS[STEPS.indexOf(step) + 1]);
  $('play-solo').onclick = () => { localPlay(false); show('car'); };
  $('play-together').onclick = () => { localPlay(true); show('car'); };
  online.addEventListener('click', () => show('car'));
  $('change-car').onclick = () => show('car');
  carTab('cars'); show(initial, false);
  root.classList.remove('menu-pending');
  $('menu-boot').remove();
  return { refresh, show, get step() { return step; } };
}
