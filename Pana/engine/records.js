// Records: who holds a game's competitive records, offline-first. No DOM, so a
// test or a rules file can use it; engine/record-widget.js draws it.
//
//   const board = createRecordBoard({ game: 'reliquia', metrics: [{ id: 'rounds', label: loc('Jornadas') }] });
//   const run = board.startRun();                               // when a match starts
//   run.report([{ name: 'Ana', me: true, values: { rounds: 3 } }]);   // any time: returns what just broke
//   run.summary('Ana');                                         // for the end screen
//   board.holder('rounds');                                     // { names, value, t } or null
//
// Every client keeps its own board under `pana:records:<game>`: the holder is
// whoever holds it among the people this browser has played with. There are no
// accounts, so a player is their name (case and spaces ignored). Values only
// ever go up, so reporting the same numbers twice (a reload, a new host, every
// round) changes nothing. The player's own bests also go through
// engine/stats.js, which hands them to the gateway when one is present.
//
// A tie never takes a record: the older mark keeps it. People who reach the
// same value in the same report hold it together. Storage trouble never
// throws: the board keeps working in memory.
import { statRecord } from './stats.js';

const MAX_PLAYERS = 40;
const keyOf = name => String(name ?? '').trim().toLowerCase();
function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

export function createRecordBoard({ game, metrics, storage = defaultStorage(), now = () => Date.now(), stat = statRecord, maxPlayers = MAX_PLAYERS }) {
  const KEY = `pana:records:${game}`;
  let players = {};
  const load = () => {
    try {
      const raw = JSON.parse(storage?.getItem(KEY) ?? 'null');
      if (raw?.players && typeof raw.players === 'object') players = raw.players;
    } catch { /* blocked or malformed: keep what is in memory */ }
    return players;
  };
  const save = () => { try { storage?.setItem(KEY, JSON.stringify({ players })); } catch { /* full or disabled */ } };
  const mark = (p, id) => { const m = p.best?.[id]; return Number.isFinite(m?.value) && m.value > 0 ? m : null; };

  // Everyone with a mark on this metric, best first; among equals, oldest first.
  const ranked = id => Object.values(load()).filter(p => mark(p, id))
    .map(p => ({ name: p.name, value: p.best[id].value, t: p.best[id].t }))
    .sort((a, b) => b.value - a.value || a.t - b.t);

  const holder = id => {
    const [top, ...rest] = ranked(id);
    if (!top) return null;
    return { names: [top.name, ...rest.filter(r => r.value === top.value && r.t === top.t).map(r => r.name)], value: top.value, t: top.t };
  };

  // A big board forgets whoever is not near the top of any metric, but never
  // a holder: each metric's leader is kept before the rest fill the space.
  const prune = () => {
    const all = Object.keys(players);
    if (all.length <= maxPlayers) return;
    const lists = metrics.map(({ id }) => {
      const list = Object.entries(players).filter(([, p]) => mark(p, id));
      return list.sort(([, a], [, b]) => b.best[id].value - a.best[id].value || a.best[id].t - b.best[id].t).map(([key]) => key);
    });
    const keep = new Set();
    for (let i = 0; keep.size < maxPlayers && lists.some(list => i < list.length); i++)
      for (const list of lists) if (i < list.length && keep.size < maxPlayers) keep.add(list[i]);
    for (const key of all) if (!keep.has(key)) delete players[key];
  };

  // rows: [{ name, me, values: { metric: number } }]. Keeps each player's best
  // per metric. Returns the metrics whose record went up: { id, label, value, names, previous }.
  function submit(rows) {
    load();
    const before = new Map(metrics.map(({ id }) => [id, holder(id)]));
    const t = now();
    let changed = false;
    for (const row of rows) {
      const key = keyOf(row.name);
      if (!key) continue;
      for (const { id } of metrics) {
        const value = row.values?.[id];
        if (!Number.isFinite(value) || value <= 0) continue;
        if (row.me) { try { stat(`${game}.${id}`, value); } catch { /* the gateway never breaks a game */ } }
        const p = players[key] ??= { name: String(row.name).trim(), best: {} };
        if (value > (p.best[id]?.value ?? 0)) { p.name = String(row.name).trim(); p.best[id] = { value, t }; changed = true; }
      }
    }
    if (!changed) return [];
    prune(); save();
    return metrics.flatMap(({ id, label }) => {
      const after = holder(id), was = before.get(id);
      return after && after.value > (was?.value ?? 0) ? [{ id, label, value: after.value, names: after.names, previous: was }] : [];
    });
  }

  // One entry per metric: the holder and, given a baseline, what fell since it.
  function standings(baseline, me = '') {
    const mine = keyOf(me);
    return metrics.map(({ id, label }) => {
      const current = holder(id), was = baseline?.get(id) ?? null;
      const fell = !!baseline && !!current && current.value > (was?.value ?? 0);
      return { id, label, holder: current, previous: fell ? was : null, broken: fell && !!was, first: fell && !was,
        mine: !!current && !!mine && current.names.some(n => keyOf(n) === mine) };
    });
  }

  // The leaderboard: one row per player, sorted by the metrics in order.
  function table(limit = 5) {
    const value = (p, id) => mark(p, id)?.value ?? 0;
    return Object.values(load())
      .filter(p => metrics.some(({ id }) => value(p, id)))
      .sort((a, b) => { for (const { id } of metrics) { const d = value(b, id) - value(a, id); if (d) return d; } return 0; })
      .slice(0, limit)
      .map(p => ({ name: p.name, values: Object.fromEntries(metrics.map(({ id }) => [id, value(p, id)])) }));
  }

  function startRun() {
    const baseline = new Map(metrics.map(({ id }) => [id, holder(id)]));
    return { report: submit, summary: me => standings(baseline, me) };
  }

  load();
  return { game, metrics, holder, standings: me => standings(null, me), table, submit, startRun };
}
