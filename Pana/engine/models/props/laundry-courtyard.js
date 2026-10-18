// Residential courtyard with concrete washbasin (batea), flowerpots and hanging laundry on lines.
// Ground origin y=0, front +Z. Reuses bush from vegetation/bush.js.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, curve, archFrame, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring } from '/engine/models/core/rural-kit.js';
import { bush } from '../vegetation/bush.js';

function garmentMesh(w, h, color, x, y, z, rotY, wave = 0.07) {
  const geo = new THREE.PlaneGeometry(w, h, 4, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    const drop = (h / 2 - py) / h;
    pos.setZ(i, Math.sin(px * 4.5 + drop * 3.2) * wave * drop + drop * drop * 0.06);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, M(color, { side: THREE.DoubleSide, roughness: 0.92 }), x, y - h / 2, z);
  m.rotation.y = rotY;
  return m;
}

export function laundryCourtyard() {
  const g = new THREE.Group();
  const ochre = M(0xe2b365, { roughness: 0.95 }), plaster = M(0xf3e4c4, { roughness: 0.95 });
  const terracotta = M(0xc26446, { roughness: 0.9 }), teal = M(0x3a8b86, { roughness: 0.85 });
  const rope = M(0xc8b58b, { roughness: 1 }), water = M(0x52c2c6, { roughness: 0.25 });

  // Courtyard paving slab with warm terracotta border and stone flagstone grid.
  g.add(rounded(7.6, 0.16, 6.2, terracotta, 0, 0.08, 0, 0.04));
  g.add(box(7.1, 0.04, 5.7, P.cream, 0, 0.17, 0));
  for (let x = -3.0; x <= 3.0; x += 1.2) for (let z = -2.2; z <= 2.2; z += 1.1) {
    g.add(box(1.08, 0.02, 0.98, M((Math.round(x + z) % 2) ? 0xdcc69e : 0xe7d4ae), x, 0.195, z));
  }

  // Whitewashed & ochre perimeter walls along the back (-Z) and left/right wings, with clay tile coping.
  g.add(rounded(7.4, 2.35, 0.26, plaster, 0, 1.32, -2.85, 0.04));
  g.add(box(7.44, 0.55, 0.28, ochre, 0, 0.44, -2.85));
  g.add(box(7.56, 0.12, 0.38, terracotta, 0, 2.54, -2.85));

  for (const side of [-1, 1]) {
    g.add(rounded(0.26, 1.85, 3.8, plaster, side * 3.57, 1.08, -1.05, 0.04));
    g.add(box(0.28, 0.5, 3.84, ochre, side * 3.57, 0.41, -1.05));
    g.add(box(0.38, 0.11, 3.92, terracotta, side * 3.57, 2.04, -1.05));
    // Front corner pier with arched decorative niche and flowerpots.
    g.add(rounded(0.46, 1.45, 0.46, ochre, side * 3.52, 0.88, 1.05, 0.04));
    g.add(rounded(0.54, 0.12, 0.54, terracotta, side * 3.52, 1.64, 1.05, 0.03));
  }
  g.add(archFrame(1.25, 1.95, 0.14, terracotta, -2.1, 0.18, -2.72));

  // Traditional Venezuelan concrete washbasin (batea de lavar) with water tub, scrub board and brass tap.
  const batea = new THREE.Group();
  batea.position.set(1.85, 0.18, -2.15);
  for (const x of [-0.72, 0.72]) g.add(box(0.18, 0.74, 0.76, P.stone, 1.85 + x, 0.55, -2.15));
  batea.add(rounded(1.76, 0.44, 0.92, P.stone, 0, 0.86, 0, 0.04));
  batea.add(box(0.74, 0.06, 0.74, water, -0.4, 1.05, 0));
  // Slanted corrugated scrub board on the right half of the batea.
  const scrub = new THREE.Group();
  scrub.position.set(0.38, 0.98, 0);
  scrub.rotation.z = 0.22;
  scrub.add(box(0.72, 0.06, 0.76, P.stone, 0, 0, 0));
  for (let i = -4; i <= 4; i++) scrub.add(box(0.035, 0.025, 0.68, P.cream, i * 0.07, 0.04, 0));
  batea.add(scrub);
  // Brass water pipe, faucet and pink/blue laundry soap bars.
  batea.add(curve([[0, 1.1, -0.48], [0, 1.38, -0.48], [0, 1.42, -0.26], [0, 1.32, -0.22]], 0.025, P.brass, 10));
  batea.add(rounded(0.14, 0.05, 0.09, M(0x4798b5), 0.02, 1.11, -0.34, 0.015));
  batea.add(rounded(0.12, 0.045, 0.08, M(0xe67c8c), 0.22, 1.11, -0.34, 0.015));
  g.add(batea);

  // Laundry baskets and plastic wash tub on the courtyard floor.
  for (const [bx, bz, col, r] of [[-2.45, 1.25, 0x3b929b, 0.38], [2.35, 0.85, 0xd86951, 0.34]]) {
    g.add(cylinder(r, r * 0.76, 0.42, M(col, { roughness: 0.65 }), bx, 0.39, bz, 16));
    const rim = ring(r, 0.024, M(col), bx, 0.6, bz);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    // Folded/heaped clothes inside the basket.
    g.add(mesh(new THREE.SphereGeometry(r * 0.78, 12, 8), M(0xf7edd4), bx, 0.56, bz));
    g.children.at(-1).scale.y = 0.45;
  }

  // Flowering clay pots along the courtyard corners.
  for (const [i, [px, pz, s]] of [[-2.85, -2.15, 31], [0.25, -2.25, 35], [-2.95, 1.85, 39], [2.95, 1.85, 43]].entries()) {
    g.add(cylinder(0.28, 0.2, 0.42, terracotta, px, 0.39, pz, 12));
    if (i >= 2) {
      const plant = bush({ seed: s, flowers: true });
      plant.scale.setScalar(0.38);
      plant.position.set(px, 0.6, pz);
      g.add(plant);
    } else {
      const crown = mesh(new THREE.SphereGeometry(0.28, 9, 7), M(0x649c40), px, 0.72, pz);
      crown.scale.set(1.1, 0.85, 1.1);
      g.add(crown);
    }
  }

  // Four wooden clothesline T-posts and three sagging clotheslines loaded with colorful garments.
  const poles = [[-2.85, -1.25], [2.85, -1.25], [-2.85, 1.15], [2.85, 1.15]];
  for (const [px, pz] of poles) {
    g.add(cylinder(0.065, 0.08, 2.65, P.wood, px, 1.5, pz, 10));
    g.add(box(0.68, 0.08, 0.08, P.wood, px, 2.76, pz));
    g.children.at(-1).rotation.y = Math.PI / 2;
  }

  const lines = [
    { z0: -1.45, z1: -1.05, items: [
      { u: 0.16, w: 0.72, h: 0.92, col: 0xe3644b, sleeves: true },
      { u: 0.36, w: 0.88, h: 1.18, col: 0xf7eed7, sleeves: false },
      { u: 0.58, w: 0.64, h: 0.98, col: 0x3b9490, pants: true },
      { u: 0.80, w: 0.74, h: 0.86, col: 0xf0be46, sleeves: true },
    ]},
    { z0: -0.1, z1: 0.15, items: [
      { u: 0.18, w: 0.95, h: 1.24, col: 0x62aed1, sleeves: false },
      { u: 0.44, w: 0.68, h: 0.88, col: 0xe57a89, sleeves: true },
      { u: 0.66, w: 0.58, h: 0.78, col: 0xf6ebd2, sleeves: false },
      { u: 0.84, w: 0.66, h: 0.96, col: 0x457d63, pants: true },
    ]},
    { z0: 1.15, z1: 1.15, items: [
      { u: 0.22, w: 0.76, h: 0.9, col: 0xf2c14e, sleeves: true },
      { u: 0.50, w: 1.05, h: 1.28, col: 0xf9f3e3, stripe: 0x3a8b86 },
      { u: 0.78, w: 0.70, h: 0.88, col: 0xd95f49, sleeves: true },
    ]},
  ];

  for (const { z0, z1, items } of lines) {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const u = i / 8, x = -2.85 + u * 5.7, z = z0 + (z1 - z0) * u;
      const y = 2.68 - Math.sin(u * Math.PI) * 0.24;
      return [x, y, z];
    });
    g.add(curve(pts, 0.012, rope, 20));
    const rotY = Math.atan2(z0 - z1, 5.7);

    for (const item of items) {
      const x = -2.85 + item.u * 5.7, z = z0 + (z1 - z0) * item.u;
      const y = 2.68 - Math.sin(item.u * Math.PI) * 0.24;
      if (item.pants) {
        g.add(box(item.w, 0.22, 0.03, M(item.col), x, y - 0.11, z));
        for (const s of [-1, 1]) {
          g.add(garmentMesh(item.w * 0.42, item.h - 0.2, item.col, x + s * item.w * 0.24, y - 0.2, z, rotY));
        }
      } else {
        g.add(garmentMesh(item.w, item.h, item.col, x, y, z, rotY));
        if (item.sleeves) {
          for (const s of [-1, 1]) {
            const sleeve = box(0.24, 0.34, 0.03, M(item.col, { side: THREE.DoubleSide }), x + s * (item.w * 0.56), y - 0.18, z);
            sleeve.rotation.z = s * 0.42;
            sleeve.rotation.y = rotY;
            g.add(sleeve);
          }
        }
        if (item.stripe) {
          g.add(box(item.w * 0.96, 0.12, 0.035, M(item.stripe), x, y - item.h + 0.18, z + 0.03));
        }
      }
      // Two wooden clothespins clipping each garment to the line.
      for (const s of [-1, 1]) {
        g.add(box(0.03, 0.09, 0.035, P.wood, x + s * item.w * 0.34, y + 0.02, z));
      }
    }
  }

  const out = paintFinish(g, 'laundry-courtyard');
  out.userData.assetId = 'laundry-courtyard';
  return out;
}
