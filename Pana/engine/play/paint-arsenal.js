// Pepazo's arsenal as plain data, no Three.js: every marker's name, the class it
// belongs to, which attachment mounts its model has and which kind of Mira (optic)
// it takes. paintball-kit.js builds the models from it; Pepazo's pure rules
// (games/pintura/public/armory-data.js, also run by the server) read the same table.
// Marker names are proper names and stay Spanish; class names go through loc().
import { locKey } from '../i18n.js';

// Every marker id with its display name, in menu order (number keys 1–9 follow it).
export const PAINT_WEAPONS = {
  pistol: 'La Chispa', scatter: 'El Trueno', rapid: 'Las Gemelas', rocket: 'El Cohetón', sniper: 'La Lejana', bazooka: 'La Bazuca', // i18n-ignore: proper names
  smg: 'La Metra', minigun: 'La Licuadora', slingshot: 'La China', revolver: 'El Tambor', blunderbuss: 'La Corneta', sprayer: 'La Fumigadora', // i18n-ignore: proper names
  sixshooter: 'El Llanero', pdw: 'La Pulga', carbine: 'La Parrandera', bullpup: 'El Tuqueque', marksman: 'El Zamuro', lmg: 'La Culebrona', // i18n-ignore: proper names
};
// The melee set, same kit and paint (Studio only for now).
export const PAINT_MELEE = { bat: 'El Bate', sandal: 'La Chancleta', roller: 'El Rodillo', brush: 'La Brocha', bucket: 'El Tobo', maraca: 'La Maraca' }; // i18n-ignore: proper names
// The arsenal by kind. `name` is the group's nickname, `kind` what it really is; a
// group can be empty (waiting for its first weapon).
export const PAINT_CLASSES = [
  { id: 'pistolas', name: locKey('Las de bolsillo'), kind: locKey('Pistolas'), weapons: ['pistol', 'rapid', 'sixshooter'] },
  { id: 'subfusiles', name: locKey('Las ligeritas'), kind: locKey('Subfusiles'), weapons: ['smg', 'pdw'] },
  { id: 'fusiles', name: locKey('Las de batalla'), kind: locKey('Fusiles de asalto'), weapons: ['carbine', 'bullpup'] },
  { id: 'ametralladoras', name: locKey('Las pesadas'), kind: locKey('Ametralladoras'), weapons: ['minigun', 'lmg'] },
  { id: 'escopetas', name: locKey('Las del trancazo'), kind: locKey('Escopetas'), weapons: ['scatter', 'blunderbuss'] },
  { id: 'francotiradores', name: locKey('Las de lejitos'), kind: locKey('Francotiradores'), weapons: ['sniper', 'marksman'] },
  { id: 'lanzadores', name: locKey('Las bombásticas'), kind: locKey('Lanzadores'), weapons: ['rocket', 'bazooka', 'revolver'] },
  { id: 'especiales', name: locKey('Las raritas'), kind: locKey('Especiales'), weapons: ['slingshot', 'sprayer'] },
  { id: 'granadas', name: locKey('Las voladoras'), kind: locKey('Granadas'), weapons: [] },
  { id: 'melee', name: locKey('Los del pescozón'), kind: locKey('Cuerpo a cuerpo'), weapons: ['bat', 'sandal', 'roller', 'brush', 'bucket', 'maraca'] },
];
export const classOf = weapon => PAINT_CLASSES.find(c => c.weapons.includes(weapon));
// The attachment mounts each marker's model has: a muzzle for the Cañón afinado
// (barrel), a feed for the Tolva grande (hopper), a stock mount (launchers take
// sliding rods) and a rail or bracket for the Mira (optic). Every mount sits at a
// different place on the model, so any three can be fitted together.
// A marker without a mount leaves it out here and the armory greys that part out.
const ALL = ['barrel', 'hopper', 'stock', 'optic'];
// The melee set has its own three places instead: the grip for a tape wrap, the head
// for paint drips and the pommel for a wrist strap.
export const PAINT_MELEE_PARTS = Object.freeze(['tape', 'drip', 'strap']);
export const PAINT_MOUNTS = Object.freeze(Object.fromEntries([...Object.keys(PAINT_WEAPONS).map(id => [id, ALL]), ...Object.keys(PAINT_MELEE).map(id => [id, PAINT_MELEE_PARTS])]));
// The Mira each marker takes (the model draws that kind): `dot` a red dot, `holo` a
// holographic box, `laser` an under-barrel laser, `scope` a magnifying scope
// (La Lejana's long-range scope, La Corneta's brass one), `pin` La China's
// hunter's pin sight.
export const PAINT_OPTICS = Object.freeze({
  pistol: 'dot', scatter: 'holo', rapid: 'laser', rocket: 'holo', sniper: 'scope', bazooka: 'holo',
  smg: 'holo', minigun: 'dot', slingshot: 'pin', revolver: 'holo', blunderbuss: 'scope', sprayer: 'dot',
  sixshooter: 'dot', pdw: 'dot', carbine: 'holo', bullpup: 'holo', marksman: 'dot', lmg: 'dot',
});
// The barrel axis height above the grip, per marker: where a muzzle flash or a
// shell leaves the barrel. The model's own `userData.bore` (its muzzle mount's
// height) is the source; a browser suite keeps the two equal.
export const PAINT_KIT_BORE = Object.freeze({
  pistol: .17, scatter: .225, rapid: .17, rocket: .22, sniper: .17, bazooka: .24,
  smg: .18, minigun: .2, slingshot: .31, revolver: .305, blunderbuss: .2, sprayer: .15,
  sixshooter: .232, pdw: .175, carbine: .175, bullpup: .175, marksman: .175, lmg: .2,
});
