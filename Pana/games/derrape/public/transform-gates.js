// Transform gates: a stretch of road the river has taken over. A car that
// hits the water turns into a lancha mid-air — the car
// shrinks away inside a burst of spray and the Lancha game's peñero, with the
// racer's own pana at the tiller, pops up in its place, momentum untouched —
// and leaving the water turns it back. Nothing marks the ends: the water is
// the cue. Tracks opt in with
// `transformGates: [{ from, to, sheet }]` (route fractions; `sheet: false`
// when the track already draws water there, like Chuao's quebrada); the road
// under the water stays the driving surface, so AI lines, checkpoints,
// rescues and placements never notice. An `open: true` gate is a lagoon
// instead (course-rules.js, openWater): no road and no walls, boats steer anywhere afloat,
// bounce off the banks, the boats on the water and their wakes.
//
// A `fly: true` gate is the air: at a cliff the car pops into a little plane
// (an avioneta in the racer's paint, own pana in the cockpit) and flies
// up to FLY_LIFT over the road for the stretch, then lands back as a car
// with a short turbo. Only the drawing rises; the road under it stays the
// driving surface, so the controls are the same.
//
// Who is a boat is decided from position alone, every frame and for every
// car, remote ones included: online clients agree without a new message.
// Local presentation (slow-mo, stats) only fires for the local player, and
// the slow-mo never in an online race (slow-mo.js). On the water a drift
// charges a "wake turbo" faster, and skid marks / sparks give way to spray.
import * as THREE from 'three';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { createLancha } from '/engine/models/vehicles/lancha.js';
import { createAvioneta } from '/engine/models/vehicles/avioneta.js';
import { statCount } from '/engine/stats.js';
import { shout } from '/engine/kit.js';
import { createParticleField } from './particles.js';
import { syncGhostAppearance } from './racer-render.js';
import { isGhost, recordImpact } from './recovery-rules.js';
import { gateRuns, keepAfloat, bumpObstacle, inWake } from './course-rules.js';

export { gateRuns };

const MORPH_S = 0.7;           // seconds for the car → lancha swap (or back)
const BOAT_SCALE = 1.3;        // the peñero beside car-sized racers
const PREBUILD = 150;          // metres before a gate a car's lancha is built, hidden
const HOP = 6.5;               // m/s up as a car crosses a gate: it changes mid-air
const WAKE_CHARGE = 0.55;      // extra drift charge per second on the water
const WATER_LIFT = 0.32;       // the sheet sits this far over the road
const WAKE_HOP = 5.5;          // m/s up when a boat crosses another boat's wake
const BUMP_HARD = 6;           // m/s into a boat or a bank that counts as a crash
const FLY_LIFT = 16;           // metres the plane flies over the road
const FLY_RAMP = 50;           // metres to climb at a flight gate's start and settle at its end
const FLY_TURBO = 1.2;         // seconds of turbo for touching down
const PLANE_SCALE = 1.5;       // the avioneta beside car-sized racers
const SPRAY = [0xffffff, 0xd8f4ff, 0x9fe3ef];
const DUST = [0xfff2d0, 0xffe0a8, 0xffffff];
const DROPS = [0xffffff, 0xe6f8ff, 0xbfeaf5, 0x8fd6e8];   // droplet tints, foam to river

// The gate a point sits in, or null. Off the road's edge never counts.
export function gateAt(T, runs, x, z, y) {
  if (!runs.length) return null;
  if (T.openWater?.surfaceAt(x, z, y) != null) return runs.find(g => g.open) ?? null;
  if (Math.abs(T.offsetOf(x, z, y)) > T.HW + 1.5) return null;
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
    if (g.sheet === false || g.open || g.fly) continue;   // the track draws its own water here, or it is a cliff
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
  const gateOf = c => (runs.length && !c.retired && gateAt(track(), runs, c.x, c.z, c.y)) || null;
  const inGate = c => !!gateOf(c);
  // Within PREBUILD metres before a gate (or in it): time to have its vessel ready.
  const nearGate = c => {
    const t = track();
    if (runs.length && t.openWater?.surfaceAt(c.x, c.z, c.y) != null) return runs.find(g => g.open) ?? null;
    if (!runs.length || Math.abs(t.offsetOf(c.x, c.z, c.y)) > t.HW + 4) return null;
    const s = t.paramOf(c.x, c.z, c.y);
    return runs.find(g => (s - g.s0 + PREBUILD + t.TOTAL) % t.TOTAL < g.len + PREBUILD) ?? null;
  };
  // Metres into a flight gate, wrapped round the lap.
  const alongGate = (c, g) => { const t = track(); return ((t.paramOf(c.x, c.z, c.y) - g.s0) % t.TOTAL + t.TOTAL) % t.TOTAL; };
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
    if (isGhost(c)) { c.ghostVisible = false; syncGhostAppearance(c); }   // the replay's lancha is translucent too
    const driver = c.car.driver, dispose = driver?.dispose;
    if (driver) driver.dispose = (...args) => { lancha.dispose(); return dispose?.apply(driver, args); };
    c.car.lancha = lancha;
    return lancha;
  }
  // The same for a flight gate: an avioneta, origin under its wheels,
  // riding the tumble group like the lancha.
  function planeFor(c) {
    if (c.car.plane) return c.car.plane;
    const paint = typeof c.cosmetics?.paint === 'string' && c.cosmetics.paint.startsWith('#') ? c.cosmetics.paint : c.def.color;
    const plane = createAvioneta(c.avatar || {}, paint);
    plane.group.position.y = -1;   // tumble space: the wheels where the car's were
    plane.group.visible = false;
    plane.group.scale.setScalar(0.001);
    c.car.tumble.add(plane.group);
    if (isGhost(c)) { c.ghostVisible = false; syncGhostAppearance(c); }
    const driver = c.car.driver, dispose = driver?.dispose;
    if (driver) driver.dispose = (...args) => { plane.dispose(); return dispose?.apply(driver, args); };
    c.car.plane = plane;
    return plane;
  }

  // Leaving the cliff: a puff of dust and a gust of wind instead of spray.
  function takeoff(c, entering) {
    const at = new THREE.Vector3(c.x, c.y + (c.flyLift || 0), c.z);
    race.shockwaves.ring(at, { color: 0xfff2d0, maxRadius: entering ? 8 : 5, life: 0.5, opacity: 0.7 });
    race.puffs.spawn(at.clone().setY(c.y + 0.6), { color: DUST[0], count: entering ? 8 : 6, size: 1.4, rise: 1.5, life: 0.6, spread: 1.8 });
    if (!c.isPlayer) return;
    sound.whoosh();
    race.shake = Math.min(1.2, (race.shake || 0) + (entering ? 0.4 : 0.3));
    shout(entering ? '¡Modo avioneta!' : '¡Aterrizaje!');
    if (entering) { race.slowMo.trigger(); statCount('derrape.metamorfosis', 1); } else sound.turbo();
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

  // A boat hitting a bank or another boat: spray, a bonk, a shake.
  function knock(c, speed) {
    if (speed < BUMP_HARD || isGhost(c)) return;
    crown(c, 0.5);
    c.drift = 0; c.driftT = 0;
    if (c.isPlayer) { sound.bonk(speed / 10); race.shake = Math.min(1, (race.shake || 0) + 0.25); }
    recordImpact(c, race.clock);
  }

  // The car squashes away as for a lancha; the plane pops up wide first,
  // then settles, and banks with the steering.
  function morphPlane(c, k, dt) {
    const carScale = Math.max(0.001, 1 - smooth(Math.min(1, k * 1.6)));
    c.car.chassis.scale.multiplyScalar(carScale);
    c.car.chassis.visible = carScale > 0.01;
    for (const w of c.car.wheels) w.steer.scale.setScalar(carScale);
    const plane = k > 0 ? planeFor(c) : c.car.plane;
    if (!plane) return;
    const t = Math.max(0, (k - 0.3) / 0.7), grow = c.plane ? backOut(t) : smooth(t);
    plane.group.visible = t > 0.01;
    plane.group.scale.set(grow * PLANE_SCALE + 0.001, smooth(t) * PLANE_SCALE + 0.001, grow * PLANE_SCALE + 0.001);
    if (plane.group.visible) plane.update(dt, { steer: c.steer || 0, v: c.vf || 0, vy: 0, boost: c.boost || 0 }, race.clock);
  }

  return {
    // A new track: the scenery goes into its group and its tick into the
    // animated list. Cars of the previous race are already gone. Open water
    // holds boats inside its banks (after the track's own constraint).
    setTrack(t) {
      if (!t.def.transformGates?.length) { runs = []; return; }
      const built = buildGates(t);
      runs = built.runs;
      t.group?.add(built.group);
      t.animated.push({ userData: { tick: built.tick } });
      if (t.openWater) {
        const own = t.constrainMotion;
        t.constrainMotion = (c, previous) => { own?.(c, previous); knock(c, keepAfloat(t.openWater, t, c, previous)); };
      }
    },
    get runs() { return runs; },
    // One physics step of a local car, after stepCar. Crossing a gate kicks
    // the car into a hop so the change happens mid-air (a trick still pays
    // there); on the water a drift charges a wake turbo faster than on asphalt.
    step(c, dt) {
      const gate = gateOf(c), inside = !!gate;
      if (inside !== !!c.inGate) {
        // Touching down off a flight pays a short turbo.
        if (!inside && c.gateFly && !c.done) c.boost = Math.max(c.boost || 0, FLY_TURBO);
        c.inGate = inside; c.gateFly = !!gate?.fly;
        if (c.onGround && !c.done) { c.vy = inside ? HOP : HOP * 0.7; c.onGround = false; c.airTime = 0; c.hopping = false; }
      }
      if (c.boat && c.drift) c.driftT += dt * WAKE_CHARGE;
      // Boats on open water: solid hulls, and wakes that throw you up.
      const t = track();
      if (!c.boat || !t.openWater || !t.waterObstacles?.length) return;
      c.wakeT = Math.max(0, (c.wakeT || 0) - dt);
      for (const list of t.waterObstacles) for (const o of list()) {
        const hit = bumpObstacle(c, o);
        if (hit) {   // stepCar drives from vf/vr: carry the bounce into them
          const fx = Math.sin(c.h), fz = Math.cos(c.h);
          c.vf = c.vx * fx + c.vz * fz; c.vr = -c.vx * fz + c.vz * fx;
          knock(c, hit);
        }
        if (c.onGround && !c.wakeT && inWake(c, o)) {
          c.vy = WAKE_HOP; c.onGround = false; c.airTime = 0; c.wakeT = 0.8;
          if (c.isPlayer) sound.plop();
        }
      }
    },
    // Every drawn frame, every car (remote ones too): decide boat or car from
    // where it is, splash on the change, and play the swap.
    sync(c, dt) {
      const near = nearGate(c);
      if (near?.fly ? !c.car.plane : near && !c.car.lancha) near.fly ? planeFor(c) : lanchaFor(c);
      const gate = gateOf(c), boat = !!gate && !gate.fly, flying = !!gate?.fly;
      if (boat !== !!c.boat) {
        c.boat = boat;
        splash(c, boat);
      }
      if (flying !== !!c.plane) {
        c.plane = flying;
        takeoff(c, flying);
      }
      if (c.boat || c.plane) c.vessel = c.plane ? 'plane' : 'boat';
      // The plane climbs off the lip, flies over the road and settles at the end.
      const lift = flying ? FLY_LIFT * smooth(Math.min(1, alongGate(c, gate) / FLY_RAMP)) * smooth(Math.min(1, (gate.len - alongGate(c, gate)) / FLY_RAMP)) : 0;
      c.flyLift = (c.flyLift || 0) + (lift - (c.flyLift || 0)) * Math.min(1, dt * 6);
      if (c.flyLift > 0.01) c.car.root.position.y += c.flyLift; else c.flyLift = 0;
      const want = c.boat || c.plane ? 1 : 0;
      if (c.morph == null) c.morph = 0;
      if (c.morph === want && !c.boat && !c.plane) return;
      const was = c.morph;
      c.morph += Math.sign(want - c.morph) * Math.min(Math.abs(want - c.morph), dt / MORPH_S);
      if (was < 1 && c.morph === 1 && c.boat) splashdown(c);
      const k = c.morph;
      if (c.vessel === 'plane') return morphPlane(c, k, dt);
      const lancha = k > 0 ? lanchaFor(c) : c.car.lancha;
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
