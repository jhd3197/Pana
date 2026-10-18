// Shared building blocks for Derrape's toy cars: materials, wheels, glass,
// cabins with a pana driver, decals and bolt-on parts.
// Every car faces +Z, its left is +X, wheels touch y = 0.

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { venezuelaFlag } from '/engine/models/props/flags.js';

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
  color: 0x304b65, transparent: true, opacity: 0.19, roughness: 0.15, metalness: 0.2,
  side: THREE.DoubleSide, depthWrite: false,
});
const GLARE = new THREE.MeshBasicMaterial({ color: 0xcde7ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

// Broad chamfers on bumpers, cargo and lamp housings, rather than razor edges.
function bevelBox(w, h, d, material, x = 0, y = 0, z = 0, bevel = 0.05) {
  const b = Math.min(bevel, w / 5, h / 5, d / 5);
  const m = profile([[-d / 2 + b, -h / 2 + b], [d / 2 - b, -h / 2 + b],
    [d / 2 - b, h / 2 - b], [-d / 2 + b, h / 2 - b]], w, material, b);
  m.position.set(x, y, z);
  return m;
}

// Batch rigid details only; steering, drivers and detachable groups stay free.
function batchParts(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), originals = new Set();
  group.traverse(part => {
    if (!part.isMesh) return;
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    g.applyMatrix4(part.matrixWorld);
    if (!buckets.has(part.material)) buckets.set(part.material, []);
    buckets.get(part.material).push(g); originals.add(part.geometry);
  });
  group.clear();
  for (const [material, geos] of buckets) {
    group.add(mesh(mergeGeometries(geos, false), material));
    geos.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose());
  return group;
}

function squareLamp(w, h, x, y, z) {
  const g = new THREE.Group();
  g.add(bevelBox(w + 0.12, h + 0.12, 0.14, DARK(), x, y, z));
  g.add(bevelBox(w + 0.045, h + 0.045, 0.06, CHROME(), x, y, z + 0.085, 0.018));
  g.add(bevelBox(w, h, 0.04, M('#ffe4a0', { emissive: '#ffbb46', emissiveIntensity: 0.65 }), x, y, z + 0.12, 0.012));
  return g;
}

function towLoop(x, y, z) {
  const g = new THREE.Group();
  g.add(bevelBox(0.22, 0.27, 0.16, M('#3b3e46'), x, y + 0.09, z));
  g.add(mesh(new THREE.TorusGeometry(0.12, 0.045, 5, 8), CHROME(), x, y - 0.06, z + 0.11));
  return g;
}

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

// Cross sections [z, half width, sill, shoulder, crown] for bodies whose noses
// narrow in plan view. Broad flat facets keep the same low-poly construction.
function bodyShell(sections, material) {
  const rings = sections.map(([z, w, sill, shoulder, crown]) => [
    [-w, sill, z], [-w, shoulder, z], [-w * 0.72, crown, z],
    [w * 0.72, crown, z], [w, shoulder, z], [w, sill, z],
  ]);
  const vertices = [];
  const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    triangle(rings[k][i], rings[k + 1][i], rings[k + 1][j]);
    triangle(rings[k][i], rings[k + 1][j], rings[k][j]);
  }
  for (let i = 1; i < 5; i++) {
    triangle(rings[0][0], rings[0][i], rings[0][i + 1]);
    triangle(rings.at(-1)[0], rings.at(-1)[i + 1], rings.at(-1)[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return mesh(geometry, material);
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

const plateCache = new Map();
function plate(text) {
  if (!plateCache.has(text)) plateCache.set(text, canvasMat(256, 84, (g) => {
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
  return new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), plateCache.get(text));
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

// ---------- kit v2: filleted, tapered bodies ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Smooth-shaded materials for the filleted v2 parts (the low-poly helpers
// above stay flat shaded). Paint gets a little sheen; acabado can change it.
const S = (color, extra = {}) => M(color, { flatShading: false, roughness: 0.5, ...extra });
const PAINT = (color) => S(color, { roughness: 0.36, metalness: 0.08 });

// A closed (z, y) outline with a quadratic fillet of radius r at every
// point [z, y, r]; r 0 keeps a sharp corner.
function roundedPath(points, path = new THREE.Shape()) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const P = points[i], A = points[(i + n - 1) % n], B = points[(i + 1) % n], r = P[2] || 0;
    if (!r) { if (i) path.lineTo(P[0], P[1]); else path.moveTo(P[0], P[1]); continue; }
    const li = Math.hypot(P[0] - A[0], P[1] - A[1]), lo = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const k = Math.min(r, li * 0.48, lo * 0.48);
    const a = [P[0] + (A[0] - P[0]) / li * k, P[1] + (A[1] - P[1]) / li * k];
    const b = [P[0] + (B[0] - P[0]) / lo * k, P[1] + (B[1] - P[1]) / lo * k];
    if (i) path.lineTo(a[0], a[1]); else path.moveTo(a[0], a[1]);
    path.quadraticCurveTo(P[0], P[1], b[0], b[1]);
  }
  path.closePath();
  return path;
}

// Wheel arches for a side profile that runs front-bottom, over the top, to
// rear-bottom: the bottom edge then returns forward, bowing up round each axle.
function archedSide(side, { axles, hub, archR, sill }) {
  const th0 = Math.asin(clamp((sill - hub) / archR, -1, 1));
  return [...side, ...[...axles].sort((a, b) => a - b).flatMap(axle => {
    const arc = [];
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI - th0 + (2 * th0 - Math.PI) * k / 12;
      arc.push([axle + archR * Math.cos(a), hub + archR * Math.sin(a), 0]);
    }
    return arc;
  })];
}

// Extrude a (z, y) shape across x from x0 to x1 with a rounded bevel, then
// pinch it in plan view with taper(z, y) (scales x). Creased normals keep the
// fillets smooth and the panel edges crisp.
function extrudeX(shape, x0, x1, { bevel = 0.06, taper = null, segments = 6 } = {}) {
  const depth = Math.max(0.002, x1 - x0 - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: segments,
  });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getX(i), y = p.getY(i), x = x1 - bevel - p.getZ(i);
    p.setXYZ(i, x * (taper ? taper(z, y) : 1), y, z);
  }
  const out = toCreasedNormals(g, 0.62);
  g.dispose();
  return out;
}

// Where a closed outline crosses the line z = v (along false) or y = v.
function crossings(poly, along, v) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const av = along ? a.y : a.x, bv = along ? b.y : b.x;
    if ((av - v) * (bv - v) <= 0 && av !== bv) {
      const t = (v - av) / (bv - av);
      out.push(along ? a.x + (b.x - a.x) * t : a.y + (b.y - a.y) * t);
    }
  }
  return out;
}

// Rounded box: corner vertices pushed onto spheres, cached by size.
const rbCache = new Map();
function RB(w, h, d, r = 0.05) {
  const key = [w, h, d, r].map(v => v.toFixed(3)).join(',');
  if (rbCache.has(key)) return rbCache.get(key);
  r = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2), p = g.attributes.position, hh = [w / 2, h / 2, d / 2];
  const v = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    for (let k = 0; k < 3; k++) if (Math.abs(Math.abs(v[k]) - hh[k]) > 1e-5) v[k] = Math.sign(v[k]) * (hh[k] - r);
    const inner = v.map((c, k) => clamp(c, -(hh[k] - r), hh[k] - r)), n = v.map((c, k) => c - inner[k]), L = Math.hypot(...n);
    if (L > 1e-6) for (let k = 0; k < 3; k++) v[k] = inner[k] + n[k] / L * r;
    p.setXYZ(i, v[0], v[1], v[2]);
  }
  const out = toCreasedNormals(g, 0.8);
  g.dispose();
  rbCache.set(key, out);
  return out;
}
const rbox = (w, h, d, mat, x = 0, y = 0, z = 0, r = 0.05) => mesh(RB(w, h, d, r), mat, x, y, z);

// The v2 lower body: two side slabs with the wheel arches cut out and a
// center tub between them, filleted and pinched at the nose and tail.
// side: [[z, y, r], ...] from the front bottom, over the top, to the rear
// bottom. Returns the body's fit, which places every other part:
// noseZ(y) / tailZ(y) are the front / rear face at a height, topOf(z) the
// top line, halfW(z) the half width in plan view.
// tub: an optional outline for the center (a pickup's bed is lower there).
function shellBody(car, { side, tub = side, width, axles, hub, archR, sill, slab = 0.36, taper = {}, paint, well = '#1a1a20', bevel = 0.07 }) {
  const c = car.chassis, W2 = width / 2;
  const zF = Math.max(...side.map(p => p[0])), zR = Math.min(...side.map(p => p[0]));
  const { f = 0.08, zf = zF - 1.1, r = 0.05, zr = zR + 0.9 } = taper;
  const pinch = z => 1 - f * clamp((z - zf) / (zF - zf), 0, 1) ** 2 - r * clamp((zr - z) / (zr - zR), 0, 1) ** 2;
  const tz = z => pinch(z);
  const sideShape = roundedPath(archedSide(side, { axles, hub, archR, sill }));
  const tubShape = roundedPath(tub);
  const inner = W2 - slab;
  for (const s of [1, -1]) {
    const g = extrudeX(sideShape, s > 0 ? inner : -W2, s > 0 ? W2 : -inner, { bevel, taper: tz });
    c.add(mesh(g, paint));
  }
  c.add(mesh(extrudeX(tubShape, -inner - 0.02, inner + 0.02, { bevel: 0.03, taper: tz }), paint));
  // dark wheel wells and an under tray hide the tub's flank inside the arches
  const wellMat = S(well, { roughness: 0.9, side: THREE.DoubleSide });
  for (const z of axles) for (const s of [1, -1]) {
    const disc = mesh(new THREE.CircleGeometry(archR - 0.02, 14, 0, Math.PI), wellMat, s * ((inner + 0.02) * tz(z) + 0.012), hub, z);
    disc.rotation.y = s * Math.PI / 2;
    disc.castShadow = false;
    c.add(disc);
  }
  c.add(rbox(width * 0.78, 0.1, (zF - zR) * 0.82, wellMat, 0, sill + 0.02, (zF + zR) / 2, 0.04));
  const poly = tubShape.getPoints(8);
  const at = (along, v, pick, fallback) => { const hit = crossings(poly, along, v); return hit.length ? pick(...hit) : fallback; };
  const fit = {
    width, zF, zR, sill, hub, axles, arch: archR, taper: tz,
    // the tub's bevel grows its outline by 0.03 all round
    noseZ: y => at(true, y, Math.max, zF) + 0.03,
    tailZ: y => at(true, y, Math.min, zR) - 0.03,
    topOf: z => at(false, z, Math.max, sill) + 0.03,
    halfW: z => W2 * tz(z),
  };
  car.fit = { ...car.fit, ...fit };
  car.paint = paint;
  return fit;
}

// The fit for a classic extruded body (profile() points [z, y] with a bevel),
// so car-parts.js can dress the low-poly cars as well as the v2 bodies.
function profileFit(car, points, width, bevel, { paint, axles, arch }) {
  const poly = points.map(([z, y]) => new THREE.Vector2(z, y));
  const zF = Math.max(...points.map(p => p[0])) + bevel, zR = Math.min(...points.map(p => p[0])) - bevel;
  const sill = Math.min(...points.map(p => p[1])) - bevel;
  const at = (along, v, pick, fallback) => { const hit = crossings(poly, along, v); return hit.length ? pick(...hit) : fallback; };
  car.fit = {
    ...car.fit, width, zF, zR, sill, hub: car.radius, axles, arch, taper: () => 1,
    noseZ: y => at(true, y, Math.max, zF - bevel) + bevel,
    tailZ: y => at(true, y, Math.min, zR + bevel) - bevel,
    topOf: z => at(false, z, Math.max, sill + bevel) + bevel,
    halfW: () => width / 2,
  };
  car.paint = paint;
}

// A flared arch over a wheel: an extruded half ring, axle at the origin.
function archFlare(r, w, mat, lip = 0.16, drop = 0.12) {
  const th0 = -drop, sh = new THREE.Shape();
  sh.absarc(0, 0, r + lip, Math.PI - th0, th0, true);
  sh.absarc(0, 0, r - 0.03, th0, Math.PI - th0, false);
  sh.closePath();
  return mesh(extrudeX(sh, -w / 2, w / 2, { bevel: 0.035, segments: 10 }), mat);
}

// A round lamp: bezel ring plus a domed lens, facing +z (dir -1 faces back).
function domeLamp(r, lens, bezel = CHROME(), depth = 0.12) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.26, depth, 14), bezel);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const dome = mesh(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lens, 0, 0, depth / 2 - 0.01);
  dome.rotation.x = Math.PI / 2;
  dome.scale.y = 0.4;
  g.add(dome);
  return g;
}
// A rectangular lamp: rounded bezel and lens.
function rectLamp(w, h, lens, bezel = DARK()) {
  const g = new THREE.Group();
  g.add(rbox(w + 0.1, h + 0.1, 0.12, bezel, 0, 0, 0, 0.04));
  g.add(rbox(w, h, 0.06, lens, 0, 0, 0.05, 0.025));
  return g;
}
const LENS = () => S('#fff3d6', { emissive: '#ffd27a', emissiveIntensity: 0.9, roughness: 0.2 });
const AMBER = () => S('#ffc23e', { emissive: '#ff9a1a', emissiveIntensity: 0.6, roughness: 0.25 });
const TAIL = () => S('#ff3b3b', { emissive: '#d0101a', emissiveIntensity: 0.7, roughness: 0.3 });

// ---------- wheels ----------
// Lathe tires with a shoulder, merged tread blocks and a rim face. Old style
// names keep working: spokes = cinco, steel = acero, hubcap = disco.
const RIM_STYLE = { spokes: 'cinco', steel: 'acero', hubcap: 'disco' };
function tireGeometry(r, w, rimR, sh) {
  const prof = [[rimR, -w * 0.44], [r - sh * 1.2, -w / 2], [r - sh * 0.3, -w / 2 + sh * 0.3], [r, -w / 2 + sh],
    [r, w / 2 - sh], [r - sh * 0.3, w / 2 - sh * 0.3], [r - sh * 1.2, w / 2], [rimR, w * 0.44]];
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 22);
  g.rotateZ(Math.PI / 2);
  return g;
}
function treadBlocks(g, kind, r, w, rubber) {
  const ring = (n, make) => {
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      for (const [geo, x, rad, tilt] of make(k)) {
        const m = mesh(geo, rubber, x, Math.cos(a) * rad, Math.sin(a) * rad);
        m.rotation.set(a, tilt, 0);
        g.add(m);
      }
    }
  };
  if (kind === 'barro') {
    const lug = new THREE.BoxGeometry(w * 0.46, r * 0.15, r * 0.26), side = new THREE.BoxGeometry(r * 0.1, r * 0.16, r * 0.22);
    ring(12, k => { const s = k % 2 ? 1 : -1; return [[lug, s * w * 0.2, r + r * 0.03, s * 0.3], [side, s * (w / 2 - 0.01), r - r * 0.06, 0]]; });
  } else if (kind === 'todoterreno') {
    const block = new THREE.BoxGeometry(w * 0.4, r * 0.1, r * 0.2);
    ring(16, k => [[block, w * 0.21 + (k % 2 ? 0.04 : -0.04), r + r * 0.02, 0], [block, -w * 0.21 + (k % 2 ? -0.04 : 0.04), r + r * 0.02, 0]]);
  } else if (kind === 'lluvia') {
    const sipe = new THREE.BoxGeometry(w * 0.34, r * 0.05, r * 0.08);
    ring(18, () => [[sipe, w * 0.2, r + 0.004, 0.55], [sipe, -w * 0.2, r + 0.004, -0.55]]);
  } else if (kind === 'calle') {
    const block = new THREE.BoxGeometry(w * 0.38, r * 0.07, r * 0.16);
    ring(14, k => [[block, w * 0.21 + (k % 2 ? 0.03 : -0.03), r + 0.008, 0], [block, -w * 0.21 + (k % 2 ? -0.03 : 0.03), r + 0.008, 0]]);
  }
}
// One metal look for every rim part, so a race car merges them into one draw.
const METAL = (color) => S(color, { metalness: 0.55, roughness: 0.32 });
function rimFace(face, design, rimR, r, rimMat, capMat) {
  const disk = (rad, d, m, x, seg = 16) => {
    const geo = new THREE.CylinderGeometry(rad, rad, d, seg);
    geo.rotateZ(Math.PI / 2);
    face.add(mesh(geo, m, x, 0, 0));
  };
  const lugs = (n, rad) => {
    const geo = new THREE.CylinderGeometry(r * 0.035, r * 0.035, 0.06, 6);
    geo.rotateZ(Math.PI / 2);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      face.add(mesh(geo, METAL('#dfe2e8'), 0.05, Math.cos(a) * rad, Math.sin(a) * rad));
    }
  };
  const spokes = (n, inner, outer, wide, thin, x = -0.02) => {
    const s = new THREE.Shape([new THREE.Vector2(-wide, inner), new THREE.Vector2(wide, inner),
      new THREE.Vector2(thin, outer), new THREE.Vector2(-thin, outer)]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
    geo.rotateY(Math.PI / 2);
    for (let k = 0; k < n; k++) {
      const m = mesh(geo, rimMat, x, 0, 0);
      m.rotation.x = k / n * Math.PI * 2;
      face.add(m);
    }
  };
  if (design === 'cinco') {
    disk(rimR * 0.3, 0.1, rimMat, 0.02);
    spokes(5, rimR * 0.2, rimR * 0.95, r * 0.09, r * 0.055);
    lugs(5, rimR * 0.17);
    disk(rimR * 0.12, 0.12, capMat, 0.06, 10);
  } else if (design === 'acero') {
    const s = new THREE.Shape();
    s.absarc(0, 0, rimR * 0.96, 0, Math.PI * 2, false);
    for (let k = 0; k < 6; k++) {
      const h = new THREE.Path(), a = k / 6 * Math.PI * 2 + 0.5;
      h.absarc(Math.cos(a) * rimR * 0.6, Math.sin(a) * rimR * 0.6, rimR * 0.15, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    const dish = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 });
    dish.rotateY(Math.PI / 2);
    face.add(mesh(dish, rimMat, -0.03, 0, 0));
    const dome = mesh(new THREE.SphereGeometry(rimR * 0.3, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat, 0.02, 0, 0);
    dome.rotation.z = -Math.PI / 2;
    dome.scale.y = 0.5;
    face.add(dome);
    lugs(5, rimR * 0.42);
  } else if (design === 'disco') {
    const lip = new THREE.LatheGeometry([[rimR * 0.72, 0], [rimR * 0.76, 0.04], [rimR * 0.98, 0.06], [rimR * 1.02, 0.03], [rimR, -0.01]]
      .map(([a, b]) => new THREE.Vector2(a, b)), 18);
    lip.rotateZ(-Math.PI / 2);
    face.add(mesh(lip, METAL('#dfe2e8'), 0.02, 0, 0));
    disk(rimR * 0.76, 0.04, rimMat, -0.04);
    const dome = mesh(new THREE.SphereGeometry(rimR * 0.36, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), METAL('#dfe2e8'), -0.02, 0, 0);
    dome.rotation.z = -Math.PI / 2;
    dome.scale.y = 0.55;
    face.add(dome);
    lugs(8, rimR * 0.58);
  } else if (design === 'malla') {
    disk(rimR * 0.96, 0.02, METAL('#16161b'), -0.06);
    for (let k = 0; k < 10; k++) for (const s of [-1, 1]) {
      const a = k / 10 * Math.PI * 2 + s * 0.12, b = k / 10 * Math.PI * 2 - s * 0.26;
      face.add(tube([0.01, Math.cos(a) * rimR * 0.26, Math.sin(a) * rimR * 0.26], [-0.02, Math.cos(b) * rimR * 0.93, Math.sin(b) * rimR * 0.93], r * 0.026, rimMat));
    }
    disk(rimR * 0.28, 0.09, rimMat, 0.01);
    disk(rimR * 0.13, 0.11, capMat, 0.03, 10);
  } else if (design === 'turbo') {
    disk(rimR * 0.95, 0.03, rimMat, -0.03);
    for (let k = 0; k < 12; k++) {
      const v = new THREE.Group();
      v.rotation.x = k / 12 * Math.PI * 2;
      const vane = box(0.06, rimR * 0.52, r * 0.06, METAL('#8d919b'), 0, rimR * 0.62, 0);
      vane.rotation.y = 0.6;
      v.add(vane);
      face.add(v);
    }
    disk(rimR * 0.3, 0.08, rimMat, 0.02);
    disk(rimR * 0.16, 0.1, capMat, 0.04, 10);
  } else if (design === 'palo') {
    // carved wheel: a wooden disc, four fat spokes and an iron hub
    disk(rimR * 0.95, 0.05, S('#6e4423', { roughness: 0.85 }), -0.04, 14);
    for (let k = 0; k < 4; k++) {
      const v = new THREE.Group();
      v.rotation.x = k / 4 * Math.PI * 2 + 0.4;
      v.add(box(0.1, rimR * 1.7, r * 0.16, rimMat, 0.0, 0, 0));
      face.add(v);
    }
    disk(rimR * 0.26, 0.12, METAL('#2b2b30'), 0.04, 10);
  }
}
// spec: { r, w, style, rim, cap, tread, tire }. tread: calle | barro | lluvia |
// todoterreno | slick | liso; tire is the rubber colour (wooden wheels pass brown).
function makeWheel({ r, w, style = 'spokes', rim = '#c9ccd4', cap = '#d62828', tread = null, tire = '#1d1c21' }) {
  const g = new THREE.Group();
  const design = RIM_STYLE[style] ?? style;
  tread ??= design === 'acero' ? 'barro' : design === 'palo' ? 'liso' : 'calle';
  const sh = r * (tread === 'slick' ? 0.07 : tread === 'barro' ? 0.17 : tread === 'todoterreno' ? 0.14 : 0.11);
  const rimR = r * (tread === 'barro' ? 0.56 : design === 'disco' ? 0.6 : 0.64);
  const rubber = S(tire, { roughness: 0.92 });
  g.add(mesh(tireGeometry(r, w, rimR, sh), rubber));
  treadBlocks(g, tread, r, w, rubber);
  const rimMat = design === 'palo' ? S(rim, { roughness: 0.85 }) : METAL(rim);
  const capMat = METAL(cap);
  // barrel, brake disc and caliper show through the open designs
  const barrel = new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, w * 0.84, 16, 1, true);
  barrel.rotateZ(Math.PI / 2);
  g.add(mesh(barrel, METAL('#4a4d55')));
  if (design !== 'palo') {
    const lip = new THREE.TorusGeometry(rimR * 0.98, r * 0.045, 4, 18);
    lip.rotateY(Math.PI / 2);
    g.add(mesh(lip, rimMat, w * 0.42, 0, 0));
    const disc = new THREE.CylinderGeometry(rimR * 0.68, rimR * 0.68, 0.05, 16);
    disc.rotateZ(Math.PI / 2);
    g.add(mesh(disc, METAL('#7b7f88'), w * 0.08, 0, 0));
    const caliper = rbox(0.14, rimR * 0.36, rimR * 0.5, capMat, w * 0.18, rimR * 0.42, -rimR * 0.2, 0.03);
    caliper.rotation.x = 0.45;
    g.add(caliper);
  }
  if (design === 'disco') {
    // whitewall ring on the outer sidewall
    const wall = new THREE.RingGeometry(rimR * 1.06, rimR + (r - rimR) * 0.6, 22);
    wall.rotateY(Math.PI / 2);
    g.add(mesh(wall, M('#f4f1e6', DECAL), w / 2 + 0.004, 0, 0));
  }
  const face = new THREE.Group();   // outer side, +X
  face.position.x = w * 0.36;
  g.add(face);
  rimFace(face, design, rimR, r, rimMat, capMat);
  return batchParts(g);
}

function fender(r, w, color) {
  const points = [], inner = r - 0.115;
  for (let i = 0; i <= 8; i++) {
    const a = i / 8 * Math.PI;
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 8; i >= 0; i--) {
    const a = i / 8 * Math.PI;
    points.push([Math.cos(a) * inner, Math.sin(a) * inner]);
  }
  return profile(points, w, M(color), 0.025);
}

// ---------- shared assembly ----------
// spec: { wheel, base?, rim?, wheelPos }. A garage wheel bigger than the
// car's own (base) lifts the body by the difference, a smaller one lowers it a
// little, so the arches keep their gap. rim recolours the rims.
function rig(spec) {
  const root = new THREE.Group();
  const tumble = new THREE.Group();     // flips and spins
  tumble.position.y = 1;
  root.add(tumble);
  const inner = new THREE.Group();
  inner.position.y = -1;
  tumble.add(inner);
  const lift = new THREE.Group();
  lift.position.y = (spec.base ? clamp(spec.wheel.r - spec.base.r, -0.06, 0.16) : 0) + (spec.wheel.lift ?? 0);
  inner.add(lift);
  const chassis = new THREE.Group();   // rides the suspension
  lift.add(chassis);

  const wheel = spec.rim ? { ...spec.wheel, rim: spec.rim } : spec.wheel;
  const wheels = [];
  for (const [x, z, front] of spec.wheelPos) {
    const steer = new THREE.Group();
    steer.position.set(x, wheel.r, z);
    const spin = new THREE.Group();
    const w = makeWheel(wheel);
    if (x < 0) w.rotation.y = Math.PI;
    spin.add(w);
    steer.add(spin);
    inner.add(steer);
    wheels.push({ steer, spin, front });
  }
  return { root, tumble, chassis, wheels, radius: wheel.r, lift: lift.position.y, detachables: [], danglers: [], fit: {} };
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
  const glare = pane([fb[0] - 0.12, fb[1] + 0.35], [ft[0] + 0.25, ft[1] - 0.4], 0.08, GLARE);
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
    if (o.roof[0].length > 2) {
      // v2 roof: filleted outline, a little narrower at the top edge
      const half = o.width / 2 + 0.07, shape = roundedPath(o.roof);
      const top = Math.max(...o.roof.map(p => p[1])), bottom = Math.min(...o.roof.map(p => p[1]));
      c.add(mesh(extrudeX(shape, -half, half, { bevel: 0.06, taper: (z, y) => 1 - 0.05 * clamp((y - bottom) / (top - bottom || 1), 0, 1) }), o.roofMat));
      const poly = shape.getPoints(6);
      car.fit.roof = { zF: Math.max(...o.roof.map(p => p[0])), zR: Math.min(...o.roof.map(p => p[0])), top: top + 0.06, half: half * 0.95,
        y: z => Math.max(bottom, ...crossings(poly, false, z)) + 0.06 };
    } else {
      c.add(profile(o.roof, o.width + 0.14, o.roofMat, 0.07));
      const top = Math.max(...o.roof.map(p => p[1])) + 0.07;
      car.fit.roof = { zF: Math.max(...o.roof.map(p => p[0])), zR: Math.min(...o.roof.map(p => p[0])), top, half: o.width / 2, y: () => top };
    }
  }
  car.fit.belt = fb[1];
  car.fit.cabin = { zF: fb[0], zR: rb[0], width: o.width, open: !!o.open };

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
function lightBar(n, gap, y, z, r = 0.21) {
  const g = new THREE.Group();
  g.add(box(n * gap + 0.12, 0.1, 0.14, DARK(), 0, y, z));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap;
    const housing = mesh(new THREE.CylinderGeometry(r, r, 0.2, 10), DARK(), x, y + r, z + 0.02);
    housing.rotation.x = Math.PI / 2;
    g.add(housing);
    const lamp = mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.76, 0.04, 10), M('#ffe7a1', { emissive: '#ffbf43', emissiveIntensity: 0.65 }), x, y + r, z + 0.13);
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
  bevelBox, squareLamp, towLoop, bodyShell,
  S, PAINT, LENS, AMBER, TAIL, roundedPath, archedSide, extrudeX, crossings, RB, rbox, shellBody, archFlare, domeLamp, rectLamp, profileFit,
  M, DECAL, CHROME, DARK, mesh, box, profile, strut, pane, tube, canvasMat, roundel, plate, bothSides, spot, makeWheel, fender, rig, detachable, cabin, lightBar, spareWheel, roundLamp, venezuelaFlag, flower,
};
