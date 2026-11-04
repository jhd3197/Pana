// A game's day: one seed and one rotating set for everyone on the same date, and a
// streak of days played on this device under `pana:streak:<game>`. No Three.js, no
// DOM: safe in rules and tests. Storage and clock are injectable, and storage falls
// back to memory when the browser blocks it (same shape as progress.js).
//
//   const today = dayKey();                                  // '2026-11-04', local date
//   const seed = dailySeed('reliquia', today);
//   const set = pickDaily(SETS, today);                      // walks the whole list before repeating
//   const streak = createStreak({ game: 'reliquia' });
//   streak.record(today);   // only for a meaningful action; twice in a day changes nothing
import { seedOf } from './random.js';

export const MILESTONES = [3, 7, 14, 30];
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;   // streak days per freeze earned

const DAY_MS = 86400000;
const pad = (n, width = 2) => String(n).padStart(width, '0');

// The local calendar date, so "today" turns over at the player's own midnight.
export const dayKey = (date = new Date()) => `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// A whole-number day count; NaN for anything that is not a real date. Going through
// UTC keeps every day the same length across daylight saving changes.
export function dayNumber(key) {
  const m = typeof key === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  if (!m) return NaN;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])], at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCMonth() === month - 1 && at.getUTCDate() === day ? at.getTime() / DAY_MS : NaN;
}
export const isDayKey = key => Number.isFinite(dayNumber(key));

// Never 0: games treat a zero seed as "no seed".
export const dailySeed = (game, key) => seedOf(`${game}:daily:${key}`) || 1;

const gcd = (a, b) => b ? gcd(b, a % b) : a;
// One entry per day. A fixed stride coprime with the length visits every entry once
// before repeating, in an order that does not read like the list, so no two days in
// a row match (a list of one aside).
export function pickDaily(list, key) {
  const n = list?.length || 0, day = dayNumber(key);
  if (!n || !Number.isFinite(day)) return undefined;
  let stride = Math.max(1, Math.round(n * .618));
  while (gcd(stride, n) !== 1) stride++;
  return list[((day * stride) % n + n) % n];
}

export const streakKey = game => `pana:streak:${game}`;
const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const clean = value => ({
  days: count(value?.days),
  best: count(value?.best),
  freezes: Math.min(MAX_FREEZES, count(value?.freezes)),
  last: isDayKey(value?.last) ? value.last : '',
});
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function createStreak({ game, storage = defaultStorage(), now = () => new Date() }) {
  const key = streakKey(game);
  let memory = clean(), stuck = false;   // stuck: a write failed, so storage is older than memory
  const read = () => {
    if (stuck) return memory;
    try { const raw = storage?.getItem(key); if (raw != null) memory = clean(JSON.parse(raw)); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => { memory = doc; try { storage?.setItem(key, JSON.stringify(doc)); stuck = false; } catch { stuck = true; } return doc; };
  const report = (doc, usedFreeze = false, milestone = 0) => ({ days: doc.days, best: doc.best, freezesLeft: doc.freezes, usedFreeze, milestone });
  const gapTo = (doc, key) => dayNumber(key) - dayNumber(doc.last);
  return {
    // Counts the day once. A missed single day takes a freeze; anything longer starts
    // over at 1, with the freezes kept. A clock set back changes nothing.
    record(day = dayKey(now())) {
      const doc = read();
      if (!isDayKey(day)) return report(doc);
      const gap = doc.days ? gapTo(doc, day) : 1;
      if (gap <= 0) return report(doc);
      const usedFreeze = gap === 2 && doc.freezes > 0, kept = gap === 1 || usedFreeze;
      const days = kept ? doc.days + 1 : 1;
      const earned = days % FREEZE_EVERY === 0 ? 1 : 0;
      const saved = write({ days, best: Math.max(doc.best, days), freezes: Math.min(MAX_FREEZES, doc.freezes - (usedFreeze ? 1 : 0) + earned), last: day });
      return report(saved, usedFreeze, MILESTONES.includes(days) ? days : 0);
    },
    // The streak as it stands on this day, without counting it: 0 once it can no longer be kept.
    peek(day = dayKey(now())) {
      const doc = read(), gap = doc.days && isDayKey(day) ? gapTo(doc, day) : 0;
      const alive = gap <= 1 || (gap === 2 && doc.freezes > 0);
      return report({ ...doc, days: alive ? doc.days : 0 });
    },
  };
}
