// Stats: cross-game telemetry, offline-first. Games report counters and
// timestamped events; this module persists them under the localStorage key
// `pana:stats` and, when the pana.sh gateway is present (its injected script
// sets window.PanaSh.stats), hands each new entry over. Without the gateway
// or without storage everything works the same: stats accumulate in memory
// and in storage, and sync on the next pana.sh visit.
//
//   import { statCount, statEvent } from '/engine/stats.js';
//   statCount('derrape.drift-meters', 12.4);   // cumulative counter, returns the total
//   statEvent('pintura.paint-hits');           // one timestamped event (for "X in Y seconds")
//
// Ids are namespaced by game ('derrape.', 'pintura.') so awards can tell them
// apart. Storage shape: { counters: { id: total }, events: [{ id, t }] }, the
// event log capped at MAX_EVENTS with the oldest dropped first. A full,
// blocked or missing storage never throws: gameplay comes first.

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
  const data = (() => {
    try {
      const raw = JSON.parse(storage?.getItem(KEY) || '{}');
      return {
        counters: raw.counters && typeof raw.counters === 'object' ? raw.counters : {},
        events: Array.isArray(raw.events) ? raw.events : [],
      };
    } catch { return { counters: {}, events: [] }; }
  })();
  const save = () => {
    try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* full or disabled: keep it in memory */ }
  };
  return {
    statCount(id, n = 1) {
      if (!id || !Number.isFinite(n)) return data.counters[id] || 0;
      const total = (data.counters[id] || 0) + n;
      data.counters[id] = total;
      save();
      bridge({ type: 'count', id, n, t: now() });
      return total;
    },
    statEvent(id) {
      if (!id) return 0;
      const t = now();
      data.events.push({ id, t });
      if (data.events.length > maxEvents) data.events.splice(0, data.events.length - maxEvents);
      save();
      bridge({ type: 'event', id, t });
      return t;
    },
    // A copy of what is stored: { counters, events }. Suites and tests read it.
    snapshot() { return { counters: { ...data.counters }, events: [...data.events] }; },
  };
}

const shared = createStats();
export const statCount = (id, n) => shared.statCount(id, n);
export const statEvent = (id) => shared.statEvent(id);
