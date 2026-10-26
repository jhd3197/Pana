// Chapita's street as numbers: the pitch path, the batted cap's flight and
// what it hits. Pure (no DOM, no Three.js), so the host's rules and every
// screen trace the very same chapita. Coordinates: x is screen right seen
// from behind the plate, y is up, d is how far out from the plate (the 3D
// scene puts d on -Z). The plate is at d = 0, the pitcher at d = 10.5.
import { clamp } from '/engine/random.js';
import { locKey } from '../../../engine/i18n.js';

// The runner stations: a chalk diamond with home at the plate, 1st and 3rd
// just inside the curbs and 2nd up on the acera behind the pitcher (scene z,
// not d; y is the surface it sits on). Still virtual: runners move base to
// base on the scorecard; markers and panas share these.
export const BASES = [{ x: 2.85, z: -6, y: .03 }, { x: 0, z: -12, y: .15 }, { x: -2.85, z: -6, y: .03 }];

export const RELEASE = { x: 0, y: 1.55, d: 10.5 };
export const ROWS = ['alto', 'medio', 'bajo'];
export const ROW_Y = [1.42, 1.0, 0.6];
export const COL_X = [-.38, 0, .38];
export const HEIGHT_TEXT = { alto: locKey('Alto'), medio: locKey('Medio'), bajo: locKey('Bajo') };

// Each pitch: flight time (s), the late break (x, y) and the name on screen.
export const PITCHES = {
  planea: { time: 1.2, label: locKey('Planea'), breakX: 0, breakY: .36, sag: .22 },
  cae: { time: .86, label: locKey('Cae de golpe'), breakX: 0, breakY: -.46, sag: 0 },
  curva: { time: .98, label: locKey('Curva'), breakX: .55, breakY: -.08, sag: .05 },
};
export const PITCH_KINDS = Object.keys(PITCHES);
// The cap: a flat one floats true; a bent one wobbles and is hard to aim.
export const CAPS = {
  plana: { label: locKey('Plana'), wobble: .035, control: .025 },
  doblada: { label: locKey('Doblada'), wobble: .12, control: .085 },
};

// The street, in metres. The near street ends at the sidewalk (la acera);
// the cross street holds the parked car and the lamp post; the house fronts
// close it with the señora's window and the roofs above.
export const FIELD = {
  sideStreet: 4.6,       // |x| of the near street's house fronts (foul beyond)
  acera: 12.5,           // the far edge of the sidewalk: shorter is an out
  crossStreet: 8.6,      // |x| of the cross street's corners (foul beyond)
  wall: 26,              // the house fronts at the end of the street
  wallTop: 4.1,          // over it is the roof: ¡jonrón!
  car: { x0: -6.6, x1: -2.4, d0: 22, d1: 23.9, h: 1.55 },
  post: { x: 3.8, d: 24.6, r: .62, h: 5.6 },
  window: { x0: .7, x1: 2.3, y0: 1.3, y1: 2.6 },
  ball: .06,
};

// Where the fielders stand on the street: close to the sidewalk, mid street
// and deep by the houses.
export const FIELDERS = [
  { id: 'acera', label: locKey('la acera'), x: -2.4, d: 15.4 },
  { id: 'calle', label: locKey('media calle'), x: 2.9, d: 18.4 },
  { id: 'fondo', label: locKey('el fondo'), x: -.6, d: 22.4 },
];
export const REACH = { r: 1.55, y0: .25, y1: 2.6 };

// The final point of a pitch: aim, the cap's control error and its wobble.
export function pitchTarget(pitch) {
  const p = PITCHES[pitch.kind], side = pitch.kind === 'curva' ? pitch.side : 0;
  const end = wobbleAt(pitch, 1);
  return {
    x: COL_X[pitch.col] + pitch.miss[0] + p.breakX * side + end[0],
    y: ROW_Y[pitch.row] + pitch.miss[1] + p.breakY + end[1],
  };
}

function wobbleAt(pitch, u) {
  const w = pitch.wobble, s = Math.sin(Math.PI * 2 * w.f * u + w.ph) * w.a * Math.min(1, u * 1.6);
  return [s * Math.cos(w.tilt), s * Math.sin(w.tilt)];
}

// Where the chapita is at fraction u (0 release → 1 plate): a straight line to
// the aim, the break arriving late (u³), a float's sag and the wobble.
export function pitchPoint(pitch, u) {
  u = clamp(u, 0, 1.25);
  const p = PITCHES[pitch.kind], side = pitch.kind === 'curva' ? pitch.side : 0, wob = wobbleAt(pitch, u);
  const aimX = COL_X[pitch.col] + pitch.miss[0], aimY = ROW_Y[pitch.row] + pitch.miss[1], late = u ** 3;
  return {
    x: RELEASE.x + (aimX - RELEASE.x) * u + p.breakX * side * late + wob[0],
    y: RELEASE.y + (aimY - RELEASE.y) * u + p.breakY * late - p.sag * Math.sin(Math.PI * u) + wob[1],
    d: RELEASE.d * (1 - u),
  };
}

// The height band a pitch arrives in, or null when it misses the zone.
export function arrivalRow(target) {
  if (target.y < .32 || target.y > 1.82 || Math.abs(target.x) > .9) return null;
  return target.y > 1.21 ? 'alto' : target.y < .8 ? 'bajo' : 'medio';
}

// The batted chapita: from the bat at speed v (m/s), launch angle and the
// direction off the centre line (radians, + is screen right).
export function hitVelocity(v, launch, dir) {
  const flat = Math.cos(launch) * v;
  return { x: Math.sin(dir) * flat, y: Math.sin(launch) * v, d: Math.cos(dir) * flat };
}
export const GRAVITY = 9.8;
export function hitPoint(hit, t) {
  return { x: hit.from.x + hit.vel.x * t, y: hit.from.y + hit.vel.y * t - GRAVITY / 2 * t * t, d: hit.from.d + hit.vel.d * t };
}

// Walk the flight in small steps and report the first thing it meets:
// a fielder in reach (a chance to catch), then whatever ends the play.
// end.kind: short · sencillo · car · post · window · wall · jonron · foul.
export function traceHit(hit, fielders = FIELDERS) {
  const step = 1 / 120;
  let chance = null, prev = hitPoint(hit, 0);
  for (let t = step; t < 6; t += step) {
    const p = hitPoint(hit, t);
    if (!chance) {
      fielders.forEach((f, i) => {
        if (chance || p.y < REACH.y0 || p.y > REACH.y1 || Math.hypot(p.x - f.x, p.d - f.d) > REACH.r) return;
        const speed = Math.hypot(hit.vel.x, hit.vel.y - GRAVITY * t, hit.vel.d);
        chance = { fielder: i, t, point: p, speed };
      });
    }
    const end = (kind, at = p) => ({ kind, t, point: at, chance });
    // Side streets and the corners: foul.
    if (Math.abs(p.x) > (p.d < FIELD.acera ? FIELD.sideStreet : FIELD.crossStreet)) return end('foul');
    const c = FIELD.car;
    if (p.x > c.x0 && p.x < c.x1 && p.d > c.d0 && p.d < c.d1 && p.y < c.h) return end('car');
    const q = FIELD.post;
    if (p.y < q.h && Math.hypot(p.x - q.x, p.d - q.d) < q.r) return end('post');
    if (p.d >= FIELD.wall && prev.d < FIELD.wall) {
      const k = (FIELD.wall - prev.d) / (p.d - prev.d), y = prev.y + (p.y - prev.y) * k, x = prev.x + (p.x - prev.x) * k;
      const at = { x, y, d: FIELD.wall }, w = FIELD.window;
      if (y > FIELD.wallTop) return end('jonron', at);
      if (y > 0 && x > w.x0 && x < w.x1 && y > w.y0 && y < w.y1) return end('window', at);
      if (y > 0) return end('wall', at);
    }
    if (p.y <= 0) {
      const k = prev.y / (prev.y - p.y), at = { x: prev.x + (p.x - prev.x) * k, y: 0, d: prev.d + (p.d - prev.d) * k };
      return end(at.d < FIELD.acera ? 'short' : 'sencillo', at);
    }
    prev = p;
  }
  return { kind: 'jonron', t: 6, point: prev, chance };
}
