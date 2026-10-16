import { CAR_DEFINITIONS } from '/g/derrape/car-definitions.js';
import { WHEEL_DEFINITIONS } from '/g/derrape/wheel-definitions.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
export const VEHICLES = [
  ...CAR_DEFINITIONS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/g/derrape/cars.js', factory: `CARS.find(c => c.id === '${car.id}').build`, usedBy: ['Derrape'], description: car.blurb,
    async build() { const { CARS } = await import('/g/derrape/cars.js'); const model = CARS.find(model => model.id === car.id).build(DEFAULT_AVATAR); return { group: model.root, update: (t, dt) => model.driver.update(dt), dispose: () => model.driver.dispose() }; },
  })),
  // Derrape's swappable cauchos, one entry per wheel definition. The street
  // wheel has no spec of its own (cars keep theirs), so it previews generic.
  ...WHEEL_DEFINITIONS.map(wheel => ({ id: `wheel-${wheel.id}`, name: wheel.name, category: 'Vehículos', source: '/g/derrape/wheel-definitions.js', factory: 'makeWheel', usedBy: ['Derrape'], description: wheel.blurb, dependencies: ['/g/derrape/car-kit.js'],
    async build() {
      const { makeWheel } = await import('/g/derrape/car-kit.js');
      const { Box3, Vector3 } = await import('three');
      const spec = wheel.wheel ?? { r: 0.69, w: 0.68, style: 'spokes', rim: '#6b707e', cap: '#e0262f' };
      const group = makeWheel(spec);
      group.userData.previewBounds = [[-spec.w / 2, -spec.r, -spec.r], [spec.w / 2, spec.r, spec.r]];
      return { group, bounds: new Box3(new Vector3(...group.userData.previewBounds[0]), new Vector3(...group.userData.previewBounds[1])) };
    },
  })),
];
