// The HUD around the street: scoreboard, house rules, who pitches to whom,
// the big shouts and the results card. Text only, never HTML from names.
import { fillRoster } from '/engine/results.js';
import { HOUSE_RULES, ABUELO, teamSeats, styleText, STRIKES, BALLS, OUTS } from './rules.js';
import { TEAM_COLORS } from './scene.js';
import { loc, locn, locKey } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const pips = (node, on, total) => node.replaceChildren(...Array.from({ length: total }, (_, i) => el('i', i < on ? 'on' : '')));
const dot = (team) => { const i = el('i', 'team-tag'); i.style.setProperty('--team', TEAM_COLORS[team]); return i; };
// Rows hold names and text already in the player's language.
const fillNames = (list, rows) => { fillRoster(list, rows); for (const row of list.children) row.translate = false; };

// A play from the host's state: a Spanish source with vars, plus the runs
// that came in. Each screen words it in its own language.
export function eventText(e) {
  const text = loc(e.text, e.vars || undefined);
  return e.runs > 0 ? loc('{play} · {runs}', { play: text, runs: locn(e.runs, 'entra una carrera', 'entran {n}') }) : text;
}

export function inningText(state) {
  if (state.derby) { const d = state.derby; return `Derby · ${d.index + 1}/${d.order.length}`; }
  return loc(state.half ? locKey('Baja {inning}ª') : locKey('Alta {inning}ª'), { inning: state.inning });
}

export function renderScoreboard(state) {
  const rows = state.teams.map((t, i) => {
    const li = el('li', !state.derby && state.half === i ? 'batting' : '');
    li.style.setProperty('--team', TEAM_COLORS[i]);
    li.append(el('i'), el('span', '', t.name), el('b', '', String(t.runs))); li.translate = false;
    return li;
  });
  if (state.derby) {
    rows.splice(0, 2, ...state.derby.order.map(seat => {
      const p = state.players[seat], li = el('li', state.batter === seat ? 'batting' : '');
      li.style.setProperty('--team', TEAM_COLORS[p.team]); li.append(el('i'), el('span', '', p.name), el('b', '', String(p.stats.hr))); li.translate = false; return li;
    }));
  }
  $('score-teams').replaceChildren(...rows);
  $('inning').textContent = inningText(state);
  document.querySelectorAll('.diamond i').forEach(i => i.classList.toggle('on', state.bases?.[Number(i.dataset.base)] !== null && state.bases?.[Number(i.dataset.base)] !== undefined));
  pips($('balls'), state.balls, BALLS - 1); pips($('strikes'), state.strikes, STRIKES - 1); pips($('outs'), state.outs, OUTS - 1);
  $('house-rules').replaceChildren(...(state.rules || []).map(id => { const li = el('li'); li.append(el('b', '', loc('Regla:')), ' ', loc(HOUSE_RULES[id])); return li; }));
}

export function matchupText(state, mySeat) {
  const batter = state.players[state.batter], pitcher = state.pitcher === null ? ABUELO : state.players[state.pitcher]?.name;
  if (!batter) return '';
  const me = (seat, name) => seat === mySeat ? loc('{name} (tú)', { name }) : name;
  const vars = { pitcher: me(state.pitcher, pitcher), batter: me(state.batter, batter.name) };
  const line = batter.zurdo ? loc('{pitcher} le lanza a {batter}, zurdo', vars) : loc('{pitcher} le lanza a {batter}, derecho', vars);
  return state.derby ? loc('{line} · quedan {n} lanzamientos', { line, n: state.derby.left }) : line;
}

export function renderLobbyRoster(state, meId) {
  const rows = [0, 1].flatMap(team => teamSeats(team).map((seat, i) => {
    const p = state.players[seat], mine = p.id !== null && p.id === meId;
    return { rank: i + 1, lead: dot(team), name: mine ? loc('{name} · tú', { name: p.name }) : p.name,
      detail: [p.id === null ? loc('Bot · {style}', { style: loc(styleText(p)) }) : loc('Pana'), p.zurdo ? loc('zurdo') : null, i === 3 ? loc('cuarto bate') : null].filter(Boolean).join(' · '),
      end: team ? loc('Casa') : loc('Visita'), me: mine };
  }));
  fillNames($('roster'), rows);
}

// The results: the score line, the titles and both teams.
export function renderResults(state, meId) {
  const [away, home] = state.teams;
  if (state.derby) {
    const w = state.winner === null ? null : state.players[state.winner];
    $('result-title').textContent = w ? loc('¡{name} es el cuarto bate!', { name: w.name }) : loc('¡Empate en jonrones!');
    $('result-line').textContent = state.derby.order.map(s => `${state.players[s].name}: ${state.players[s].stats.hr}`).join(' · ');
  } else {
    $('result-title').textContent = state.winner === null ? loc('¡Empate! Se juega otra') : loc('¡Ganó {team}!', { team: state.teams[state.winner].name });
    $('result-line').textContent = `${away.name} ${away.runs} · ${home.name} ${home.runs} · ${loc('{n} hits', { n: away.hits + home.hits })}`;
  }
  fillNames($('titles'), state.titles.map(t => ({ name: loc(t.title), detail: `${state.players[t.seat].name} · ${loc(t.why)}`, end: String(t.value), score: true, me: state.players[t.seat].id === meId })));
  const players = [...state.players].filter(p => !state.derby || state.derby.order.includes(p.seat))
    .sort((a, b) => b.stats.runs + b.stats.hits - (a.stats.runs + a.stats.hits) || a.seat - b.seat);
  fillNames($('result-roster'), players.map((p, i) => ({ rank: i + 1, lead: dot(p.team), name: p.id !== null && p.id === meId ? loc('{name} · tú', { name: p.name }) : p.name,
    detail: loc('{hits} hits · {hr} jonrones · {k} ponches', { hits: p.stats.hits, hr: p.stats.hr, k: p.stats.k }), end: loc('{n} C', { n: p.stats.runs }), me: p.id !== null && p.id === meId })));
}

// One shout at a time: it pops and fades.
let shoutTimer = 0;
export function shout(text, tone = '', ms = 1400) {
  const node = $('shout'); node.textContent = loc(text); node.dataset.tone = tone; node.hidden = false;
  node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
  clearTimeout(shoutTimer); shoutTimer = setTimeout(() => { node.hidden = true; }, ms);
}
// Which events shout and how loud (shout() translates them).
export const SHOUTS = {
  jonron: [locKey('¡JONRÓN!'), 'gold'], post: [locKey('¡TRIPLE!'), 'gold'], car: [locKey('¡DOBLE!'), ''], sencillo: [locKey('¡SENCILLO!'), ''], wall: [locKey('¡SENCILLO!'), ''],
  caught: [locKey('¡ATRAPADA!'), 'red'], chapazo: [locKey('¡CHAPAZO!'), 'red'], short: [locKey('¡NI A LA ACERA!'), 'red'], window: [locKey('¡LA VENTANA!'), 'red'],
  azotea: [locKey('¡A LA AZOTEA!'), 'red'], hbp: [locKey('¡CHAPAZO!'), 'red'], cuarto: [locKey('¡CUARTO BATE!'), 'gold'], willy: ['¡WILLY MAYS!', 'gold'], tiempo: [locKey('¡TIEMPO!'), ''], cambio: [locKey('¡CAMBIO!'), ''], // i18n-ignore: WILLY MAYS is a name
};
