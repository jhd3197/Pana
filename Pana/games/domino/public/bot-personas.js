// Fixed personalities and human reaction windows, inspired by Parlour.
// No hidden-hand access; no wall-clock randomness, including after migration.
export const BOT_PERSONAS = [
  { name:'Coco', pips:1, doubles:3, frequency:1.6, think:.72 },
  { name:'Lola', pips:1.4, doubles:4, frequency:.8, think:.9 },
  { name:'Tito', pips:.7, doubles:2, frequency:2.4, think:1.05 },
  { name:'Nina', pips:1.1, doubles:2, frequency:1.4, think:.8 },
  { name:'Beto', pips:.9, doubles:3.5, frequency:1.8, think:.95 },
  { name:'Luz', pips:1.2, doubles:2.5, frequency:1.2, think:.85 },
];
export function botDelay(state) {
  const persona = BOT_PERSONAS[state.turn % BOT_PERSONAS.length];
  let n = (state.rng ^ Math.imul(state.revision + 1, 2654435761) ^ Math.imul(state.turn + 1, 1597334677)) >>> 0;
  n ^= n >>> 16;
  return persona.think + (n >>> 0) / 4294967296 * .35;
}
