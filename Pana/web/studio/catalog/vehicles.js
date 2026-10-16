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
