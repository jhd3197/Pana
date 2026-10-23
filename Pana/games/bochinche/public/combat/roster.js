// Adapted from Super Bash Folds (MIT); see ../../SOURCE.md.
import {
  FIGHTER_IDS,
  OPEN_2D_FIGHTER_IDS,
  OPEN_3D_FIGHTER_IDS,
  OPEN_FIGHTER_IDS,

} from "./contracts.js";
import { OPEN_ROSTER } from "./openRoster.js";

export {
  FIGHTER_IDS,
  OPEN_2D_FIGHTER_IDS,
  OPEN_3D_FIGHTER_IDS,
  OPEN_FIGHTER_IDS,
};

/** Visual model height relative to the gameplay hurtbox height. */
export const SPRITE_VISUAL_TO_BODY_HEIGHT_RATIO = 1.17;

export const ROSTER                                       = OPEN_ROSTER;

export function getFighterDefinition(id           )                    {
  return ROSTER[id];
}
