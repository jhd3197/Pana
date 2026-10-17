// Game-only wire values and deterministic randomness. Rendering and sound never
// consume this stream; no global Math.random replacement is needed.
export const IDLE_INPUT = Object.freeze({ x: 0, z: 0, jump: false, aim: { x: 0, y: 0 }, pull: false, fire: false });
const axis = v => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
export function cleanInput(v = {}) {
  if (!v || typeof v !== 'object') v = {};
  return { x: axis(v.x), z: axis(v.z), jump: v.jump === true,
    aim: { x: axis(v.aim?.x), y: axis(v.aim?.y) }, pull: v.pull === true, fire: v.fire === true };
}
export const inputFor = (input, i) => Array.isArray(input) ? input[i] || IDLE_INPUT : input || IDLE_INPUT;
export function seeded(seed) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
let source = Math.random;
export const random = () => source();
export function withRandom(rng, fn) {
  const previous = source;
  source = rng;
  try { return fn(); } finally { source = previous; }
}

export function acceptsChoice(prompt, seat, message) {
  return !!prompt && prompt.seat === seat && message.prompt === prompt.id
    && Number.isInteger(message.choice) && message.choice >= 0 && message.choice < prompt.options.length;
}
