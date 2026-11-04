// The spatial hash must find what a brute-force search finds, by looking at far less.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../play/spatial-hash.js';

const noise = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test('a query returns every point within its radius', () => {
  const R = noise(11), n = 2000, xs = new Float32Array(n), zs = new Float32Array(n);
  const hash = new SpatialHash({ cell: .5, x0: 0, z0: 0, w: 80, h: 80, capacity: n }), out = new Int32Array(n);
  hash.clear();
  for (let i = 0; i < n; i++) { xs[i] = R() * 40; zs[i] = R() * 40; hash.insert(i, xs[i], zs[i]); }
  assert.equal(hash.count, n);
  for (const radius of [.1, .5, 1.3]) for (let t = 0; t < 200; t++) {
    const x = R() * 40, z = R() * 40, got = new Set(out.subarray(0, hash.query(x, z, radius, out)));
    for (let i = 0; i < n; i++) if (Math.hypot(xs[i] - x, zs[i] - z) <= radius) assert.ok(got.has(i), `point ${i} near ${x},${z} (radius ${radius})`);
  }
});

test('only the neighbouring cells are visited: candidates are few', () => {
  const R = noise(5), n = 4000, hash = new SpatialHash({ cell: .5, x0: 0, z0: 0, w: 200, h: 200, capacity: n }), out = new Int32Array(n);
  hash.clear();
  for (let i = 0; i < n; i++) hash.insert(i, R() * 100, R() * 100);
  let total = 0;
  for (let t = 0; t < 500; t++) total += hash.query(R() * 100, R() * 100, .4, out);
  assert.ok(total / 500 < n / 100, `about ${total / 500} candidates of ${n}`);
});

test('clear forgets; each id comes back once; max caps the answer', () => {
  const hash = new SpatialHash({ cell: 1, w: 4, h: 4, capacity: 8 }), out = new Int32Array(8);
  for (let i = 0; i < 8; i++) hash.insert(i, 1.5, 1.5);
  assert.equal(hash.query(1.5, 1.5, .2, out), 8);
  assert.equal(new Set(out).size, 8);
  assert.equal(hash.query(1.5, 1.5, .2, out, 3), 3);
  hash.clear();
  assert.equal(hash.query(1.5, 1.5, 5, out), 0);
});

test('points and queries past the edge use the border cells', () => {
  const hash = new SpatialHash({ cell: 1, x0: 10, z0: 10, w: 4, h: 4, capacity: 2 }), out = new Int32Array(2);
  hash.clear(); hash.insert(0, -50, -50); hash.insert(1, 500, 500);
  assert.deepEqual([...out.subarray(0, hash.query(10.2, 10.2, .1, out))], [0]);
  assert.deepEqual([...out.subarray(0, hash.query(999, 999, .1, out))], [1]);
});
