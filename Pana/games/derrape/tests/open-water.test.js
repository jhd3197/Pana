import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRuns, openWater, keepAfloat, bumpObstacle, inWake, WATER_MARGIN } from '../public/course-rules.js';

// A straight 1000 m route along +z (x = 0), HW 8. The road dips under the
// water between z = 400 and z = 600; a round lagoon of radius 60 sits on it
// at z = 500 with an islet at (30, 500).
function straightTrack(extra = {}) {
  const height = s => (s > 400 && s < 600 ? -0.6 : 2);
  const T = {
    TOTAL: 1000, HW: 8,
    paramOf: (x, z) => ((z % 1000) + 1000) % 1000,
    offsetOf: x => -x,
    pointAt: s => ({ x: 0, y: s }),
    nearest: (x, z) => ({ s: z, d: Math.abs(x) }),
    heightAtS: height,
    surfaceAt: (x, z) => height(z),
    terrainAt: (x, z) => (Math.hypot(x - 30, z - 500) < 6 ? 0.7 : -1.5),
    def: {
      transformGates: [{ below: 0.3, open: true }],
      lagoonAt: (x, z) => (Math.hypot(x, z - 500) < 60 ? 0 : null),
      ...extra,
    },
  };
  return T;
}

test('a below-gate runs where the route is under the waterline', () => {
  const [run] = gateRuns(straightTrack());
  assert.equal(run.s0, 401);
  assert.equal(run.len, 199);
});

test('point and fraction gates still read as before', () => {
  const T = straightTrack({ transformGates: [{ from: 0.1, to: 0.2 }, { fromAt: [0, 300], lead: 5, to: 0.35 }] });
  assert.deepEqual(gateRuns(T).map(g => [g.s0, g.len]), [[100, 100], [295, 55]]);
});

test('boats float on the lagoon, not on islets, banks or past the region', () => {
  const water = openWater(straightTrack());
  assert.equal(water.surfaceAt(0, 500), 0);       // over the sunken road
  assert.equal(water.surfaceAt(-40, 500), 0);     // well off the line
  assert.equal(water.surfaceAt(30, 500), null);   // the islet
  assert.equal(water.surfaceAt(0, 380), null);    // the dry road before the slipway
  assert.equal(water.surfaceAt(70, 500), null);   // past the shore
  assert.ok(WATER_MARGIN > 0);
  assert.equal(openWater(straightTrack({ lagoonAt: undefined })), null);
});

test('a boat that hits the shore stays afloat and bounces back', () => {
  const T = straightTrack(), water = openWater(T);
  const c = { x: 61, z: 500, y: 0, vx: 20, vz: 0 }, previous = { x: 58, z: 500 };
  const hit = keepAfloat(water, T, c, previous);
  assert.equal(hit, 20);
  assert.deepEqual([c.x, c.z], [58, 500]);
  assert.ok(c.vx < 0, `bounced back ${c.vx}`);
  // Climbing the slipway onto the road is not a shore.
  const up = { x: 0, z: 601, y: 0, vx: 0, vz: 20 };
  assert.equal(keepAfloat(water, T, up, { x: 0, z: 599 }), 0);
  assert.equal(up.z, 601);
});

test('boats are solid and their wakes trail behind them', () => {
  const boat = { x: 0, z: 0, r: 3, h: 0, v: 10, vx: 0, vz: 10 };
  const c = { x: 0, z: 4, vx: 0, vz: -15 };
  assert.equal(bumpObstacle(c, boat), 25);
  assert.equal(c.z, 4.8);
  assert.ok(c.vz > 0, `pushed away ${c.vz}`);
  assert.equal(bumpObstacle({ x: 20, z: 0, vx: 0, vz: 0 }, boat), 0);
  assert.ok(inWake({ x: 0.5, z: -8 }, boat));
  assert.ok(!inWake({ x: 0, z: 8 }, boat));                    // ahead of the bow
  assert.ok(!inWake({ x: 0, z: -8 }, { ...boat, v: 0 }));      // anchored boats leave none
});
