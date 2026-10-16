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
    const [top, bottom] = lines;
    ctx.font = '96px "Luckiest Guy", system-ui, sans-serif';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#16161a';
    if (lines.length > 2) {
      const size = Math.min(72, 230 / lines.length);
      ctx.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      ctx.lineWidth = size / 7;
      lines.forEach((line, i) => {
        const y = 128 + (i - (lines.length - 1) / 2) * size * 1.05;
        ctx.fillStyle = i === lines.length - 1 ? '#ffd23f' : '#fdf6e3';
        ctx.strokeText(line, 256, y);
        ctx.fillText(line, 256, y);
      });
    } else if (bottom) {
      ctx.fillStyle = '#fdf6e3';
      ctx.strokeText(top, 256, 82);
      ctx.fillText(top, 256, 82);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText(bottom, 256, 180);
      ctx.fillText(bottom, 256, 180);
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText(top, 256, 136);
      ctx.fillText(top, 256, 136);
    }
  });
  const board = mesh(new THREE.BoxGeometry(w, h, 0.3), panel, 0, h / 2 + 1.1, 0.1);
  g.add(board);
  return g;
}
