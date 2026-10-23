import { CAR_DEFINITIONS } from '/g/carreritas/car-definitions.js';
import { WHEEL_DEFINITIONS } from '/g/carreritas/wheel-definitions.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
export const VEHICLES = [
  ...CAR_DEFINITIONS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/engine/models/vehicles/cars.js', factory: `CAR_BUILDERS.${car.id}`, usedBy: ['Carreritas', 'Bululú'], description: car.blurb,
    async build() { const { CAR_BUILDERS } = await import('/engine/models/vehicles/cars.js'); const model = CAR_BUILDERS[car.id](DEFAULT_AVATAR); return { group: model.root, update: (t, dt) => model.driver.update(dt), dispose: () => model.driver.dispose() }; },
  })),
  // Curiara's canoe with the pana paddling; Bululú's river minigames reuse it.
  { id: 'racing-curiara', name: 'Curiara de carrera', category: 'Vehículos', source: '/engine/models/vehicles/curiara.js', factory: 'createCanoe', usedBy: ['Curiara', 'Bululú'], description: 'La curiara del hato con banda de color, banderín y el pana remando; dos puestos en Parejas (proa y popa).',
    async build() { const { createCanoe } = await import('/engine/models/vehicles/curiara.js'); const model = createCanoe([{ avatar: DEFAULT_AVATAR }], '#3f9e7a'), boat = { paddle: { last: 0, side: -1 }, capsized: 0 };
      return { group: model.group, update: (t, dt) => { if (t - boat.paddle.last > .45) boat.paddle = { last: t, side: -boat.paddle.side }; model.update(dt, boat, t); }, dispose: () => model.dispose() }; },
  },
  // Lancha's racing peñero with its fuera de borda and the pana at the tiller.
  { id: 'racing-lancha', name: 'Lancha de carrera', category: 'Vehículos', source: '/engine/models/vehicles/lancha.js', factory: 'createLancha', usedBy: ['Lancha'], description: 'Peñero ligero en el color del equipo, motor fuera de borda que gira y hélice que da vueltas, cava azul y el pana en el timón.',
    async build() { const { createLancha } = await import('/engine/models/vehicles/lancha.js'); const model = createLancha(DEFAULT_AVATAR, '#e2683c');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 9, throttle: 1, steer: Math.sin(t * .8) }, t), dispose: () => model.dispose() }; },
  },
  // Carreritas's flight gates turn cars into this little plane.
  { id: 'racing-avioneta', name: 'Avioneta', category: 'Vehículos', source: '/engine/models/vehicles/avioneta.js', factory: 'createAvioneta', usedBy: ['Carreritas'], description: 'Avioneta de ala alta en el color del carro, con banda blanca, hélice que gira, ruedas gorditas y el pana en la cabina abierta.',
    async build() { const { createAvioneta } = await import('/engine/models/vehicles/avioneta.js'); const model = createAvioneta(DEFAULT_AVATAR, '#e8443a');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 30, steer: Math.sin(t * .6) }, t), dispose: () => model.dispose() }; },
  },
  // The kit's other two boat bodies (transform gates pick them by kit id).
  { id: 'kit-curiara', name: 'Curiara (kit)', category: 'Vehículos', source: '/engine/models/vehicles/lancha.js', factory: 'createCuriaraRacer', usedBy: ['Carreritas'], description: 'Canoa de río ahuecada: mucho más angosta y baja que el peñero, puntiaguda en ambos extremos, con un fuera de borda pequeño y el pana sentado bien adentro.',
    async build() { const { createCuriaraRacer } = await import('/engine/models/vehicles/lancha.js'); const model = createCuriaraRacer(DEFAULT_AVATAR, '#3f9e7a');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 9, throttle: 1, steer: Math.sin(t * .8) }, t), dispose: () => model.dispose() }; },
  },
  { id: 'kit-rayo', name: 'El Rayo (kit)', category: 'Vehículos', source: '/engine/models/vehicles/lancha.js', factory: 'createRayo', usedBy: ['Carreritas'], description: 'Lancha de carreras: proa larga y afilada, perfil bajo, parabrisas envolvente transparente, fuera de borda grandote y franja deportiva blanca.',
    async build() { const { createRayo } = await import('/engine/models/vehicles/lancha.js'); const model = createRayo(DEFAULT_AVATAR, '#e8b93a');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 9, throttle: 1, steer: Math.sin(t * .8) }, t), dispose: () => model.dispose() }; },
  },
  // And the kit's other two plane bodies.
  { id: 'kit-guacamaya', name: 'Guacamaya (kit)', category: 'Vehículos', source: '/engine/models/vehicles/avioneta.js', factory: 'createGuacamaya', usedBy: ['Carreritas'], description: 'Avioneta un poquito más estilizada, con las puntas de las alas en escarlata y destellos azules en la cola, como la guacamaya.',
    async build() { const { createGuacamaya } = await import('/engine/models/vehicles/avioneta.js'); const model = createGuacamaya(DEFAULT_AVATAR, '#e8443a');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 30, steer: Math.sin(t * .6) }, t), dispose: () => model.dispose() }; },
  },
  { id: 'kit-turpial', name: 'Turpial (kit)', category: 'Vehículos', source: '/engine/models/vehicles/avioneta.js', factory: 'createTurpial', usedBy: ['Carreritas'], description: 'Avioneta de ala corta y nerviosa con el traje del turpial: puntas negras, banda y destellos de cola amarillos.',
    async build() { const { createTurpial } = await import('/engine/models/vehicles/avioneta.js'); const model = createTurpial(DEFAULT_AVATAR, '#f2b632');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 30, steer: Math.sin(t * .6) }, t), dispose: () => model.dispose() }; },
  },
  // Parapente's wing with the pana in the harness, paws on the brakes.
  { id: 'racing-parapente', name: 'Parapente', category: 'Vehículos', source: '/engine/models/vehicles/parapente.js', factory: 'createParapente', usedBy: ['Parapente'], description: 'Vela en arco en el color del equipo con celdas blancas, cascada de líneas, silla y el pana con las patas en los frenos; las orejas pliegan las puntas.',
    async build() { const { createParapente } = await import('/engine/models/vehicles/parapente.js'); const model = createParapente(DEFAULT_AVATAR, '#2fa3e0');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 16, steer: Math.sin(t * .6), ears: Math.sin(t * .3) > .7 ? 1 : 0 }, t), dispose: () => model.dispose() }; },
  },
  // Carreritas's swappable cauchos, one entry per wheel definition. The street
  // wheel has no spec of its own (cars keep theirs), so it previews generic.
  ...WHEEL_DEFINITIONS.map(wheel => ({ id: `wheel-${wheel.id}`, name: wheel.name, category: 'Vehículos', source: '/g/carreritas/wheel-definitions.js', factory: 'makeWheel', usedBy: ['Carreritas'], description: wheel.blurb, dependencies: ['/engine/models/vehicles/car-kit.js'],
    async build() {
      const { makeWheel } = await import('/engine/models/vehicles/car-kit.js');
      const { Box3, Vector3 } = await import('three');
      const spec = wheel.wheel ?? { r: 0.69, w: 0.68, style: 'spokes', rim: '#6b707e', cap: '#e0262f' };
      const group = makeWheel(spec);
      group.userData.previewBounds = [[-spec.w / 2, -spec.r, -spec.r], [spec.w / 2, spec.r, spec.r]];
      return { group, bounds: new Box3(new Vector3(...group.userData.previewBounds[0]), new Vector3(...group.userData.previewBounds[1])) };
    },
  })),
];
