// The review: one category at a time, every pana's answer side by side,
// green (counts), red (doesn't) or yellow (¿Eso cuenta?) with thumbs to vote.
// Authors can't vote on their own word. Text only: names and answers never
// become HTML.
import { ICONS } from '/engine/icons.js';
import { labelText } from './categories.js';
import { verdictText, oreoShown } from './rules.js';
import { loc } from '/engine/i18n.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

export function createReview(root, { onVote }) {
  const cards = root.querySelector('#review-cards');
  let key = '';

  function voteButton(group, gi, yes, mine, canVote, state) {
    const count = Object.values(group.votes).filter(v => v === yes).length;
    const button = el('button', `vote ${yes ? 'vote-yes' : 'vote-no'}${mine === yes ? ' is-mine' : ''}`);
    button.type = 'button'; button.dataset.vote = yes ? 'yes' : 'no'; button.dataset.group = String(gi);
    button.innerHTML = yes ? ICONS.thumbUp : ICONS.thumbDown;
    button.append(el('span', '', String(count)));
    button.setAttribute('aria-label', yes ? loc('Sí cuenta · {n}', { n: count }) : loc('No cuenta · {n}', { n: count }));
    button.disabled = !canVote;
    button.addEventListener('click', () => onVote(gi, yes, state.review.index));
    return button;
  }

  function card(state, item, mySeat, players) {
    const r = state.review, group = item.group !== null ? r.groups[item.group] : null, p = players[item.seat];
    const tone = item.status === 'yellow' && group?.accepted !== null ? (group.accepted ? 'green' : 'red') : item.status;
    const li = el('li', `card is-${tone}${item.status === 'yellow' ? ' was-yellow' : ''}${item.answer ? '' : ' is-blank'}${item.seat === mySeat ? ' is-me' : ''}`);
    li.dataset.seat = String(item.seat); li.translate = false;
    li.append(el('span', 'card-name', item.seat === mySeat ? loc('{name} · tú', { name: p.name }) : p.name));
    li.append(el('b', item.answer ? 'card-answer' : 'card-answer is-empty', item.answer || loc('En blanco')));
    if (item.answer) li.append(el('small', 'card-verdict', verdictText(item, group)));
    const explain = item.explain || group?.explain;
    if (explain && item.status !== 'red') li.append(el('small', 'card-explain', `${item.word && item.word !== item.answer ? `${item.word} ` : ''}= ${loc(explain)}`));
    if (item.points) li.append(el('span', 'card-points', `+${item.points}`));
    if (group && r.stage === 'vote') {
      const mine = group.votes[mySeat], author = group.authors.includes(mySeat);
      const canVote = mySeat >= 0 && !author && mine === undefined;
      const votes = el('div', 'card-votes');
      votes.append(voteButton(group, item.group, true, mine, canVote, state), voteButton(group, item.group, false, mine, canVote, state));
      if (author) votes.append(el('small', 'card-note', loc('Es tuya: no votas')));
      li.append(votes);
      if (group.joke === 'oreo') li.append(el('span', oreoShown(state) ? 'card-joke' : 'card-stamp', oreoShown(state) ? loc('200 puntos') : loc('¡Ni lo sueñes!')));
    } else if (group) {
      const yes = Object.values(group.votes).filter(Boolean).length, no = Object.values(group.votes).length - yes;
      li.append(el('small', 'card-tally', loc('{yes} a favor · {no} en contra', { yes, no })));
    }
    return li;
  }

  return {
    render(state, mySeat) {
      const r = state.review; if (!r?.items) return;
      root.querySelector('#review-step').textContent = loc('Categoría {n} de {total} · Ronda {round} de {rounds}', { n: r.index + 1, total: state.categories.length, round: state.round, rounds: state.rounds });
      const title = root.querySelector('#review-title'); title.translate = false;
      title.textContent = loc('{category} con {letter}', { category: labelText(r.category), letter: state.letter });
      const voting = r.stage === 'vote';
      root.querySelector('#review-clock').textContent = voting ? Math.ceil(state.timeLeft) : '';
      root.querySelector('#review-timer').style.setProperty('--pk-value', voting ? String(state.timeLeft / (r.voteTime || 10)) : '0');
      root.querySelector('#review-timer').hidden = !voting;
      root.classList.toggle('is-voting', voting);
      const next = JSON.stringify([state.round, r.index, r.stage, r.groups.map(g => [g.votes, g.accepted]), mySeat, oreoShown(state), state.players.map(p => p.name)]);
      if (next === key) return;
      key = next;
      cards.replaceChildren(...r.items.map(item => card(state, item, mySeat, state.players)));
    },
  };
}
