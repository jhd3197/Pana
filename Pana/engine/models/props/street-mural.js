// Urban street-mural wall combining Venezuelan kinetic relief fins, tropical painted canvas,
// gallery lamps and a planted brick curb. Ground origin y=0, front +Z.
import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring } from '/engine/models/core/rural-kit.js';
import { bush } from '../vegetation/bush.js';

function muralCanvas(w, h) {
  const mat = canvasMat(1024, 512, ctx => {
    // Warm tropical sky and sunset rays.
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0, '#1e5e68');
    grad.addColorStop(0.48, '#38968f');
    grad.addColorStop(1, '#e89d49');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Bold diagonal Venezuelan kinetic stripes and sun bursts.
    const rayColors = ['#f4c245', '#df5d46', '#f7e9c6', '#2c7a7b', '#e8833a'];
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = rayColors[i % rayColors.length];
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(512, 230);
      const a0 = (i / 14) * Math.PI * 2, a1 = a0 + 0.14;
      ctx.lineTo(512 + Math.cos(a0) * 700, 230 + Math.sin(a0) * 700);
      ctx.lineTo(512 + Math.cos(a1) * 700, 230 + Math.sin(a1) * 700);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Layered coastal mountains and rolling waves along the bottom.
    for (const [yBase, amp, col] of [[350, 55, '#244b52'], [395, 38, '#2d716c'], [440, 24, '#e0674c'], [475, 16, '#f3c14b']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (let x = 0; x <= 1024; x += 32) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.012 + yBase) * amp);
      }
      ctx.lineTo(1024, 512);
      ctx.closePath();
      ctx.fill();
    }

    // Golden sun halo and stylized macaw wings on both sides.
    ctx.fillStyle = '#ffd154';
    ctx.beginPath();
    ctx.arc(512, 225, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f9eed2';
    ctx.stroke();

    // Bold street-art typography across the upper ribbon.
    ctx.font = '900 72px "Luckiest Guy", Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#182d30';
    ctx.fillStyle = '#fff4d4';
    ctx.strokeText('¡VIVA PANA!', 512, 86);
    ctx.fillText('VIVA PANA!', 512, 86);

    ctx.font = '800 32px Nunito, sans-serif';
    ctx.fillStyle = '#ffd154';
    ctx.strokeText('ARTE · PLAYA · CARRERA', 512, 468);
    ctx.fillText('ARTE · PLAYA · CARRERA', 512, 468);
  });
  mat.transparent = false;
  return mesh(new THREE.PlaneGeometry(w, h), mat);
}

export function streetMural() {
  const g = new THREE.Group();
  const terracotta = M(0xc45e43, { roughness: 0.9 }), cream = M(0xf2e2bf, { roughness: 0.9 });
  const teal = M(0x328380, { roughness: 0.8 }), yellow = M(0xebb844, { roughness: 0.75 });
  const coral = M(0xe0644c, { roughness: 0.8 }), navy = M(0x21444b, { roughness: 0.8 });
  const lampGlow = M(0xffe5a3, { emissive: 0xffba49, emissiveIntensity: 0.45 });

  // Stone sidewalk apron, low brick planter box and flowering tropical shrubs.
  g.add(rounded(8.6, 0.18, 1.85, P.stone, 0, 0.09, 0.12, 0.04));
  g.add(rounded(8.2, 0.56, 0.55, terracotta, 0, 0.44, -0.1, 0.04));
  g.add(rounded(7.2, 0.36, 0.52, terracotta, 0, 0.36, 0.48, 0.04));
  g.add(box(7.32, 0.07, 0.58, cream, 0, 0.56, 0.48));
  for (const side of [-1, 1]) {
    const fl = bush({ seed: 80 + side, flowers: true });
    fl.scale.set(0.56, 0.42, 0.38);
    fl.position.set(side * 2.55, 0.58, 0.48);
    g.add(fl);
  }
  for (let i = -2; i <= 2; i++) {
    const shrub = mesh(new THREE.SphereGeometry(0.26, 8, 6), M(i % 2 ? 0x5c963c : 0x76ad49), i * 0.85, 0.68, 0.48);
    shrub.scale.set(1.35, 0.72, 0.85);
    g.add(shrub);
  }

  // Main architectural wall, end pilasters and clay-tile coping crest.
  g.add(rounded(7.8, 3.65, 0.34, cream, 0, 2.18, -0.12, 0.04));
  for (const side of [-1, 1]) {
    g.add(rounded(0.56, 3.95, 0.54, teal, side * 3.88, 2.15, -0.12, 0.04));
    g.add(rounded(0.68, 0.18, 0.66, cream, side * 3.88, 4.18, -0.12, 0.03));
  }
  g.add(rounded(8.4, 0.18, 0.58, terracotta, 0, 4.08, -0.12, 0.04));
  for (let x = -3.9; x <= 3.9; x += 0.38) {
    const tile = cylinder(0.13, 0.13, 0.62, terracotta, x, 4.2, -0.12, 8);
    tile.rotation.x = Math.PI / 2;
    g.add(tile);
  }

  // Painted mural canvas mounted in the recessed center bay (+Z and -Z faces).
  const frontArtwork = muralCanvas(6.95, 3.12);
  frontArtwork.position.set(0, 2.34, 0.06);
  g.add(frontArtwork);
  const backArtwork = muralCanvas(6.95, 3.12);
  backArtwork.position.set(0, 2.34, -0.3);
  backArtwork.rotation.y = Math.PI;
  g.add(backArtwork);

  // Sculpted 3D kinetic louver fins (Soto / Cruz-Diez homage) on left and right flanks,
  // plus a 3D sculpted capybara-and-sun medallion in the center.
  const finColors = [yellow, coral, teal, cream, navy];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const fx = side * (1.75 + i * 0.19);
      const fin = box(0.035, 2.65 - (i % 3) * 0.18, 0.14, finColors[(i + (side > 0 ? 2 : 0)) % finColors.length], fx, 2.32, 0.12);
      fin.rotation.y = side * 0.32;
      g.add(fin);
    }
  }
  // 3D relief emblem in the center of the mural.
  g.add(cylinder(0.62, 0.62, 0.06, yellow, 0, 2.32, 0.09, 24));
  g.children.at(-1).rotation.x = Math.PI / 2;
  g.add(ring(0.66, 0.035, coral, 0, 2.32, 0.1));
  const head = mesh(new THREE.SphereGeometry(0.32, 14, 10), M(0xc87d32, { roughness: 0.8 }), 0, 2.3, 0.14);
  head.scale.set(1.15, 0.92, 0.55);
  g.add(head);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M(0x9e5d21), s * 0.24, 2.55, 0.14));
    g.add(rounded(0.14, 0.09, 0.05, navy, s * 0.13, 2.36, 0.31, 0.02));
  }
  g.add(box(0.34, 0.03, 0.05, navy, 0, 2.38, 0.31));

  // Three gooseneck gallery lamps along the top cornice + muralist paint buckets at the base.
  for (const lx of [-2.4, 0, 2.4]) {
    g.add(curve([[lx, 3.98, 0.08], [lx, 4.38, 0.35], [lx, 4.32, 0.78], [lx, 4.12, 0.86]], 0.025, P.iron, 12));
    g.add(cylinder(0.06, 0.18, 0.14, P.iron, lx, 4.08, 0.86, 12));
    g.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), lampGlow, lx, 4.01, 0.86));
  }
  for (const [i, col] of [0xebb844, 0xe0644c, 0x328380].entries()) {
    const px = 3.55 + (i % 2) * 0.28, pz = 0.54 + Math.floor(i / 2) * 0.26;
    g.add(cylinder(0.11, 0.1, 0.24, steelMat(), px, 0.3, pz, 12));
    g.add(cylinder(0.095, 0.095, 0.02, M(col), px, 0.42, pz, 10));
  }

  const out = paintFinish(g, 'street-mural');
  out.userData.assetId = 'street-mural';
  return out;
}

function steelMat() {
  return M(0xb8c2bf, { metalness: 0.5, roughness: 0.4 });
}
