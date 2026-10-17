// Derrape's swappable wheels (cauchos). Each wheel is a trade-off profile,
// not a stat stick: physics multipliers compose with the car's own tune, and
// the visual spec feeds makeWheel() in car-kit.js (null keeps the car's own
// wheels, so Estadio's parked cars and Studio previews stay untouched).
// `profile.offroad` is roughness resistance in -1..1 (negative amplifies the
// penalty); `profile.wet` is a 0..1 grip floor when the road reports wet.
export const WHEEL_DEFINITIONS = [
  {
    id: 'calle', name: 'Cauchos de calle', color: '#c9ccd4',
    blurb: 'Arrancan un 10% más rápido. Buenos para salir de curvas y recuperarte de un golpe, sin perder velocidad máxima.',
    profile: { top: 1, accel: 1.1, turn: 1, grip: 1, offroad: 0, wet: 0, wetDrag: 0.25 },
    wheel: null,
  },
  {
    id: 'slick', name: 'Slicks de pista', color: '#e8b64c',
    blurb: 'Un 2,5% más de punta y mucho agarre en seco. Arrancan más lento, cargan menos derrape y pierden velocidad en agua y barro.',
    profile: { top: 1.025, accel: 0.94, turn: 1.03, grip: 1.18, offroad: -0.4, wet: 0, wetDrag: 0.65, driftCharge: 0.9 },
    wheel: { r: 0.62, w: 0.74, style: 'spokes', rim: '#e8b64c', cap: '#20242c' },
  },
  {
    id: 'barro', name: 'Cauchos de barro', color: '#8a6a45',
    blurb: 'Quitan el 85% del castigo del barro y agarran en mojado. Solo ceden un 1,5% de punta en asfalto.',
    profile: { top: 0.985, accel: 1.02, turn: 1, grip: 0.98, offroad: 0.85, wet: 0.6, wetDrag: 0.18 },
    wheel: { r: 0.8, w: 0.78, style: 'steel', rim: '#7d8894' },
  },
  {
    id: 'palo', name: 'Llantas de palo', color: '#b5814a',
    blurb: 'Derrapes que cargan un 25% más rápido y turbos un 18% más largos. Patinan más: controla la salida de la curva.',
    profile: { top: 0.99, accel: 1, turn: 1.08, grip: 0.6, offroad: 0, wet: 0, wetDrag: 0.3, driftCharge: 1.25, driftBoost: 1.18 },
    wheel: { r: 0.66, w: 0.55, style: 'steel', rim: '#9a6a3a', cap: '#6e4423' },
  },
  {
    id: 'lluvia', name: 'Cauchos de lluvia', color: '#5fb4c9',
    blurb: 'Conservan el 90% del agarre y casi toda la punta bajo la lluvia. También reducen el frenazo del agua y del aguacero.',
    profile: { top: 0.995, accel: 1.03, turn: 1.03, grip: 1.05, offroad: 0.2, wet: 0.9, wetDrag: 0.04 },
    wheel: { r: 0.66, w: 0.62, style: 'spokes', rim: '#5fb4c9', cap: '#173a4a' },
  },
];

export function wheelById(id) {
  return WHEEL_DEFINITIONS.find(wheel => wheel.id === id) ?? WHEEL_DEFINITIONS[0];
}

// Pure: returns a new tune, never mutates the car definition. Surface resistance
// and skill payouts combine with the car's talent as well as its basic stats.
export function composeTune(tune, profile = {}) {
  return {
    ...tune,
    top: tune.top * (profile.top ?? 1),
    accel: tune.accel * (profile.accel ?? 1),
    turn: tune.turn * (profile.turn ?? 1),
    grip: tune.grip * (profile.grip ?? 1),
    offroadResist: 1 - (1 - (tune.offroadResist ?? 0)) * (1 - (profile.offroad ?? 0)),
    wetFloor: Math.max(tune.wetFloor ?? 0, profile.wet ?? 0),
    wetDrag: profile.wetDrag ?? 0.25,
    driftCharge: (tune.driftCharge ?? 1) * (profile.driftCharge ?? 1),
    driftBoost: (tune.driftBoost ?? 1) * (profile.driftBoost ?? 1),
  };
}
