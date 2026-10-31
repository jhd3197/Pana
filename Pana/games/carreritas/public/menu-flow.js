import { paintOf } from './shop.js';
import { ICONS } from '/engine/icons.js';
import { setMenuImage, trackArt } from './menu-art.js';
import { trackPieces, vesselById, carNivel } from './parts.js';
import { CUPS, cupById } from './cup-definitions.js';
// Absent or empty in the public build; the pana.sh overlay fills it.
const { PREMIUM_MODES = {} } = await import('./premium-tracks.js').catch(() => ({}));
import { loc, locn } from '/engine/i18n.js';

// The room gathers in the shared lobby (engine/game-entry.js); the host's
// start takes everyone to Copa and Taller, and ¡Vámonos! on Taller races.
const STEPS = ['track', 'car'];
const LABELS = [loc('Pista'), loc('Taller')];
const MODES = { race: [loc('Una carrera'), loc('La pista que tú quieras'), 'estadio'], pana: [loc('Copa Pana'), loc('4 pistas · del estadio al cielo'), 'estadio'], ...PREMIUM_MODES, battle: [loc('Globos'), loc('Aguanta hasta el final'), 'delta'] };

// The flow only arranges existing controls. Race setup and room authority stay in game.js.
// start(): the lobby's start was pressed; back(): Atrás on Copa, back to the lobby.
export function createMenuFlow({ tracks, getState, pickTrack, prepared, openTaller, start, back }) {
  const $ = id => document.getElementById(id);
  const root = $('garage');
  let step = 'track', stage = 'lobby', personalKit = false;
  const returnSala = () => { personalKit = false; stage = 'lobby'; $('shop').hidden = true; sync(); back(); };
  root.classList.add('menu-flow');
  const sections = document.createElement('main');
  sections.className = 'menu-pages';
  sections.innerHTML = `
    <section class="menu-page track-page" data-page="track" aria-labelledby="track-heading">
      <div class="page-heading"><div><p class="pk-eyebrow">Elige tu aventura</p><h1 id="track-heading" tabindex="-1">¿Dónde corremos?</h1></div><p id="track-authority" role="status"></p></div>
      <div class="track-layout"><div class="track-feature"><img id="circuit-blur" alt=""><img id="circuit-art" alt="" decoding="async"><div class="cup-preview"></div><div class="circuit-caption"><div class="cup-preview-caption"></div></div></div>
        <div class="track-options"><div class="track-tabs" role="tablist" aria-label="Tipo de carrera"><button type="button" role="tab" data-format="race">Una carrera <small>${tracks.length}</small></button><button type="button" role="tab" data-format="cups">Copas <small>${CUPS.length}</small></button><button type="button" role="tab" data-format="battle">Globos</button></div><div id="format-options"></div><div class="circuit-list"><p id="circuit-list-title" class="pk-eyebrow">${loc('Los {n} circuitos', { n: tracks.length })}</p><div id="circuit-grid" aria-label="Circuitos"></div></div></div>
      </div>
    </section>`;
  root.append(sections);
  const move = (node, target) => target.append(node);
  const page = name => sections.querySelector(`[data-page="${name}"]`);
  const bar = root.querySelector('.bar');
  bar.querySelector('.brand').hidden = true;
  const salaBack = bar.querySelector('.hub-link'); salaBack.textContent = loc('‹ Sala'); salaBack.removeAttribute('href'); salaBack.onclick = returnSala; salaBack.setAttribute('role', 'button'); salaBack.tabIndex = 0;
  bar.querySelector('.steps').innerHTML = STEPS.map((id, i) => `<button type="button" class="step" data-step="${id}"><span>${i + 1}</span>${LABELS[i]}</button>`).join('');
  move($('settings'), bar);
  // Playing alone (no ?room=), the lobby can open an online room to invite panas.
  const online = $('go-online');
  online.className = 'pk-btn';
  online.innerHTML = `${ICONS.share} ${loc('Jugar con panas online')}`;
  $('room-lobby').querySelector('.pk-lobby-foot').prepend(online, $('lobby-solo'));
  for (const node of [root.querySelector('.track-pick'), root.querySelector('.track-map')]) move(node, sections.querySelector('.circuit-caption'));
  move($('mode-pick'), $('format-options'));
  let formatTab = 'race';
  for (const button of sections.querySelectorAll('[data-format]')) button.onclick = () => {
    const mode = button.dataset.format;
    const target = $('mode-pick').querySelector(`[data-mode="${mode === 'cups' ? (getState().cup?.id || 'pana') : mode}"]`);
    if (target.disabled || target.hidden) return;
    formatTab = mode; target.click(); refresh();
  };
  move($('cup-stages'), sections.querySelector('.circuit-list'));
  const legend = document.createElement('p'); legend.className = 'track-key'; legend.innerHTML = '<span><i class="boat"></i> usa lancha</span><span><i class="air"></i> usa avioneta</span><span>Sin punto: solo carro</span>'; sections.querySelector('.track-options').append(legend);
  move($('setup-note'), sections.querySelector('.track-options'));
  const vehicleChips = document.createElement('div'); vehicleChips.className = 'track-vehicles'; sections.querySelector('.circuit-caption').append(vehicleChips);
  $('mode-pick').className = 'format-picker';
  for (const button of $('mode-pick').querySelectorAll('button')) {
    // The page lists every cup; the public build only has the cups PREMIUM_MODES leaves in.
    if (!MODES[button.dataset.mode]) { button.remove(); continue; }
    const [title, subtitle, id] = MODES[button.dataset.mode];
    const label = document.createElement('span');
    label.innerHTML = `<b>${title}</b><small>${subtitle}</small>`;
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; setMenuImage(img, trackArt(id, true));
    // renderSetup has already restored earned and legacy trophies on startup.
    const trophies = [...button.querySelectorAll('.mode-trophy, .mode-legacy')];
    button.replaceChildren(img, label, ...trophies);
    if (CUPS.some(cup => cup.id === button.dataset.mode)) {
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
  choiceRow('lobby-grid', loc('Jugar con'), [[false, loc('Solo panas')], [true, loc('Panas y bots')]], $('lobby-bots'), () => $('lobby-bots').checked,
    on => { $('lobby-bots').checked = on; $('lobby-bots').dispatchEvent(new Event('change')); });
  choiceRow('lobby-split', loc('En esta pantalla'), [[false, loc('1 pana')], [true, loc('2 panas')]], $('split'), switched('split'), () => $('split').click());
  choiceRow('lobby-mirror', loc('Pista'), [[false, loc('Normal')], [true, loc('Espejo')]], $('mirror'), switched('mirror'), () => $('mirror').click());
  const refreshChoices = () => choiceRows.forEach(refresh => refresh());
  const play = $('play');   // ¡Vámonos! moves to the footer below
  root.querySelector('.launch').remove();
  const footer = document.createElement('footer');
  footer.className = 'menu-footer';
  footer.innerHTML = `<button id="menu-back" class="pk-btn" type="button" data-pad-back>Atrás</button><button id="menu-summary" type="button" aria-label="Cambiar circuito"></button><span id="picker-mirror"></span><button id="menu-next" class="pk-btn pk-btn--primary" type="button">Elegir circuito</button>`;
  root.append(footer);
  move(play, footer);
  const gridButtons = tracks.map((track, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'circuit-choice'; button.dataset.circuit = track.id;
    button.setAttribute('aria-pressed', 'false');
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; setMenuImage(img, trackArt(track.id, true));
    const label = document.createElement('span'); label.textContent = track.name;
    for (const kind of trackPieces(track).filter(k => k !== 'car')) { const dot = document.createElement('i'); dot.className = kind; dot.title = kind === 'boat' ? loc('Usa lancha') : loc('Usa avioneta'); label.append(dot); }
    button.append(img, label); button.onclick = () => { if (!button.disabled) pickTrack(index); };
    $('circuit-grid').append(button);
    return button;
  });
  function refresh() {
    const state = getState(), cup = state.cup;
    document.dispatchEvent(new Event('pana:sala-update'));
    formatTab = cup ? 'cups' : state.mode === 'battle' ? 'battle' : 'race';
    root.dataset.format = formatTab;
    for (const b of sections.querySelectorAll('[data-format]')) { b.setAttribute('aria-selected', String(b.dataset.format === formatTab)); b.disabled = !state.canConfigure || (b.dataset.format === 'battle' && state.online); }
    page('track').classList.toggle('is-cup', !!cup);
    const format = MODES[state.mode]?.[0] || loc('Carrera');
    const launchTrack = cup ? tracks.find(t => t.id === cup.stages[0].track) : state.track;
    const cupPreview = sections.querySelector('.cup-preview'), cupCaption = sections.querySelector('.cup-preview-caption');
    if (cup && cupPreview.dataset.cup !== cup.id) {
      cupPreview.dataset.cup = cup.id;
      cupPreview.replaceChildren(...cup.stages.map(stage => { const img = new Image(); img.alt = tracks.find(t => t.id === stage.track)?.name || stage.track; setMenuImage(img,trackArt(stage.track,true)); return img; }));
      const title = document.createElement('h2'), route = document.createElement('p'); title.textContent = cup.name; route.textContent = cup.stages.map(s => tracks.find(t => t.id === s.track)?.name || s.track).join(' → '); cupCaption.replaceChildren(title,route);
    }
    setMenuImage($('circuit-art'), state.track.id === 'sabana' ? './images/menu/sabana-preview.jpg' : trackArt(state.track.id));
    $('circuit-art').classList.toggle('full-preview', state.track.id === 'sabana');
    setMenuImage($('circuit-blur'), trackArt(state.track.id));
    const use = trackPieces(state.track);
    vehicleChips.replaceChildren(...['car', 'boat', 'air'].map(kind => { const n = document.createElement('span'); n.className = use.includes(kind) ? 'in-use' : ''; n.textContent = kind === 'car' ? state.car.name : vesselById(kind, state[kind]).name; n.title = `${({car:loc('Carro'),boat:loc('Lancha'),air:loc('Avioneta')})[kind]} · ${use.includes(kind) ? loc('Se usa en esta pista') : loc('No se usa en esta pista')}`; return n; }));
    $('picker-mirror').textContent = $('mirror').disabled ? loc('Espejo: gana un trofeo para desbloquearlo') : $('mirror').getAttribute('aria-checked') === 'true' ? loc('Pista en espejo') : loc('Pista normal');
    for (const b of $('mode-pick').querySelectorAll('.cup-choice')) { let trophy = b.querySelector('.cup-earned'); if (!trophy) { trophy = document.createElement('small'); trophy.className = 'cup-earned'; b.append(trophy); } trophy.textContent = b.title || loc('Sin trofeo'); }
    $('menu-summary').textContent = `${format}: ${cup?.name || launchTrack.name} · ${state.car.name}${state.split && !state.online ? ' · ' + loc('dos panas') : ''}`;
    $('circuit-list-title').textContent = cup ? loc('Las 4 paradas · en este orden') : loc('Los {n} circuitos', { n: tracks.length });
    $('circuit-grid').hidden = !!cup; $('cup-stages').hidden = true;
    $('track-authority').textContent = state.online ? state.canConfigure ? loc('Tú eliges la aventura para la sala.') : loc('El anfitrión elige la aventura.') : '';
    for (const button of gridButtons) {
      button.disabled = !state.canConfigure;
      button.setAttribute('aria-pressed', String(button.dataset.circuit === state.track.id));
    }
    refreshChoices();
    $('menu-next').hidden = step === 'car';
    $('play').hidden = step !== 'car';
    $('menu-next').textContent = loc('Siguiente · Taller');
    // Only who runs the room takes it back to the lobby.
    $('menu-back').hidden = step === 'track' && !state.canConfigure;
  }
  // The lobby shows while the room gathers, never over the race.
  const lobby = $('room-lobby');
  lobby.panaSala = {
    kitLabel: loc('Mi taller'), ensureRoom: () => $('go-online').onclick(), openKit: () => { personalKit = true; stage = 'garage'; show('car'); sync(); },
    read: () => { const state = getState(), info = state.sala, laps = $('laps-pick').querySelector('[aria-pressed=true]')?.textContent || '3';
      const describe = (p, mine) => { const data = mine ? info.local : { def: info.cars[p.car] || info.cars[0], wheel: p.wheel, cosmetics: typeof p.cosmetics === 'string' ? JSON.parse(p.cosmetics || '{}') : p.cosmetics || {} };
        const level = carNivel(data.def, data.wheel, data.cosmetics.parts); return { id: p.id, kit: data.def.name, level, color: paintOf(data.cosmetics,data.def.color) }; };
      return { connection: info.connection, players: info.players.map(p => describe(p, false)), local: describe({}, true), summary: `${$('launch-note').textContent} · ${$('difficulty-pick').querySelector('[aria-pressed=true]')?.textContent || loc('Normal')} · ${locn(laps, '{n} vueltas', '{n} vueltas')}` };
    },
  };
  let lastMode = 'garage';
  function sync(mode = 'garage') {
    // The taller belongs to the Taller page: it closes when the race loads
    // and opens again when the race comes back to it.
    if (mode !== lastMode) {
      if (mode !== 'garage' && !$('shop').hidden) $('shop').hidden = true;
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
    if (personalKit && next === 'lobby') return;
    personalKit = false;
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
    if (focus) (next === 'car' ? $('loadout-name') : $('track-heading')).focus({ preventScroll: true });
  }
  for (const button of bar.querySelectorAll('[data-step]')) button.onclick = () => show(button.dataset.step);
  $('menu-summary').onclick = () => show('track');
  const tallerNav = document.createElement('nav'); tallerNav.className = 'tl-nav'; tallerNav.setAttribute('aria-label', loc('Preparar carrera'));
  tallerNav.innerHTML = '<button type="button" id="taller-pistas" data-pad-back>‹ Pistas</button><span>✓ Pista</span><b>2 Taller</b>';
  $('shop').prepend(tallerNav); $('taller-pistas').onclick = () => show('track');
  $('menu-back').onclick = () => step === 'track' ? returnSala() : show(STEPS[STEPS.indexOf(step) - 1]);
  $('menu-next').onclick = () => show(STEPS[STEPS.indexOf(step) + 1]);
  $('start').onclick = () => start();
  show('track', false); sync();
  prepared.then(() => {
    root.classList.remove('menu-pending'); $('menu-boot').remove();
    performance.mark('carreritas:garage-ready');
  }).catch(error => {
    console.error('Garage preparation failed', error);
    const boot = $('menu-boot'); boot.replaceChildren();
    const message = document.createElement('p'); message.textContent = loc('No pudimos preparar el taller.');
    const retry = document.createElement('button'); retry.className = 'pk-btn'; retry.textContent = loc('Volver a intentar'); retry.onclick = () => location.reload();
    boot.append(message, retry);
  });
  return { refresh, show, enter, sync, ready: prepared, get step() { return step; }, get stage() { return stage; } };
}
