import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '/engine/models/core/primitives.js';

export function woodSign(lines, { w = 9, h = 4.4 } = {}) {
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.9 });
  g.add(box(0.5, h + 1.6, 0.5, wood, -w / 2 + 0.6, (h + 1.6) / 2, 0));
  g.add(box(0.5, h + 1.6, 0.5, wood, w / 2 - 0.6, (h + 1.6) / 2, 0));
  const panel = canvasMat(512, 256, (ctx) => {
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
  });
  const board = mesh(new THREE.BoxGeometry(w, h, 0.3), panel, 0, h / 2 + 1.1, 0.1);
  g.add(board);
  let disposed=false;
  g.userData.dispose=()=>{if(disposed)return;disposed=true;panel.map.dispose();panel.dispose();};
  return g;
}
