// Transform gates: a stretch of road the river has taken over. A car that
// splashes through the entry gate mutates into a lancha mid-stride — wheels
// tuck in, a peñero hull unfolds around it, momentum untouched — and the exit
// gate turns it back. Tracks opt in with `transformGates: [{ from, to }]`
// (route fractions); the road under the water stays the driving surface, so
// AI lines, checkpoints, rescues and placements never notice.
//
// Who is a boat is decided from position alone, every frame and for every
// car, remote ones included: online clients agree without a new message.
// Local presentation (slow-mo, stats) only fires for the local player, and
// the slow-mo never in an online race (slow-mo.js). On the water a drift
// charges a "wake turbo" faster, and skid marks / sparks give way to spray.
import * as THREE from 'three';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { createLanchaHull } from '/engine/models/vehicles/lancha.js';
import { M, box, mesh } from '/engine/models/core/primitives.js';
import { statCount } from '/engine/stats.js';

const MORPH_S = 0.38;          // seconds for the hull to unfold (or fold away)
const WAKE_CHARGE = 0.55;      // extra drift charge per second on the water
const WATER_LIFT = 0.32;       // the sheet sits this far over the road
const HULL = '#f4f1e6';     // a white peñero; the team colour rides the stripe, pennant and motor
const SPRAY = [0xffffff, 0xd8f4ff, 0x9fe3ef];
// Venezuelan tricolour bands on the gate posts.
const BANDS = [0xffcc1a, 0x1f5fbf, 0xd8262f];

// Route gates in arc length, from the definition's fractions.
export function gateRuns(T) {
  return (T.def.transformGates || []).map(g => {
    const s0 = g.from * T.TOTAL, s1 = g.to * T.TOTAL;
    return { ...g, s0, len: ((s1 - s0) % T.TOTAL + T.TOTAL) % T.TOTAL };
  }).filter(g => g.len > 10);
}

// The gate a point sits in, or null. Off the road's edge never counts.
export function gateAt(T, runs, x, z, y) {
  if (!runs.length || Math.abs(T.offsetOf(x, z, y)) > T.HW + 1.5) return null;
  const s = T.paramOf(x, z, y);
  return runs.find(g => (s - g.s0 + T.TOTAL) % T.TOTAL < g.len) ?? null;
}

function postWith(height, x, z) {
  const g = new THREE.Group();
  const band = height / BANDS.length;
  BANDS.forEach((color, i) => g.add(box(0.7, band, 0.7, M(color, { roughness: 0.5 }), 0, band * (i + 0.5), 0)));
  g.position.set(x, 0, z);
  return g;
}

// A splash arch across the road at arc length s: two tricolour posts, a
// beam, and a row of buoys hanging from it.
function archAt(T, s) {
  const p = T.pointAt(s), q = T.pointAt(s + 1), h = Math.atan2(q.x - p.x, q.y - p.y);
  const arch = new THREE.Group(), span = T.HW + 1.2, height = 6.2;
  arch.add(postWith(height, -span, 0), postWith(height, span, 0));
  arch.add(box(span * 2 + 0.7, 0.55, 0.55, M(0xf3e5c3, { roughness: 0.6 }), 0, height + 0.2, 0));
  const buoy = new THREE.SphereGeometry(0.32, 10, 8);
  for (let i = 0; i < 7; i++) arch.add(mesh(buoy, M(i % 2 ? 0xffffff : 0xff6a2b, { roughness: 0.4 }), (i / 6 - 0.5) * span * 1.7, height - 0.45, 0));
  arch.position.set(p.x, T.heightAtS(s), p.y);
  arch.rotation.y = h;
  arch.name = 'transform-gate';
  return arch;
}

// Scenery for every gate: the water sheet over the road and both arches.
// Returns the group and a tick for the track's animated list.
export function buildGates(T) {
  const runs = gateRuns(T), group = new THREE.Group();
  group.name = 'transform-gates';
  const ticks = [];
  for (const g of runs) {
    const points = [];
    for (let d = 0; d <= g.len; d += 4) { const p = T.pointAt(g.s0 + d); points.push([p.x, p.y]); }
    const height = (x, z) => T.heightAtS(T.paramOf(x, z)) + WATER_LIFT;
    const water = riverSurface(points, T.HW * 2 + 3, height, { color: 0x2f9fae, foam: () => 0.12 });
    water.name = 'transform-water';
    water.renderOrder = 2;
    group.add(water, archAt(T, g.s0), archAt(T, g.s0 + g.len));
    if (water.userData.tick) ticks.push(water.userData.tick);
  }
  return { group, runs, tick: (t) => ticks.forEach(f => f(t)) };
}

export function createTransformGates({ race, sound, track }) {
  let runs = [];
  const hulls = new Set();
  const own = (c, geometry) => {
    const list = c.car.geometries;
    if (list?.add) list.add(geometry); else list?.push?.(geometry);
  };
  // The hull is built the first time a car hits the water and lives on its
  // tumble group, so flips and tricks carry it; its geometry joins the car's
  // own list, so disposeRacer frees it with the car.
  function hullFor(c) {
    if (c.car.lanchaHull) return c.car.lanchaHull;
    const hull = createLanchaHull(c.def.color, { open: true, body: HULL });
    hull.traverse(o => { if (o.geometry) own(c, o.geometry); });
    hull.scale.setScalar(0.001);
    hull.position.y = -0.85;
    hull.visible = false;
    c.car.tumble.add(hull);
    c.car.lanchaHull = hull;
    hulls.add(hull);
    return hull;
  }

  function splash(c, entering) {
    const at = new THREE.Vector3(c.x, c.y, c.z);
    race.shockwaves.ring(at, { color: 0xbff3ff, maxRadius: entering ? 7.5 : 5, life: 0.55, opacity: 0.9 });
    race.shockwaves.ring(at, { color: 0xffffff, startRadius: 1.2, maxRadius: 4.5, life: 0.35 });
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    for (let i = 0; i < 3; i++) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * (1 + i), c.y + 0.6, c.z - fz * (1 + i)),
        { color: SPRAY[i], count: entering ? 6 : 4, size: 0.9, rise: 3.4, life: 0.7, spread: 1.6 });
    }
    if (c.isPlayer) {
      sound.plop(); sound.whoosh();
      race.shake = Math.min(1.2, (race.shake || 0) + (entering ? 0.5 : 0.3));
      if (entering) {
        race.slowMo.trigger();
        statCount('derrape.metamorfosis', 1);
      }
    }
  }

  // Rooster tail behind a boat that is moving.
  function wake(c, dt) {
    c.wakeT = (c.wakeT || 0) - dt;
    if (c.wakeT > 0 || Math.abs(c.vf || 0) < 6) return;
    c.wakeT = c.drift ? 0.04 : 0.07;
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
    const side = c.drift ? -Math.sign(c.drift) : 0;
    race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.6 + rx * side * 1.2, c.y + 0.35, c.z - fz * 2.6 + rz * side * 1.2),
      { color: c.drift ? SPRAY[2] : SPRAY[0], count: c.drift ? 2 : 1, size: 0.55, rise: 1.8, life: 0.45, spread: 0.5 });
  }

  return {
    // A new track: the scenery goes into its group and its tick into the
    // animated list. Cars of the previous race are already gone.
    setTrack(T) {
      hulls.clear();
      if (!T.def.transformGates?.length) { runs = []; return; }
      const built = buildGates(T);
      runs = built.runs;
      T.group?.add(built.group);
      T.animated.push({ userData: { tick: built.tick } });
    },
    get runs() { return runs; },
    // One physics step of a local car, after stepCar: on the water a drift
    // charges a wake turbo faster than on asphalt.
    step(c, dt) {
      if (c.boat && c.drift) c.driftT += dt * WAKE_CHARGE;
    },
    // Every drawn frame, every car (remote ones too): decide boat or car from
    // where it is, splash on the change, and play the morph.
    sync(c, dt) {
      const T = track();
      const boat = !!(runs.length && !c.retired && gateAt(T, runs, c.x, c.z, c.y));
      if (boat !== !!c.boat) {
        c.boat = boat;
        splash(c, boat);
      }
      const want = c.boat ? 1 : 0;
      if (c.morph == null) c.morph = 0;
      if (c.morph === want && !c.boat) return;
      c.morph += Math.sign(want - c.morph) * Math.min(Math.abs(want - c.morph), dt / MORPH_S);
      const k = c.morph, hull = k > 0 ? hullFor(c) : c.car.lanchaHull;
      // Squash-stretch overshoot while unfolding; wheels tuck away under it.
      const pop = Math.sin(Math.min(1, k) * Math.PI) * 0.22;
      if (hull) {
        hull.visible = k > 0.01;
        hull.scale.set(1.55 * k + pop * 0.5, 1.15 * k * (1 - pop * 0.6) + 0.001, 1.08 * k + pop * 0.3);
      }
      for (const w of c.car.wheels) w.steer.scale.setScalar(Math.max(0.001, 1 - k));
      if (c.boat) {
        // Riding the water: a gentle bob and roll on top of the suspension.
        const t = race.clock + (c.def.num || 0);
        c.car.chassis.position.y += 0.18 * k + Math.sin(t * 3.1) * 0.05;
        c.car.chassis.rotation.z += Math.sin(t * 2.3) * 0.04;
        if (hull) hull.userData.motor.userData.prop.rotation.z += dt * 40;
        wake(c, dt);
      }
    },
    // A finished race leaves every car a car again.
    reset() { for (const hull of hulls) hull.visible = false; },
  };
}
