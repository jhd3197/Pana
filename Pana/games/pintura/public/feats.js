// Pepazo's milestone toasts: painting a rival, and quick doubles and triples.
// game.js feeds every confirmed hit; the window and the strings live here.
// Pure logic — tests drive it with a fake feat() and their own clock.
import { statCount, statEvent } from '/engine/stats.js';

export const MULTI_WINDOW_MS = 5000;

export function createHitFeats(feat, { now = () => performance.now() } = {}) {
  let hits = [];   // now() timestamps of my recent hits
  let winCounted = false;   // one rounds-won count per round; reset() on the next
  return {
    hit(victimName) {
      const t = now();
      statEvent('pintura.paint-hits');
      hits = hits.filter(h => t - h < MULTI_WINDOW_MS);
      hits.push(t);
      feat(`pintada:${victimName}`, `¡Pintaste a ${victimName}!`);
      if (hits.length === 3) feat('triple', '¡Triple pintada!');
      else if (hits.length === 2) feat('doble', '¡Doble pintada!');
    },
    // The round's results are up and the local pana is a winner: count it
    // once, however often the results screen re-renders. Returns whether this
    // call counted.
    win() {
      if (winCounted) return false;
      winCounted = true;
      statCount('pintura.rounds-won');
      return true;
    },
    reset() { hits = []; winCounted = false; },
  };
}
