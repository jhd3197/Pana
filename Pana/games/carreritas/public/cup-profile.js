import { CUP_DEFINITIONS, LEGACY_CUP_ALIASES, canonicalCupId } from './cup-definitions.js';
import { cleanWallet, newWallet } from './shop.js';
import { locKey } from '/engine/i18n.js';
import { createMangoWallet } from '/engine/mangos.js';

export const PROFILE_VERSION = 3;
export const PROFILE_KEY = 'carreritas:profile';
// Saves from the Derrape era: read once as a fallback, kept on disk as a backup.
const LEGACY_PROFILE_KEY = 'derrape:profile';
export const TROPHY_RANK = { oro: 3, plata: 2, bronce: 1 };
const CUP_IDS = new Set(CUP_DEFINITIONS.map(cup => cup.id));
const TROPHIES = new Set(Object.keys(TROPHY_RANK));
const DIFFICULTIES = new Set(['facil', 'normal', 'dificil']);
const LAP_CHOICES = new Set([1, 2, 3, 4, 5]);

export const betterTrophy = (a, b) => (TROPHY_RANK[a] ?? 0) >= (TROPHY_RANK[b] ?? 0) ? a : b;

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    setup: cleanSetup(),
    trophies: {},
    legacyTrophies: {},
    wallet: newWallet(),
    receipts: {},
  };
}

export function cleanSetup(setup = {}) {
  const source = setup && typeof setup === 'object' && !Array.isArray(setup) ? setup : {};
  let mode = typeof source.mode === 'string' ? source.mode : 'race';
  mode = canonicalCupId(mode);
  const cup = CUP_DEFINITIONS.find(item => item.id === mode);
  if (cup && !cup.available) mode = 'race';
  else if (!cup && !['race', 'battle'].includes(mode)) mode = 'race';
  return {
    mode,
    difficulty: DIFFICULTIES.has(source.difficulty) ? source.difficulty : 'normal',
    laps: LAP_CHOICES.has(source.laps) ? source.laps : 3,
    mirror: source.mirror === true,
    split: source.split === true,
  };
}

function putLegacy(target, cupId, trophy, source) {
  const canonical = canonicalCupId(cupId);
  if (!CUP_IDS.has(canonical) || !TROPHIES.has(trophy)) return;
  const previous = target[canonical];
  target[canonical] = {
    trophy: previous ? betterTrophy(previous.trophy, trophy) : trophy,
    source: previous?.source ?? source ?? cupId,
    edition: 1,
    label: locKey('Edición anterior'),
  };
}

function cleanLegacy(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [id, record] of Object.entries(value)) {
    if (record && typeof record === 'object') putLegacy(result, id, record.trophy, record.source);
    else putLegacy(result, id, record, LEGACY_CUP_ALIASES[id] ? id : undefined);
  }
  return result;
}

function cleanCurrent(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [id, trophy] of Object.entries(value)) {
    const canonical = canonicalCupId(id);
    if (CUP_IDS.has(canonical) && TROPHIES.has(trophy) && !LEGACY_CUP_ALIASES[id]) {
      result[canonical] = result[canonical] ? betterTrophy(result[canonical], trophy) : trophy;
    }
  }
  return result;
}

function cleanReceipts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, paid]) => paid === true && key.length <= 180).map(([key]) => [key, true]));
}

function cleanProfile(profile) {
  const base = newProfile();
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return base;
  return {
    version: PROFILE_VERSION,
    setup: cleanSetup(profile.setup),
    trophies: cleanCurrent(profile.trophies),
    legacyTrophies: cleanLegacy(profile.legacyTrophies),
    wallet: cleanWallet(profile.wallet),
    receipts: cleanReceipts(profile.receipts),
  };
}

// wheels is the old 'carreritas:wheels' value (a bare caucho id): it moves into
// the wallet the first time, then the profile owns the choice.
export function migrateProfile({ profile = null, setup = null, trophies = null, wallet = null, wheels = null } = {}) {
  const current = profile?.version === 2 || profile?.version === PROFILE_VERSION;
  const result = current ? cleanProfile(profile) : {
    ...newProfile(),
    setup: cleanSetup(setup ?? profile?.setup),
    wallet: cleanWallet(wallet ?? profile?.wallet),
    trophies: cleanCurrent(trophies ?? profile?.trophies),
    legacyTrophies: cleanLegacy(profile?.legacyTrophies),
  };

  if (current) {
    for (const [id, trophy] of Object.entries(cleanCurrent(trophies))) {
      result.trophies[id] = result.trophies[id] ? betterTrophy(result.trophies[id], trophy) : trophy;
    }
    const oldWallet = cleanWallet(wallet);
    if (wallet && typeof wallet === 'object') {
      result.wallet.owned = [...new Set([...result.wallet.owned, ...oldWallet.owned])];
    }
  }
  for (const [id, trophy] of Object.entries(trophies && typeof trophies === 'object' && !Array.isArray(trophies) ? trophies : {})) {
    if (LEGACY_CUP_ALIASES[id]) putLegacy(result.legacyTrophies, id, trophy, id);
  }
  if (typeof wheels === 'string' && !profile?.wallet?.wheel) result.wallet.wheel = wheels;
  return cleanProfile(result);
}

export function trophyCredits(profile) {
  const credits = {};
  const source = cleanProfile(profile);
  for (const [id, record] of Object.entries(source.legacyTrophies)) credits[id] = record.trophy;
  for (const [id, trophy] of Object.entries(source.trophies)) credits[id] = credits[id] ? betterTrophy(credits[id], trophy) : trophy;
  return credits;
}

export function recordCupTrophy(profile, cupId, trophy) {
  const canonical = canonicalCupId(cupId);
  if (!CUP_IDS.has(canonical) || !TROPHIES.has(trophy)) return false;
  if ((TROPHY_RANK[profile.trophies[canonical]] ?? 0) >= TROPHY_RANK[trophy]) return false;
  profile.trophies[canonical] = trophy;
  return true;
}

export function receiptKey(sessionId, stage, profileId = 'local') {
  return `${String(profileId).slice(0, 40)}:${String(sessionId).slice(0, 80)}:${String(stage).slice(0, 40)}`;
}

export function claimReceipt(profile, key) {
  if (!key || profile.receipts[key]) return false;
  profile.receipts[key] = true;
  return true;
}

const parse = (raw) => {
  if (typeof raw !== 'string' || !raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

// Derrape-era stat ids (derrape.*) move to the carreritas.* namespace once:
// counters sum into the new id, records keep the standing value, then the old
// ids drop off the shared `pana:stats` document.
function migrateStatIds(storage, get) {
  const raw = parse(get('pana:stats'));
  if (!raw || typeof raw !== 'object') return;
  let dirty = false;
  const counters = raw.counters && typeof raw.counters === 'object' ? raw.counters : {};
  for (const [id, n] of Object.entries(counters)) {
    if (!id.startsWith('derrape.') || !Number.isFinite(n)) continue;
    const next = `carreritas.${id.slice(8)}`;
    counters[next] = (Number.isFinite(counters[next]) ? counters[next] : 0) + n;
    delete counters[id];
    dirty = true;
  }
  const records = raw.records && typeof raw.records === 'object' ? raw.records : {};
  for (const [id, record] of Object.entries(records)) {
    if (!id.startsWith('derrape.')) continue;
    const next = `carreritas.${id.slice(8)}`;
    if (!records[next]) records[next] = record;
    delete records[id];
    dirty = true;
  }
  if (Array.isArray(raw.events)) {
    for (const event of raw.events) {
      if (event && typeof event.id === 'string' && event.id.startsWith('derrape.')) {
        event.id = `carreritas.${event.id.slice(8)}`;
        dirty = true;
      }
    }
  }
  if (!dirty) return;
  try { storage?.setItem('pana:stats', JSON.stringify({ counters, events: raw.events || [], records })); } catch { /* keep old ids */ }
}

// The balance is Pana's shared mango wallet; wallet.coins mirrors it so older
// saves and the taller keep working. A device's first load adopts its coins.
export function createProfileStore(storage, { onMangos } = {}) {
  let memory = null;
  const mangos = createMangoWallet(storage);
  // Mangos paid by another game while this page is open.
  if (onMangos) mangos.onChange(balance => { if (memory?.wallet) memory.wallet.coins = balance; onMangos(balance); });
  const get = (key) => {
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  };
  const save = (profile) => {
    memory = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : cleanProfile(profile);
    if (memory.wallet) mangos.set(memory.wallet.coins);
    try { storage?.setItem(PROFILE_KEY, JSON.stringify(memory)); } catch { /* in-memory play remains available */ }
    return memory;
  };
  const load = () => {
    if (memory) return memory;
    migrateStatIds(storage, get);
    const rawProfile = parse(get(PROFILE_KEY)) ?? parse(get(LEGACY_PROFILE_KEY));
    const migrated = migrateProfile({
      profile: rawProfile,
      setup: parse(get('carreritas:setup')) ?? parse(get('derrape:setup')),
      trophies: parse(get('carreritas:trophies')) ?? parse(get('derrape:trophies')),
      wallet: parse(get('carreritas:wallet')) ?? parse(get('derrape:wallet')),
      wheels: get('carreritas:wheels') ?? get('derrape:wheels'),
    });
    migrated.wallet.coins = mangos.balance(migrated.wallet.coins);
    memory = migrated;
    if (!rawProfile || JSON.stringify(rawProfile) !== JSON.stringify(migrated)) save(migrated);
    return memory;
  };
  return {
    load,
    save,
    update(mutate) {
      const profile = load();
      mutate(profile);
      return save(profile);
    },
  };
}
