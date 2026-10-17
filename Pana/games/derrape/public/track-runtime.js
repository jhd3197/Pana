// Geometry/runtime shared by the race and Studio's individual map previews.
import * as THREE from 'three';
import * as kit from './track-kit.js';
import { plankHeight, isOpenEdge, OPEN_MARGIN } from './course-rules.js';
import { raceDetails } from './tracks/race-details.js';
import { roadMaterial } from './tracks/road-material.js';
import { applyNatureMaterials } from './tracks/nature-material.js';
import { raceGrass } from './tracks/grass-field.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

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
function splineMath(points, rounded = false, layered = false) {
  // Two corner-cutting passes preserve straights but leave room to drift
  // around authored street junctions instead of creating needle hairpins.
  if (rounded) for (let pass = 0; pass < 2; pass++) {
    points = points.flatMap((a,i) => {
      const b = points[(i+1)%points.length];
      return [[a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25,(a[2]||0)*.75+(b[2]||0)*.25],
        [a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75,(a[2]||0)*.25+(b[2]||0)*.75]];
    });
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  curve.arcLengthDivisions = Math.max(1200, points.length * 40);
  const TOTAL = curve.getLength();
  const N = Math.max(800, Math.round(TOTAL * 2.5));
  const pts = curve.getSpacedPoints(N);   // N+1 entries, last == first
  // Height follows the same horizontal parameter. Measuring the 3D curve's
  // length instead would shift grades, item rows and lap progress on climbs.
  const elevated = new THREE.CatmullRomCurve3(points.map(([x,z,y=0])=>new THREE.Vector3(x,y,z)),true,'centripetal');
  const heights = Array.from({length:N+1},(_,i)=>elevated.getPoint(curve.getUtoTmapping(i/N)).y);
  function heightAt(s) {
    const f=(((s%TOTAL)+TOTAL)%TOTAL)/TOTAL*N,i=Math.floor(f);
    return heights[i]+(heights[i+1]-heights[i])*(f-i);
  }

  function pointAt(s) {
    s = ((s % TOTAL) + TOTAL) % TOTAL;
    const f = (s / TOTAL) * N;
    const i = Math.floor(f) % N;
    const t = f - Math.floor(f);
    const a = pts[i], b = pts[i + 1];
    return new THREE.Vector2(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
  }

  function nearest(x, z, height) {
    // coarse scan, then refine around the best sample
    let best = 0, bestD = Infinity;
    const stride = 16;
    for (let i = 0; i < N; i += stride) {
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const dy=layered&&Number.isFinite(height)?Math.max(0,Math.abs(heights[i]-height)-8)*2:0;
      const d = dx * dx + dz * dz + dy*dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    const coarse = best;
    // Altitude selects the branch, then horizontal distance selects progress.
    // A jumping car must not slide backwards along the route toward a sample
    // whose elevation happens to be closer to its airborne height.
    const refine=layered&&Number.isFinite(height)?Math.ceil(48*N/TOTAL):stride;
    bestD=Infinity;
    for (let k = -refine; k <= refine; k++) {
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

  function paramOf(x, z, height) {
    return nearest(x, z, height).s % TOTAL;
  }

  // signed distance: positive on the (-tz, tx) side of the direction of
  // travel, matching the offset convention of placeOnTrack / items.js
  function offsetOf(x, z, height) {
    const p = nearest(x, z, height);
    return p.d * p.side;
  }

  let bx = 0, bz = 0;
  for (const p of pts) {
    bx = Math.max(bx, Math.abs(p.x));
    bz = Math.max(bz, Math.abs(p.z));
  }
  return { TOTAL, pointAt, paramOf, offsetOf, heightAt, bounds: { x: bx, z: bz } };
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
  const m = new THREE.Mesh(natureSurface(ground, 'grass'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
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
    const offsets=T.def.crossfall?[T.HW,0,-T.HW]:[T.HW,-T.HW],columns=offsets.length;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * T.TOTAL;
      const p = kit.placeOnTrack(T, s, 0);
      const tx = Math.sin(p.h), tz = Math.cos(p.h);
      // left edge (off +HW) = (-tz, tx) side, right edge = (tz, -tx)
      for(const off of offsets){const x=p.x-tz*off,z=p.z+tx*off;verts.push(x,T.def.crossfall?T.surfaceAt(x,z):p.y,z);}
      if (i < N && !T.gapAt?.(s+T.TOTAL/N/2)) {
        for(let j=0;j<columns-1;j++){const a=i*columns+j;idx.push(a,a+1,a+columns,a+1,a+columns+1,a+columns);}
      }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  if(T.def.roadStyle){
    const colors=[],surfaces=[],p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const style=T.def.roadStyle(p.getX(i),p.getZ(i)),c=new THREE.Color(style==='mud'?0x98704a:style==='stone'?0xb5a07c:pal.track);
      colors.push(c.r,c.g,c.b);surfaces.push(style==='mud'?1:style==='stone'?2:0);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setAttribute('roadSurface',new THREE.Float32BufferAttribute(surfaces,1));
  }
  const material = roadMaterial(T.def.roadStyle?0xffffff:pal.track, ['selva','llanos','desierto','bululu','delta','salto'].includes(T.id),!!T.def.roadStyle);
  const m = new THREE.Mesh(geo, material);
  m.userData.dispose = () => material.dispose();
  m.name='track-road';
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
  const geo = def.oval ? ovalMath(def.oval) : splineMath(def.points, def.rounded, def.layered);
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
    gaps: [],
    animated: [],
  };
  T.gapAt=s=>T.gaps.some(g=>(s-g.s0+T.TOTAL)%T.TOTAL<g.len);
  const authoredHeight = def.points?.some(p=>p.length>2);
  T.heightAtS = authoredHeight ? geo.heightAt : def.elevation ? (s) => {
    const p = geo.pointAt(s);
    return def.elevation(p.x, p.y);
  } : () => 0;
  T.surfaceAt = authoredHeight || def.elevation ? (x, z, height) => T.heightAtS(geo.paramOf(x, z, height)) : () => 0;
  if(def.crossfall)T.surfaceAt=(x,z)=>{const s=geo.paramOf(x,z);return T.heightAtS(s)+def.crossfall(s,geo.offsetOf(x,z),T);};
  T.terrainAt = (x, z) => terrainHeight(T, def.palette, x, z);
  // Shortcut plank roads: { from: [u, offset], to: [u, offset], w, arch }.
  const along = (u, off) => {
    const s = u * geo.TOTAL, p = geo.pointAt(s), q = geo.pointAt(s + 0.5);
    const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1;
    return { x: p.x - tz / l * off, z: p.y + tx / l * off, y: T.heightAtS(s) };
  };
  T.shortcuts = (def.shortcuts || []).map(sc => ({ ...sc, a: along(...sc.from), b: along(...sc.to), w: sc.w ?? 6 }));
  T.drops = def.drops || [];
  T.plankAt = (x, z) => {
    for (const sc of T.shortcuts) { const y = plankHeight(sc, x, z); if (y != null) return y; }
    return null;
  };
  // Past an open edge (or far off the road) the real ground takes over, so
  // a car that leaves the course falls to it.
  T.openAt = (x, z, off = geo.offsetOf(x, z)) => {
    const a = Math.abs(off);
    if (a <= T.HW + 0.4) return false;
    return a > T.HW + OPEN_MARGIN || isOpenEdge(T.drops, geo.paramOf(x, z) / geo.TOTAL, Math.sign(off));
  };
  T.groundAt = (x, z, height) => {
    const plank = T.shortcuts.length ? T.plankAt(x, z) : null;
    if (plank != null) return plank;
    const s = geo.paramOf(x,z,height);
    if(T.gapAt(s))return T.terrainAt(x,z);
    const base = T.surfaceAt(x, z, height);
    const off = geo.offsetOf(x, z, height);
    if (!def.offroad && T.openAt(x, z, off)) return Math.min(base, T.terrainAt(x, z));
    if(def.offroad&&Math.abs(off)>T.HW) {
      const blend=THREE.MathUtils.smoothstep(Math.abs(off),T.HW,T.HW+2);
      return THREE.MathUtils.lerp(base,T.terrainAt(x,z),blend);
    }
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
    for (const sc of T.shortcuts) group.add(kit.plankRoad(T, sc));
    yield 'Terminando el paisaje…';
    // Shared environments are attached first; only collect track-owned ticks.
    const scenery = new THREE.Group();
    scenery.name = 'track-scenery';
    scenery.userData.groundAt = T.terrainAt;
    def.scenery?.(scenery, kit, T);
    kit.sectorSigns(scenery, T);
    scenery.traverse((o) => { if (o.userData.tick) T.animated.push(o); });
    group.add(scenery);
    group.add(raceDetails(T));
    const grass = raceGrass(group, T); group.add(grass); if (grass.userData.tick) T.animated.push(grass);
    applyNatureMaterials(group, T.id);
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
