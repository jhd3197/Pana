// Lightweight garage metadata, also used by Studio without loading geometry.
export const CAR_DEFINITIONS = [
  {
    id: 'chamo', num: 1, name: 'El Chamo', color: '#e0262f',
    blurb: 'Chiquito, bravo y con tumbaburros. Arranca rápido y dobla en una moneda.',
    stats: { Velocidad: 0.62, 'Aceleración': 0.92, Manejo: 0.88, Peso: 0.35 },
    tune: { top: 33, accel: 26, turn: 2.6, mass: 0.8, grip: 7 },
    horn: 'meep',
  },
  {
    id: 'lancha', num: 2, name: 'La Lancha', color: '#1f9e8e',
    blurb: 'Larga, pesada y oxidada. Tarda en arrancar, pero en la recta no la para nadie.',
    stats: { Velocidad: 0.9, 'Aceleración': 0.55, Manejo: 0.58, Peso: 0.9 },
    tune: { top: 39, accel: 16, turn: 2.0, mass: 1.35, grip: 5 },
    horn: 'cucaracha',
  },
  {
    id: 'machito', num: 3, name: 'El Machito', color: '#ffc629',
    blurb: 'Rústico de techo duro, cuatro faros y repuesto atrás. Siempre listo pa’ la trocha.',
    stats: { Velocidad: 0.7, 'Aceleración': 0.75, Manejo: 0.7, Peso: 0.75 },
    tune: { top: 35, accel: 21, turn: 2.3, mass: 1.15, grip: 6 },
    horn: 'grave',
  },
  {
    id: 'bala', num: 4, name: 'La Bala', color: '#3d7bf2',
    blurb: 'Hatchback de rally con alerón. La más rápida en la recta, pero se espanta en las curvas.',
    stats: { Velocidad: 0.95, 'Aceleración': 0.8, Manejo: 0.62, Peso: 0.4 },
    tune: { top: 40, accel: 22, turn: 2.2, mass: 0.85, grip: 5.5 },
    horn: 'meep',
  },
  {
    id: 'toro', num: 5, name: 'El Toro', color: '#ff7a2b',
    blurb: 'Pick-up con cava en el cajón. Pesada: cuando choca, el otro sale volando.',
    stats: { Velocidad: 0.72, 'Aceleración': 0.55, Manejo: 0.55, Peso: 1.0 },
    tune: { top: 36, accel: 16, turn: 2.0, mass: 1.5, grip: 5.5 },
    horn: 'grave',
  },
  {
    id: 'familiar', num: 6, name: 'La Familiar', color: '#8ac926',
    blurb: 'Va pa\u2019 la playa con maletas y olla en el techo. Si choca, llueven corotos.',
    stats: { Velocidad: 0.66, 'Aceleración': 0.6, Manejo: 0.7, Peso: 0.8 },
    tune: { top: 35, accel: 18, turn: 2.3, mass: 1.2, grip: 6 },
    horn: 'cucaracha',
  },
  {
    id: 'rumbera', num: 7, name: 'La Rumbera', color: '#f15bb5',
    blurb: 'Escarabajo con cornetas en el techo y la bandera al viento. Siempre de fiesta.',
    stats: { Velocidad: 0.6, 'Aceleración': 0.85, Manejo: 0.92, Peso: 0.3 },
    tune: { top: 33, accel: 25, turn: 2.7, mass: 0.75, grip: 7 },
    horn: 'fiesta',
  },
  {
    id: 'montanero', num: 8, name: 'El Montañero', color: '#b8d000',
    blurb: 'Buggy camuflado con winche y jaula. Brinca las rampas como si nada.',
    stats: { Velocidad: 0.78, 'Aceleración': 0.8, Manejo: 0.74, Peso: 0.7 },
    tune: { top: 37, accel: 22, turn: 2.4, mass: 1.05, grip: 6.5 },
    horn: 'grave',
  },
];
