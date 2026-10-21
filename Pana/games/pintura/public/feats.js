// Pepazo's milestone toasts: painting a rival, and quick doubles and triples.
// game.js feeds every confirmed hit; the window and the strings live here.
// Pure logic — tests drive it with a fake feat() and their own clock.

export const MULTI_WINDOW_MS = 5000;

export function createHitFeats(feat, { now = () => performance.now() } = {}) {
  let hits = [];   // now() timestamps of my recent hits
  return {
    hit(victimName) {
      const t = now();
      hits = hits.filter(h => t - h < MULTI_WINDOW_MS);
      hits.push(t);
      feat(`pintada:${victimName}`, `¡Pintaste a ${victimName}!`);
      if (hits.length === 3) feat('triple', '¡Triple pintada!');
      else if (hits.length === 2) feat('doble', '¡Doble pintada!');
    },
    reset() { hits = []; },
  };
}
