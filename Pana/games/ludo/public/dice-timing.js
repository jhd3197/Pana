import { createToss } from '../../../engine/play/dice-throw.js';

export const RESULT_HOLD = 1.2;
export const HOP = .24, FLIGHT = 1.1;
// The longest a single host tick may count, so a tab waking from sleep does not
// spend its nap on the idle or bot clocks.
export const MAX_TICK = .75;
export const hostTick = seconds => Math.min(MAX_TICK, seconds);
// What a tick spends on a pause. Visuals run on the wall clock, so the time before
// the closing beat is spent in full however late the tick is; a ceiling here is what
// stretched a 3 s pause past a minute on a slow host. One tick never crosses into the
// beat, and the beat counts at most BEAT_TICK per tick. A guest's die lands up to a few
// frames after the host's, so the beat must last a few frames, not just its 1.2 s: at
// normal frame rates it is exactly RESULT_HOLD, on a slow machine it stretches to fit.
export const BEAT_TICK = .3;
export const pauseTick = (remaining, seconds) => remaining > RESULT_HOLD
  ? Math.min(seconds, remaining - RESULT_HOLD)
  : Math.min(BEAT_TICK, seconds);
export const motionDuration = steps => Math.max(1.2, steps * .3);
export const movePause = (steps, captured) => Math.max(motionDuration(steps), steps * HOP + (captured ? FLIGHT : 0)) + .45;
// Rules already know the next seat; presentation keeps the actor until it settles.
export const presentedState = state => state.turnPause ? {...state, turn:state.turnPause.seat} : state;
export function createLudoToss(options) {
  return createToss({...options,height:1.3,gravity:16});
}
// The vertical throw is identical for all seats. Keep automatic play behind
// the last bounce, then leave a full readable beat on the rolled face.
export function automaticMoveDelay(power) {
  return createLudoToss({from:[0,2.35,0],to:[0,1.835,0],power}).duration+RESULT_HOLD;
}
