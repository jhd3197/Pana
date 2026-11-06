import test from 'node:test';
import assert from 'node:assert/strict';
import { POM_SURFACES, brickHeights, pomFade, pomFlag, pomGate, pomHit, pomSteps, reliefPixels, rockHeights, surfaceHeights } from '../fx/pom-sim.js';

const SIZE = 64;
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('the same seed gives the same bytes, another seed does not', () => {
  for (const make of [brickHeights, rockHeights]) {
    assert.ok(same(make(SIZE, 5), make(SIZE, 5)));
    assert.ok(!same(make(SIZE, 5), make(SIZE, 6)));
  }
  for (const kind of Object.keys(POM_SURFACES)) {
    const h = surfaceHeights(kind, SIZE), s = POM_SURFACES[kind];
    assert.ok(same(reliefPixels(h, SIZE, s), reliefPixels(surfaceHeights(kind, SIZE), SIZE, s)), kind);
  }
});

test('heights stay in 0..1 and use the range: real grooves, real faces', () => {
  for (const kind of Object.keys(POM_SURFACES)) {
    const h = surfaceHeights(kind, 128), low = Math.min(...h), high = Math.max(...h);
    assert.ok(low >= 0 && high <= 1, kind);
    assert.ok(high - low > .7, `${kind}: range ${high - low}`);
  }
});

test('the maps tile: the far edge continues into the near one like any other row', () => {
  for (const kind of Object.keys(POM_SURFACES)) {
    const size = 128, h = surfaceHeights(kind, size), row = y => h.subarray(y * size, (y + 1) * size);
    const step = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);
    const inner = step(row(40), row(41)), seam = step(row(size - 1), row(0));
    assert.ok(seam < inner * 3, `${kind}: seam ${seam}, inner ${inner}`);
  }
});

test('a brick map has mortar: a fair share of low ground, most of it face', () => {
  const h = brickHeights(128), low = h.filter(v => v < .25).length / h.length;
  assert.ok(low > .03 && low < .35, `mortar share ${low}`);
});

test('the normal is the slope: flat ground faces out, a rise to the right leans left', () => {
  const size = 8, opt = { tile: [1, 1], depth: .1 }, at = (p, x, y) => [...p.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
  const flat = reliefPixels(new Float32Array(size * size).fill(.5), size, opt);
  assert.deepEqual(at(flat, 3, 3).slice(0, 3), [128, 128, 255]);
  assert.equal(at(flat, 3, 3)[3], 128, 'alpha is the height');
  const ramp = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ramp[y * size + x] = x / size;
  const p = at(reliefPixels(ramp, size, opt), 3, 3);
  assert.ok(p[0] < 128, 'leans against +u'); assert.equal(p[1], 128);
});

test('more layers at a grazing look, fewer head-on, never outside the range', () => {
  const range = [8, 24];
  assert.equal(pomSteps(1, range), 8); assert.equal(pomSteps(0, range), 24);
  assert.equal(pomSteps(-1, range), 24); assert.equal(pomSteps(2, range), 8);
  let last = Infinity;
  for (let c = 0; c <= 1; c += .05) { const n = pomSteps(c, range); assert.ok(n <= last); assert.ok(Number.isInteger(n)); last = n; }
  for (const s of Object.values(POM_SURFACES)) assert.ok(s.steps[1] <= 24, 'modest at the worst');
});

test('the effect fades with distance and costs nothing past it', () => {
  const fade = [5, 12];
  assert.equal(pomFade(1, fade), 1); assert.equal(pomFade(5, fade), 1);
  assert.equal(pomFade(12, fade), 0); assert.equal(pomFade(50, fade), 0);
  assert.ok(pomFade(8, fade) > pomFade(10, fade));
});

test('only the top detail on a desktop, and the address beats everything', () => {
  assert.equal(pomGate({ detail: 'alta' }), true);
  for (const detail of ['media', 'baja', undefined]) assert.equal(pomGate({ detail }), false, detail);
  assert.equal(pomGate({ detail: 'alta', touch: true }), false, 'a phone never');
  assert.equal(pomGate({ detail: 'baja', touch: true, flag: '1' }), true);
  assert.equal(pomGate({ detail: 'alta', flag: '0' }), false);
  assert.equal(pomFlag('?debug&pom=1'), '1'); assert.equal(pomFlag('?pom=0'), '0');
  assert.equal(pomFlag('?pom=maybe'), null); assert.equal(pomFlag(''), null);
});

test('the march lands on the surface it walks through', () => {
  // A groove: height 1 up to u = .5, then a floor at .4. Entering just before the wall.
  const groove = u => u < .5 ? 1 : .4, slope = u => 1 - u;
  const onFace = pomHit(groove, .2, .5, .1, 0, 8, 3);
  assert.equal(onFace.depth, 0, 'a ray starting on the face stops at once');
  const inGroove = pomHit(groove, .7, .5, .1, 0, 8, 3);
  assert.ok(Math.abs(inGroove.depth - .6) < .08, `floor at .6 deep: ${inGroove.depth}`);
  // A ramp has an exact answer: 1 - height(.5 - .5d) = d gives d = 1/3, between two layers.
  const ray = pomHit(slope, .5, .5, .5, 0, 6, 3);
  assert.ok(Math.abs(ray.depth - 1 / 3) < 1e-6, `on the ramp: ${ray.depth}`);
  assert.equal(ray.taps, pomHit(slope, .5, .5, .5, 0, 6, 0).taps + 3, 'each refinement is one tap');
});
