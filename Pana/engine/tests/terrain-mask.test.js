import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, solidAt, carve, fill, splash, drips, stainAt, groundBelow, surfaceY, slopeAt, circleHits, surfaceNormal, takeDirty, paintRGBA, fieldRGBA, coverageContour } from '../play/terrain-mask.js';

const near = (a, b, tol = .11) => Math.abs(a - b) <= tol;
const flat = (h = 10) => { const m = createMask({ width: 40, height: 20, cell: .1 }); fillHeights(m, () => h); takeDirty(m); return m; };

test('heights fill the ground below the line, row 0 at the bottom', () => {
  const m = flat(10);
  assert.equal(m.cols, 400); assert.equal(m.rows, 200);
  assert.ok(solidAt(m, 5, 9.9) && !solidAt(m, 5, 10.1));
  assert.ok(near(surfaceY(m, 20), 10));
  assert.equal(solidAt(m, -1, 5), false, 'outside the grid is air');
});

test('carve digs a round crater and reports what it removed', () => {
  const m = flat(10), before = m.solid.reduce((a, b) => a + b, 0);
  const removed = carve(m, 20, 10, 3);
  assert.ok(removed > 0 && m.solid.reduce((a, b) => a + b, 0) === before - removed);
  assert.ok(!solidAt(m, 20, 8) && solidAt(m, 20, 6.8), 'three units deep at the centre');
  assert.ok(solidAt(m, 23.5, 9.5), 'untouched outside the radius');
  assert.ok(near(surfaceY(m, 20), 7), 'the floor of the crater is the new ground');
  const d = takeDirty(m);
  assert.ok(d.c0 <= 170 && d.c1 >= 230, 'the changed columns are marked for repaint');
  assert.equal(takeDirty(m), null);
  assert.ok(fill(m, 20, 8, 1) > 0 && solidAt(m, 20, 8), 'fill puts ground back');
});

test('splash paints only ground, strongest at the centre, and the stronger coat keeps its colour', () => {
  const m = flat(10);
  splash(m, 20, 10, 2, 1);
  assert.ok(stainAt(m, 20, 9.8, .1) > .9);
  assert.ok(stainAt(m, 21.8, 9.8, .05) < stainAt(m, 20.5, 9.8, .05), 'fades towards the rim');
  assert.equal(stainAt(m, 20, 11, .2), 0, 'air carries no paint');
  splash(m, 21.5, 10, 1, 2, 80);
  assert.equal(m.tint[99 * m.cols + 200], 1, 'a weaker coat does not repaint the centre');
  carve(m, 20, 10, 1);
  assert.equal(stainAt(m, 20, 9.5, .2), 0, 'carved cells lose their paint');
});

test('groundBelow finds the next floor down, within a depth', () => {
  const m = flat(10);
  carve(m, 20, 6, 1.5);                         // a cave under the surface
  assert.ok(near(groundBelow(m, 20, 12), 10));
  assert.ok(near(groundBelow(m, 20, 7), 4.5, .15), 'inside the cave the floor is its bottom');
  assert.equal(groundBelow(m, 20, 7, .5), null, 'too deep to reach');
  assert.equal(groundBelow(m, -2, 12), null);
});

test('slope, normal and circle queries read the ground shape', () => {
  const m = createMask({ width: 40, height: 20, cell: .1 });
  fillHeights(m, x => x < 20 ? 5 : 5 + (x - 20));  // flat, then 45 degrees up
  assert.ok(near(slopeAt(m, 10, 5), 0, .05));
  assert.ok(near(slopeAt(m, 25, 10), 1, .15));
  const n = surfaceNormal(m, 10, 5, .6);
  assert.ok(n.y > .95, 'flat ground faces up');
  const s = surfaceNormal(m, 25, 10, .6);
  assert.ok(s.x < -.5 && s.y > .5, 'a slope rising right faces up-left');
  assert.ok(circleHits(m, 10, 5.5, .6) && !circleHits(m, 10, 6, .6));
});

test('paintRGBA draws air transparent, grass on top and paint over the earth', () => {
  const m = flat(10), rgba = new Uint8Array(m.cols * m.rows * 4);
  splash(m, 30, 8, 1, 0);
  const palette = { earth: [150, 100, 60], deep: [80, 50, 30], grass: [70, 160, 60], tints: [[255, 0, 128]] };
  paintRGBA(m, rgba, palette);
  const px = (x, y) => { const i = (Math.floor(y / m.cell) * m.cols + Math.floor(x / m.cell)) * 4; return [...rgba.slice(i, i + 4)]; };
  assert.equal(px(5, 15)[3], 0, 'sky is see-through');
  const top = px(5, 9.95); assert.ok(top[1] > top[0] && top[3] === 255, 'the surface is grass green');
  const painted = px(30, 8); assert.ok(painted[0] > 200 && painted[2] > 90, 'the splash shows its colour');
});

test('drips run paint down from a blast and throw blobs past it, the same way for the same seed', () => {
  const blast = seed => { const m = flat(10); carve(m, 30, 10, 3); splash(m, 30, 10, 4.5, 1); takeDirty(m); return { m, n: drips(m, 30, 10, 4.1, 1, { seed }) }; };
  const a = blast(7), b = blast(7), c = blast(8);
  assert.ok(a.n > 0); assert.deepEqual(a.m.stain, b.m.stain); assert.notDeepEqual(a.m.stain, c.m.stain);
  assert.ok(takeDirty(a.m), 'the drips mark the ground to repaint');
  // Below the splash's reach there is paint now, on solid ground only.
  let below = 0; for (let r = 0; r < Math.floor((10 - 4.5) / a.m.cell); r++) for (let col = 0; col < a.m.cols; col++) { const i = r * a.m.cols + col; if (a.m.stain[i]) { below++; assert.equal(a.m.solid[i], 1); } }
  assert.ok(below > 0, 'a streak runs below the stain');
  // Blobs land on the top surface past the crater.
  assert.ok(stainAt(a.m, 30 - 4.1 * 1.4, 9.95, 1.5) > 0 || stainAt(a.m, 30 + 4.1 * 1.4, 9.95, 1.5) > 0, 'a blob past the rim');
});

test('paintRGBA options: sand by the water, bare crater floors, blades of grass, rock and height shading', () => {
  const m = flat(10), rgba = new Uint8Array(m.cols * m.rows * 4);
  fillHeights(m, x => x < 10 ? 3 : 10); carve(m, 30, 10, 2);
  const palette = { earth: [150, 100, 60], deep: [80, 50, 30], grass: [70, 160, 60], sand: [230, 200, 140], sandBelow: 4, rock: [140, 140, 140], rockAt: (x, y) => y < 2 ? 1 : 0,
    grassAt: (x, y) => y > 9.5, fringe: 3, deepFrom: 10, deepAt: 50 };
  paintRGBA(m, rgba, palette);
  const px = (x, y) => { const i = (Math.floor(y / m.cell) * m.cols + Math.floor(x / m.cell)) * 4; return [...rgba.slice(i, i + 4)]; };
  const sand = px(5, 2.95); assert.ok(sand[0] > 180 && sand[1] > 150, 'the low shore is sand');
  const floor = px(30, 7.95); assert.ok(floor[1] < floor[0], 'the crater floor is bare earth, not grass');
  let blades = 0; for (let x = 12; x < 25; x += .1) if (px(x, 10.05)[3]) blades++;
  assert.ok(blades > 10 && !solidAt(m, 15, 10.05), 'blades are drawn over the grass, the cells stay air');
  const rocky = px(15, 1); assert.ok(Math.abs(rocky[0] - rocky[2]) < 30, 'rock is grey');
  assert.ok(px(15, 8)[0] > px(15, 5)[0], 'earth darkens with height below deepFrom');
});

test('fieldRGBA writes a signed distance, a smooth coverage and the paint for a shader', () => {
  const m = flat(10), n = m.cols * m.rows * 4, field = new Uint8Array(n), paint = new Uint8Array(n);
  splash(m, 20, 10, 2, 1);
  fieldRGBA(m, field, paint, { rockAt: x => (x > 30 ? 1 : 0), grassAt: x => x < 35, tints: 2 });
  const px = (x, y) => ((Math.floor(y / m.cell) * m.cols + Math.floor(x / m.cell)) * 4);
  const sdAt = (x, y) => (field[px(x, y)] - 128) / 4 * m.cell;
  assert.ok(near(sdAt(5, 9.95), .05, .01), 'the top cell of the ground: half a cell deep');
  assert.ok(near(sdAt(5, 9.05), .95, .01), 'nine cells further down');
  assert.ok(near(sdAt(5, 10.05), -.05, .01), 'the air just over the ground');
  assert.ok(near(sdAt(5, 10.55), -.55, .01));
  assert.equal(field[px(5, 5) + 1], 255, 'coverage is full inside the ground');
  assert.equal(field[px(5, 12) + 1], 0, 'and empty in the sky');
  const edge = field[px(5, 9.95) + 1], above = field[px(5, 10.05) + 1];
  assert.ok(edge > 127 && above < 128 && edge - above < 150, 'the edge is a ramp through 0.5, not a step');
  assert.equal(field[px(32, 5) + 2], 255, 'rock where rockAt says');
  assert.equal(field[px(37, 9.5) + 3], 255, 'bare where grassAt is false');
  assert.equal(field[px(37, 10.5) + 3], 255, 'and over it, so no grass grows there');
  assert.equal(field[px(5, 9.5) + 3], 0);
  assert.ok(paint[px(20, 9.9)] > 200 && paint[px(20, 9.9) + 1] === 255, 'stain and the tint of the coat');
  assert.ok(paint[px(5, 9.95) + 2] < 200 && paint[px(5, 5) + 2] === 255, 'wide coverage falls near the air');
  // A repaint of a crater only rewrites the columns around it.
  // A gentle staircase (one cell every ten columns) reads as a smooth slope.
  const slope = createMask({ width: 10, height: 4, cell: .1 }), fs = new Uint8Array(slope.cols * slope.rows * 4);
  fillHeights(slope, x => 2 + Math.floor(x) * .1); fieldRGBA(slope, fs, new Uint8Array(fs.length));
  const surf = c => 2.05 + (fs[(20 * slope.cols + c) * 4] - 128) / 4 * slope.cell;   // surface seen from row 20 (y 2.05)
  for (let c = 15; c < 80; c++) assert.ok(surf(c + 1) - surf(c) < .05 && surf(c + 1) >= surf(c) - 1e-9, `no step at column ${c}`);
  const before = field.slice();
  carve(m, 20, 10, 2); fieldRGBA(m, field, paint, {}, takeDirty(m));
  assert.equal(field[px(20, 8.5) + 1], 0, 'the crater is air now');
  assert.deepEqual(field.slice(px(2, 0), px(2, 0) + 4), before.slice(px(2, 0), px(2, 0) + 4), 'far columns untouched');
});

test('coverageContour traces a smooth outline with outward normals', () => {
  const m = flat(10), n = m.cols * m.rows * 4, field = new Uint8Array(n), paint = new Uint8Array(n);
  carve(m, 20, 10, 3); fieldRGBA(m, field, paint);
  const { segments, normals, count } = coverageContour(m, field);
  assert.ok(count > 300, `a long outline (${count})`);
  let flatTop = 0, inCrater = 0;
  for (let i = 0; i < count; i++) {
    const x = segments[i * 4], y = segments[i * 4 + 1], nx = normals[i * 4], ny = normals[i * 4 + 1];
    assert.ok(Math.abs(Math.hypot(nx, ny) - 1) < 1e-3);
    if (Math.abs(x - 20) > 4 && y > 9 && y < 11) { flatTop++; assert.ok(near(y, 10, .06) && ny > .99, 'flat ground: the edge at 10, facing up'); }
    if (Math.hypot(x - 20, y - 10) < 3.2 && y < 9) { inCrater++; assert.ok(near(Math.hypot(x - 20, y - 10), 3, .2)); assert.ok(nx * (20 - x) + ny * (10 - y) > .8, 'the crater wall faces its centre'); }
  }
  assert.ok(flatTop > 100 && inCrater > 40);
});
