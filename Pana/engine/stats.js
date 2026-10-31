// Stats: cross-game telemetry, offline-first. Games report counters and
// timestamped events; this module persists them under the localStorage key
// `pana:stats` and, when the pana.sh gateway is present (its injected script
// sets window.PanaSh.stats), hands each new entry over. Without the gateway
// or without storage everything works the same: stats accumulate in memory
// and in storage, and sync on the next pana.sh visit.
//
//   import { statCount, statEvent, statRecord } from '/engine/stats.js';
//   statCount('derrape.drift-meters', 12.4);              // cumulative counter, returns the total
//   statEvent('pintura.paint-hits');                      // one timestamped event (for "X in Y seconds")
//   statRecord('derrape.best-lap:choroni', 83400, { better: 'min' });  // personal best, returns it
//
// Ids are namespaced by game ('derrape.', 'pintura.') so awards can tell them
// apart. Storage shape: { counters: { id: total }, events: [{ id, t }],
// records: { id: { value, t } } }, the event log capped at MAX_EVENTS with the
// oldest dropped first. A full, blocked or missing storage never throws:
// gameplay comes first.

const KEY = 'pana:stats';
const MAX_EVENTS = 500;

function defaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

// send defaults to the pana.sh bridge, looked up on every report: the gateway
// injects its script after the game modules load. Tests inject storage/now/send.
export function createStats({ storage = defaultStorage(), now = () => Date.now(), send, maxEvents = MAX_EVENTS } = {}) {
  const sendEntry = send ?? ((entry) => globalThis.PanaSh?.stats?.(entry));
  const bridge = (entry) => { try { sendEntry(entry); } catch { /* the gateway never breaks a game */ } };
  let data = { counters: {}, events: [], records: {} }, written = null;
  // Re-read before every change: another tab, or a migration that ran after
  // this module loaded, may have written since. Unreadable storage keeps memory.
  const fresh = () => {
    try {
      const text = storage?.getItem(KEY) ?? null;
      if (text === written) return data;   // still ours: drift metres report every step
      const raw = JSON.parse(text ?? 'null');
      if (raw && typeof raw === 'object') data = {
        counters: raw.counters && typeof raw.counters === 'object' ? raw.counters : {},
        events: Array.isArray(raw.events) ? raw.events : [],
        records: raw.records && typeof raw.records === 'object' ? raw.records : {},
      };
    } catch { /* blocked or malformed: keep what is in memory */ }
    return data;
  };
  fresh();
  const save = () => {
    try { const text = JSON.stringify(data); storage?.setItem(KEY, text); written = text; } catch { /* full or disabled: keep it in memory */ }
  };
  return {
    statCount(id, n = 1) {
      fresh();
      if (!id || !Number.isFinite(n)) return data.counters[id] || 0;
      const total = (data.counters[id] || 0) + n;
      data.counters[id] = total;
      save();
      bridge({ type: 'count', id, n, t: now() });
      return total;
    },
    statEvent(id) {
      if (!id) return 0;
      fresh();
      const t = now();
      data.events.push({ id, t });
      if (data.events.length > maxEvents) data.events.splice(0, data.events.length - maxEvents);
      save();
      bridge({ type: 'event', id, t });
      return t;
    },
    // A personal best: keeps the caller's best value per id ('min' for lap
    // times, 'max' for distances) and reports only improvements. Returns the
    // standing best.
    statRecord(id, value, { better = 'max' } = {}) {
      fresh();
      if (!id || !Number.isFinite(value)) return data.records[id]?.value;
      const current = data.records[id];
      const standing = Number.isFinite(current?.value) ? current.value : undefined;
      const improved = standing === undefined || (better === 'min' ? value < standing : value > standing);
      if (!improved) return standing;
      const t = now();
      data.records[id] = { value, t };
      save();
      bridge({ type: 'record', id, value, t });
      return value;
    },
    // A copy of what is stored: { counters, events, records }. Suites and tests read it.
    snapshot() { fresh(); return { counters: { ...data.counters }, events: [...data.events], records: { ...data.records } }; },
  };
}

const shared = createStats();
export const statCount = (id, n) => shared.statCount(id, n);
export const statEvent = (id) => shared.statEvent(id);
export const statRecord = (id, value, opts) => shared.statRecord(id, value, opts);
