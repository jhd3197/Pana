// The record readout every game shares (kit.css: pk-record), for the lobby and
// the end screen: a tile per metric with who holds it, and a small button that
// opens the leaderboard. Text only: player names never become HTML.
//
//   renderRecord(node, board, { me: name, standings: run.summary(name) });   // end screen
//   renderRecord(node, board, { me: name, compact: true });                  // lobby
import { loc, locale, formatList, formatNumber } from './i18n.js';
import { fillRoster } from './results.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const when = t => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(t);
const namesOf = holder => formatList(holder.names);

function tile({ label, holder, previous, broken, first, mine }) {
  const node = el('div', ['pk-record-tile', broken && 'is-broken', first && 'is-first', mine && 'is-mine'].filter(Boolean).join(' '));
  node.append(el('span', 'pk-eyebrow', label), el('b', 'pk-record-value', holder ? formatNumber(holder.value) : '0'));
  const who = el('span', 'pk-record-who', holder ? namesOf(holder) : loc('Sin dueño'));
  who.translate = false;
  node.append(who);
  if (broken) node.append(el('small', 'pk-record-note', loc('Antes: {name} · {value}', { name: namesOf(previous), value: formatNumber(previous.value) })));
  else if (holder) node.append(el('small', 'pk-record-note', when(holder.t)));
  if (broken || first) node.append(el('span', 'pk-record-flag', broken ? loc('¡Récord roto!') : loc('¡Primer récord!')));
  return node;
}

export function renderRecord(node, board, { me = '', standings = board.standings(me), rows = 5, compact = false } = {}) {
  const tiles = el('div', 'pk-record-tiles');
  tiles.append(...standings.map(tile));
  node.classList.add('pk-record');
  node.classList.toggle('pk-record--compact', compact);
  node.replaceChildren(tiles);
  const list = board.table(rows);
  if (!list.length) return;
  const open = el('button', 'pk-btn pk-btn--sm pk-record-open', loc('Tabla'));
  open.type = 'button'; open.setAttribute('aria-expanded', 'false');
  const roster = el('ol', 'pk-roster pk-record-table'); roster.hidden = true;
  const [lead, ...others] = board.metrics;
  fillRoster(roster, list.map((row, i) => ({
    rank: i + 1, name: row.name, me: row.name.trim().toLowerCase() === me.trim().toLowerCase(),
    detail: others.map(m => `${m.label} ${formatNumber(row.values[m.id])}`).join(' · '),
    end: formatNumber(row.values[lead.id]), score: true,
  })));
  open.onclick = () => { roster.hidden = !roster.hidden; open.setAttribute('aria-expanded', String(!roster.hidden)); };
  node.append(open, roster);
}

// A line for tight spots ("5 · Ana"); empty until someone holds the record.
export function recordLine(board, id = board.metrics[0].id) {
  const holder = board.holder(id);
  return holder ? `${formatNumber(holder.value)} · ${namesOf(holder)}` : '';
}
