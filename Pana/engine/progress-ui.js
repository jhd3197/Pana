// The shared look of engine/progress.js: a rank chip (title, thin XP bar, an
// optional "+N XP") and the rank-up toast. Titles are translated here, so a game
// marks them with locKey().
//
//   const chip = createRankChip(progress); $('titles').before(chip.el);
//   const result = progress.award(xpFor(state), receipt);    // the chip follows by itself
//   chip.gain(result.gained);
//   rankUpToast(result, text => feat(`rank:${result.rank.id}`, text));   // createFeats or createToast
import { loc } from './i18n.js';

export function createRankChip(progress) {
  const el = Object.assign(document.createElement('div'), { className: 'pk-rank' });
  const title = Object.assign(document.createElement('span'), { className: 'pk-chip pk-chip--yellow' });
  const bar = Object.assign(document.createElement('div'), { className: 'pk-bar' });
  const earned = Object.assign(document.createElement('b'), { className: 'pk-rank-gain', hidden: true });
  bar.append(document.createElement('i')); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
  el.append(title, bar, earned);
  function update() {
    const rank = progress.rank(), next = progress.next(), inRank = progress.inRank(), xp = progress.xp();
    title.textContent = rank ? loc(rank.title) : '';
    bar.style.setProperty('--pk-value', String(inRank));
    bar.setAttribute('aria-valuenow', String(Math.round(inRank * 100)));
    bar.setAttribute('aria-valuetext', bar.title = next ? `${xp} / ${next.xp} XP` : `${xp} XP`);
  }
  const off = progress.onChange(update);
  update();
  return {
    el, update,
    gain(amount) { earned.hidden = !(amount > 0); earned.textContent = amount > 0 ? `+${amount} XP` : ''; },
    dispose() { off(); el.remove(); },
  };
}

// Says the new rank through the game's toast; true if there was one to say.
export function rankUpToast(result, show) {
  if (!result?.rankedUp || !result.rank) return false;
  show(loc('¡Rango nuevo: {rank}!', { rank: loc(result.rank.title) }));
  return true;
}
