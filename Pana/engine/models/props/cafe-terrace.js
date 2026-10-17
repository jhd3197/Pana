// Shaded outdoor café terrace with pergola, bistro tables, seating, espresso counter and planters.
// Ground origin y=0, front +Z. Reuses planter, bush and kitchen food props.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, railing, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring } from '/engine/models/core/rural-kit.js';
import { planter } from './plaza.js';
import { bush } from '../vegetation/bush.js';
import { food } from './kitchen.js';

export function cafeTerrace() {
  const g = new THREE.Group();
  const terracotta = M(0xc86748, { roughness: 0.9 }), sand = M(0xe8d5b0, { roughness: 0.9 });
  const teal = M(0x368682, { roughness: 0.8 }), yellow = M(0xe6b547, { roughness: 0.85 });
  const steel = M(0xc2cac7, { metalness: 0.55, roughness: 0.35 }), porcelain = M(0xf8f3e6, { roughness: 0.4 });
  const coffee = M(0x42281a, { roughness: 0.5 });

  // Raised patio deck with alternating checkerboard terracotta and cream tiles.
  g.add(rounded(8.4, 0.16, 5.8, P.stone, 0, 0.08, 0, 0.04));
  for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 7; iz++) {
    const tx = -3.6 + ix * 0.8, tz = -2.4 + iz * 0.8;
    g.add(box(0.76, 0.04, 0.76, (ix + iz) % 2 ? terracotta : sand, tx, 0.17, tz));
  }

  // Wrought-iron perimeter railings with open front entrance (+Z) and corner planters.
  railing(g, [-4.0, 0.16, -2.7], [4.0, 0.16, -2.7], { height: 0.88, material: P.iron, spacing: 0.55 });
  for (const side of [-1, 1]) {
    railing(g, [side * 4.0, 0.16, -2.7], [side * 4.0, 0.16, 2.7], { height: 0.88, material: P.iron, spacing: 0.55 });
    railing(g, [side * 4.0, 0.16, 2.7], [side * 1.4, 0.16, 2.7], { height: 0.88, material: P.iron, spacing: 0.55 });
  }
  const pot = planter({ seed: 11 });
  pot.scale.setScalar(0.78);
  pot.position.set(-1.12, 0.16, 2.52);
  g.add(pot);
  g.add(cylinder(0.46, 0.34, 0.68, terracotta, 1.12, 0.5, 2.52, 10));
  const rightPlant = bush({ seed: 25, flowers: true });
  rightPlant.scale.setScalar(0.45);
  rightPlant.position.set(1.12, 0.84, 2.52);
  g.add(rightPlant);

  for (const side of [-1, 1]) {
    g.add(rounded(1.5, 0.42, 0.46, terracotta, side * 2.7, 0.37, 2.48, 0.04));
    for (const dx of [-0.38, 0, 0.38]) {
      const hedge = mesh(new THREE.SphereGeometry(0.24, 8, 6), M(dx === 0 ? 0x70a846 : 0x568e38), side * 2.7 + dx, 0.68, 2.48);
      hedge.scale.set(1.15, 0.85, 0.9);
      g.add(hedge);
    }
  }

  // Rear timber pergola with striped canvas shade and warm festoon bulbs.
  for (const x of [-3.8, 0, 3.8]) for (const z of [-2.55, -0.35]) {
    g.add(box(0.16, 3.05, 0.16, P.timber, x, 1.68, z));
    g.add(box(0.28, 0.18, 0.28, P.cream, x, 0.25, z));
  }
  for (const z of [-2.55, -0.35]) g.add(box(8.0, 0.16, 0.16, P.timber, 0, 3.2, z));
  for (let i = 0; i < 13; i++) {
    const x = -3.84 + i * 0.64;
    g.add(box(0.09, 0.12, 2.55, P.wood, x, 3.32, -1.45));
    if (i < 12) {
      const cloth = M(i % 2 ? 0x368682 : 0xf4e4c1, { side: THREE.DoubleSide, roughness: 0.9 });
      const strip = box(0.62, 0.05, 2.48, cloth, x + 0.32, 3.39, -1.45);
      strip.rotation.x = 0.05;
      g.add(strip);
    }
  }
  const title = sign(['CAFÉ DE LA PLAZA', 'guayoyo · marrón · tequeños'], 3.6, 0.55, { background: '#264d4a', color: '#f9e7bd' });
  title.position.set(0, 3.45, -0.22);
  g.add(title);

  // Rear coffee bar counter with brass-and-steel two-group espresso machine and pastries.
  g.add(rounded(3.2, 0.98, 0.86, teal, -1.85, 0.65, -1.75, 0.05));
  g.add(rounded(3.36, 0.1, 0.98, P.wood, -1.85, 1.18, -1.75, 0.03));
  for (let i = 0; i < 6; i++) g.add(box(0.42, 0.72, 0.04, P.cream, -3.1 + i * 0.5, 0.65, -1.31));
  // Espresso machine & bean grinder.
  g.add(rounded(0.76, 0.44, 0.46, steel, -2.55, 1.44, -1.78, 0.04));
  g.add(rounded(0.78, 0.08, 0.48, P.brass, -2.55, 1.68, -1.78, 0.02));
  for (const dx of [-0.18, 0.18]) {
    g.add(cylinder(0.06, 0.05, 0.08, P.brass, -2.55 + dx, 1.38, -1.52, 12));
    g.add(tube([-2.55 + dx, 1.37, -1.5], [-2.55 + dx, 1.33, -1.36], 0.014, P.timber));
  }
  g.add(cylinder(0.11, 0.13, 0.28, P.iron, -1.85, 1.36, -1.78, 12));
  g.add(cylinder(0.14, 0.07, 0.24, M(0xd8efe8, { transparent: true, opacity: 0.65 }), -1.85, 1.62, -1.78, 12));
  const counterPlate = food('tequenos');
  counterPlate.scale.setScalar(0.32);
  counterPlate.position.set(-0.85, 1.24, -1.68);
  g.add(counterPlate);

  // Three round café tables with bentwood chairs, cups and umbrellas on the front terrace.
  const bistroSet = (tx, tz, hasUmbrella, umbrellaColor, snackKind) => {
    const set = new THREE.Group();
    set.position.set(tx, 0.18, tz);
    // Pedestal base and marble-topped round table.
    set.add(cylinder(0.32, 0.36, 0.07, P.iron, 0, 0.035, 0, 14));
    set.add(cylinder(0.055, 0.065, 0.72, P.iron, 0, 0.38, 0, 10));
    set.add(cylinder(0.66, 0.66, 0.06, P.cream, 0, 0.75, 0, 20));
    const rim = mesh(new THREE.TorusGeometry(0.66, 0.024, 5, 20), P.brass, 0, 0.75, 0);
    rim.rotation.x = Math.PI / 2;
    set.add(rim);

    // Coffee cups on saucers + shared Venezuelan snack plate.
    for (const [cx, cz] of [[-0.24, 0.16], [0.24, -0.18]]) {
      set.add(cylinder(0.095, 0.07, 0.02, porcelain, cx, 0.79, cz, 10));
      set.add(cylinder(0.058, 0.046, 0.085, porcelain, cx, 0.835, cz, 10));
      set.add(cylinder(0.048, 0.048, 0.01, coffee, cx, 0.875, cz, 10));
    }
    const snack = food(snackKind);
    snack.scale.setScalar(0.28);
    snack.position.set(0.02, 0.78, 0.18);
    set.add(snack);

    // Three café chairs around each table.
    for (let i = 0; i < 3; i++) {
      const a = i * (Math.PI * 2 / 3) + 0.35;
      const chair = new THREE.Group();
      chair.position.set(Math.sin(a) * 0.94, 0, Math.cos(a) * 0.94);
      chair.rotation.y = a + Math.PI;
      chair.add(cylinder(0.23, 0.23, 0.05, P.wood, 0, 0.45, 0, 12));
      for (const lx of [-0.15, 0.15]) for (const lz of [-0.15, 0.15]) {
        chair.add(tube([lx, 0.01, lz], [lx * 0.88, 0.45, lz * 0.88], 0.018, P.iron));
      }
      chair.add(curve([[-0.19, 0.46, -0.14], [-0.21, 0.86, -0.19], [0, 0.94, -0.21], [0.21, 0.86, -0.19], [0.19, 0.46, -0.14]], 0.02, P.iron, 8));
      chair.add(box(0.32, 0.18, 0.04, P.wood, 0, 0.76, -0.19));
      set.add(chair);
    }

    if (hasUmbrella) {
      set.add(cylinder(0.03, 0.035, 2.25, P.wood, 0, 1.14, 0, 10));
      const dome = new THREE.SphereGeometry(1.38, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
      dome.scale(1, 0.42, 1);
      set.add(mesh(dome, M(umbrellaColor, { side: THREE.DoubleSide, roughness: 0.85 }), 0, 1.98, 0));
      set.add(cylinder(0.02, 0.08, 0.14, P.brass, 0, 2.32, 0, 10));
    }
    g.add(set);
  };

  bistroSet(-2.25, 0.95, true, 0xd8654c, 'arepa');
  bistroSet(0.25, 1.1, false, 0x368682, 'cachapa');
  bistroSet(2.45, 0.75, true, 0xe6b547, 'tequenos');

  // Sidewalk A-frame chalkboard menu by the front entrance.
  const easel = new THREE.Group();
  easel.position.set(1.55, 0.18, 2.15);
  easel.rotation.y = -0.35;
  for (const s of [-1, 1]) {
    const board = box(0.68, 0.95, 0.04, P.wood, 0, 0.52, s * 0.18);
    board.rotation.x = -s * 0.18;
    easel.add(board);
  }
  const menu = sign(['HOY EN EL CAFÉ', 'Guayoyo · Cachapa'], 0.56, 0.68, { background: '#253939', color: '#f9e7bd' });
  menu.position.set(0, 0.56, 0.21);
  menu.rotation.x = -0.18;
  easel.add(menu);
  g.add(easel);

  const out = paintFinish(g, 'cafe-terrace');
  out.userData.assetId = 'cafe-terrace';
  return out;
}
