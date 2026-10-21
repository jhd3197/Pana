import test from 'node:test';
import assert from 'node:assert/strict';
import { createGhostRecorder, loadGhost, ghostKey } from '../public/ghost-recorder.js';
import { poseAt, createGhostPlayback, spawnGhost } from '../public/ghost-car.js';
import { POSE_HZ, FLAG, DRIFT_SHIFT } from '../public/online-rules.js';

// A car record with everything packPose reads; tests move x and lap.
const car = (over = {}) => ({ x: 0, y: 0, z: 0, h: 0, pitch: 0, roll: 0, vf: 20, steer: 0, spin: 0, boost: 0,
  onGround: true, dizzy: 0, scream: 0, honkT: 0, airTime: 0, inventory: [null, null], done: false,
  drift: 0, driftLvl: 0, shield: 0, phaseT: 0, rescueT: 0, lap: 1, prog: 0, lost: 0, coins: 0, ...over });

const memStorage = () => {
  const map = new Map();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
};

// Steps the recorder at 60 Hz for `seconds`, nudging the car so poses differ.
function drive(rec, c, seconds, clock) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    clock.now += 1 / 60;
    c.x += 0.3;
    rec.step(clock.now, c);
  }
}

test('samples poses at POSE_HZ while recording', () => {
  const rec = createGhostRecorder({ storage: memStorage() });
  const c = car(), clock = { now: 0 };
  assert.equal(rec.recording, false);
  rec.step(0, c);                    // no begin: nothing is kept
  assert.equal(rec.samples, 0);
  rec.begin('estadio');
  drive(rec, c, 2, clock);
  assert.ok(Math.abs(rec.samples - (2 * POSE_HZ + 1)) <= 1, `samples ${rec.samples}`);
  assert.equal(rec.recording, true);
});

test('splits the stream into laps and keeps the fastest', () => {
  const storage = memStorage();
  const rec = createGhostRecorder({ storage });
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 5, clock);           // lap 1: 5 s
  c.lap = 2;
  drive(rec, c, 4, clock);           // lap 2: 4 s — the best
  c.lap = 3;
  drive(rec, c, 6, clock);           // lap 3: 6 s
  c.lap = 4; c.done = true;          // crossing the line closes lap 3
  rec.step(clock.now += 1 / 60, c);
  const result = rec.finish();
  assert.equal(result.saved, true);
  assert.ok(Math.abs(result.lap - 4) < 0.1, `lap ${result.lap}`);
  const ghost = loadGhost('estadio', storage);
  assert.ok(Math.abs(ghost.lap - 4) < 0.1, `stored ${ghost.lap}`);
  assert.ok(Math.abs(ghost.poses.length - 4 * POSE_HZ) <= 2, `poses ${ghost.poses.length}`);
  // Stamps are rebased to the lap start and poses keep the packed 15 numbers.
  assert.ok(ghost.poses[0][0] < 100, `first stamp ${ghost.poses[0][0]}`);
  assert.equal(ghost.poses[0].length, 16);
  assert.ok(ghost.poses.every((p, i) => !i || p[0] > ghost.poses[i - 1][0]), 'stamps ascend');
});

test('a slower lap never replaces the stored best', () => {
  const storage = memStorage();
  storage.setItem(ghostKey('estadio'), JSON.stringify({ lap: 3.5, poses: [[0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0], [50, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]] }));
  const rec = createGhostRecorder({ storage });
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 5, clock);
  c.lap = 2; c.done = true;
  rec.step(clock.now += 1 / 60, c);
  const result = rec.finish();
  assert.equal(result.saved, false);
  assert.equal(result.best, 3.5);
  assert.equal(loadGhost('estadio', storage).lap, 3.5);
});

test('a faster lap overwrites the stored one', () => {
  const storage = memStorage();
  storage.setItem(ghostKey('estadio'), JSON.stringify({ lap: 9, poses: [[0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0], [50, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]] }));
  const rec = createGhostRecorder({ storage });
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 4, clock);
  c.lap = 2; c.done = true;
  rec.step(clock.now += 1 / 60, c);
  const result = rec.finish();
  assert.equal(result.saved, true);
  assert.ok(Math.abs(loadGhost('estadio', storage).lap - 4) < 0.1);
});

test('storage quota and private mode drop the ghost quietly', () => {
  const throwing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const rec = createGhostRecorder({ storage: throwing });
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 4, clock);
  c.lap = 2; c.done = true;
  rec.step(clock.now += 1 / 60, c);
  const result = rec.finish();
  assert.equal(result.saved, false);
  assert.ok(Math.abs(result.lap - 4) < 0.1);
  // No storage at all: still just a quiet miss.
  const bare = createGhostRecorder({ storage: null });
  const c2 = car(), clock2 = { now: 0 };
  bare.begin('estadio');
  drive(bare, c2, 4, clock2);
  c2.lap = 2; c2.done = true;
  bare.step(clock2.now += 1 / 60, c2);
  assert.equal(bare.finish().saved, false);
});

test('glitch laps under three seconds are never kept', () => {
  const storage = memStorage();
  const rec = createGhostRecorder({ storage });
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 5, clock);
  c.lap = 2;
  drive(rec, c, 1, clock);           // a bogus one-second lap
  c.lap = 3; c.done = true;
  rec.step(clock.now += 1 / 60, c);
  const result = rec.finish();
  assert.ok(Math.abs(result.lap - 5) < 0.1, `lap ${result.lap}`);
});

test('finish without a full lap keeps nothing; discard drops the take', () => {
  const storage = memStorage();
  const rec = createGhostRecorder({ storage });
  assert.equal(rec.finish(), null);  // never began
  const c = car(), clock = { now: 0 };
  rec.begin('estadio');
  drive(rec, c, 2, clock);           // still on lap 1: no bound
  const result = rec.finish();
  assert.equal(result.saved, false);
  assert.equal(result.lap, null);
  assert.equal(loadGhost('estadio', storage), null);
  rec.begin('estadio');
  drive(rec, c, 2, clock);
  rec.discard();
  assert.equal(rec.recording, false);
  assert.equal(rec.finish(), null);
});

test('loadGhost reads malformed entries as absent', () => {
  const storage = memStorage();
  assert.equal(loadGhost('estadio', storage), null);
  storage.setItem(ghostKey('estadio'), '{not json');
  assert.equal(loadGhost('estadio', storage), null);
  storage.setItem(ghostKey('estadio'), JSON.stringify({ lap: 'soon', poses: [] }));
  assert.equal(loadGhost('estadio', storage), null);
  storage.setItem(ghostKey('estadio'), JSON.stringify({ lap: 62.5, poses: [[0, 1, 2]] }));
  assert.equal(loadGhost('estadio', storage), null);
});

// A stored pose entry: [tMs, x, y, z, h, pitch, roll, vf, steer, spin, boost, flags, lap, prog, lost, coins].
const entry = (t, over = {}) => [t,
  over.x ?? 0, over.y ?? 0, over.z ?? 0, over.h ?? 0, over.pitch ?? 0, over.roll ?? 0,
  over.vf ?? 10, over.steer ?? 0, over.spin ?? 0, over.boost ?? 0,
  over.flags ?? FLAG.ground, over.lap ?? 1, over.prog ?? 0, over.lost ?? 0, over.coins ?? 0];

test('poseAt interpolates position and speed, newer sample owns discrete fields', () => {
  const poses = [entry(0, { x: 0, vf: 10, lap: 1, coins: 2 }), entry(1000, { x: 10, vf: 20, lap: 2, coins: 5 })];
  const mid = poseAt(poses, 500);
  assert.equal(mid[0], 5);            // x lerps
  assert.equal(mid[6], 15);           // vf lerps
  assert.equal(mid[11], 2);           // lap from the newer sample
  assert.equal(mid[14], 5);           // coins from the newer sample
  assert.deepEqual(poseAt(poses, -50), poses[0].slice(1));   // before the first stamp
  assert.deepEqual(poseAt(poses, 1500), poses[1].slice(1));  // past the last
});

test('poseAt turns headings along the shortest arc', () => {
  const a = -Math.PI + 0.1, b = Math.PI - 0.1;
  const mid = poseAt([entry(0, { h: a }), entry(1000, { h: b })], 500);
  assert.ok(Math.abs(Math.abs(mid[3]) - Math.PI) < 0.01, `heading ${mid[3]} wraps over ±π, not through 0`);
});

test('playback loops the lap and drive() strips drift and shield', () => {
  const poses = [entry(0, { x: 0 }), entry(1000, { x: 10 }), entry(2000, { x: 20 })];
  const play = createGhostPlayback({ lap: 2, poses });
  assert.equal(play.duration, 2000);
  assert.equal(play.pose(2500)[0], play.pose(500)[0]);     // loops
  assert.equal(play.pose(-500)[0], play.pose(1500)[0]);    // negative times wrap too
  const drifting = [entry(0, { x: 0, flags: FLAG.ground | FLAG.drift | FLAG.shield | (2 << DRIFT_SHIFT) }), entry(1000, { x: 5 })];
  const c = {};
  createGhostPlayback({ lap: 1, poses: drifting }).drive(c, 500, 1 / 60);
  assert.equal(c.x, 2.5);
  assert.equal(c.drift, 0);
  assert.equal(c.driftLvl, 0);
  assert.equal(c.shield, 0);
  assert.equal(c.onGround, true);
  assert.ok(Math.abs(c.vx - Math.sin(c.h) * c.vf) < 1e-9 && Math.abs(c.vz - Math.cos(c.h) * c.vf) < 1e-9);
  assert.ok(Number.isFinite(c.latAcc) && Number.isFinite(c.longAcc));
});

test('spawnGhost places the replica on the lap-start pose from the countdown', () => {
  const poses = [entry(0, { x: 3, z: 7 }), entry(1000, { x: 10 })];
  const ghost = spawnGhost({ recording: { lap: 1, poses }, buildCar: () => ({}) });
  assert.equal(ghost.lap, 1);
  assert.equal(ghost.car.x, 3);
  assert.equal(ghost.car.z, 7);
  ghost.update(500, 1 / 60);
  assert.equal(ghost.car.x, 6.5);
});
