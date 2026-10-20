// Trifulca's HUD: the two fighters' bars (mareo, aguante, caídas), the bell
// clock, the narrator's call, the ref's count, the intro card, the bets, the
// verdict after each fight and a feed of what the ring is doing.
import { fillRoster } from '/engine/results.js';
import { lineFor, say } from './narrator.js';
import { PAY, STAKE, INTRO } from './rules.js';
import { MAREO_CALMA, KO_CAIDAS } from './fight-rules.js';

const $ = (id) => document.getElementById(id);
const HOW = { ko: 'K.O.', cuenta: 'Cuenta de diez', puntos: 'Por puntos', publico: 'Decidió el público', calma: '¡Cálmate!', abandono: 'Abandono' };

export function createHud({ me, voice = () => true }) {
  let state = null, callTimer = 0, feedItems = [];
  const name = (id) => state?.players.find(p => p.id === id)?.name ?? 'Alguien';
  const player = (id) => state?.players.find(p => p.id === id);

  function call(text, { big = false, ref = false, speak = false } = {}) {
    const el = $('call'); el.textContent = text;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    el.classList.toggle('is-big', big); el.classList.toggle('is-ref', ref);
    callTimer = big ? 2.4 : 1.6;
    if (speak) say(text, { enabled: voice(), ref });
  }
  function feed(text) {
    feedItems.push({ text, t: 4 }); if (feedItems.length > 4) feedItems.shift();
    $('feed').replaceChildren(...feedItems.map(f => Object.assign(document.createElement('li'), { textContent: f.text })));
  }

  function react(e) {
    const line = lineFor(e, name);
    if (line) call(line.text, { big: line.big, ref: line.ref, speak: line.say });
    if (e.type === 'count') {
      const el = $('count'); el.textContent = e.n; el.hidden = false;
      el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
      if (e.n === 5 || e.n === 8) call('¡Párate!', { ref: true, speak: true });
    }
    if (e.type === 'rise' || e.type === 'fin' || e.type === 'intro') $('count').hidden = true;
    if (e.type === 'bet') feed(`${name(e.id)}: ¡Por ${e.amount} dolitas al ${e.corner === 'red' ? 'rojo' : 'azul'}!`);
    if (e.type === 'empujon' && e.back) feed(`${name(e.by)} empujó pa' dentro (+${PAY.shove})`);
    if (e.type === 'agua') feed(`${name(e.by)} dio agua en la esquina`);
    if (e.type === 'cheer') feed(`${name(e.by)}: ¡Dale, dale!`);
    if (e.type === 'intro') introCard(e);
    if (e.type === 'fin' && e.belt) setTimeout(() => call(`¡${name(e.winner)} es el campeón del barrio!`, { big: true, speak: true }), 2600);
    if (e.type === 'fin' && e.streak >= 2 && !e.belt) feed(`${name(e.winner)} lleva ${e.streak} seguidas`);
  }

  function introCard(e) {
    const red = player(e.red), blue = player(e.blue);
    for (const [side, p] of [['red', red], ['blue', blue]]) {
      if (!p) continue;
      $(`intro-${side}-nick`).textContent = p.nick;
      $(`intro-${side}-name`).textContent = p.id === me() ? `${p.name} (tú)` : p.name;
      $(`intro-${side}-from`).textContent = p.from;
      $(`intro-${side}-record`).textContent = `${p.stats.wins} ganadas · ${p.dolitas} dolitas`;
    }
    $('intro-streak').textContent = e.streak >= 2 ? `${name(e.red)} viene con ${e.streak} seguidas` : 'Ganador se queda';
    say(`En la esquina roja, ${red?.nick}, ${red?.name}, ${red?.from}. En la esquina azul, ${blue?.nick}, ${blue?.name}, ${blue?.from}.`, { enabled: voice() });
  }

  function bar(side, body) {
    const p = player(body.id);
    $(`${side}-name`).textContent = p ? (p.id === me() ? `${p.name} · tú` : p.name) : '';
    $(`${side}-nick`).textContent = p?.nick ?? '';
    const mareo = $(`${side}-mareo`);
    mareo.style.setProperty('--fill', `${Math.min(100, body.mareo)}%`);
    mareo.classList.toggle('is-danger', body.mareo >= MAREO_CALMA || body.act === 'dizzy');
    $(`${side}-aguante`).style.setProperty('--fill', `${body.aguante}%`);
    $(`${side}-caidas`).replaceChildren(...Array.from({ length: KO_CAIDAS }, (_, i) => Object.assign(document.createElement('i'), { className: i < body.caidas ? 'is-down' : '' })));
  }

  function update(next, { replaying = false } = {}) {
    state = next;
    const phase = state.phase, fighting = ['intro', 'fight', 'after'].includes(phase), id = me();
    const [red, blue] = state.bodies || [];
    $('bars').hidden = !fighting || !red;
    if (red && blue) { bar('red', red); bar('blue', blue); }
    $('clock').textContent = phase === 'fight' ? Math.max(0, Math.ceil(state.time)) : phase === 'intro' ? 'VS' : '';
    $('fight-no').textContent = fighting ? `Pelea ${state.fightNo} de ${state.options.peleas}` : '';
    $('intro-card').hidden = phase !== 'intro' || INTRO - state.time > 5.2;
    $('replay').hidden = !replaying;
    const mine = player(id), myBody = state.bodies?.find(b => b.id === id), inFight = fighting && !!myBody;
    $('me-dolitas').textContent = mine ? `${mine.dolitas} dolitas` : '';
    const place = state.queue?.indexOf(id) ?? -1;
    $('me-queue').textContent = inFight ? (myBody.corner === 'red' ? 'Esquina roja' : 'Esquina azul') : place >= 0 && fighting ? (place === 0 ? 'Te toca después' : `Te toca en ${place + 1}`) : '';
    // Bets for the ring during the intro.
    const betting = phase === 'intro' && mine && !inFight;
    $('bets').hidden = !betting;
    if (betting) {
      const odds = state.fight?.odds || { red: 2, blue: 2 };
      $('bet-red').textContent = `${name(red?.id)} · paga ×${odds.red}`;
      $('bet-blue').textContent = `${name(blue?.id)} · paga ×${odds.blue}`;
      $('bet-red').classList.toggle('is-picked', mine.bet?.on === 'red');
      $('bet-blue').classList.toggle('is-picked', mine.bet?.on === 'blue');
      $('bet-note').textContent = mine.bet ? `Apostaste ${mine.bet.amount} dolitas` : `Apuesta ${STAKE} dolitas (teclas 1 y 2)`;
    }
    // What you can do right now.
    $('role').textContent = phase === 'intro' ? (inFight ? '¡Prepárate! Golpe J · Cubrirse K · Esquivar Espacio · Agarrar L' : 'Apuesta y dale agua a tu esquina: acércate y pulsa J')
      : phase === 'fight' ? (inFight ? 'J golpe (mantén: trompón) · K cubrirse · Espacio esquivar · L agarrar · T ¡dale!' : 'Eres el ring: J empuja pa\' dentro · L ¡cálmate! (mareo alto) · T ¡dale!')
        : phase === 'after' && inFight && !mine?.mano ? 'L: mano de caballero' : '';
    // The verdict after a fight.
    const verdict = phase === 'after' && state.result && !replaying;
    $('verdict').hidden = !verdict;
    if (verdict) {
      const r = state.result;
      $('verdict-how').textContent = HOW[r.how] || '';
      $('verdict-title').textContent = `Gana ${name(r.winner)}`;
      $('verdict-cards').textContent = r.cards && r.how !== 'calma' ? `Tarjeta: ${r.cards.red ?? 0} – ${r.cards.blue ?? 0}` : '';
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
      $('titles').replaceChildren(...state.titles.map(t => {
        const li = document.createElement('li'); li.innerHTML = '<b></b><span></span>';
        li.querySelector('b').textContent = t.title; li.querySelector('span').textContent = name(t.id); return li;
      }));
    }
  }

  function tick(dt) {
    if (callTimer > 0 && (callTimer -= dt) <= 0) $('call').classList.remove('is-on');
    if (feedItems.length) {
      feedItems.forEach(f => { f.t -= dt; });
      if (feedItems[0].t <= 0) { feedItems = feedItems.filter(f => f.t > 0); $('feed').replaceChildren(...feedItems.map(f => Object.assign(document.createElement('li'), { textContent: f.text }))); }
    }
  }
  return { react, update, tick, call };
}
