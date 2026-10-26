// Presentation driven only by the authoritative fight snapshot and events.
import { fighterLook } from './fighter-look.js';
import { cachedPortrait } from '/engine/portrait-cache.js';
import { loc } from '/engine/i18n.js';
const node = (tag, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
export function fighterPortrait(player, index = 0) {
  const avatar = fighterLook(player, index);
  const img = node('img', 'fighter-portrait'); img.alt = ''; img.width = 64; img.height = 64;
  const cached = cachedPortrait(avatar);
  if (cached) img.src = cached;
  else import('/engine/portrait.js').then(({ portrait }) => portrait(avatar)).then(src => { img.src = src; }).catch(() => { img.hidden = true; });
  return img;
}
export function fightStats(target, state) {
  const table = node('table', 'fight-stats'), head = node('tr'), body = node('tbody');
  head.append(node('th', '', 'Esta pelea'), ...state.bodies.map(b => node('th', '', state.players.find(p => p.id === b.id)?.name || 'Pana')));
  const thead = node('thead'); thead.append(head); table.append(thead, body);
  for (const [label, value] of [[loc('Jabs acertados'), b => b.score?.jabs || 0], [loc('Trompones acertados'), b => b.score?.trompones || 0], [loc('Patadas / barridas / volteos'), b => (b.score?.kicks || 0) + (b.score?.sweeps || 0) + (b.score?.tosses || 0)], [loc('Golpes cubiertos'), b => b.score?.blocks || 0], [loc('Caídas provocadas'), b => b.score?.caidas || 0]]) {
    const row = node('tr'); row.append(node('th', '', label), ...state.bodies.map(b => node('td', '', String(value(b))))); body.append(row);
  }
  target.replaceChildren(table);
}
export function createFightFeedback() {
  const combos = new Map(), flashes = new Map();
  const side = (state, id) => ['red', 'yellow'].includes(state.bodies.find(b => b.id === id)?.team) ? 'left' : 'right';
  function react(event, state) {
    if (['intro', 'tutorial', 'fin'].includes(event.type)) { combos.clear(); flashes.clear(); }
    if (['hit', 'trompon'].includes(event.type)) {
      const prev = combos.get(event.by);
      combos.set(event.by, { count: (prev?.time > 0 ? prev.count : 0) + 1, time: 1.8 }); combos.delete(event.id);
    }
    const pum = '¡PUM!'; // i18n-ignore: onomatopoeia, the same word the ring paints
    const word = { hit: event.contra ? loc('¡CONTRA!') : ({ kick: loc('¡PATADA!'), sweep: loc('¡BARRIDA!'), toss: loc('¡VOLTEO!') }[event.move] || pum), trompon: loc('¡TROMPÓN!'), block: loc('¡CUBIERTO!'), guardbreak: loc('¡SIN GUARDIA!'), dodged: loc('¡ESQUIVA!') }[event.type];
    if (word) flashes.set(side(state, event.id), { word, time: .8 });
  }
  function tick(dt, state) {
    for (const [id, combo] of combos) { combo.time -= dt; if (combo.time <= 0) combos.delete(id); }
    for (const [key, flash] of flashes) { flash.time -= dt; if (flash.time <= 0) flashes.delete(key); }
    for (const key of ['left', 'right']) {
      const root = document.getElementById(`feedback-${key}`), combo = [...combos].find(([id, value]) => value.count >= 2 && side(state, id) === key)?.[1];
      root.hidden = state.phase !== 'fight' || (!combo && !flashes.has(key));
      root.querySelector('b').textContent = combo ? loc('{n} GOLPES', { n: combo.count }) : '';
      root.querySelector('span').textContent = flashes.get(key)?.word || '';
    }
  }
  return { react, tick };
}
