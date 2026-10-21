import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '/engine/models/core/primitives.js';
import { letter, rounded, whenFont } from '/engine/models/core/lettering.js';

// woodSign(['LINE', …], { w, h }) or, from Studio, woodSign({ lines, w, h }).
export function woodSign(lines = ['CURVA', 'DEL RÍO'], options = {}) {
  if (!Array.isArray(lines)) { options = lines; lines = options.lines || ['CURVA', 'DEL RÍO']; }
  const { w = 9, h = 4.4 } = options;
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.9 });
  g.add(box(0.5, h + 1.6, 0.5, wood, -w / 2 + 0.6, (h + 1.6) / 2, 0));
  g.add(box(0.5, h + 1.6, 0.5, wood, w / 2 - 0.6, (h + 1.6) / 2, 0));
  const paint = (ctx) => {
    ctx.fillStyle = '#7a4a2b';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#4a2c17';
    ctx.lineWidth = 10;
    for (const y of [8, 90, 172, 248]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#16161a';
    ctx.lineJoin = 'round';
    // Every line is shrunk to fit inside the board's margins, so long names
    // like "Campamento del Río" never run off the edge.
    const rows = lines.filter(Boolean);
    const lineH = Math.min(rows.length > 2 ? 210 / rows.length : 96, 96);
    rows.forEach((line, i) => {
      let size = lineH;
      ctx.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      const width = ctx.measureText(line).width + size / 3.5;
      if (width > 460) size = Math.floor(size * 460 / width);
      ctx.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      ctx.lineWidth = size / 7;
      const y = rows.length === 1 ? 136 : 128 + (i - (rows.length - 1) / 2) * lineH * 1.02;
      ctx.fillStyle = i === rows.length - 1 ? '#ffd23f' : '#fdf6e3';
      ctx.strokeText(line, 256, y);
      ctx.fillText(line, 256, y);
    });
  };
  const panel = canvasMat(512, 256, paint);
  whenFont(panel, paint);
  const board = mesh(new THREE.BoxGeometry(w, h, 0.3), panel, 0, h / 2 + 1.1, 0.1);
  g.add(board);
  let disposed=false;
  g.userData.dispose=()=>{if(disposed)return;disposed=true;panel.map.dispose();panel.dispose();};
  return g;
}

// A painted plank board: lines on a rounded wooden panel with a coloured
// trim (accent). Returns a flat panel w × h (metres) facing +Z, centred.
export function signBoard({ lines = ['¡DALE', 'PANA!'], w = 8, h = 2.2, accent = '#ff4f6d', planks = true, checkers = false } = {}) {
  const rows = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).map(String);
  const W = 1024, H = Math.max(128, Math.min(1024, Math.round(W * h / w)));
  const paint = ctx => {
    ctx.clearRect(0, 0, W, H);
    const edge = Math.max(10, H * .07), r = Math.min(H * .28, 90);
    ctx.fillStyle = '#3a2414'; rounded(ctx, 0, 0, W, H, r); ctx.fill();
    ctx.fillStyle = accent; rounded(ctx, edge * .55, edge * .55, W - edge * 1.1, H - edge * 1.1, r * .85); ctx.fill();
    ctx.fillStyle = '#7a4a2b'; rounded(ctx, edge * 1.25, edge * 1.25, W - edge * 2.5, H - edge * 2.5, r * .7); ctx.fill();
    if (planks) {
      ctx.strokeStyle = 'rgba(58,36,20,.55)'; ctx.lineWidth = Math.max(3, H * .02);
      const n = Math.max(1, Math.round(H / 150));
      for (let i = 1; i <= n; i++) { const y = edge * 1.25 + (H - edge * 2.5) * i / (n + 1); ctx.beginPath(); ctx.moveTo(edge * 1.6, y); ctx.lineTo(W - edge * 1.6, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,236,200,.12)'; rounded(ctx, edge * 1.25, edge * 1.25, W - edge * 2.5, (H - edge * 2.5) * .35, r * .7); ctx.fill();
    }
    let margin = .06;
    if (checkers) {
      // Race-flag blocks at both ends of the board, inside the trim.
      const inner = H - edge * 2.5, cell = inner / 3, cols = Math.max(2, Math.round(W * .14 / cell));
      for (const x0 of [edge * 1.25, W - edge * 1.25 - cols * cell]) for (let i = 0; i < cols; i++) for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#16161a' : '#fbf7ee'; ctx.fillRect(x0 + i * cell, edge * 1.25 + j * cell, cell, cell);
      }
      margin = (edge * 1.4 + cols * cell) / W + .02;
    }
    letter(ctx, rows, W, H, { top: edge * 1.25, bottom: H - edge * 1.25, margin });
  };
  const material = canvasMat(W, H, paint);
  material.transparent = true; material.alphaTest = .5;
  whenFont(material, paint);
  const board = mesh(new THREE.PlaneGeometry(w, h), material);
  board.name = 'sign-board';
  let disposed = false;
  board.userData.dispose = () => { if (disposed) return; disposed = true; material.map.dispose(); material.dispose(); };
  return board;
}

// A free-standing painted banner: the signBoard on two wooden posts, painted
// on both faces. Ground origin, board facing ±Z.
export function signBanner({ lines = ['¡DALE', 'PANA!'], w = 8, h = 2.6, accent = '#ff4f6d', height = 2.2 } = {}) {
  const g = new THREE.Group(), wood = M(0x6b4226, { roughness: 0.9 });
  for (const x of [-w / 2 + .25, w / 2 - .25]) g.add(box(.32, height + h + .3, .32, wood, x, (height + h + .3) / 2, 0));
  for (const face of [1, -1]) {
    const board = signBoard({ lines, w, h, accent }); board.position.set(0, height + h / 2, face * .18); board.rotation.y = face > 0 ? 0 : Math.PI; g.add(board);
  }
  g.add(box(w, h * .92, .3, M(0x5c3a20, { roughness: .9 }), 0, height + h / 2, 0));
  g.userData.dispose = () => g.children.forEach(o => o.userData.dispose?.());
  return g;
}

// Delineador: a roadside post with a coloured band and an amber reflector on
// each face. Ground origin at y=0; the road lies along X.
export function reflectorPost({ body = 0xf6f2e6, band = 0xd9453a, reflector = 0xffb43a } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.05, 8), M(body, { roughness: 0.7 }), 0, 0.525, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.17, 8), M(band, { roughness: 0.6 }), 0, 0.84, 0));
  g.add(mesh(new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), M(body, { roughness: 0.7 }), 0, 1.05, 0));
  const glow = M(reflector, { emissive: reflector, emissiveIntensity: 0.35, roughness: 0.3 });
  for (const x of [-1, 1]) g.add(box(0.03, 0.12, 0.09, glow, x * 0.105, 0.62, 0));
  g.add(box(0.26, 0.05, 0.26, M(0x8d8676, { roughness: 1 }), 0, 0.025, 0));
  g.name = 'reflectorPost';
  return g;
}
