// Milestone celebrations ("feats"): a toast for moments worth cheering —
// ¡500 m derrapados!, ¡Doble pintada!. The game owns the numbers (thresholds
// are gameplay, not engine data) and calls feat(id, text) when something
// happens; this module only keeps a repeat of the same id within a few
// seconds from spamming the screen. Opt-in per game.
//
//   import { createFeats } from '/engine/feats.js';
//   const feat = createFeats($('toast'));   // <div id="toast" class="pk-toast" role="status" aria-live="polite"></div>
//   feat('doble', '¡Doble pintada!');       // shows; the same id stays quiet for cooldownMs
//   const drifted = feat.meter([{ at: 500, text: '¡500 metros derrapados!' }],
//     { every: 1000, text: (m) => `¡${m / 1000} km derrapados!` });
//   drifted.add(12.4);                      // fires each step once, then each km
//   drifted.reset(); feat.reset();          // a new race or round starts over

import { createToast } from './hud.js';

export function createFeats(el, { ms = 2600, cooldownMs = 6000, now = () => performance.now() } = {}) {
  const notify = createToast(el, { ms });
  const last = new Map();   // feat id → now() of its last show
  function feat(id, text) {
    if (!text) return false;
    const t = now();
    if (t - (last.get(id) ?? -Infinity) < cooldownMs) return false;
    last.set(id, t);
    notify(text);
    return true;
  }
  // A cumulative meter over the same toast: each { at, text } step fires once
  // when the total reaches it, and `every` keeps firing at each multiple of
  // itself. Crossings fire once by construction, so no cooldown applies.
  feat.meter = (steps = [], { every = 0, text = (m) => `${m}` } = {}) => {
    let total = 0, step = 0, multiple = 1;
    return {
      add(amount) {
        total += amount;
        while (step < steps.length && total >= steps[step].at) notify(steps[step++].text);
        while (every > 0 && total >= every * multiple) { notify(text(every * multiple)); multiple++; }
        return total;
      },
      reset() { total = 0; step = 0; multiple = 1; },
      get total() { return total; },
    };
  };
  feat.reset = () => last.clear();
  feat.dispose = () => { notify.dispose(); last.clear(); };
  return feat;
}
