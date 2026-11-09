import * as THREE from 'three';
import { curve, ellipsoid, mesh, surface, signedPower } from '/engine/models/characters/pana/geometry.js';
import { clothFront } from '/engine/models/characters/pana/cloth-front.js';

// Prototype costume layers (samurai, inframundo). They only add pieces over
// the shared body: head, face, fur, rig and proportions stay untouched.
export function createCostumeDetails({ head, arms, material, texture, tops, headDimensions, foundation }) {
  const lacquer = material('Samurai lacquer plates', '#a9271f', { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0, side: THREE.DoubleSide });
  const lacing = material('Samurai gold lacing', '#f2b51c', { roughness: 0.6, sheen: 0 });
  const sashCloth = material('Samurai sash', '#fff3d6', { roughness: 0.92, bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });
  const helmetMat = material('Samurai helmet bowl', '#232a44', { roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0, side: THREE.DoubleSide });
  const hoodCloth = material('Inframundo hood', '#2a2233', { roughness: 0.94, bumpMap: texture, bumpScale: 0.004, side: THREE.DoubleSide });
  const bone = material('Inframundo ivory bone', '#efe4c8', { roughness: 0.55, sheen: 0 });

  // Bands that hug the torso: each ring point starts inside and is pushed out
  // onto the fur surface plus a clearance, so plates follow the real body.
  const fitted = (u, y, clearance, flare = 0) => {
    const a = u * Math.PI * 2, p = new THREE.Vector3(Math.cos(a) * 0.45, y, Math.sin(a) * 0.3);
    // fitPoint moves at most 0.25 per call; repeat until it reaches the surface.
    for (let k = 0; k < 4; k++) foundation.fitPoint(p, clearance);
    const r = Math.hypot(p.x, p.z) || 1;
    p.x += p.x / r * flare; p.z += p.z / r * flare;
    return p.toArray();
  };
  const band = (parent, name, y0, y1, clearance, mat, { flare = [0, 0], skip = null } = {}) => {
    const geometry = surface((u, v) => fitted(u, THREE.MathUtils.lerp(y1, y0, v), clearance, THREE.MathUtils.lerp(flare[0], flare[1], v)), 72, 6);
    if (skip) {
      const keep = [], idx = geometry.index.array;
      for (let row = 0; row < 6; row++) for (let col = 0; col < 72; col++) {
        if (skip((col + 0.5) / 72)) continue;
        const s = (row * 72 + col) * 6; for (let k = 0; k < 6; k++) keep.push(idx[s + k]);
      }
      geometry.setIndex(keep);
    }
    return mesh(parent, name, geometry, mat);
  };

  // --- Samurai: compact lamellar do, kusazuri skirt, sode, sash, kabuto.
  const samurai = tops.samurai.group;
  const rows = [[1.20, 1.30], [1.31, 1.41], [1.42, 1.52]];
  rows.forEach(([y0, y1], i) => {
    band(samurai, 'Lamellar chest row', y0, y1, 0.075 + i * 0.004, lacquer);
    curve(samurai, 'Lamellar lacing', Array.from({ length: 72 }, (_, k) => fitted(k / 72, y0 - 0.004, 0.083 + i * 0.004)), 0.011, lacing, true, 96);
  });
  // Vertical cords break each row into small plates.
  for (let k = 0; k < 18; k++) {
    const u = k / 18;
    curve(samurai, 'Plate cord', [fitted(u, 1.205, 0.09), fitted(u, 1.36, 0.093), fitted(u, 1.515, 0.096)], 0.006, lacing, false, 12);
  }
  // Sash between chest and skirt, knotted on the right hip.
  band(samurai, 'Samurai sash', 1.06, 1.18, 0.07, sashCloth);
  const knot = fitted(0.06, 1.12, 0.1);
  ellipsoid(samurai, 'Sash knot', sashCloth, knot, [0.07, 0.06, 0.05], 1, 20);
  curve(samurai, 'Sash tail', [knot, [knot[0] + 0.03, 1.0, knot[2] + 0.02], [knot[0] + 0.05, 0.9, knot[2]]], 0.025, sashCloth, false, 16);
  // Four skirt panels with gaps at the hips so the legs keep moving.
  const gap = u => { const a = u * Math.PI * 2; return Math.abs(Math.cos(a)) > 0.93; };
  band(samurai, 'Kusazuri skirt upper', 0.93, 1.05, 0.075, lacquer, { flare: [0.0, 0.03], skip: gap });
  band(samurai, 'Kusazuri skirt lower', 0.82, 0.93, 0.08, lacquer, { flare: [0.035, 0.07], skip: gap });
  curve(samurai, 'Skirt lacing', Array.from({ length: 72 }, (_, k) => fitted(k / 72, 0.93, 0.105)), 0.009, lacing, true, 96);
  // Shoulder guards ride the arm bones, outside half only.
  const sode = arms.map((arm, i) => {
    const g = new THREE.Group(); g.name = 'outfit:samurai-sode'; arm.add(g);
    const side = i ? -1 : 1;
    for (const [top, len, r] of [[0.08, 0.17, 0.29], [-0.08, 0.17, 0.31]]) {
      mesh(g, 'Sode plate', surface((u, v) => {
        const a = (u - 0.5) * 2.4, y = top - v * len;
        return [side * Math.cos(a) * r, y, Math.sin(a) * r * 0.95 + 0.025];
      }, 24, 4), lacquer);
      curve(g, 'Sode lacing', Array.from({ length: 13 }, (_, k) => {
        const a = (k / 12 - 0.5) * 2.4; return [side * Math.cos(a) * (r + 0.01), top - len, Math.sin(a) * (r + 0.01) * 0.95 + 0.025];
      }), 0.009, lacing, false, 24);
    }
    return g;
  });
  // Helmet: bowl over the crown, back neck guard, a small gold crest.
  const kabuto = new THREE.Group(); kabuto.name = 'outfit:samurai-kabuto'; head.add(kabuto);
  const headPoint = (a, y, ease) => {
    const d = headDimensions(y);
    return [-signedPower(Math.cos(a), 0.88) * (d.width + ease), y, signedPower(Math.sin(a), 0.88) * (d.depth + ease) + d.z];
  };
  mesh(kabuto, 'Kabuto bowl', surface((u, v) => headPoint(u * Math.PI * 2, 0.80 - v * 0.30, 0.05), 72, 14), helmetMat);
  curve(kabuto, 'Kabuto rim', Array.from({ length: 72 }, (_, k) => headPoint(k / 72 * Math.PI * 2, 0.5, 0.065)), 0.03, lacing, true, 96);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    curve(kabuto, 'Kabuto ridge', Array.from({ length: 8 }, (_, j) => headPoint(a, 0.5 + j / 7 * 0.29, 0.058)), 0.008, helmetMat, false, 16);
  }
  // Neck guard flares out behind; the front stays open for the face.
  mesh(kabuto, 'Shikoro neck guard', surface((u, v) => {
    const a = Math.PI * (1.12 + u * 0.76), y = 0.5 - v * 0.32, p = headPoint(a, 0.5, 0.07 + v * 0.18);
    p[1] = y; return p;
  }, 32, 6), lacquer);
  const crest = new THREE.Shape();
  crest.moveTo(0, 0); crest.quadraticCurveTo(-0.16, 0.10, -0.30, 0.34); crest.quadraticCurveTo(-0.12, 0.18, 0, 0.12);
  crest.quadraticCurveTo(0.12, 0.18, 0.30, 0.34); crest.quadraticCurveTo(0.16, 0.10, 0, 0);
  const crestMesh = mesh(kabuto, 'Kabuto crest', new THREE.ExtrudeGeometry(crest, { depth: 0.02, bevelEnabled: false, curveSegments: 10 }), lacing);
  const front = headPoint(Math.PI / 2, 0.58, 0.07);
  crestMesh.position.set(0, front[1], front[2]); crestMesh.rotation.x = -0.35;
  ellipsoid(kabuto, 'Crest base', lacing, [0, front[1], front[2] + 0.01], [0.05, 0.05, 0.025], 1, 16);

  // --- Inframundo: raised hood around the face, bone ornaments.
  const infra = tops.inframundo.group, infraFront = clothFront(tops.inframundo.garment.geometry);
  const hood = new THREE.Group(); hood.name = 'outfit:inframundo-hood'; head.add(hood);
  const open = y => THREE.MathUtils.lerp(1.5, 0.7, THREE.MathUtils.smoothstep(y, 0.42, 0.78));
  const hoodPoint = (u, y, ease) => {
    const half = open(y), a = Math.PI / 2 + half + u * (Math.PI * 2 - half * 2);
    return headPoint(a, y, ease + 0.08 * THREE.MathUtils.smoothstep(-y, 0.0, 0.6));
  };
  mesh(hood, 'Raised hood', surface((u, v) => hoodPoint(u, 0.84 - v * 1.36, 0.075), 64, 28), hoodCloth);
  curve(hood, 'Hood edge', Array.from({ length: 29 }, (_, k) => {
    const y = 0.84 - Math.abs(k - 14) / 14 * 1.36, side = k < 14 ? 0 : 1; return hoodPoint(side, y, 0.085);
  }), 0.03, hoodCloth, false, 64);
  // Bone necklace beads on the neckline, a crossed-bone clasp and a hood tip.
  for (let k = 0; k < 7; k++) {
    const x = (k - 3) * 0.075, y = 1.63 - (x * x) * 2.2;
    const b = ellipsoid(infra, 'Bone bead', bone, [x, y, infraFront(x, y) + 0.03], [0.022, 0.04, 0.02], 1, 14);
    b.rotation.z = x * 1.4;
  }
  const claspY = 1.38, claspZ = infraFront(0, claspY) + 0.03;
  for (const sign of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0, claspY, claspZ); g.rotation.z = sign * 0.75; infra.add(g);
    mesh(g, 'Crossed bone shaft', new THREE.CapsuleGeometry(0.018, 0.2, 4, 10), bone);
    for (const end of [-1, 1]) for (const off of [-1, 1]) ellipsoid(g, 'Bone knuckle', bone, [off * 0.02, end * 0.115, 0], [0.024, 0.024, 0.022], 1, 12);
  }
  const tip = headPoint(Math.PI * 1.5, 0.2, 0.2);
  ellipsoid(hood, 'Hood bone toggle', bone, [0, -0.32, tip[2] - 0.05], [0.03, 0.05, 0.03], 1, 14);

  const setOutfit = id => { sode.forEach(g => { g.visible = id === 'samurai'; }); };
  const setHeadwear = id => { kabuto.visible = id === 'kabuto'; hood.visible = id === 'hood'; };
  setOutfit(null); setHeadwear('none');
  return {
    kabuto, hood, sode, setOutfit, setHeadwear,
    setHeadwearColor(id, value) { if (id === 'kabuto') helmetMat.color.set(value); if (id === 'hood') hoodCloth.color.set(value); },
  };
}
