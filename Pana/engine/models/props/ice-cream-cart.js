// Carrito de helados y cepillados with striped umbrella, spoked wheels, syrup bottles and cones.
// Ground origin y=0, front +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring, wheel } from '/engine/models/core/rural-kit.js';

export function iceCreamCart() {
  const g = new THREE.Group();
  const coral = M(0xe06850, { roughness: 0.85 }), teal = M(0x388e8a, { roughness: 0.8 });
  const yellow = M(0xeebd48, { roughness: 0.85 }), cream = M(0xf6e8c8, { roughness: 0.9 });
  const steel = M(0xc6cfcc, { metalness: 0.55, roughness: 0.35 }), glass = M(0xdff4f5, { transparent: true, opacity: 0.55 });

  // Main spoked side wheels (radius 0.44m, resting at y=0) and front caster wheel.
  for (const side of [-1, 1]) {
    const w = wheel(0.44, 0.12, { hub: 0xc5a35a, tread: false });
    w.position.set(side * 0.82, 0.44, -0.08);
    g.add(w);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.add(tube([side * 0.82, 0.44, -0.08], [side * 0.82, 0.44 + Math.cos(a) * 0.34, -0.08 + Math.sin(a) * 0.34], 0.014, P.brass));
    }
    // Curved mudguards over each main wheel.
    const fender = mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.16, 18, 1, true, Math.PI * 0.12, Math.PI * 0.76), teal, side * 0.82, 0.44, -0.08);
    fender.rotation.z = Math.PI / 2;
    g.add(fender);
  }
  g.add(tube([-0.82, 0.44, -0.08], [0.82, 0.44, -0.08], 0.035, P.iron));

  // Front swivel caster and rear resting foot so the cart sits level at y=0.
  const caster = wheel(0.16, 0.08, { hub: 0x354d4d, tread: false });
  caster.position.set(0, 0.16, 0.82);
  g.add(caster);
  for (const side of [-1, 1]) g.add(tube([side * 0.06, 0.16, 0.82], [side * 0.08, 0.46, 0.76], 0.02, P.iron));
  for (const side of [-1, 1]) {
    g.add(tube([side * 0.52, 0.46, -0.82], [side * 0.52, 0.04, -0.88], 0.025, P.iron));
    g.add(rounded(0.14, 0.06, 0.18, P.iron, side * 0.52, 0.03, -0.88));
  }

  // Insulated freezer body with paneled sides, brass corner trim and awning stripes.
  g.add(rounded(1.42, 0.1, 2.02, P.timber, 0, 0.46, 0, 0.04));
  g.add(rounded(1.36, 0.78, 1.92, cream, 0, 0.88, 0, 0.06));
  g.add(box(1.39, 0.18, 1.95, coral, 0, 0.62, 0));
  g.add(box(1.39, 0.12, 1.95, teal, 0, 1.18, 0));
  for (const x of [-0.66, 0.66]) for (const z of [-0.93, 0.93]) {
    g.add(box(0.08, 0.76, 0.08, P.brass, x, 0.88, z));
  }
  const frontSign = sign(['HELADOS EL PANA', 'coco · parchita · mango'], 1.12, 0.42, { background: '#388e8a', color: '#fff3d1' });
  frontSign.position.set(0, 0.88, 0.97);
  g.add(frontSign);
  const backSign = sign(['CEPILLADOS', 'bien fríos'], 1.05, 0.38, { background: '#c95640', color: '#fff3d1' });
  backSign.position.set(0, 0.88, -0.97);
  backSign.rotation.y = Math.PI;
  g.add(backSign);

  // Stainless steel counter top, freezer lids, sneeze guard and push handlebar.
  g.add(rounded(1.48, 0.09, 2.06, steel, 0, 1.29, 0, 0.035));
  for (const z of [-0.46, 0.08]) {
    g.add(cylinder(0.24, 0.24, 0.05, steel, -0.28, 1.35, z, 20));
    g.add(ring(0.245, 0.018, P.iron, -0.28, 1.35, z));
    g.children.at(-1).rotation.x = Math.PI / 2;
    g.add(curve([[-0.35, 1.37, z], [-0.28, 1.43, z], [-0.21, 1.37, z]], 0.016, P.brass, 8));
  }

  // Push handle and brass vendor bell at the rear (-Z).
  for (const side of [-1, 1]) {
    g.add(curve([[side * 0.56, 1.18, -0.94], [side * 0.56, 1.18, -1.28], [side * 0.52, 1.26, -1.38]], 0.026, steel, 10));
  }
  g.add(cylinder(0.032, 0.032, 1.14, P.wood, 0, 1.26, -1.38, 12));
  g.children.at(-1).rotation.z = Math.PI / 2;
  g.add(tube([0.56, 1.26, -1.16], [0.56, 1.52, -1.16], 0.016, P.brass));
  g.add(cylinder(0.02, 0.085, 0.11, P.brass, 0.56, 1.56, -1.16, 14));
  g.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), P.brass, 0.56, 1.63, -1.16));

  // Syrup bottle rack, shaved-ice block shaver and waffle cones with colorful scoops.
  g.add(rounded(0.46, 0.08, 0.92, P.wood, 0.36, 1.36, -0.18));
  const syrups = [0xd9483b, 0xf2ae2e, 0x45a362, 0x8e4977, 0x3895b8];
  for (const [i, col] of syrups.entries()) {
    const z = -0.52 + i * 0.17;
    g.add(cylinder(0.052, 0.058, 0.22, M(col, { roughness: 0.4 }), 0.36, 1.5, z, 12));
    g.add(cylinder(0.02, 0.048, 0.08, cream, 0.36, 1.65, z, 10));
    g.add(tube([0.36, 1.69, z], [0.34, 1.75, z + 0.02], 0.009, steel));
  }
  // Cone display stand at the front (+Z) with 4 ice-cream cones.
  g.add(box(0.86, 0.36, 0.03, glass, 0, 1.5, 0.92));
  for (const x of [-0.43, 0.43]) g.add(tube([x, 1.33, 0.92], [x, 1.68, 0.92], 0.015, steel));
  g.add(rounded(0.72, 0.12, 0.28, P.wood, 0, 1.38, 0.62));
  const scoopColors = [0xf7c844, 0xe86b7e, 0x6ec4a7, 0xf4ebd0];
  for (let i = 0; i < 4; i++) {
    const x = -0.24 + i * 0.16;
    const cone = mesh(new THREE.ConeGeometry(0.055, 0.18, 10), M(0xc88d48), x, 1.49, 0.62);
    cone.rotation.x = Math.PI;
    g.add(cone);
    g.add(mesh(new THREE.SphereGeometry(0.062, 10, 8), M(scoopColors[i]), x, 1.6, 0.62));
  }

  // Tilted umbrella mast and 8-rib striped scalloped parasol canopy.
  const umbrella = new THREE.Group();
  umbrella.position.set(-0.12, 1.32, -0.05);
  umbrella.rotation.z = -0.08;
  umbrella.rotation.x = 0.05;
  umbrella.add(cylinder(0.032, 0.038, 1.95, P.wood, 0, 0.96, 0, 12));
  umbrella.add(cylinder(0.055, 0.055, 0.1, P.brass, 0, 1.55, 0, 12));

  const radius = 1.62, topY = 2.02, rimY = 1.62, segments = 8;
  const stripeMats = [coral, cream, teal, yellow].map(m => M(m.color.getHex(), { side: THREE.DoubleSide, roughness: 0.88 }));
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2, amid = (a0 + a1) / 2;
    const x0 = Math.sin(a0) * radius, z0 = Math.cos(a0) * radius;
    const x1 = Math.sin(a1) * radius, z1 = Math.cos(a1) * radius;
    const xm = Math.sin(amid) * radius * 0.54, zm = Math.cos(amid) * radius * 0.54;
    const mat = stripeMats[i % stripeMats.length];

    const panelGeo = new THREE.BufferGeometry();
    panelGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, topY, 0,
      xm, topY - 0.13, zm,
      x0 * 0.54, topY - 0.13, z0 * 0.54,
      0, topY, 0,
      x1 * 0.54, topY - 0.13, z1 * 0.54,
      xm, topY - 0.13, zm,
      x0 * 0.54, topY - 0.13, z0 * 0.54,
      xm, topY - 0.13, zm,
      x0, rimY, z0,
      xm, topY - 0.13, zm,
      x1, rimY, z1,
      x0, rimY, z0,
      xm, topY - 0.13, zm,
      x1 * 0.54, topY - 0.13, z1 * 0.54,
      x1, rimY, z1,
    ], 3));
    panelGeo.computeVertexNormals();
    umbrella.add(mesh(panelGeo, mat));

    // Rib and stretcher strut under the canopy.
    umbrella.add(tube([0, topY - 0.03, 0], [x0, rimY, z0], 0.012, P.wood));
    umbrella.add(tube([0, 1.55, 0], [x0 * 0.56, topY - 0.15, z0 * 0.56], 0.01, P.brass));

    // Scalloped hanging valance along each outer edge.
    const edgeLen = Math.hypot(x1 - x0, z1 - z0);
    const valShape = new THREE.Shape();
    valShape.moveTo(-edgeLen / 2, 0);
    valShape.lineTo(edgeLen / 2, 0);
    valShape.lineTo(edgeLen / 2, -0.14);
    valShape.quadraticCurveTo(0, -0.26, -edgeLen / 2, -0.14);
    valShape.closePath();
    const val = mesh(new THREE.ShapeGeometry(valShape, 6), mat, (x0 + x1) / 2, rimY, (z0 + z1) / 2);
    val.rotation.y = amid;
    umbrella.add(val);
  }
  umbrella.add(cylinder(0.02, 0.12, 0.18, P.brass, 0, topY + 0.09, 0, 12));
  umbrella.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), yellow, 0, topY + 0.2, 0));
  g.add(umbrella);

  const out = paintFinish(g, 'ice-cream-cart');
  out.userData.assetId = 'ice-cream-cart';
  return out;
}
