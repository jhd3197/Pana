// How a planted crop is doing at a given moment. Pure: everything comes from the
// timestamp it was planted at, so a plant keeps growing while the page is closed.
// No Three.js, no DOM, no clock of its own.
//
//   const state = cropState({ at: plantedAt }, { growMs: 15 * MINUTE }, Date.now());
//   state.stage;                    // 'seed' | 'sprout' | 'young' | 'ready' | 'wilted'
//   state.growth; state.wilt;       // 0..1
//   state.share;                    // what it pays: 1 while fresh, down to `floor` when wilted
//
// Neglect is gentle: a plant waits fresh for `after` ms, then wilts over `span` ms
// and stops there. It never dies, and a wilted plant still pays `floor` of its value.
import { clamp } from '../random.js';

export const MINUTE = 60_000, HOUR = 60 * MINUTE;
export const WILT = Object.freeze({ after: 24 * HOUR, span: 24 * HOUR, floor: .5 });
// Where growth (0..1) changes the plant's look.
export const STAGE_AT = Object.freeze({ sprout: .15, young: .5 });

export function cropState(planted, crop, now, wilt = WILT) {
  const grow = Math.max(1, crop.growMs);
  // A clock set back, or a save from a clock ahead, never gives a negative age.
  const age = Math.max(0, now - planted.at), growth = clamp(age / grow), ready = age >= grow;
  const faded = ready ? clamp((age - grow - wilt.after) / Math.max(1, wilt.span)) : 0;
  const stage = !ready ? (growth < STAGE_AT.sprout ? 'seed' : growth < STAGE_AT.young ? 'sprout' : 'young') : faded > 0 ? 'wilted' : 'ready';
  return { stage, growth, ready, wilt: faded, remaining: Math.max(0, grow - age), share: 1 - faded * (1 - wilt.floor) };
}
// What a harvest pays: at least 1 of anything the crop pays at all.
export const scaled = (amount, share) => amount > 0 ? Math.max(1, Math.round(amount * share)) : 0;
