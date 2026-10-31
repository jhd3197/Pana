import { face, suit, suitName } from './rules.js';
import { loc } from '/engine/i18n.js';
// Card suits are vector artwork, never platform-dependent symbol glyphs.
import { CARD_SUITS as paths } from '/engine/models/core/playing-card-art.js';
export function cardNode(card, empty = false) {
  const node = document.createElement('div'); node.className = `card${empty ? ' empty' : card === null ? ' back' : [1, 2].includes(suit(card)) ? ' red' : ''}`;
  if (empty) { node.setAttribute('aria-label', loc('Carta por revelar')); return node; }
  if (card === null) { node.setAttribute('aria-label', loc('Carta oculta')); return node; }
  node.setAttribute('aria-label', loc('{face} de {suit}', { face: face(card), suit: loc(suitName(card)) }));
  node.innerHTML = `<b>${face(card)}</b><svg viewBox="0 -2 24 26" aria-hidden="true"><path d="${paths[suit(card)]}"/></svg>`; return node;
}
export function renderCards(element, cards, placeholders = 0) { element.replaceChildren(...cards.map(c => cardNode(c)), ...Array.from({ length: Math.max(0, placeholders - cards.length) }, () => cardNode(null, true))); }
