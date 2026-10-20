// Trifulca's HUD: the fighters' bars (mareo, aguante, caídas; a tag partner
// waits dimmed), the bell clock, the narrator's call, the ref's count, the
// intro card, the bets, the verdict after each fight and a feed of what the
// ring is doing.
import { fillRoster } from '/engine/results.js';
import { lineFor, say } from './narrator.js';
import { PAY, STAKE, INTRO, TUTORIAL } from './rules.js';
import { MAREO_CALMA, KO_CAIDAS } from './fight-rules.js';

const $ = (id) => document.getElementById(id);
const HOW = { ko: 'K.O.', cuenta: 'Cuenta de diez', puntos: 'Por puntos', publico: 'Decidió el público', calma: '¡Cálmate!', abandono: 'Abandono' };
export const CORNER_NAMES = { red: 'rojo', blue: 'azul', yellow: 'amarillo', green: 'verde' };
const LEFT = ['red', 'yellow'];
const STAGES = { cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: '¡La final!' };
const MODES = { queda: 'Ganador se queda', libre: 'Trifulca libre', parejas: 'Parejas', torneo: 'Torneo' };
// The tutorial, one card per step: what to do and which key does it.
export const LESSONS = {
  mover: ['Acércate al Profe', 'Camina hacia él con D o la flecha derecha. Tú siempre estás a la izquierda de la pantalla: derecha es hacia tu rival.', ['D', '→']],
  jab: ['El jab', 'Toca J (o clic izquierdo) para un jab rápido. Pégale tres.', ['J']],
  trompon: ['El trompón', 'Mantén J un momento: el guante se va pa\' atrás temblando y sale el trompón. Lento pero pega duro.', ['J mantener']],
  cubrir: ['Cubrirse', 'El Profe te va a tirar jabs. Mantén K (o clic derecho) para cubrirte.', ['K']],
  esquivar: ['Esquivar', 'Cuando el Profe cargue el trompón verás ¡ESQUIVA! Pulsa Espacio justo ahí.', ['Espacio']],
  contra: ['El contragolpe', 'Esquiva el trompón y pega J enseguida: el contragolpe atraviesa la guardia y pega más.', ['Espacio', 'J']],
  agarrar: ['Agarrar', 'El Profe se cubre. Pégate y pulsa L: el agarre rompe la guardia y lo manda pa\'l público.', ['L']],
  pararse: ['¡Párate!', 'Te tumbaron. Machaca J (o cualquier botón) para pararte antes del diez.', ['J', 'J', 'J']],
};
const el = (tag, className = '', text = '') => Object.assign(document.createElement(tag), { className, textContent: text });

export function createHud({ me, voice = () => true }) {
  let state = null, callTimer = 0, feedItems = [], barsKey = '', betsKey = '';
  const blocks = new Map();
  const name = (id) => state?.players.find(p => p.id === id)?.name ?? 'Alguien';
  const player = (id) => state?.players.find(p => p.id === id);
  const names = (ids = []) => ids.map(name).join(' y ');

  function call(text, { big = false, ref = false, speak = false } = {}) {
    const node = $('call'); node.textContent = text;
    node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on');
    node.classList.toggle('is-big', big); node.classList.toggle('is-ref', ref);
    callTimer = big ? 2.4 : 1.6;
    if (speak) say(text, { enabled: voice(), ref });
  }
  function drawFeed() { $('feed').replaceChildren(...feedItems.map(f => el('li', '', f.text))); }
  function feed(text) { feedItems.push({ text, t: 4 }); if (feedItems.length > 4) feedItems.shift(); drawFeed(); }

  // Práctica: alone with the bots, the narrator coaches the rock-paper-scissors.
  const TIPS = {
    wind: 'Tip: ¡pégale un jab mientras carga el trompón, o esquiva con Espacio!',
    block: 'Tip: si se cubre, agárralo con L: el agarre le gana a la guardia.',
    dizzy: 'Tip: está mareado: un golpe limpio ahora lo tumba.',
    caidaMe: 'Tip: ¡machaca J para pararte antes del diez!',
    out: 'Tip: el público te devuelve al ring; no te quedes en la orilla.',
    dodged: 'Tip: después de un trompón fallado quedas abierto. ¡Cuidado!',
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
    tipped.add(key); setTimeout(() => feed(TIPS[key]), 900);
  }

  function react(e) {
    coach(e);
    const line = lineFor(e, name, names);
    if (line) call(line.text, { big: line.big, ref: line.ref, speak: line.say });
    if (e.type === 'count') {
      const node = $('count'); node.textContent = e.n; node.hidden = false;
      node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on');
      if (e.n === 5 || e.n === 8) call('¡Párate!', { ref: true, speak: true });
    }
    if (['rise', 'fin', 'intro', 'fuera'].includes(e.type)) $('count').hidden = true;
    if (e.type === 'bet') feed(`${name(e.id)}: ¡Por ${e.amount} dolitas al ${CORNER_NAMES[e.corner]}!`);
    if (e.type === 'empujon' && e.back) feed(`${name(e.by)} empujó pa' dentro (+${PAY.shove})`);
    if (e.type === 'agua') feed(`${name(e.by)} dio agua en la esquina`);
    if (e.type === 'cheer') feed(`${name(e.by)}: ¡Dale, dale!`);
    if (e.type === 'intro') introCard(e);
    if (e.type === 'tutorial-bien') feed(['¡Eso!', '¡Bien!', '¡Así mismo!'][e.count % 3]);
    if (e.type === 'tutorial') call(e.step ? '¡Bien hecho!' : '¡Bienvenido al tutorial!', { big: true });
    if (e.type === 'tutorial-fin') call('¡Listo, ya sabes pelear!', { big: true, speak: true });
    if (e.type === 'fin' && e.belt) setTimeout(() => call(e.final ? `¡${name(e.winner)} gana el torneo y el cinturón!` : `¡${name(e.winner)} es el campeón del barrio!`, { big: true, speak: true }), 2600);
    if (e.type === 'fin' && e.streak >= 2 && !e.belt) feed(`${name(e.winner)} lleva ${e.streak} seguidas`);
  }

  function introCard(e) {
    const bodies = state?.bodies || [];
    for (const side of ['left', 'right']) {
      const list = bodies.filter(b => LEFT.includes(b.team) === (side === 'left'));
      $(`intro-${side}`).replaceChildren(...list.map(b => {
        const p = player(b.id), card = el('div', `intro-side intro-side--${b.corner}${b.bench ? ' is-bench' : ''}`);
        if (!p) return card;
        card.append(el('span', 'pk-display', p.nick), el('b', '', p.id === me() ? `${p.name} (tú)` : p.name), el('span', '', p.from), el('small', '', `${p.stats.wins} ganadas · ${p.dolitas} dolitas`));
        return card;
      }));
    }
    $('intro-streak').textContent = e.stage ? STAGES[e.stage] : e.streak >= 2 ? `${name(e.red)} viene con ${e.streak} seguidas` : MODES[e.mode] || 'Ganador se queda';
    const intro = bodies.filter(b => !b.bench).map(b => { const p = player(b.id); return p ? `${p.nick}, ${p.name}, ${p.from}` : ''; });
    say(`${e.stage === 'final' ? '¡La gran final! ' : ''}${intro.length > 2 ? 'Todos contra todos: ' : 'En la esquina roja, '}${intro.join(intro.length > 2 ? '. ' : '. En la esquina azul, ')}.`, { enabled: voice() });
  }

  // One block per fighter, rebuilt when the lineup changes.
  function buildBars(bodies) {
    blocks.clear();
    for (const side of ['left', 'right']) {
      const list = bodies.filter(b => LEFT.includes(b.team) === (side === 'left'));
      $(`bars-${side}`).replaceChildren(...list.map(b => {
        const block = el('div', `fighter fighter--${b.corner}`), top = el('div', 'fighter-name');
        const title = el('b'), nick = el('span'), mareo = el('div', 'meter meter--mareo'), low = el('div', 'fighter-low');
        const aguante = el('div', 'meter meter--aguante'), caidas = el('span', 'caidas');
        mareo.append(el('i')); aguante.append(el('i')); low.append(aguante, caidas); top.append(title, nick);
        block.append(top, mareo, low);
        caidas.append(...Array.from({ length: KO_CAIDAS }, () => el('i')));
        blocks.set(b.id, { block, title, nick, mareo, aguante, caidas });
        return block;
      }));
    }
  }
  function bar(body) {
    const b = blocks.get(body.id), p = player(body.id);
    if (!b) return;
    b.title.textContent = p ? (p.id === me() ? `${p.name} · tú` : p.name) : '';
    b.nick.textContent = body.bench ? 'en la esquina' : p?.nick ?? '';
    b.block.classList.toggle('is-bench', !!body.bench); b.block.classList.toggle('is-out', !!body.out);
    b.mareo.style.setProperty('--fill', `${Math.min(100, body.mareo)}%`);
    b.mareo.classList.toggle('is-danger', body.mareo >= MAREO_CALMA || body.act === 'dizzy');
    b.aguante.style.setProperty('--fill', `${body.aguante}%`);
    [...b.caidas.children].forEach((pip, i) => pip.classList.toggle('is-down', i < body.caidas));
  }

  function bets(mine, odds) {
    const corners = Object.keys(odds), key = corners.join() + JSON.stringify(odds) + (state.bodies.map(b => b.id).join());
    if (key !== betsKey) {
      betsKey = key;
      $('bet-row').replaceChildren(...corners.map((c, i) => {
        const team = state.bodies.filter(b => b.team === c).map(b => name(b.id)).join(' y ');
        const button = el('button', `pk-btn bet bet--${c}`, `${i + 1} · ${team} · paga ×${odds[c]}`);
        button.dataset.corner = c; button.onclick = () => document.dispatchEvent(new CustomEvent('trifulca:bet', { detail: c }));
        return button;
      }));
    }
    for (const button of $('bet-row').children) button.classList.toggle('is-picked', mine.bet?.on === button.dataset.corner);
    $('bet-note').textContent = mine.bet ? `Apostaste ${mine.bet.amount} dolitas al ${CORNER_NAMES[mine.bet.on]}` : `Apuesta ${STAKE} dolitas (teclas 1 a ${corners.length})`;
  }

  function tutorialCard(t) {
    $('tutorial').hidden = !t;
    if (!t) return;
    const lesson = t.done ? ['¡Listo, pana!', 'Ya sabes pelear: jab, trompón, cubrirse, esquivar, contragolpe y agarre. Ahora sube la escalera: cinco rivales del barrio, cada uno más bravo.', []] : LESSONS[TUTORIAL[t.step].id];
    const key = `${t.step}:${t.done}`;
    $('tutorial-step').textContent = t.done ? 'TUTORIAL COMPLETO' : `PASO ${t.step + 1} DE ${TUTORIAL.length}`;
    $('tutorial-go').hidden = !t.done; $('tutorial-skip').hidden = t.done;
    // Once it is done, the card is a menu for a controller: A on ¡A pelear!
    $('tutorial').toggleAttribute('data-pad-menu', !!t.done);
    if ($('tutorial').dataset.key === key) {
      $('tutorial-text').dataset.count = t.count; return;
    }
    $('tutorial').dataset.key = key;
    $('tutorial-title').textContent = lesson[0]; $('tutorial-text').textContent = lesson[1];
    const touch = matchMedia('(pointer: coarse)').matches, words = { J: 'Golpe', 'J mantener': 'Golpe mantener', K: 'Cubrir', Espacio: 'Esquivar', L: 'Agarrar', D: 'Derecha', '→': 'hacia él' };
    $('tutorial-keys').replaceChildren(...lesson[2].map(k => el('kbd', 'pk-kbd', touch ? words[k] || k : k)));
    $('tutorial-dots').replaceChildren(...TUTORIAL.map((_, i) => el('li', i < t.step || t.done ? 'is-done' : i === t.step ? 'is-now' : '')));
    $('tutorial').classList.remove('is-new'); void $('tutorial').offsetWidth; $('tutorial').classList.add('is-new');
  }

  // A big call to action when the rival winds up or a counter is open.
  function prompt(myBody) {
    const node = $('prompt'), bodies = state?.bodies || [];
    let text = '';
    if (myBody && state.phase === 'fight' && !myBody.bench && !myBody.out) {
      const foe = bodies.find(b => b.id === myBody.foe);
      if (myBody.act === 'down') text = '¡Machaca J pa\' pararte!';
      else if (myBody.contra > 0) text = '¡CONTRA! J';
      else if (foe?.act === 'wind' && Math.hypot(foe.x - myBody.x, foe.z - myBody.z) < 2.6) text = '¡ESQUIVA! Espacio';
      else if (foe?.act === 'dizzy') text = '¡Está mareado! ¡Dale!';
      else if (foe?.act === 'open') text = '¡Quedó abierto! J';
    }
    node.hidden = !text;
    if (text && node.textContent !== text) { node.textContent = text; node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on'); }
  }

  // The key bar lights each button while it is pressed.
  function keys(c) {
    const bar = $('keys'); if (bar.hidden) return;
    const on = { golpe: c.g || c.gp !== lastKeys.gp, cubrir: c.b, esquivar: c.e !== lastKeys.e, agarrar: c.a !== lastKeys.a, mover: !!(c.sx || c.sy) };
    for (const span of bar.children) {
      const k = span.dataset.key;
      if (on[k]) { span.classList.add('is-on'); clearTimeout(span._t); span._t = setTimeout(() => span.classList.remove('is-on'), c.g || c.b || k === 'mover' ? 90 : 220); }
    }
    lastKeys = { gp: c.gp, e: c.e, a: c.a };
  }
  let lastKeys = {};

  function roleText(phase, mode, myBody, mine) {
    if (phase === 'intro') return myBody ? (myBody.bench ? 'Esperas en la esquina: tu pareja te da el relevo con L' : '¡Prepárate! Golpe J · Cubrirse K · Esquivar Espacio · Agarrar L') : 'Apuesta y dale agua a tu esquina: acércate y pulsa J';
    if (phase === 'fight') {
      if (!myBody) return 'Eres el ring: J empuja pa\' dentro · L ¡cálmate! (mareo alto) · T ¡dale!';
      if (myBody.out) return 'Quedaste fuera: mira cómo termina';
      if (myBody.bench) return 'En la esquina: recuperas el aire. Tu pareja te toca con L';
      const extra = mode === 'libre' ? ' · L junto a una silla o caja: agarrarla, L otra vez: lanzarla' : mode === 'parejas' ? ' · L junto a tu pareja: relevo' : ' · L agarrar';
      return `J golpe (mantén: trompón) · K cubrirse · Espacio esquivar${extra} · T ¡dale!`;
    }
    return phase === 'after' && myBody && !mine?.mano ? 'L: mano de caballero' : '';
  }

  function update(next, { replaying = false } = {}) {
    state = next;
    const phase = state.phase, fighting = ['intro', 'fight', 'after'].includes(phase), id = me();
    const bodies = state.bodies || [];
    $('bars').hidden = !fighting || bodies.length < 2;
    const key = fighting ? bodies.map(b => `${b.id}${b.corner}`).join() : '';
    if (key !== barsKey) { barsKey = key; buildBars(bodies); }
    bodies.forEach(bar);
    $('clock').textContent = phase === 'fight' ? Math.max(0, Math.ceil(state.time)) : phase === 'intro' ? 'VS' : '';
    const ladder = state.ladder;
    $('fight-no').textContent = !fighting ? '' : state.tutorial ? 'Tutorial' : state.fight?.stage ? STAGES[state.fight.stage]
      : ladder ? `Rival ${Math.min(ladder.step + 1, ladder.rivals.length)} de ${ladder.rivals.length} · vidas ${ladder.lives}` : `Pelea ${state.fightNo} de ${state.options.peleas}`;
    if (state.tutorial) $('clock').textContent = '';
    $('intro-card').hidden = phase !== 'intro' || INTRO - state.time > 5.2;
    $('replay').hidden = !replaying;
    const mine = player(id), myBody = bodies.find(b => b.id === id), inFight = fighting && !!myBody;
    $('me-dolitas').textContent = mine ? `${mine.dolitas} dolitas` : '';
    const place = state.queue?.indexOf(id) ?? -1;
    $('me-queue').textContent = inFight ? `Esquina ${CORNER_NAMES[myBody.corner]}` : place >= 0 && fighting && state.options.modo !== 'torneo' ? (place === 0 ? 'Te toca después' : `Te toca en ${place + 1}`) : '';
    const betting = phase === 'intro' && mine && !inFight;
    $('bets').hidden = !betting;
    if (betting) bets(mine, state.fight?.odds || {});
    $('role').textContent = state.tutorial ? '' : roleText(phase, state.options.modo, fighting ? myBody : null, mine);
    tutorialCard(state.tutorial);
    prompt(myBody);
    $('keys').hidden = !(phase === 'fight' && myBody && !myBody.bench && !myBody.out);
    $('role').hidden = !$('keys').hidden && phase === 'fight';
    // The verdict after a fight.
    const verdict = phase === 'after' && state.result && !replaying;
    $('verdict').hidden = !verdict;
    if (verdict) {
      const r = state.result;
      $('verdict-how').textContent = HOW[r.how] || '';
      $('verdict-title').textContent = `Gana${(r.winners?.length || 1) > 1 ? 'n' : ''} ${names(r.winners || [r.winner])}`;
      const cards = r.cards && r.how !== 'calma' ? Object.entries(r.cards).map(([c, v]) => `${CORNER_NAMES[c]} ${v}`).join(' · ') : '';
      $('verdict-cards').textContent = cards ? `Tarjeta: ${cards}` : '';
      const mineOut = r.payouts?.filter(p => p.id === id).reduce((n, p) => n + p.amount, 0) || 0;
      $('verdict-pay').textContent = mineOut > 0 ? `+${mineOut} dolitas pa' ti` : mineOut < 0 ? `Perdiste ${-mineOut} dolitas` : '';
      $('verdict-mano').textContent = r.mano ? 'Mano de caballero' : '';
    }
    // End of the night: the richest pana and the titles.
    const ended = phase === 'finished';
    $('results').hidden = !ended;
    if (ended) {
      const ranked = [...state.players].sort((a, b) => b.dolitas - a.dolitas);
      $('result-title').textContent = ladder ? (ladder.won ? '¡Eres el campeón del barrio!' : `Te sacaron en el rival ${ladder.step + 1} de ${ladder.rivals.length}`) : `¡${ranked[0]?.name ?? 'Nadie'} se lleva la noche!`;
      fillRoster($('result-roster'), ranked.map((p, i) => ({ rank: i + 1, name: p.id === id ? `${p.name} · tú` : p.name, detail: `${p.stats.wins} ganadas · ${p.stats.kos} K.O.`, end: `${p.dolitas}`, score: true, me: p.id === id })));
      $('titles').replaceChildren(...state.titles.map(t => { const li = el('li'); li.append(el('b', '', t.title), el('span', '', name(t.id))); return li; }));
    }
  }

  function tick(dt) {
    if (callTimer > 0 && (callTimer -= dt) <= 0) $('call').classList.remove('is-on');
    if (feedItems.length) {
      feedItems.forEach(f => { f.t -= dt; });
      if (feedItems[0].t <= 0) { feedItems = feedItems.filter(f => f.t > 0); drawFeed(); }
    }
  }
  return { react, update, tick, call, keys };
}
