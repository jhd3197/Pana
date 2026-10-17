// Lightweight garage metadata, also used by Studio without loading geometry.
export const CAR_DEFINITIONS = [
  {
    id: 'chamo', num: 1, name: 'El Chamo', color: '#e0262f',
    blurb: 'Arranca rápido y dobla en una moneda. Su turbo de derrape carga un 10% más rápido y dura un 10% más.',
    stats: { Velocidad: 0.62, 'Aceleración': 0.92, Manejo: 0.88, Peso: 0.35 },
    tune: { top: 35, accel: 26, turn: 2.6, mass: 0.8, grip: 7, driftCharge: 1.1, driftBoost: 1.1 },
    horn: 'meep',
  },
  {
    id: 'lancha', num: 2, name: 'La Lancha', color: '#1f9e8e',
    blurb: 'Larga y pesada, veloz en rectas. Pégate detrás de un rival: carga el rebufo un 20% más rápido y dura un 25% más.',
    stats: { Velocidad: 0.9, 'Aceleración': 0.55, Manejo: 0.58, Peso: 0.9 },
    tune: { top: 38, accel: 18, turn: 2.0, mass: 1.35, grip: 5, draftCharge: 1.2, draftBoost: 1.25 },
    horn: 'cucaracha',
  },
  {
    id: 'machito', num: 3, name: 'El Machito', color: '#ffc629',
    blurb: 'Hecho pa’ la trocha: reduce un 20% el castigo del barro. Combínalo con cauchos de barro para salir con fuerza.',
    stats: { Velocidad: 0.7, 'Aceleración': 0.75, Manejo: 0.7, Peso: 0.75 },
    tune: { top: 35.5, accel: 22, turn: 2.3, mass: 1.15, grip: 6, offroadResist: 0.2 },
    horn: 'grave',
  },
  {
    id: 'bala', num: 4, name: 'La Bala', color: '#3d7bf2',
    blurb: 'La más rápida en rectas. Sus turbos de derrape cargan más lento y duran menos: frena bien y aprovecha la salida.',
    stats: { Velocidad: 0.95, 'Aceleración': 0.8, Manejo: 0.62, Peso: 0.4 },
    tune: { top: 39, accel: 20, turn: 2.2, mass: 0.85, grip: 5.5, driftCharge: 0.9, driftBoost: 0.9 },
    horn: 'meep',
  },
  {
    id: 'toro', num: 5, name: 'El Toro', color: '#ff7a2b',
    blurb: 'Pesada y firme en los roces. Su rebufo carga un 15% más rápido y dura un 35% más: busca rueda y adelanta.',
    stats: { Velocidad: 0.72, 'Aceleración': 0.55, Manejo: 0.55, Peso: 1.0 },
    tune: { top: 36, accel: 20, turn: 2.0, mass: 1.5, grip: 5.5, offroadResist: 0.15, draftCharge: 1.15, draftBoost: 1.35 },
    horn: 'grave',
  },
  {
    id: 'familiar', num: 6, name: 'La Familiar', color: '#8ac926',
    blurb: 'Con maletas, olla y agarre en mojado. Conserva al menos un 65% de agarre; su turbo de rebufo dura un 20% más.',
    stats: { Velocidad: 0.66, 'Aceleración': 0.6, Manejo: 0.7, Peso: 0.8 },
    tune: { top: 35.5, accel: 22, turn: 2.3, mass: 1.2, grip: 6, wetFloor: 0.65, draftBoost: 1.2 },
    horn: 'cucaracha',
  },
  {
    id: 'rumbera', num: 7, name: 'La Rumbera', color: '#f15bb5',
    blurb: '¡Baila las curvas! Su turbo de derrape carga un 30% más rápido y dura un 35% más. Prueba las llantas de palo.',
    stats: { Velocidad: 0.6, 'Aceleración': 0.85, Manejo: 0.92, Peso: 0.3 },
    tune: { top: 35, accel: 25, turn: 2.7, mass: 0.75, grip: 7, driftCharge: 1.3, driftBoost: 1.35 },
    horn: 'fiesta',
  },
  {
    id: 'montanero', num: 8, name: 'El Montañero', color: '#b8d000',
    blurb: 'Busca las rampas y haz una pirueta: el turbo al aterrizar dura un 65% más. También se defiende en la trocha.',
    stats: { Velocidad: 0.78, 'Aceleración': 0.8, Manejo: 0.74, Peso: 0.7 },
    tune: { top: 36.5, accel: 22, turn: 2.4, mass: 1.05, grip: 6.5, offroadResist: 0.12, trickBoost: 1.65 },
    horn: 'grave',
  },
];
