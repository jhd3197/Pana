// Working hydraulic water-pump station with twin centrifugal volute pumps, flanged manifolds,
// gate valves, intake sump and corrugated shelter. Ground origin y=0, front +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, railing, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring, corrugatedRoof } from '/engine/models/core/rural-kit.js';

export function waterPumpStation() {
  const g = new THREE.Group();
  const teal = M(0x367f82, { metalness: 0.25, roughness: 0.65 });
  const rust = M(0xb85c42, { roughness: 0.8 }), yellow = M(0xe6b445, { roughness: 0.75 });
  const steel = M(0x7d9290, { metalness: 0.5, roughness: 0.45 }), cream = M(0xebe0c3, { roughness: 0.9 });
  const water = M(0x49b7b9, { metalness: 0.15, roughness: 0.25 });

  // Concrete equipment pad and front intake sump basin with iron trash-rack bars.
  g.add(rounded(6.8, 0.26, 4.8, P.stone, 0, 0.13, -0.35, 0.04));
  g.add(box(4.6, 0.24, 1.55, P.stone, 0, 0.12, 2.35));
  g.add(box(4.0, 0.08, 1.15, water, 0, 0.19, 2.35));
  for (const s of [-1, 1]) g.add(box(0.24, 0.34, 1.55, cream, s * 2.15, 0.29, 2.35));
  g.add(box(4.5, 0.34, 0.24, cream, 0, 0.29, 3.02));
  for (let i = -8; i <= 8; i++) {
    g.add(tube([i * 0.22, 0.18, 2.85], [i * 0.22, 0.62, 1.85], 0.016, P.iron));
  }
  railing(g, [-3.2, 0.26, 1.75], [-2.2, 0.26, 1.75], { height: 0.88, material: yellow, spacing: 0.5 });
  railing(g, [2.2, 0.26, 1.75], [3.2, 0.26, 1.75], { height: 0.88, material: yellow, spacing: 0.5 });

  // Open-front pump shelter with masonry rear wall, steel posts and corrugated roof.
  g.add(rounded(6.2, 2.85, 0.28, cream, 0, 1.68, -2.45, 0.04));
  g.add(box(6.26, 0.55, 0.3, teal, 0, 0.52, -2.45));
  for (const x of [-2.95, 0, 2.95]) for (const z of [-2.35, 1.45]) {
    g.add(box(0.18, 3.15, 0.18, teal, x, 1.82, z));
    g.add(box(0.32, 0.16, 0.32, steel, x, 0.34, z));
    if (z > 0) g.add(tube([x, 2.6, z], [x, 3.25, z - 0.65], 0.045, teal));
  }
  for (const z of [-2.35, 1.45]) g.add(box(6.3, 0.18, 0.18, teal, 0, 3.35, z));
  const roofGroup = new THREE.Group();
  roofGroup.position.z = -0.45;
  corrugatedRoof(roofGroup, { w: 6.9, d: 4.5, y: 3.42, rise: 0.85, color: 0xb85c42 });
  g.add(roofGroup);

  const label = sign(['ESTACIÓN DE BOMBEO', 'CAUDAL · CANAL PRINCIPAL'], 3.4, 0.52, { background: '#264f52', color: '#f9e7bd' });
  label.position.set(0, 3.32, 1.56);
  g.add(label);

  // Twin centrifugal volute pumps with ribbed drive motors, suction pipes and discharge headers.
  for (const [idx, px] of [-1.45, 1.45].entries()) {
    const pumpColor = idx === 0 ? teal : rust;
    // Steel mounting skid.
    g.add(rounded(1.55, 0.18, 2.15, P.iron, px, 0.35, -0.35, 0.03));

    // Ribbed electric motor at the rear (-Z) and coupling shaft.
    const motor = cylinder(0.38, 0.38, 0.92, pumpColor, px, 0.84, -0.88, 16);
    motor.rotation.x = Math.PI / 2;
    g.add(motor);
    for (let i = -3; i <= 3; i++) {
      const fin = ring(0.395, 0.022, pumpColor, px, 0.84, -0.88 + i * 0.11);
      g.add(fin);
    }
    g.add(box(0.26, 0.18, 0.28, steel, px + 0.32, 1.02, -0.88));
    g.add(cylinder(0.14, 0.14, 0.38, steel, px, 0.84, -0.25, 12));
    g.children.at(-1).rotation.x = Math.PI / 2;

    // Snail-shell centrifugal volute casing and bolted flange rings.
    const volute = cylinder(0.52, 0.52, 0.36, pumpColor, px, 0.88, 0.18, 20);
    volute.rotation.x = Math.PI / 2;
    g.add(volute);
    g.add(ring(0.52, 0.08, pumpColor, px, 0.88, 0.18));
    g.add(ring(0.28, 0.035, steel, px, 0.88, 0.38));

    // Front suction pipe plunging into the intake sump (+Z).
    g.add(curve([[px, 0.88, 0.38], [px, 0.88, 1.55], [px, 0.65, 2.18], [px, 0.12, 2.28]], 0.14, steel, 16));
    for (const z of [0.55, 1.45]) {
      const flange = cylinder(0.21, 0.21, 0.06, P.iron, px, 0.88, z, 14);
      flange.rotation.x = Math.PI / 2;
      g.add(flange);
    }

    // Vertical riser, pressure gauge, gate valve with handwheel and overhead discharge manifold.
    g.add(curve([[px + 0.22, 1.15, 0.18], [px + 0.22, 1.95, 0.18], [px + 0.22, 2.18, -0.55], [px + 0.22, 2.18, -1.65]], 0.13, steel, 16));
    const valveY = 1.62;
    g.add(cylinder(0.22, 0.22, 0.18, P.iron, px + 0.22, valveY, 0.18, 14));
    g.add(tube([px + 0.22, valveY, 0.18], [px + 0.22, valveY, 0.52], 0.028, steel));
    const wheelRing = ring(0.24, 0.03, idx ? teal : rust, px + 0.22, valveY, 0.52);
    g.add(wheelRing);
    for (const a of [0, Math.PI / 2]) {
      const spoke = box(0.46, 0.028, 0.028, idx ? teal : rust, px + 0.22, valveY, 0.52);
      spoke.rotation.z = a;
      g.add(spoke);
    }
    // Brass pressure gauge on top of the discharge elbow.
    g.add(tube([px + 0.22, 2.18, -0.15], [px + 0.22, 2.46, -0.15], 0.018, P.brass));
    g.add(cylinder(0.11, 0.11, 0.06, P.brass, px + 0.22, 2.54, -0.15, 16));
    g.children.at(-1).rotation.x = Math.PI / 2;
    g.add(cylinder(0.09, 0.09, 0.065, P.cream, px + 0.22, 2.54, -0.145, 16));
    g.children.at(-1).rotation.x = Math.PI / 2;
  }

  // Main horizontal collector header along the back wall with flange couplings.
  const header = cylinder(0.19, 0.19, 5.6, teal, 0, 2.18, -1.68, 16);
  header.rotation.z = Math.PI / 2;
  g.add(header);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) {
    const fl = cylinder(0.25, 0.25, 0.07, steel, x, 2.18, -1.68, 14);
    fl.rotation.z = Math.PI / 2;
    g.add(fl);
    g.add(box(0.14, 0.96, 0.18, P.iron, x, 1.55, -1.68));
  }

  // Electrical control cabinet with meters and indicator lights on the rear wall.
  g.add(rounded(0.95, 1.25, 0.34, yellow, 0, 1.55, -2.14, 0.03));
  g.add(box(0.78, 1.08, 0.04, P.cream, 0, 1.55, -1.96));
  for (const [i, col] of [0x45a858, 0xe05543, 0xf2be42].entries()) {
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), M(col, { emissive: col, emissiveIntensity: 0.35 }), -0.22 + i * 0.22, 1.88, -1.93));
  }

  const out = paintFinish(g, 'water-pump-station');
  out.userData.assetId = 'water-pump-station';
  return out;
}
