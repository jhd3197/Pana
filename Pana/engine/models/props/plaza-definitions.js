// World units; every factory is grounded at y=0 and faces +Z.
// Games own interactions. These definitions describe only the reusable assets.
export const PLAZA_PROPS = Object.freeze([
  { id: 'barrel', label: 'Barril', radius: 0.72, height: 1.8, width: 1.44, depth: 1.44 },
  { id: 'crate', label: 'Caja', radius: 0.85, height: 1.45, width: 1.5, depth: 1.5 },
  { id: 'cooler', label: 'Cava', radius: 0.75, height: 1.05, width: 1.6, depth: 1.05 },
  { id: 'planter', label: 'Mata', radius: 0.65, height: 2.2, width: 1.3, depth: 1.3 },
  { id: 'bench', label: 'Banco', radius: 1.45, height: 1.65, width: 2.8, depth: 1.2 },
]);
export const propDefinition = id => PLAZA_PROPS.find(p => p.id === id);
