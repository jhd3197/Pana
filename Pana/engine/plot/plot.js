// A player's home plot: a house with tiers, beds that grow crops in real time, a
// seed shelf that rotates on the clock and decorations a rank unlocks. Pure logic
// over storage, in the shape of progress.js: storage and clock are injectable,
// memory takes over when the browser blocks storage, and a broken save is cleaned
// rather than trusted. No Three.js, no DOM.
//
//   const plot = createPlot({ game: 'conuco', crops, tiers, decor, shop, wallet: createMangoWallet(undefined, { source: 'conuco' }), progress });
//   plot.plant(0, 'maiz');  plot.harvest(0);  plot.upgrade();  plot.buy('cacao');  plot.setDecor('palma', true);
//   plot.view();            // the beds with their growth, the seeds, the tier: what a page draws
//
// Tables are the game's: crops { id, growMs, seedCost, mangos, xp, free }, tiers
// { cost, beds } in order (the first one is what a new plot starts with), decor
// { id, unlock } (a progress unlock id), shop { salt, period, size, qty }. Mangos go
// through the shared wallet and XP through the game's progress, each with a receipt
// from the plant's own id, so a harvest pays once.
import { cropState, scaled, WILT } from './growth.js';
import { rotatingStock, rotationEndsAt, rotationWindow } from './rotation.js';

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const fail = reason => ({ ok: false, reason });

export const plotKey = game => `pana:plot:${game}`;

export function createPlot({ game, crops, tiers, decor = [], shop, wallet, progress, wilt = WILT, storage = defaultStorage(), now = () => Date.now() }) {
  const key = plotKey(game), cropOf = new Map(crops.map(crop => [crop.id, crop])), decorOf = new Map(decor.map(item => [item.id, item]));
  const listeners = new Set();
  const counts = (value, known) => Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {})
    .map(([id, n]) => [id, count(n)]).filter(([id, n]) => n > 0 && known(id)));
  const isCrop = id => cropOf.has(id);
  function clean(value) {
    const tier = Math.min(tiers.length, Math.max(1, count(value?.tier))), saved = Array.isArray(value?.beds) ? value.beds : [];
    const beds = Array.from({ length: tiers[tier - 1].beds }, (_, i) => {
      const bed = saved[i];
      return bed && isCrop(bed.crop) && Number.isFinite(bed.at) && typeof bed.id === 'string' ? { id: bed.id, crop: bed.crop, at: bed.at } : null;
    });
    return {
      tier, beds,
      sown: count(value?.sown),
      harvests: count(value?.harvests),
      seeds: counts(value?.seeds, isCrop),
      decor: Array.isArray(value?.decor) ? [...new Set(value.decor)].filter(id => decorOf.has(id)) : [],
      shop: { window: Number.isFinite(value?.shop?.window) ? value.shop.window : null, bought: counts(value?.shop?.bought, isCrop) },
    };
  }
  // `stuck`: a write failed, so what storage holds is older than memory.
  let memory = clean(), stuck = false;
  const read = () => {
    if (stuck) return memory;
    try { const raw = storage?.getItem(key); if (raw != null) memory = clean(JSON.parse(raw)); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => {
    memory = clean(doc);
    try { storage?.setItem(key, JSON.stringify(memory)); stuck = false; } catch { stuck = true; }
    for (const fn of listeners) fn();
    return memory;
  };

  // The shelf right now, with what this player may still buy of each item.
  function stock(doc = read(), at = now()) {
    if (!shop) return { window: null, endsAt: Infinity, items: [] };
    const window = rotationWindow(at, shop.period), bought = doc.shop.window === window ? doc.shop.bought : {};
    const items = rotatingStock(crops.filter(crop => !crop.free), { ...shop, window })
      .map(({ item, qty }) => ({ id: item.id, crop: item, price: item.seedCost, qty, left: Math.max(0, qty - (bought[item.id] ?? 0)) }));
    return { window, endsAt: rotationEndsAt(at, shop.period), items };
  }

  const stateOf = (bed, at) => cropState(bed, cropOf.get(bed.crop), at, wilt);
  const isUnlocked = id => { const unlock = decorOf.get(id)?.unlock; return !!unlock && !!progress?.isUnlocked(unlock); };

  function pay(bed, at) {
    const crop = cropOf.get(bed.crop), { share, wilt: faded } = stateOf(bed, at);
    const mangos = scaled(crop.mangos, share), xp = scaled(crop.xp, share), receipt = `${game}:${bed.id}`;
    // Bed ids restart on each device; the planting time keeps an account's server receipts apart.
    wallet?.credit(mangos, `${receipt}:${bed.at}`);
    const earned = progress?.award(xp, receipt, { dive: false });
    return { mangos, xp, wilted: faded > 0, rank: earned?.rank, rankedUp: !!earned?.rankedUp, newUnlocks: earned?.newUnlocks ?? [] };
  }

  return {
    view(at = now()) {
      const doc = read();
      return {
        tier: doc.tier, next: tiers[doc.tier] ?? null, seeds: { ...doc.seeds }, decor: [...doc.decor], harvests: doc.harvests,
        beds: doc.beds.map(bed => bed && { ...bed, def: cropOf.get(bed.crop), ...stateOf(bed, at) }),
      };
    },
    stock,
    plant(index, cropId) {
      const doc = read(), crop = cropOf.get(cropId);
      if (!crop) return fail('crop');
      if (!Number.isInteger(index) || index < 0 || index >= doc.beds.length) return fail('bed');
      if (doc.beds[index]) return fail('busy');
      if (!crop.free && !(doc.seeds[cropId] > 0)) return fail('seed');
      const seeds = { ...doc.seeds };
      if (!crop.free) seeds[cropId] -= 1;
      const sown = doc.sown + 1;
      write({ ...doc, seeds, sown, beds: doc.beds.map((bed, i) => i === index ? { id: `b${sown}`, crop: cropId, at: now() } : bed) });
      return { ok: true };
    },
    // Pays and clears one ready bed. A plant that is not ready stays as it is.
    harvest(index) {
      const doc = read(), bed = doc.beds[index], at = now();
      if (!bed) return fail('empty');
      if (!stateOf(bed, at).ready) return fail('growing');
      const paid = pay(bed, at);
      write({ ...doc, harvests: doc.harvests + 1, beds: doc.beds.map((other, i) => i === index ? null : other) });
      return { ok: true, crop: bed.crop, ...paid };
    },
    // Every ready bed at once, added up.
    harvestAll() {
      const doc = read(), at = now(), totals = { ok: true, count: 0, mangos: 0, xp: 0, rank: undefined, rankedUp: false, newUnlocks: [] };
      const beds = doc.beds.map(bed => {
        if (!bed || !stateOf(bed, at).ready) return bed;
        const paid = pay(bed, at);
        totals.count++; totals.mangos += paid.mangos; totals.xp += paid.xp; totals.rank = paid.rank ?? totals.rank;
        totals.rankedUp ||= paid.rankedUp; totals.newUnlocks.push(...paid.newUnlocks);
        return null;
      });
      if (totals.count) write({ ...doc, harvests: doc.harvests + totals.count, beds });
      return totals;
    },
    // The next house tier, paid in mangos. New beds come with it; nothing planted moves.
    upgrade() {
      const doc = read(), next = tiers[doc.tier];
      if (!next) return fail('top');
      if (wallet && !wallet.spend(next.cost)) return fail('mangos');
      write({ ...doc, tier: doc.tier + 1 });
      return { ok: true, tier: doc.tier + 1 };
    },
    buy(id) {
      const doc = read(), shelf = stock(doc), item = shelf.items.find(entry => entry.id === id);
      if (!item) return fail('stock');
      if (item.left <= 0) return fail('soldout');
      if (wallet && !wallet.spend(item.price)) return fail('mangos');
      const bought = doc.shop.window === shelf.window ? doc.shop.bought : {};
      write({ ...doc, seeds: { ...doc.seeds, [id]: (doc.seeds[id] ?? 0) + 1 }, shop: { window: shelf.window, bought: { ...bought, [id]: (bought[id] ?? 0) + 1 } } });
      return { ok: true, left: item.left - 1 };
    },
    isDecorUnlocked: isUnlocked,
    // Puts a decoration out or takes it in. Only one the rank has unlocked goes out.
    setDecor(id, on) {
      const doc = read();
      if (!decorOf.has(id)) return fail('decor');
      if (on && !isUnlocked(id)) return fail('locked');
      write({ ...doc, decor: on ? [...doc.decor, id] : doc.decor.filter(other => other !== id) });
      return { ok: true };
    },
    // A change here or in another tab; returns the unsubscribe.
    onChange(fn) {
      const listen = event => { if (event.key === key) fn(); };
      listeners.add(fn); globalThis.addEventListener?.('storage', listen);
      return () => { listeners.delete(fn); globalThis.removeEventListener?.('storage', listen); };
    },
  };
}
