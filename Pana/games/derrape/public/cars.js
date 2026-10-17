// Derrape's garage: each car's stats and blurb (car-definitions.js) joined to
// its shared model builder in /engine/models/vehicles/cars.js.
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { CAR_DEFINITIONS } from './car-definitions.js';

export const CARS = CAR_DEFINITIONS.map(car => ({ ...car, build: CAR_BUILDERS[car.id] }));
