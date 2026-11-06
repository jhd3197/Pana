// Numbers over the fighters, read from how each body's mareo changed in a snapshot:
// whatever raised it (a jab, a chair, the bull) counts, and the rules stay untouched.
import { createDamageBar, createDamageNumbers, fanAt } from '/engine/fx/damage.js';
import { createScreenFx, preloadFx } from '/engine/fx/pixelfx-bridge.js';
import { loc } from '/engine/i18n.js';

const NOTICE = .5, HEAL = 3;
const isCrit = (e) => e.type === 'trompon' || (e.type === 'hit' && !!(e.counter || e.contra || e.armed));

export function createFightDamage({ at }) {
  const numbers = createDamageNumbers(), seen = new Map(), crits = new Set(), bars = new Set(), burst = createScreenFx({ max: 2 });
  let crit = 0;
  preloadFx('crit-number').catch(console.warn);
  // A crit stamps the pixel number; the plain number stands in if it can't show.
  const popCrit = (spot, value) => {
    const scale = innerWidth < 600 ? 1 : value >= 30 ? 3 : 2;
    return burst.play('crit-number', spot.x + fanAt(crit++) * 70, spot.y + 70, { scale, text: `${Math.round(value)}!`, label: loc('CRITICO') });
  };
  return {
    bar(root, side) { const bar = createDamageBar(root, { max: 100, side }); bars.add(bar); return bar; },
    clearBars() { bars.clear(); },
    tick(dt) { for (const bar of bars) bar.tick(dt); burst.tick(dt); },
    react(e) {
      if (['intro', 'tutorial'].includes(e.type)) seen.clear();
      if (isCrit(e)) crits.add(e.id);
    },
    // After a snapshot's events: its hits say which rises were crits.
    settle(state) {
      const live = ['intro', 'fight'].includes(state.phase);
      for (const body of state.bodies || []) {
        const before = seen.get(body.id), delta = before == null ? 0 : body.mareo - before;
        seen.set(body.id, body.mareo);
        if (!live || (delta < NOTICE && delta > -HEAL)) continue;
        const spot = at(body.id);
        if (!spot) continue;
        const kind = delta < 0 ? 'heal' : crits.has(body.id) ? 'crit' : 'hit';
        if (kind !== 'crit' || !popCrit(spot, delta)) numbers.pop(spot.x, spot.y, Math.abs(delta), { kind });
      }
      crits.clear();
    },
  };
}
