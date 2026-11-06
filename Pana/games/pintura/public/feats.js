// Pepazo's milestone toasts: painting a rival, and quick doubles and triples, plus
// the per-weapon hit events behind the camo unlocks.
// game.js feeds every confirmed hit; the window and the strings live here.
// Pure logic — tests drive it with a fake feat() and their own clock.
import { statCount, statEvent } from '/engine/stats.js';
import { loc } from '/engine/i18n.js';
import { weaponOf } from './armory-data.js';

export const MULTI_WINDOW_MS = 5000;

// `event` is statEvent; tests pass their own.
export function createHitFeats(feat, { now = () => performance.now(), event = statEvent } = {}) {
  let hits = [];   // now() timestamps of my recent hits
  let winCounted = false;   // one rounds-won count per round; reset() on the next
  return {
    hit(victimName) {
      const t = now();
      event('pintura.paint-hits');
      hits = hits.filter(h => t - h < MULTI_WINDOW_MS);
      hits.push(t);
      feat(`pintada:${victimName}`, loc('¡Pintaste a {name}!', { name: victimName }));
      if (hits.length === 3) feat('triple', loc('¡Triple pintada!'));
      else if (hits.length === 2) feat('doble', loc('¡Doble pintada!'));
    },
    // One rival painted with `weapon` (the hit event's id, a knockout blow too): pana.sh
    // counts these per weapon to unlock camos. Grenades and unknown ids count nothing.
    weaponHit(weapon) {
      if (typeof weapon !== 'string' || !weaponOf(weapon)) return false;
      event(`pintura.hits.${weapon}`);
      return true;
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
