// A shop whose stock rotates on the clock, the same for everyone. Pure: the window
// comes from epoch time (no time zone, no server), the stock from a seed made of
// the salt and the window, so two players at the same moment see the same shelf.
//
//   const window = rotationWindow(Date.now(), 4 * HOUR);
//   const shelf = rotatingStock(SEEDS, { salt: 'conuco', window, size: 3, qty: [2, 4] });
//   rotationEndsAt(Date.now(), 4 * HOUR);   // when to look again
//
// It walks a seeded shuffle of the whole catalog, so an item comes back only after
// the rest had their turn, and neighbouring windows barely share anything.
import { rng, seedOf } from '../random.js';

export const rotationWindow = (now, period) => Math.floor(now / period);
export const rotationEndsAt = (now, period) => (rotationWindow(now, period) + 1) * period;

function shuffled(ids, salt, round) {
  const random = rng(seedOf(`${salt}:round:${round}`)), list = [...ids];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The items of one window, as [{ item, qty }]. `size` never exceeds the catalog;
// `qty` is the seeded [min, max] one player may buy of each during the window.
export function rotatingStock(catalog, { salt, window, size = 3, qty = [1, 1] }) {
  const total = catalog.length, take = Math.min(size, total), picked = [];
  if (!take) return picked;
  const byId = new Map(catalog.map(item => [item.id, item]));
  const ids = catalog.map(item => item.id).sort();   // catalog order never changes the shelf
  const amounts = rng(seedOf(`${salt}:qty:${window}`));
  for (let i = window * size; picked.length < take; i++) {
    const round = Math.floor(i / total), id = shuffled(ids, salt, round)[i - round * total];
    if (picked.some(entry => entry.item.id === id)) continue;   // a shuffle's end met the next one's start
    picked.push({ item: byId.get(id), qty: qty[0] + Math.floor(amounts() * (qty[1] - qty[0] + 1)) });
  }
  return picked;
}
