// Reuse the race vessels in the existing perspective showroom, loaded on demand.
import { createLancha, createCuriaraRacer, createRayo } from '/engine/models/vehicles/lancha.js';
import { createAvioneta, createGuacamaya, createTurpial } from '/engine/models/vehicles/avioneta.js';
const builders = { penero: createLancha, curiara: createCuriaraRacer, rayo: createRayo, zamuro: createAvioneta, guacamaya: createGuacamaya, turpial: createTurpial };
let model = null, key = '';
export function previewVessel(garage, avatar, kind, id, color) {
  const next = kind === 'car' ? '' : `${kind}:${id}:${color}`;
  if (next !== key) { model?.group.removeFromParent(); model?.dispose(); model = null; key = next; }
  garage.car.root.visible = !next;
  if (!next) return;
  if (!model) model = (builders[id] || (kind === 'boat' ? createLancha : createAvioneta))(avatar, color);
  garage.turn.add(model.group);
}
