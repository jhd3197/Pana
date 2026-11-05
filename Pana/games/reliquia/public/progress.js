// Fosa's diver ranks on the shared progress (engine/progress.js): the table, what
// an expedition pays, and the line on the results screen. The unlock ids are
// stable names read through progress.isUnlocked(id); 'pacto:*' gates the lobby's
// pacts (options.js fieldsFor).
import { createProgress } from '../../../engine/progress.js';
import { createRankChip, rankUpToast } from '../../../engine/progress-ui.js';
import { createFeats } from '../../../engine/feats.js';
import { loc, locKey } from '../../../engine/i18n.js';
import { calorOfOptions, xpMult, bonusPercent } from './pactos.js';

const TOAST_MS = 2700;   // the feats toast's own 2600 ms, and a beat

export const RANKS = [
  { id: 'aprendiz', title: locKey('Aprendiz'), xp: 0, unlocks: [] },
  { id: 'buzo', title: locKey('Buzo'), xp: 25, unlocks: ['pacto:cuota', 'traje:franja'] },
  { id: 'cuerdero', title: locKey('Cuerdero'), xp: 120, unlocks: ['pacto:turno', 'traje:remiendo'] },
  { id: 'farolero', title: locKey('Farolero'), xp: 350, unlocks: ['pacto:tienda', 'farol:ambar'] },
  { id: 'veterano', title: locKey('Veterano'), xp: 750, unlocks: ['pacto:codicia', 'casco:cobre'] },
  { id: 'capataz', title: locKey('Capataz'), xp: 1300, unlocks: ['pacto:enjambre', 'traje:capataz'] },
  { id: 'pionero', title: locKey('Pionero'), xp: 2300, unlocks: ['pacto:silbon', 'casco:plata'] },
  { id: 'leyenda', title: locKey('Leyenda'), xp: 4000, unlocks: ['traje:leyenda', 'casco:oro'] },
];

// What one finished expedition pays this pana. A wipe still pays; the time part
// keeps a dive that lasted seconds from being worth repeating. Late spectators
// did not dive: nothing. Calor multiplies the whole award.
export function xpFor(state, playerId) {
  const p = state.players?.find(q => q.id === playerId);
  if (!p || p.spectator) return 0;
  const haul = state.haul || 0;
  const earned = 10 + Math.min(20, Math.floor((state.time || 0) / 15))   // the dive itself, full at five minutes
    + 15 * Math.max(0, (state.level || 1) - 1)                   // jornadas cleared
    + Math.min(60, Math.floor(haul / 100))                       // what reached the truck
    + 10 * (state.encargosWon || 0)
    + Math.min(20, Math.floor((state.sobretiempo || 0) / 2))      // mangos earned past the quota
    + Math.min(20, 5 * (p.stats?.revives || 0))
    + (state.outcome === 'extracted' && haul > 0 ? 20 : 0);
  return Math.round(earned * xpMult(calorOfOptions(state.options)));
}
// A daily's seed repeats, so another try at it needs the clock to be a new receipt.
export const receiptFor = state => `${state.seed}:${state.level}:${state.outcome}${state.daily ? `:${Math.round(state.time * 10)}` : ''}`;

export function createFosaProgress({ storage } = {}) {
  const progress = createProgress({ game: 'reliquia', ranks: RANKS, ...(storage !== undefined ? { storage } : {}) });
  let chip = null, feat = null, heat = null, settled = '', earned = 0, waiting = null;
  // XP from during a dive (the Cuaderno): saved now, while its line and any rank-up
  // wait for the results, so the ceremony never lands in the middle of a chase.
  function earn(amount, receipt) {
    const result = progress.award(amount, receipt, { dive: false });
    earned += result.gained;
    if (result.rankedUp) waiting = { ...result, newUnlocks: [...(waiting?.newUnlocks || []), ...result.newUnlocks] };
    return result;
  }
  // Every render of the results screen lands here; only a new expedition pays.
  // `onSettled` (daily.js) may pay a bonus on top, which joins the same line, and add a toast.
  function settle(state, playerId, onSettled) {
    if (!chip) {
      chip = createRankChip(progress); document.getElementById('titles').before(chip.el);
      // Beside the "+N XP": what the dive's Calor added to it.
      heat = Object.assign(document.createElement('b'), { className: 'pk-rank-gain', id: 'result-calor', hidden: true }); chip.el.append(heat);
      // The kit's toast: Fosa's own #toast sits under the results layer.
      const el = Object.assign(document.createElement('div'), { id: 'rank-toast', className: 'pk-toast' });
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      document.body.append(el); feat = createFeats(el);
    }
    const receipt = receiptFor(state);
    if (receipt === settled) return;
    const p = state.players.find(q => q.id === playerId);
    if (!p) return;   // not in the room's list yet: the next snapshot decides
    settled = receipt;
    const percent = p.spectator ? 0 : bonusPercent(calorOfOptions(state.options));
    heat.hidden = !percent; heat.textContent = percent ? loc('Calor +{pct} %', { pct: percent }) : '';
    if (p.spectator) { chip.gain(0); return; }
    const result = progress.award(xpFor(state, playerId), receipt);
    const extra = onSettled?.(state, result), bonus = extra?.bonus;
    const line = result.gained + (bonus?.gained || 0) + earned;
    chip.gain(line);
    const during = waiting && { ...waiting, gained: line, xp: progress.xp() };
    earned = 0; waiting = null;
    const rankedUp = [bonus, result, during].some(r => rankUpToast(r, text => feat(`rank:${r.rank.id}`, text)));
    // A rank-up keeps the toast first; anything else about this dive waits its turn.
    if (extra?.toast) { if (rankedUp) setTimeout(() => feat(...extra.toast), TOAST_MS); else feat(...extra.toast); }
  }
  // The lobby's one Calor number: a small chip that shows only when a pact is on.
  function calorChip(parent) {
    const el = Object.assign(document.createElement('span'), { className: 'pk-chip pk-chip--coral calor-chip', id: 'calor-chip' });
    el.style.display = 'none'; parent?.append(el);
    return options => { const calor = calorOfOptions(options); el.style.display = calor ? '' : 'none'; el.textContent = calor ? loc('Calor {n}', { n: calor }) : ''; };
  }
  return { progress, settle, earn, calorChip };
}
