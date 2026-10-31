import { COURT, landing, flightPath } from '../../../engine/play/bolas-criollas.js';
import { locKey } from '../../../engine/i18n.js';

// Normal predicts an unobstructed roll; Fácil supplies the simulated path.
export function aimFeedback(shot, guide, preview = null) {
  const from = { x: shot.originX || 0, z: COURT.launchZ }, to = landing(shot, from.x);
  const dx = to.x - from.x, dz = to.z - from.z;
  const width = COURT.halfWidth - COURT.radius, length = COURT.halfLength - COURT.radius;
  let t = 1;
  if (dx) t = Math.min(t, ((dx > 0 ? width : -width) - from.x) / dx);
  if (dz) t = Math.min(t, ((dz > 0 ? length : -length) - from.z) / dz);
  const full = guide.after >= 1 && preview;
  const path = full && preview.path.length ? [from, ...preview.path] : [from, { x: from.x + dx * t, z: from.z + dz * t }];
  const out = full ? preview.out : t < 1;
  const visible = guide.ghost && guide.reach >= 1;
  const reach = Math.min(t, Math.max(1.2 / Math.hypot(dx, dz), guide.reach));
  let flight = flightPath(shot, from.x);
  if (full && flight.length) {
    const firstGround = preview.path.findIndex((p, i) => i > 0 && !(p.height > 0));
    flight = [from, ...preview.path.slice(0, firstGround < 0 ? undefined : firstGround + 1)];
  }
  flight = flight.filter(p => Math.abs(p.x) <= width && Math.abs(p.z) <= length);
  const touchdown = flight.length && !(flight.at(-1).height > .001) ? flight.at(-1) : null;
  const rollPath = shot.mode !== 'aire' ? path : !touchdown ? [] : full ? path.slice(path.indexOf(touchdown)) : [touchdown, path.at(-1)];
  return { path: visible ? rollPath : [from, { x: from.x + dx * reach, z: from.z + dz * reach }],
    flight: visible ? flight : [], touchdown,
    end: path.at(-1), out, visible, range: path.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z) : 0, 0),
    label: out ? locKey('FUERA DE CANCHA') : full ? locKey('AQUÍ FRENA') : locKey('FRENA SIN CHOQUES') };
}
