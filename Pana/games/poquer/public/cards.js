import { face, suit, suitName } from './rules.js';
// Card suits are vector artwork, never platform-dependent symbol glyphs.
const paths = ['M9 11C2 11 2 3 8 3C8-3 16-3 16 3C22 3 22 11 15 11L17 18H7Z', 'M12 0L22 10L12 20L2 10Z', 'M12 19C8 15 1 10 1 5C1-2 10-2 12 3C14-2 23-2 23 5C23 10 16 15 12 19Z', 'M12 0C9 4 1 9 1 13C1 19 8 19 11 15L8 22H16L13 15C16 19 23 19 23 13C23 9 15 4 12 0Z'];
export function cardNode(card, empty = false) {
  const node = document.createElement('div'); node.className = `card${empty ? ' empty' : card === null ? ' back' : [1, 2].includes(suit(card)) ? ' red' : ''}`;
  if (empty) { node.setAttribute('aria-label', 'Carta por revelar'); return node; }
  if (card === null) { node.setAttribute('aria-label', 'Carta oculta'); return node; }
  node.setAttribute('aria-label', `${face(card)} de ${suitName(card)}`);
  node.innerHTML = `<b>${face(card)}</b><svg viewBox="0 -2 24 26" aria-hidden="true"><path d="${paths[suit(card)]}"/></svg>`; return node;
}
export function renderCards(element, cards, placeholders = 0) { element.replaceChildren(...cards.map(c => cardNode(c)), ...Array.from({ length: Math.max(0, placeholders - cards.length) }, () => cardNode(null, true))); }
