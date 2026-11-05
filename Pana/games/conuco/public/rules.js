// Conuco's tables: what grows, what the house costs, what a rank unlocks and how the
// shelf rotates. The mechanics are engine/plot/; this file is only the numbers, so a
// Node test can check the economy. Relative imports: tests load it outside the server.
import { HOUR, MINUTE } from '../../../engine/plot/growth.js';
import { locKey } from '../../../engine/i18n.js';

// A free crop always grows, so nobody can get stuck with no mangos and no seeds.
export const CROPS = [
  { id: 'maiz', name: locKey('Maíz'), growMs: 5 * MINUTE, seedCost: 0, mangos: 2, xp: 4, free: true },
  { id: 'caraota', name: locKey('Caraota'), growMs: 15 * MINUTE, seedCost: 3, mangos: 7, xp: 8 },
  { id: 'aji', name: locKey('Ají dulce'), growMs: 30 * MINUTE, seedCost: 5, mangos: 12, xp: 14 },
  { id: 'cambur', name: locKey('Cambur'), growMs: 1 * HOUR, seedCost: 8, mangos: 20, xp: 24 },
  { id: 'parchita', name: locKey('Parchita'), growMs: 2 * HOUR, seedCost: 12, mangos: 32, xp: 40 },
  { id: 'patilla', name: locKey('Patilla'), growMs: 4 * HOUR, seedCost: 18, mangos: 50, xp: 70 },
  { id: 'cacao', name: locKey('Cacao'), growMs: 8 * HOUR, seedCost: 30, mangos: 90, xp: 120 },
];

// In order; `cost` is what reaching this tier takes, `beds` what it gives.
export const TIERS = [
  { id: 'caido', name: locKey('Rancho caído'), cost: 0, beds: 3 },
  { id: 'rancho', name: locKey('Rancho'), cost: 25, beds: 4 },
  { id: 'casita', name: locKey('Casita'), cost: 120, beds: 6 },
  { id: 'casa', name: locKey('Casa con porche'), cost: 350, beds: 8 },
  { id: 'casona', name: locKey('Casona'), cost: 800, beds: 9 },
];

export const RANKS = [
  { id: 'ayudante', title: locKey('Ayudante'), xp: 0, unlocks: [] },
  { id: 'sembrador', title: locKey('Sembrador'), xp: 40, unlocks: ['decor:banca'] },
  { id: 'conuquero', title: locKey('Conuquero'), xp: 150, unlocks: ['decor:espantapajaros'] },
  { id: 'cosechero', title: locKey('Cosechero'), xp: 400, unlocks: ['decor:banderines'] },
  { id: 'hacendado', title: locKey('Hacendado'), xp: 900, unlocks: ['decor:fogon'] },
  { id: 'patron', title: locKey('Patrón del conuco'), xp: 1800, unlocks: ['decor:chinchorro', 'decor:palma'] },
];
export const DECOR = [
  { id: 'banca', name: locKey('Banca'), unlock: 'decor:banca' },
  { id: 'espantapajaros', name: locKey('Espantapájaros'), unlock: 'decor:espantapajaros' },
  { id: 'banderines', name: locKey('Banderines'), unlock: 'decor:banderines' },
  { id: 'fogon', name: locKey('Fogón'), unlock: 'decor:fogon' },
  { id: 'chinchorro', name: locKey('Chinchorro'), unlock: 'decor:chinchorro' },
  { id: 'palma', name: locKey('Palma'), unlock: 'decor:palma' },
];
// The rank that unlocks a decoration, for its locked row.
export const rankOfDecor = id => RANKS.find(rank => rank.unlocks.includes(DECOR.find(item => item.id === id)?.unlock));

export const SHOP = { salt: 'conuco', period: 4 * HOUR, size: 3, qty: [2, 4] };

// '45 s', '12 min', '3 h 20': the short clock on a bed and a shelf.
export function formatLeft(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}
