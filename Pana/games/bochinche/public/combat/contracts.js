// Adapted from Super Bash Folds (MIT); see ../../SOURCE.md.
import {
  OPEN_2D_FIGHTER_IDS,
  OPEN_3D_FIGHTER_IDS,
} from "./generated/openFighterRegistry.js";
import { OPEN_STAGE_IDS } from "./generated/openStageRegistry.js";

export { OPEN_2D_FIGHTER_IDS, OPEN_3D_FIGHTER_IDS, OPEN_STAGE_IDS };

/** All distributable fighters, regardless of their source rendering pipeline. */
export const OPEN_FIGHTER_IDS = [
  ...OPEN_3D_FIGHTER_IDS,
  ...OPEN_2D_FIGHTER_IDS,
]         ;

/** Runtime roster order used by gameplay and content-driven UI surfaces. */
export const FIGHTER_IDS = OPEN_FIGHTER_IDS;

export const isOpenFighterId = (fighter           )                           =>
  (OPEN_FIGHTER_IDS                        ).includes(fighter);

export const isOpen2DFighterId = (fighter           )                             =>
  (OPEN_2D_FIGHTER_IDS                        ).includes(fighter);

export const isOpen3DFighterId = (fighter           )                             =>
  (OPEN_3D_FIGHTER_IDS                        ).includes(fighter);

