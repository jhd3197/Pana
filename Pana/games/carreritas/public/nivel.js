// Nivel: one number (and a D–S letter) for how built a ride is, shared by the
// taller, the parrilla, the results table and the matagigantes payout. Plain
// math on the garage's own 0–10 stat points (parts.js): peso never counts
// because it is a trade-off, not an upgrade. No Three.js, no DOM.
import { composeTune, wheelById } from './wheel-definitions.js';
import { partsProfile, statPoints } from './parts.js';

// D under 450, C 450–549, B 550–649, A 650–749, S 750 and up.
export const NIVEL_BANDS = [
  { min: 750, letter: 'S', color: '#c45bff' },
  { min: 650, letter: 'A', color: '#ff9a1f' },
  { min: 550, letter: 'B', color: '#2bb37a' },
  { min: 450, letter: 'C', color: '#3d7bf2' },
  { min: 0, letter: 'D', color: '#8b84b0' },
];

// Mangos paid per higher-nivel rival you beat in a race (¡Matagigantes!).
export const MATAGIGANTES_BONUS = 5;

// points: [Velocidad, Aceleración, Manejo, Agarre, Peso] as 0–10 (Peso ignored).
export const nivelFromPoints = ([vel, acel, man, agarre]) =>
  Math.round(100 + 16 * (1.5 * vel + acel + man + 0.8 * agarre));

export const nivelOf = (tune) => nivelFromPoints(statPoints(tune));

// The nivel of one car build: body tune + cauchos + taller parts.
export const carNivel = (car, wheelId, parts = {}) =>
  nivelOf(composeTune(car.tune, wheelById(wheelId).profile, partsProfile(parts)));

export const bandOf = (pi) => NIVEL_BANDS.find((band) => pi >= band.min) ?? NIVEL_BANDS.at(-1);

// The skewed two-tone chip: the letter on its colour, the number on dark ink.
export const badge = (pi, cls = '') => {
  const band = bandOf(pi);
  return `<span class="nivel-badge ${cls}" style="--nivel:${band.color}"><b>${band.letter}</b><span>${pi}</span></span>`;
};

// A kit's nivel for a race: the average of the pieces the track uses
// (use is a subset of ['car', 'boat', 'air']; missing pieces are skipped).
export function kitNivel(pieces, use) {
  const values = use.map((kind) => pieces[kind]).filter((pi) => Number.isFinite(pi));
  if (!values.length) return NaN;
  return Math.round(values.reduce((sum, pi) => sum + pi, 0) / values.length);
}

// Who you beat with a bigger kit: rivals is [{ name, pi }] of everyone you
// finished ahead of. Returns the beaten giants and the mango bonus.
export function matagigantes(myPi, rivals) {
  const giants = rivals.filter((r) => Number.isFinite(r?.pi) && r.pi > myPi);
  return { giants, bonus: giants.length * MATAGIGANTES_BONUS };
}
