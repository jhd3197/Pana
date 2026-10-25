// The HUD around the street: scoreboard, house rules, who pitches to whom,
// the big shouts and the results card. Text only, never HTML from names.
import { fillRoster } from '/engine/results.js';
import { HOUSE_RULES, teamSeats, styleText, STRIKES, BALLS, OUTS } from './rules.js';
import { TEAM_COLORS } from './scene.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const pips = (node, on, total) => node.replaceChildren(...Array.from({ length: total }, (_, i) => el('i', i < on ? 'on' : '')));
const dot = (team) => { const i = el('i', 'team-tag'); i.style.setProperty('--team', TEAM_COLORS[team]); return i; };

export function inningText(state) {
  if (state.derby) { const d = state.derby; return `Derby · ${d.index + 1}/${d.order.length}`; }
  return `${state.half ? 'Baja' : 'Alta'} ${state.inning}ª`;
}

export function renderScoreboard(state) {
  const rows = state.teams.map((t, i) => {
    const li = el('li', !state.derby && state.half === i ? 'batting' : '');
    li.style.setProperty('--team', TEAM_COLORS[i]);
    li.append(el('i'), el('span', '', t.name), el('b', '', String(t.runs)));
    return li;
  });
  if (state.derby) {
    rows.splice(0, 2, ...state.derby.order.map(seat => {
      const p = state.players[seat], li = el('li', state.batter === seat ? 'batting' : '');
      li.style.setProperty('--team', TEAM_COLORS[p.team]); li.append(el('i'), el('span', '', p.name), el('b', '', String(p.stats.hr))); return li;
    }));
  }
  $('score-teams').replaceChildren(...rows);
  $('inning').textContent = inningText(state);
  document.querySelectorAll('.diamond i').forEach(i => i.classList.toggle('on', state.bases?.[Number(i.dataset.base)] !== null && state.bases?.[Number(i.dataset.base)] !== undefined));
  pips($('balls'), state.balls, BALLS - 1); pips($('strikes'), state.strikes, STRIKES - 1); pips($('outs'), state.outs, OUTS - 1);
  $('house-rules').replaceChildren(...(state.rules || []).map(id => { const li = el('li'); li.append(el('b', '', 'Regla: '), HOUSE_RULES[id]); return li; }));
}

export function matchupText(state, mySeat) {
  const batter = state.players[state.batter], pitcher = state.pitcher === null ? 'El Abuelo' : state.players[state.pitcher]?.name;
  if (!batter) return '';
  const me = (seat) => seat === mySeat ? ' (tú)' : '';
  const left = state.derby ? ` · quedan ${state.derby.left} lanzamientos` : '';
  const hand = batter.zurdo ? 'zurdo' : 'derecho';
  return `${pitcher}${me(state.pitcher)} le lanza a ${batter.name}${me(state.batter)}, ${hand}${left}`;
}

export function renderLobbyRoster(state, meId) {
  const rows = [0, 1].flatMap(team => teamSeats(team).map((seat, i) => {
    const p = state.players[seat], mine = p.id !== null && p.id === meId;
    return { rank: i + 1, lead: dot(team), name: mine ? `${p.name} · tú` : p.name,
      detail: [p.id === null ? `Bot · ${styleText(p)}` : 'Pana', p.zurdo ? 'zurdo' : null, i === 3 ? 'cuarto bate' : null].filter(Boolean).join(' · '),
      end: team ? 'Casa' : 'Visita', me: mine };
  }));
  fillRoster($('roster'), rows);
}

// The results: the score line, the titles and both teams.
export function renderResults(state, meId) {
  const [away, home] = state.teams;
  if (state.derby) {
    const w = state.winner === null ? null : state.players[state.winner];
    $('result-title').textContent = w ? `¡${w.name} es el cuarto bate!` : '¡Empate en jonrones!';
    $('result-line').textContent = state.derby.order.map(s => `${state.players[s].name}: ${state.players[s].stats.hr}`).join(' · ');
  } else {
    $('result-title').textContent = state.winner === null ? '¡Empate! Se juega otra' : `¡Ganó ${state.teams[state.winner].name}!`;
    $('result-line').textContent = `${away.name} ${away.runs} · ${home.name} ${home.runs} · ${away.hits + home.hits} hits`;
  }
  fillRoster($('titles'), state.titles.map(t => ({ name: t.title, detail: `${state.players[t.seat].name} · ${t.why}`, end: String(t.value), score: true, me: state.players[t.seat].id === meId })));
  const players = [...state.players].filter(p => !state.derby || state.derby.order.includes(p.seat))
    .sort((a, b) => b.stats.runs + b.stats.hits - (a.stats.runs + a.stats.hits) || a.seat - b.seat);
  fillRoster($('result-roster'), players.map((p, i) => ({ rank: i + 1, lead: dot(p.team), name: p.id !== null && p.id === meId ? `${p.name} · tú` : p.name,
    detail: `${p.stats.hits} hits · ${p.stats.hr} jonrones · ${p.stats.k} ponches`, end: `${p.stats.runs} C`, me: p.id !== null && p.id === meId })));
}

// One shout at a time: it pops and fades.
let shoutTimer = 0;
export function shout(text, tone = '', ms = 1400) {
  const node = $('shout'); node.textContent = text; node.dataset.tone = tone; node.hidden = false;
  node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
  clearTimeout(shoutTimer); shoutTimer = setTimeout(() => { node.hidden = true; }, ms);
}
// Which events shout and how loud.
export const SHOUTS = {
  jonron: ['¡JONRÓN!', 'gold'], post: ['¡TRIPLE!', 'gold'], car: ['¡DOBLE!', ''], sencillo: ['¡SENCILLO!', ''], wall: ['¡SENCILLO!', ''],
  caught: ['¡ATRAPADA!', 'red'], chapazo: ['¡CHAPAZO!', 'red'], short: ['¡NI A LA ACERA!', 'red'], window: ['¡LA VENTANA!', 'red'],
  azotea: ['¡A LA AZOTEA!', 'red'], hbp: ['¡CHAPAZO!', 'red'], cuarto: ['¡CUARTO BATE!', 'gold'], willy: ['¡WILLY MAYS!', 'gold'], tiempo: ['¡TIEMPO!', ''], cambio: ['¡CAMBIO!', ''],
};
