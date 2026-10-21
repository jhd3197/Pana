// Transform gates: a stretch of road the river has taken over. A car that
// splashes through the entry gate turns into a lancha mid-air — the car
// shrinks away inside a burst of spray and the Lancha game's peñero, with the
// racer's own pana at the tiller, pops up in its place, momentum untouched —
// and the exit gate turns it back. Tracks opt in with
// `transformGates: [{ from, to, sheet }]` (route fractions; `sheet: false`
// when the track already draws water there, like Chuao's quebrada); the road
// under the water stays the driving surface, so AI lines, checkpoints,
// rescues and placements never notice.
//
// Who is a boat is decided from position alone, every frame and for every
// car, remote ones included: online clients agree without a new message.
// Local presentation (slow-mo, stats) only fires for the local player, and
// the slow-mo never in an online race (slow-mo.js). On the water a drift
// charges a "wake turbo" faster, and skid marks / sparks give way to spray.
import * as THREE from 'three';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { createLancha } from '/engine/models/vehicles/lancha.js';
import { M, box, mesh } from '/engine/models/core/primitives.js';
import { statCount } from '/engine/stats.js';
import { shout } from '/engine/kit.js';

const MORPH_S = 0.7;           // seconds for the car → lancha swap (or back)
const BOAT_SCALE = 1.3;        // the peñero beside car-sized racers
const PREBUILD = 150;          // metres before a gate a car's lancha is built, hidden
const HOP = 6.5;               // m/s up as a car crosses a gate: it changes mid-air
const WAKE_CHARGE = 0.55;      // extra drift charge per second on the water
const WATER_LIFT = 0.32;       // the sheet sits this far over the road
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
    group.add(archAt(T, g.s0), archAt(T, g.s0 + g.len));
    if (g.sheet === false) continue;   // the track draws its own water here
    const points = [];
    for (let d = 0; d <= g.len; d += 4) { const p = T.pointAt(g.s0 + d); points.push([p.x, p.y]); }
    const height = (x, z) => T.heightAtS(T.paramOf(x, z)) + WATER_LIFT;
    const water = riverSurface(points, T.HW * 2 + 3, height, { color: 0x2f9fae, foam: () => 0.12 });
    water.name = 'transform-water';
    water.renderOrder = 2;
    group.add(water);
    if (water.userData.tick) ticks.push(water.userData.tick);
  }
  return { group, runs, tick: (t) => ticks.forEach(f => f(t)) };
}

export function createTransformGates({ race, sound, track }) {
  let runs = [];
  const inGate = c => !!(runs.length && !c.retired && gateAt(track(), runs, c.x, c.z, c.y));
  // Within PREBUILD metres before a gate (or in it): time to have a lancha ready.
  const nearGate = c => {
    const t = track();
    if (!runs.length || Math.abs(t.offsetOf(c.x, c.z, c.y)) > t.HW + 4) return false;
    const s = t.paramOf(c.x, c.z, c.y);
    return runs.some(g => (s - g.s0 + PREBUILD + t.TOTAL) % t.TOTAL < g.len + PREBUILD);
  };
  // Each car's lancha is the Lancha game's own model, painted in the car's
  // colour with the racer's pana aboard. It is built hidden on the approach
  // (so the crossing never hitches) and rides the car's tumble group, so
  // flips and tricks carry it. disposeRacer frees the car's driver; the
  // lancha piggybacks on that so it goes with the car.
  function lanchaFor(c) {
    if (c.car.lancha) return c.car.lancha;
    const paint = typeof c.cosmetics?.paint === 'string' && c.cosmetics.paint.startsWith('#') ? c.cosmetics.paint : c.def.color;
    const lancha = createLancha(c.avatar || {}, paint);
    lancha.group.position.y = -1 + 0.22;   // tumble space: the waterline just under the car's floor
    lancha.group.visible = false;
    lancha.group.scale.setScalar(0.001);
    c.car.tumble.add(lancha.group);
    const driver = c.car.driver, dispose = driver?.dispose;
    if (driver) driver.dispose = (...args) => { lancha.dispose(); return dispose?.apply(driver, args); };
    c.car.lancha = lancha;
    return lancha;
  }

  // The gate crossing: water rings, spray walls up both flanks and a flash.
  // The spray is thick enough to hide the moment the car becomes a boat.
  function splash(c, entering) {
    const at = new THREE.Vector3(c.x, c.y, c.z);
    race.shockwaves.ring(at, { color: 0xbff3ff, maxRadius: entering ? 9 : 6, life: 0.6, opacity: 0.95 });
    race.shockwaves.ring(at, { color: 0xffffff, startRadius: 1.2, maxRadius: 5, life: 0.4 });
    race.shockwaves.sparkle(new THREE.Vector3(c.x, c.y + 1.4, c.z), { color: entering ? 0x7fe8ff : 0xffe28a, count: 10, spread: 1.6, life: 0.5 });
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      race.puffs.spawn(new THREE.Vector3(c.x + rx * side * 1.8 + fx * (1 - i), c.y + 0.5, c.z + rz * side * 1.8 + fz * (1 - i)),
        { color: SPRAY[i % 3], count: entering ? 7 : 4, size: 1.1, rise: entering ? 5.5 : 3.5, life: 0.9, spread: 1.2 });
    }
    race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1.2, c.z), { color: SPRAY[0], count: entering ? 12 : 8, size: 1.4, rise: 2.5, life: 0.6, spread: 1.4 });
    if (c.isPlayer) {
      sound.plop(); sound.whoosh();
      race.shake = Math.min(1.2, (race.shake || 0) + (entering ? 0.6 : 0.35));
      shout(entering ? '¡Modo lancha!' : "¡Pa' tierra!");
      if (entering) {
        race.slowMo.trigger();
        statCount('derrape.metamorfosis', 1);
      }
    }
  }

  // The lancha settling onto the water: a second, flatter splash.
  function splashdown(c) {
    const at = new THREE.Vector3(c.x, c.y, c.z);
    race.shockwaves.ring(at, { color: 0xffffff, startRadius: 2, maxRadius: 7, life: 0.5, opacity: 0.8 });
    race.puffs.spawn(new THREE.Vector3(c.x, c.y + 0.4, c.z), { color: SPRAY[1], count: 10, size: 1, rise: 2.2, life: 0.7, spread: 2.4 });
    if (c.isPlayer) sound.plop();
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
    setTrack(t) {
      if (!t.def.transformGates?.length) { runs = []; return; }
      const built = buildGates(t);
      runs = built.runs;
      t.group?.add(built.group);
      t.animated.push({ userData: { tick: built.tick } });
    },
    get runs() { return runs; },
    // One physics step of a local car, after stepCar. Crossing a gate kicks
    // the car into a hop so the change happens mid-air (a trick still pays
    // there); on the water a drift charges a wake turbo faster than on asphalt.
    step(c, dt) {
      const inside = inGate(c);
      if (inside !== !!c.inGate) {
        c.inGate = inside;
        if (c.onGround && !c.done) { c.vy = inside ? HOP : HOP * 0.7; c.onGround = false; c.airTime = 0; c.hopping = false; }
      }
      if (c.boat && c.drift) c.driftT += dt * WAKE_CHARGE;
    },
    // Every drawn frame, every car (remote ones too): decide boat or car from
    // where it is, splash on the change, and play the swap.
    sync(c, dt) {
      if (!c.car.lancha && nearGate(c)) lanchaFor(c);
      const boat = inGate(c);
      if (boat !== !!c.boat) {
        c.boat = boat;
        splash(c, boat);
      }
      const want = c.boat ? 1 : 0;
      if (c.morph == null) c.morph = 0;
      if (c.morph === want && !c.boat) return;
      const was = c.morph;
      c.morph += Math.sign(want - c.morph) * Math.min(Math.abs(want - c.morph), dt / MORPH_S);
      if (was < 1 && c.morph === 1) splashdown(c);
      const k = c.morph, lancha = k > 0 ? lanchaFor(c) : c.car.lancha;
      // The car squashes away first; the lancha pops up behind it with an
      // elastic overshoot, stretching tall before it settles on the water.
      const carScale = Math.max(0.001, 1 - smooth(Math.min(1, k * 1.6)));
      c.car.chassis.scale.multiplyScalar(carScale);
      c.car.chassis.visible = carScale > 0.01;
      for (const w of c.car.wheels) w.steer.scale.setScalar(carScale);
      if (lancha) {
        const t = Math.max(0, (k - 0.3) / 0.7), grow = c.boat ? backOut(t) : smooth(t), stretch = Math.sin(t * Math.PI) * 0.3;
        lancha.group.visible = t > 0.01;
        lancha.group.scale.set(grow * (1 - stretch * 0.3) * BOAT_SCALE + 0.001, grow * (1 + stretch) * BOAT_SCALE + 0.001, grow * BOAT_SCALE + 0.001);
        if (lancha.group.visible) lancha.update(dt, { x: c.x, z: c.z, steer: c.steer || 0, throttle: 1, v: c.vf || 0,
          vy: c.vy || 0, air: c.onGround === false ? 1 : 0, turbo: c.boost || 0 }, race.clock);
      }
      if (c.boat && k > 0.5) wake(c, dt);
    },
  };
}

const smooth = t => t * t * (3 - 2 * t);

// Overshoots past 1 and settles back: the lancha "pops" up.
function backOut(k) {
  const a = 2.2, t = k - 1;
  return 1 + (a + 1) * t * t * t + a * t * t;
}
