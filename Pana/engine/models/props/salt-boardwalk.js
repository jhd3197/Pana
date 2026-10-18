// Raised timber boardwalk and salt-worker lookout over pink salt pond banks.
// Ground origin y=0, front +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring, plank } from '/engine/models/core/rural-kit.js';

export function saltBoardwalk() {
  const g = new THREE.Group();
  const wood = M(0x967752, { roughness: 0.95 }), weathered = M(0xa98c67, { roughness: 0.95 });
  const darkWood = M(0x5d4a36, { roughness: 1 }), salt = M(0xf2ece0, { roughness: 0.9 });
  const pinkSalt = M(0xe6c8c4, { roughness: 0.85 }), teal = M(0x418886, { roughness: 0.85 });
  const rope = M(0xcbb88c, { roughness: 1 });

  // Salt-crusted ground embankment pads and crystalline salt clusters at y=0.
  for (const x of [-4.2, -1.4, 1.4, 4.2]) for (const z of [-1.05, 1.05]) {
    g.add(cylinder(0.28, 0.36, 0.18, pinkSalt, x, 0.09, z, 10));
    g.add(cylinder(0.21, 0.25, 0.26, salt, x, 0.22, z, 10));
    g.add(cylinder(0.12, 0.13, 1.38, darkWood, x, 0.69, z, 10));
  }
  // Extra pilings for the projecting central lookout bay (+Z).
  for (const x of [-1.4, 1.4]) {
    g.add(cylinder(0.28, 0.35, 0.18, pinkSalt, x, 0.09, 2.35, 10));
    g.add(cylinder(0.21, 0.24, 0.26, salt, x, 0.22, 2.35, 10));
    g.add(cylinder(0.12, 0.13, 1.38, darkWood, x, 0.69, 2.35, 10));
  }

  // Cross-bracing and longitudinal stringers supporting the elevated deck (y=1.18).
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    g.add(box(0.18, 0.18, 2.4, darkWood, x, 1.06, 0));
    g.add(tube([x, 0.28, -1.05], [x, 1.02, 1.05], 0.045, darkWood));
  }
  for (const z of [-0.95, 0.95]) g.add(box(9.2, 0.16, 0.14, darkWood, 0, 1.12, z));
  for (const x of [-1.4, 1.4]) g.add(box(0.14, 0.16, 1.5, darkWood, x, 1.12, 1.7));

  // Main deck planks along X and projecting central observation deck.
  for (let i = 0; i < 28; i++) {
    const x = -4.45 + i * 0.33;
    plank(g, 0.29, 0.09, 2.35, x, 1.24, 0, { mat: i % 3 ? wood : weathered });
  }
  for (let i = 0; i < 9; i++) {
    const x = -1.32 + i * 0.33;
    plank(g, 0.29, 0.09, 1.45, x, 1.24, 1.9, { mat: i % 2 ? weathered : wood });
  }
  // Wheel-guard timber curbs along the deck edges.
  g.add(box(9.2, 0.1, 0.12, darkWood, 0, 1.32, -1.12));
  for (const side of [-1, 1]) g.add(box(3.1, 0.1, 0.12, darkWood, side * 3.05, 1.32, 1.12));

  // Stepped wooden access ramps at both ends (-X and +X) descending to ground y=0.
  for (const side of [-1, 1]) {
    for (let s = 0; s < 5; s++) {
      const sx = side * (4.75 + s * 0.38), sy = 1.04 - s * 0.23;
      g.add(box(0.34, 0.1, 1.85, s % 2 ? wood : weathered, sx, sy, 0));
      for (const z of [-0.82, 0.82]) g.add(box(0.12, sy, 0.12, darkWood, sx, sy / 2, z));
    }
    for (const z of [-0.88, 0.88]) {
      g.add(tube([side * 4.5, 1.25, z], [side * 6.35, 0.08, z], 0.055, darkWood));
      g.add(cylinder(0.08, 0.09, 1.1, darkWood, side * 6.3, 0.55, z, 8));
      g.add(curve([[side * 4.2, 2.08, z], [side * 5.3, 1.52, z], [side * 6.3, 1.04, z]], 0.024, rope, 12));
    }
  }

  // Rope-and-post railings along the boardwalk and lookout bay.
  const posts = [
    [-4.2, -1.05], [-2.8, -1.05], [-1.4, -1.05], [0, -1.05], [1.4, -1.05], [2.8, -1.05], [4.2, -1.05],
    [-4.2, 1.05], [-2.8, 1.05], [-1.4, 1.05], [1.4, 1.05], [2.8, 1.05], [4.2, 1.05],
    [-1.4, 2.48], [0, 2.48], [1.4, 2.48],
  ];
  for (const [x, z] of posts) {
    g.add(cylinder(0.075, 0.085, 1.05, darkWood, x, 1.76, z, 10));
    g.add(ring(0.088, 0.018, P.iron, x, 2.12, z));
    g.children.at(-1).rotation.x = Math.PI / 2;
  }
  const ropeSpans = [
    [[-4.2, -1.05], [-2.8, -1.05], [-1.4, -1.05], [0, -1.05], [1.4, -1.05], [2.8, -1.05], [4.2, -1.05]],
    [[-4.2, 1.05], [-2.8, 1.05], [-1.4, 1.05], [-1.4, 2.48], [0, 2.48], [1.4, 2.48], [1.4, 1.05], [2.8, 1.05], [4.2, 1.05]],
  ];
  for (const span of ropeSpans) {
    for (let i = 0; i < span.length - 1; i++) {
      const [x0, z0] = span[i], [x1, z1] = span[i + 1], xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
      for (const [h, sag] of [[2.12, 0.08], [1.72, 0.06]]) {
        g.add(curve([[x0, h, z0], [xm, h - sag, zm], [x1, h, z1]], 0.022, rope, 10));
      }
    }
  }

  // Shade pergola over the central bay with slatted sun-cover, sign and salt-worker gear.
  for (const x of [-1.4, 1.4]) for (const z of [-1.05, 1.05]) {
    g.add(box(0.14, 2.35, 0.14, teal, x, 2.45, z));
  }
  for (const z of [-1.05, 1.05]) g.add(box(3.2, 0.14, 0.14, teal, 0, 3.58, z));
  for (const x of [-1.4, 1.4]) g.add(box(0.14, 0.14, 2.5, teal, x, 3.58, 0));
  for (let i = -5; i <= 5; i++) {
    const slat = box(3.35, 0.05, 0.14, i % 2 ? wood : P.cream, 0, 3.7, i * 0.21);
    slat.rotation.x = 0.12;
    g.add(slat);
  }
  const label = sign(['MIRADOR DE LAS SALINAS', 'cosecha artesanal'], 2.45, 0.44, { background: '#3a7f7d', color: '#f9ebd0' });
  label.position.set(0, 3.38, 1.14);
  g.add(label);

  // Salt baskets, crystallizer depth gauge and wooden rakes on the lookout deck.
  for (const [i, bx] of [-0.75, -0.15].entries()) {
    g.add(cylinder(0.32, 0.25, 0.38, weathered, bx, 1.47, 1.85, 14));
    const mound = mesh(new THREE.ConeGeometry(0.29, 0.24, 12), i ? pinkSalt : salt, bx, 1.76, 1.85);
    g.add(mound);
  }
  // Wooden salt rake resting against the pergola post.
  g.add(tube([1.15, 1.3, 1.65], [1.32, 2.85, 1.08], 0.025, wood));
  g.add(box(0.58, 0.08, 0.09, darkWood, 1.15, 1.33, 1.68));
  // Brine depth gauge post beside the walkway.
  g.add(box(0.14, 1.85, 0.08, P.cream, 2.25, 0.92, 1.95));
  for (let i = 0; i < 7; i++) g.add(box(0.15, 0.04, 0.09, teal, 2.25, 0.35 + i * 0.22, 1.95));

  const out = paintFinish(g, 'salt-boardwalk');
  out.userData.assetId = 'salt-boardwalk';
  return out;
}
