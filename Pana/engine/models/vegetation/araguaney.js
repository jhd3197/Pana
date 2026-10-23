import { growTree, ellipsoid, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import * as THREE from 'three';

// Open sprays, rather than solid ellipsoids on each twig. All sprays join the
// existing foliage batch: no alpha texture, extra material or animation work.
function floweringCrown(parts, r, skeleton, o) {
  const tips = skeleton.tips, center = new THREE.Vector3();
  for (const tip of tips) center.add(tip.p);
  center.divideScalar(Math.max(1, tips.length));
  const radius = Math.max(1, ...tips.map(t => t.p.distanceTo(center)));
  const pos = [], normals = [], colors = [], up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color(), shade = new THREE.Color();
  const count = o.far ? 45 : o.low ? 80 : o.lite ? 100 : 160;
  for (const tip of tips) {
    const size = o.size * (o.far ? 0.82 : o.low ? 0.96 : 1.4);
    const phase = r() * Math.PI * 2;
    // A flattened, irregular branch-end spray. Interior layers overlap; the
    // outer fans break up the edge while leaving small windows to the limbs.
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * (i + 0.5) / count, ring = Math.sqrt(1 - y * y);
      const a = i * 2.39996 + phase, reach = 0.3 + r() * 0.65;
      const normal = new THREE.Vector3(Math.cos(a) * ring, y * 0.8 + 0.45, Math.sin(a) * ring).normalize();
      const at = tip.p.clone().lerp(tip.branch.pts[0], r() * 0.35).add(new THREE.Vector3(Math.cos(a) * ring * reach, y * 0.55 * reach, Math.sin(a) * ring * reach).multiplyScalar(size));
      // Tilt each fan independently, so the underside is not a row of flat discs.
      const axis = new THREE.Vector3().crossVectors(Math.abs(normal.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, normal).normalize();
      const across = new THREE.Vector3().crossVectors(normal, axis);
      const width = size * (0.17 + r() * 0.12), spin = r() * Math.PI * 2;
      const green = !o.flowers || (y < -0.15 && r() < o.greenMix);
      const palette = green ? o.tints : o.flowers;
      tint.set(palette[Math.floor(r() * palette.length)]);
      tint.multiplyScalar(0.77 + 0.18 * r() + 0.12 * Math.max(0, y));
      shade.copy(tint).multiplyScalar(green ? 0.65 : 0.8);
      const edge = [];
      for (let k = 0; k < 4; k++) {
        const angle = spin + k * Math.PI / 2;
        const w = width * (0.8 + r() * 0.3);
        edge.push(at.clone().addScaledVector(axis, Math.cos(angle) * w)
          .addScaledVector(across, Math.sin(angle) * w * (green ? 0.7 : 1))
          .addScaledVector(normal, k % 2 ? -width * 0.25 : 0));
      }
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const v = edge[k], c = k % 2 ? tint : shade;
        pos.push(v.x, v.y, v.z); normals.push(normal.x, normal.y, normal.z); colors.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  parts.leaves.push(geo);
  return { center, radius };
}

// The Tabebuia family in bloom. Araguaney, the national tree: a twisted trunk
// opening into a cup-shaped crown, all gold. Apamate: taller and straighter,
// an oval crown of pink flowers mixed with leaves. Bucare shares the apamate
// form in coral. `flowers: false` shows the green tree.
const ARAGUANEY = {
  name: 'araguaney',
  height: 7.5,
  skeleton: s => ({
    trunk: 2.6 * s, trunkR: 0.25 * s, trunkTaper: 0.55, clear: 0.62, lean: 0.3, trunkWobble: 0.14, depth: 3, kids: [4, 3, 3],
    angle: [0.62, 0.62, 0.6], lenRatio: [1.5, 0.6, 0.56], radRatio: [0.65, 0.58, 0.55], upturn: [0, 0.05, 0.03, 0.02],
    wobble: 0.3, taper: 0.35, envelope: ellipsoid(0, 5.3 * s, 0, 3.5 * s, 2.5 * s, 3.5 * s),
  }),
  bark: { bark: 0x6f5a46, barkLight: 0x9a8670, ridges: 6, ridgeTwist: 2.4 },
  foliage: { kind: 'leaf', size: 0.95, tints: [0x5f9a3e, 0x6fa846, 0x4f8a38], blades: 14, bladeLen: 0.6, bladeWidth: 0.26, along: 2, alongFrom: 2 },
  blossom: { kind: 'flower', size: 0.9, flowers: [0xf7c71f, 0xffd83a, 0xf0b30e], throat: 0xc98410, blooms: 24, petalBlades: 16, mixLeaves: 0.12 },
  petals: { color: 0xf5c21e, radius: 3.6 },
};
const APAMATE = {
  name: 'apamate',
  height: 9.5,
  skeleton: s => ({
    trunk: 3.4 * s, trunkR: 0.3 * s, trunkTaper: 0.55, clear: 0.6, lean: 0.12, depth: 3, kids: [4, 3, 3],
    angle: [0.55, 0.66, 0.62], lenRatio: [1.25, 0.6, 0.56], radRatio: [0.62, 0.58, 0.55], upturn: [0, 0.045, 0.03, 0.02],
    wobble: 0.24, taper: 0.35, envelope: ellipsoid(0, 6.9 * s, 0, 3 * s, 3.1 * s, 3 * s),
  }),
  bark: { bark: 0x6a5c4c, barkLight: 0x948572, ridges: 7 },
  foliage: { kind: 'leaf', size: 1, tints: [0x4f8e3c, 0x5e9c42, 0x3f7d36], blades: 14, bladeLen: 0.62, bladeWidth: 0.24, along: 2, alongFrom: 2 },
  blossom: { kind: 'flower', size: 0.9, flowers: [0xf09bd0, 0xe47cc0, 0xf9c2e2], throat: 0xa54e8e, blooms: 22, petalBlades: 16, mixLeaves: 0.45 },
  petals: { color: 0xee8fca, radius: 3.4 },
};
const BUCARE = {
  ...APAMATE, name: 'bucare',
  blossom: { ...APAMATE.blossom, flowers: [0xf26a3c, 0xf8834a, 0xe5552e], throat: 0xb8401f, mixLeaves: 0.3 },
  petals: { color: 0xf47a42, radius: 3.4 },
};
const BLOOMS = { gold: ARAGUANEY, pink: APAMATE, coral: BUCARE };
// Keep the bucare's separate recipe. Both green and flowering forms use the
// same open crown structure; green sprays are included in that same draw.
const OPEN_CROWNS = new Map([ARAGUANEY, APAMATE].map(species => [species, {
  ...species, dressCrown: floweringCrown,
  foliage: { ...species.foliage, greenMix: species.blossom.mixLeaves },
  blossom: { ...species.blossom, mixLeaves: 0 },
}]));

// The default scale keeps the old ~5.5 m roadside size; scale 1 is full grown.
export function araguaney({ seed = 1, detail = 'game', bloom = 'gold', leaves = true, flowers = true, scale = bloom === 'gold' ? 0.75 : 0.65 } = {}) {
  const species = BLOOMS[bloom] || ARAGUANEY;
  return growTree(OPEN_CROWNS.get(species) || species, { seed, detail: treeDetail(detail), leaves, flowers, scale });
}

export const apamate = (options = {}) => araguaney({ ...options, bloom: 'pink' });
