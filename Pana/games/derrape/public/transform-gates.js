// Transform gates: a stretch of road the river has taken over. A car that
// hits the water turns into a lancha mid-air — the car
// shrinks away inside a burst of spray and the Lancha game's peñero, with the
// racer's own pana at the tiller, pops up in its place, momentum untouched —
// and leaving the water turns it back. Nothing marks the ends: the water is
// the cue. Tracks opt in with
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
import { statCount } from '/engine/stats.js';
import { shout } from '/engine/kit.js';
import { createParticleField } from './particles.js';

const MORPH_S = 0.7;           // seconds for the car → lancha swap (or back)
const BOAT_SCALE = 1.3;        // the peñero beside car-sized racers
const PREBUILD = 150;          // metres before a gate a car's lancha is built, hidden
const HOP = 6.5;               // m/s up as a car crosses a gate: it changes mid-air
const WAKE_CHARGE = 0.55;      // extra drift charge per second on the water
const WATER_LIFT = 0.32;       // the sheet sits this far over the road
const SPRAY = [0xffffff, 0xd8f4ff, 0x9fe3ef];
const DROPS = [0xffffff, 0xe6f8ff, 0xbfeaf5, 0x8fd6e8];   // droplet tints, foam to river

// Route gates in arc length, from the definition's fractions. A gate may
// name a world point instead (`fromAt: [x, z]`, e.g. a waterfall): it starts
// where the route passes closest to it, `lead` metres early.
export function gateRuns(T) {
  return (T.def.transformGates || []).map(g => {
    const s0 = g.fromAt ? T.nearest(g.fromAt[0], g.fromAt[1]).s - (g.lead ?? 0) : g.from * T.TOTAL, s1 = g.to * T.TOTAL;
    return { ...g, s0, len: ((s1 - s0) % T.TOTAL + T.TOTAL) % T.TOTAL };
  }).filter(g => g.len > 10);
}

// The gate a point sits in, or null. Off the road's edge never counts.
export function gateAt(T, runs, x, z, y) {
  if (!runs.length || Math.abs(T.offsetOf(x, z, y)) > T.HW + 1.5) return null;
  const s = T.paramOf(x, z, y);
  return runs.find(g => (s - g.s0 + T.TOTAL) % T.TOTAL < g.len) ?? null;
}

// Scenery for every gate: the water sheet over the road, unless the track
// already draws water there.
// Returns the group and a tick for the track's animated list.
export function buildGates(T) {
  const runs = gateRuns(T), group = new THREE.Group();
  group.name = 'transform-gates';
  const ticks = [];
  for (const g of runs) {
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
  // Water droplets: soft points with normal blending (they read as water,
  // not glow), one draw for every splash and rooster tail on the map.
  let drops = null;
  const dropField = () => drops ??= createParticleField(race.scene, { capacity: 1600, additive: false, core: 0.35, name: 'lancha-spray' });
  // A crown of droplets thrown out and up around (x, y, z), carried forward
  // with the car; `power` scales count, height and reach.
  function crown(c, power) {
    const field = dropField(), n = Math.round(90 * power), fx = Math.sin(c.h), fz = Math.cos(c.h), carry = 0.45 * (c.vf || 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, out = (3 + Math.random() * 6) * power, up = (4 + Math.random() * 7) * power;
      field.emit(c.x + Math.cos(a) * 1.4, c.y + 0.3, c.z + Math.sin(a) * 1.4,
        Math.cos(a) * out + fx * carry, up, Math.sin(a) * out + fz * carry,
        { color: DROPS[i % DROPS.length], size: 0.55, life: 0.9, gravity: 16, drag: 0.8 });
    }
  }
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

  // Hitting the water: a crown of droplets, two side curtains of spray and
  // rings on the surface. Thick enough to hide the moment the car becomes a
  // boat; a little mist puff sits in the middle of it.
  function splash(c, entering) {
    const at = new THREE.Vector3(c.x, c.y, c.z);
    race.shockwaves.ring(at, { color: 0xbff3ff, maxRadius: entering ? 9 : 6, life: 0.6, opacity: 0.8 });
    race.shockwaves.ring(at, { color: 0xffffff, startRadius: 1.2, maxRadius: 5, life: 0.4, opacity: 0.6 });
    crown(c, entering ? 1.3 : 0.8);
    const field = dropField(), fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h), carry = 0.6 * (c.vf || 0);
    for (const side of [-1, 1]) for (let i = 0; i < (entering ? 60 : 30); i++) {
      const along = (Math.random() - 0.3) * 3;
      field.emit(c.x + rx * side * 1.6 + fx * along, c.y + 0.3, c.z + rz * side * 1.6 + fz * along,
        rx * side * (5 + Math.random() * 5) + fx * carry, 6 + Math.random() * 8, rz * side * (5 + Math.random() * 5) + fz * carry,
        { color: DROPS[i % DROPS.length], size: 0.7, life: 1, gravity: 15, drag: 1 });
    }
    race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1.2, c.z), { color: SPRAY[0], count: entering ? 6 : 3, size: 1.6, rise: 2, life: 0.55, spread: 1.6 });
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

  // The lancha settling onto the water: a second, flatter crown.
  function splashdown(c) {
    race.shockwaves.ring(new THREE.Vector3(c.x, c.y, c.z), { color: 0xffffff, startRadius: 2, maxRadius: 7, life: 0.5, opacity: 0.7 });
    crown(c, 0.7);
    if (c.isPlayer) sound.plop();
  }

  // Rooster tail behind a moving boat: droplets thrown up and back off the
  // outboard; a drift fans them out to the side of the slide.
  function wake(c, dt) {
    const speed = Math.abs(c.vf || 0);
    if (speed < 6) return;
    c.wakeCarry = (c.wakeCarry || 0) + dt * (c.drift ? 170 : 110) * Math.min(1, speed / 25);
    const n = Math.floor(c.wakeCarry);
    c.wakeCarry -= n;
    const field = dropField(), fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
    const side = c.drift ? -Math.sign(c.drift) * 4 : 0, carry = 0.7 * speed;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 2.5, back = 2 + Math.random() * 4;
      field.emit(c.x - fx * 3.2, c.y + 0.4, c.z - fz * 3.2,
        fx * (carry - back) + rx * (spread + side), 3.5 + Math.random() * 4, fz * (carry - back) + rz * (spread + side),
        { color: DROPS[i % DROPS.length], size: 0.65, life: 0.8, gravity: 13, drag: 1.2 });
    }
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
