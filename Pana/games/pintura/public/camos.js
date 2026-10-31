// Pepazo's camuflajes: a fixed set, never a free colour. The same ids and unlock
// rules live in pana.sh (gateway/camos.json); keep both tables equal.
//   start  — six solid colours everyone owns.
//   kills  — painting people with one specific marker unlocks it; once owned it
//            goes on any weapon.
//   mangos — bought with the shared mango currency through pana.sh.
// Looks (pattern, scale, colours) come from engine/play/paint-arsenal.js, which the
// model draws. Pure data and text: armory.js loads this with the camo tab.
import { PAINT_CAMOS, PAINT_SOLIDS } from '../../../engine/play/paint-arsenal.js';
import { loc, locKey } from '../../../engine/i18n.js';
import { weaponOf, START_CAMOS } from './armory-data.js';

const solid = (id, name) => ({ id, name, pattern: 'solid', scale: 1, colors: [PAINT_SOLIDS[id]], unlock: { type: 'start' } });
const look = (id, unlock) => { const c = PAINT_CAMOS[id]; return { id, name: c.name, pattern: c.pattern, scale: c.scale, colors: [...c.colors], unlock }; };
const kills = (id, weapon, count) => look(id, { type: 'kills', weapon, count });
const mangos = (id, price) => look(id, { type: 'mangos', price });

export const CAMOS = Object.freeze([
  solid('liso-mango', locKey('Liso mango')), solid('liso-caribe', locKey('Liso caribe')), solid('liso-uva', locKey('Liso uva')),
  solid('liso-crema', locKey('Liso crema')), solid('liso-carbon', locKey('Liso carbón')), solid('liso-coral', locKey('Liso coral')),
  kills('selva', 'carbine', 15), kills('medanos', 'marksman', 10), kills('bolivar', 'sniper', 10), kills('caracas', 'smg', 25), kills('jaguar', 'blunderbuss', 15),
  mangos('caribe', 240), mangos('tricolor', 300), mangos('llanero', 360), mangos('rumba', 420), mangos('pepazo', 480),
].map(Object.freeze));

export const camoById = id => CAMOS.find(c => c.id === id) || null;
export const isStart = id => START_CAMOS.includes(id);
// Every camo the player may wear: the start ones plus the known ids in `owned`.
export function unlockedSet({ owned = [] } = {}) {
  const set = new Set(START_CAMOS);
  for (const id of Array.isArray(owned) ? owned : []) if (camoById(id)) set.add(id);
  return set;
}
// "7/15 pintadas con La Parrandera": the kills camo's progress.
export function progressText(id, progress = {}) {
  const c = camoById(id); if (c?.unlock.type !== 'kills') return '';
  const row = progress?.[c.unlock.weapon] || {}, need = Number(row.need) > 0 ? Number(row.need) : c.unlock.count;
  const hits = Math.max(0, Math.min(need, Math.floor(Number(row.hits) || 0)));
  return loc('{hits}/{need} pintadas con {weapon}', { hits, need, weapon: weaponOf(c.unlock.weapon)?.name || c.unlock.weapon });
}
// What the armory shows for one camo: `state` is 'owned' (wear it), 'locked' (kills
// to go, or no pana.sh session), 'buyable' or 'cantAfford' (mangos), and `text` says why.
// `online` is false without pana.sh (`signedOut`: without a session there): then only the
// start camos are anyone's.
export function camoState(id, { owned = [], progress = {}, prices = {}, balance = 0, online = true, signedOut = false } = {}) {
  const c = camoById(id); if (!c) return { state: 'locked', text: '' };
  if (unlockedSet({ owned }).has(id)) return { state: 'owned', text: isStart(id) ? loc('Tuyo desde el principio') : loc('Tuyo') };
  if (!online) return { state: 'locked', text: signedOut ? loc('Entra en tu cuenta de pana.sh para conseguirlo') : loc('Disponible en pana.sh') };
  if (c.unlock.type === 'kills') return { state: 'locked', text: progressText(id, progress) };
  const price = Number(prices?.[id]) > 0 ? Number(prices[id]) : c.unlock.price;
  if ((Number(balance) || 0) >= price) return { state: 'buyable', price, text: loc('{n} mangos', { n: price }) };
  return { state: 'cantAfford', price, text: loc('{n} mangos · te faltan {short}', { n: price, short: price - (Number(balance) || 0) }) };
}
// A CSS background for a camo's swatch, from its palette (no canvas, no image).
export function swatch(id) {
  const c = camoById(id); if (!c) return '';
  if (c.pattern === 'solid') return c.colors[0];
  const [a, b, d, e] = c.colors;
  if (c.pattern === 'digital') return `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0 / 10px 10px, linear-gradient(135deg, ${d}, ${e})`;
  if (c.pattern === 'tiger') return `repeating-linear-gradient(115deg, ${a} 0 9px, ${b} 9px 14px, ${d} 14px 18px, ${a} 18px 24px, ${e} 24px 27px)`;
  if (c.pattern === 'splash') return `radial-gradient(circle at 30% 35%, ${b} 0 14%, transparent 15%), radial-gradient(circle at 70% 60%, ${d} 0 12%, transparent 13%), radial-gradient(circle at 45% 80%, ${e} 0 9%, transparent 10%), ${a}`;
  return `radial-gradient(ellipse at 25% 30%, ${b} 0 22%, transparent 23%), radial-gradient(ellipse at 70% 65%, ${d} 0 20%, transparent 21%), radial-gradient(ellipse at 60% 20%, ${e} 0 12%, transparent 13%), ${a}`;
}
