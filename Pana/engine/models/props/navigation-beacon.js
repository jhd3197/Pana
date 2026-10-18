// Coastal navigation beacon on a stone breakwater base with red-and-white lattice mast,
// solar panels, radar reflector and marine lantern. Ground origin y=0, front +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring, ladder } from '/engine/models/core/rural-kit.js';
import { rock } from './rock.js';

export function navigationBeacon() {
  const g = new THREE.Group();
  const red = M(0xc85440, { roughness: 0.75 }), white = M(0xf4e8cb, { roughness: 0.8 });
  const steel = M(0x788e8c, { metalness: 0.45, roughness: 0.5 }), solar = M(0x1f3f52, { metalness: 0.35, roughness: 0.3 });
  const beaconGlow = M(0xffdf8e, { emissive: 0xffaa33, emissiveIntensity: 0.55, roughness: 0.3 });

  // Breakwater stone caisson base and surrounding riprap boulders at y=0.
  const baseOct = cylinder(2.15, 2.45, 0.55, P.stone, 0, 0.275, 0, 8);
  baseOct.rotation.y = Math.PI / 8;
  g.add(baseOct);
  const plinth = cylinder(1.75, 1.9, 0.52, white, 0, 0.81, 0, 8);
  plinth.rotation.y = Math.PI / 8;
  g.add(plinth);
  g.add(cylinder(1.82, 1.82, 0.1, red, 0, 1.1, 0, 8));
  g.children.at(-1).rotation.y = Math.PI / 8;

  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3) + 0.25, r = 2.25 + (i % 2) * 0.2;
    const boulder = rock(0.52 + (i % 3) * 0.08, i % 2 ? 0x878d82 : 0x9b9987, 70 + i);
    boulder.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
    boulder.scale.set(1.15, 0.46, 1.05);
    g.add(boulder);
  }
  // Mooring bollard and battery cabinet on the base deck.
  g.add(cylinder(0.13, 0.15, 0.38, P.iron, 1.35, 1.28, 0.65, 10));
  g.add(cylinder(0.17, 0.17, 0.07, P.iron, 1.35, 1.48, 0.65, 10));
  g.add(rounded(0.76, 0.68, 0.52, white, 0, 1.46, -0.78, 0.04));
  const plate = sign(['BALIZA 04', 'CANAL PANA'], 0.64, 0.34, { background: '#c85440', color: '#fff3d4' });
  plate.position.set(0, 0.82, 1.76);
  g.add(plate);

  // Tapered four-leg steel lattice tower in alternating red and white marine bands.
  const levels = [1.14, 2.35, 3.55, 4.75, 5.95, 7.05];
  const widthAt = y => 1.05 - ((y - 1.14) / 5.91) * 0.56;
  for (let band = 0; band < levels.length - 1; band++) {
    const y0 = levels[band], y1 = levels[band + 1];
    const w0 = widthAt(y0), w1 = widthAt(y1);
    const mat = band % 2 === 0 ? red : white;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(tube([sx * w0, y0, sz * w0], [sx * w1, y1, sz * w1], 0.052, mat));
    }
    for (const s of [-1, 1]) {
      // Horizontal girts and X-bracing on all four faces.
      g.add(tube([-w1, y1, s * w1], [w1, y1, s * w1], 0.034, mat));
      g.add(tube([s * w1, y1, -w1], [s * w1, y1, w1], 0.034, mat));
      g.add(tube([-w0, y0, s * w0], [w1, y1, s * w1], 0.024, mat));
      g.add(tube([w0, y0, s * w0], [-w1, y1, s * w1], 0.024, mat));
      g.add(tube([s * w0, y0, -w0], [s * w1, y1, w1], 0.024, mat));
      g.add(tube([s * w0, y0, w0], [s * w1, y1, -w1], 0.024, mat));
    }
  }
  ladder(g, 0, 1.15, 0.92, 5.85, { width: 0.36 });

  // Twin angled photovoltaic solar panels mid-mast facing +Z.
  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    panel.position.set(side * 0.95, 4.85, 0.52);
    panel.rotation.x = 0.48;
    panel.rotation.y = side * 0.18;
    panel.add(rounded(0.74, 0.05, 0.92, steel, 0, 0, 0, 0.02));
    panel.add(box(0.66, 0.02, 0.84, solar, 0, 0.025, 0));
    for (const x of [-0.16, 0.16]) panel.add(box(0.012, 0.025, 0.84, white, x, 0.026, 0));
    for (const z of [-0.21, 0, 0.21]) panel.add(box(0.66, 0.025, 0.012, white, 0, 0.026, z));
    g.add(panel);
    g.add(tube([side * 0.65, 4.75, 0.35], [side * 0.95, 4.85, 0.52], 0.03, steel));
  }

  // Upper service gallery platform, circular safety rail, Fresnel lantern and daymark cones.
  g.add(cylinder(1.08, 0.98, 0.16, red, 0, 7.12, 0, 16));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(tube([Math.cos(a) * 0.98, 7.18, Math.sin(a) * 0.98], [Math.cos(a) * 0.98, 7.98, Math.sin(a) * 0.98], 0.024, white));
  }
  for (const y of [7.55, 7.98]) {
    const guard = ring(0.98, 0.028, white, 0, y, 0);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);
  }

  // Lantern pedestal, glowing lens drum, cap and double-cone port/cardinal topmark.
  g.add(cylinder(0.42, 0.48, 0.45, P.iron, 0, 7.42, 0, 16));
  g.add(cylinder(0.36, 0.36, 0.56, beaconGlow, 0, 7.92, 0, 16));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(tube([Math.cos(a) * 0.39, 7.64, Math.sin(a) * 0.39], [Math.cos(a) * 0.39, 8.2, Math.sin(a) * 0.39], 0.016, P.iron));
  }
  g.add(cylinder(0.1, 0.46, 0.28, red, 0, 8.32, 0, 16));
  g.add(tube([0, 8.42, 0], [0, 9.55, 0], 0.028, steel));
  const topConeA = mesh(new THREE.ConeGeometry(0.28, 0.38, 12), red, 0, 8.85, 0);
  g.add(topConeA);
  const topConeB = mesh(new THREE.ConeGeometry(0.28, 0.38, 12), red, 0, 9.28, 0);
  topConeB.rotation.x = Math.PI;
  g.add(topConeB);

  const out = paintFinish(g, 'navigation-beacon');
  out.userData.assetId = 'navigation-beacon';
  return out;
}
