// Faceted canopy blobs, tapered limbs, buttress fins and hanging vines for the
// low-poly forest trees (dead tree, broadleaf, ceiba gateway, emergent, fig).
import * as THREE from 'three';
import { mesh } from '/engine/models/core/primitives.js';
import { taperedStem } from '/engine/models/core/botanical-shapes.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { leafMaterial, applyWindSway } from '/engine/models/vegetation/plant-kit.js';

const UP = new THREE.Vector3(0, 1, 0);
const barks = new Map();

// Swaying flat-shaded bark, shared per colour so a forest batches into few draws.
export function barkMat(color) {
  if (!barks.has(color)) barks.set(color, applyWindSway(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }), 0.025));
  return barks.get(color);
}

function paint(geo, tint, shade = 0.58) {
  const p = geo.attributes.position, colors = new Float32Array(p.count * 3);
  const light = new THREE.Color(tint), dark = light.clone().multiplyScalar(shade), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(dark).lerp(light, THREE.MathUtils.clamp(0.55 + p.getY(i) * 0.4, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// One lumpy, flat-faceted icosahedron of foliage. Lumps follow position so the
// shell stays closed; per-face normals keep the cut-gem look after baking.
export function facet(group, position, scale, rotation, tint, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.11 * Math.sin(x * 5.1 + seed) * Math.sin(z * 4.3 - seed * 0.7) + 0.06 * Math.cos(y * 6 + seed);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  const m = mesh(natureSurface(paint(geo, tint), 'foliage'), leafMaterial, ...position);
  m.scale.set(...scale); m.rotation.set(...rotation); group.add(m);
  return m;
}

// A cloud of 3-5 facets around `center`, squashed vertically like a crown tier.
export function canopyBlob(group, center, size, r, tints) {
  const n = 3 + (r() * 3 | 0);
  for (let i = 0; i < n; i++) {
    facet(group,
      [center[0] + (r() - 0.5) * size * 1.3, center[1] + (r() - 0.5) * size * 0.45, center[2] + (r() - 0.5) * size * 1.3],
      [size * (0.72 + r() * 0.42), size * (0.5 + r() * 0.22), size * (0.72 + r() * 0.42)],
      [r() * 3, r() * 3, r() * 3], tints[(r() * tints.length) | 0], i * 7 + r() * 50);
  }
}

// Straight tapered segment from a to b (radius r0 at a, r1 at b).
export function limb(group, a, b, r0, r1, material, sides = 7) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
  const m = mesh(natureSurface(new THREE.CylinderGeometry(r1, r0, d.length(), sides, 1), 'bark'), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  group.add(m);
  return m;
}

// Smooth tapered root or bough through CatmullRom points.
export function bough(group, points, radius, tip, material, segments = 12, sides = 6) {
  group.add(mesh(natureSurface(taperedStem(points, radius, tip, segments, sides), 'bark'), material));
}

// Flat plank buttress: a triangle with a concave flank, rotated around the trunk.
export function buttress(group, angle, inner, reach, rise, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(inner, 0); shape.lineTo(inner + reach, 0);
  shape.quadraticCurveTo(inner + reach * 0.28, rise * 0.18, inner * 0.92, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 6 });
  geo.translate(0, -0.15, -depth / 2);
  const m = mesh(natureSurface(geo, 'bark'), material); m.rotation.y = -angle; group.add(m);
  return m;
}

// Narrow four-sided blade: fern fronds, bromeliad leaves and vine leaves.
export function blade(group, position, rotation, scale, tint) {
  const geo = paint(new THREE.ConeGeometry(1, 1, 4).scale(1, 1, 0.18), tint, 0.7);
  const m = mesh(natureSurface(geo, 'foliage'), leafMaterial, ...position);
  m.rotation.set(...rotation); m.scale.set(...scale); group.add(m);
  return m;
}

// Rosette of stiff blades, red or pink at the heart; perches in branch forks.
export function bromeliadRosette(group, [x, y, z], s, r, heart = [0xe0332e, 0xff6fae, 0xff8c1a][(r() * 3) | 0]) {
  const ring = (count, tilt, length, width, tint, turn) => {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + turn, t = tilt + r() * 0.3, L = length * (0.85 + r() * 0.3);
      blade(group, [x - Math.sin(t) * Math.cos(a) * L / 2, y + Math.cos(t) * L / 2, z + Math.sin(t) * Math.sin(a) * L / 2],
        [0, a, t], [width, L, width], tint);
    }
  };
  ring(10, 0.65, s * 0.9, s * 0.16, 0x5fae3c, 0);
  ring(6, 0.35, s * 0.6, s * 0.12, heart, 0.3);
}

// Liana hanging from `top`: a wobbling stem with leaves along it.
export function hangingVine(group, [x, y, z], length, r, material, tints = [0x67b443, 0x3f8f3a]) {
  const n = Math.max(3, Math.round(length / 0.9)), points = [];
  let px = x, pz = z;
  for (let i = 0; i <= n; i++) { points.push([px, y - length * i / n, pz]); px += (r() - 0.5) * 0.22; pz += (r() - 0.5) * 0.22; }
  bough(group, points, 0.05, 0.035, material, n * 2, 4);
  for (let i = 1; i <= n; i++) if (r() < 0.65) {
    const [lx, ly, lz] = points[i];
    blade(group, [lx + (r() - 0.5) * 0.3, ly, lz + (r() - 0.5) * 0.3], [r() * 3, r() * 3, r() * 3], [0.16, 0.38, 0.16], tints[i % tints.length]);
  }
}
