import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONES, STATIONS, VENTS, HIDES, FIXES, SEATS, FIRE, REACH, walkable, findPath, pathLength, floorAt, sightClear, zoneAt, distance,
} from '../public/layout.js';
import { SPEED } from '../public/rules.js';

const start = { x: 0, z: 4.5 };
// A walkable spot within reach of a map object.
function standAt(spot, reach = REACH, state = {}) {
  for (const r of [1.1, 1.4, reach - 0.1]) for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, p = { x: spot.x + Math.cos(a) * r, z: spot.z + Math.sin(a) * r };
    if (walkable(p.x, p.z, state)) return p;
  }
  return null;
}
const seconds = (to, state = {}) => { const path = findPath(start, to, state); return path.length ? pathLength(start, path) / SPEED : Infinity; };

test('every zone joins the map', () => {
  for (const z of ZONES) {
    const p = { x: z.x, z: z.z };
    const spot = walkable(p.x, p.z) ? p : standAt(p, 3);
    assert.ok(spot, `${z.id} has room to stand`);
    assert.ok(Number.isFinite(seconds(spot)), `${z.id} is reachable from the fogata`);
  }
});

test('every station, vent, hiding spot, fix and meeting seat can be reached', () => {
  const spots = [...STATIONS, ...VENTS.map(v => ({ ...v, reach: 1.6 })), ...HIDES.map(h => ({ ...h, reach: 1.6 })),
    ...Object.entries(FIXES).flatMap(([k, list]) => list.map((f, i) => ({ ...f, id: `${k}-${i}`, reach: f.r })))];
  for (const s of spots) {
    const p = standAt(s, s.reach || REACH);
    assert.ok(p, `${s.id} has a walkable spot within reach`);
    assert.ok(Number.isFinite(seconds(p)), `${s.id} is reachable`);
  }
  for (const seat of SEATS) assert.ok(walkable(seat.x, seat.z), 'meeting seats are on open ground');
});

test('the far zones take a real walk, so the team splits up', () => {
  const temple = seconds(standAt(STATIONS.find(s => s.id === 'jeroglificos')));
  const mine = seconds(standAt(STATIONS.find(s => s.id === 'malacate')));
  assert.ok(temple > 13 && temple < 22, `fogata → templo takes ~15 s (${temple.toFixed(1)} s)`);
  assert.ok(mine > 13 && mine < 22, `fogata → mina takes ~15 s (${mine.toFixed(1)} s)`);
  const kitchen = seconds(standAt(STATIONS.find(s => s.id === 'arepas')));
  assert.ok(kitchen < 8, `the kitchen is close (${kitchen.toFixed(1)} s)`);
});

test('the stations are spread over the map, none at the fogata', () => {
  const zones = new Set(STATIONS.map(s => zoneAt(s).id));
  assert.ok(zones.size >= 8, `stations in ${zones.size} zones`);
  assert.ok(!zones.has('fogata'), 'no task keeps you at the fire');
});

test('a cut bridge splits the west from the fogata, but the tunnel goes around', () => {
  const cascade = standAt(STATIONS.find(s => s.id === 'agua'));
  const open = seconds(cascade), cut = seconds(cascade, { bridgeCut: true });
  assert.ok(Number.isFinite(cut), 'still reachable through the mine and the tunnel');
  assert.ok(cut > open * 1.8, `the long way round (${open.toFixed(1)} s → ${cut.toFixed(1)} s)`);
  assert.equal(walkable(-17, 0, { bridgeCut: true }), false);
  assert.equal(walkable(-17, 0), true);
});

test('walls block sight, open ground does not', () => {
  assert.ok(sightClear({ x: -5, z: 0 }, { x: 5, z: 0 }), 'across the fogata');
  assert.ok(!sightClear({ x: 0, z: 0 }, { x: -30, z: -30 }), 'not through the jungle to the cascade');
  assert.ok(!sightClear({ x: 24, z: -28 }, { x: 36, z: 0 }), 'not from the depot into the radio tent');
  assert.ok(floorAt(FIRE.x, FIRE.z) && !walkable(FIRE.x, FIRE.z), 'nobody stands in the fire');
});

test('vents link in pairs across zones', () => {
  for (const v of VENTS) {
    const other = VENTS.find(o => o.id === v.link);
    assert.ok(other && other.link === v.id, `${v.id} ↔ ${v.link}`);
    assert.notEqual(zoneAt(v).id, zoneAt(other).id);
    assert.ok(distance(v, other) > 20, `${v.id} is a real shortcut`);
  }
});
