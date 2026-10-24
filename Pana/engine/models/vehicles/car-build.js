// Assembly helpers for the smooth Pana cars: a raycast "surface" so lamps,
// decals, handles and seams sit exactly on curved panels, swept bumpers and
// trim, the open windshield frame, and the cabin interior with the driver.

import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { M, S, DARK, mesh, rbox, tube, bakeGeometry } from '/engine/models/vehicles/car-kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// One material for every cabin: colours come from the vertices and a
// "detail" attribute picks a procedural surface, so zooming in shows tuck-and-
// roll pleats with real-looking stitching, fabric weave, carpet pile, leather
// grain and perforated speaker grilles, with no textures and no extra geometry.
// 0 plain, 1 pleated fabric, 2 carpet, 3 leather, 4 fine grain, 5 webbing, 6 perforated
const CABIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 });
CABIN_MAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
attribute float detail;
attribute vec3 stitch;
varying float vDetail;
varying vec3 vStitch;
varying vec3 vP;
varying vec3 vN;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vDetail = detail; vStitch = stitch; vP = position; vN = normal;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying float vDetail;
varying vec3 vStitch;
varying vec3 vP;
varying vec3 vN;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 planar(vec3 p, vec3 n) { vec3 a = abs(n); return (a.x > a.y && a.x > a.z) ? p.zy : ((a.z > a.y) ? p.xy : p.xz); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * 0.28;   // bounce light under the roof`)
    .replace('#include <color_fragment>', `#include <color_fragment>
{
  int d = int(vDetail + 0.5);
  vec3 n = normalize(vN);
  vec2 uv = planar(vP, n);
  if (d == 1) {
    float q = vP.x / 0.068, p = fract(q), aa = fwidth(q);
    float fade = 1.0 - smoothstep(0.12, 0.45, aa);
    float groove = smoothstep(0.0, 0.1 + aa, p) * smoothstep(1.0, 0.9 - aa, p);
    float roll = 0.8 + 0.2 * sin(p * 3.14159);
    vec3 c = diffuseColor.rgb * mix(1.0, mix(0.66, 1.0, groove) * (0.9 + 0.1 * roll), fade);
    float along = (abs(n.y) > 0.6 ? vP.z : vP.y) / 0.024;
    float fa = fract(along);
    float dash = smoothstep(0.2, 0.3, fa) * (1.0 - smoothstep(0.7, 0.8, fa));
    float w = 0.018 + aa * 0.6;
    float st = max(1.0 - smoothstep(0.0, w, abs(p - 0.16)), 1.0 - smoothstep(0.0, w, abs(p - 0.84)));
    c = mix(c, vStitch, st * dash * fade * 0.95);
    float weave = vnoise(uv * 520.0) * 0.6 + vnoise(uv * 140.0) * 0.4;
    c *= mix(1.0, 0.86 + 0.28 * weave, fade);
    diffuseColor.rgb = c + vec3(0.012);
  } else if (d == 2) {
    float k = vnoise(uv * 260.0) * 0.55 + vnoise(uv * 55.0) * 0.45;
    diffuseColor.rgb *= 0.72 + 0.45 * k;
  } else if (d == 3) {
    float k = vnoise(uv * 110.0) * 0.7 + vnoise(uv * 330.0) * 0.3;
    diffuseColor.rgb *= 0.86 + 0.24 * k;
  } else if (d == 4) {
    diffuseColor.rgb *= 0.93 + 0.12 * vnoise(uv * 260.0);
  } else if (d == 5) {
    float q = (abs(n.x) > 0.5 ? vP.z : vP.x) / 0.006;
    diffuseColor.rgb *= 0.85 + 0.15 * smoothstep(0.3, 0.7, abs(fract(q) - 0.5) * 2.0);
  } else if (d == 6) {
    vec2 g = uv / 0.022, f = fract(g) - 0.5;
    float aa = fwidth(g.x), fade = 1.0 - smoothstep(0.2, 0.55, aa);
    float hole = 1.0 - smoothstep(0.2, 0.2 + aa * 1.5, length(f));
    diffuseColor.rgb *= 1.0 - 0.8 * hole * fade;
  }
}`);
};
const tag = (m, d, stitch) => { m.userData.detail = d; if (stitch) m.userData.stitch = stitch; return m; };
// A flat strap between two points, its face toward `face` (seat belts).
function strap(a, b, w, t, mat, face = V(0, 0, 1)) {
  const A = V(...a), B = V(...b), y = B.clone().sub(A), L = y.length();
  y.normalize();
  const x = V().crossVectors(y, face).normalize(), z = V().crossVectors(x, y);
  const m = rbox(w, L, t, mat, 0, 0, 0, Math.min(w, t) * 0.45);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return m;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export const GLASS2 = new THREE.MeshStandardMaterial({
  color: 0x3a5a78, transparent: true, opacity: 0.26, roughness: 0.06, metalness: 0.25,
  side: THREE.DoubleSide, depthWrite: false,
});

// ---------- surface queries ----------
// Every query is a ray against the car's body. Testing all ~20k triangles
// per ray made the build 50 % slower than the old cars, so triangles are
// binned once: a 2D grid across each axis for axis-aligned rays and height
// slabs for level rays (wrapPath); any other ray tests them all. Candidates
// keep geometry-then-face order and the nearest wins strictly, so results
// are exactly those of Raycaster.intersectObjects.
const CELL = 0.08;
function triangleIndex(geos) {
  const tris = [], P = V(), Q = V(), R = V();
  geos.forEach((g, gi) => {
    const pos = g.attributes.position, idx = g.index, count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      P.fromBufferAttribute(pos, a); Q.fromBufferAttribute(pos, b); R.fromBufferAttribute(pos, c);
      tris.push({ g: gi, a, b, c, min: [Math.min(P.x, Q.x, R.x), Math.min(P.y, Q.y, R.y), Math.min(P.z, Q.z, R.z)], max: [Math.max(P.x, Q.x, R.x), Math.max(P.y, Q.y, R.y), Math.max(P.z, Q.z, R.z)] });
    }
  });
  const cell = v => Math.floor(v / CELL), grids = new Map();
  // grid(u, v): triangles by their bounding box projected on axes u and v (0 x, 1 y, 2 z).
  const grid = (u, v) => {
    const key = `${u},${v}`;
    if (grids.has(key)) return grids.get(key);
    const map = new Map();
    tris.forEach((t, ti) => {
      for (let i = cell(t.min[u]); i <= cell(t.max[u]); i++) for (let j = v < 0 ? 0 : cell(t.min[v]); j <= (v < 0 ? 0 : cell(t.max[v])); j++) {
        const k = `${i},${j}`; if (!map.has(k)) map.set(k, []); map.get(k).push(ti);
      }
    });
    grids.set(key, map); return map;
  };
  return {
    tris,
    candidates(o, d) {
      const axis = [0, 1, 2].filter(i => d[i] !== 0);
      if (axis.length === 1) { const [u, v] = [0, 1, 2].filter(i => i !== axis[0]); return grid(u, v).get(`${cell(o[u])},${cell(o[v])}`) ?? []; }
      if (d[1] === 0) return grid(1, -1).get(`${cell(o[1])},0`) ?? [];
      return tris.map((_, i) => i);
    },
  };
}

export function surface(geos) {
  geos = geos.filter(Boolean);
  const index = triangleIndex(geos), ray = new THREE.Ray(), tri = new THREE.Triangle(), bc = V(), A = V(), B = V(), C = V(), point = V();
  const nA = V(), nB = V(), nC = V();
  function hit(o, d, outward = false) {
    // Mesh.raycast normalizes the direction again in object space; repeat it
    // so hit points match Raycaster's to the last bit.
    ray.set(V(...o), V(...d).normalize()); ray.direction.normalize();
    let best = null, nearest = Infinity;
    for (const ti of index.candidates(o, d)) {
      const t = index.tris[ti], P = geos[t.g].attributes.position;
      A.fromBufferAttribute(P, t.a); B.fromBufferAttribute(P, t.b); C.fromBufferAttribute(P, t.c);
      if (!ray.intersectTriangle(A, B, C, false, point)) continue;
      const distance = ray.origin.distanceTo(point);
      if (distance < nearest) { nearest = distance; best = { t, p: point.clone() }; }
    }
    if (!best) return null;
    const { t, p } = best, P = geos[t.g].attributes.position, N = geos[t.g].attributes.normal;
    A.fromBufferAttribute(P, t.a); B.fromBufferAttribute(P, t.b); C.fromBufferAttribute(P, t.c);
    tri.set(A, B, C); tri.getBarycoord(p, bc);
    const n = V().addScaledVector(nA.fromBufferAttribute(N, t.a), bc.x).addScaledVector(nB.fromBufferAttribute(N, t.b), bc.y).addScaledVector(nC.fromBufferAttribute(N, t.c), bc.z).normalize();
    if (n.dot(ray.direction) > 0) n.negate();   // now faces the ray origin
    if (outward) n.negate();
    return { p, n };
  }
  return {
    hit,
    side: (s, z, y) => hit([s * 9, y, z], [-s, 0, 0]),
    front: (x, y) => hit([x, y, 12], [0, 0, -1]),
    rear: (x, y) => hit([x, y, -12], [0, 0, 1]),
    top: (x, z) => hit([x, 12, z], [0, -1, 0]),
  };
}

// Point an object's +z along n, keeping its up as level as possible.
export function orient(obj, n) {
  const z = n.clone().normalize();
  const up = Math.abs(z.dot(UP)) > 0.96 ? V(0, 0, 1) : UP;
  const x = V().crossVectors(up, z).normalize(), y = V().crossVectors(z, x);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return obj;
}
export function stick(obj, h, off = 0) {
  if (!h) return obj;
  obj.position.copy(h.p).addScaledVector(h.n, off);
  return orient(obj, h.n);
}

// A thin strip lying on the surface through hits [{p, n}] (door seams, trim).
export function ribbon(hits, width, mat, off = 0.004) {
  hits = hits.filter(Boolean);
  if (hits.length < 2) return null;
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i < hits.length; i++) {
    const a = hits[Math.max(0, i - 1)].p, b = hits[Math.min(hits.length - 1, i + 1)].p;
    const t = b.clone().sub(a).normalize(), n = hits[i].n, side = V().crossVectors(t, n).normalize().multiplyScalar(width / 2);
    const q = hits[i].p.clone().addScaledVector(n, off);
    pos.push(...q.clone().sub(side).toArray(), ...q.clone().add(side).toArray());
    nrm.push(...n.toArray(), ...n.toArray());
    if (i) { const k = 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  // make the winding agree with the normals
  const p0 = V().fromArray(pos, 0), p1 = V().fromArray(pos, 6), p2 = V().fromArray(pos, 3);
  if (V().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0)).dot(hits[0].n) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
  }
  const m = mesh(g, mat);
  m.castShadow = false;
  return m;
}

// Rounded-rectangle cross section [[u, v]] (u outward, v up), counter-clockwise.
export function roundRect(w, h, r, seg = 4) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
  const pts = [];
  for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]]) {
    for (let k = 0; k <= seg; k++) { const a = a0 + Math.PI / 2 * k / seg; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  return pts;
}

// Sweep a closed section along a path. frames: [{p, u}] with u the outward
// direction (perpendicular to the path); v is the path's up. Ends close with
// a rounded cap that pinches the section to a point.
export function sweep(frames, section, mat, { cap = 0.6 } = {}) {
  const pos = [], idx = [], n = section.length;
  const ring = (p, u, v, sc, dz = V(), f = {}) => {
    const su = sc * (f.su ?? 1), sv = sc * (f.sv ?? 1);
    for (const [a, b] of section) pos.push(...p.clone().addScaledVector(u, a * su).addScaledVector(v, b * sv).add(dz).toArray());
  };
  const tangents = frames.map((f, i) => frames[Math.min(frames.length - 1, i + 1)].p.clone().sub(frames[Math.max(0, i - 1)].p).normalize());
  const vs = frames.map((f, i) => V().crossVectors(tangents[i], f.u).normalize());
  // pinched end rings
  const ends = (i, dir) => {
    const t = tangents[i].clone().multiplyScalar(dir), sz = Math.max(...section.map(s => Math.abs(s[1])));
    const out = [];
    for (let k = 3; k >= 1; k--) {
      const a = k / 4 * Math.PI / 2;
      out.push({ sc: Math.cos(a) * 0.98 + 0.02, dz: t.clone().multiplyScalar(Math.sin(a) * sz * cap) });
    }
    return out;
  };
  const rows = [];
  for (const e of ends(0, -1)) rows.push(() => ring(frames[0].p, frames[0].u, vs[0], e.sc, e.dz, frames[0]));
  frames.forEach((f, i) => rows.push(() => ring(f.p, f.u, vs[i], 1, V(), f)));
  for (const e of ends(frames.length - 1, 1).reverse()) rows.push(() => ring(frames.at(-1).p, frames.at(-1).u, vs.at(-1), e.sc, e.dz, frames.at(-1)));
  rows.forEach(r => r());
  const R = rows.length;
  for (let j = 0; j < R - 1; j++) for (let k = 0; k < n; k++) {
    const a = j * n + k, b = j * n + (k + 1) % n, c = (j + 1) * n + (k + 1) % n, d = (j + 1) * n + k;
    idx.push(a, d, c, a, c, b);
  }
  // pole caps
  for (const [j, dir] of [[0, -1], [R - 1, 1]]) {
    const ctr = V();
    for (let k = 0; k < n; k++) ctr.add(V().fromArray(pos, 3 * (j * n + k)));
    ctr.multiplyScalar(1 / n).addScaledVector(tangents[dir > 0 ? frames.length - 1 : 0], dir * 0.004);
    const ci = pos.length / 3;
    pos.push(...ctr.toArray());
    for (let k = 0; k < n; k++) {
      const a = j * n + k, b = j * n + (k + 1) % n;
      if (dir > 0) idx.push(a, b, ci); else idx.push(a, ci, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // flip if the section winding came out inside-out
  const p0 = V().fromArray(pos, 3 * (3 * n)), c0 = frames[0].p, nn = V().fromBufferAttribute(g.attributes.normal, 3 * n);
  if (nn.dot(p0.clone().sub(c0)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return mesh(g, mat);
}

// The plan outline of the face at height y, traced by rays from inside the
// nose (end 1) or tail (-1): a bumper/trim path that wraps the corners.
export function wrapPath(surf, fit, y, end, { spread = 1.15, n = 26, gap = 0.05, inset = 0.35 } = {}) {
  const z0 = (end > 0 ? fit.noseZ(y) : fit.tailZ(y)) - end * inset;
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n * 2 - 1) * spread;
    const h = surf.hit([0, y, z0], [Math.sin(th), 0, end * Math.cos(th)], true);
    if (!h) continue;
    const u = V(h.n.x, 0, h.n.z).normalize();
    frames.push({ p: h.p.clone().addScaledVector(u, gap), u });
  }
  // keep the run monotone in x so the sweep never folds
  frames.sort((a, b) => a.p.x - b.p.x);
  if (end < 0) frames.reverse();
  return frames;
}

// ---------- open windshield frame (jeep, buggy) ----------
export function openWindshield(c, { y0, y1, z0, z1, half, r = 0.06, mat }) {
  const up = V(0, y1 - y0, z1 - z0).normalize();
  const pts = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= 5; k++) { const a = a0 + Math.PI / 2 * k / 5; pts.push([cx + 0.12 * Math.cos(a), cy + 0.12 * Math.sin(a)]); } };
  const H = Math.hypot(y1 - y0, z1 - z0);
  corner(half - 0.12, H - 0.12, 0); corner(-half + 0.12, H - 0.12, Math.PI / 2);
  pts.push([-half, 0], [half, 0]);
  const path = new THREE.CatmullRomCurve3(pts.map(([x, t]) => V(x, y0, z0).addScaledVector(up, t)), true, 'catmullrom', 0.1);
  c.add(mesh(new THREE.TubeGeometry(path, 64, r, 12, true), mat));
  const shape = new THREE.Shape();
  shape.moveTo(-half + 0.04, 0.04); shape.lineTo(half - 0.04, 0.04); shape.lineTo(half - 0.04, H - 0.14);
  shape.quadraticCurveTo(half - 0.04, H - 0.04, half - 0.14, H - 0.04); shape.lineTo(-half + 0.14, H - 0.04);
  shape.quadraticCurveTo(-half + 0.04, H - 0.04, -half + 0.04, H - 0.14); shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 6);
  const m = mesh(g, GLASS2);
  m.castShadow = false;
  m.renderOrder = 2;
  m.position.set(0, y0, z0);
  m.rotation.x = -Math.atan2(z1 - z0, y1 - y0);
  c.add(m);
}

// ---------- the cabin interior and the driver ----------
// A real little cockpit: a floor liner over the body, door cards with
// armrests, a shaped dash with an instrument hood, glowing gauges, a centre
// stack and console with a gear lever, bucket seats (and a rear bench when
// there's room), a three-spoke steering wheel and the rear-view mirror.
// o: { belt, zDash, zBack, width (inside), driverZ, seatY, roofInner(z) | null,
//   interior, seat, accent, avatar, mirror: [y, z] | null, hanging, surf, open }
function shade(hex, k) {
  const c = new THREE.Color(hex);
  return '#' + c.multiplyScalar(k).getHexString();
}
export function seatDriver(car, o) {
  const chassis = car.chassis, half = o.width / 2;
  const c = new THREE.Group();   // interior parts, merged into one mesh at the end
  chassis.add(c);
  // lift near-black trims so the cabin reads through the glass, hue kept
  const lift = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#9a9283'), k).getHexString();
  const base = lift(o.interior ?? '#2b2732', 0.3), seatHex = lift(o.seat ?? o.interior ?? '#2b2732', 0.22);
  const inside = S(base, { roughness: 0.85 }), dash = S(shade(base, 1.12), { roughness: 0.6 });
  const soft = S(shade(base, 1.35), { roughness: 0.9 }), seatM = S(seatHex, { roughness: 0.75 });
  const seatDark = S(shade(seatHex, 0.78), { roughness: 0.8 }), pipe = S(o.accent ?? shade(seatHex, 1.35), { roughness: 0.5 });
  const metal = S('#b9bdc6', { metalness: 0.6, roughness: 0.3 });
  const stitchC = new THREE.Color(o.accent ?? '#e8d9b0').lerp(new THREE.Color('#ffffff'), 0.15);
  const fb = o.belt, zF = o.zDash, zB = o.zBack;
  // floor: sits just above wherever the body top pokes through the cabin
  let floor = fb;
  if (o.surf) for (let i = 0; i <= 6; i++) for (let k = 0; k <= 6; k++) {
    const h = o.surf.top((i / 6 * 2 - 1) * (half - 0.12), lerp(zB + 0.05, zF - 0.55, k / 6));
    if (h) floor = Math.max(floor, h.p.y);
  }
  floor += 0.012;
  // the windshield leans back: everything up front stays behind its line
  const pillarR = o.pillarR ?? 0;   // rounded A-pillars wrap the glass back at the sides
  const glassZ0 = o.glassZ ?? (() => zF), glassZ = y => glassZ0(y) - pillarR * 0.9;
  const len = Math.max(0.4, zF - zB - 0.04), zc = (zF + zB) / 2;
  const floorF = Math.min(zF - 0.3, glassZ(floor + 0.06) - 0.08);
  c.add(tag(rbox(o.width - 0.08, 0.06, floorF - zB - 0.02, inside, 0, floor + 0.02, (floorF + zB + 0.02) / 2, 0.025), 2));
  // door cards with an armrest; open cars get a padded cockpit rim
  const cardTop = o.open ? floor + 0.1 : fb + 0.2;
  const cardF = Math.min(zF - 0.02, glassZ(cardTop) - 0.06), cardLen = cardF - zB - 0.02, cardC = (cardF + zB + 0.02) / 2;
  for (const s of [1, -1]) {
    c.add(tag(rbox(0.06, cardTop - floor, cardLen, inside, s * (half - 0.02), (cardTop + floor) / 2, cardC, 0.025), 3));
    c.add(tag(rbox(0.1, 0.07, Math.min(0.9, len * 0.6), soft, s * (half - 0.07), cardTop - 0.12, o.driverZ + 0.1, 0.03), 3));
    c.add(tag(rbox(0.07, 0.05, cardLen, dash, s * (half - 0.03), cardTop, cardC, 0.022), 4));
    // speaker grille low on each door
    if (cardTop - floor > 0.32) {
      const sz = o.driverZ + 0.35, sy0 = floor + 0.16;
      c.add(tag(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 32).rotateZ(Math.PI / 2), S('#121215', { roughness: 0.7 }), s * (half - 0.055), sy0, sz), 6));
      c.add(mesh(new THREE.TorusGeometry(0.11, 0.01, 8, 32).rotateY(Math.PI / 2), metal, s * (half - 0.06), sy0, sz));
    }
    if (!o.open) {
      // window crank
      const kz = o.driverZ - 0.05, ky = cardTop - 0.2, kx = s * (half - 0.06);
      c.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16).rotateZ(Math.PI / 2), metal, kx, ky, kz));
      c.add(strap([kx - s * 0.02, ky, kz], [kx - s * 0.02, ky - 0.1, kz - 0.04], 0.025, 0.015, metal, V(s, 0, 0)));
      c.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 12).rotateZ(Math.PI / 2), M('#1a1a1e'), kx - s * 0.05, ky - 0.1, kz - 0.04));
    }
    if (!o.open) c.add(rbox(0.03, 0.04, 0.12, metal, s * (half - 0.07), cardTop - 0.04, o.driverZ + 0.42, 0.012));   // door pull
  }
  // ---------- dashboard ----------
  // Low and sculpted (a swept curve, not stacked slabs) so the driver's whole
  // face clears it, and full of things to find up close.
  const dashTop = Math.max(fb + 0.1, floor + 0.12);
  const frontZ = Math.min(zF - 0.04, glassZ(dashTop) - 0.02), dz = frontZ - 0.25, faceZ = frontZ - 0.47;
  const dashW = o.width - 0.08 - pillarR * 1.6, H = dashTop - floor;
  {
    // profile [toward the driver, up] from the glass, over a padded top, round
    // a soft lip and down the face to the floor; smoothed twice (Chaikin)
    let pr = [[0, -0.01], [0, H], [0.22, H + 0.03], [0.4, H + 0.01], [0.48, H - 0.05], [0.47, H - 0.13], [0.4, Math.max(0.06, H * 0.35)], [0.34, 0.02], [0.1, -0.01]];
    for (let it = 0; it < 2; it++) {
      const q = [];
      for (let i = 0; i < pr.length; i++) { const A = pr[i], B = pr[(i + 1) % pr.length]; q.push([A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25], [A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]); }
      pr = q;
    }
    const frames = [-1, -0.5, 0, 0.5, 1].map(t => ({ p: V(t * dashW / 2, floor, frontZ), u: V(0, 0, -1) }));
    c.add(tag(sweep(frames, pr, dash, { cap: 0.12 }), 4));
    // padded top, a defroster slot along the glass and corner tweeters
    c.add(tag(rbox(dashW - 0.1, 0.03, 0.3, inside, 0, dashTop + 0.025, frontZ - 0.22, 0.014), 3));
    c.add(rbox(dashW * 0.7, 0.012, 0.03, S('#141417'), 0, dashTop + 0.012, frontZ - 0.06, 0.005));
    for (const s of [1, -1]) c.add(tag(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), S('#141417'), s * (dashW / 2 - 0.14), dashTop + 0.03, frontZ - 0.1), 6));
  }
  // gauge binnacle in front of the driver: a hooded pod with two dials and a strip of warning lights
  const pod = new THREE.Group();
  pod.position.set(0.45, dashTop - 0.05, faceZ + 0.05);
  pod.scale.setScalar(0.8);
  const podMat = S(shade(base, 0.85), { roughness: 0.55 });
  pod.add(tag(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 28, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), podMat, 0, 0, 0), 3));
  pod.add(tag(rbox(0.42, 0.12, 0.08, podMat, 0, -0.05, 0.06, 0.03), 3));
  const dialFace = M('#f4eedc', { emissive: '#7a6d42', emissiveIntensity: 0.55 });
  for (const dx of [-0.1, 0.1]) {
    const g = new THREE.Group();
    g.position.set(dx, 0.0, -0.04);
    g.rotation.y = Math.PI;
    g.rotation.x = 0.25;
    g.add(mesh(new THREE.TorusGeometry(0.072, 0.012, 10, 32), metal));
    g.add(mesh(new THREE.CircleGeometry(0.068, 32), S('#141417'), 0, 0, -0.004));
    g.add(mesh(new THREE.CircleGeometry(0.062, 32), dialFace, 0, 0, -0.002));
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (1.25 - 1.5 * k / 8);
      const tick = mesh(new THREE.PlaneGeometry(0.004, 0.014), S('#1a1a1e'), Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.001);
      tick.rotation.z = a - Math.PI / 2;
      g.add(tick);
    }
    const needle = mesh(new THREE.PlaneGeometry(0.006, 0.05), M('#e23b2e', { emissive: '#801010', emissiveIntensity: 0.6 }), 0, 0.02, 0.002);
    needle.geometry.translate(0, 0.005, 0);
    needle.rotation.z = dx > 0 ? -0.8 : 0.6;
    g.add(needle);
    g.add(mesh(new THREE.CircleGeometry(0.01, 12), S('#1a1a1e'), 0, 0, 0.003));
    pod.add(g);
  }
  for (const [k, col2] of [[-1, '#3bd16f'], [0, '#ffb02e'], [1, '#ff4a3a']]) {
    const l = mesh(new THREE.CircleGeometry(0.011, 12), M(col2, { emissive: col2, emissiveIntensity: 0.8 }), k * 0.035, -0.1, -0.01);
    l.rotation.y = Math.PI;
    pod.add(l);
  }
  c.add(pod);
  // centre stack: radio with a glowing display and buttons, two slatted vents,
  // a row of switches and the red hazard button
  const stack = new THREE.Group();
  stack.position.set(0, floor, faceZ + 0.04);
  const stackH = Math.max(0.2, H - 0.06), dark = S('#2b2b31', { roughness: 0.5 });
  stack.add(tag(rbox(0.38, stackH, 0.14, dark, 0, stackH / 2, 0.03, 0.03), 4));
  const onFace = (m, x, y) => { m.position.set(x, y, -0.045); m.rotation.y = Math.PI; stack.add(m); return m; };
  onFace(rbox(0.26, 0.07, 0.02, S('#16161a'), 0, 0, 0, 0.008), 0, stackH - 0.07);
  onFace(mesh(new THREE.PlaneGeometry(0.15, 0.04), M('#7fd3c4', { emissive: '#2a9f8c', emissiveIntensity: 1.0 })), -0.02, stackH - 0.07).position.z -= 0.012;
  for (const x of [0.085, 0.115]) onFace(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14).rotateX(Math.PI / 2), metal), x, stackH - 0.07).position.z -= 0.012;
  for (let k = 0; k < 5; k++) onFace(rbox(0.032, 0.016, 0.015, S('#55555d'), 0, 0, 0, 0.005), -0.1 + k * 0.05, stackH - 0.125);
  for (const x of [-0.09, 0.09]) {
    onFace(rbox(0.13, 0.07, 0.02, metal, 0, 0, 0, 0.012), x, stackH - 0.19);
    for (let k = 0; k < 4; k++) onFace(rbox(0.11, 0.008, 0.024, S('#141417'), 0, 0, 0, 0.003), x, stackH - 0.215 + k * 0.017);
  }
  if (stackH > 0.3) for (let k = 0; k < 3; k++) onFace(rbox(0.024, 0.04, 0.02, S('#16161a'), 0, 0, 0, 0.006), -0.06 + k * 0.06, stackH - 0.26);
  onFace(rbox(0.05, 0.03, 0.02, M('#e0262f', { emissive: '#600000', emissiveIntensity: 0.6 }), 0, 0, 0, 0.008), 0, stackH - 0.03).position.z -= 0.005;
  c.add(stack);
  // outboard vents, the glovebox and its latch on the passenger side
  for (const s of [1, -1]) {
    const v = new THREE.Group();
    v.position.set(s * (dashW / 2 - 0.13), dashTop - 0.07, faceZ + 0.015);
    v.rotation.y = Math.PI;
    v.add(mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 24), metal));
    v.add(mesh(new THREE.CircleGeometry(0.042, 24), S('#141417'), 0, 0, -0.004));
    for (let k = -1; k <= 1; k++) v.add(rbox(0.07, 0.008, 0.01, S('#4a4a52'), 0, k * 0.018, 0.0, 0.003));
    c.add(v);
  }
  if (H > 0.3) {
    const gx = -0.42, gy = floor + H * 0.55, gw = 0.4, gh = Math.min(0.16, H * 0.35);
    const outline = (w, h2, x, y) => { for (const [ww, hh, ox, oy] of [[w, 0.008, 0, h2 / 2], [w, 0.008, 0, -h2 / 2], [0.008, h2, w / 2, 0], [0.008, h2, -w / 2, 0]]) c.add(rbox(ww, hh, 0.01, S('#141417'), x + ox, y + oy, faceZ + 0.005, 0.002)); };
    outline(gw, gh, gx, gy);
    c.add(rbox(0.07, 0.022, 0.02, metal, gx, gy + gh / 2 - 0.03, faceZ + 0.0, 0.008));
  }
  // pedals under the dash, a little capy bobblehead on top
  for (const [k, w] of [[0, 0.08], [1, 0.08], [2, 0.06]]) {
    const ped = rbox(w, 0.1, 0.02, S('#3a3a40', { roughness: 0.6 }), 0.62 - k * 0.12, floor + 0.12, faceZ - 0.06, 0.008);
    ped.rotation.x = 0.5;
    c.add(ped);
  }
  {
    const bx = -0.25, by = dashTop + 0.04, bz = frontZ - 0.24, fur = M('#c98a3c', { roughness: 0.8 });
    c.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 16), S('#1a1a1e'), bx, by, bz));
    const bod = mesh(new THREE.SphereGeometry(0.04, 16, 12), fur, bx, by + 0.05, bz);
    bod.scale.set(1, 0.85, 1.2);
    c.add(bod);
    c.add(mesh(new THREE.SphereGeometry(0.05, 18, 14), fur, bx, by + 0.12, bz - 0.01));
    c.add(mesh(new THREE.SphereGeometry(0.026, 14, 10), M('#7a4a2b'), bx, by + 0.11, bz - 0.055));
    for (const s of [1, -1]) {
      c.add(mesh(new THREE.SphereGeometry(0.015, 10, 8), M('#7a4a2b'), bx + s * 0.03, by + 0.165, bz - 0.005));
      c.add(mesh(new THREE.SphereGeometry(0.007, 8, 6), M('#111114'), bx + s * 0.022, by + 0.135, bz - 0.05));
    }
  }
  for (const x of [0.45, -0.45]) c.add(tag(rbox(0.56, 0.02, 0.5, S(shade(base, 0.6)), x, floor + 0.055, dz - 0.5, 0.02), 2));
  // console between the seats with the gear lever
  const cz0 = dz - 0.3, cz1 = Math.max(zB + 0.25, o.driverZ - 0.55);
  if (cz0 > cz1) {
    c.add(tag(rbox(0.24, 0.16, cz0 - cz1, dash, 0, floor + 0.08, (cz0 + cz1) / 2, 0.05), 3));
    // handbrake beside the gear lever
    c.add(tube([0.05, floor + 0.17, o.driverZ - 0.2], [0.05, floor + 0.27, o.driverZ + 0.05], 0.018, metal));
    c.add(tag(strap([0.05, floor + 0.25, o.driverZ - 0.02], [0.05, floor + 0.29, o.driverZ + 0.1], 0.045, 0.045, S('#1a1a1e'), V(0, 1, 0)), 3));
    c.add(tube([0, floor + 0.14, o.driverZ + 0.2], [0, floor + 0.36, o.driverZ + 0.14], 0.016, metal));
    c.add(mesh(new THREE.SphereGeometry(0.045, 18, 12), M('#1a1a1e', { roughness: 0.35 }), 0, floor + 0.38, o.driverZ + 0.13));
  }
  const pana = buildCharacter(o.avatar, { seated: true });
  pana.group.updateMatrixWorld(true);
  const head = new THREE.Box3();
  pana.head.traverseVisible(node => { if (node.isMesh) head.expandByObject(node, true); });
  const muzzle = pana.head.getObjectByName('Broad cocoa muzzle');
  const mouth = muzzle ? new THREE.Box3().setFromObject(muzzle, true).min.y : head.min.y + (head.max.y - head.min.y) * 0.3;
  const sightline = Math.max(o.sill ?? fb, dashTop + 0.03) + 0.1;   // the chin clears the dash
  const roofBottom = o.roofInner ? o.roofInner(o.driverZ) - 0.08 : Infinity;
  const size = Math.min(0.82, (roofBottom - sightline) / (head.max.y - mouth), (half - 0.45 - 0.04) / head.max.x);
  pana.group.scale.setScalar(size);
  pana.group.position.set(0.45, Math.min(Math.max(o.seatY, sightline - mouth * size), roofBottom - head.max.y * size), o.driverZ);
  chassis.add(pana.group);
  car.fit.driver = { size, sightline, roofBottom };
  // both hands on the wheel (an elbow out the window pokes through the door)
  pana.armL.rotation.set(-1.15, 0, -0.25);
  pana.armR.rotation.set(-1.15, 0, 0.25);
  // seats are sized to the driver: the back stops at the chin, headrest behind the head
  const gy = pana.group.position.y, chin = gy + mouth * size, crown = gy + head.max.y * size;
  const backH = THREE.MathUtils.clamp(chin + 0.04 - (floor + 0.16), 0.28, 0.82);
  const restY = Math.min(crown - 0.12, chin + 0.2) - (floor + 0.16);
  // bucket seats
  const seat = (x, z) => {
    const g = new THREE.Group();
    g.position.set(x, floor, z);
    g.add(tag(rbox(0.62, 0.16, 0.56, seatM, 0, 0.1, 0.18, 0.07), 1, stitchC));                       // cushion
    const back = new THREE.Group();
    back.position.set(0, 0.16, -0.08);
    back.rotation.x = -0.16;
    back.add(tag(rbox(0.58, backH, 0.16, seatM, 0, backH / 2, 0, 0.07), 1, stitchC));
    for (const s of [1, -1]) back.add(tag(rbox(0.1, backH * 0.88, 0.22, seatDark, s * 0.29, backH * 0.46, 0.03, 0.05), 3));   // bolsters
    for (const s of [1, -1]) g.add(tag(rbox(0.09, 0.2, 0.5, seatDark, s * 0.3, 0.13, 0.18, 0.04), 3));   // cushion bolsters
    g.add(tag(rbox(0.04, 0.03, 0.12, metal, (x > 0 ? 1 : -1) * 0.33, 0.12, 0.3, 0.012), 0));                 // recline lever
    back.add(tag(rbox(0.3, backH * 0.7, 0.02, pipe, 0, backH * 0.5, 0.085, 0.01), 6));       // perforated stripe
    if (restY > backH + 0.06) {
      back.add(tag(rbox(0.34, 0.18, 0.12, seatM, 0, restY, -0.01, 0.06), 1, stitchC));                // headrest
      for (const s of [1, -1]) back.add(tube([s * 0.1, backH - 0.02, -0.01], [s * 0.1, restY - 0.08, -0.01], 0.012, metal));
    }
    g.add(back);
    c.add(g);
  };
  for (const x of [0.45, -0.45]) seat(x, o.driverZ - 0.38);
  // the passenger's belt lies across the empty seat; the driver's hangs by the pillar
  const webbing = S('#2c2c31', { roughness: 0.8 }), buckleRed = M('#d62828');
  const belt = (x, zBackFace, h, tilt, side) => {
    const top = [x + side * 0.24, floor + 0.16 + h - 0.06, zBackFace + 0.03 - (h - 0.06) * tilt];
    const hip = [x - side * 0.2, floor + 0.22, zBackFace + 0.06];
    c.add(tag(strap(top, hip, 0.065, 0.014, webbing), 5));
    c.add(tag(strap([x + side * 0.24, floor + 0.22, zBackFace + 0.07], [x - side * 0.2, floor + 0.23, zBackFace + 0.08], 0.06, 0.014, webbing), 5));
    c.add(rbox(0.07, 0.05, 0.03, metal, hip[0], hip[1], hip[2] + 0.02, 0.012));
    c.add(rbox(0.05, 0.12, 0.05, S('#151518'), x - side * 0.26, floor + 0.22, zBackFace + 0.04, 0.02));
    c.add(rbox(0.03, 0.025, 0.012, buckleRed, x - side * 0.26, floor + 0.29, zBackFace + 0.064, 0.006));
  };
  belt(-0.45, o.driverZ - 0.38, backH, 0.16, -1);
  // rear benches, one row per 0.9 of cabin left behind the front seats
  for (let z = o.driverZ - 1.3; z > zB + 0.2 || (z === o.driverZ - 1.3 && o.driverZ - 0.95 - zB > 0.35); z -= 0.92) {
    const zz = Math.max(zB + 0.28, z);
    c.add(tag(rbox(o.width - 0.3, 0.16, 0.5, seatM, 0, floor + 0.1, zz + 0.12, 0.07), 1, stitchC));
    const bh = Math.max(0.26, backH - 0.12);
    const back = rbox(o.width - 0.3, bh, 0.15, seatM, 0, floor + 0.16 + bh / 2, zz - 0.12, 0.07);
    back.rotation.x = -0.14;
    c.add(tag(back, 1, stitchC));
    c.add(tag(rbox(o.width - 0.5, bh * 0.55, 0.02, pipe, 0, floor + 0.16 + bh / 2, zz - 0.04, 0.008), 6));
    // two places: belts, and headrests where the roof allows
    const places = o.width > 1.6 ? [0.45, -0.45] : [0.32, -0.32];
    for (const x of places) {
      belt(x, zz - 0.045 - bh / 2 * 0.14, bh, 0.14, x > 0 ? 1 : -1);
      const ry = floor + 0.16 + bh + 0.12, roof = o.roofInner ? o.roofInner(zz) - 0.06 : Infinity;
      if (ry + 0.1 < roof) {
        c.add(tag(rbox(0.32, 0.16, 0.11, seatM, x, ry, zz - 0.13 - bh * 0.14, 0.05), 1, stitchC));
        for (const s of [1, -1]) c.add(tube([x + s * 0.09, ry - 0.14, zz - 0.13 - bh * 0.13], [x + s * 0.09, ry - 0.06, zz - 0.13 - bh * 0.14], 0.01, metal));
      }
    }
    if (zz <= zB + 0.28) break;
  }
  if (!o.open) {
    const shelfZ = zB + 0.16;
    c.add(tag(rbox(o.width - 0.1, 0.04, 0.3, inside, 0, cardTop + 0.02, shelfZ, 0.015), 2));
    for (const x of [0.5, -0.5]) {
      c.add(tag(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 28), S('#121215', { roughness: 0.7 }), x, cardTop + 0.05, shelfZ), 6));
      c.add(mesh(new THREE.TorusGeometry(0.1, 0.01, 8, 28).rotateX(Math.PI / 2), metal, x, cardTop + 0.05, shelfZ));
    }
  }
  if (o.mirror && o.roofInner) {
    const [my, mz] = o.mirror;
    const vw = Math.min(0.46, 2 * ((o.visorHalf ?? 0.95) - 0.07 - 0.45));
    if (vw > 0.2) for (const x of [0.45, -0.45]) c.add(tag(strap([x, my + 0.06, mz - 0.04], [x, my - 0.08, mz - 0.11], vw, 0.035, soft, V(0, -0.3, -1)), 3));
    const dzL = (mz + zB) / 2, ly = o.roofInner(dzL) - 0.025;
    c.add(rbox(0.24, 0.03, 0.12, M('#f7f1dc', { emissive: '#8a8060', emissiveIntensity: 0.6 }), 0, ly, dzL, 0.012));
  }
  if (o.mirror) {
    const [my, mz] = o.mirror;
    c.add(rbox(0.36, 0.1, 0.05, DARK(), 0, my, mz, 0.025));
    c.add(mesh(new THREE.PlaneGeometry(0.31, 0.06), M('#bcd3e0', { metalness: 0.8, roughness: 0.1 }), 0, my, mz - 0.026).rotateY(Math.PI));
    if (o.hanging) {
      const pivot = new THREE.Group();
      pivot.position.set(0, my - 0.06, mz);
      pivot.add(tube([0, 0, 0], [0, -0.22, 0], 0.008, DARK()));
      o.hanging(pivot);
      chassis.add(pivot);
      car.danglers.push(pivot);
    }
  }
  // steering wheel: rim, three spokes, hub and column
  const sy = pana.group.position.y, wc = V(0.4, sy + 0.42, o.driverZ + 0.52);
  const sw = new THREE.Group();
  sw.position.copy(wc);
  sw.rotation.x = -0.45;
  sw.add(tag(mesh(new THREE.TorusGeometry(0.24, 0.042, 12, 36), S('#151518', { roughness: 0.6 })), 3));
  for (const a of [Math.PI / 2 + 0.0, Math.PI * 7 / 6 + 0.35, -Math.PI / 6 - 0.35]) {
    const sp = rbox(0.2, 0.04, 0.025, metal, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0, 0.012);
    sp.rotation.z = a;
    sw.add(sp);
  }
  sw.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20).rotateX(Math.PI / 2), S('#151518'), 0, 0, 0.0));
  sw.add(mesh(new THREE.CircleGeometry(0.04, 20), M(o.accent ?? '#d62828'), 0, 0, 0.027));
  c.add(sw);
  c.add(tube(wc.toArray(), [0.4, dashTop - 0.06, faceZ + 0.04], 0.035, S('#151518')));
  car.driver = pana;
  // one draw call for the whole cabin: bake every part with its colour as a
  // vertex colour (glowing faces get their glow added in)
  chassis.updateMatrixWorld(true);
  const inv = chassis.matrixWorld.clone().invert(), geos = [], col = new THREE.Color();
  c.traverse(m => {
    if (!m.isMesh) return;
    const g = bakeGeometry(m, false);
    g.applyMatrix4(inv);
    col.copy(m.material.color);
    if (m.material.emissive) col.add(m.material.emissive.clone().multiplyScalar(m.material.emissiveIntensity ?? 1));
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[3 * i] = col.r; a[3 * i + 1] = col.g; a[3 * i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    const dv = new Float32Array(n).fill(m.userData.detail ?? 0), sc = m.userData.stitch ?? col, sv = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sv[3 * i] = sc.r; sv[3 * i + 1] = sc.g; sv[3 * i + 2] = sc.b; }
    g.setAttribute('detail', new THREE.BufferAttribute(dv, 1));
    g.setAttribute('stitch', new THREE.BufferAttribute(sv, 3));
    geos.push(g);
  });
  chassis.remove(c);
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  const cabinMesh = mesh(merged, CABIN_MAT);
  cabinMesh.name = 'cabin interior';
  chassis.add(cabinMesh);
}
const lerp = (a, b, t) => a + (b - a) * t;

// A beetle fender: a domed section swept round the wheel, thick over the top
// and tapering into each end. Returns the mesh (in chassis space).
export function sweptFender({ x, axle, hub, r, w = 0.84, thick = 0.3, a0 = -0.42, a1 = Math.PI + 0.3, mat, n = 40, tailBack = 0, tailFront = 0, boardY = null }) {
  const frames = [];
  const tail = (end, dir, L) => {
    // a straight run off the arc end that sinks to the running board and thins out
    const k = 8, out = [];
    for (let i = 1; i <= k; i++) {
      const t = i / k, p = end.p.clone();
      p.z += dir * L * t;
      p.y = THREE.MathUtils.lerp(end.p.y, boardY ?? end.p.y, Math.sin(t * Math.PI / 2));
      const u = end.u.clone().lerp(V(0, 1, 0), Math.min(1, t * 1.6)).normalize();
      out.push({ p, u, su: end.su * (1 - 0.55 * t), sv: end.sv * (1 - 0.1 * t) });
    }
    return out;
  };
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, u = V(0, Math.sin(a), Math.cos(a));
    const t = Math.sin(Math.PI * i / n), ends = 0.55 + 0.45 * t;
    frames.push({ p: V(x, hub, axle).addScaledVector(u, r), u, su: tailBack && i > n / 2 ? Math.max(ends, 0.8) : tailFront && i < n / 2 ? Math.max(ends, 0.8) : ends, sv: 0.82 + 0.18 * t });
  }
  if (tailBack) frames.push(...tail(frames.at(-1), -1, tailBack));
  if (tailFront) frames.unshift(...tail(frames[0], 1, tailFront).reverse());
  const section = [];
  const N = 14;
  for (let k = 0; k <= N; k++) { const t = Math.PI * k / N; section.push([Math.pow(Math.sin(t), 0.6) * thick, -Math.cos(t) * w / 2]); }
  section.push([-0.02, w / 2 - 0.02], [-0.02, -w / 2 + 0.02]);
  return sweep(frames, section, mat, { cap: 0.9 });
}

// ---------- the hollow cabin (El Chamo's, the template for every car) ----------
// The body has an opening over the cabin (lowerBody opening), so here we build
// the whole tub: floor, door cards, wheel-arch humps, firewall and cargo bay,
// then furniture sized from the capybara itself. The seated pana is chibi:
// about 2.16 tall unscaled, a head 1.2 wide sitting 0.8 above the seat, legs
// straight out ahead, hands 0.55 forward. Every piece below is measured off it.
function mergeCabin(chassis, c) {
  chassis.updateMatrixWorld(true);
  const inv = chassis.matrixWorld.clone().invert(), geos = [], col = new THREE.Color();
  c.traverse(m => {
    if (!m.isMesh) return;
    const g = bakeGeometry(m, false);
    g.applyMatrix4(inv);
    col.copy(m.material.color);
    if (m.material.emissive) col.add(m.material.emissive.clone().multiplyScalar(m.material.emissiveIntensity ?? 1));
    const n = g.attributes.position.count, a = new Float32Array(n * 3), sv = new Float32Array(n * 3);
    const sc = m.userData.stitch ?? col;
    for (let i = 0; i < n; i++) { a.set([col.r, col.g, col.b], 3 * i); sv.set([sc.r, sc.g, sc.b], 3 * i); }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.setAttribute('detail', new THREE.BufferAttribute(new Float32Array(n).fill(m.userData.detail ?? 0), 1));
    g.setAttribute('stitch', new THREE.BufferAttribute(sv, 3));
    geos.push(g);
  });
  chassis.remove(c);
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  const m = mesh(merged, CABIN_MAT);
  m.name = 'cabin interior';
  chassis.add(m);
  return m;
}

// o: { belt, zDash, zBack, opening: { z0, z1, hw }, axles, archR, hub, track, tireW,
//   driverZ, roofInner, glassZ, pillarR, interior, seat, accent, avatar, mirror, hanging, cargo }
export function hollowCabin(car, o) {
  const chassis = car.chassis, c = new THREE.Group();
  chassis.add(c);
  const lift = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#9a9283'), k).getHexString();
  const base = lift(o.interior ?? '#2b2732', 0.3), seatHex = lift(o.seat ?? '#2b2732', 0.22);
  const inside = S(base, { roughness: 0.85 }), dashM = o.dashPaint ? S(o.dashPaint, { roughness: 0.32, metalness: 0.1 }) : S(shade(base, 1.12), { roughness: 0.6 }), soft = S(shade(base, 1.35), { roughness: 0.9 });
  const seatM = S(seatHex, { roughness: 0.75 }), seatDark = S(shade(seatHex, 0.78)), pipe = S(o.accent ?? '#d62828', { roughness: 0.5 });
  const metal = S('#b9bdc6', { metalness: 0.6, roughness: 0.3 }), rubber = S('#1d1d21', { roughness: 0.8 }), carpet = S(shade(base, 0.8), { roughness: 1 });
  const stitchC = new THREE.Color(o.accent ?? '#e8d9b0').lerp(new THREE.Color('#ffffff'), 0.15);
  const glassZ0 = o.glassZ ?? (() => o.zDash), glassZ = y => glassZ0(y) - (o.pillarR ?? 0) * 0.9;
  const { z0, z1, hw } = o.opening;
  const add = (m, d, st) => { c.add(tag(m, d ?? 0, st)); return m; };

  // ----- the capy first: everything is sized to it
  const pana = buildCharacter(o.avatar, { seated: true });
  pana.armL.rotation.set(-1.15, 0, -0.25);
  pana.armR.rotation.set(-1.15, 0, 0.25);
  const roofAt = z => o.roofInner ? o.roofInner(z) : Infinity;
  const ysMin = (o.minFloor ?? -Infinity) + 0.32;
  const sizeAt = z => {
    const sc = Math.min(0.82, (roofAt(z) - 0.07 - Math.max(ysMin, o.belt - 0.58)) / 2.16);
    return [sc, Math.max(ysMin, Math.min(o.belt - 0.58, roofAt(z) - 0.07 - 2.16 * sc))];
  };
  // the face must stay behind the leaning windshield: check the head's front
  // (muzzle, forehead, crown, in seated units) against the glass at each height
  // and slide the seat back until it clears
  const HEAD_FRONT = [[0.95, 0.67], [1.2, 0.66], [1.45, 0.6], [1.7, 0.48], [1.95, 0.28]];
  let dzr = o.driverZ, [s, Ys] = sizeAt(dzr);
  for (let it = 0; it < 4; it++) {
    const clear = Math.min(...HEAD_FRONT.map(([h, f]) => glassZ(Ys + h * s) - 0.08 - (dzr + f * s)));
    if (clear >= 0) break;
    dzr = Math.max(z0 + 0.7, dzr + clear);
    [s, Ys] = sizeAt(dzr);
  }
  const dx = 0.47;
  pana.group.scale.setScalar(s);
  pana.group.position.set(dx, Ys, dzr);
  chassis.add(pana.group);
  car.driver = pana;
  const chin = Ys + 0.8 * s, floor = Ys - 0.32;
  car.fit.driver = { size: s, sightline: chin, roofBottom: roofAt(dzr) - 0.07 };

  // ----- the tub
  const R = o.archR + 0.04, humpX = Math.max(0.5, o.track - o.tireW / 2 - 0.14);
  const humps = o.axles.map(z => [z - R, z + R]);
  const outsideHumps = (za, zb) => {
    // split [za, zb] around the humps
    let runs = [[za, zb]];
    for (const [h0, h1] of humps) runs = runs.flatMap(([a, b]) => b <= h0 || a >= h1 ? [[a, b]] : [[a, Math.min(b, h0)], [Math.max(a, h1), b]].filter(([p, q]) => q - p > 0.04));
    return runs;
  };
  // floor: centre between the humps, sides between them; carpet and a transmission tunnel
  add(rbox(2 * humpX, 0.08, z1 - z0, carpet, 0, floor - 0.04, (z0 + z1) / 2, 0.02), 2);
  for (const sx of [1, -1]) for (const [a, b] of outsideHumps(z0, z1)) add(rbox(hw + 0.02 - humpX, 0.08, b - a, carpet, sx * (humpX + hw + 0.02) / 2, floor - 0.04, (a + b) / 2, 0.02), 2);
  add(rbox(0.26, 0.14, z1 - z0 - 0.2, carpet, 0, floor + 0.07, (z0 + z1) / 2 + 0.1, 0.06), 2);
  // wheel-arch humps: a carpeted arch over each wheel's inner side, only the
  // part that falls inside the cabin, closed by a side panel down to the floor
  for (const z of o.axles) {
    const ca = Math.max(-1, Math.min(1, (z1 - z) / R)), cb = Math.max(-1, Math.min(1, (z0 - z) / R));
    if (ca <= -1 || cb >= 1) continue;
    const a0 = Math.acos(ca), a1 = Math.acos(cb), n = 28;   // angle from +z, over the top
    for (const sx of [1, -1]) {
      const xi = sx * humpX, xo = sx * (hw + 0.02), pos = [], idx = [];
      const pt = a => [z + R * Math.cos(a), Math.max(floor, o.hub + R * Math.sin(a))];
      for (let i = 0; i <= n; i++) { const [zz, yy] = pt(a0 + (a1 - a0) * i / n); pos.push(xi, yy, zz, xo, yy, zz); }
      for (let i = 0; i < n; i++) { const k = 2 * i; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
      // inner side panel: arc down to the floor
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) { const [zz, yy] = pt(a0 + (a1 - a0) * i / n); pos.push(xi, yy, zz, xi, floor, zz); }
      for (let i = 0; i < n; i++) { const k = base + 2 * i; idx.push(k, k + 3, k + 1, k, k + 2, k + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: carpet.color, side: THREE.DoubleSide }));
      add(m, 2);
    }
  }
  // firewall under the dash and the rear wall / cargo bay
  add(rbox(2 * hw, Math.max(0.2, o.belt - floor), 0.06, inside, 0, (o.belt + floor) / 2, z1 + 0.02, 0.02), 3);
  add(rbox(2 * hw, o.belt - floor, 0.06, inside, 0, (o.belt + floor) / 2, z0 - 0.02, 0.02), 3);

  // ----- door cards: thick panels with armrest, pull cup, pocket, speaker, handle, lock knob
  const sill = o.belt + 0.1;
  for (const sx of [1, -1]) {
    for (const [a, b] of outsideHumps(z0, z1)) {
      const L = b - a, zc = (a + b) / 2;
      add(rbox(0.14, sill - floor, L, inside, sx * (hw - 0.07), (sill + floor) / 2, zc, 0.03), 3);
      if (L < 0.6) continue;
      add(rbox(0.16, 0.12, Math.min(0.7, L * 0.55), soft, sx * (hw - 0.15), Ys + 0.24, zc + 0.02, 0.05), 3);           // armrest
      add(rbox(0.05, 0.05, 0.16, rubber, sx * (hw - 0.2), Ys + 0.27, zc + 0.14, 0.02), 3);                              // pull cup
      add(rbox(0.06, 0.16, Math.min(0.62, L * 0.5), S(shade(base, 0.7)), sx * (hw - 0.15), floor + 0.16, zc + 0.04, 0.03), 3);  // pocket
      add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 32).rotateZ(Math.PI / 2), S('#121215', { roughness: 0.7 }), sx * (hw - 0.155), floor + 0.36, zc - L * 0.25), 6);
      add(mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 32).rotateY(Math.PI / 2), metal, sx * (hw - 0.16), floor + 0.36, zc - L * 0.25));
      add(rbox(0.04, 0.05, 0.14, metal, sx * (hw - 0.16), Ys + 0.44, zc + L * 0.3, 0.02));                             // door handle
      add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 10), metal, sx * (hw - 0.07), sill + 0.04, zc - L * 0.3));  // lock post
      add(mesh(new THREE.SphereGeometry(0.024, 12, 10), rubber, sx * (hw - 0.07), sill + 0.085, zc - L * 0.3));
      add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateZ(Math.PI / 2), metal, sx * (hw - 0.155), Ys + 0.08, zc + L * 0.12));   // window crank
      add(strap([sx * (hw - 0.17), Ys + 0.08, zc + L * 0.12], [sx * (hw - 0.17), Ys - 0.04, zc + L * 0.12 - 0.06], 0.03, 0.018, metal, V(sx, 0, 0)));
      add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 12).rotateZ(Math.PI / 2), rubber, sx * (hw - 0.2), Ys - 0.04, zc + L * 0.12 - 0.06));
    }
    add(rbox(0.16, 0.04, z1 - z0, rubber, sx * (hw - 0.07), sill + 0.01, (z0 + z1) / 2, 0.018), 3);                     // window seal along the sill
  }

  // ----- seats, measured from the capy
  const hip = 0.47 * s, seatW = Math.min(2 * hip + 0.16, dx * 2 - 0.12), backH = 0.78 * s, seatD = 0.62;
  const seatZ = dzr - 0.04;   // cushion centre (legs go forward from the hips)
  const bucket = (x) => {
    const g = new THREE.Group();
    g.position.set(x, Ys, seatZ);
    g.add(tag(rbox(seatW - 0.14, 0.18, seatD, seatM, 0, -0.09, 0, 0.08), 1, stitchC));
    for (const sx of [1, -1]) g.add(tag(rbox(0.12, 0.24, seatD, seatDark, sx * (seatW / 2 - 0.06), -0.06, 0, 0.06), 3));
    g.add(tag(rbox(seatW - 0.2, 0.1, seatD - 0.1, rubber, 0, -0.23, 0, 0.03), 0));                     // seat base
    for (const sx of [1, -1]) g.add(tag(rbox(0.04, 0.05, seatD + 0.1, metal, sx * (seatW / 2 - 0.16), -0.29, 0.02, 0.015), 0));   // rails
    const back = new THREE.Group();
    back.position.set(0, 0.0, -seatD / 2 + 0.04);
    back.rotation.x = -0.18;
    back.add(tag(rbox(seatW - 0.14, backH, 0.2, seatM, 0, backH / 2, -0.06, 0.09), 1, stitchC));
    for (const sx of [1, -1]) back.add(tag(rbox(0.13, backH * 0.92, 0.3, seatDark, sx * (seatW / 2 - 0.065), backH * 0.47, -0.04, 0.06), 3));
    const roll = mesh(new THREE.CylinderGeometry(0.1, 0.1, seatW - 0.04, 24).rotateZ(Math.PI / 2), seatDark, 0, backH, -0.07);
    back.add(tag(roll, 3));
    back.add(tag(rbox(seatW * 0.34, backH * 0.62, 0.02, pipe, 0, backH * 0.48, 0.045, 0.01), 6));
    g.add(back);
    g.add(tag(rbox(0.04, 0.04, 0.12, metal, Math.sign(x) * (seatW / 2 + 0.01), -0.02, -seatD / 2 + 0.1, 0.015), 0));   // recline lever
    c.add(g);
    return g;
  };
  bucket(dx); bucket(-dx);
  // belts: the passenger's lies across the empty seat, the driver's hangs on the pillar
  const webbing = S('#2c2c31', { roughness: 0.8 });
  const belt = (x, zb, h, side) => {
    const top = [x + side * (seatW / 2 - 0.16), Ys + h - 0.06, zb + 0.12 - h * 0.18];
    const hipP = [x - side * (seatW / 2 - 0.12), Ys + 0.06, zb + 0.16];
    add(strap(top, hipP, 0.09, 0.016, webbing), 5);
    add(strap([x + side * (seatW / 2 - 0.1), Ys + 0.05, zb + 0.18], hipP, 0.085, 0.016, webbing), 5);
    add(rbox(0.09, 0.06, 0.035, metal, hipP[0], hipP[1] + 0.01, hipP[2] + 0.02, 0.014));
    add(rbox(0.06, 0.16, 0.06, rubber, x - side * (seatW / 2 - 0.02), Ys + 0.02, zb + 0.12, 0.025));
    add(rbox(0.04, 0.03, 0.014, M('#d62828'), x - side * (seatW / 2 - 0.02), Ys + 0.1, zb + 0.152, 0.007));
  };
  if (o.harness) {
    // four-point harnesses on both buckets
    for (const x of [dx, -dx]) {
      const zb = seatZ - seatD / 2, hx = x === dx ? 0.2 : 0.16;
      if (x === dx) continue;   // the driver's own harness would cut through the capy
      for (const sx of [1, -1]) add(strap([x + sx * hx, Ys + backH + 0.02, zb - 0.02 - backH * 0.18], [x + sx * 0.08, Ys + 0.14, zb + 0.3], 0.08, 0.016, S(o.accent ?? '#d62828', { roughness: 0.7 })), 5);
      add(strap([x - seatW / 2 + 0.12, Ys + 0.06, zb + 0.2], [x + seatW / 2 - 0.12, Ys + 0.06, zb + 0.2], 0.08, 0.016, S(o.accent ?? '#d62828', { roughness: 0.7 })), 5);
      add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 24).rotateX(Math.PI / 2), metal, x, Ys + 0.12, zb + 0.31));
    }
    for (const sx of [1, -1]) add(strap([dx + sx * 0.2, Ys + backH + 0.02, seatZ - seatD / 2 - 0.02 - backH * 0.18], [dx + sx * 0.24, Ys + backH * 0.55, seatZ - seatD / 2 - 0.06], 0.08, 0.016, S(o.accent ?? '#d62828', { roughness: 0.7 })), 5);
  } else belt(-dx, seatZ - seatD / 2, backH, -1);
  if (!o.harness) add(strap([dx + seatW / 2 - 0.05, Ys + backH + 0.05, seatZ - seatD / 2 - 0.05], [dx + seatW / 2 - 0.02, Ys + 0.1, seatZ - seatD / 2 - 0.02], 0.09, 0.016, webbing, V(-1, 0, 0)), 5);
  // rear bench between the humps, two places, its own belts
  // the bench sits as far back as the cabin allows, but always leaves knee
  // room; long cabins (the buseta) get more rows behind it
  let benchZ = Math.max(seatZ - seatD - 0.55, z0 + seatD / 2 + 0.14);
  const rows = [];
  if (o.rows === 'fill') for (let z = seatZ - seatD - 0.55; z - seatD / 2 > z0 + 0.08; z -= seatD + 0.42) rows.push(z);
  else if (benchZ + seatD / 2 < seatZ - seatD / 2 - 0.12) rows.push(benchZ);
  if (rows.length) benchZ = rows.at(-1);
  for (const rowZ of rows) {
    const bw = 2 * humpX - 0.04, g = new THREE.Group();
    g.position.set(0, Ys - 0.02, rowZ);
    g.add(tag(rbox(bw, 0.18, seatD - 0.04, seatM, 0, -0.09, 0, 0.08), 1, stitchC));
    g.add(tag(rbox(bw - 0.1, 0.24, seatD - 0.16, rubber, 0, -0.27, 0, 0.03), 0));
    const back = new THREE.Group();
    back.position.set(0, 0, -seatD / 2 + 0.04);
    back.rotation.x = -0.16;
    for (const sx of [1, -1]) {
      back.add(tag(rbox(bw / 2 - 0.02, backH * 0.92, 0.2, seatM, sx * bw / 4, backH * 0.46, -0.06, 0.09), 1, stitchC));
      back.add(tag(rbox(bw * 0.16, backH * 0.55, 0.02, pipe, sx * bw / 4, backH * 0.46, 0.045, 0.01), 6));
    }
    back.add(tag(rbox(0.1, backH * 0.6, 0.18, seatDark, 0, backH * 0.32, -0.02, 0.04), 3));   // fold-down armrest
    g.add(back);
    c.add(g);
    for (const sx of [1, -1]) belt(sx * bw / 4, rowZ - seatD / 2 + 0.02, backH * 0.92, sx);
  }
  // closed trunk: a parcel shelf with speakers behind the last seat
  if (o.cargo === false) {
    const shelfZ0 = z0 + 0.02, shelfZ1 = Math.min(z0 + 0.36, benchZ - seatD / 2 - 0.05);
    if (shelfZ1 - shelfZ0 > 0.12) {
      add(rbox(2 * hw - 0.04, 0.04, shelfZ1 - shelfZ0, carpet, 0, o.belt + 0.02, (shelfZ0 + shelfZ1) / 2, 0.015), 2);
      for (const x of [0.5, -0.5]) {
        add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 28), S('#121215', { roughness: 0.7 }), x, o.belt + 0.05, (shelfZ0 + shelfZ1) / 2), 6);
        add(mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 28).rotateX(Math.PI / 2), metal, x, o.belt + 0.05, (shelfZ0 + shelfZ1) / 2));
      }
    }
  }
  // cargo bay behind the bench (a hatch): carpet floor and a little cargo
  if (o.cargo !== false) {
    const cz0 = z0 + 0.05, cz1 = benchZ - seatD / 2 - 0.12;
    if (cz1 - cz0 > 0.15) {
      const cy = Ys - 0.2, cz = (cz0 + cz1) / 2, cd = Math.min(0.4, cz1 - cz0 - 0.02);
      add(rbox(2 * humpX, 0.06, cz1 - cz0, carpet, 0, cy, cz, 0.02), 2);
      if (o.cargoItem === 'sub') {
        // subwoofer box: two big cones and a glowing amp
        add(rbox(2 * humpX - 0.1, 0.44, cd, S('#1c1b20', { roughness: 0.7 }), 0, cy + 0.25, cz, 0.04), 2);
        for (const x of [-0.27, 0.27]) {
          const zf = cz + cd / 2 + 0.005;
          add(mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.06, 32).rotateX(Math.PI / 2), S('#3c3b44', { roughness: 0.5 }), x, cy + 0.25, zf));
          add(mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 32), metal, x, cy + 0.25, zf + 0.03));
          add(mesh(new THREE.SphereGeometry(0.06, 18, 12), S('#111114', { roughness: 0.4 }), x, cy + 0.25, zf + 0.02));
        }
        add(rbox(0.5, 0.06, 0.16, M('#ff4fa3', { emissive: '#ff2f93', emissiveIntensity: 1.0 }), 0, cy + 0.5, cz, 0.02));
      } else if (o.cargoItem === 'basket') {
        // a picnic basket with a checked cloth
        add(rbox(0.5, 0.26, Math.min(0.34, cd), S('#b9874d', { roughness: 0.85 }), -0.2, cy + 0.16, cz, 0.05), 3);
        add(rbox(0.42, 0.04, Math.min(0.28, cd - 0.04), S('#d8343c', { roughness: 0.8 }), -0.2, cy + 0.3, cz, 0.02), 6);
        add(tube([-0.4, cy + 0.3, cz], [-0.2, cy + 0.44, cz], 0.015, S('#8a5f30')));
        add(tube([-0.2, cy + 0.44, cz], [0.0, cy + 0.3, cz], 0.015, S('#8a5f30')));
      } else if (o.cargoItem !== 'none') {
        add(rbox(0.5, 0.3, Math.min(0.34, cd), S('#c8452f', { roughness: 0.6 }), -0.25, cy + 0.18, cz, 0.05), 3);   // a little duffel
        add(rbox(0.36, 0.04, 0.06, rubber, -0.25, cy + 0.34, cz, 0.02));
      }
    }
  }

  // ----- dashboard (low, so the whole face clears it)
  const dashTop = Math.min(o.belt + 0.08, chin - 0.05);
  const wheelZ = dzr + 0.5, frontZ = Math.min(z1 + 0.06, glassZ(dashTop) - 0.02), faceZ = Math.max(wheelZ + 0.16, frontZ - 0.5);
  const H = dashTop - floor, dashW = 2 * hw - 0.04 - (o.pillarR ?? 0) * 1.2, dDepth = frontZ - faceZ;
  {
    let pr = [[0, -0.01], [0, H], [dDepth * 0.45, H + 0.03], [dDepth * 0.82, H + 0.01], [dDepth, H - 0.06], [dDepth - 0.01, H - 0.16], [dDepth - 0.1, Math.max(0.1, H * 0.4)], [dDepth - 0.16, 0.02], [0.1, -0.01]];
    for (let it = 0; it < 2; it++) {
      const q = [];
      for (let i = 0; i < pr.length; i++) { const A = pr[i], B = pr[(i + 1) % pr.length]; q.push([A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25], [A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]); }
      pr = q;
    }
    const frames = [-1, -0.5, 0, 0.5, 1].map(t => ({ p: V(t * dashW / 2, floor, frontZ), u: V(0, 0, -1) }));
    add(sweep(frames, pr, dashM, { cap: 0.12 }), 4);
    add(rbox(dashW - 0.12, 0.035, dDepth * 0.6, inside, 0, dashTop + 0.03, frontZ - dDepth * 0.45, 0.016), 3);
    add(rbox(dashW * 0.7, 0.012, 0.03, S('#141417'), 0, dashTop + 0.012, frontZ - 0.05, 0.005));
    for (const sx of [1, -1]) add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 24), S('#141417'), sx * (dashW / 2 - 0.16), dashTop + 0.035, frontZ - 0.1), 6);
  }
  // instrument pod: speedo + tach, big enough to read, and warning lights
  const pod = new THREE.Group();
  pod.position.set(dx, dashTop - 0.06, faceZ + 0.02);
  const podMat = S(shade(base, 0.85), { roughness: 0.55 });
  pod.add(tag(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 28, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), podMat, 0, 0.01, 0.02), 3));
  pod.add(tag(rbox(0.5, 0.14, 0.1, podMat, 0, -0.06, 0.05, 0.04), 3));
  const dialFace = M('#f4eedc', { emissive: '#7a6d42', emissiveIntensity: 0.55 });
  const dials = o.gauges === 'single' ? [[0, 0.12]] : o.gauges === 'digital' ? [] : [[-0.12, 0.085], [0.12, 0.085]];
  if (o.gauges === 'digital') {
    const scr = mesh(new THREE.PlaneGeometry(0.34, 0.12), M('#9fe8ff', { emissive: '#1f8fb0', emissiveIntensity: 1.1 }), 0, 0, -0.03);
    scr.rotation.y = Math.PI; pod.add(scr);
    for (let k = 0; k < 8; k++) { const bar = mesh(new THREE.PlaneGeometry(0.02, 0.012 + k * 0.006), M(k > 5 ? '#ff4a3a' : '#3bd16f', { emissive: k > 5 ? '#ff4a3a' : '#3bd16f', emissiveIntensity: 0.9 }), -0.12 + k * 0.026, -0.03 + k * 0.003, -0.032); bar.rotation.y = Math.PI; pod.add(bar); }
  }
  for (const [ox, r0] of dials) {
    const g = new THREE.Group();
    g.position.set(ox, 0.0, -0.035);
    g.rotation.y = Math.PI;
    g.rotation.x = 0.2;
    g.add(mesh(new THREE.TorusGeometry(r0, 0.014, 10, 32), metal));
    g.add(mesh(new THREE.CircleGeometry(r0 - 0.004, 32), dialFace, 0, 0, -0.002));
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (1.25 - 1.5 * k / 10), big = k % 2 === 0;
      const tick = mesh(new THREE.PlaneGeometry(big ? 0.006 : 0.004, big ? 0.02 : 0.012), S('#1a1a1e'), Math.cos(a) * r0 * 0.75, Math.sin(a) * r0 * 0.75, 0.001);
      tick.rotation.z = a - Math.PI / 2;
      g.add(tick);
    }
    const needle = mesh(new THREE.PlaneGeometry(0.008, 0.065), M('#e23b2e', { emissive: '#801010', emissiveIntensity: 0.6 }), 0, 0.026, 0.002);
    needle.rotation.z = ox > 0 ? -0.9 : 0.5;
    g.add(needle);
    g.add(mesh(new THREE.CircleGeometry(0.014, 14), S('#1a1a1e'), 0, 0, 0.003));
    pod.add(g);
  }
  for (const [k, col] of [[-1.5, '#3bd16f'], [-0.5, '#ffb02e'], [0.5, '#ff4a3a'], [1.5, '#4aa3ff']]) {
    const l = mesh(new THREE.CircleGeometry(0.013, 14), M(col, { emissive: col, emissiveIntensity: 0.8 }), k * 0.035, -0.1, -0.005);
    l.rotation.y = Math.PI;
    pod.add(l);
  }
  c.add(pod);
  // centre stack: radio, knobs, vents, switches, hazard
  const stack = new THREE.Group(), stackH = Math.max(0.24, H - 0.05);
  stack.position.set(0, floor, faceZ + 0.05);
  stack.add(tag(rbox(0.44, stackH, 0.16, S('#2e2e34', { roughness: 0.5 }), 0, stackH / 2, 0.03, 0.04), 4));
  const onFace = (m, x, y, dz = 0) => { m.position.set(x, y, -0.055 - dz); m.rotation.y = Math.PI; stack.add(m); return m; };
  onFace(rbox(0.3, 0.09, 0.02, S('#16161a'), 0, 0, 0, 0.01), 0, stackH - 0.08);
  onFace(mesh(new THREE.PlaneGeometry(0.17, 0.05), M('#7fd3c4', { emissive: '#2a9f8c', emissiveIntensity: 1.0 })), -0.025, stackH - 0.08, 0.012);
  for (const x of [0.1, 0.135]) onFace(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16).rotateX(Math.PI / 2), metal), x, stackH - 0.08, 0.012);
  for (let k = 0; k < 5; k++) onFace(rbox(0.038, 0.02, 0.016, S('#56565e'), 0, 0, 0, 0.006), -0.12 + k * 0.06, stackH - 0.15);
  for (const x of [-0.1, 0.1]) {
    onFace(rbox(0.15, 0.085, 0.02, metal, 0, 0, 0, 0.014), x, stackH - 0.23);
    for (let k = 0; k < 4; k++) onFace(rbox(0.13, 0.01, 0.028, S('#141417'), 0, 0, 0, 0.004), x, stackH - 0.26 + k * 0.02);
  }
  for (const x of [-0.12, 0.12]) onFace(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 24).rotateX(Math.PI / 2), S('#202024'), 0, 0, 0), x, Math.max(0.12, stackH - 0.33)).position.z -= 0.01;
  onFace(rbox(0.06, 0.035, 0.02, M('#e0262f', { emissive: '#600000', emissiveIntensity: 0.6 }), 0, 0, 0, 0.01), 0, stackH - 0.03, 0.005);
  c.add(stack);
  for (const sx of [1, -1]) {
    const v = new THREE.Group();
    v.position.set(sx * (dashW / 2 - 0.15), dashTop - 0.08, faceZ + 0.0);
    v.rotation.y = Math.PI;
    v.add(mesh(new THREE.TorusGeometry(0.055, 0.015, 10, 24), metal));
    v.add(mesh(new THREE.CircleGeometry(0.052, 24), S('#141417'), 0, 0, -0.004));
    for (let k = -1; k <= 1; k++) v.add(rbox(0.085, 0.01, 0.012, S('#4a4a52'), 0, k * 0.022, 0, 0.004));
    c.add(v);
  }
  {
    const gx = -dx, gy = floor + H * 0.6, gw = 0.46, gh = Math.min(0.18, H * 0.35);
    for (const [ww, hh, ox, oy] of [[gw, 0.01, 0, gh / 2], [gw, 0.01, 0, -gh / 2], [0.01, gh, gw / 2, 0], [0.01, gh, -gw / 2, 0]]) add(rbox(ww, hh, 0.012, S('#141417'), gx + ox, gy + oy, faceZ - 0.005, 0.003));
    add(rbox(0.08, 0.025, 0.02, metal, gx, gy + gh / 2 - 0.035, faceZ - 0.01, 0.009));
  }
  // dashboard capy bobblehead
  {
    const bx = -0.32, by = dashTop + 0.05, bz = frontZ - dDepth * 0.5, fur = M('#c98a3c', { roughness: 0.8 });
    add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16), S('#1a1a1e'), bx, by, bz));
    const bod = mesh(new THREE.SphereGeometry(0.045, 16, 12), fur, bx, by + 0.055, bz); bod.scale.set(1, 0.85, 1.2); add(bod);
    add(mesh(new THREE.SphereGeometry(0.06, 18, 14), fur, bx, by + 0.14, bz - 0.01));
    add(mesh(new THREE.SphereGeometry(0.03, 14, 10), M('#7a4a2b'), bx, by + 0.13, bz - 0.065));
    for (const sx of [1, -1]) {
      add(mesh(new THREE.SphereGeometry(0.018, 10, 8), M('#7a4a2b'), bx + sx * 0.036, by + 0.195, bz - 0.005));
      add(mesh(new THREE.SphereGeometry(0.008, 8, 6), M('#111114'), bx + sx * 0.026, by + 0.16, bz - 0.06));
    }
  }
  // pedals at the capy's feet, gear lever with its boot, handbrake
  const feetZ = dzr + 0.4 * s;
  for (const [k, w] of [[0, 0.1], [1, 0.1], [2, 0.08]]) {
    const ped = rbox(w, 0.13, 0.025, S('#3a3a40', { roughness: 0.6 }), dx + 0.18 - k * 0.15, Ys - 0.02, Math.min(faceZ - 0.05, feetZ + 0.12), 0.01);
    ped.rotation.x = 0.45;
    add(ped, 4);
    add(tube([dx + 0.18 - k * 0.15, Ys + 0.04, Math.min(faceZ - 0.05, feetZ + 0.12) + 0.02], [dx + 0.18 - k * 0.15, dashTop - 0.2, faceZ - 0.02], 0.012, metal));
  }
  add(rbox(0.3, 0.12, Math.max(0.3, faceZ - (seatZ - 0.3) - 0.1), soft, 0, floor + 0.2, (faceZ + seatZ - 0.3) / 2, 0.05), 3);   // console
  add(mesh(new THREE.ConeGeometry(0.075, 0.12, 20), rubber, 0, floor + 0.32, seatZ + 0.22), 3);                                  // gear boot
  add(tube([0, floor + 0.3, seatZ + 0.22], [0, floor + 0.5, seatZ + 0.18], 0.018, metal));
  add(mesh(new THREE.SphereGeometry(0.06, 20, 14), M('#1a1a1e', { roughness: 0.35 }), 0, floor + 0.53, seatZ + 0.17));
  add(tube([0.07, floor + 0.28, seatZ - 0.15], [0.07, floor + 0.4, seatZ + 0.08], 0.02, metal));
  add(strap([0.07, floor + 0.37, seatZ + 0.01], [0.07, floor + 0.41, seatZ + 0.12], 0.055, 0.055, rubber, V(0, 1, 0)), 3);

  // ----- steering wheel at the capy's hands: chunky rim, two spokes, a horn pad
  const wc = V(dx, Ys + 0.58 * s + 0.02, wheelZ);
  const sw = new THREE.Group();
  sw.position.copy(wc);
  sw.rotation.x = -0.5;
  const rimMat = o.wheel === 'classic' ? S('#f1ece0', { roughness: 0.35 }) : o.wheel === 'fuzzy' ? S(o.wheelColor ?? '#ff79c6', { roughness: 1 }) : S('#18181b', { roughness: 0.6 });
  const rimR = o.wheel === 'classic' ? 0.3 : o.wheel === 'sport' ? 0.22 : 0.26, rimT = o.wheel === 'classic' ? 0.03 : o.wheel === 'fuzzy' ? 0.075 : 0.05;
  sw.add(tag(mesh(new THREE.TorusGeometry(rimR, rimT, 14, 44), rimMat), o.wheel === 'fuzzy' ? 2 : 3));
  if (o.wheel === 'sport') sw.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16).rotateX(Math.PI / 2), S(o.accent ?? '#d62828'), 0, 0.03, 0.03));
  for (const a of [0, Math.PI]) {
    const sp = rbox(rimR, 0.05, 0.03, o.wheel === 'classic' ? rimMat : metal, Math.cos(a) * rimR / 2, -0.02, 0, 0.015);
    sp.rotation.z = -0.15 * Math.sign(Math.cos(a));
    sw.add(sp);
  }
  sw.add(tag(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 28).rotateX(Math.PI / 2), S('#18181b'), 0, -0.01, 0.0), 3));
  sw.add(mesh(new THREE.CircleGeometry(0.065, 28), pipe, 0, -0.01, 0.032));
  c.add(sw);
  const colEnd = [dx, dashTop - 0.1, faceZ + 0.04];
  add(tube(wc.toArray(), colEnd, 0.04, S('#18181b')));
  add(rbox(0.16, 0.12, 0.2, S('#202024'), dx, (wc.y + colEnd[1]) / 2 - 0.02, (wc.z + colEnd[2]) / 2 + 0.06, 0.05), 3);   // column shroud
  for (const sx of [1, -1]) add(tube([dx + sx * 0.07, (wc.y + colEnd[1]) / 2, (wc.z + colEnd[2]) / 2 + 0.04], [dx + sx * 0.2, (wc.y + colEnd[1]) / 2 + 0.02, (wc.z + colEnd[2]) / 2 + 0.02], 0.012, rubber));   // stalks

  // ----- overhead: mirror with the freshener, visors, dome light
  if (o.open) {
    add(rbox(2 * hw + 0.04, 0.05, 0.2, rubber, 0, o.belt + 0.03, z1 + 0.02, 0.02), 3);
    add(rbox(2 * hw + 0.04, 0.05, 0.2, rubber, 0, o.belt + 0.03, z0 - 0.02, 0.02), 3);
  }
  o.decor?.({ add, c, chassis, car, Ys, s, floor, dashTop, frontZ, faceZ, seatZ, seatD, seatW, backH, dx, hw, z0, z1, humpX, wheelZ, metal, rubber, soft, carpet, inside, dashM, seatM, pipe, benchZ, H });
  if (o.mirror && !o.open) {
    const [my, mz] = o.mirror;
    add(rbox(0.42, 0.12, 0.06, rubber, 0, my, mz, 0.03));
    add(mesh(new THREE.PlaneGeometry(0.36, 0.08), M('#bcd3e0', { metalness: 0.8, roughness: 0.1 }), 0, my, mz - 0.031).rotateY(Math.PI));
    add(tube([0, my + 0.05, mz + 0.01], [0, my + 0.14, mz + 0.05], 0.015, rubber));
    if (o.hanging) {
      const pivot = new THREE.Group();
      pivot.position.set(0, my - 0.07, mz);
      pivot.add(tube([0, 0, 0], [0, -0.22, 0], 0.008, DARK()));
      o.hanging(pivot);
      chassis.add(pivot);
      car.danglers.push(pivot);
    }
    if (o.roofInner) {
      const vw = Math.min(0.5, 2 * ((o.visorHalf ?? 0.95) - 0.07 - dx));   // sized to the roof so nothing pokes through
      if (vw > 0.2) for (const x of [dx, -dx]) add(strap([x, my + 0.08, mz - 0.04], [x, my - 0.07, mz - 0.13], vw, 0.035, soft, V(0, -0.3, -1)), 3);
      const lz = (mz + z0) / 2;
      add(rbox(0.26, 0.035, 0.14, M('#f7f1dc', { emissive: '#8a8060', emissiveIntensity: 0.6 }), 0, o.roofInner(lz) - 0.03, lz, 0.014));
    }
  }
  return mergeCabin(chassis, c);
}
