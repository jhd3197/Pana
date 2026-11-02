import test from 'node:test';
import assert from 'node:assert/strict';
import { MINIMAP_RADIUS, minimapScale, localView, courtView, project, clampToEdge } from '../public/minimap.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('the corner map shows about 30 m around you', () => {
  assert.equal(MINIMAP_RADIUS, 30);
  near(minimapScale(240), 4, '240 px over 60 m');
  const view = localView(0, 0, 240);
  // A point MINIMAP_RADIUS metres east or south lands exactly on the edge.
  near(project(view, MINIMAP_RADIUS, 0).x, 240, 'east edge'); near(project(view, 0, MINIMAP_RADIUS).y, 240, 'south edge');
  near(project(view, -MINIMAP_RADIUS, 0).x, 0, 'west edge'); near(project(view, 0, -MINIMAP_RADIUS).y, 0, 'north edge');
});

test('the corner map is centred on the player, north up', () => {
  const view = localView(12, -7, 200), me = project(view, 12, -7);
  near(me.x, 100, 'x centre'); near(me.y, 100, 'y centre');
  // World x grows to the right and world z grows down, whatever the player looks at.
  const east = project(view, 22, -7), north = project(view, 12, -17);
  assert.ok(east.x > me.x && east.y === me.y); assert.ok(north.y < me.y && north.x === me.x);
});

test('the full court fits the canvas', () => {
  const view = courtView({ x: 40, z: 26 }, 300), corner = project(view, 40, 26), other = project(view, -40, -26);
  for (const p of [corner, other]) { assert.ok(p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 300, JSON.stringify(p)); }
  near(project(view, 0, 0).x, 150, 'court centre');
});

test('a long court fills a canvas of its own shape', () => {
  // El Puerto: 58 x 32 m half extents on a 300 x 168 canvas.
  const view = courtView({ x: 58, z: 32 }, 300, 168), c = project(view, 0, 0);
  near(c.x, 150, 'centre x'); near(c.y, 84, 'centre y');
  const ne = project(view, 58, -32); assert.ok(ne.x <= 300 && ne.x > 290 && ne.y >= 0 && ne.y < 10, JSON.stringify(ne));
  const off = clampToEdge({ x: 150, y: -500 }, 300, 4, 168); near(off.x, 150, 'top edge x'); near(off.y, 4, 'top edge y');
});

test('points inside the window stay put, others clamp to the edge pointing their way', () => {
  const inside = clampToEdge({ x: 50, y: 80 }, 200, 5);
  assert.deepEqual([inside.inside, inside.x, inside.y], [true, 50, 80]);
  // Far east, a little north: on the right edge, same direction from the centre.
  const east = clampToEdge({ x: 700, y: 50 }, 200, 5);
  assert.equal(east.inside, false); near(east.x, 195, 'right edge');
  near(Math.atan2(east.y - 100, east.x - 100), Math.atan2(50 - 100, 700 - 100), 'direction kept');
  near(east.angle, Math.atan2(-50, 600), 'angle points out');
  // A diagonal lands on the corner of the inset square; due south on the bottom edge.
  const corner = clampToEdge({ x: -400, y: -400 }, 200, 5); near(corner.x, 5, 'corner x'); near(corner.y, 5, 'corner y');
  const south = clampToEdge({ x: 100, y: 1000 }, 200, 5); near(south.x, 100, 'south x'); near(south.y, 195, 'south y'); near(south.angle, Math.PI / 2, 'south angle');
});

test('a teammate 80 m away is marked on the edge of a 30 m map', () => {
  const view = localView(0, 0, 180), spot = clampToEdge(project(view, 80, 0), 180, 6);
  assert.equal(spot.inside, false); near(spot.x, 174, 'right edge'); near(spot.y, 90, 'level with you');
  const close = clampToEdge(project(view, 20, 0), 180, 6); assert.equal(close.inside, true);
});
