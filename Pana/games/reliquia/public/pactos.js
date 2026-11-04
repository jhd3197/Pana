// Pactos: rules a squad takes on before a dive, for a better reward. Each has a
// Calor value, and their sum is the one number players see. Pure, no DOM: the
// host's rules.js, options.js and the unit tests read the same table.
// A pact's room option and its rank unlock share one id, `pacto:<id>`.
import { locKey } from '../../../engine/i18n.js';

export const PACTOS = [
  { id: 'cuota', calor: 1, name: locKey('Cuota apretada'), label: locKey('+25 % de cuota') },
  { id: 'turno', calor: 1, name: locKey('Turno corto'), label: locKey('Encargo con reloj') },
  { id: 'tienda', calor: 1, name: locKey('Tienda cara'), label: locKey('+50 % de precios') },
  { id: 'codicia', calor: 2, name: locKey('Codicia voraz'), label: locKey('+35 % de codicia') },
  { id: 'enjambre', calor: 2, name: locKey('Enjambre'), label: locKey('Más culebras') },
  { id: 'silbon', calor: 3, name: locKey('Silbón madruga'), label: locKey('Se para de una') },
];
// The numbers behind each pact, in one place.
export const PACTO = { quota: 1.25, quotaShare: .8, turno: .7, price: 1.5, greed: 1.35, swarmChance: .2, swarmSize: 1.5, silbonAfter: 20 };
export const CALOR_BONUS = 10;   // percent per Calor, on the payout and the XP
export const MAX_CALOR = PACTOS.reduce((n, p) => n + p.calor, 0);

const BY_ID = new Map(PACTOS.map(p => [p.id, p]));
export const pactoKey = id => `pacto:${id}`;
export const hasPacto = (options, id) => options?.[pactoKey(id)] === true;
// The ids a room has on, from its options.
export const pactosOf = options => PACTOS.filter(p => hasPacto(options, p.id)).map(p => p.id);
// Only real ids, each once, in the table's order.
export const validPactos = selection => Array.isArray(selection) ? PACTOS.filter(p => selection.includes(p.id)).map(p => p.id) : [];
export const calorOf = selection => validPactos(selection).reduce((n, id) => n + BY_ID.get(id).calor, 0);
export const calorOfOptions = options => calorOf(pactosOf(options));
const bonus = calor => 1 + Math.min(MAX_CALOR, Math.max(0, calor || 0)) * CALOR_BONUS / 100;
export const payoutMult = bonus;
export const xpMult = bonus;
export const bonusPercent = calor => Math.round((bonus(calor) - 1) * 100);

// What each pact does to the existing tunables; with the pact off, the value as it was.
// The raised quota never asks for more than a fair share of what the floor holds,
// so the pact can't be what strands a squad below (the lift needs the quota met).
export const pactoQuota = (options, quota, floorWorth = Infinity) => hasPacto(options, 'cuota')
  ? Math.max(quota, Math.min(Math.round(quota * PACTO.quota / 50) * 50, Math.floor(floorWorth * PACTO.quotaShare / 50) * 50)) : quota;
export const pactoTurno = (options, seconds) => hasPacto(options, 'turno') ? Math.round(seconds * PACTO.turno) : seconds;
export const pactoPrice = (options, price) => hasPacto(options, 'tienda') ? Math.ceil(price * PACTO.price) : price;
export const pactoGreed = options => hasPacto(options, 'codicia') ? PACTO.greed : 1;
export const pactoSwarmChance = options => hasPacto(options, 'enjambre') ? PACTO.swarmChance : 0;
export const pactoSwarmSize = options => hasPacto(options, 'enjambre') ? PACTO.swarmSize : 1;
