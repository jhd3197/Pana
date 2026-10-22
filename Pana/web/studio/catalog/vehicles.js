import { CAR_DEFINITIONS } from '/g/derrape/car-definitions.js';
import { WHEEL_DEFINITIONS } from '/g/derrape/wheel-definitions.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
export const VEHICLES = [
  ...CAR_DEFINITIONS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/engine/models/vehicles/cars.js', factory: `CAR_BUILDERS.${car.id}`, usedBy: ['Derrape', 'Bululú'], description: car.blurb,
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
  // Parapente's wing with the pana in the harness, paws on the brakes.
  { id: 'racing-parapente', name: 'Parapente', category: 'Vehículos', source: '/engine/models/vehicles/parapente.js', factory: 'createParapente', usedBy: ['Parapente'], description: 'Vela en arco en el color del equipo con celdas blancas, cascada de líneas, silla y el pana con las patas en los frenos; las orejas pliegan las puntas.',
    async build() { const { createParapente } = await import('/engine/models/vehicles/parapente.js'); const model = createParapente(DEFAULT_AVATAR, '#2fa3e0');
      return { group: model.group, update: (t, dt) => model.update(dt, { v: 16, steer: Math.sin(t * .6), ears: Math.sin(t * .3) > .7 ? 1 : 0 }, t), dispose: () => model.dispose() }; },
  },
  // Derrape's swappable cauchos, one entry per wheel definition. The street
  // wheel has no spec of its own (cars keep theirs), so it previews generic.
  ...WHEEL_DEFINITIONS.map(wheel => ({ id: `wheel-${wheel.id}`, name: wheel.name, category: 'Vehículos', source: '/g/derrape/wheel-definitions.js', factory: 'makeWheel', usedBy: ['Derrape'], description: wheel.blurb, dependencies: ['/engine/models/vehicles/car-kit.js'],
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
