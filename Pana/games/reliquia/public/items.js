// Everything a pana can pick up, renderer-free. `size` decides how it is
// carried: 'small' loot goes into a hand as a handful (up to HANDFUL pieces),
// 'hand' takes a whole hand, 'big' needs both hands of `need` panas (fewer
// drag it very slowly). Carritos carry the rest. `model` names
// the Studio factory the scene builds it with.
import { loc, locKey, formatNumber } from '../../../engine/i18n.js';
export const ITEMS = {
  // Small loot: quick money, a handful at a time.
  coins: { name: locKey('Monedas de oro'), size: 'small', value: 40, model: 'coinPile' },
  emerald: { name: locKey('Esmeralda'), size: 'small', value: 70, model: 'emerald' },
  pearl: { name: locKey('Perla de Cubagua'), size: 'small', value: 60, model: 'pearl' },
  cup: { name: locKey('Copa de oro'), size: 'small', value: 90, model: 'goldCup' },
  // One-hand treasures: worth more, and they can be thrown across a room.
  mask: { name: locKey('Máscara de oro'), size: 'hand', value: 160, model: 'goldMask' },
  idol: { name: locKey('Ídolo tallado'), size: 'hand', value: 130, model: 'carvedIdol' },
  // Big treasures.
  sunDisk: { name: locKey('Disco del sol'), size: 'big', need: 2, value: 600, radius: 1, model: 'sunDisk' },
  emeraldChest: { name: locKey('Cofre de esmeraldas'), size: 'big', need: 2, value: 700, radius: .9, model: 'emeraldChest' },
  drum: { name: locKey('Tambor ceremonial'), size: 'big', need: 2, value: 420, radius: .8, model: 'ceremonialDrum' },
  mirror: { name: locKey('Espejo maldito'), size: 'big', need: 2, value: 520, radius: .9, model: 'cursedMirror' },
  cart: { name: locKey('Vagoneta de oro'), size: 'big', need: 2, value: 560, radius: 1, model: 'mineCart' },
  stoneHead: { name: locKey('Cabeza de piedra'), size: 'big', need: 3, value: 850, radius: 1.1, model: 'olmecHead' },
  goldJaguar: { name: locKey('Jaguar de oro'), size: 'big', need: 3, value: 1100, radius: 1, model: 'jaguarStatue' },
  altar: { name: locKey('Altar de cacao y oro'), size: 'big', need: 4, value: 1600, radius: 1.25, model: 'cacaoAltar' },
  // Tools: found during the run, for this run only.
  machete: { name: locKey('Machete'), size: 'hand', value: 0, tool: true, model: 'machete' },
  honda: { name: locKey('Honda de pintura'), size: 'hand', value: 0, tool: true, model: 'china' },
  farol: { name: locKey('Farol'), size: 'hand', value: 0, tool: true, model: 'expeditionLantern' },
  botiquin: { name: locKey('Botiquín'), size: 'hand', value: 0, tool: true, model: 'botiquin' },
  marcadora: { name: locKey('Marcadora de pintura'), size: 'hand', value: 0, tool: true, model: 'createPaintMarker' },
  // Enchanted artifacts: a power with a catch, worth money if they reach the truck.
  echoMask: { name: locKey('Máscara de los ecos'), size: 'hand', value: 220, artifact: true, model: 'echoMask', good: locKey('Revela salas escondidas'), bad: locKey('Llama fantasmas') },
  sandals: { name: locKey('Alpargatas del mensajero'), size: 'hand', value: 200, artifact: true, model: 'messengerSandals', good: locKey('Corres mucho más'), bad: locKey('No frenas a tiempo') },
  sunCrown: { name: locKey('Corona del sol'), size: 'hand', value: 260, artifact: true, model: 'sunCrown', good: locKey('Alumbra a tu alrededor'), bad: locKey('Los monstruos te buscan a ti') },
  laughingIdol: { name: locKey('Ídolo que se ríe'), size: 'hand', value: 240, artifact: true, model: 'laughingIdol', good: locKey('Todo vale más en el camión'), bad: locKey('Se ríe y despierta monstruos') },
  miche: { name: locKey('Botella de miche'), size: 'hand', value: 150, artifact: true, model: 'micheBottle', good: locKey('Un trago cura mucho'), bad: locKey('Los controles se voltean') },
  compass: { name: locKey('Brújula torcida'), size: 'hand', value: 180, artifact: true, model: 'crookedCompass', good: locKey('Apunta al mejor tesoro'), bad: locKey('…o al jefe más cercano') },
  luckyCoin: { name: locKey('Moneda de la suerte'), size: 'hand', value: 200, artifact: true, model: 'luckyCoin', good: locKey('Los cofres dan más'), bad: locKey('Las trampas no paran') },
  jaguarHeart: { name: locKey('Corazón de jaguar'), size: 'hand', value: 300, artifact: true, model: 'jaguarHeart', good: locKey('Golpes enormes'), bad: locKey('Te va gastando la vida') },
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
// Names stay Spanish keys in rules and state; each client shows its own language.
export const itemName = kind => loc(ITEMS[kind]?.name || '');
// Text the rules put in state or events (a locKey and its `vars`) in this
// client's language: numbers formatted, an item kind under `item`/`other`
// becomes its name ({item} lower case, {Item} as written), `place` a floor name.
export function say(text, vars) {
  if (!text) return '';
  if (!vars) return loc(text);
  const out = {};
  for (const [key, value] of Object.entries(vars)) out[key] = typeof value === 'number' ? formatNumber(Math.round(value)) : value;
  for (const key of ['item', 'other']) if (ITEMS[vars[key]]) {
    const name = itemName(vars[key]);
    out[key] = name.toLowerCase(); out[key[0].toUpperCase() + key.slice(1)] = name;
  }
  if (vars.place) out.place = loc(vars.place);
  return loc(text, out);
}
