import { cardName } from './rules.js';
import { cardCanvas } from '/engine/models/props/spanish-cards.js';

export function cardButton(card, index) {
  const button = document.createElement('button'); button.className = 'hand-card'; button.dataset.card = card.id;
  button.setAttribute('aria-label', cardName(card)); button.title = `${cardName(card)} · tecla ${index + 1}`;
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 480; canvas.getContext('2d').drawImage(cardCanvas(card), 0, 0); canvas.setAttribute('aria-hidden', 'true');
  const number = document.createElement('span'); number.className = 'card-key'; number.textContent = index + 1; number.setAttribute('data-pana-hint', '');
  button.append(canvas, number); return button;
}
