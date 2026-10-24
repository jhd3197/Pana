import { createToss } from '../../../engine/play/dice-throw.js';

export const RESULT_HOLD = .95;
export function createLudoToss(options) {
  return createToss({...options,height:1.3,gravity:16});
}
// The vertical throw is identical for all seats. Keep automatic play behind
// the last bounce, then leave a full readable beat on the rolled face.
export function automaticMoveDelay(power) {
  return createLudoToss({from:[0,2.35,0],to:[0,1.835,0],power}).duration+RESULT_HOLD;
}
