import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAITS, LH, RH, LF, RF, TAU, blendGait, createQuadrupedRig, gaitVariation, legToe, newGait, newPose,
  poseQuadruped, solveTwoBone, strideRate,
} from '../models/animation/quadruped-gait.js';

// The llanero horse's rest skeleton, as rig.js builds it.
const front = { hip: [1.15, .49], knee: [.56, .53], fetlock: [.18, .52], toe: [0, .695], bend: 1 };
const hind = { hip: [1.15, -.59], knee: [.56, -.73], fetlock: [.17, -.65], toe: [0, -.464], bend: -1 };
const rig = createQuadrupedRig({ legs: [hind, hind, front, front], neck: [1.43, .48], head: [1.91, .94], bit: [1.92, .89] });
const SPEEDS = { walk: 1.6, trot: 3.8, canter: 6.2, gallop: 12 };
const sample = (speed, cycle, pose = newPose(rig), variation) => poseQuadruped(rig, cycle * TAU, speed, 0, 0, pose, variation);

// Stance intervals found by walking the real pose, not by reading the table.
function footfalls(speed) {
  const pose = newPose(rig), N = 4000, touch = [[], [], [], []], airborne = [];
  const stanceAt = i => { sample(speed, i / N, pose); return pose.legs.map(l => l.stance); };
  let last = stanceAt(-1);
  for (let i = 0; i < N; i++) {
    const now = stanceAt(i);
    now.forEach((down, leg) => { if (down && !last[leg]) touch[leg].push(i / N); });
    airborne.push(!now.some(Boolean));
    last = now;
  }
  let suspensions = 0;
  for (let i = 0; i < N; i++) if (airborne[i] && !airborne[(i + N - 1) % N]) suspensions++;
  const fraction = airborne.filter(Boolean).length / N;
  assert.ok(touch.every(t => t.length === 1), 'each foot lands once a cycle');
  const at = touch.map(t => t[0]);
  const beats = [...at].sort((a, b) => a - b).reduce((list, t) => (list.at(-1) !== undefined && Math.abs(t - list.at(-1)) < .012 ? list : [...list, t]), []);
  return { at, beats: beats.length, suspensions, fraction };
}
const inOrder = (at, order) => {
  const zero = at[order[0]], shifted = order.map(leg => (at[leg] - zero + 1) % 1);
  shifted.forEach((t, i) => { if (i) assert.ok(t >= shifted[i - 1] - 1e-9, `order ${order} at ${at}`); });
};

test('gallop: four beats LH RH LF RF and one suspension of about a quarter stride', () => {
  const f = footfalls(SPEEDS.gallop);
  assert.equal(f.beats, 4); assert.equal(f.suspensions, 1);
  inOrder(f.at, [LH, RH, LF, RF]);
  assert.ok(f.fraction > .2 && f.fraction < .32, `suspension ${f.fraction}`);
  // The airborne phase follows the leading fore lifting.
  assert.ok(Math.abs(((f.at[RF] + GAITS.gallop.duty) % 1) - .72) < .02);
});

test('canter: three beats with the diagonal together, then a suspension', () => {
  const f = footfalls(GAITS.canter.speed);
  assert.equal(f.beats, 3); assert.equal(f.suspensions, 1);
  assert.ok(Math.abs(f.at[RH] - f.at[LF]) < .002, 'RH and LF land together');
  inOrder(f.at, [LH, RH, RF]);
});

test('trot: two beats on the diagonals with two tiny suspensions', () => {
  const f = footfalls(GAITS.trot.speed);
  assert.equal(f.beats, 2); assert.equal(f.suspensions, 2);
  assert.ok(Math.abs((f.at[LH] - f.at[RF] + 1) % 1) < .002 || Math.abs((f.at[RF] - f.at[LH] + 1) % 1) < .002, 'LH and RF together');
  assert.ok(Math.abs(f.at[RH] - f.at[LF]) < .002, 'RH and LF together');
  assert.ok(f.fraction < .15);
});

test('walk: four even beats in lateral order, always on the ground', () => {
  const f = footfalls(SPEEDS.walk);
  assert.equal(f.beats, 4); assert.equal(f.suspensions, 0);
  inOrder(f.at, [LH, LF, RH, RF]);
  assert.ok(Math.abs(((f.at[LF] - f.at[LH] + 1) % 1) - .25) < .01);
});

test('a left lead mirrors the feet and keeps the pattern', () => {
  const pose = newPose(rig), left = { lead: -1, strideScale: 1 };
  blendGait(SPEEDS.gallop, pose.gait, { lead: 1 });
  const right = [...pose.gait.offsets];
  blendGait(SPEEDS.gallop, pose.gait, left);
  assert.deepEqual(pose.gait.offsets, [right[RH], right[LH], right[RF], right[LF]]);
});

test('IK reaches a target, and knees and hocks bend opposite ways', () => {
  const out = {};
  for (const [dy, dz] of [[-.8, .2], [-.6, -.3], [-.5, .4], [-.4, 0]]) for (const bend of [1, -1]) {
    solveTwoBone(.59, .38, dy, dz, bend, out);
    assert.equal(out.reached, true);
    assert.ok(Math.abs(-.59 * Math.cos(out.upper) - .38 * Math.cos(out.lower) - dy) < 1e-9);
    assert.ok(Math.abs(-.59 * Math.sin(out.upper) - .38 * Math.sin(out.lower) - dz) < 1e-9);
  }
  solveTwoBone(.59, .38, -1.5, 0, 1, out); assert.equal(out.reached, false);
  // Throughout every stride a front knee points ahead of its hip-fetlock line
  // and a hock points behind it (both segments in the body frame).
  const pose = newPose(rig);
  for (const speed of Object.values(SPEEDS)) for (let i = 0; i < 64; i++) {
    sample(speed, i / 64, pose);
    rig.legs.forEach((r, leg) => {
      const l = pose.legs[leg], a1 = l.upper + r.upperRest, a2 = a1 - r.upperRest + l.lower + r.lowerRest;
      const u = [-Math.cos(a1) * r.upper, -Math.sin(a1) * r.upper], w = [-Math.cos(a2) * r.lower, -Math.sin(a2) * r.lower];
      const line = [u[0] + w[0], u[1] + w[1]], ahead = u[1] - line[1] * u[0] / line[0];
      assert.equal(Math.sign(ahead), r.bend, `leg ${leg} at ${speed} m/s, cycle ${i / 64}`);
    });
  }
});

test('stance feet stay planted: on the ground and still relative to it', () => {
  const dt = 1 / 480, fk = {};
  for (let speed = .25; speed <= 18; speed += .25) {
    const pose = newPose(rig), rate = strideRate(speed, blendGait(speed)) * TAU;
    let phase = .17, before = null, worst = 0, high = 0, unreached = 0, samples = 0;
    for (let i = 0; i < Math.ceil(TAU / rate / dt) + 1; i++, phase += rate * dt) {
      poseQuadruped(rig, phase, speed, 0, 0, pose);
      const now = pose.legs.map((leg, n) => { legToe(rig, n, pose, fk); return { z: fk.z, y: fk.y, stance: leg.stance, reached: leg.reached }; });
      if (before) now.forEach((foot, n) => {
        if (!foot.stance || !before[n].stance) return;
        samples++;
        worst = Math.max(worst, Math.abs((foot.z - before[n].z) / dt + speed));
        high = Math.max(high, Math.abs(foot.y));
        if (!foot.reached) unreached++;
      });
      before = now;
    }
    assert.ok(samples > 0);
    assert.equal(unreached, 0, `${speed} m/s: a stance foot is out of reach of its leg`);
    assert.ok(high < .002, `${speed} m/s: a stance toe floats ${high} m`);
    assert.ok(worst < .02 * Math.max(speed, 1), `${speed} m/s: a stance toe slides at ${worst} m/s`);
  }
});

test('the phase rate is speed over stride, and stops near zero', () => {
  for (const [name, speed] of Object.entries(SPEEDS)) {
    const g = blendGait(speed);
    assert.ok(Math.abs(strideRate(speed, g) - speed / (2 * g.reach / g.duty)) < 1e-9, name);
    assert.ok(strideRate(speed, g) < 3.2, `${name} is not frantic`);
  }
  assert.equal(strideRate(0, blendGait(0)), 0);
  assert.equal(strideRate(.01, blendGait(.01)), 0);
  assert.ok(Math.abs(blendGait(1.6).stride - 2 * GAITS.walk.reach / GAITS.walk.duty) < 1e-9);
});

test('gait parameters are continuous in speed', () => {
  const a = newGait(), b = newGait();
  for (let v = 0; v < 20; v += .01) {
    blendGait(v, a); blendGait(v + .01, b);
    for (const key of Object.keys(a)) {
      if (key === 'offsets' || key === 'stride') continue;
      assert.ok(Math.abs(a[key] - b[key]) < .02, `${key} jumps at ${v}`);
    }
    a.offsets.forEach((o, i) => assert.ok(Math.abs(o - b.offsets[i]) < .01, `offset ${i} jumps at ${v}`));
    assert.ok(Math.abs(strideRate(v, a) - strideRate(v + .01, b)) < (v < .1 ? 1 : .03), `rate jumps at ${v}`);
  }
});

test('standing is the rest pose: feet flat, joints at rest, hair at rest', () => {
  const pose = sample(0, .37), fk = {};
  assert.ok(Math.abs(pose.bob) < 1e-9 && Math.abs(pose.pitch) < 1e-9 && Math.abs(pose.neck) < 1e-9);
  pose.legs.forEach((leg, i) => {
    for (const key of ['upper', 'lower', 'hoof']) assert.ok(Math.abs(leg[key]) < 1e-6, `${i} ${key} ${leg[key]}`);
    legToe(rig, i, pose, fk); assert.ok(Math.abs(fk.y) < 1e-6);
  });
  for (const chain of [pose.mane, pose.tail]) for (const bone of chain) assert.ok(Math.abs(bone.x) < 1e-9 && Math.abs(bone.z) < 1e-9);
});

test('the pose is deterministic and reuses its objects', () => {
  const a = newPose(rig), b = newPose(rig), legs = a.legs;
  poseQuadruped(rig, 2.1, 11, 0, 0, a); poseQuadruped(rig, 9, 3, .4, 2, a); poseQuadruped(rig, 2.1, 11, 0, 0, a);
  poseQuadruped(rig, 2.1, 11, 0, 0, b);
  assert.deepEqual(a, b); assert.equal(a.legs, legs);
  assert.deepEqual(gaitVariation(12), gaitVariation(12));
  const seeds = Array.from({ length: 40 }, (_, seed) => gaitVariation(seed));
  assert.ok(new Set(seeds.map(v => v.lead)).size === 2, 'both leads appear');
  assert.ok(seeds.every(v => v.strideScale > .96 && v.strideScale < 1.04 && v.phase >= 0 && v.phase < TAU));
  assert.ok(new Set(seeds.map(v => v.phase.toFixed(3))).size > 30, 'a field is not in lockstep');
});

test('in the air the legs hold the jump pose: fronts tucked ahead, hinds trailing', () => {
  const pose = newPose(rig), fk = {};
  poseQuadruped(rig, 1, 12, .6, 1, pose);
  assert.ok(pose.legs.every(l => !l.stance));
  legToe(rig, LF, pose, fk); const fore = { ...fk }; legToe(rig, LH, pose, fk);
  assert.ok(fore.y > .4 && fore.z > .7, `fore ${fore.y} ${fore.z}`);
  assert.ok(fk.y > .25 && fk.z < -.65, `hind ${fk.y} ${fk.z}`);
  assert.ok(pose.pitch < 0, 'nose up on the way up');
  poseQuadruped(rig, 1, 12, .6, -3, pose); assert.ok(pose.pitch > 0, 'nose down on the way down');
});

test('head and body move in time: nods as the fronts land, body up in the air', () => {
  const pose = newPose(rig);
  const peak = (speed, read) => { let best = -Infinity, at = 0; for (let i = 0; i < 400; i++) { sample(speed, i / 400, pose); if (read() > best) { best = read(); at = i / 400; } } return { best, at }; };
  const nod = peak(12, () => pose.nod), bob = peak(12, () => pose.bob), pitch = peak(12, () => pose.pitch);
  assert.ok(nod.best > .1 && nod.at > .35 && nod.at < .55, `nod at ${nod.at}`);
  assert.ok(bob.at > .72 && bob.at < 1, `bob at ${bob.at}`);
  assert.ok(pitch.at > .35 && pitch.at < .55, `pitch at ${pitch.at}`);
  // Walking dips with each fore landing; trot is the smaller of the two.
  assert.ok(peak(SPEEDS.walk, () => pose.nod).best > peak(SPEEDS.trot, () => pose.nod).best);
});
