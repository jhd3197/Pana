// Mangos: the one currency every game pays into and Carreritas' taller spends.
// The balance lives on this device under `pana:mangos`; storage is injectable
// for tests and falls back to memory when the browser blocks it. No Three.js.
export const MANGO_KEY = 'pana:mangos';
const RECEIPTS = 60;   // recent payouts remembered so a reload cannot pay twice
const clean = value => ({
  balance: Number.isFinite(value?.balance) && value.balance > 0 ? Math.floor(value.balance) : 0,
  receipts: Array.isArray(value?.receipts) ? value.receipts.filter(r => typeof r === 'string' && r.length <= 180).slice(-RECEIPTS) : [],
});
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function createMangoWallet(storage = defaultStorage()) {
  let memory = null;
  const read = () => {
    try { const raw = storage?.getItem(MANGO_KEY); if (raw != null) return (memory = clean(JSON.parse(raw))); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => { memory = clean(doc); try { storage?.setItem(MANGO_KEY, JSON.stringify(memory)); } catch { /* memory only */ } return memory.balance; };
  return {
    // The balance. A device with no wallet yet adopts `seed`: the coins an
    // older Carreritas save kept in its own profile.
    balance(seed = 0) {
      const doc = read();
      return doc ? doc.balance : write({ balance: seed, receipts: [] });
    },
    set(balance) { return write({ ...(read() ?? clean()), balance }); },
    // Adds mangos once per receipt; returns false when it was already paid.
    credit(amount, receipt) {
      const doc = read() ?? clean();
      if (receipt && doc.receipts.includes(receipt)) return false;
      write({ balance: doc.balance + Math.max(0, Math.floor(amount) || 0), receipts: receipt ? [...doc.receipts, receipt] : doc.receipts });
      return true;
    },
    paid: receipt => (read()?.receipts ?? []).includes(receipt),
    // Another tab changed the balance (a fight paid out while the taller is open).
    onChange(fn) {
      const listen = event => { if (event.key === MANGO_KEY) fn(read()?.balance ?? 0); };
      globalThis.addEventListener?.('storage', listen);
      return () => globalThis.removeEventListener?.('storage', listen);
    },
  };
}
