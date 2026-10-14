// Track registry: one definition per map plus the runtime that turns a
// definition into driveable geometry (pointAt / paramOf / offsetOf /
// groundAt) and a scenery group. Tracks are data; game.js drives them.

import * as THREE from 'three';
import * as kit from './track-kit.js';
import estadio from './tracks/estadio.js';
import desierto from './tracks/desierto.js';
import llanos from './tracks/llanos.js';
import playa from './tracks/playa.js';
import selva from './tracks/selva.js';
import paramo from './tracks/paramo.js';

export const TRACKS = [estadio, desierto, llanos, playa, selva, paramo];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

// ---------- geometry backends ----------
// The original stadium oval, kept verbatim so lap logic never regresses.
function ovalMath({ S, R }) {
  const A = 2 * S;
  const B = Math.PI * R;
  const TOTAL = 2 * A + 2 * B;

  function pointAt(s) {
    s = ((s % TOTAL) + TOTAL) % TOTAL;
    if (s < A) return new THREE.Vector2(-S + s, R);
    s -= A;
    if (s < B) { const t = Math.PI / 2 - s / R; return new THREE.Vector2(S + R * Math.cos(t), R * Math.sin(t)); }
    s -= B;
    if (s < A) return new THREE.Vector2(S - s, -R);
    s -= A;
    const t = -Math.PI / 2 - s / R;
    return new THREE.Vector2(-S + R * Math.cos(t), R * Math.sin(t));
  }

  function paramOf(x, z) {
    if (Math.abs(x) <= S) return z > 0 ? x + S : A + B + (S - x);
    if (x > S) return A + (Math.PI / 2 - Math.atan2(z, x - S)) * R;
    let t = Math.atan2(z, x + S);
    if (t > 0) t -= Math.PI * 2;
    return 2 * A + B + (-Math.PI / 2 - t) * R;
  }

  // signed distance from the centerline (positive = outside)
  function offsetOf(x, z) {
    const cx = Math.max(-S, Math.min(S, x));
    return Math.hypot(x - cx, z) - R;
  }

  return { TOTAL, pointAt, paramOf, offsetOf, bounds: { x: S + R, z: R } };
}

// Closed Catmull-Rom loop through control points, arc-length parameterized
// over a dense sample table so queries stay cheap.
function splineMath(points) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const TOTAL = curve.getLength();
  const N = Math.max(800, Math.round(TOTAL * 2.5));
  const pts = curve.getSpacedPoints(N);   // N+1 entries, last == first

  function pointAt(s) {
    s = ((s % TOTAL) + TOTAL) % TOTAL;
    const f = (s / TOTAL) * N;
    const i = Math.floor(f) % N;
    const t = f - Math.floor(f);
    const a = pts[i], b = pts[i + 1];
    return new THREE.Vector2(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
  }

  function nearest(x, z) {
    // coarse scan, then refine around the best sample
    let best = 0, bestD = Infinity;
    const stride = 16;
    for (let i = 0; i < N; i += stride) {
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    for (let k = -stride; k <= stride; k++) {
      const i = (best + k + N) % N;
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function paramOf(x, z) {
    return (nearest(x, z) / N) * TOTAL;
  }

  // signed distance: positive on the (-tz, tx) side of the direction of
  // travel, matching the offset convention of placeOnTrack / items.js
  function offsetOf(x, z) {
    const i = nearest(x, z);
    const p = pts[i], p2 = pts[(i + 1) % N];
    const tx = p2.x - p.x, tz = p2.z - p.z;
    const l = Math.hypot(tx, tz) || 1;
    const ox = x - p.x, oz = z - p.z;
    const d = Math.hypot(ox, oz);
    const side = (ox * -tz / l + oz * tx / l) >= 0 ? 1 : -1;
    return d * side;
  }

  let bx = 0, bz = 0;
  for (const p of pts) {
    bx = Math.max(bx, Math.abs(p.x));
    bz = Math.max(bz, Math.abs(p.z));
  }
  return { TOTAL, pointAt, paramOf, offsetOf, bounds: { x: bx, z: bz } };
}

// ---------- scenery base ----------
// Low-poly ground with gentle dunes away from the track, vertex-colored.
function buildGround(T, pal) {
  const size = Math.max(T.bounds.x, T.bounds.z) * 2 + 260;
  const hash = (x, z) => {
    const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  let ground = new THREE.PlaneGeometry(size, size, 90, 90);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  const dune = pal.dune ?? 1;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const far = Math.max(0, Math.abs(T.offsetOf(x, z)) - T.HW - 4);
    gp.setY(i, Math.min(1, far / 12) * (Math.sin(x * 0.07) * Math.cos(z * 0.05) * 2.2 + hash(x, z) * 1.2) * dune - 0.05);
  }
  ground = ground.toNonIndexed();
  const colors = [];
  const base = new THREE.Color(pal.ground);
  for (let i = 0; i < ground.attributes.position.count; i += 3) {
    const c = base.clone().offsetHSL(0, 0, (hash(i, 1) - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const m = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

// Road surface: the shape-extruded ring for the oval, a triangle strip
// along the curve for spline tracks.
function buildRibbon(T, pal) {
  let geo;
  if (T.def.oval) {
    const { S, R } = T.def.oval;
    const HW = T.HW;
    const shape = new THREE.Shape();
    shape.absarc(S, 0, R + HW, -Math.PI / 2, Math.PI / 2, false);
    shape.absarc(-S, 0, R + HW, Math.PI / 2, Math.PI * 1.5, false);
    const hole = new THREE.Path();
    hole.absarc(S, 0, R - HW, -Math.PI / 2, Math.PI / 2, false);
    hole.absarc(-S, 0, R - HW, Math.PI / 2, Math.PI * 1.5, false);
    shape.holes.push(hole);
    geo = new THREE.ShapeGeometry(shape, 24);
    geo.rotateX(-Math.PI / 2);   // face up
  } else {
    const N = Math.max(240, Math.round(T.TOTAL / 0.7));
    const verts = [];
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * T.TOTAL;
      const p = kit.placeOnTrack(T, s, 0);
      const tx = Math.sin(p.h), tz = Math.cos(p.h);
      // left edge (off +HW) = (-tz, tx) side, right edge = (tz, -tx)
      verts.push(p.x - tz * T.HW, 0, p.z + tx * T.HW, p.x + tz * T.HW, 0, p.z - tx * T.HW);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: pal.track, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  m.position.y = 0.03;
  m.receiveShadow = true;
  return m;
}

// Sand island over a sea-colored ground (Playa Pana).
function buildIsland(T, island) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: island.color, roughness: 1, flatShading: true }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(island.rx, island.rz, 1);
  m.position.y = 0.015;
  m.receiveShadow = true;
  return m;
}

// ---------- runtime ----------
export function makeTrack(def) {
  const geo = def.oval ? ovalMath(def.oval) : splineMath(def.points);
  const T = {
    def, id: def.id, name: def.name,
    HW: def.hw,
    TOTAL: geo.TOTAL,
    LINE: def.lineU != null ? def.lineU * geo.TOTAL : def.line,
    bounds: geo.bounds,
    pointAt: geo.pointAt,
    paramOf: geo.paramOf,
    offsetOf: geo.offsetOf,
    ramps: (def.ramps || []).map((r) => ({ ...r, s0: r.u != null ? r.u * geo.TOTAL : r.s0 })),
    animated: [],
  };
  T.groundAt = (x, z) => {
    const off = geo.offsetOf(x, z);
    if (Math.abs(off) > 5) return 0;
    const s = geo.paramOf(x, z);
    for (const r of T.ramps) {
      if (s >= r.s0 && s <= r.s0 + r.len && Math.abs(off) < r.hw) return r.h * (s - r.s0) / r.len;
    }
    return 0;
  };

  // Build every visual into a fresh group; caller adds it to the scene and
  // drops the old one when switching tracks.
  T.build = () => {
    const group = new THREE.Group();
    group.add(buildGround(T, def.palette));
    if (def.island) group.add(buildIsland(T, def.island));
    group.add(buildRibbon(T, def.palette));
    kit.startLine(group, T);
    if (def.walls !== false) kit.tireWall(group, T);
    if (def.fence) kit.fenceRing(group, T, def.fence);
    if (def.chevrons !== false) kit.chevrons(group, T);
    kit.buildRamps(group, T);
    def.scenery?.(group, kit, T);
    group.traverse((o) => { if (o.userData.tick) T.animated.push(o); });
    T.group = group;
    return group;
  };
  return T;
}
