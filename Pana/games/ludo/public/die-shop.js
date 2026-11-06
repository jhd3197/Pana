// The table die's looks: which ones this device owns and which one it shows.
// No Three.js and no DOM, so board-model.js can read a look and tests can run
// it. The wallet is handed in: only the shop spends, the model never touches it.
export const DIE_SHOP_KEY = 'pana:ludo:dado';
export const DEFAULT_DIE = 'crema';
export const MANGO_DIE = 'mango';
export const DIE_LOOKS = [
  { id: DEFAULT_DIE, cost: 0, face: ['#fff6e2', '#fff6e2'], pip: '#302435', roughness: .35 },
  { id: MANGO_DIE, cost: 150, face: ['#ffd23f', '#ff8a1c'], trim: '#fff0a8', pip: '#5a1e0a', roughness: .24 },
];
// An unknown id shows the free die, so an old save can never leave the table without one.
export const dieLook = id => DIE_LOOKS.find(look => look.id === id) ?? DIE_LOOKS[0];
const known = id => DIE_LOOKS.some(look => look.id === id);
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function createDieShop({ wallet, storage = defaultStorage() }) {
  let memory = { owned: [], equipped: DEFAULT_DIE };
  // Read every time: another tab may have bought it, and paying twice is the bug to avoid.
  const read = () => {
    try {
      const doc = JSON.parse(storage?.getItem(DIE_SHOP_KEY));
      if (doc && typeof doc === 'object') memory = { owned: Array.isArray(doc.owned) ? doc.owned.filter(known) : [], equipped: doc.equipped };
    } catch { /* blocked or malformed: this session's memory stands */ }
    return memory;
  };
  const write = doc => { memory = doc; try { storage?.setItem(DIE_SHOP_KEY, JSON.stringify(doc)); } catch { /* memory only */ } };
  const owns = id => known(id) && (dieLook(id).cost === 0 || read().owned.includes(id));
  const equipped = () => { const id = read().equipped; return owns(id) ? id : DEFAULT_DIE; };
  function equip(id) {
    if (!owns(id)) return false;
    write({ ...read(), equipped: id });
    return true;
  }
  return {
    owns, equipped, equip,
    // Spends once, and wears what was just paid for. A second buy costs nothing.
    buy(id) {
      if (!known(id)) return false;
      if (owns(id)) return true;
      if (!wallet.spend(dieLook(id).cost)) return false;
      const doc = read();
      write({ ...doc, owned: [...doc.owned, id], equipped: id });
      return true;
    },
    // What the lobby button can do right now. peek() leaves an older Carreritas
    // hand-over for Carreritas, as the wallet asks of every other game.
    offer(id) {
      if (owns(id)) return { action: equipped() === id ? 'unequip' : 'equip' };
      const cost = dieLook(id).cost, missing = cost - wallet.peek();
      return missing > 0 ? { action: 'short', cost, missing } : { action: 'buy', cost };
    },
  };
}
