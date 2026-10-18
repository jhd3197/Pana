// Patterned ceramic colonial fountain with octagonal azulejo basin, three glazed tiers and animated jets.
// Ground origin y=0, front +Z. Reuses addWaterMotion from water-details.js.
import * as THREE from 'three';
import { M, mesh, box } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring } from '/engine/models/core/rural-kit.js';
import { addWaterMotion } from '/engine/models/effects/water-details.js';

export function ceramicFountain() {
  const g = new THREE.Group();
  const cobalt = M(0x285d86, { roughness: 0.38 }), turquoise = M(0x36948c, { roughness: 0.4 });
  const marigold = M(0xe8b23e, { roughness: 0.45 }), terracotta = M(0xc45d42, { roughness: 0.65 });
  const cream = M(0xf5e6c5, { roughness: 0.55 }), stone = M(0xdcc9a5, { roughness: 0.88 });
  const waterMat = M(0x45bfc2, { metalness: 0.15, roughness: 0.22 });

  const oct = (rt, rb, h, mat, y) => {
    const m = cylinder(rt, rb, h, mat, 0, y, 0, 8);
    m.rotation.y = Math.PI / 8;
    return m;
  };

  // Stepped octagonal stone plinth and outer ceramic-tiled basin wall.
  g.add(oct(3.35, 3.48, 0.22, stone, 0.11));
  g.add(oct(3.05, 3.15, 0.66, cream, 0.55));
  g.add(oct(3.18, 3.12, 0.12, terracotta, 0.92));
  g.add(oct(2.68, 2.74, 0.52, cobalt, 0.52));
  const pool = oct(2.64, 2.64, 0.06, waterMat, 0.8);
  g.add(pool);

  // Geometric colonial azulejo mosaic friezes on all 8 faces of the basin.
  const faceDist = 3.08 * Math.cos(Math.PI / 8);
  const faceWidth = 2 * 3.08 * Math.sin(Math.PI / 8);
  const tileMats = [cobalt, marigold, turquoise, terracotta];
  for (let side = 0; side < 8; side++) {
    const panel = new THREE.Group();
    panel.rotation.y = side * Math.PI / 4;
    // Framing border and diamond/chevron ceramic tiles.
    panel.add(box(faceWidth - 0.18, 0.44, 0.03, cobalt, 0, 0.56, faceDist));
    const cols = 7;
    for (let i = 0; i < cols; i++) {
      const tx = -faceWidth * 0.36 + i * (faceWidth * 0.72 / (cols - 1));
      const diamond = box(0.18, 0.18, 0.045, tileMats[(i + side) % 4], tx, 0.56, faceDist + 0.01);
      diamond.rotation.z = Math.PI / 4;
      panel.add(diamond);
      panel.add(box(0.08, 0.08, 0.055, cream, tx, 0.56, faceDist + 0.015));
      for (const dy of [-0.15, 0.15]) {
        panel.add(box(0.22, 0.05, 0.04, i % 2 ? marigold : turquoise, tx, 0.56 + dy, faceDist + 0.008));
      }
    }
    // Corner ceramic colonnettes and finials around the coping.
    const cornerX = faceWidth / 2;
    panel.add(rounded(0.22, 0.72, 0.22, terracotta, cornerX, 0.58, faceDist - 0.04, 0.04));
    panel.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), marigold, cornerX, 1.04, faceDist - 0.04));
    g.add(panel);
  }

  // Patterned central pedestal with three tiered ceramic bowls and brass spouts.
  g.add(oct(0.95, 1.15, 0.55, terracotta, 1.05));
  const colProfile = [
    [0, 0], [0.78, 0], [0.82, 0.14], [0.58, 0.32], [0.52, 0.95], [0.72, 1.18],
    [1.62, 1.38], [1.68, 1.52], [1.46, 1.56], [0.46, 1.58], [0.38, 2.25],
    [0.54, 2.42], [1.05, 2.58], [1.1, 2.7], [0.92, 2.74], [0.28, 2.76],
    [0.24, 3.22], [0.44, 3.42], [0.16, 3.72], [0, 3.85],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(colProfile, 24), cream, 0, 1.25, 0));

  // Glazed ceramic bands, scalloped bowl rims and upper water disks.
  for (const [r, y, mat] of [[0.56, 1.85, cobalt], [0.55, 2.08, marigold], [0.41, 3.18, turquoise], [0.39, 3.35, cobalt]]) {
    const band = ring(r, 0.055, mat, 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  g.add(cylinder(1.52, 1.48, 0.04, waterMat, 0, 2.76, 0, 24));
  g.add(cylinder(0.96, 0.92, 0.04, waterMat, 0, 3.94, 0, 24));

  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const tileMid = box(0.24, 0.12, 0.05, i % 2 ? cobalt : marigold, Math.sin(a) * 1.64, 2.7, Math.cos(a) * 1.64);
    tileMid.rotation.y = a;
    g.add(tileMid);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const tileTop = box(0.18, 0.1, 0.045, i % 2 ? turquoise : terracotta, Math.sin(a) * 1.06, 3.88, Math.cos(a) * 1.06);
    tileTop.rotation.y = a;
    g.add(tileTop);
  }
  // Glazed pineapple finial at the crown.
  const crown = mesh(new THREE.SphereGeometry(0.26, 14, 12), marigold, 0, 4.92, 0);
  crown.scale.set(0.85, 1.35, 0.85);
  g.add(crown);
  g.add(ring(0.2, 0.04, turquoise, 0, 4.65, 0));
  g.children.at(-1).rotation.x = Math.PI / 2;

  // Brass spout nozzles and arching translucent water streams.
  const jetMat = M(0x93e8e4, { transparent: true, opacity: 0.72, depthWrite: false });
  const curves = [], impacts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    // Brass spout on middle bowl rim.
    const spout = cylinder(0.035, 0.05, 0.18, P.brass, c * 1.62, 2.68, s * 1.62, 8);
    spout.rotation.z = -c * 1.2;
    spout.rotation.x = s * 1.2;
    g.add(spout);

    const lowerArc = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(c * 1.64, 2.68, s * 1.64),
      new THREE.Vector3(c * 2.22, 2.38, s * 2.22),
      new THREE.Vector3(c * 2.35, 0.83, s * 2.35),
    );
    curves.push(lowerArc);
    impacts.push([c * 2.35, 0.84, s * 2.35, 0.22]);
    g.add(mesh(new THREE.TubeGeometry(lowerArc, 12, 0.038, 5, false), jetMat));

    if (i % 2 === 0) {
      const upperArc = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(c * 1.02, 3.88, s * 1.02),
        new THREE.Vector3(c * 1.38, 3.68, s * 1.38),
        new THREE.Vector3(c * 1.42, 2.78, s * 1.42),
      );
      curves.push(upperArc);
      impacts.push([c * 1.42, 2.79, s * 1.42, 0.14]);
      g.add(mesh(new THREE.TubeGeometry(upperArc, 10, 0.03, 5, false), jetMat));
    }
  }

  const out = paintFinish(g, 'ceramic-fountain');
  out.userData.assetId = 'ceramic-fountain';
  out.userData.tick = addWaterMotion(out, impacts, curves);
  return out;
}
