import { CARS } from '/g/derrape/cars.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
export const VEHICLES = [
  ...CARS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/g/derrape/cars.js', factory: `CARS.find(c => c.id === '${car.id}').build`, usedBy: ['Derrape'], description: car.blurb,
    async build() { const model = car.build(DEFAULT_AVATAR); return { group: model.root, update: (t, dt) => model.driver.update(dt), dispose: () => model.driver.dispose() }; },
  })),
];
