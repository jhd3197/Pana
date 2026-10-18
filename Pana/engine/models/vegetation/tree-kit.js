import * as THREE from 'three';
import { rng, clamp, lerp } from '/engine/random.js';
import { bake } from '/engine/models/core/static-batch.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { windUniforms } from '/engine/models/vegetation/plant-kit.js';

// The tree kit behind the Venezuelan trees (samán, mango, araguaney, ceiba,
// cocotero, the selva giants...). A species is data: a branching skeleton,
// bark colours, a foliage recipe and optional fruit/extra builders. Every
// tree bakes to two or three draws (bark, leaves, fruit) with vertex colours.
//
// Detail tiers, from the prototype's Completo/Ligero plus two map tiers:
// - 'full': Studio and close-ups;
// - 'lite': one twig level less, thinner clumps and trunks (about a third);
// - 'low': what factories build when called without a detail ('game' too):
//   sparse blades and coarser tubes, near the old low-poly budgets;
// - 'far' (callers' 'low' and 'distant'): long roadside rows and distant
//   forests. One branch level less, bigger sparse clumps, no fruit.
// Every tree reports userData.height and crownRadius.

export const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

// Wind bends the whole tree by height (phase from its world origin, so a grove
// doesn't sway in lockstep) and the leaves flutter along their normals.
// Driven by plant-kit's tickWind, like every other plant.
function windMaterial(material, bend, flutter = 0) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uWindTime = windUniforms.time;
    shader.uniforms.uWindStrength = windUniforms.strength;
    shader.vertexShader = `uniform float uWindTime;\nuniform float uWindStrength;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 treeOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
      vec3 treeOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #endif
      float treeH = max(transformed.y, 0.0);
      float treePhase = uWindTime * 1.15 + treeOrigin.x * 0.21 + treeOrigin.z * 0.17;
      float treeBend = treeH * treeH * ${bend.toFixed(5)} * uWindStrength;
      transformed.x += (sin(treePhase) + 0.35 * sin(treePhase * 2.3 + 1.7)) * treeBend;
      transformed.z += cos(treePhase * 0.8 + 0.6) * treeBend * 0.6;
      ${flutter ? `transformed += normal * sin(uWindTime * 6.5 + position.x * 3.1 + position.z * 2.7 + position.y * 1.9) * ${flutter.toFixed(4)} * uWindStrength * min(treeH * 0.3, 1.0);` : ''}`);
  };
  material.customProgramCacheKey = () => `pana-tree-${bend}-${flutter}`;
  return material;
}
export const barkMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 }), 0.0018);
const leafMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x0c1806 }), 0.0018, 0.035);
const fruitMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55 }), 0.0018);

// Vertex colours from fn(color, x, y, z, index).
export function paint(geo, fn) {
  const p = geo.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), i); colors.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
export function addMesh(group, geo, material, surface) {
  const m = new THREE.Mesh(surface ? natureSurface(geo, surface) : geo, material);
  m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
// Turn a geometry built along +x to point along dir, then move it to pos.
const aimTmp = new THREE.Vector3();
export function aim(geo, dir, pos) {
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), aimTmp.copy(dir).normalize()));
  geo.translate(pos.x, pos.y, pos.z);
  return geo;
}
// Put a geometry built along +x into the basis (dir, up) at pos.
export function orient(geo, dir, up, pos) {
  const x = dir.clone().normalize(), z = new THREE.Vector3().crossVectors(x, up).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z)); geo.translate(pos.x, pos.y, pos.z);
  return geo;
}

// Grow a branching skeleton: a list of branches ({pts, rads, depth}) and the
// tips where leaves go. `spec` sets trunk size, children per level, angles,
// length/radius ratios, upturn and an optional crown envelope (> 1 = outside).
export function growSkeleton(r, spec) {
  const branches = [], tips = [];
  const grow = (start, direction, length, radius, depth, parent) => {
    const step = Math.max(0.12, length / ((depth === 0 ? spec.trunkSegments || 10 : spec.segments?.[depth] || 6) * (spec.segScale ?? 1)));
    const count = Math.max(2, Math.round(length / step)), pts = [start.clone()], rads = [radius];
    const tipRadius = radius * (depth === 0 ? spec.trunkTaper ?? 0.5 : spec.taper ?? 0.32);
    const dir = direction.clone(), wobble = depth === 0 ? spec.trunkWobble ?? 0.06 : spec.wobble ?? 0.25;
    let at = start.clone();
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      dir.x += (r() - 0.5) * wobble; dir.z += (r() - 0.5) * wobble; dir.y += (r() - 0.5) * wobble * 0.4;
      dir.y += depth === 0 ? spec.trunkUp ?? 0.02 : spec.upturn?.[depth] ?? 0.04;
      dir.normalize();
      if (spec.minY != null && depth > 0 && dir.y < spec.minY) { dir.y = spec.minY; dir.normalize(); }
      if (spec.maxY != null && depth > 0 && dir.y > spec.maxY) { dir.y = spec.maxY; dir.normalize(); }
      at = at.clone().addScaledVector(dir, length / count);
      pts.push(at); rads.push(lerp(radius, tipRadius, Math.pow(t, spec.taperCurve ?? 1)));
      if (spec.envelope && depth > 0 && i > 1 && spec.envelope(at) > 1) break;
    }
    const branch = { pts, rads, depth, parent };
    branches.push(branch);
    const kids = depth < spec.depth ? spec.kids[depth] : 0;
    if (!kids) { tips.push({ p: pts[pts.length - 1].clone(), dir: dir.clone(), depth, branch }); return branch; }
    const from = depth === 0 ? spec.clear : spec.spawnFrom?.[depth] ?? 0.3;
    let around = r() * TAU;
    for (let k = 0; k < kids; k++) {
      const t = from + (1 - from) * clamp((k + 0.5 + (r() - 0.5) * 0.7) / kids, 0, 1);
      const idx = Math.max(1, Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))), base = pts[idx];
      const along = new THREE.Vector3().subVectors(pts[Math.min(pts.length - 1, idx + 1)], pts[idx - 1]).normalize();
      around += 2.39996 + (r() - 0.5) * 0.6;   // golden angle, so children spiral
      const side = new THREE.Vector3(Math.cos(around), 0, Math.sin(around));
      side.addScaledVector(along, -side.dot(along));
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      const angle = (spec.angle?.[depth] ?? 0.8) + (r() - 0.5) * (spec.angleJitter ?? 0.35);
      const childDir = along.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle)).normalize();
      const lenScale = spec.lenAt ? spec.lenAt(t, depth, r) : 1;
      const childLen = length * (spec.lenRatio?.[depth] ?? 0.6) * lenScale * (0.82 + r() * 0.36);
      if (childLen < 0.08) continue;
      const childRad = Math.min(rads[idx] * 0.82, radius * (spec.radRatio?.[depth] ?? 0.55) * Math.sqrt(Math.max(0.2, lenScale)));
      grow(base.clone(), childDir, childLen, childRad, depth + 1, branch);
    }
    return branch;
  };
  const lean = spec.lean ?? 0.15, up = new THREE.Vector3((r() - 0.5) * lean, 1, (r() - 0.5) * lean).normalize();
  // lift the foot by a quarter radius so a leaning trunk's base ring stays above ground
  grow(new THREE.Vector3(0, Math.max(0.02, spec.trunkR * 0.25), 0), up, spec.trunk, spec.trunkR, 0, null);
  return { branches, tips };
}

// A tube along pts with per-point radii and parallel-transported frames.
// colorAt(color, t, angle, point); shapeAt(t, angle) scales the radius
// (buttresses, flutes). The tip is capped.
export function tube(pts, rads, sides, colorAt, shapeAt) {
  const n = pts.length, pos = [], idx = [], col = [];
  const tangent = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  const normal = new THREE.Vector3().crossVectors(Math.abs(tangent.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0), tangent).normalize();
  const binormal = new THREE.Vector3(), next = new THREE.Vector3(), axis = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    next.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    axis.crossVectors(tangent, next);
    const s = axis.length();
    if (s > 1e-6) normal.applyAxisAngle(axis.divideScalar(s), Math.asin(clamp(s, -1, 1)));
    tangent.copy(next);
    binormal.crossVectors(tangent, normal).normalize();
    normal.crossVectors(binormal, tangent).normalize();
    const t = i / (n - 1);
    for (let k = 0; k < sides; k++) {
      const a = k / sides * TAU, rad = rads[i] * (shapeAt ? shapeAt(t, a) : 1);
      pos.push(pts[i].x + (normal.x * Math.cos(a) + binormal.x * Math.sin(a)) * rad,
        pts[i].y + (normal.y * Math.cos(a) + binormal.y * Math.sin(a)) * rad,
        pts[i].z + (normal.z * Math.cos(a) + binormal.z * Math.sin(a)) * rad);
      colorAt(c, t, a, pts[i]); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = a + sides, d = i * sides + (k + 1) % sides, e = d + sides;
    idx.push(a, d, b, d, e, b);
  }
  const cap = pos.length / 3, end = pts[n - 1];
  pos.push(end.x, end.y, end.z); col.push(c.r, c.g, c.b);
  for (let k = 0; k < sides; k++) idx.push((n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides, cap);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// Bark tubes for every branch: ridged colour, lighter higher up, an optional
// moss band at the foot of the trunk.
export function barkTubes(group, branches, bark) {
  const base = new THREE.Color(bark.bark), dark = base.clone().multiplyScalar(bark.barkDark ?? 0.62);
  const light = new THREE.Color(bark.barkLight ?? bark.bark), moss = new THREE.Color(0x5c7d36), minRadius = bark.minRadius ?? 0.012;
  for (const b of branches) {
    if (b.rads[0] < minRadius) continue;
    const sides = b.depth === 0 ? bark.trunkSides ?? 12 : bark.far ? 3 : bark.low ? (b.rads[0] > 0.12 ? 6 : b.rads[0] > 0.05 ? 4 : 3) : b.rads[0] > 0.12 ? 8 : b.rads[0] > 0.05 ? 6 : 4;
    const colorAt = (c, t, a, p) => {
      const ridge = 0.5 + 0.5 * Math.sin(a * (bark.ridges ?? 7) + p.y * (bark.ridgeTwist ?? 1.3));
      c.copy(dark).lerp(base, clamp(0.45 + 0.4 * ridge + (b.depth === 0 ? t * 0.2 : 0.25)));
      c.lerp(light, clamp(p.y / (bark.height || 10)) * 0.45);
      if (bark.mossBand && b.depth === 0 && p.y < bark.mossBand) c.lerp(moss, (1 - p.y / bark.mossBand) * 0.5 * (0.5 + 0.5 * Math.sin(a * 3)));
    };
    addMesh(group, tube(b.pts, b.rads, sides, colorAt, b.depth === 0 ? bark.trunkShape : null), barkMat, 'bark');
  }
}

// A curved leaf blade along +x: a spine with two drooping edges.
export function blade(length, width, bend, segments = 3) {
  const pos = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, w = Math.pow(Math.sin(Math.PI * Math.min(t, 0.999)), 0.7) * width;
    const y = Math.sin(Math.PI * t) * bend * 0.4 - t * t * bend;
    pos.push(t * length, y - w * 0.18, -w, t * length, y, 0, t * length, y - w * 0.18, w);
    if (i < segments) { const k = i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// A leaf clump: a lumpy core with blades sprouting out on a Fibonacci sphere.
// Normals point outward from the clump, so it shades like one soft cushion.
function leafClump(parts, r, at, size, o) {
  const tint = new THREE.Color(o.tints[(r() * o.tints.length) | 0]).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.06);
  const shade = tint.clone().multiplyScalar(o.shadeMul ?? 0.6), ao = o.ao ?? 1;
  if (o.core !== false) {
    const core = new THREE.IcosahedronGeometry(1, o.facet || (o.lite && !o.low) ? 0 : 1), p = core.attributes.position, phase = r() * 40;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), coreSize = o.coreSize ?? 0.5;
      const lump = 1 + 0.16 * Math.sin(x * 4.3 + phase) * Math.sin(z * 3.7 - phase) + 0.08 * Math.cos(y * 5 + phase);
      p.setXYZ(i, x * lump * size * coreSize, y * lump * size * (o.flat ?? 0.62) * coreSize / 0.78, z * lump * size * coreSize);
    }
    paint(core, (c, x, y) => c.copy(shade).lerp(tint, clamp(0.5 + y / size * 0.9) * ao));
    const nrm = core.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i) * 1.4, p.getZ(i)).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
    core.translate(at.x, at.y, at.z); parts.leaves.push(core);
  }
  const count = Math.round((o.blades ?? 14) * (o.far ? 0.1 : o.low ? 0.22 : o.lite ? 0.45 : 1));
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + 0.5) / count, ring = Math.sqrt(1 - y * y), a = i * 2.39996 + r();
    const dir = new THREE.Vector3(Math.cos(a) * ring, y * (o.flat ?? 0.62) + (o.lift ?? 0.15), Math.sin(a) * ring).normalize();
    if (dir.y < -0.55) continue;
    const len = size * (o.bladeLen ?? 0.62) * (0.8 + r() * 0.4), geo = blade(len, len * (o.bladeWidth ?? 0.24), len * (o.bladeBend ?? 0.35));
    const leafTint = tint.clone().offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.4) * 0.12);
    paint(geo, (c, x) => c.copy(shade).lerp(leafTint, clamp((0.55 + 0.45 * x / len) * ao + dir.y * 0.15)));
    geo.rotateX(r() * TAU);
    parts.leaves.push(aim(geo, dir, at.clone().addScaledVector(dir, size * (o.reach ?? 0.62))));
  }
}

// A blossom clump: a petal-coloured clump plus trumpet flowers.
function flowerClump(parts, r, at, size, o) {
  leafClump(parts, r, at, size, { ...o, tints: o.flowers, shadeMul: 0.8, coreSize: o.far ? 0.62 : o.low ? 0.48 : 0.36, blades: o.petalBlades ?? 10, bladeWidth: 0.3, bladeLen: 0.36, bladeBend: 0.12, reach: 0.5 });
  const blooms = Math.round((o.blooms ?? 9) * (o.far ? 0 : o.low ? 0.3 : o.lite ? 0.4 : 1));
  for (let i = 0; i < blooms; i++) {
    const dir = new THREE.Vector3(r() - 0.5, r() * 0.9 + 0.1, r() - 0.5).normalize();
    const p = at.clone().addScaledVector(dir, size * (0.45 + r() * 0.4)), geo = new THREE.ConeGeometry(size * 0.11, size * 0.2, 5, 1, true);
    geo.rotateZ(Math.PI / 2);
    const petal = new THREE.Color(o.flowers[i % o.flowers.length]).offsetHSL(0, 0, 0.08), throat = new THREE.Color(o.throat ?? o.flowers[0]).multiplyScalar(0.7);
    paint(geo, (c, x) => c.copy(throat).lerp(petal, clamp(0.5 - x / (size * 0.24))));
    parts.leaves.push(aim(geo, dir.clone().negate(), p));
  }
}

// A pine needle tuft: a star of thin blades around dir.
export function needleTuft(parts, r, at, dir, length, o) {
  const tint = new THREE.Color(o.tints[(r() * o.tints.length) | 0]), shade = tint.clone().multiplyScalar(0.5), count = o.low ? 4 : o.lite ? 7 : 14;
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU, axis = dir.clone().normalize(), side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    side.addScaledVector(axis, -side.dot(axis)).normalize();
    const d = axis.clone().multiplyScalar(0.35).add(side.multiplyScalar(0.9)).normalize();
    d.y -= 0.15;
    const geo = blade(length, length * 0.07, length * 0.12, 2);
    paint(geo, (c, x) => c.copy(shade).lerp(tint, clamp(0.3 + x / length)));
    parts.leaves.push(aim(geo, d, at));
  }
}

// Leaf (or flower) clumps on every tip and, with `along`, every few points
// of the outer branches. Clumps on the outside and top of the crown are
// lighter, inner ones darker (cheap ambient occlusion).
export function dressCrown(parts, r, skeleton, o) {
  const spots = skeleton.tips.map(t => ({ p: t.p, d: t.dir, w: 1 }));
  if (o.along && !o.low) for (const b of skeleton.branches) if (b.depth >= o.alongFrom)
    for (let i = 2; i < b.pts.length - 1; i += o.along) spots.push({ p: b.pts[i], d: new THREE.Vector3().subVectors(b.pts[i], b.pts[i - 1]).normalize(), w: 0.75 });
  const center = spots.reduce((s, x) => s.add(x.p), new THREE.Vector3()).divideScalar(Math.max(1, spots.length));
  const radius = Math.max(1, ...spots.map(s => s.p.distanceTo(center)));
  for (const s of spots) {
    if (o.keep && r() > o.keep) continue;
    const ao = 0.55 + 0.45 * clamp(s.p.distanceTo(center) / radius) + clamp((s.p.y - center.y) / radius) * 0.25;
    const at = s.p.clone().addScaledVector(s.d, (o.offset ?? 0.25) * o.size), size = o.size * s.w * (0.75 + r() * 0.5);
    (o.kind === 'flower' ? flowerClump : leafClump)(parts, r, at, size, { ...o, ao });
  }
  return { center, radius };
}

export const newParts = () => ({ leaves: [], fruit: [] });

// Concatenate non-indexed coloured geometries into one.
function concat(list) {
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), nrm = new Float32Array(count * 3);
  let at = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, at * 3); col.set(g.attributes.color.array, at * 3); nrm.set(g.attributes.normal.array, at * 3);
    at += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}
const flat = list => list.map(g => { if (!g.index) return g; const out = g.toNonIndexed(); g.dispose(); return out; });

// Bake bark, leaves and fruit into a few draws and release the parts.
export function finishTree(group, parts, name, userData = {}) {
  if (parts.leaves.length) addMesh(group, concat(flat(parts.leaves)), leafMat, 'foliage');
  if (parts.fruit.length) addMesh(group, concat(flat(parts.fruit)), fruitMat);
  const out = bake(group);
  out.name = name;
  group.traverse(o => o.geometry?.dispose());
  parts.leaves.forEach(g => g.dispose()); parts.fruit.forEach(g => g.dispose());
  out.userData = { height: new THREE.Box3().setFromObject(out).max.y, ...userData };
  return out;
}

// Ellipsoid crown envelope (a flatter top or a deeper skirt with yDown).
export const ellipsoid = (cx, cy, cz, rx, yUp, rz, yDown = yUp) => p => {
  const dy = p.y - cy, ry = dy > 0 ? yUp : Math.max(yUp, yDown);
  return ((p.x - cx) / rx) ** 2 + (dy / ry) ** 2 + ((p.z - cz) / rz) ** 2;
};

// Plank buttresses around the foot of a trunk, as a trunkShape.
export const buttress = ({ height = 0.15, count = 5, amp = 3.5, sharp = 10, phase = 0.4 } = {}) => (t, a) =>
  1 + Math.max(0, 1 - t / height) ** 2 * (0.3 + amp * Math.max(0, Math.cos(a * count + phase)) ** sharp);

// Grow a species from its data (see the species files).
export function growTree(species, { seed = 1, detail = 'full', leaves = true, flowers = true, fruit = true, scale = 1 } = {}) {
  const r = rng(seed), lite = detail !== 'full', far = detail === 'far', low = far || detail === 'low', s = scale, spec = species.skeleton(s, r);
  if (lite) spec.kids = spec.kids.map((k, i) => i === spec.kids.length - 1 ? Math.max(2, k - 1) : k);
  // flowering trees keep their twigs: far away, the bloom is the whole tree
  if (far && !(flowers && species.blossom)) spec.depth = Math.max(1, spec.depth - 1);
  if (low) spec.segScale = far ? 0.35 : 0.6;
  const skeleton = growSkeleton(r, spec), group = new THREE.Group(), parts = newParts();
  barkTubes(group, skeleton.branches, { height: species.height * s, trunkSides: far ? 6 : low ? 7 : lite ? 10 : 16, trunkShape: spec.trunkShape, ...species.bark, low, far, ...(low ? { minRadius: (far ? 0.04 : 0.02) * s } : {}) });
  let crown = { center: new THREE.Vector3(0, species.height * s * 0.7, 0), radius: 2 * s };
  if (leaves) {
    const blossom = flowers && species.blossom;
    // distant green crowns may be faceted; a bloom stays round (it is the tree)
    const o = { lite, low, far, facet: far && !blossom, ...species.foliage, ...(blossom ? species.blossom : {}) };
    o.size = (blossom ? species.blossom.size ?? species.foliage.size : species.foliage.size) * s * (far ? 2 : low ? 1.7 : 1);
    crown = dressCrown(parts, r, skeleton, o);
    if (blossom && species.blossom.mixLeaves && !far) dressCrown(parts, r, skeleton, { ...species.foliage, lite, low, size: species.foliage.size * s * 0.8, keep: species.blossom.mixLeaves, along: 0 });
  }
  if (fruit && species.fruit && !far) species.fruit(parts, r, skeleton, s, lite);
  if (species.extra) species.extra(group, parts, r, skeleton, s, { lite, low, far, leaves, flowers });
  return finishTree(group, parts, species.name, { crownRadius: crown.radius, petals: flowers && leaves ? species.petals ?? null : null });
}

// Fruit hanging under tips on short stalks (mango, figs).
export function hangingFruit(parts, r, skeleton, { count, size, colors, stalk = 0.25, stretch = 1.3 }) {
  const tips = skeleton.tips.slice().sort(() => r() - 0.5).slice(0, count);
  for (const tip of tips) {
    const at = tip.p.clone().add(new THREE.Vector3((r() - 0.5) * 0.6, -0.35 - r() * 0.3, (r() - 0.5) * 0.6));
    const stem = new THREE.CylinderGeometry(0.008, 0.012, stalk, 4);
    stem.translate(at.x, at.y + stalk / 2 + size, at.z); paint(stem, c => c.set(0x4d6b2a)); parts.fruit.push(stem);
    const ball = new THREE.SphereGeometry(size, 10, 8); ball.scale(0.9, stretch, 0.82);
    const [a, b, d] = colors.map(x => new THREE.Color(x)), blush = r();
    paint(ball, (c, x, y) => { const t = clamp(0.5 + y / (size * stretch * 2) + x * blush); c.copy(a).lerp(b, t); if (t > 0.7) c.lerp(d, (t - 0.7) * 2.5); });
    ball.translate(at.x, at.y, at.z); parts.fruit.push(ball);
  }
}

// Small round figs in threes under some tips.
export function figs(parts, r, skeleton, s, { chance = 0.35, color = 0xd0592a } = {}) {
  const tint = new THREE.Color(color);
  for (const tip of skeleton.tips) if (r() < chance) for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(0.055 * s, 6, 5);
    paint(geo, (c, x, y) => c.copy(tint).multiplyScalar(0.75 + y * 4 / s));
    geo.translate(tip.p.x + (r() - 0.5) * 0.4, tip.p.y - 0.1 - r() * 0.2, tip.p.z + (r() - 0.5) * 0.4);
    parts.fruit.push(geo);
  }
}

// Random points along branches of one depth, for epiphytes and lianas.
export function branchPoints(skeleton, r, count, depth = 1) {
  const out = [];
  for (const b of skeleton.branches) if (b.depth === depth) for (let i = 2; i < b.pts.length - 1; i++) out.push({ p: b.pts[i], rad: b.rads[i], branch: b });
  return out.sort(() => r() - 0.5).slice(0, count);
}

// ---- palms ----

// A ringed palm stem from `at`, leaning and bending toward az. Returns its
// top, the direction at the top and the points.
export function palmTrunk(group, r, { height, base, top, lean, bend, rings, bark, barkLight, scar = 0.3, sides = 10, flare = 0.5, at = null, az = null }) {
  const turn = az ?? r() * TAU, from = at || new THREE.Vector3(), cx = Math.cos(turn), sz = Math.sin(turn), n = 22, pts = [], rads = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, off = lean * height * t + bend * height * t * t;
    pts.push(new THREE.Vector3(from.x + cx * off + (r() - 0.5) * 0.02, from.y + 0.02 + height * t, from.z + sz * off + (r() - 0.5) * 0.02));
    rads.push(lerp(base, top, Math.pow(t, 0.7)));
  }
  const dark = new THREE.Color(bark), light = new THREE.Color(barkLight);
  const geo = tube(pts, rads, sides, (c, t, a, p) => {
    const ring = Math.pow(0.5 + 0.5 * Math.cos(p.y * rings * TAU), 6);
    c.copy(dark).lerp(light, 0.35 + 0.35 * t + 0.15 * Math.sin(a * 3 + p.y)).multiplyScalar(1 - ring * scar);
  }, (t, a) => 1 + Math.pow(1 - t, 14) * flare * (0.7 + 0.3 * Math.cos(a * 6)) + 0.04 * Math.pow(0.5 + 0.5 * Math.cos(t * height * rings * TAU), 4));
  addMesh(group, geo, barkMat, 'bark');
  const end = pts[n];
  return { top: end.clone(), dir: end.clone().sub(pts[n - 1]).normalize(), radius: top, pts };
}

// A feather frond: an arching rachis with paired leaflets (coconut, manaca).
export function pinnateFrond(parts, r, at, angle, { length, rise, droop, leaflets, leafLen, color, dry = 0, lite, low, leafWidth = 0.07, drop = 0.35 }) {
  const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), side = new THREE.Vector3(-out.z, 0, out.x), steps = low ? 5 : lite ? 8 : 14, pts = [], rads = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = at.clone().addScaledVector(out, length * t * 0.92);
    p.y += length * (rise * t - droop * t * t); pts.push(p); rads.push(lerp(0.045, 0.008, t) * (length / 4));
  }
  const tint = new THREE.Color(color).lerp(new THREE.Color(0x9a7b45), dry);
  parts.leaves.push(tube(pts, rads, 4, (c, t) => c.copy(tint).lerp(new THREE.Color(0xc9b77a), 0.35 + t * 0.2)));
  const count = Math.round(leaflets * (low ? 0.22 : lite ? 0.5 : 1));
  for (let i = 0; i < count; i++) {
    const t = 0.08 + 0.9 * (i / count), k = Math.min(steps - 1, Math.floor(t * steps)), f = t * steps - k;
    const p = pts[k].clone().lerp(pts[k + 1], f), along = pts[k + 1].clone().sub(pts[k]).normalize();
    const len = leafLen * Math.sin(Math.PI * clamp(t * 0.95 + 0.05)) ** 0.6 * (0.85 + r() * 0.3);
    for (const sgn of [-1, 1]) {
      const dir = side.clone().multiplyScalar(sgn * 0.85).addScaledVector(along, 0.55).add(new THREE.Vector3(0, -drop - dry * 0.6 + (r() - 0.5) * 0.2, 0)).normalize();
      const geo = blade(len, len * leafWidth, len * 0.22, 3), leaf = tint.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08), shade = leaf.clone().multiplyScalar(0.55);
      paint(geo, (c, x) => c.copy(shade).lerp(leaf, clamp(0.4 + x / len * 0.8)));
      parts.leaves.push(aim(geo, dir, p));
    }
  }
}

// A pleated fan leaf on a petiole (moriche).
export function fanFrond(parts, r, at, dir, { petiole, radius, segments, color, dry = 0, lite, low, hang = 0 }) {
  const tint = new THREE.Color(color).lerp(new THREE.Color(0x8a6a3c), dry), shade = tint.clone().multiplyScalar(0.55), end = at.clone().addScaledVector(dir, petiole);
  parts.leaves.push(tube([at, at.clone().lerp(end, 0.5).add(new THREE.Vector3(0, petiole * 0.05, 0)), end], [0.05, 0.035, 0.025], 4, c => c.copy(tint).lerp(new THREE.Color(0xb5a46a), 0.5)));
  const flatDir = new THREE.Vector3(dir.x, 0, dir.z).normalize(), side = new THREE.Vector3(-flatDir.z, 0, flatDir.x), count = Math.round(segments * (low ? 0.35 : lite ? 0.5 : 1));
  for (let i = 0; i < count; i++) {
    const a = (i / (count - 1) - 0.5) * 2.4, d = flatDir.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    d.y = dir.y * 0.6 + 0.25 - Math.abs(a) * 0.18 - hang; d.normalize();
    const len = radius * (0.85 + r() * 0.25), geo = blade(len, len * 0.075, len * (0.25 + hang * 0.6), 3);
    geo.rotateX(i % 2 ? 0.5 : -0.5);   // alternate pleats
    const leaf = tint.clone().offsetHSL(0, 0, (r() - 0.5) * 0.08);
    paint(geo, (c, x) => c.copy(shade).lerp(leaf, clamp(0.35 + x / len)));
    parts.leaves.push(aim(geo, d, end));
  }
}

// ---- selva epiphytes and lianas ----

// A liana slung between two points, sagging in the middle.
export function liana(group, r, a, b, { sag = 1, radius = 0.035, color = 0x5d4e3a, n = 16, wiggle = 0.06, swing = 0 } = {}) {
  const pts = [], rads = [], side = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize(), tint = new THREE.Color(color);
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    p.addScaledVector(side, Math.sin(t * 9 + r()) * wiggle + Math.sin(t * Math.PI) * swing);
    pts.push(p); rads.push(radius * (0.85 + 0.3 * Math.sin(t * 13)));
  }
  addMesh(group, tube(pts, rads, 5, (c, t, ang) => c.copy(tint).multiplyScalar(0.8 + 0.25 * Math.sin(ang * 2 + t * 20))), barkMat, 'bark');
}

// A vine spiralling up a branch (usually the trunk).
export function spiralVine(group, r, branch, { from = 0, to = 0.7, turns = 2, radius = 0.04, color = 0x5d4e3a, pad = 1.06 } = {}) {
  const n = branch.pts.length, steps = 40, phase = r() * TAU, pts = [], rads = [], tint = new THREE.Color(color);
  for (let i = 0; i <= steps; i++) {
    const t = lerp(from, to, i / steps) * (n - 1), k = Math.min(n - 2, Math.floor(t)), f = t - k;
    const p = branch.pts[k].clone().lerp(branch.pts[k + 1], f), rad = lerp(branch.rads[k], branch.rads[k + 1], f) * pad + radius, a = phase + turns * TAU * i / steps;
    pts.push(new THREE.Vector3(p.x + Math.cos(a) * rad, p.y, p.z + Math.sin(a) * rad)); rads.push(radius);
  }
  addMesh(group, tube(pts, rads, 5, (c, t, a) => c.copy(tint).multiplyScalar(0.8 + 0.25 * Math.sin(a * 2 + t * 30))), barkMat, 'bark');
}

// A thin vine hanging straight down from a branch, leafy along its length.
export function hangingVine(parts, r, top, length, { color = 0x4f7f34, stem = 0x5a6a34, s = 1, lite = false } = {}) {
  const pts = [], rads = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(top.x + Math.sin(t * 5 + top.x) * 0.08 * t, top.y - length * t, top.z + Math.cos(t * 4 + top.z) * 0.08 * t)); rads.push(0.012 * s);
  }
  const stemColor = new THREE.Color(stem);
  parts.leaves.push(tube(pts, rads, 3, c => c.copy(stemColor)));
  const leaf = new THREE.Color(color), shade = leaf.clone().multiplyScalar(0.6), spacing = lite ? 0.5 : 0.28;
  for (let y = 0.2; y < length; y += spacing * s) {
    const at = new THREE.Vector3(top.x, top.y - y, top.z), a = r() * TAU, len = (0.12 + r() * 0.08) * s, geo = blade(len, len * 0.45, len * 0.3, 2);
    paint(geo, (c, x) => c.copy(shade).lerp(leaf, clamp(0.4 + x / len)));
    parts.leaves.push(orient(geo, new THREE.Vector3(Math.cos(a), -0.4, Math.sin(a)), UP, at));
  }
}

// A bromeliad rosette sitting on a branch, with a red heart.
export function bromeliad(parts, r, at, size) {
  const green = new THREE.Color(0x5f9440), red = new THREE.Color(0xc8352f);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU + r() * 0.3, rise = 0.9 + r() * 0.7, len = size * (0.7 + r() * 0.4), geo = blade(len, len * 0.13, len * 0.45, 3), heart = i % 3 === 0;
    paint(geo, (c, x) => c.copy(heart ? red : green).lerp(new THREE.Color(0xa7c46a), clamp(x / len) * 0.4));
    parts.leaves.push(orient(geo, new THREE.Vector3(Math.cos(a), rise, Math.sin(a)).normalize(), UP, at));
  }
  const spike = new THREE.ConeGeometry(size * 0.12, size * 0.35, 6);
  paint(spike, c => c.copy(red)); spike.translate(at.x, at.y + size * 0.18, at.z); parts.fruit.push(spike);
}

// A yagrumo leaf: palmate lobes, green on top and silver underneath.
export function umbrellaLeaf(parts, r, at, dir, size, lite) {
  const up = dir.clone().normalize(), ref = Math.abs(up.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(up, ref).normalize(), v = new THREE.Vector3().crossVectors(up, u), lobes = lite ? 7 : 9;
  const green = new THREE.Color(0x3d6c31).offsetHSL(0, 0, (r() - 0.5) * 0.06), shade = green.clone().multiplyScalar(0.7), silver = new THREE.Color(0xc8cfbe);
  for (let i = 0; i < lobes; i++) {
    const a = i / lobes * TAU + r() * 0.1, d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).addScaledVector(up, -0.12), len = size * (0.85 + r() * 0.25);
    const top = blade(len, len * 0.2, len * 0.4, 3), under = blade(len * 0.98, len * 0.19, len * 0.4, 3);
    paint(top, (c, x) => c.copy(shade).lerp(green, clamp(0.3 + x / len)));
    paint(under, (c, x) => c.copy(silver).multiplyScalar(0.8 + 0.2 * x / len));
    parts.leaves.push(orient(top, d, up, at.clone().addScaledVector(up, 0.012)));
    parts.leaves.push(orient(under, d, up, at.clone().addScaledVector(up, -0.012)));
  }
}

// Callers' 'low' and 'distant' are the far tier; anything else is low.
export const treeDetail = detail => ({ full: 'full', lite: 'lite', low: 'far', distant: 'far', far: 'far' })[detail] ?? 'low';
