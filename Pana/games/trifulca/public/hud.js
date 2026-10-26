// Trifulca's HUD: the fighters' bars (mareo, aguante, caídas; a tag partner
// waits dimmed), the bell clock, the narrator's call, the ref's count, the
// intro card, the bets, the verdict after each fight and a feed of what the
// ring is doing.
import { fighterPortrait, fightStats, createFightFeedback } from './hud-details.js';
import { inputState, formatPadLabel } from '/engine/gamepad.js';
import { fillRoster } from '/engine/results.js';
import { lineFor, say } from './narrator.js';
import { PAY, STAKE, INTRO, TUTORIAL } from './rules.js';
import { MAREO_CALMA, KO_CAIDAS, dodgeCue } from './fight-rules.js';
import { loc, locn, locKey, formatList, language } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id);
const HOW = { ko: 'K.O.', cuenta: loc('Cuenta de diez'), puntos: loc('Por puntos'), publico: loc('Decidió el público'), calma: loc('¡Cálmate!'), abandono: loc('Abandono') };
export const CORNER_NAMES = { red: loc('rojo'), blue: loc('azul'), yellow: loc('amarillo'), green: loc('verde') };
const LEFT = ['red', 'yellow'];
const STAGES = { cuartos: loc('Cuartos de final'), semifinal: loc('Semifinal'), final: loc('¡La final!') };
const MODES = { queda: loc('Ganador se queda'), libre: loc('Trifulca libre'), parejas: loc('Parejas'), torneo: loc('Torneo') };
// The tutorial, one card per step: what to do and which key does it.
export const LESSONS = {
  mover: [loc('Acércate al Profe'), loc('Camina hacia él con D o la flecha derecha. Tú siempre estás a la izquierda de la pantalla: derecha es hacia tu rival.'), ['D', '→']],
  jab: [loc('El jab'), loc('Toca J (o clic izquierdo) para un jab rápido. Pégale tres.'), ['J']],
  trompon: [loc('El trompón'), loc('Mantén J un momento: el guante se va pa\' atrás temblando y sale el trompón. Lento pero pega duro.'), ['J mantener']],
  cubrir: [loc('Cubrirse'), loc('El Profe te va a tirar jabs. Mantén K (o clic derecho) para cubrirte.'), ['K']],
  esquivar: [loc('Esquivar'), loc('Cuando el Profe cargue el trompón verás ¡ESQUIVA! Pulsa Espacio justo ahí.'), ['Espacio']],
  contra: [loc('El contragolpe'), loc('Esquiva el trompón y pega J: atraviesa la guardia y pega más. Aquí tienes dos segundos para practicar; en la pelea responde enseguida.'), ['Espacio', 'J']],
  agarrar: [loc('Agarrar'), loc('El Profe se cubre. Pégate y pulsa L: el agarre rompe la guardia y lo manda pa\'l público.'), ['L']],
  pararse: [loc('¡Párate!'), loc('Te tumbaron. Machaca J (o cualquier botón) para pararte antes del diez.'), ['J', 'J', 'J']],
};
// It runs on translated text, so the fragments it swaps are phrases too, and
// a translation keeps them word for word (and never uses I, O, T… as words).
const SPACE = loc('Espacio'), escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLICKS = new RegExp(` \\((?:${escape(loc('o clic izquierdo'))}|${escape(loc('o clic derecho'))})\\)`, 'g');
const KEY_WORDS = new RegExp(`(?<![\\p{L}])(?:${escape(SPACE)}|J|K|L|T|I|U|O)(?![\\p{L}])`, 'gu');
const deviceText = text => {
  const device = inputState().device;
  if (device === 'keyboard') return text;
  const touch = device === 'touch', keys = touch ? { [SPACE]: loc('Esquivar'), J: loc('Golpe'), K: loc('Cubrir'), L: loc('Agarrar'), T: loc('¡Dale!'), I: loc('Patada'), U: loc('Barrida'), O: loc('Volteo') } : { [SPACE]: 'B', J: 'A', K: 'LB', L: 'X', T: 'Y', I: 'RT', U: 'LT', O: 'RB' };
  return text.replace(CLICKS, '').replaceAll(loc('D o la flecha derecha'), touch ? loc('el botón Derecha') : loc('el stick izquierdo hacia la derecha'))
    .replace(KEY_WORDS, key => touch ? keys[key] : formatPadLabel(keys[key]));
};
// Lists of names: Spanish keeps its "A y B y C"; other languages their own list.
const list = (names) => language === 'es' ? names.join(' y ') : formatList(names);
const spanish = (names) => names.join(' y ');
const fill = (text, vars, join) => text.replace(/\{(\w+)\}/g, (m, k) => vars?.[k] == null ? m : Array.isArray(vars[k]) ? join(vars[k]) : vars[k]);
const el = (tag, className = '', text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
// Names and nicknames are shown as they are.
const raw = (tag, className = '', text = '') => Object.assign(el(tag, className, text), { translate: false });

export function createHud({ me, voice = () => true }) {
  let state = null, callTimer = 0, feedItems = [], barsKey = '', betsKey = '';
  const blocks = new Map(), feedback = createFightFeedback();
  let verdictKey = '';

  const name = (id) => state?.players.find(p => p.id === id)?.name ?? loc('Alguien');
  const player = (id) => state?.players.find(p => p.id === id);
  const names = (ids = []) => list(ids.map(name));

  // `text` is Spanish source (locKey) with vars: the banner shows it in the
  // player's language, the voice always speaks the Spanish.
  function call(text, { vars, big = false, ref = false, speak = false } = {}) {
    const node = $('call'); node.textContent = fill(loc(text), vars, list);
    node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on');
    node.classList.toggle('is-big', big); node.classList.toggle('is-ref', ref);
    callTimer = big ? 2.4 : 1.6;
    if (speak) say(fill(text, vars, spanish), { enabled: voice(), ref });
  }
  function drawFeed() { $('feed').replaceChildren(...feedItems.map(f => el('li', '', f.text))); }
  function feed(text) { feedItems.push({ text, t: 4 }); if (feedItems.length > 4) feedItems.shift(); drawFeed(); }

  // Práctica: alone with the bots, the narrator coaches the rock-paper-scissors.
  const TIPS = {
    wind: loc('Tip: ¡pégale un jab mientras carga el trompón, o esquiva con Espacio!'),
    block: loc('Tip: si se cubre, agárralo con L: el agarre le gana a la guardia.'),
    dizzy: loc('Tip: está mareado: un golpe limpio ahora lo tumba.'),
    caidaMe: loc('Tip: ¡machaca J para pararte antes del diez!'),
    out: loc('Tip: el público te devuelve al ring; no te quedes en la orilla.'),
    dodged: loc('Tip: después de un trompón fallado quedas abierto. ¡Cuidado!'),
  };
  const tipped = new Set();
  function coach(e) {
    const id = me(), mine = state?.bodies?.find(b => b.id === id);
    if (!mine || state.players.filter(p => !p.bot).length > 1) return;
    const foe = (x) => x != null && x !== id;
    const key = e.type === 'wind' && foe(e.id) ? 'wind' : e.type === 'block' && foe(e.id) && e.by === id ? 'block'
      : e.type === 'dizzy' && foe(e.id) ? 'dizzy' : e.type === 'caida' && e.id === id ? 'caidaMe'
        : e.type === 'out' && e.id === id ? 'out' : e.type === 'dodged' && e.by === id ? 'dodged' : null;
    if (!key || tipped.has(key)) return;
    tipped.add(key); setTimeout(() => feed(deviceText(TIPS[key])), 900);
  }

  function react(e) {
    coach(e);
    if (state) feedback.react(e, state);
    const line = lineFor(e, name, names);
    if (line) call(line.text, { vars: line.vars, big: line.big, ref: line.ref, speak: line.say });
    if (e.type === 'count') {
      const node = $('count'); node.textContent = e.n; node.hidden = false;
      node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on');
      if (e.n === 5 || e.n === 8) call(locKey('¡Párate!'), { ref: true, speak: true });
    }
    if (['rise', 'fin', 'intro', 'fuera'].includes(e.type)) $('count').hidden = true;
    if (e.type === 'bet') feed(loc('{name}: ¡Por {amount} dolitas al {corner}!', { name: name(e.id), amount: e.amount, corner: CORNER_NAMES[e.corner] }));
    if (e.type === 'empujon' && e.back) feed(loc("{name} empujó pa' dentro (+{pay})", { name: name(e.by), pay: PAY.shove }));
    if (e.type === 'agua') feed(loc('{name} dio agua en la esquina', { name: name(e.by) }));
    if (e.type === 'cheer') feed(loc('{name}: ¡Dale, dale!', { name: name(e.by) }));
    if (e.type === 'intro') introCard(e);
    if (e.type === 'tutorial-bien') feed([loc('¡Eso!'), loc('¡Bien!'), loc('¡Así mismo!')][e.count % 3]);
    if (e.type === 'tutorial') call(e.step ? locKey('¡Bien hecho!') : locKey('¡Bienvenido al tutorial!'), { big: true });
    if (e.type === 'tutorial-fin') call(locKey('¡Listo, ya sabes pelear!'), { big: true, speak: true });
    if (e.type === 'fin' && e.belt) setTimeout(() => call(e.final ? locKey('¡{name} gana el torneo y el cinturón!') : locKey('¡{name} es el campeón del barrio!'), { vars: { name: name(e.winner) }, big: true, speak: true }), 2600);
    if (e.type === 'fin' && e.streak >= 2 && !e.belt) feed(loc('{name} lleva {n} seguidas', { name: name(e.winner), n: e.streak }));
  }

  function introCard(e) {
    const bodies = state?.bodies || [];
    for (const side of ['left', 'right']) {
      const list = bodies.filter(b => LEFT.includes(b.team) === (side === 'left'));
      $(`intro-${side}`).replaceChildren(...list.map(b => {
        const p = player(b.id), card = el('div', `intro-side intro-side--${b.corner}${b.bench ? ' is-bench' : ''}`);
        if (!p) return card;
        card.append(fighterPortrait(p, state.players.indexOf(p)), raw('span', 'pk-display', p.nick), el('b', '', p.id === me() ? loc('{name} (tú)', { name: p.name }) : p.name), raw('span', '', p.from),
          el('small', '', loc('{wins} ganadas · {dolitas} dolitas', { wins: p.stats.wins, dolitas: p.dolitas })));
        return card;
      }));
    }
    $('intro-streak').textContent = e.stage ? STAGES[e.stage] : e.streak >= 2 ? loc('{name} viene con {n} seguidas', { name: name(e.red), n: e.streak }) : MODES[e.mode] || MODES.queda;
    const intro = bodies.filter(b => !b.bench).map(b => { const p = player(b.id); return p ? `${p.nick}, ${p.name}, ${p.from}` : ''; });
    // The announcer's voice reads the lineup in Spanish.
    say(`${e.stage === 'final' ? '¡La gran final! ' : ''}${intro.length > 2 ? 'Todos contra todos: ' : 'En la esquina roja, '}${intro.join(intro.length > 2 ? '. ' : '. En la esquina azul, ')}.`, { enabled: voice() }); // i18n-ignore
  }

  // One block per fighter, rebuilt when the lineup changes.
  function buildBars(bodies) {
    blocks.clear();
    for (const side of ['left', 'right']) {
      const list = bodies.filter(b => LEFT.includes(b.team) === (side === 'left'));
      $(`bars-${side}`).replaceChildren(...list.map(b => {
        const block = el('div', `fighter fighter--${b.corner}`), top = el('div', 'fighter-name');
        const title = raw('b'), nick = raw('span'), mareo = el('div', 'meter meter--mareo'), low = el('div', 'fighter-low');
        const aguante = el('div', 'meter meter--aguante'), caidas = el('span', 'caidas');
        const lag = el('em'); mareo.append(lag, el('i')); aguante.append(el('i')); low.append(aguante);
        const identity = el('div', 'fighter-identity'); identity.append(title, nick);
        top.append(fighterPortrait(player(b.id), state.players.findIndex(p => p.id === b.id)), identity, caidas);
        const labels = el('div', 'fighter-meters'), status = el('span'), energy = el('span');
        labels.append(status, energy); block.append(top, labels, mareo, low);
        caidas.append(...Array.from({ length: KO_CAIDAS }, () => el('i')));
        blocks.set(b.id, { block, title, nick, mareo, aguante, caidas, status, energy, lag });
        return block;
      }));
    }
  }
  function bar(body) {
    const b = blocks.get(body.id), p = player(body.id);
    if (!b) return;
    b.title.textContent = p ? (p.id === me() ? loc('{name} · tú', { name: p.name }) : p.name) : '';
    b.nick.textContent = body.bench ? loc('en la esquina') : p?.nick ?? '';
    b.block.classList.toggle('is-bench', !!body.bench); b.block.classList.toggle('is-out', !!body.out);
    b.mareo.style.setProperty('--fill', `${Math.min(100, body.mareo)}%`);
    b.lag.style.width = `${Math.min(100, body.mareo)}%`;
    b.aguante.classList.toggle('is-empty', body.aguante <= 0);
    b.mareo.classList.toggle('is-danger', body.mareo >= MAREO_CALMA || body.act === 'dizzy');
    b.aguante.style.setProperty('--fill', `${body.aguante}%`);
    b.status.textContent = body.act === 'down' ? loc('¡En el suelo!') : body.act === 'dizzy' ? loc('¡Mareado! Otro golpe te tumba') : loc('Mareo {n}/100', { n: Math.round(body.mareo) });
    b.energy.textContent = loc('Aguante {n}%', { n: Math.round(body.aguante) });
    b.mareo.title = loc('Los golpes suben el mareo. A 100, otro golpe limpio te tumba.');
    b.caidas.setAttribute('aria-label', loc('{n} de {max} caídas; tres es K.O.', { n: body.caidas, max: KO_CAIDAS }));
    b.caidas.dataset.label = loc('Caídas {n}/{max}', { n: body.caidas, max: KO_CAIDAS });
    [...b.caidas.children].forEach((pip, i) => pip.classList.toggle('is-down', i < body.caidas));
  }

  function bets(mine, odds) {
    const corners = Object.keys(odds), key = corners.join() + JSON.stringify(odds) + (state.bodies.map(b => b.id).join());
    if (key !== betsKey) {
      betsKey = key;
      $('bet-row').replaceChildren(...corners.map((c, i) => {
        const team = list(state.bodies.filter(b => b.team === c).map(b => name(b.id)));
        const button = el('button', `pk-btn bet bet--${c}`, loc('{n} · {team} · paga ×{odds}', { n: i + 1, team, odds: odds[c] }));
        button.dataset.corner = c; button.onclick = () => document.dispatchEvent(new CustomEvent('trifulca:bet', { detail: c }));
        return button;
      }));
    }
    for (const button of $('bet-row').children) button.classList.toggle('is-picked', mine.bet?.on === button.dataset.corner);
    $('bet-note').textContent = mine.bet ? loc('Apostaste {amount} dolitas al {corner}', { amount: mine.bet.amount, corner: CORNER_NAMES[mine.bet.on] })
      : loc('Apuesta {stake} dolitas (teclas 1 a {n})', { stake: STAKE, n: corners.length });
  }

  function tutorialCard(t) {
    $('tutorial').hidden = !t;
    if (!t) return;
    const lesson = t.done ? [loc('¡Listo, pana!'), loc('Ya sabes pelear: jab, trompón, cubrirse, esquivar, contragolpe y agarre. Ahora sube la escalera: cinco rivales del barrio, cada uno más bravo.'), []] : LESSONS[TUTORIAL[t.step].id];
    const key = `${t.step}:${t.done}:${inputState().device}:${inputState().family}`;
    $('tutorial-step').textContent = t.done ? loc('TUTORIAL COMPLETO') : loc('PASO {n} DE {total}', { n: t.step + 1, total: TUTORIAL.length });
    $('tutorial-go').hidden = !t.done; $('tutorial-skip').hidden = t.done;
    // Once it is done, the card is a menu for a controller: A on ¡A pelear!
    $('tutorial').toggleAttribute('data-pad-menu', !!t.done);
    if ($('tutorial').dataset.key === key) {
      $('tutorial-text').dataset.count = t.count; return;
    }
    $('tutorial').dataset.key = key;
    $('tutorial-title').textContent = lesson[0]; $('tutorial-text').textContent = deviceText(lesson[1]);
    const touch = matchMedia('(pointer: coarse)').matches, words = { J: loc('Golpe'), 'J mantener': loc('Golpe mantener'), K: loc('Cubrir'), Espacio: loc('Esquivar'), L: loc('Agarrar'), D: loc('Derecha'), '→': loc('hacia él') };
    const keyNames = { Espacio: SPACE, 'J mantener': loc('J mantener') };
    const pad = inputState().device === 'gamepad';
    $('tutorial-keys').replaceChildren(...lesson[2].map(k => {
      const label = keyNames[k] ?? k;
      const cap = el('kbd', 'pk-kbd', pad ? k === 'D' ? loc('Stick izq.') : k === '→' ? loc('Derecha') : deviceText(label) : touch ? words[k] || label : label);
      if (pad) cap.dataset.padKey = '';
      return cap;
    }));
    $('tutorial-dots').replaceChildren(...TUTORIAL.map((_, i) => el('li', i < t.step || t.done ? 'is-done' : i === t.step ? 'is-now' : '')));
    $('tutorial').classList.remove('is-new'); void $('tutorial').offsetWidth; $('tutorial').classList.add('is-new');
  }

  // A big call to action when the rival winds up or a counter is open.
  function prompt(myBody) {
    const node = $('prompt'), bodies = state?.bodies || [];
    let text = '';
    if (myBody && state.phase === 'fight' && !myBody.bench && !myBody.out) {
      const foe = bodies.find(b => b.id === myBody.foe);
      if (myBody.act === 'down') text = loc('¡Machaca J pa\' pararte!');
      else if (myBody.contra > 0) text = loc('¡CONTRA! J');
      else if (dodgeCue(foe) && Math.hypot(foe.x - myBody.x, foe.z - myBody.z) < 2.6) text = loc('¡ESQUIVA! Espacio');
      else if (foe?.act === 'wind') text = loc('¡Ojo! Está cargando…');
      else if (foe?.act === 'dizzy') text = loc('¡Está mareado! ¡Dale!');
      else if (foe?.act === 'open') text = loc('¡Quedó abierto! J');
    }
    text = deviceText(text);
    node.hidden = !text;
    if (text && node.textContent !== text) { node.textContent = text; node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on'); }
  }

  // The key bar lights each button while it is pressed.
  function keys(c) {
    const bar = $('keys'); if (bar.hidden) return;
    const on = { golpe: c.g || c.gp !== lastKeys.gp, cubrir: c.b, esquivar: c.e !== lastKeys.e, agarrar: c.a !== lastKeys.a, dale: c.t !== lastKeys.t, patada: c.k !== lastKeys.k, barrida: c.s !== lastKeys.s, volteo: c.v !== lastKeys.v, mover: !!(c.sx || c.sy) };
    for (const span of bar.children) {
      const k = span.dataset.key;
      if (on[k]) { span.classList.add('is-on'); clearTimeout(span._t); span._t = setTimeout(() => span.classList.remove('is-on'), c.g || c.b || k === 'mover' ? 90 : 220); }
    }
    lastKeys = { gp: c.gp, e: c.e, a: c.a, t: c.t, k: c.k, s: c.s, v: c.v };
  }
  let lastKeys = {};

  function roleText(phase, mode, myBody, mine) {
    if (phase === 'intro') return myBody ? (myBody.bench ? loc('Esperas en la esquina: tu pareja te da el relevo con L') : loc('¡Prepárate! Golpe J · Cubrirse K · Esquivar Espacio · Agarrar L')) : loc('Apuesta y dale agua a tu esquina: acércate y pulsa J');
    if (phase === 'fight') {
      if (!myBody) return loc('Eres el ring: J empuja pa\' dentro · L ¡cálmate! (mareo alto) · T ¡dale!');
      if (myBody.out) return loc('Quedaste fuera: mira cómo termina');
      if (myBody.bench) return loc('En la esquina: recuperas el aire. Tu pareja te toca con L');
      if (mode === 'libre') return loc('J golpe (mantén: trompón) · K cubrirse · Espacio esquivar · L junto a una silla o caja: agarrarla, L otra vez: lanzarla · I patada · U barrida · O volteo');
      if (mode === 'parejas') return loc('J golpe (mantén: trompón) · K cubrirse · Espacio esquivar · L junto a tu pareja: relevo · I patada · U barrida · O volteo');
      return loc('J golpe (mantén: trompón) · K cubrirse · Espacio esquivar · L agarrar · I patada · U barrida · O volteo');
    }
    return phase === 'after' && myBody && !mine?.mano ? loc('L: mano de caballero') : '';
  }

  function update(next, { replaying = false } = {}) {
    state = next;
    const phase = state.phase, fighting = ['intro', 'fight', 'after'].includes(phase), id = me();
    const bodies = state.bodies || [];
    $('bars').hidden = !fighting || bodies.length < 2;
    const key = fighting ? bodies.map(b => `${b.id}${b.corner}`).join() : '';
    if (key !== barsKey) { barsKey = key; buildBars(bodies); }
    bodies.forEach(bar);
    $('clock').classList.toggle('is-low', phase === 'fight' && !state.tutorial && state.time <= 10);
    $('clock').textContent = phase === 'fight' ? Math.max(0, Math.ceil(state.time)) : phase === 'intro' ? 'VS' : '';
    const ladder = state.ladder;
    $('fight-no').textContent = !fighting ? '' : state.tutorial ? loc('Tutorial') : state.fight?.stage ? STAGES[state.fight.stage]
      : ladder ? loc('Rival {n} de {total} · vidas {lives}', { n: Math.min(ladder.step + 1, ladder.rivals.length), total: ladder.rivals.length, lives: ladder.lives })
      : loc('Pelea {n} de {total}', { n: state.fightNo, total: state.options.peleas });
    if (state.tutorial) $('clock').textContent = 'VS';
    $('intro-card').hidden = phase !== 'intro' || INTRO - state.time > 5.2;
    $('replay').hidden = !replaying;
    const mine = player(id), myBody = bodies.find(b => b.id === id), inFight = fighting && !!myBody;
    $('me-dolitas').textContent = mine ? locn(mine.dolitas, '{n} dolitas', '{n} dolitas') : '';
    const place = state.queue?.indexOf(id) ?? -1;
    $('me-queue').textContent = inFight ? loc('Esquina {corner}', { corner: CORNER_NAMES[myBody.corner] })
      : place >= 0 && fighting && state.options.modo !== 'torneo' ? (place === 0 ? loc('Te toca después') : loc('Te toca en {n}', { n: place + 1 })) : '';
    const betting = phase === 'intro' && mine && !inFight;
    $('bets').hidden = !betting;
    if (betting) bets(mine, state.fight?.odds || {});
    $('role').textContent = state.tutorial ? '' : deviceText(roleText(phase, state.options.modo, fighting ? myBody : null, mine));
    tutorialCard(state.tutorial);
    const lessonAction = state.tutorial && !state.tutorial.done ? { mover: 'mover', jab: 'golpe', trompon: 'golpe', cubrir: 'cubrir', esquivar: 'esquivar', contra: 'golpe', agarrar: 'agarrar', pararse: 'golpe' }[TUTORIAL[state.tutorial.step].id] : '';
    for (const cap of $('keys').children) cap.classList.toggle('is-lesson', cap.dataset.key === lessonAction);
    const helpLabels = { mover: loc('Moverte'), golpe: loc('Golpe'), cubrir: loc('Cubrirte'), esquivar: loc('Esquivar'), agarrar: loc('Agarrar') };
    for (const cap of document.querySelectorAll('.pana-pad-prompts > span')) cap.classList.toggle('is-lesson', !!lessonAction && cap.textContent.includes(helpLabels[lessonAction]));
    prompt(myBody);
    $('keys').hidden = !(phase === 'fight' && myBody && !myBody.bench && !myBody.out);
    $('role').hidden = !$('keys').hidden && phase === 'fight';
    // The verdict after a fight.
    const verdict = phase === 'after' && state.result && !replaying;
    $('verdict').hidden = !verdict;
    if (verdict && verdictKey !== `${state.fightNo}:${state.result.winner}`) {
      verdictKey = `${state.fightNo}:${state.result.winner}`; fightStats($('verdict-stats'), state);
    }
    if (!verdict) verdictKey = '';
    if (verdict) {
      const r = state.result;
      $('verdict-how').textContent = HOW[r.how] || '';
      $('verdict-title').textContent = locn(r.winners?.length || 1, 'Gana {names}', 'Ganan {names}', { names: names(r.winners || [r.winner]) });
      const cards = r.cards && r.how !== 'calma' ? Object.entries(r.cards).map(([c, v]) => `${CORNER_NAMES[c]} ${v}`).join(' · ') : '';
      $('verdict-cards').textContent = cards ? loc('Tarjeta: {cards}', { cards }) : '';
      const mineOut = r.payouts?.filter(p => p.id === id).reduce((n, p) => n + p.amount, 0) || 0;
      $('verdict-pay').textContent = mineOut > 0 ? loc("+{n} dolitas pa' ti", { n: mineOut }) : mineOut < 0 ? loc('Perdiste {n} dolitas', { n: -mineOut }) : '';
      $('verdict-mano').textContent = r.mano ? loc('Mano de caballero') : '';
    }
    // End of the night: the richest pana and the titles.
    const ended = phase === 'finished';
    $('results').hidden = !ended;
    if (ended) {
      const ranked = [...state.players].sort((a, b) => b.dolitas - a.dolitas);
      $('result-title').textContent = ladder ? (ladder.won ? loc('¡Eres el campeón del barrio!') : loc('Te sacaron en el rival {n} de {total}', { n: ladder.step + 1, total: ladder.rivals.length }))
        : loc('¡{name} se lleva la noche!', { name: ranked[0]?.name ?? loc('Nadie') });
      fillRoster($('result-roster'), ranked.map((p, i) => ({ rank: i + 1, name: p.id === id ? loc('{name} · tú', { name: p.name }) : p.name,
        detail: loc('{wins} ganadas · {kos} K.O.', { wins: p.stats.wins, kos: p.stats.kos }), end: `${p.dolitas}`, score: true, me: p.id === id })));
      // Titles arrive as Spanish source from the rules (locKey).
      $('titles').replaceChildren(...state.titles.map(t => { const li = el('li'); li.append(el('b', '', loc(t.title)), raw('span', '', name(t.id))); return li; }));
    }
  }

  function tick(dt) {
    if (state) feedback.tick(dt, state);
    if (callTimer > 0 && (callTimer -= dt) <= 0) $('call').classList.remove('is-on');
    if (feedItems.length) {
      feedItems.forEach(f => { f.t -= dt; });
      if (feedItems[0].t <= 0) { feedItems = feedItems.filter(f => f.t > 0); drawFeed(); }
    }
  }
  return { react, update, tick, call, keys };
}
