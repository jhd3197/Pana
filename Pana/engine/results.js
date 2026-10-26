// The end-of-round screen every game shares (kit.css: pk-results, pk-row).
// A game keeps its own words and buttons; this builds the standings rows the
// same way everywhere, with text only (player names never become HTML).
//
// rosterRow({ rank, lead, name, detail, end, score, me, className, tag })
//   rank    number in the pk-row-n slot         lead   a Node before the name (chip, face)
//   name    the player or team                  detail a small line under the name
//   end     text on the right                   score  show `end` big, in the display font
//   me      highlight as the player's own row   tag    'li' (default) or 'div'

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function rosterRow({ rank, lead, name, detail, end, score = false, me = false, className = '', tag = 'li' }) {
  const row = el(tag, ['pk-row', className, me && 'is-me'].filter(Boolean).join(' '));
  if (rank != null) row.append(el('b', 'pk-row-n', rank));
  if (lead) row.append(lead);
  // A player named like a phrase ("Pausa") keeps their name; callers pass
  // team names already through loc().
  const label = el('span', 'pk-row-name', name); label.translate = false;
  if (detail) label.append(el('small', '', detail));
  row.append(label);
  if (end != null) row.append(el(score ? 'b' : 'span', score ? 'pk-row-end pk-row-score' : 'pk-row-end', end));
  return row;
}

// Replaces a pk-roster's rows; <ul>/<ol> get <li> rows, anything else <div>s.
export function fillRoster(list, rows) {
  const tag = /^(UL|OL)$/.test(list.tagName) ? 'li' : 'div';
  list.replaceChildren(...rows.map(row => rosterRow({ tag, ...row })));
}

