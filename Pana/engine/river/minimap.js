// The river's real shape on a small HUD canvas (Curiara, Lancha), upstream at
// the top: larger z is drawn higher up. The course is drawn once; draw()
// adds the boats each HUD tick and rebuild() swaps in another course.
export function createRiverMinimap(canvas, river) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, base = document.createElement('canvas');
  base.width = W; base.height = H;
  let scale = 1, bx = [0, 0], bz = [0, 0];
  const xy = (x, z) => [W / 2 + (x - (bx[0] + bx[1]) / 2) * scale, H / 2 - (z - (bz[0] + bz[1]) / 2) * scale];
  function rebuild(next) {
    river = next;
    const pts = [...river.main.samples, ...(river.branch?.path.samples || [])];
    bx = [Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x))]; bz = [Math.min(...pts.map(p => p.z)), Math.max(...pts.map(p => p.z))];
    scale = Math.min((W - 20) / (bx[1] - bx[0] || 1), (H - 20) / (bz[1] - bz[0] || 1));
    const c = base.getContext('2d'); c.clearRect(0, 0, W, H); c.lineCap = c.lineJoin = 'round';
    const path = (samples, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); samples.forEach((p, i) => i ? c.lineTo(...xy(p.x, p.z)) : c.moveTo(...xy(p.x, p.z))); c.stroke(); };
    if (river.branch) path(river.branch.path.samples, 3, '#3d6a4a');
    path(river.main.samples, 5, '#4f8f8a');
    for (const d of river.drops) { const p = river.at(d.s); c.fillStyle = '#e8f4f0'; c.fillRect(...xy(p.x, p.z).map(v => v - 2.5), 5, 5); }
    const end = river.at(river.LENGTH); c.fillStyle = '#ffc629'; c.beginPath(); c.arc(...xy(end.x, end.z), 4, 0, Math.PI * 2); c.fill();
  }
  rebuild(river);
  return {
    rebuild,
    draw(boats, own) {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0);
      for (const b of boats) { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(...xy(b.x, b.z), b === own ? 4.5 : 2.8, 0, Math.PI * 2); ctx.fill(); if (b === own) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); } }
    },
  };
}
