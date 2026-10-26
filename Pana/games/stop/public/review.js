// The review: one category at a time, every pana's answer side by side,
// green (counts), red (doesn't) or yellow (¿Eso cuenta?) with thumbs to vote.
// Authors can't vote on their own word. Text only: names and answers never
// become HTML.
import { ICONS } from '/engine/icons.js';
import { label as categoryLabel } from './categories.js';
import { verdictText } from './rules.js';

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
    button.setAttribute('aria-label', `${yes ? 'Sí cuenta' : 'No cuenta'} · ${count}`);
    button.disabled = !canVote;
    button.addEventListener('click', () => onVote(gi, yes, state.review.index));
    return button;
  }

  function card(state, item, mySeat, players) {
    const r = state.review, group = item.group !== null ? r.groups[item.group] : null, p = players[item.seat];
    const tone = item.status === 'yellow' && group?.accepted !== null ? (group.accepted ? 'green' : 'red') : item.status;
    const li = el('li', `card is-${tone}${item.status === 'yellow' ? ' was-yellow' : ''}${item.answer ? '' : ' is-blank'}${item.seat === mySeat ? ' is-me' : ''}`);
    li.dataset.seat = String(item.seat);
    li.append(el('span', 'card-name', item.seat === mySeat ? `${p.name} · tú` : p.name));
    li.append(el('b', item.answer ? 'card-answer' : 'card-answer is-empty', item.answer || 'En blanco'));
    if (item.answer) li.append(el('small', 'card-verdict', verdictText(item, group)));
    const explain = item.explain || group?.explain;
    if (explain && item.status !== 'red') li.append(el('small', 'card-explain', `${item.word && item.word !== item.answer ? `${item.word} ` : ''}= ${explain}`));
    if (item.points) li.append(el('span', 'card-points', `+${item.points}`));
    if (group && r.stage === 'vote') {
      const mine = group.votes[mySeat], author = group.authors.includes(mySeat);
      const canVote = mySeat >= 0 && !author && mine === undefined;
      const votes = el('div', 'card-votes');
      votes.append(voteButton(group, item.group, true, mine, canVote, state), voteButton(group, item.group, false, mine, canVote, state));
      if (author) votes.append(el('small', 'card-note', 'Es tuya: no votas'));
      li.append(votes);
      if (group.joke === 'oreo') li.append(el('span', state.hostLine.includes('200') ? 'card-joke' : 'card-stamp', state.hostLine.includes('200') ? '200 puntos' : '¡Ni lo sueñes!'));
    } else if (group) {
      const yes = Object.values(group.votes).filter(Boolean).length, no = Object.values(group.votes).length - yes;
      li.append(el('small', 'card-tally', `${yes} a favor · ${no} en contra`));
    }
    return li;
  }

  return {
    render(state, mySeat) {
      const r = state.review; if (!r?.items) return;
      root.querySelector('#review-step').textContent = `Categoría ${r.index + 1} de ${state.categories.length} · Ronda ${state.round} de ${state.rounds}`;
      root.querySelector('#review-title').textContent = `${categoryLabel(r.category)} con ${state.letter}`;
      const voting = r.stage === 'vote';
      root.querySelector('#review-clock').textContent = voting ? Math.ceil(state.timeLeft) : '';
      root.querySelector('#review-timer').style.setProperty('--pk-value', voting ? String(state.timeLeft / (r.voteTime || 10)) : '0');
      root.querySelector('#review-timer').hidden = !voting;
      root.classList.toggle('is-voting', voting);
      const next = JSON.stringify([state.round, r.index, r.stage, r.groups.map(g => [g.votes, g.accepted]), mySeat, state.hostLine.includes('200'), state.players.map(p => p.name)]);
      if (next === key) return;
      key = next;
      cards.replaceChildren(...r.items.map(item => card(state, item, mySeat, state.players)));
    },
  };
}
