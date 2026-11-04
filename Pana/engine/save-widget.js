// The lobby's side of engine/save-game.js (kit.css: pk-save), in the shared
// lobby's own buttons and player cards. Text only: names never become HTML.
//
//   renderContinue(node, store.list(), { describe, onContinue, onDiscard });  // host, data-room-personal
//   renderSlots(node, { heading, slots, action });                            // data-pana-roster
//
// A slot: { key, name, avatar, color, here, label, detail, take, me }. `take` is
// the handler of its Tomar button, for a missing player's slot.
import { loc, locale } from './i18n.js';
import { icon } from './icons.js';
import { portraitImg } from './lobby-roster.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const button = (className, text, run) => { const b = el('button', className, text); b.type = 'button'; b.onclick = run; return b; };
export const saveDate = t => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(t);

export function renderContinue(node, saves, { describe, onContinue, onDiscard }) {
  node.classList.add('pk-save');
  node.hidden = !saves.length;
  node.replaceChildren(...saves.map(save => {
    const row = el('div', 'pk-save-row');
    const discard = button('pk-btn pk-btn--sm pk-btn--ghost pk-save-discard', '', () => onDiscard(save));
    discard.append(icon('close')); discard.setAttribute('aria-label', loc('Borrar'));
    const text = el('span', 'pk-save-text', describe(save)); text.translate = false;
    row.append(button('pk-btn pk-btn--teal pk-save-continue', loc('Continuar'), () => onContinue(save)), text, discard);
    return row;
  }));
}

function slotCard({ name, avatar, color, here, label, detail, take, me }) {
  const card = el('article', ['pk-game-lobby-player', 'pk-save-slot', !here && 'is-held', me && 'is-own'].filter(Boolean).join(' '));
  if (color) card.style.setProperty('--pana-color', color);
  const title = el('b', '', name); title.translate = false;
  card.append(portraitImg(avatar || {}), title);
  if (detail) card.append(el('small', 'pk-save-detail', detail));
  card.append(el('span', `pk-game-lobby-state${here ? ' is-ready' : ''}`, label));
  if (take) card.append(button('pk-btn pk-btn--sm pk-save-take', loc('Tomar'), take));
  return card;
}

export function renderSlots(node, { heading, slots, action = null }) {
  const head = el('div', 'pk-save-head');
  head.append(el('span', 'pk-eyebrow', heading));
  if (action) head.append(button('pk-btn pk-btn--sm pk-save-new', action.label, action.run));
  const grid = el('div', 'pk-game-lobby-players pk-save-slots');
  grid.dataset.capacity = 8;
  grid.append(...slots.map(slotCard));
  node.classList.add('pk-save-roster');
  node.replaceChildren(head, grid);
}
