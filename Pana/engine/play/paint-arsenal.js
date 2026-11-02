// Pepazo's arsenal for game code: the plain data lives with the models
// (engine/models/props/paint-arsenal.js, no Three.js, safe in rules and on the
// server); this adds what players read about each class, through loc().
import { locKey } from '../i18n.js';
import { PAINT_WEAPON_CLASSES } from '../models/props/paint-arsenal.js';

export {
  PAINT_WEAPONS, PAINT_GRENADES, PAINT_MELEE, PAINT_WEAPON_CLASSES, PAINT_MELEE_PARTS, PAINT_MOUNTS,
  PAINT_OPTICS, PAINT_KIT_BORE, PAINT_CAMOS, PAINT_SOLIDS, PAINT_CAMO_IDS,
} from '../models/props/paint-arsenal.js';

// Each class's nickname (`name`) and what it really is (`kind`).
const NAMES = {
  pistolas: [locKey('Las de bolsillo'), locKey('Pistolas')],
  subfusiles: [locKey('Las ligeritas'), locKey('Subfusiles')],
  fusiles: [locKey('Las de batalla'), locKey('Fusiles de asalto')],
  ametralladoras: [locKey('Las pesadas'), locKey('Ametralladoras')],
  escopetas: [locKey('Las del trancazo'), locKey('Escopetas')],
  francotiradores: [locKey('Las de lejitos'), locKey('Francotiradores')],
  lanzadores: [locKey('Las bombásticas'), locKey('Lanzadores')],
  especiales: [locKey('Las raritas'), locKey('Especiales')],
  granadas: [locKey('Las voladoras'), locKey('Granadas')],
  melee: [locKey('Los del pescozón'), locKey('Cuerpo a cuerpo')],
};
// The arsenal by kind, in menu order: { id, name, kind, weapons }.
export const PAINT_CLASSES = PAINT_WEAPON_CLASSES.map(({ id, weapons }) => ({ id, name: NAMES[id][0], kind: NAMES[id][1], weapons: [...weapons] }));
export const classOf = weapon => PAINT_CLASSES.find(c => c.weapons.includes(weapon));
