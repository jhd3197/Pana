import { createToss } from '../../../engine/play/dice-throw.js';

export const RESULT_HOLD = 1.2;
export const HOP = .24, FLIGHT = 1.1;
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
