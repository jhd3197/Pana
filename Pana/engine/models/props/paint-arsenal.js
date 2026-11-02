// Pepazo's arsenal as plain data, no Three.js: every marker's name, the class it
// belongs to, which attachment mounts its model has and which kind of Mira (optic)
// it takes. paintball-kit.js builds the models from it; Pepazo's pure rules
// (games/pintura/public/armory-data.js, also run by the server) read the same table
// through engine/play/paint-arsenal.js, which adds the class names players read.
// Marker names are proper names and stay Spanish.

// Every marker id with its display name, in menu order (number keys 1–9 follow it).
export const PAINT_WEAPONS = {
  pistol: 'La Chispa', scatter: 'El Trueno', rapid: 'Las Gemelas', rocket: 'El Cohetón', sniper: 'La Lejana', bazooka: 'La Bazuca', // i18n-ignore: proper names
  smg: 'La Metra', minigun: 'La Licuadora', slingshot: 'La China', revolver: 'El Tambor', blunderbuss: 'La Corneta', sprayer: 'La Fumigadora', // i18n-ignore: proper names
  sixshooter: 'El Llanero', pdw: 'La Pulga', carbine: 'La Parrandera', bullpup: 'El Tuqueque', marksman: 'El Zamuro', lmg: 'La Culebrona', // i18n-ignore: proper names
};
// Pepazo's thrown grenades by name (games/pintura/public/armory-data.js GRENADES
// holds their rules; a test keeps the names equal). Capis a Pintazos throws La Piñita.
export const PAINT_GRENADES = { pinita: 'La Piñita', pegajosa: 'La Pegajosa', chispita: 'La Chispita' }; // i18n-ignore: proper names
// The melee set, same kit and paint (Studio only for now).
export const PAINT_MELEE = { bat: 'El Bate', sandal: 'La Chancleta', roller: 'El Rodillo', brush: 'La Brocha', bucket: 'El Tobo', maraca: 'La Maraca' }; // i18n-ignore: proper names
// The arsenal by kind: each group's weapons, in menu order. A group can be empty
// (waiting for its first weapon). The nickname and kind players read are added by
// engine/play/paint-arsenal.js (PAINT_CLASSES), since they go through loc().
export const PAINT_WEAPON_CLASSES = Object.freeze([
  { id: 'pistolas', weapons: ['pistol', 'rapid', 'sixshooter'] },
  { id: 'subfusiles', weapons: ['smg', 'pdw'] },
  { id: 'fusiles', weapons: ['carbine', 'bullpup'] },
  { id: 'ametralladoras', weapons: ['minigun', 'lmg'] },
  { id: 'escopetas', weapons: ['scatter', 'blunderbuss'] },
  { id: 'francotiradores', weapons: ['sniper', 'marksman'] },
  { id: 'lanzadores', weapons: ['rocket', 'bazooka', 'revolver'] },
  { id: 'especiales', weapons: ['slingshot', 'sprayer'] },
  { id: 'granadas', weapons: [] },
  { id: 'melee', weapons: ['bat', 'sandal', 'roller', 'brush', 'bucket', 'maraca'] },
]);
// The class a weapon belongs to ({ id, weapons }), or undefined.
export const weaponClassOf = weapon => PAINT_WEAPON_CLASSES.find(c => c.weapons.includes(weapon));
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
// Camo looks (the model draws them: paintball-kit.js `camo`). Patterned ones carry a
// shader pattern, a scale and four colours (the base, then three accents); solid ones
// are one plain body colour. Which a player owns is the game's business (Pepazo:
// games/pintura/public/camos.js); here is only what each id looks like.
export const PAINT_CAMOS = Object.freeze({
  selva: { name: 'Selva', pattern: 'woodland', scale: 1, colors: ['#4b5b2c', '#2f3a1e', '#7a6a3a', '#1b1f14'] }, // i18n-ignore: proper name
  medanos: { name: 'Médanos de Coro', pattern: 'digital', scale: 1, colors: ['#d8c49a', '#b89a68', '#8a6e48', '#efe3c4'] }, // i18n-ignore: proper name
  bolivar: { name: 'Pico Bolívar', pattern: 'digital', scale: 1, colors: ['#eef2f3', '#b9c4c9', '#7f8d94', '#4c5a61'] }, // i18n-ignore: proper name
  caracas: { name: 'Concreto caraqueño', pattern: 'digital', scale: 1.2, colors: ['#8d9293', '#5f6566', '#b9bdbd', '#2f3436'] }, // i18n-ignore: proper name
  caribe: { name: 'Caribe', pattern: 'woodland', scale: 1.1, colors: ['#18b3b0', '#0c6f8a', '#f2e2b0', '#ff6f61'] }, // i18n-ignore: proper name
  jaguar: { name: 'Jaguar', pattern: 'tiger', scale: 1, colors: ['#f28b42', '#d9732c', '#2a1d14', '#120c08'] }, // i18n-ignore: proper name
  llanero: { name: 'Atardecer llanero', pattern: 'tiger', scale: .9, colors: ['#ff7a2f', '#ffb347', '#c2185b', '#3b1f4a'] }, // i18n-ignore: proper name
  rumba: { name: 'Rumba neón', pattern: 'digital', scale: .9, colors: ['#1a1030', '#ff2fd1', '#26f0ff', '#b7ff2a'] }, // i18n-ignore: proper name
  tricolor: { name: 'Tricolor', pattern: 'splash', scale: 1, colors: ['#ffcc00', '#00247d', '#cf142b', '#ffffff'] }, // i18n-ignore: proper name
  pepazo: { name: 'Pepazo', pattern: 'splash', scale: 1, colors: ['#f8e9c9', '#ff4b4b', '#ffc629', '#3fa7c4'] }, // i18n-ignore: proper name
});
// Solid camos: one colour on the painted body, no shader at all.
export const PAINT_SOLIDS = Object.freeze({
  'liso-mango': '#f28b42', 'liso-caribe': '#29c5cd', 'liso-uva': '#8d85df',
  'liso-crema': '#f8e9c9', 'liso-carbon': '#2f3d3c', 'liso-coral': '#ff4b4b',
});
// Every camo id a kit may name: the solids first, then the patterns.
export const PAINT_CAMO_IDS = Object.freeze([...Object.keys(PAINT_SOLIDS), ...Object.keys(PAINT_CAMOS)]);
