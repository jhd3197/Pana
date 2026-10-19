import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { LENGTH, JUMPS, at, angle, wrap } from './course.js';

const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  field('course', 'Recorrido', [['llanos', 'Llanos'], ['morichal', 'Morichal · inverso']]),
  field('jumps', 'Saltos', [['normal', 'Normales'], ['crazy', 'Locos']]),
  field('laps', 'Vueltas', [[2, '2'], [3, '3']]),
  field('horse', 'Caballo', [['random', 'Al azar'], ['chosen', 'Elegido']], 'chosen', true),
  field('obstacles', 'Obstáculos', [['few', 'Pocos'], ['normal', 'Normal'], ['many', 'Muchos']], 'normal', true),
  field('shortcuts', 'Atajos', [[true, 'Sí'], [false, 'No']], false, true),
  field('weather', 'Clima', [['sun', 'Sol'], ['rain', 'Lluvia'], ['storm', 'Tormenta']], 'sun', true),
  field('jumpHelp', 'Ayuda de salto', [[true, 'Sí'], [false, 'No']], false, true),
  field('drafting', 'Rebufo', [[true, 'Sí'], [false, 'No']], false, true),
];
export function cleanOptions(raw = {}) {
  return normalizeRoomOptions(FIELDS, raw);
}
export const direction = options => options?.course === 'morichal' ? -1 : 1;
export const origin = options => options?.course === 'morichal' ? LENGTH * .69 : 0;
export function routeAt(progress, offset = 0, options = {}) {
  const d = direction(options), q = at(origin(options) + progress * d, offset * d);
  return { ...q, h: angle(q.h + (d < 0 ? Math.PI : 0)) };
}
export function raceJumps(options = {}) {
  const base = options.obstacles === 'few' ? JUMPS.slice(0, 1) : JUMPS;
  const jumps = options.obstacles === 'many' ? [...base, ...[.12, .43, .94].map((u, i) => ({ s: u * LENGTH, height: .5, id: i + 3 }))] : base;
  return jumps.map(j => ({ ...j, height: options.jumps === 'crazy' ? .95 : .5 }));
}
export const distanceAhead = (s, target, options) => wrap((target - s) * direction(options), LENGTH);
