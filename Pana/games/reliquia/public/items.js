// Everything a pana can pick up, renderer-free. `size` decides how it is
// carried: 'small' loot goes into a hand as a handful (up to HANDFUL pieces),
// 'hand' takes a whole hand, 'big' needs both hands of `need` panas (fewer
// drag it very slowly). Carritos carry the rest. `model` names
// the Studio factory the scene builds it with.
export const ITEMS = {
  // Small loot: quick money, a handful at a time.
  coins: { name: 'Monedas de oro', size: 'small', value: 40, model: 'coinPile' },
  emerald: { name: 'Esmeralda', size: 'small', value: 70, model: 'emerald' },
  pearl: { name: 'Perla de Cubagua', size: 'small', value: 60, model: 'pearl' },
  cup: { name: 'Copa de oro', size: 'small', value: 90, model: 'goldCup' },
  // One-hand treasures: worth more, and they can be thrown across a room.
  mask: { name: 'Máscara de oro', size: 'hand', value: 160, model: 'goldMask' },
  idol: { name: 'Ídolo tallado', size: 'hand', value: 130, model: 'carvedIdol' },
  // Big treasures.
  sunDisk: { name: 'Disco del sol', size: 'big', need: 2, value: 600, radius: 1, model: 'sunDisk' },
  emeraldChest: { name: 'Cofre de esmeraldas', size: 'big', need: 2, value: 700, radius: .9, model: 'emeraldChest' },
  drum: { name: 'Tambor ceremonial', size: 'big', need: 2, value: 420, radius: .8, model: 'ceremonialDrum' },
  mirror: { name: 'Espejo maldito', size: 'big', need: 2, value: 520, radius: .9, model: 'cursedMirror' },
  cart: { name: 'Vagoneta de oro', size: 'big', need: 2, value: 560, radius: 1, model: 'mineCart' },
  stoneHead: { name: 'Cabeza de piedra', size: 'big', need: 3, value: 850, radius: 1.1, model: 'olmecHead' },
  goldJaguar: { name: 'Jaguar de oro', size: 'big', need: 3, value: 1100, radius: 1, model: 'jaguarStatue' },
  altar: { name: 'Altar de cacao y oro', size: 'big', need: 4, value: 1600, radius: 1.25, model: 'cacaoAltar' },
  // Tools: found during the run, for this run only.
  machete: { name: 'Machete', size: 'hand', value: 0, tool: true, model: 'machete' },
  honda: { name: 'Honda de pintura', size: 'hand', value: 0, tool: true, model: 'china' },
  farol: { name: 'Farol', size: 'hand', value: 0, tool: true, model: 'expeditionLantern' },
  botiquin: { name: 'Botiquín', size: 'hand', value: 0, tool: true, model: 'botiquin' },
  marcadora: { name: 'Marcadora de pintura', size: 'hand', value: 0, tool: true, model: 'createPaintMarker' },
  // Enchanted artifacts: a power with a catch, worth money if they reach the truck.
  echoMask: { name: 'Máscara de los ecos', size: 'hand', value: 220, artifact: true, model: 'echoMask', good: 'Revela salas escondidas', bad: 'Llama fantasmas' },
  sandals: { name: 'Alpargatas del mensajero', size: 'hand', value: 200, artifact: true, model: 'messengerSandals', good: 'Corres mucho más', bad: 'No frenas a tiempo' },
  sunCrown: { name: 'Corona del sol', size: 'hand', value: 260, artifact: true, model: 'sunCrown', good: 'Alumbra a tu alrededor', bad: 'Los monstruos te buscan a ti' },
  laughingIdol: { name: 'Ídolo que se ríe', size: 'hand', value: 240, artifact: true, model: 'laughingIdol', good: 'Todo vale más en el camión', bad: 'Se ríe y despierta monstruos' },
  miche: { name: 'Botella de miche', size: 'hand', value: 150, artifact: true, model: 'micheBottle', good: 'Un trago cura mucho', bad: 'Los controles se voltean' },
  compass: { name: 'Brújula torcida', size: 'hand', value: 180, artifact: true, model: 'crookedCompass', good: 'Apunta al mejor tesoro', bad: '…o al jefe más cercano' },
  luckyCoin: { name: 'Moneda de la suerte', size: 'hand', value: 200, artifact: true, model: 'luckyCoin', good: 'Los cofres dan más', bad: 'Las trampas no paran' },
  jaguarHeart: { name: 'Corazón de jaguar', size: 'hand', value: 300, artifact: true, model: 'jaguarHeart', good: 'Golpes enormes', bad: 'Te va gastando la vida' },
};
export const ARTIFACTS = Object.keys(ITEMS).filter(k => ITEMS[k].artifact);
export const SMALL = ['coins', 'emerald', 'pearl', 'cup'];
export const BIG_POOL = [['sunDisk', 'drum', 'cart'], ['emeraldChest', 'mirror', 'sunDisk', 'stoneHead'], ['stoneHead', 'goldJaguar', 'emeraldChest', 'mirror']];
export const HANDFUL = 4;
// One weapon at a time: picking up another swaps it.
export const WEAPONS = ['machete', 'honda', 'marcadora'];
// What a hand is worth: a handful counts every piece.
export const heldValue = h => !h ? 0 : h.pile ? h.pile.reduce((n, k) => n + (ITEMS[k]?.value || 0), 0) : (ITEMS[h.kind]?.value || 0) * (h.worth ?? 1);
export const valueOf = kind => ITEMS[kind]?.value || 0;
