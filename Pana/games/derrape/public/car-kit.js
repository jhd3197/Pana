// Shared building blocks for Derrape's toy cars: materials, wheels, glass,
// cabins with a pana driver, decals and bolt-on parts.
// Every car faces +Z, its left is +X, wheels touch y = 0.

import * as THREE from 'three';
import { buildCharacter } from '/engine/character.js';
import { venezuelaFlag } from '/engine/props.js';

const mats = new Map();
function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, ...extra }));
  }
  return mats.get(key);
}
// decals sit flush on the paint without flickering
const DECAL = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
const CHROME = () => M('#dfe2e8', { metalness: 0.7, roughness: 0.25 });
const DARK = () => M('#1d1d23', { roughness: 0.8 });

const GLASS = new THREE.MeshStandardMaterial({
  color: 0x6d8fae, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.4,
  side: THREE.DoubleSide, depthWrite: false,
});
const GLARE = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

// Extrude a side profile [(z, y), ...] across the car's width. The bevel
// grows the outline by `bevel` in every direction.
function profile(points, width, mat, bevel = 0.1) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3,
  });
  geo.rotateY(-Math.PI / 2);   // shape x -> car z, extrusion -> car x
  geo.translate(depth / 2, 0, 0);
  return mesh(geo, mat);
}

// A box between two (z, y) points, e.g. a window pillar.
function strut(p0, p1, x, thick, mat) {
  const dz = p1[0] - p0[0], dy = p1[1] - p0[1];
  const m = box(thick, Math.hypot(dz, dy), thick, mat, x, (p0[1] + p1[1]) / 2, (p0[0] + p1[0]) / 2);
  m.rotation.x = Math.atan2(dz, dy);
  return m;
}

// A flat pane spanning the car's width between two (z, y) points.
function pane(p0, p1, width, mat) {
  const dz = p1[0] - p0[0], dy = p1[1] - p0[1];
  const m = mesh(new THREE.PlaneGeometry(width, Math.hypot(dz, dy)), mat, 0, (p0[1] + p1[1]) / 2, (p0[0] + p1[0]) / 2);
  m.rotation.x = Math.atan2(dz, dy);
  m.castShadow = false;
  return m;
}

function tube(a, b, r, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// Keep the part of a (z, y) polygon with z <= zMax.
function clipZ(points, zMax) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ina = a[0] <= zMax, inb = b[0] <= zMax;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (zMax - a[0]) / (b[0] - a[0]);
      out.push([zMax, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

function sidePane(points, x) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateY(-Math.PI / 2);
  const m = mesh(geo, GLASS, x, 0, 0);
  m.castShadow = false;
  m.renderOrder = 2;
  return m;
}

function canvasMat(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, transparent: true, ...DECAL });
}

const roundelCache = new Map();
function roundel(num, size) {
  if (!roundelCache.has(num)) {
    roundelCache.set(num, canvasMat(256, 256, (g) => {
      g.fillStyle = '#16161a';
      g.beginPath();
      g.arc(128, 128, 127, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fbf8f0';
      g.beginPath();
      g.arc(128, 128, 116, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#16161a';
      g.font = '900 172px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(num), 128, 138);
    }));
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), roundelCache.get(num));
}

function plate(text) {
  return new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), canvasMat(256, 84, (g) => {
    g.fillStyle = '#f4f1e6';
    g.fillRect(0, 0, 256, 84);
    g.fillStyle = '#1d4e89';
    g.fillRect(0, 0, 256, 18);
    g.strokeStyle = '#16161a';
    g.lineWidth = 6;
    g.strokeRect(3, 3, 250, 78);
    g.fillStyle = '#16161a';
    g.font = 'bold 50px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(text, 128, 70);
  }));
}

// Put the same flat decal on both sides of the car, facing out.
function bothSides(group, make, x, y, z) {
  for (const s of [1, -1]) {
    const d = make();
    d.position.set(s * x, y, z);
    d.rotation.y = s * Math.PI / 2;
    group.add(d);
  }
}

function spot(size, color) {
  return new THREE.Mesh(new THREE.CircleGeometry(size, 7), M(color, DECAL));
}

// ---------- wheels ----------
function makeWheel({ r, w, style, rim = '#c9ccd4', cap = '#d62828' }) {
  const g = new THREE.Group();
  const pts = [[0.6, -0.5], [0.9, -0.5], [1, -0.32], [1, 0.32], [0.9, 0.5], [0.6, 0.5]]
    .map(([rr, x]) => new THREE.Vector2(rr * r, x * w));
  const tire = new THREE.LatheGeometry(pts, 14);
  tire.rotateZ(Math.PI / 2);
  g.add(mesh(tire, M('#1b1b20', { roughness: 0.95 })));
  const knob = new THREE.BoxGeometry(w * 0.86, r * 0.16, r * 0.26);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const k = mesh(knob, M('#26262d', { roughness: 0.95 }), 0, Math.cos(a) * r, Math.sin(a) * r);
    k.rotation.x = a;
    g.add(k);
  }
  const face = new THREE.Group();   // outer side, +X
  face.position.x = w * 0.3;
  g.add(face);
  const disc = new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.06, 12);
  disc.rotateZ(Math.PI / 2);
  if (style === 'spokes') {
    face.add(mesh(disc, M('#2a2a30')));
    const rimRing = new THREE.TorusGeometry(r * 0.56, r * 0.06, 5, 14);
    rimRing.rotateY(Math.PI / 2);
    face.add(mesh(rimRing, M(rim, { metalness: 0.5, roughness: 0.35 }), 0.04, 0, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sp = box(0.06, r * 0.5, r * 0.14, M(rim, { metalness: 0.5, roughness: 0.35 }), 0.05, Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
      sp.rotation.x = a;
      face.add(sp);
    }
    const capGeo = new THREE.CylinderGeometry(r * 0.14, r * 0.17, 0.12, 8);
    capGeo.rotateZ(Math.PI / 2);
    face.add(mesh(capGeo, M(cap), 0.08, 0, 0));
  } else if (style === 'steel') {
    // off-road steel wheel: dark dish, ring of lug holes, silver center
    face.add(mesh(disc, M('#2c2c33', { roughness: 0.6 })));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hole = new THREE.CylinderGeometry(r * 0.07, r * 0.07, 0.08, 6);
      hole.rotateZ(Math.PI / 2);
      face.add(mesh(hole, M('#141418'), 0.02, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36));
    }
    const hub = new THREE.CylinderGeometry(r * 0.17, r * 0.2, 0.12, 8);
    hub.rotateZ(Math.PI / 2);
    face.add(mesh(hub, M(rim, { metalness: 0.5, roughness: 0.35 }), 0.06, 0, 0));
  } else {
    face.add(mesh(disc, M('#9aa0aa', { metalness: 0.4, roughness: 0.4 })));
    const dome = new THREE.SphereGeometry(r * 0.36, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateZ(-Math.PI / 2);
    face.add(mesh(dome, CHROME(), 0.03, 0, 0));
    const white = new THREE.TorusGeometry(r * 0.78, r * 0.07, 4, 16);
    white.rotateY(Math.PI / 2);
    face.add(mesh(white, M('#f4f1e6'), 0.06, 0, 0));
  }
  return g;
}

function fender(r, w, color) {
  const geo = new THREE.CylinderGeometry(r, r, w, 12, 1, true, 0, Math.PI);
  geo.rotateZ(Math.PI / 2);
  return mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, side: THREE.DoubleSide }));
}

// ---------- shared assembly ----------
function rig(spec) {
  const root = new THREE.Group();
  const tumble = new THREE.Group();     // flips and spins
  tumble.position.y = 1;
  root.add(tumble);
  const inner = new THREE.Group();
  inner.position.y = -1;
  tumble.add(inner);
  const chassis = new THREE.Group();   // rides the suspension
  inner.add(chassis);

  const wheels = [];
  for (const [x, z, front] of spec.wheelPos) {
    const steer = new THREE.Group();
    steer.position.set(x, spec.wheel.r, z);
    const spin = new THREE.Group();
    const w = makeWheel(spec.wheel);
    if (x < 0) w.rotation.y = Math.PI;
    spin.add(w);
    steer.add(spin);
    inner.add(steer);
    wheels.push({ steer, spin, front });
  }
  return { root, tumble, chassis, wheels, radius: spec.wheel.r, detachables: [], danglers: [] };
}

// Detachable parts get their pivot at their own center so they tumble
// nicely when they fly off.
function detachable(car, obj) {
  const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  // Children use local coordinates. Subtracting the world center moved
  // pre-positioned accessories (notably spare wheels) into the car's origin.
  const localCenter = obj.worldToLocal(center.clone());
  for (const child of obj.children) child.position.sub(localCenter);
  obj.position.copy(center);
  car.chassis.add(obj);
  car.detachables.push(obj);
  return obj;
}

// Cabin: glass panes, pillars, roof, dashboard, seats, steering wheel and
// the driver (window rolled down, elbow out).
function cabin(car, o) {
  const c = car.chassis;
  const [rb, fb, ft, rt] = o.glass;   // rear-bottom, front-bottom, front-top, rear-top
  const half = o.width / 2;

  if (!o.open) {
    c.add(sidePane(o.glass, -half));                  // passenger side: closed
    c.add(sidePane(clipZ(o.glass, o.bPillar), half)); // driver side: rear window only
  }
  const shield = pane(fb, ft, o.width - 0.08, GLASS);
  shield.renderOrder = 2;
  c.add(shield);
  const glare = pane([fb[0] - 0.12, fb[1] + 0.35], [ft[0] + 0.25, ft[1] - 0.4], 0.16, GLARE);
  glare.position.x = -0.35;
  glare.position.z += 0.02;
  glare.renderOrder = 3;
  c.add(glare);
  if (o.open) {
    // open top (jeep, buggy): just a framed windshield; the builder adds the cage
    for (const s of [1, -1]) c.add(strut(fb, ft, s * (half - 0.02), 0.1, o.pillar));
    c.add(box(o.width, 0.1, 0.1, o.pillar, 0, ft[1], ft[0]));
  } else {
    const back = pane(rb, rt, o.width - 0.08, GLASS);
    back.renderOrder = 2;
    c.add(back);
    for (const s of [1, -1]) {
      c.add(strut(fb, ft, s * (half - 0.02), 0.12, o.pillar));
      c.add(strut([o.bPillar, fb[1]], [o.bPillar, ft[1]], s * (half - 0.01), 0.12, o.pillar));
      c.add(strut(rb, rt, s * (half - 0.03), 0.14, o.pillar));
    }
    c.add(profile(o.roof, o.width + 0.14, o.roofMat, 0.07));
  }

  // interior
  const inside = M(o.interior);
  c.add(box(o.width - 0.2, 0.04, fb[0] - rb[0] - 0.2, inside, 0, fb[1] + 0.01, (fb[0] + rb[0]) / 2));
  const dashTop = fb[1] + 0.18;
  c.add(box(o.width - 0.16, 0.18, 0.4, inside, 0, fb[1] + 0.09, fb[0] - 0.3));
  for (const s of [1, -1]) {
    const gauge = mesh(new THREE.CircleGeometry(0.06, 10), M('#f4f1e6', { emissive: '#3a3a20' }), 0.45 + s * 0.12, dashTop + 0.01, fb[0] - 0.36);
    gauge.rotation.x = -Math.PI / 2 + 0.5;   // set into the top of the dash, tilted at the driver
    c.add(gauge);
  }
  const seat = M(o.seat);
  for (const x of [0.45, -0.45]) {
    c.add(box(0.66, 0.9, 0.18, seat, x, fb[1] + 0.3, o.driverZ - 0.42));
    c.add(box(0.44, 0.24, 0.14, seat, x, fb[1] + 0.86, o.driverZ - 0.44));
  }
  // rear-view mirror with something hanging from it
  const mirror = box(0.36, 0.1, 0.05, DARK(), 0, ft[1] - 0.18, ft[0] - 0.14);
  c.add(mirror);
  if (o.hanging) {
    const pivot = new THREE.Group();
    pivot.position.set(0, ft[1] - 0.24, ft[0] - 0.14);
    pivot.add(tube([0, 0, 0], [0, -0.22, 0], 0.008, DARK()));
    o.hanging(pivot);
    c.add(pivot);
    car.danglers.push(pivot);
  }

  // the driver
  const pana = buildCharacter(o.avatar, { head: o.head, seated: true });
  pana.group.position.set(0.45, o.seatY, o.driverZ);
  c.add(pana.group);
  // Seat the driver so the whole face clears the window sill; if a tall hat
  // or an afro would then hit the roof, shrink the head instead of sinking it.
  // Scaling happens at the neck so the head stays on the shoulders.
  const roofBottom = o.open ? Infinity : o.roof.reduce((m, [, y]) => Math.min(m, y), 9) - 0.1;
  const v = new THREE.Vector3();
  for (let i = 0; i < 4; i++) {
    car.root.updateMatrixWorld(true);
    const mouth = pana.head.getWorldPosition(v).y - 0.45 * o.head * pana.neck.scale.y;
    pana.group.position.y += Math.max(0, Math.max(o.sill, dashTop) + 0.12 - mouth);
    car.root.updateMatrixWorld(true);
    const neckY = pana.neck.getWorldPosition(v).y;
    const top = new THREE.Box3().setFromObject(pana.head).max.y;
    if (top <= roofBottom) break;
    pana.neck.scale.multiplyScalar((roofBottom - neckY) / (top - neckY));
  }
  pana.armL.rotation.set(0.2, 0, 1.3);     // elbow out the open window
  pana.armR.rotation.set(-1.15, 0, 0.25);  // hand on the wheel
  const sy = pana.group.position.y;
  const wheel = mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 14), DARK(), 0.4, sy + 0.42, o.driverZ + 0.52);
  wheel.rotation.x = -0.45;
  c.add(wheel);
  c.add(tube([0.4, sy + 0.42, o.driverZ + 0.52], [0.4, fb[1] + 0.2, fb[0] - 0.2], 0.04, DARK()));
  car.driver = pana;
}

// ---------- extra parts for the bigger garage ----------

// A row of round off-road lamps on a black bar, facing forward.
function lightBar(n, gap, y, z) {
  const g = new THREE.Group();
  g.add(box(n * gap + 0.12, 0.1, 0.14, DARK(), 0, y, z));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap;
    const housing = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 10), DARK(), x, y + 0.14, z + 0.02);
    housing.rotation.x = Math.PI / 2;
    g.add(housing);
    const lamp = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 10), M('#ffe066', { emissive: '#b08a00' }), x, y + 0.14, z + 0.11);
    lamp.rotation.x = Math.PI / 2;
    g.add(lamp);
  }
  return g;
}

// A spare wheel standing up, axle along z (for the back of a jeep).
function spareWheel(r, w) {
  const g = new THREE.Group();
  const wheel = makeWheel({ r, w, style: 'steel' });
  wheel.rotation.y = -Math.PI / 2;
  g.add(wheel);
  return g;
}

function roundLamp(x, y, z, r = 0.22, color = '#ffd23f') {
  const g = new THREE.Group();
  const lamp = mesh(new THREE.CylinderGeometry(r, r, 0.1, 12), M(color, { emissive: '#6b5200' }), x, y, z);
  lamp.rotation.x = Math.PI / 2;
  g.add(lamp);
  g.add(mesh(new THREE.TorusGeometry(r + 0.02, 0.04, 6, 14), CHROME(), x, y, z + 0.05));
  return g;
}


let flowerMat = null;
function flower(size) {
  flowerMat ||= canvasMat(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(64 + Math.cos(a) * 32, 64 + Math.sin(a) * 32, 26, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffc629';
    g.beginPath();
    g.arc(64, 64, 22, 0, Math.PI * 2);
    g.fill();
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), flowerMat);
}

export {
  M, DECAL, CHROME, DARK, mesh, box, profile, strut, pane, tube, canvasMat, roundel, plate, bothSides, spot, makeWheel, fender, rig, detachable, cabin, lightBar, spareWheel, roundLamp, venezuelaFlag, flower,
};
