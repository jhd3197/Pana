// Geometry/runtime shared by the race and Studio's individual map previews.
import * as THREE from 'three';
import * as kit from './track-kit.js';

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
function splineMath(points, rounded = false) {
  // Two corner-cutting passes preserve straights but leave room to drift
  // around authored street junctions instead of creating needle hairpins.
  if (rounded) for (let pass = 0; pass < 2; pass++) {
    points = points.flatMap((a,i) => {
      const b = points[(i+1)%points.length];
      return [[a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],
        [a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]];
    });
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  curve.arcLengthDivisions = Math.max(1200, points.length * 40);
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
    const coarse = best;
    for (let k = -stride; k <= stride; k++) {
      const i = (coarse + k + N) % N;
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    // Project onto the nearest segment, rather than snapping cars to a sample.
    // Continuous progress also keeps terrain heights smooth while driving.
    let result = null;
    for (let k = -1; k <= 0; k++) {
      const i = (best + k + N) % N, a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const ox = x - a.x - dx * u, oz = z - a.z - dz * u;
      const d = Math.hypot(ox, oz);
      if (!result || d < result.d) result = { s: ((i + u) / N) * TOTAL, d, side: ox * -dz + oz * dx >= 0 ? 1 : -1 };
    }
    return result;
  }

  function paramOf(x, z) {
    return nearest(x, z).s % TOTAL;
  }

  // signed distance: positive on the (-tz, tx) side of the direction of
  // travel, matching the offset convention of placeOnTrack / items.js
  function offsetOf(x, z) {
    const p = nearest(x, z);
    return p.d * p.side;
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
function terrainHeight(T, pal, x, z) {
  // The beach's sand sits above a flat sea plane. Dunes in that plane
  // otherwise poke blue patches through the expanded island.
  if (T.def.island) return -0.08;
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const far = Math.max(0, Math.abs(T.offsetOf(x, z)) - T.HW - 4);
  return Math.min(1, far / 12) * (Math.sin(x * 0.07) * Math.cos(z * 0.05) * 2.2 + (v - Math.floor(v)) * 1.2) * (pal.dune ?? 1) - 0.05;
}

function buildGround(T, pal) {
  const size = Math.max(T.bounds.x, T.bounds.z) * 2 + 260;
  const hash = (x, z) => {
    const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  let ground = new THREE.PlaneGeometry(size, size, 90, 90);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    gp.setY(i, T.terrainAt(x, z));
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
  if (T.def.oval && !T.def.elevation) {
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
      verts.push(p.x - tz * T.HW, p.y, p.z + tx * T.HW, p.x + tz * T.HW, p.y, p.z - tx * T.HW);
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
  m.position.y = T.def.environment ? 0.12 : 0.03;
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
  const geo = def.oval ? ovalMath(def.oval) : splineMath(def.points, def.rounded);
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
  T.heightAtS = def.elevation ? (s) => {
    const p = geo.pointAt(s);
    return def.elevation(p.x, p.y);
  } : () => 0;
  T.surfaceAt = def.elevation ? (x, z) => T.heightAtS(geo.paramOf(x, z)) : () => 0;
  T.terrainAt = (x, z) => terrainHeight(T, def.palette, x, z);
  T.groundAt = (x, z) => {
    const base = T.surfaceAt(x, z);
    const off = geo.offsetOf(x, z);
    if(def.offroad&&Math.abs(off)>T.HW) {
      const blend=THREE.MathUtils.smoothstep(Math.abs(off),T.HW,T.HW+2);
      return THREE.MathUtils.lerp(base,T.terrainAt(x,z),blend);
    }
    if (Math.abs(off) > 5) return base;
    const s = geo.paramOf(x, z);
    for (const r of T.ramps) {
      const along = (s - r.s0 + T.TOTAL) % T.TOTAL;
      if (along <= r.len && Math.abs(off) < r.hw) return base + r.h * along / r.len;
    }
    return base;
  };

  // Build every visual into a fresh group; caller adds it to the scene and
  // drops the old one when switching tracks.
  T.buildSteps = function* () {
    const group = new THREE.Group();
    T.group = group;
    T.animated = [];
    T.constrainMotion = null;
    if (def.environment) {
      const environment = def.environment(T);
      environment.group.name = 'track-environment';
      group.add(environment.group);
      if (environment.groundAt) T.terrainAt = environment.groundAt;
      if (environment.constrainMotion) T.constrainMotion = environment.constrainMotion;
      // The environment owns its animation; don't also tick its children.
      if (environment.update) T.animated.push({ userData: { tick: environment.update } });
    } else group.add(buildGround(T, def.palette));
    yield 'Preparando la carretera…';
    group.userData.groundAt = T.terrainAt;
    if (def.island) group.add(buildIsland(T, def.island));
    group.add(buildRibbon(T, def.palette));
    kit.startLine(group, T);
    yield 'Colocando las defensas…';
    if (def.walls !== false) kit.tireWall(group, T);
    if (def.fence) kit.fenceRing(group, T, def.fence);
    if (def.chevrons !== false) kit.chevrons(group, T);
    kit.buildRamps(group, T);
    yield 'Terminando el paisaje…';
    // Shared environments are attached first; only collect track-owned ticks.
    const scenery = new THREE.Group();
    scenery.name = 'track-scenery';
    scenery.userData.groundAt = T.terrainAt;
    def.scenery?.(scenery, kit, T);
    kit.sectorSigns(scenery, T);
    scenery.traverse((o) => { if (o.userData.tick) T.animated.push(o); });
    group.add(scenery);
    T.group = group;
    return group;
  };
  // Studio and geometry tools can still build synchronously. The game yields
  // between the same steps so the loading screen can paint and accept input.
  T.build = () => {
    const steps = T.buildSteps();
    let step;
    do { step = steps.next(); } while (!step.done);
    return step.value;
  };
  return T;
}
