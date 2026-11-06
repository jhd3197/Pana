// Mangos: the one currency every game pays into and Carreritas' taller spends.
// The balance lives on this device under `pana:mangos`; storage is injectable
// for tests and falls back to memory when the browser blocks it. No Three.js.
//
// Remote mode: when the page carries window.PanaSh.wallet, the account's server
// balance is the truth and `pana:mangos` is neither read nor written. The API
// stays synchronous: calls answer from a cached balance, change it optimistically
// and reconcile when the server replies. Only sent credit receipts stay on the
// device (`pana:mangos:sent`), so a reload does not flash a payout twice.
export const MANGO_KEY = 'pana:mangos';
export const SENT_KEY = 'pana:mangos:sent';
const RECEIPTS = 60;   // recent payouts remembered so a reload cannot pay twice
const clean = value => ({
  balance: Number.isFinite(value?.balance) && value.balance > 0 ? Math.floor(value.balance) : 0,
  receipts: Array.isArray(value?.receipts) ? value.receipts.filter(r => typeof r === 'string' && r.length <= 180).slice(-RECEIPTS) : [],
  // false: a payout opened this wallet before Carreritas handed over its coins.
  ...(value?.seeded === false ? { seeded: false } : {}),
});
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const whole = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const freshReceipt = kind => `${kind}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

function createRemoteWallet(bridge, storage, source) {
  const listeners = new Set(), sent = new Set();
  let cache = whole(bridge.balance()), pending = 0;
  const show = value => {
    if (value === cache) return;
    cache = value;
    for (const fn of listeners) fn(cache);
  };
  // While a call is out the bridge's number may or may not include it, so it is
  // only trusted once nothing is pending.
  const follow = () => { if (!pending) show(whole(bridge.balance())); };
  bridge.onChange?.(follow);
  const ready = Promise.resolve(bridge.ready).catch(() => {}).then(follow);

  const stored = () => {
    try { const list = JSON.parse(storage?.getItem(SENT_KEY)); return Array.isArray(list) ? list.filter(r => typeof r === 'string') : []; } catch { return []; }
  };
  const store = list => { try { storage?.setItem(SENT_KEY, JSON.stringify(list.slice(-RECEIPTS))); } catch { /* this session's set still guards */ } };
  const known = receipt => sent.has(receipt) || stored().includes(receipt);
  const remember = receipt => { sent.add(receipt); store([...stored(), receipt]); };
  // The server never said yes: its receipts are idempotent, so a later retry is safe.
  const forget = receipt => { sent.delete(receipt); store(stored().filter(r => r !== receipt)); };

  // fix(result) says how many mangos the optimistic guess got wrong.
  function send(call, fix) {
    pending++;
    new Promise(resolve => resolve(call())).catch(() => null).then(result => {
      pending--;
      const drift = fix(result);
      if (pending) show(whole(cache + drift));
      else show(whole(Number.isFinite(result?.balance) ? result.balance : bridge.balance()));
    });
  }
  function spend(amount) {
    const cost = whole(amount);
    if (cache < cost) return false;
    if (!cost) return true;
    cache -= cost;
    const receipt = freshReceipt('spend');
    send(() => bridge.spend(cost, source, receipt), result => result?.ok ? 0 : cost);
    return true;
  }
  function credit(amount, receipt) {
    if (receipt && known(receipt)) return false;
    if (receipt) remember(receipt);
    const gain = whole(amount);
    if (!gain) return true;
    cache += gain;
    const id = receipt || freshReceipt('credit');
    send(() => bridge.credit(gain, source, id), result => {
      if (!result?.ok && receipt) forget(receipt);
      return (result?.ok ? (Number.isFinite(result.credited) ? result.credited : gain) : 0) - gain;
    });
    return true;
  }
  return {
    remote: true,
    ready,
    balance: () => cache,   // no seed: the account balance wins over old local coins
    peek: () => cache,
    // Only ever asks for the difference; the server decides what it becomes.
    set(target) {
      if (!Number.isFinite(target) || target < 0) return cache;
      const gap = Math.floor(target) - cache;
      if (gap < 0) spend(-gap);
      else if (gap > 0) credit(gap, freshReceipt('set'));
      return cache;
    },
    credit,
    spend,
    paid: known,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export function createMangoWallet(storage = defaultStorage(), { source } = {}) {
  const bridge = globalThis.PanaSh?.wallet;
  if (bridge) return createRemoteWallet(bridge, storage, source ?? globalThis.location?.pathname?.match(/\/g\/([^/]+)/)?.[1] ?? 'pana');
  let memory = null;
  const read = () => {
    try { const raw = storage?.getItem(MANGO_KEY); if (raw != null) return (memory = clean(JSON.parse(raw))); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => { memory = clean(doc); try { storage?.setItem(MANGO_KEY, JSON.stringify(memory)); } catch { /* memory only */ } return memory.balance; };
  return {
    remote: false,
    ready: Promise.resolve(),
    // The balance. A device adopts `seed` once: the coins an older
    // Carreritas save kept in its own profile.
    balance(seed = 0) {
      const doc = read();
      if (doc && doc.seeded !== false) return doc.balance;
      return write({ balance: (doc?.balance ?? 0) + Math.max(0, Math.floor(seed) || 0), receipts: doc?.receipts ?? [] });
    },
    set(balance) { return write({ ...(read() ?? clean()), balance }); },
    // Adds mangos once per receipt; returns false when it was already paid.
    credit(amount, receipt) {
      const doc = read() ?? { ...clean(), seeded: false };
      if (receipt && doc.receipts.includes(receipt)) return false;
      write({ ...doc, balance: doc.balance + Math.max(0, Math.floor(amount) || 0), receipts: receipt ? [...doc.receipts, receipt] : doc.receipts });
      return true;
    },
    // What this device holds now, without adopting a seed: for a game that must
    // leave an older Carreritas hand-over for Carreritas.
    peek: () => read()?.balance ?? 0,
    // Takes mangos only if they are all there; false changes nothing. A wallet
    // still waiting for that hand-over keeps waiting.
    spend(amount) {
      const cost = Math.max(0, Math.floor(amount) || 0), doc = read() ?? { ...clean(), seeded: false };
      if (doc.balance < cost) return false;
      write({ ...doc, balance: doc.balance - cost });
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
