import test from 'node:test';
import assert from 'node:assert/strict';
import { MINIMAP_RADIUS, SHOT_REACH, SHOT_REVEAL, minimapScale, localView, courtView, project, clampToEdge, createShotReveal, rivalShown, sceneryBoxes } from '../public/minimap.js';
import { Arena, shotIsLoud } from '../public/rules.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('the corner map stays tight around you', () => {
  assert.ok(MINIMAP_RADIUS <= 20, 'a whole yard is too far out to read');
  near(minimapScale(240, 30), 4, '240 px over 60 m');
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

test('a teammate 80 m away is marked on the edge of the map', () => {
  const view = localView(0, 0, 180), spot = clampToEdge(project(view, 80, 0), 180, 6);
  assert.equal(spot.inside, false); near(spot.x, 174, 'right edge'); near(spot.y, 90, 'level with you');
  const close = clampToEdge(project(view, MINIMAP_RADIUS / 2, 0), 180, 6); assert.equal(close.inside, true);
});

test('a rival stays hidden until a loud shot, then fades out', () => {
  const reveal = createShotReveal(), p = { id: 2, loud: 0 };
  reveal.update([p], 10); assert.equal(reveal.amount(2, 10), 0, 'hidden by default');
  reveal.update([p], 11); assert.equal(reveal.amount(2, 11), 0, 'standing still shows nothing');
  p.loud = 1; reveal.update([p], 12);
  assert.equal(reveal.amount(2, 12), 1, 'the shot shows the dot');
  const late = reveal.amount(2, 12 + SHOT_REVEAL * .9); assert.ok(late > 0 && late < 1, `it fades (${late})`);
  assert.equal(reveal.amount(2, 12 + SHOT_REVEAL + .01), 0, 'then it is gone');
});

test('a silenced shot never raises the counter the map reads', () => {
  assert.equal(shotIsLoud({}), true); assert.equal(shotIsLoud({ silenced: true }), false);
  const reveal = createShotReveal(), p = { id: 2, loud: 3, fired: 3 };
  reveal.update([p], 1); p.fired = 9; reveal.update([p], 2);
  assert.equal(reveal.amount(2, 2), 0, 'fired rose, loud did not');
});

test('the first look at a pana and a lower count reveal nobody', () => {
  const reveal = createShotReveal(), p = { id: 2, loud: 40 };
  reveal.update([p], 1); assert.equal(reveal.amount(2, 1), 0, 'joined mid-round');
  p.loud = 0; reveal.update([p], 2); assert.equal(reveal.amount(2, 2), 0, 'a new simulation');
});

test('a shot shows only within reach, and the class shortens it', () => {
  const me = { x: 0, z: 0 };
  assert.equal(rivalShown(me, { x: SHOT_REACH - 1, z: 0 }, 1), 1);
  assert.equal(rivalShown(me, { x: SHOT_REACH + 1, z: 0 }, 1), 0);
  assert.equal(rivalShown(me, { x: 20, z: 0, mark: .55 }, 1), 0, 'Sigiloso: 16.5 m');
  assert.equal(rivalShown(me, { x: 16, z: 0, mark: .55 }, 1), 1);
  assert.equal(rivalShown(me, { x: 1, z: 0 }, 0), 0, 'no recent shot: hidden however close');
  assert.ok(!rivalShown(null, { x: 1, z: 0 }, 1), 'no pana of your own');
});

test('scenery keeps what stands on the floor, not the ground, roofs or hills', () => {
  const tri = (minX, minY, minZ, maxX, maxY, maxZ) => [minX, minY, minZ, maxX, maxY, maxZ];
  const boxes = sceneryBoxes(Float32Array.from([
    ...tri(-30, 0, -30, 30, .02, 30),  // the ground
    ...tri(0, 4, 0, 6, 4.5, 6),        // a roof
    ...tri(-200, 0, -200, 200, 40, 200), // a hill
    ...tri(5, 0, 5, 7, 3, 5),          // a wall: tall and thin from above
    ...tri(1, 1, 1, 2, 3, 2),          // a trunk reaching past head height
    ...tri(40, 0, 2, 70, 6, 2.2),      // a long wall: wide one way only
  ]));
  assert.deepEqual(boxes.map(b => b.map(n => Math.round(n * 10) / 10)), [[5, 5, 7, 5], [1, 1, 2, 2], [40, 2, 70, 2.2]]);
});

test('a loud shot counts on the pana, for every client to read', () => {
  const g = new Arena('terminal', 'normal', {}); g.add(1, { name: 'A', avatar: {} }); g.start(); g.go();
  const p = g.players[0]; assert.equal(p.loud, 0);
  g.step(1 / 30, new Map([[1, { x: 0, z: 0, fire: true, ax: 0, az: -1 }]]));
  assert.equal(p.fired, 1); assert.equal(p.loud, 1);
  assert.equal(g.view().players[0].loud, 1, 'it travels in the snapshot');
});
