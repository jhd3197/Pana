// The shared look of engine/progress.js: a rank chip (title, thin XP bar, an
// optional "+N XP"), the rank-up toast and its ceremony (engine/fx/level-up.js, loaded
// on the first rank-up). Titles are translated here, so a game marks them with locKey().
//
//   const chip = createRankChip(progress); $('titles').before(chip.el);
//   const result = progress.award(xpFor(state), receipt);    // the chip follows by itself
//   chip.gain(result.gained);
//   rankUpToast(result, text => feat(`rank:${result.rank.id}`, text));   // createFeats or createToast
import { loc } from './i18n.js';
import { calm } from './fx/feel.js';

const FILL_MS = 450, RISE_MS = 1200, QUICK = .35, MOST = .85;
const easeOut = (t) => 1 - (1 - t) ** 3;
const smooth = (t) => t * t * (3 - 2 * t);
// How far a bar has come at t (0..1) when it is about to fill: most of the way
// quickly, then a slow crawl through the last sliver.
export const sliverEase = (t) => t < QUICK ? MOST * easeOut(t / QUICK) : MOST + (1 - MOST) * smooth((t - QUICK) / (1 - QUICK));

export function createRankChip(progress) {
  const el = Object.assign(document.createElement('div'), { className: 'pk-rank' });
  const title = Object.assign(document.createElement('span'), { className: 'pk-chip pk-chip--yellow' });
  const bar = Object.assign(document.createElement('div'), { className: 'pk-bar' });
  const earned = Object.assign(document.createElement('b'), { className: 'pk-rank-gain', hidden: true });
  bar.append(document.createElement('i')); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
  el.append(title, bar, earned);
  let shown = progress.inRank(), held = progress.rank(), frame = 0, lastXp = progress.xp();
  const draw = (value) => { shown = value; bar.style.setProperty('--pk-value', String(value)); };
  function glide(from, to, ms, ease, then) {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      draw(from + (to - from) * ease(t));
      if (t < 1) frame = requestAnimationFrame(step); else then?.();
    };
    frame = requestAnimationFrame(step);
  }
  // The bar follows a gain instead of jumping; a new rank crawls full, then starts over.
  function follow(rank, inRank, xp) {
    const gained = xp > lastXp, rankedUp = gained && rank !== held;
    lastXp = xp; held = rank;
    if (!gained || calm() || typeof requestAnimationFrame !== 'function') { cancelAnimationFrame?.(frame); draw(inRank); return; }
    if (!rankedUp) { glide(shown, inRank, FILL_MS, easeOut); return; }
    glide(shown, 1, RISE_MS, sliverEase, () => {
      bar.animate?.([{ filter: 'brightness(3)' }, { filter: 'none' }], { duration: 450 });
      draw(0); glide(0, inRank, FILL_MS, easeOut);
    });
  }
  function update() {
    const rank = progress.rank(), next = progress.next(), inRank = progress.inRank(), xp = progress.xp();
    title.textContent = rank ? loc(rank.title) : '';
    follow(rank, inRank, xp);
    bar.setAttribute('aria-valuenow', String(Math.round(inRank * 100)));
    bar.setAttribute('aria-valuetext', bar.title = next ? `${xp} / ${next.xp} XP` : `${xp} XP`);
  }
  const off = progress.onChange(update);
  update();
  return {
    el, update,
    gain(amount) { earned.hidden = !(amount > 0); earned.textContent = amount > 0 ? `+${amount} XP` : ''; },
    dispose() { off(); cancelAnimationFrame?.(frame); el.remove(); },
  };
}

function celebrate({ rank, gained = 0, xp = 0, newUnlocks = [] }) {
  if (typeof document === 'undefined') return;
  import('./fx/level-up.js').then(({ playLevelUp }) => playLevelUp({
    title: loc(rank.title), stats: [{ label: 'XP', from: xp - gained, to: xp }], unlocks: newUnlocks, rise: RISE_MS,
  })).catch(console.warn);
}

// Says the new rank through the game's toast and plays the ceremony; true if there was one to say.
export function rankUpToast(result, show) {
  if (!result?.rankedUp || !result.rank) return false;
  show(loc('¡Rango nuevo: {rank}!', { rank: loc(result.rank.title) }));
  celebrate(result);
  return true;
}
