// Geometry/runtime shared by the race and Studio's individual map previews.
import * as THREE from 'three';
import * as kit from './track-kit.js';
import { plankHeight, isOpenEdge, OPEN_MARGIN, openWater } from './course-rules.js';
import { raceDetails } from './tracks/race-details.js';
import { roadMaterial, roadStyle, roadTile, roadTexture } from './tracks/road-material.js';
import { applyNatureMaterials } from './tracks/nature-material.js';
import { raceGrass } from './tracks/grass-field.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { backgroundForest } from './tracks/background-forest.js';
import { roadShoulders } from './tracks/road-shoulders.js';

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
// over a dense sample table so queries stay cheap. A point may carry a 4th
// element, a structure tag ([x, z, y, tag]): 'g' ground (default), 'b' bridge,
// 'l' ledge, 'a' arch, 't' tunnel. Pass `undefined` as y to tag a point whose
// height comes from `elevation`.
export const POINT_TAGS = ['g', 'b', 'l', 'a', 't'];
function splineMath(points, rounded = false, layered = false) {
  // Two corner-cutting passes preserve straights but leave room to drift
  // around authored street junctions instead of creating needle hairpins.
  // Each cut point keeps the tag of the control point it sits nearer to.
  if (rounded) for (let pass = 0; pass < 2; pass++) {
    points = points.flatMap((a,i) => {
      const b = points[(i+1)%points.length];
      return [[a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25,(a[2]||0)*.75+(b[2]||0)*.25,a[3]],
        [a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75,(a[2]||0)*.25+(b[2]||0)*.75,b[3]]];
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
  // Per-sample tags: a sample takes the tag of the control point nearest to it
  // in curve parameter, so a run of tagged points covers half a segment past
  // its first and last point.
  let tags = null;
  if (points.some(p => p[3] && p[3] !== 'g')) {
    const M = points.length;
    tags = Array.from({length:N+1},(_,i)=>{
      const t = curve.getUtoTmapping(i/N)*M, k = Math.floor(t), f = t-k;
      return points[(f<.5?k:k+1)%M][3] || 'g';
    });
  }

  function pointAt(s) {
    s = ((s % TOTAL) + TOTAL) % TOTAL;
    const f = (s / TOTAL) * N;
    const i = Math.floor(f) % N;
    const t = f - Math.floor(f);
    const a = pts[i], b = pts[i + 1];
    return new THREE.Vector2(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
  }

  // Project onto the nearest segment, rather than snapping cars to a sample.
  // Continuous progress also keeps terrain heights smooth while driving.
  function project(best, x, z) {
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

  // The original search, kept for points outside the raster and for
  // altitude-ambiguous cells of layered tracks.
  function nearestScan(x, z, height) {
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
    return project(best, x, z);
  }

  // Built on first use: browsing the track list only needs the route.
  let built = null;
  const raster = () => built ??= buildRaster(pts, N, TOTAL, heights, layered);
  const span = Math.ceil(6 * N / TOTAL);
  const apart = (a, b) => { const g = Math.abs(a - b); return Math.min(g, N - g) > span; };
  // Constant-time lookup: the four cells around the point name their nearest
  // samples; refine a few metres of route around each distinct one.
  function nearest(x, z, height) {
    const { x0, z0, cell, nx, nz, index, ambiguous } = raster();
    const fx = (x - x0) / cell - .5, fz = (z - z0) / cell - .5;
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    if (i0 < 0 || j0 < 0 || i0 + 1 >= nx || j0 + 1 >= nz) return nearestScan(x, z, height);
    const c = j0 * nx + i0;
    if (ambiguous && Number.isFinite(height) && (ambiguous[c] | ambiguous[c + 1] | ambiguous[c + nx] | ambiguous[c + nx + 1])) return nearestScan(x, z, height);
    let best = -1, bestD = Infinity, first = -1, second = -1;
    for (let q = 0; q < 4; q++) {
      const centre = index[c + (q & 1) + (q >> 1) * nx];
      if (first >= 0 && !apart(centre, first)) continue;
      if (second >= 0 && !apart(centre, second)) continue;
      if (first < 0) first = centre; else second = centre;
      for (let o = -span; o <= span; o++) {
        const i = (centre + o + N) % N, dx = pts[i].x - x, dz = pts[i].z - z, d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return project(best, x, z);
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
  // Runs of equal tags along u in [0, 1). A run crossing the start line is
  // reported once, with to > 1.
  function tagRuns() {
    if (!tags) return [{ tag: 'g', from: 0, to: 1 }];
    const runs = [];
    for (let i = 0; i < N; i++) {
      if (!runs.length || runs.at(-1).tag !== tags[i]) runs.push({ tag: tags[i], from: i / N, to: (i + 1) / N });
      else runs.at(-1).to = (i + 1) / N;
    }
    if (runs.length > 1 && runs[0].tag === runs.at(-1).tag) { const head = runs.shift(); runs.at(-1).to = 1 + head.to; }
    return runs;
  }
  const tagAt = s => tags ? tags[Math.round((((s % TOTAL) + TOTAL) % TOTAL) / TOTAL * N)] : 'g';

  return { TOTAL, pointAt, paramOf, offsetOf, heightAt, nearest, nearestScan, raster, tagAt, tagRuns, bounds: { x: bx, z: bz } };
}

// ---------- distance raster ----------
// A coarse grid over the route (plus a margin) storing, per cell, the nearest
// centreline sample and its distance from the cell centre. Seeds are the
// samples themselves; two raster sweeps propagate nearest-sample indices
// (a vector distance transform), so the build is linear in the cell count.
// Layered tracks also flag cells where another branch at a different height
// is close enough for the car's altitude to change which branch it is on.
const RASTER_MARGIN = 96, RASTER_MAX_CELLS = 1.2e6, AMBIGUOUS_RADIUS = 40;
function buildRaster(pts, N, TOTAL, heights, layered) {
  const started = performance.now();
  const px = new Float32Array(N), pz = new Float32Array(N);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < N; i++) {
    px[i] = pts[i].x; pz[i] = pts[i].z;
    minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]);
  }
  minX -= RASTER_MARGIN; minZ -= RASTER_MARGIN; maxX += RASTER_MARGIN; maxZ += RASTER_MARGIN;
  const cell = Math.max(2, Math.sqrt((maxX - minX) * (maxZ - minZ) / RASTER_MAX_CELLS));
  const nx = Math.ceil((maxX - minX) / cell), nz = Math.ceil((maxZ - minZ) / cell), count = nx * nz;
  const index = new Int32Array(count).fill(-1), dist = new Float32Array(count).fill(Infinity);
  const cx = new Float32Array(nx), cz = new Float32Array(nz);
  for (let i = 0; i < nx; i++) cx[i] = minX + (i + .5) * cell;
  for (let j = 0; j < nz; j++) cz[j] = minZ + (j + .5) * cell;
  const offer = (c, i, j, k) => {
    if (k < 0) return;
    const dx = px[k] - cx[i], dz = pz[k] - cz[j], d = dx * dx + dz * dz;
    if (d < dist[c]) { dist[c] = d; index[c] = k; }
  };
  for (let k = 0; k < N; k++) {
    const i = Math.floor((px[k] - minX) / cell), j = Math.floor((pz[k] - minZ) / cell);
    offer(j * nx + i, i, j, k);
  }
  // One forward and one backward sweep; nearest() refines around the
  // result, so the transform's rare one-cell errors never reach callers.
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (i > 0) offer(c, i, j, index[c - 1]);
      if (j > 0) { offer(c, i, j, index[c - nx]); if (i > 0) offer(c, i, j, index[c - nx - 1]); if (i < nx - 1) offer(c, i, j, index[c - nx + 1]); }
    }
    for (let i = nx - 2; i >= 0; i--) offer(j * nx + i, i, j, index[j * nx + i + 1]);
  }
  for (let j = nz - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const c = j * nx + i;
      if (i < nx - 1) offer(c, i, j, index[c + 1]);
      if (j < nz - 1) { offer(c, i, j, index[c + nx]); if (i > 0) offer(c, i, j, index[c + nx - 1]); if (i < nx - 1) offer(c, i, j, index[c + nx + 1]); }
    }
    for (let i = 1; i < nx; i++) offer(j * nx + i, i, j, index[j * nx + i - 1]);
  }
  for (let c = 0; c < count; c++) dist[c] = Math.sqrt(dist[c]);
  let ambiguous = null;
  if (layered) {
    // Splat samples into nearby cells; a cell is ambiguous when a sample far
    // along the route, at a different height, lies within reach of it.
    ambiguous = new Uint8Array(count);
    const reach = Math.ceil(AMBIGUOUS_RADIUS / cell), apart = Math.ceil(60 * N / TOTAL), step = Math.max(1, Math.floor(N / TOTAL * 1.5));
    for (let k = 0; k < N; k += step) {
      const ci = Math.floor((px[k] - minX) / cell), cj = Math.floor((pz[k] - minZ) / cell);
      for (let j = Math.max(0, cj - reach); j <= Math.min(nz - 1, cj + reach); j++) for (let i = Math.max(0, ci - reach); i <= Math.min(nx - 1, ci + reach); i++) {
        const c = j * nx + i;
        if (ambiguous[c]) continue;
        const near = index[c], gap = Math.abs(near - k);
        if (Math.min(gap, N - gap) < apart || Math.abs(heights[near] - heights[k]) < 2) continue;
        const dx = px[k] - cx[i], dz = pz[k] - cz[j];
        if (dx * dx + dz * dz <= AMBIGUOUS_RADIUS * AMBIGUOUS_RADIUS) ambiguous[c] = 1;
      }
    }
  }
  const locate = (x, z) => {
    const fx = (x - minX) / cell - .5, fz = (z - minZ) / cell - .5, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i + 1 >= nx || j + 1 >= nz) return null;
    return { c: j * nx + i, tx: fx - i, tz: fz - j };
  };
  return {
    x0: minX, z0: minZ, cell, nx, nz, index, distance: dist, ambiguous,
    buildMs: performance.now() - started,
    // Approximate centreline distance, bilinear between cell centres (within
    // about half a cell near the road); null outside the grid.
    distanceAt(x, z) {
      const q = locate(x, z); if (!q) return null;
      const { c, tx, tz } = q;
      return (dist[c] * (1 - tx) + dist[c + 1] * tx) * (1 - tz) + (dist[c + nx] * (1 - tx) + dist[c + nx + 1] * tx) * tz;
    },
    // Route distance s of the sample nearest the cell holding (x, z); null
    // outside the grid.
    sampleAt(x, z) {
      const q = locate(x, z); if (!q) return null;
      return index[q.c + (q.tx > .5 ? 1 : 0) + (q.tz > .5 ? nx : 0)] / N * TOTAL;
    },
  };
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
  // Route-space coordinates keep wheel wear following bends and climbs. The
  // strip's own distance runs on past the lap seam, so paint never smears there.
  const roadCoords = [], uvs = [], position = geo.attributes.position, style = roadStyle(T), tile = roadTile(style);
  const columns = T.def.crossfall ? 3 : 2, strip = !(T.def.oval && !T.def.elevation);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), across = T.offsetOf(x, z) / T.HW;
    const along = strip ? Math.floor(i / columns) / (position.count / columns - 1) * T.TOTAL : T.paramOf(x, z);
    roadCoords.push(across, T.paramOf(x, z));
    uvs.push(strip ? i % columns / (columns - 1) : (1 - across) / 2, along / tile);
  }
  geo.setAttribute('roadCoords', new THREE.Float32BufferAttribute(roadCoords, 2));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const map = roadTexture(style, T.TOTAL | 0);
  const material = roadMaterial(0xffffff, ['selva','llanos','desierto','bululu','delta','salto'].includes(T.id),!!T.def.roadStyle, map);
  const m = new THREE.Mesh(geo, material);
  m.userData.dispose = () => { material.dispose(); map.dispose(); };
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
  // Spline tracks also expose the distance raster and structure tags. The
  // oval keeps its analytic distance and has neither.
  T.nearest = geo.nearest ?? ((x, z) => { const o = geo.offsetOf(x, z); return { s: geo.paramOf(x, z), d: Math.abs(o), side: Math.sign(o) || 1 }; });
  T.nearestScan = geo.nearestScan ?? T.nearest;
  Object.defineProperty(T, 'raster', { get: () => geo.raster?.() ?? null, enumerable: true });
  // Approximate centreline distance for scenery exclusion and off-course
  // checks; exact (and slower) outside the raster.
  T.roadDistance = (x, z) => T.raster?.distanceAt(x, z) ?? Math.abs(geo.offsetOf(x, z));
  T.clearOfRoad = (x, z, margin = 0) => T.roadDistance(x, z) > T.HW + margin;
  T.tagAt = geo.tagAt ?? (() => 'g');
  T.tagRuns = geo.tagRuns ?? (() => [{ tag: 'g', from: 0, to: 1 }]);
  // A tag-only point ([x, z, undefined, 'b']) must not switch an elevation
  // track to authored heights.
  const authoredHeight = def.points?.some(p=>typeof p[2]==='number');
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
  // Open-water gates (course-rules.js): boats float on the lagoon, not the road.
  T.openWater = openWater(T);
  T.groundAt = (x, z, height) => {
    const afloat = T.openWater?.surfaceAt(x, z, height);
    if (afloat != null) return afloat;
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
      if (along <= r.len && Math.abs(off) < r.hw) return base + r.h * (r.profile ? r.profile(along / r.len) : along / r.len);
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
    T.waterObstacles = [];   // () => [{ x, z, r, h, v, vx, vz }]: boats on open water
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
    if (!def.authoredRoad) group.add(roadShoulders(T), buildRibbon(T, def.palette));
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
    group.add(backgroundForest(T));
    if (!def.authoredRoad) group.add(raceDetails(T));
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
