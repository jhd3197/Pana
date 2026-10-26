// Carreritas's taller: mangos you keep between races (the wallet; its field is
// still called coins), and what they buy — paint jobs, horns, turbo flames and the parts in parts.js — plus the
// unlocks trophies give.
// Plain data and math; game.js keeps it in localStorage and paints the cars.

import { CAR_DEFINITIONS } from './car-definitions.js';
import { canonicalCupId } from './cup-definitions.js';
import { PARTS, cleanParts } from './parts.js';
import { WHEEL_DEFINITIONS } from './wheel-definitions.js';
import { BOAT_DEFINITIONS, AIR_DEFINITIONS, BOAT_PARTS, AIR_PARTS, cleanVesselParts } from './parts.js';
import { loc } from '../../../engine/i18n.js';

export const PAINTS = [
  { id: 'fabrica', name: loc('De fábrica'), color: null, cost: 0 },
  { id: 'araguaney', name: loc('Amarillo araguaney'), color: '#ffc629', cost: 25 },
  { id: 'caribe', name: loc('Azul Caribe'), color: '#1f6fe0', cost: 25 },
  { id: 'pasion', name: loc('Rojo pasión'), color: '#d62c2c', cost: 25 },
  { id: 'selva', name: loc('Verde selva'), color: '#2f9e4a', cost: 25 },
  { id: 'orquidea', name: loc('Morado orquídea'), color: '#8e44c9', cost: 35 },
  { id: 'mango', name: loc('Naranja mango'), color: '#ff8a1c', cost: 35 },
  { id: 'flamenco', name: loc('Rosado flamenco'), color: '#ff6fa8', cost: 35 },
  { id: 'azabache', name: loc('Negro azabache'), color: '#2a2a33', cost: 50 },
  { id: 'nube', name: loc('Blanco nube'), color: '#ecebe6', cost: 50 },
  { id: 'oro', name: loc('Dorado campeón'), color: '#e3ae39', cost: 0, unlock: 'oro' },
];

export const HORNS = [
  { id: 'propio', name: loc('El de fábrica'), cost: 0 },
  { id: 'meep', name: loc('Meep meep'), cost: 15 },
  { id: 'cucaracha', name: loc('La cucaracha'), cost: 15 },
  { id: 'grave', name: loc('Corneta de gandola'), cost: 15 },
  { id: 'fiesta', name: loc('Rumba'), cost: 15 },
];

export const FLAMES = [
  { id: 'fuego', name: loc('Fuego'), colors: [0xff7b1c, 0xffd23f], cost: 0 },
  { id: 'hielo', name: loc('Hielo'), colors: [0x4fb6ff, 0xd8f3ff], cost: 30 },
  { id: 'monte', name: loc('Monte'), colors: [0x2f9e4a, 0xb8f15a], cost: 30 },
  { id: 'tricolor', name: loc('Tricolor'), colors: [0xffc629, 0x1f6fe0, 0xd62c2c], cost: 45 },
  { id: 'arcoiris', name: loc('Arcoíris'), colors: [0xff4b4b, 0xff9a1f, 0xffe14d, 0x4caf50, 0x4fb6ff, 0xc45bff], cost: 0, unlock: 'two-cups' },
];

export const CATALOG = { paint: PAINTS, horn: HORNS, flame: FLAMES, wheel: WHEEL_DEFINITIONS.map(w => ({ ...w, cost: w.cost ?? 0 })), ...PARTS,
  boat: BOAT_DEFINITIONS, air: AIR_DEFINITIONS, ...BOAT_PARTS, ...AIR_PARTS };

// paint and parts are per car ({ carId: ... }); horn, flame and the cauchos
// are the driver's. Owned keys are 'kind:id' and free items count as owned.
export const newWallet = () => ({ car: 'chamo', coins: 0, owned: ['paint:fabrica', 'horn:propio', 'flame:fuego'], paint: {}, copiedPaint: null, parts: {}, horn: 'propio', flame: 'fuego', wheel: 'calle', boat: 'penero', air: 'zamuro', boatParts: {}, airParts: {} });
export const owns = (wallet, kind, id) => wallet.owned.includes(`${kind}:${id}`) || CATALOG[kind]?.find(i => i.id === id)?.cost === 0;
const ownsWheel = (owned, id) => owned.includes(`wheel:${id}`) || !(WHEEL_DEFINITIONS.find(w => w.id === id)?.cost);

// Clean a stored wallet: unknown fields drop, numbers stay sane.
export function cleanWallet(w) {
  const base = newWallet();
  if (!w || typeof w !== 'object') return base;
  const owned = Array.isArray(w.owned) ? w.owned.filter(k => typeof k === 'string') : [];
  const ownsVessel = (kind, defs, id) => owned.includes(`${kind}:${id}`) || !defs.find(v => v.id === id)?.cost;
  const vesselParts = (kind, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).map(([id, parts]) => [id, cleanVesselParts(kind, parts)]).filter(([id, parts]) => Object.keys(parts).length && (kind === 'boat' ? BOAT_DEFINITIONS : AIR_DEFINITIONS).some(v => v.id === id)))
    : {};
  return {
    car: CAR_DEFINITIONS.some(c => c.id === w.car) ? w.car : 'chamo',
    coins: Number.isFinite(w.coins) && w.coins > 0 ? Math.floor(w.coins) : 0,
    owned: [...new Set([...base.owned, ...owned])],
    copiedPaint: /^#[0-9a-f]{6}$/i.test(w.copiedPaint) ? w.copiedPaint : null,
    paint: w.paint && typeof w.paint === 'object' ? { ...w.paint } : {},
    parts: w.parts && typeof w.parts === 'object' && !Array.isArray(w.parts)
      ? Object.fromEntries(Object.entries(w.parts).map(([car, parts]) => [car, cleanParts(parts)]).filter(([, parts]) => Object.keys(parts).length))
      : {},
    horn: HORNS.some(h => h.id === w.horn) ? w.horn : 'propio',
    flame: FLAMES.some(f => f.id === w.flame) ? w.flame : 'fuego',
    wheel: WHEEL_DEFINITIONS.some(d => d.id === w.wheel) && ownsWheel(owned, w.wheel) ? w.wheel : 'calle',
    boat: BOAT_DEFINITIONS.some(v => v.id === w.boat) && ownsVessel('boat', BOAT_DEFINITIONS, w.boat) ? w.boat : 'penero',
    air: AIR_DEFINITIONS.some(v => v.id === w.air) && ownsVessel('air', AIR_DEFINITIONS, w.air) ? w.air : 'zamuro',
    boatParts: vesselParts('boat', w.boatParts),
    airParts: vesselParts('air', w.airParts),
  };
}

// Mangos earned for a race: the coins you picked up, exchanged one for one,
// plus a bonus by place, plus a trophy bonus at the end of a cup.
export const PLACE_BONUS = [10, 6, 3];
export const TROPHY_BONUS = { oro: 40, plata: 25, bronce: 15 };
export function earnings({ collected = 0, place = 99, trophy = null } = {}) {
  return Math.max(0, collected) + (PLACE_BONUS[place] ?? 0) + (TROPHY_BONUS[trophy] ?? 0);
}

// Locked by a trophy? `trophies` is { cupId: 'oro' | 'plata' | 'bronce' }.
const trophyEntries = (trophies) => Object.entries(trophies && typeof trophies === 'object' ? trophies : {})
  .filter(([, trophy]) => ['oro', 'plata', 'bronce'].includes(trophy))
  .map(([id, trophy]) => [canonicalCupId(id), trophy]);
export function unlocked(item, trophies = {}) {
  if (!item.unlock) return true;
  const entries = trophyEntries(trophies);
  if (item.unlock === 'oro') return entries.some(([, trophy]) => trophy === 'oro');
  if (item.unlock === 'two-cups') return new Set(entries.map(([id]) => id)).size >= 2;
  return false;
}
export const unlockText = (item) => item.unlock === 'oro' ? loc('Gana una copa con oro') : item.unlock === 'two-cups' ? loc('Gana un trofeo en dos copas diferentes') : '';

// Buying: spends coins once; owned items are free to equip forever.
export function buy(wallet, kind, id, trophies) {
  const item = CATALOG[kind]?.find(i => i.id === id);
  const key = `${kind}:${id}`;
  if (!item || !unlocked(item, trophies)) return false;
  if (owns(wallet, kind, id)) return true;
  if (wallet.coins < item.cost) return false;
  wallet.coins -= item.cost;
  wallet.owned.push(key);
  return true;
}

// Mirror mode opens up with your first trophy, like a classic unlock.
export const mirrorUnlocked = (trophies = {}) => trophyEntries(trophies).length >= 1;

// ---- paint math (hex in, hex out; no Three.js) ----
export function hexToHsl(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// A body colour in the car's paint family moves to the new paint, keeping how
// much darker or lighter it was (shadow panels stay shadowed). Others: null.
export function repaintHex(hex, from, to) {
  const [h, s, l] = hexToHsl(hex), [fh, fs, fl] = hexToHsl(from), [th, ts, tl] = hexToHsl(to);
  const dh = Math.min(Math.abs(h - fh), 1 - Math.abs(h - fh));
  if (dh > 0.045 || s < 0.3 || Math.abs(l - fl) > 0.28) return null;
  const nl = Math.max(0.05, Math.min(0.95, tl + (l - fl)));
  const ns = Math.max(0, Math.min(1, ts * (fs ? s / fs : 1)));
  return hslToHex(th, ns, nl);
}

// Vehicle copying is a saved build recommendation. Its quote excludes the body
// and charges only missing parts; complete-kit quotes include missing vessels.
export function kitEntries(racer, kind = null) {
  const c = racer.cosmetics || {};
  const vehicle = k => k === 'car' ? [['car', racer.def.id], ['wheel', racer.wheel || 'calle'], ...Object.entries(c.parts || {})]
    : [[k, c[k] || (k === 'boat' ? 'penero' : 'zamuro')], ...Object.entries(c[k + 'Parts'] || {})];
  return kind ? vehicle(kind) : [...vehicle('car'), ...vehicle('boat'), ...vehicle('air'), ['paint', c.paint || 'fabrica'], ['horn', c.horn || 'propio']];
}
export function quoteBuild(wallet, racer, kind = null) {
  return kitEntries(racer, kind).reduce((sum, [slot, id]) => sum + (slot === 'car' || slot === kind || owns(wallet, slot, id) ? 0 : CATALOG[slot]?.find(p => p.id === id)?.cost || 0), 0);
}
export const paintOf = (cosmetics, fallback = null) => PAINTS.find(p => p.id === cosmetics?.paint)?.color ?? (/^#[0-9a-f]{6}$/i.test(cosmetics?.paintColor) ? cosmetics.paintColor : fallback);
