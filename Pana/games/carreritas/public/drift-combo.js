// The combo meter over the speedometer: while a drift chain is live it shows
// the unbanked pot and the multiplier ("850 ×3"), the multiplier heating up
// with the chain; when the pot banks it flashes "+850" before hiding. All the
// scoring math lives in drift-score.js; this module only mirrors it into the
// DOM, writing text and classes solely when they change (presentRace runs
// every frame, and a write invalidates layout even when equal).
import { createDriftScoring } from './drift-score.js';

const FLASH_MS = 900;

export function createDriftCombo(el, opts) {
  const scoring = createDriftScoring(opts);
  const pts = el.querySelector('.combo-pts');
  const mult = el.querySelector('.combo-mult');
  let shownPts = '', shownChain = 0, shownActive = null, bankSeq = 0, flash = 0;
  return {
    step: (c, dt) => scoring.step(c, dt),
    finish: (c) => scoring.finish(c),
    totalOf: (c) => scoring.totalOf(c),
    bestChainOf: (c) => scoring.bestChainOf(c),
    live: (c) => scoring.live(c),
    reset() {
      scoring.reset();
      clearTimeout(flash); flash = 0;
      el.classList.remove('banked');
      shownPts = ''; shownChain = 0; shownActive = null; bankSeq = 0;
      el.hidden = true;
    },
    // Mirror the local player's chain into the meter, once per drawn frame.
    update(c) {
      const s = scoring.live(c);
      if (s.bankSeq !== bankSeq) {
        bankSeq = s.bankSeq;
        if (s.lastBank > 0) {
          // The pot just banked: flash the gain, then let the meter hide.
          clearTimeout(flash);
          el.hidden = false; shownActive = true;
          el.classList.add('banked');
          shownPts = `+${s.lastBank}`; pts.textContent = shownPts;
          flash = setTimeout(() => { el.classList.remove('banked'); flash = 0; }, FLASH_MS);
          return;
        }
      }
      if (flash) return;   // let the banked flourish play out
      const active = s.active && s.points > 0;
      if (active !== shownActive) { shownActive = active; el.hidden = !active; }
      if (!active) return;
      const text = String(s.points);
      if (text !== shownPts) { shownPts = text; pts.textContent = text; }
      if (s.chain !== shownChain) {
        shownChain = s.chain;
        mult.textContent = `×${s.chain}`;
        el.dataset.chain = s.chain;
      }
    },
  };
}
