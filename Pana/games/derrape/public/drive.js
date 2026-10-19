// One car's driving for one physics step: engine, grip, drift, jumps, ramps,
// laps and the off-course and stuck timers. game.js owns the race; this owns
// how a car moves through it.
import * as THREE from 'three';
import { sound } from '/engine/fx.js';
import { pick } from '/engine/random.js';
import { roughnessAt, roadGripAt, roadWaterAt } from './offroad.js';
import { coinMultiplier } from './item-rules.js';
import { DRIFT_MIN_SPEED, DRIFT_BOOST, HOP_SPEED, DRIFT_EXIT_TIME, driftLevel, driftSteer, assistDrift, driftCharge, trickBoost } from './drive-rules.js';
import { wrapAngle } from './rules.js';
import { advanceLap, isOpenEdge, offCourse, stuckStep, OPEN_MARGIN } from './course-rules.js';
import { isGhost, recordImpact } from './recovery-rules.js';

export const G = 30;   // cartoon gravity: snappy jumps

// track(): the active track runtime. say, popPart, progressOf and flameFor are
// game.js's; lines are the racers' speech lines; auto drives the player too.
export function createDriver({ race, track, say, popPart, progressOf, flameFor, lines: LINES, auto: AUTO }) {
  const pointAt = (s) => track().pointAt(s);
  const paramOf = (x, z, y) => track().paramOf(x, z, y);
  const offsetOf = (x, z, y) => track().offsetOf(x, z, y);
  const groundAt = (x, z, y) => track().groundAt(x, z, y);

  function stepCar(c, input, dt) {
      const T = track();
    const t = c.tune;   // car tune composed with the racer's cauchos (makeRacer)
    const boosting = c.boost > 0;
    // Under an aguacero cloud the car is slower and slides, less so on rain cauchos.
    const rained = c.cloud > 0 ? (t.wetFloor >= 0.5 ? 0.93 : 0.74) : 1;
    const wetGrip = (c.onGround ? roadGripAt(T,c.x,c.z,race.clock) : 1) * (1-(T.def.rain||0)*.4);
    const wet = 1 - wetGrip;
    const top = t.top * c.skill * (c.band || 1) * coinMultiplier(c) * rained * (1 - wet * t.wetDrag);
    const terrain=T.def.offroad;
    // Wheel off-road resistance scales every roughness penalty below (accel,
    // speed cap, drag); slicks go negative and make rough ground worse.
    const rough=(c.onGround?roughnessAt(T,c.x,c.z):0)*(1-t.offroadResist);
    const water=c.onGround?roadWaterAt(T,c.x,c.z,race.clock):0;
    // Rain cauchos keep a grip floor where the road reports wet.
    // Rain (and an aguacero cloud) cut grip; rain cauchos keep a floor.
    const grip=Math.max(wetGrip*(c.cloud>0?.55:1),t.wetFloor);
    const waterDrag = 1 - t.wetFloor * 0.65;
    const acceleration=t.accel*(1-rough*(1-(terrain?.accel??1)))*(1-water*.28*waterDrag);
    const previous={x:c.x,z:c.z};
    if (c.spin > 0) input = { throttle: 0, steer: 0 };   // skidding on a peel: no control
    if (c.stall > 0) { c.stall -= dt; input = { ...input, throttle: 0 }; }   // flooded engine after a jumped start
    // A short entry hop; keep holding and turn whenever ready after landing.
    // In the air after a ramp the same button is still a trick.
    const held = !!input.drift;
    c.driftExitT = Math.max(0, (c.driftExitT || 0) - dt);
    c.driftAssist = 0;
    if (held && !c.driftHeld && c.spin <= 0) {
      if (c.onGround && c.vf > 4) {
        c.vy = HOP_SPEED; c.onGround = false; c.airTime = 0; c.hopping = true;
      } else if (!c.onGround && !c.hopping && !c.trick && c.airTime > 0.06) {
        c.trick = true; c.trickT = 0;
        if (c.isPlayer) sound.tone(660, 0, 0.09, 'triangle', 0.1);
      }
    }
    c.driftHeld = held;
    if (!c.drift && held && c.onGround && Math.abs(input.steer) > 0.2 && c.vf > DRIFT_MIN_SPEED && c.spin <= 0 && c.stall <= 0) {
      c.drift = Math.sign(input.steer); c.driftT = 0;
      c.driftExitT = 0;
      c.driftLane = Math.max(-T.HW * 0.3, Math.min(T.HW * 0.3, offsetOf(c.x, c.z, c.y)));
      if (c.isPlayer) sound.skid(0.8);
    }
    if (c.drift && (!held || c.vf < DRIFT_MIN_SPEED * 0.75 || c.spin > 0)) {
      // Letting go pays the charged turbo; a spin-out or stall loses it.
      const level = driftLevel(c.driftT);
      if (!held && level && c.spin <= 0) {
        c.boost = Math.max(c.boost, DRIFT_BOOST[level] * t.driftBoost);
        if (c.isPlayer) sound.turbo();
      }
      if (!held && c.spin <= 0) c.driftExitT = DRIFT_EXIT_TIME;
      c.drift = 0; c.driftT = 0;
    }
    let fx = Math.sin(c.h), fz = Math.cos(c.h);
    let rx = -Math.cos(c.h), rz = Math.sin(c.h);
    let vf = c.vx * fx + c.vz * fz;
    let vr = c.vx * rx + c.vz * rz;
    const prevVf = vf;

    if (c.onGround) {
      if (boosting) vf += acceleration * 2.5 * dt;
      else if (input.throttle > 0) vf += acceleration * input.throttle * dt;
      else if (input.throttle < 0) {
        if (c.isPlayer && vf > 12 && (!c.skidT || race.clock - c.skidT > 0.38)) {
          c.skidT = race.clock;
          sound.skid(0.6);
        }
        vf -= (vf > 0 ? t.accel * 2.2 * (.75+.25*grip) : acceleration * 0.6) * dt;
      }
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
      // a turbo lifts the cap; when it ends the extra speed bleeds off instead of snapping
      // Shortcut planks are bumpy: without a turbo they cost speed.
      const onPlank = T.shortcuts.length > 0 && !boosting && T.plankAt(c.x, c.z) != null;
      const surfaceTop=top*(1-rough*(1-(terrain?.speed??1)))*(onPlank ? 0.72 : 1);
      // Rough ground bleeds speed progressively; turbo still helps but cannot
      // cancel the terrain penalty and turn the grass into the fastest route.
      const cap = rough>0||onPlank?Math.max(surfaceTop*(boosting?1.5:1),prevVf-48*dt):boosting?top*1.5:Math.max(top,prevVf-20*dt);
      vf = Math.max(-surfaceTop * 0.4, Math.min(cap, vf));
      vf*=Math.exp(-rough*(terrain?.drag??0)*dt);
      vf*=Math.exp(-water*.7*waterDrag*dt); // rain tires displace shallow water better
      // A drift loosens the rear: less lateral grip, so the car slides outward.
      vr *= Math.exp(-t.grip * grip * (c.drift ? 0.62 : c.driftExitT > 0 ? 1.8 : 1) * dt);
      const turnScale = t.turn * Math.max(-1, Math.min(1, vf / 10)) * (1 - Math.abs(vf) / top * 0.3);
      let steerIn = c.drift ? driftSteer(c.drift, input.steer) : input.steer;
      let cornering = false;
      if ((c.drift || c.driftExitT > 0) && vf > DRIFT_MIN_SPEED * 0.75 && race.mode !== 'battle'
        && Math.abs(offsetOf(c.x, c.z, c.y)) < T.HW && T.plankAt(c.x, c.z) == null) {
        const s = paramOf(c.x, c.z, c.y), here = pointAt(s), ahead = pointAt(s + 1);
        const roadHeading = Math.atan2(ahead.x - here.x, ahead.y - here.y);
        // Wrong-way driving, shortcuts, real jumps and off-road terrain stay manual.
        if (Math.cos(c.h - roadHeading) > 0.35) {
          const look = 12 + vf * 0.45, aim = pointAt(s + look), next = pointAt(s + look + 1);
          const angle = Math.atan2(next.x - aim.x, next.y - aim.y);
          // Steering chooses a tighter/wider line even during a strong correction.
          const lane = Math.max(-T.HW * 0.42, Math.min(T.HW * 0.42, (c.driftLane || 0) - input.steer * T.HW * 0.22));
          cornering = c.drift * wrapAngle(angle - roadHeading) > 0.035;
          const aimError = wrapAngle(Math.atan2(aim.x - Math.cos(angle) * lane - c.x, aim.y + Math.sin(angle) * lane - c.z) - c.h);
          const projectedHeading = c.h + steerIn * turnScale * 0.3;
          const projectedOffset = offsetOf(c.x + Math.sin(projectedHeading) * vf * 0.55, c.z + Math.cos(projectedHeading) * vf * 0.55,c.y);
          const assist = assistDrift(steerIn, aimError, projectedOffset, T.HW, turnScale);
          steerIn = assist.steer; c.driftAssist = assist.amount;
        }
      }
      c.steer += (steerIn - c.steer) * Math.min(1, dt * (c.driftExitT > 0 ? 18 : c.driftAssist > 0.3 ? 12 : 8));
      const turn = c.steer * turnScale;
      if (c.drift) {
        // Charge real cornering, not a held button on an assisted straight.
        if (cornering || turn * c.drift > 0.18) c.driftT += dt * driftCharge(c.drift, input.steer) * t.driftCharge;
        c.driftLvl = driftLevel(c.driftT);
      }
      c.h += turn * dt;
      c.latAcc = turn * vf;
    } else {
      c.steer += (input.steer - c.steer) * Math.min(1, dt * 3);
      c.h += c.steer * 0.6 * dt;             // a little air control
      c.latAcc = 0;
    }
    c.longAcc = (vf - prevVf) / dt;
    fx = Math.sin(c.h); fz = Math.cos(c.h);
    rx = -Math.cos(c.h); rz = Math.sin(c.h);
    c.vx = fx * vf + rx * vr;
    c.vz = fz * vf + rz * vr;
    c.vf = vf;
    c.vr = vr;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    T.constrainMotion?.(c,previous);
    c.vf=c.vx*fx+c.vz*fz;c.vr=c.vx*rx+c.vz*rz;

    // ---- vertical: ramps, jumps, tumbles ----
    const g = groundAt(c.x, c.z, c.y);
    if (c.onGround) {
      const previousGround=terrain&&Math.abs(offsetOf(previous.x,previous.z))>T.HW?groundAt(previous.x,previous.z):T.surfaceAt(previous.x,previous.z,c.y);
      const followingTerrain = Math.abs(c.y-previousGround)<0.15;
      if (g >= c.y - 0.08 || (followingTerrain && Math.abs(g - c.y) < 1.2)) {
        c.vy = (g - c.y) / dt;
        c.y = g;
        const ahead = groundAt(c.x + fx, c.z + fz,c.y), behind = groundAt(c.x - fx, c.z - fz,c.y);
        c.pitch += (-Math.atan2(ahead - behind, 2) - c.pitch) * Math.min(1, dt * 12);
        c.roll += (0 - c.roll) * Math.min(1, dt * 10);
      } else {
        c.onGround = false;   // drove off the ramp lip: fly!
        c.airTime = 0;
      }
    }
    if (!c.onGround) {
      c.airTime += dt;
      c.vy -= G * dt;
      c.y += c.vy * dt;
      c.pitch += c.pitchV * dt + 0.25 * dt;   // nose slowly drops
      c.roll += c.rollV * dt;
      if (c.airTime > 0.45 && c.scream <= 0 && c.y > 1.2) {
        c.scream = 0.8;
        say(c, LINES.air, 0.9);
      }
      if (c.y <= g) {
        c.y = g;
        const impact = -c.vy;
        const upright = Math.abs(wrapAngle(c.roll)) < 0.7 && Math.abs(wrapAngle(c.pitch)) < 0.7;
        if (upright) {
          c.onGround = true;
          c.vy = 0;
          c.roll = wrapAngle(c.roll);
          c.pitch = wrapAngle(c.pitch);
          c.rollV = c.pitchV = 0;
          c.heave.v -= impact * 0.5;
          if (c.hopping) c.hopping = false;
          if (c.trick) {
            const bonus = trickBoost(c.airTime, true) * (t.trickBoost ?? 1);
            if (bonus) {
              c.boost = Math.max(c.boost, bonus);
              say(c, LINES.trick, 0.9);
              if (c.isPlayer) sound.turbo();
            }
            c.trick = false;
          }
          if (impact > 9) {
            sound.boing();
            race.puffs.spawn(new THREE.Vector3(c.x, 0.2, c.z), { color: 0xe0b07a, count: 6, spread: 2.5, rise: 0.8 });
            if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.25);
          }
        } else {
          // cartoon bounce that sets the car back on its wheels
          c.trick = false; c.hopping = false; c.drift = 0; c.driftT = 0;
          sound.bonk(1.2);
          race.puffs.spawn(new THREE.Vector3(c.x, g + 0.3, c.z), { color: 0xe0b07a, count: 7, spread: 2.5, rise: 0.8 });
          c.vy = 7.5;
          const flight = 2 * c.vy / G;
          c.rollV = (Math.round(c.roll / (Math.PI * 2)) * Math.PI * 2 - c.roll) / flight;
          c.pitchV = (Math.round(c.pitch / (Math.PI * 2)) * Math.PI * 2 - c.pitch) / flight;
          c.vx *= 0.6;
          c.vz *= 0.6;
          c.scream = 0.8;
        }
      }
    }

    // ---- tire walls ----
    // Works on any track shape: the wall normal is the gradient of offsetOf.
    // Shortcut planks and open edges have no wall: drive off them and you fall.
    const off = offsetOf(c.x, c.z, c.y);
    const limit = T.HW - 1.6;
    const plank = T.shortcuts.length > 0 && T.plankAt(c.x, c.z) != null;
    const edgeOpen = T.drops.length > 0 && isOpenEdge(T.drops, paramOf(c.x, c.z, c.y) / T.TOTAL, Math.sign(off));
    const far = Math.abs(off) > T.HW + OPEN_MARGIN;
    if (!terrain && Math.abs(off) > limit && !plank && !edgeOpen && !far) {
      const e = 0.6;
      let nx = offsetOf(c.x + e, c.z,c.y) - offsetOf(c.x - e, c.z,c.y);
      let nz = offsetOf(c.x, c.z + e,c.y) - offsetOf(c.x, c.z - e,c.y);
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;   // points to the outside
      const side = Math.sign(off);
      c.x -= nx * (Math.abs(off) - limit) * side;
      c.z -= nz * (Math.abs(off) - limit) * side;
      const vn = (c.vx * nx + c.vz * nz) * side;   // speed into the wall
      if (vn > 0) {
        c.vx -= 1.4 * vn * nx * side;
        c.vz -= 1.4 * vn * nz * side;
        if (vn > 9 && !isGhost(c)) {
          c.drift = 0; c.driftT = 0;   // a hard wall hit throws the drift away
          sound.bonk(vn / 10);
          say(c, LINES.wall, 0.8);
          c.vy = Math.max(c.vy, 4);
          c.onGround = false;
          c.airTime = 0;
          c.rollV += (Math.random() < 0.5 ? -1 : 1) * vn * 0.12;
          if (Math.random() < 0.4) popPart(c, vn);
          if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.2);
          recordImpact(c, race.clock);
        }
      }
    }

    // laps: crossing the line counts only after the lap's checkpoints
    const prog = progressOf(c);
    advanceLap(c, c.prog, prog, T.TOTAL);
    c.prog = prog;

    // Off the course (past an open edge, off a plank) the zamuro comes soon.
    c.outT = !terrain && offCourse(Math.abs(off), T.HW, edgeOpen, plank) ? c.outT + dt : 0;
    // Humans only count as stuck while pressing the gas; bots always try.
    const trying = !c.done && c.spin <= 0 && c.stall <= 0 && ((c.isPlayer && !AUTO) || c.human ? input.throttle !== 0 : true);
    c.stuckT = stuckStep(c.stuckT, c.vf, trying && race.state === 'go', dt);
    // Remember the last safe stretch of road to come back to.
    c.safeT -= dt;
    if (c.safeT <= 0 && c.onGround && !plank && Math.abs(off) < T.HW - 2 && c.spin <= 0
      && Math.abs(wrapAngle(c.roll)) < 0.3 && Math.abs(wrapAngle(c.pitch)) < 0.4) {
      const s = paramOf(c.x, c.z, c.y), ahead = pointAt(s + 1), here = pointAt(s);
      const back = Math.cos(c.h - Math.atan2(ahead.x - here.x, ahead.y - here.y)) < 0;
      c.safe = { s, off: Math.max(-3, Math.min(3, off)), back };
      c.safeT = 0.3;
    }

    // timers
    c.dizzy = Math.max(0, c.dizzy - dt);
    c.scream = Math.max(0, c.scream - dt);
    c.honkT = Math.max(0, c.honkT - dt);

    // Tire spray, dust and damage smoke share the bounded particle pool.
    c.puffT -= dt;
    if (c.puffT <= 0) {
      const kicking = c.onGround && ((input.throttle > 0 && Math.abs(vf) < top * 0.55) || Math.abs(c.vr) > 4);
      if (water>.15&&c.onGround&&Math.abs(vf)>7) {
        for(const side of [-1,1])race.puffs.spawn(new THREE.Vector3(c.x-fx*1.5+rx*side,c.y+.2,c.z-fz*1.5+rz*side),
          {color:0xc1e9e3,count:1,size:.45,rise:1.2,life:.35,spread:.8});
        race.shockwaves.ring(new THREE.Vector3(c.x - fx * 1.2, c.y, c.z - fz * 1.2), {
          color: 0xd8f4ef, maxRadius: 2.2, duration: 0.48, opacity: 0.55,
        });
      } else if (kicking) {
        race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.6, c.y+0.25, c.z - fz * 1.6), { color: rough>0.1?0x889263:0xe7bd8a, count: 1, size: 0.7, rise: 0.6, life: 0.7 });
      }
      if (boosting) {
        race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2), { color: pick(flameFor(c)), count: 2, size: 0.6, rise: 0.4, life: 0.35, spread: 0.4 });
      }
      if (c.lost >= 2) {
        race.puffs.spawn(new THREE.Vector3(c.x + fx * 1.4, c.y + 1.6, c.z + fz * 1.4), { color: 0x4a4a52, count: 1, size: 0.6, rise: 2, life: 1 });
      }
      c.puffT = 0.07;
    }
  }

  return { stepCar };
}
