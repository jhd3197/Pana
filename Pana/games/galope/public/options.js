import { botParticipation } from '../../../engine/room-option-fields.js';
import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { LENGTH, JUMPS, at, angle, wrap } from './course.js';
import { loc } from '../../../engine/i18n.js';

const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  botParticipation(),
  field('course', loc('Recorrido'), [['llanos', 'Llanos'], ['morichal', loc('Morichal · inverso')]]),
  field('jumps', loc('Saltos'), [['normal', loc('Normales')], ['crazy', loc('Locos')]]),
  field('laps', loc('Vueltas'), [[2, '2'], [3, '3']]),
  field('horse', loc('Caballo'), [['random', loc('Al azar')], ['chosen', loc('Elegido')]], 'chosen', true),
  field('obstacles', loc('Obstáculos'), [['few', loc('Pocos')], ['normal', loc('Normal')], ['many', loc('Muchos')]], 'normal', true),
  field('shortcuts', loc('Atajos'), [[true, loc('Sí')], [false, loc('No')]], false, true),
  field('weather', loc('Clima'), [['sun', loc('Sol')], ['rain', loc('Lluvia')], ['storm', loc('Tormenta')]], 'sun', true),
  field('jumpHelp', loc('Ayuda de salto'), [[true, loc('Sí')], [false, loc('No')]], false, true),
  field('drafting', loc('Rebufo'), [[true, loc('Sí')], [false, loc('No')]], false, true),
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
