import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, solidAt, carve, fill, splash, stainAt, groundBelow, surfaceY, slopeAt, circleHits, surfaceNormal, takeDirty, paintRGBA } from '../play/terrain-mask.js';

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
