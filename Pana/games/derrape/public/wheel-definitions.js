// Derrape's swappable wheels (cauchos). Each wheel is a trade-off profile,
// not a stat stick: physics multipliers compose with the car's own tune, and
// the visual spec feeds makeWheel() in car-kit.js (null keeps the car's own
// wheels, so Estadio's parked cars and Studio previews stay untouched).
// `profile.offroad` is roughness resistance in -1..1 (negative amplifies the
// penalty); `profile.wet` is a 0..1 grip floor when the road reports wet.
export const WHEEL_DEFINITIONS = [
  {
    id: 'calle', name: 'Cauchos de calle', color: '#c9ccd4',
    blurb: 'Los de fábrica: ni fu ni fa, sirven pa’ todo.',
    profile: { top: 1, accel: 1, turn: 1, grip: 1, offroad: 0, wet: 0 },
    wheel: null,
  },
  {
    id: 'slick', name: 'Slicks de pista', color: '#e8b64c',
    blurb: 'Reyes del asfalto: agarran durísimo en seco, pero en la trocha no sirven.',
    profile: { top: 1.04, accel: 1.05, turn: 1.12, grip: 1.25, offroad: -0.4, wet: 0 },
    wheel: { r: 0.62, w: 0.74, style: 'spokes', rim: '#e8b64c', cap: '#20242c' },
  },
  {
    id: 'barro', name: 'Cauchos de barro', color: '#8a6a45',
    blurb: 'Tacos gruesos y rueda alta pa’ la trocha. En pista pierden un poquito.',
    profile: { top: 0.96, accel: 0.94, turn: 0.98, grip: 0.95, offroad: 0.75, wet: 0.15 },
    wheel: { r: 0.8, w: 0.78, style: 'steel', rim: '#7d8894' },
  },
  {
    id: 'palo', name: 'Llantas de palo', color: '#b5814a',
    blurb: 'Como de carreta: patinan sabroso y doblan rapidito. Puro derrape.',
    profile: { top: 0.97, accel: 0.98, turn: 1.15, grip: 0.45, offroad: 0, wet: 0 },
    wheel: { r: 0.66, w: 0.55, style: 'steel', rim: '#9a6a3a', cap: '#6e4423' },
  },
  {
    id: 'lluvia', name: 'Cauchos de lluvia', color: '#5fb4c9',
    blurb: 'Con estos el agua no te quita el agarre. Seguros en mojado.',
    profile: { top: 1, accel: 1, turn: 1.02, grip: 1.02, offroad: 0.1, wet: 0.85 },
    wheel: { r: 0.66, w: 0.62, style: 'spokes', rim: '#5fb4c9', cap: '#173a4a' },
  },
];

export function wheelById(id) {
  return WHEEL_DEFINITIONS.find(wheel => wheel.id === id) ?? WHEEL_DEFINITIONS[0];
}

// Pure: returns a NEW tune, never mutates the car definition. Adds the two
// wheel-only knobs (offroadResist, wetFloor) that stepCar reads alongside the
// classic top/accel/turn/grip.
export function composeTune(tune, profile = {}) {
  return {
    ...tune,
    top: tune.top * (profile.top ?? 1),
    accel: tune.accel * (profile.accel ?? 1),
    turn: tune.turn * (profile.turn ?? 1),
    grip: tune.grip * (profile.grip ?? 1),
    offroadResist: profile.offroad ?? 0,
    wetFloor: profile.wet ?? 0,
  };
}
