// Friend-named bots: the strongest bots of a match take the names of the
// player's friends. The rest keep their own names, and with no friends known
// nothing changes. Safe on the server and in rules.js: nothing here touches the
// DOM at import time, so import it by relative path from code a room loads.
//
//   applyFriendNames(bots, friendNamesNow(), { rankBy: b => b.skill, taken });
//
// Friends come from the pana.sh gateway (window.PanaSh.friends, or GET
// /auth/friends) and the `pana:friends` localStorage key, which also serves local
// play and tests. Any failure counts as having no friends. A client sends at most
// three names when it joins; a server room re-cleans them and uses its host's.
import { rng } from './random.js';

export const MAX_FRIEND_NAMES = 3, MAX_NAME_LENGTH = 16;
export const LOCAL_KEY = 'pana:friends', CACHE_KEY = 'pana:friends:cache', CACHE_MS = 5 * 60 * 1000;
export const LOAD_TIMEOUT_MS = 600;
// A list longer than this is cut before any work is done on it.
const MAX_INPUT = 64, FETCH_ABORT_MS = 5000;

// Control characters, direction overrides and leftover angle brackets.
const UNSAFE = new RegExp('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff<>]', 'g');

const textOf = (raw) => {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  return [raw.pana, raw.name].find(v => typeof v === 'string' && v.trim()) || '';
};

// A name safe to show: no markup, control or direction-changing characters, one
// line, at most MAX_NAME_LENGTH characters. '' when nothing is left.
export function cleanFriendName(raw) {
  const text = textOf(raw).slice(0, 256)
    .replace(/<[^>]*>/g, '')
    .replace(UNSAFE, ' ')
    .replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, MAX_NAME_LENGTH).join('').trim();
}

const nameKey = (name) => String(name ?? '').normalize('NFKC').trim().toLowerCase();

// The names to use, in order: cleaned, without repeats or anyone in `taken` (a
// pana in the room), never more than three. `random` or `seed` shuffles first.
export function pickFriendNames(friends, { count = MAX_FRIEND_NAMES, taken = [], random = null, seed = null } = {}) {
  if (!Array.isArray(friends)) return [];
  const limit = Math.max(0, Math.min(MAX_FRIEND_NAMES, Math.floor(Number(count)) || 0));
  const seen = new Set(Array.from(taken, nameKey)), names = [];
  for (const raw of friends.slice(0, MAX_INPUT)) {
    const name = cleanFriendName(raw), key = nameKey(name);
    if (name && !seen.has(key)) { seen.add(key); names.push(name); }
  }
  const roll = random || (seed != null ? rng(seed) : null);
  if (roll) for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  return names.slice(0, limit);
}

// What a server room keeps of a client's join option.
export const cleanJoinNames = (raw) => pickFriendNames(raw);

// Renames the top bots by rankBy (highest first; ties keep their order) and
// returns `bots`. Never every bot: at least one of two or more keeps its name. The
// same list and bots always give the same names, so a rematch keeps them.
export function applyFriendNames(bots, friendNames, { rankBy = null, taken = [], key = 'name' } = {}) {
  const names = pickFriendNames(friendNames, { taken });
  if (!names.length || !bots?.length) return bots;
  const slots = bots.length === 1 ? 1 : Math.min(names.length, bots.length - 1);
  const ranked = bots.map((bot, i) => ({ bot, i, rank: rankBy ? Number(rankBy(bot, i)) || 0 : 0 }))
    .sort((a, b) => b.rank - a.rank || a.i - b.i);
  ranked.slice(0, slots).forEach(({ bot }, i) => { bot[key] = names[i]; });
  return bots;
}

// --- Client: where the names come from. ---------------------------------------

let known = null, pending = null;

const storageGet = (area, key) => { try { return globalThis[area]?.getItem(key) ?? null; } catch { return null; } };
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

const localFriends = () => { const list = parse(storageGet('localStorage', LOCAL_KEY)); return Array.isArray(list) ? list : []; };
function sessionCache(maxAge = CACHE_MS) {
  const entry = parse(storageGet('sessionStorage', CACHE_KEY));
  return entry && Array.isArray(entry.names) && Date.now() - entry.at < maxAge ? pickFriendNames(entry.names) : null;
}

async function gatewayFriends() {
  const bridge = globalThis.PanaSh?.friends;
  if (typeof bridge === 'function') {
    try {
      const list = await globalThis.PanaSh.friends();
      if (Array.isArray(list)) return list;
    } catch { /* fall through to the endpoint */ }
  }
  if (typeof globalThis.fetch !== 'function') return [];
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = abort && setTimeout(() => abort.abort(), FETCH_ABORT_MS);
  try {
    const res = await globalThis.fetch('/auth/friends', { credentials: 'same-origin', headers: { accept: 'application/json' }, signal: abort?.signal });
    if (!res.ok) return [];
    const data = await res.json();
    // Only accepted friends: incoming, outgoing and the rest stay out of it.
    return Array.isArray(data?.friends) ? data.friends : [];
  } catch { return []; } finally { if (timer) clearTimeout(timer); }
}

async function readFriends() {
  const cached = sessionCache();
  if (cached) return cached;
  const remote = await gatewayFriends();
  // Each visit shows other friends; the cache keeps them steady between games.
  const names = pickFriendNames([...localFriends(), ...pickFriendNames(remote, { count: MAX_FRIEND_NAMES, random: Math.random })]);
  try { globalThis.sessionStorage?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), names })); } catch { /* storage off */ }
  return names;
}

// The names known right now, without waiting: what a game asks for at start.
export function friendNamesNow() {
  return known ?? pickFriendNames([...localFriends(), ...(sessionCache(Infinity) || [])]);
}

// Resolves within `timeout` ms with the names known by then, and never rejects. A
// slow gateway still fills the cache for the next game start.
export function loadFriendNames({ timeout = LOAD_TIMEOUT_MS } = {}) {
  if (known) return Promise.resolve(known);
  pending ||= readFriends().catch(() => []).then((names) => (known = names));
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(friendNamesNow()), timeout);
    pending.then((names) => { clearTimeout(timer); resolve(names); });
  });
}

// Tests and tools: forget what was read, or set it directly.
export function setFriendNames(names = null) { known = names && pickFriendNames(names); pending = null; }
