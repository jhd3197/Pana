// Trifulca's HUD: the fighters' bars (mareo, aguante, caídas; a tag partner
// waits dimmed), the bell clock, the narrator's call, the ref's count, the
// intro card, the bets, the verdict after each fight and a feed of what the
// ring is doing.
import { fillRoster } from '/engine/results.js';
import { lineFor, say } from './narrator.js';
import { PAY, STAKE, INTRO } from './rules.js';
import { MAREO_CALMA, KO_CAIDAS } from './fight-rules.js';

const $ = (id) => document.getElementById(id);
const HOW = { ko: 'K.O.', cuenta: 'Cuenta de diez', puntos: 'Por puntos', publico: 'Decidió el público', calma: '¡Cálmate!', abandono: 'Abandono' };
export const CORNER_NAMES = { red: 'rojo', blue: 'azul', yellow: 'amarillo', green: 'verde' };
const LEFT = ['red', 'yellow'];
const STAGES = { cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: '¡La final!' };
const MODES = { queda: 'Ganador se queda', libre: 'Trifulca libre', parejas: 'Parejas', torneo: 'Torneo' };
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

  function react(e) {
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
    $('fight-no').textContent = !fighting ? '' : state.fight?.stage ? STAGES[state.fight.stage] : `Pelea ${state.fightNo} de ${state.options.peleas}`;
    $('intro-card').hidden = phase !== 'intro' || INTRO - state.time > 5.2;
    $('replay').hidden = !replaying;
    const mine = player(id), myBody = bodies.find(b => b.id === id), inFight = fighting && !!myBody;
    $('me-dolitas').textContent = mine ? `${mine.dolitas} dolitas` : '';
    const place = state.queue?.indexOf(id) ?? -1;
    $('me-queue').textContent = inFight ? `Esquina ${CORNER_NAMES[myBody.corner]}` : place >= 0 && fighting && state.options.modo !== 'torneo' ? (place === 0 ? 'Te toca después' : `Te toca en ${place + 1}`) : '';
    const betting = phase === 'intro' && mine && !inFight;
    $('bets').hidden = !betting;
    if (betting) bets(mine, state.fight?.odds || {});
    $('role').textContent = roleText(phase, state.options.modo, fighting ? myBody : null, mine);
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
      $('result-title').textContent = `¡${ranked[0]?.name ?? 'Nadie'} se lleva la noche!`;
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
  return { react, update, tick, call };
}
