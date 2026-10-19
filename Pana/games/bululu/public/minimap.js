import { RIVER, SEA, MAP_BOUNDS as MAP, beachMask } from './island.js';

// The whole island at a glance: terrain, river, path and tiles painted once,
// then the camera box, the mango cart and the panas on top ten times a second.
// Clicking it calls `look(x, z)` with the world spot under the pointer.
const TILE_COLORS = { blue: '#3d7bf2', red: '#ff4b4b', event: '#ffd23f', start: '#2ad1b2', tree: '#8e4de8' };

export function createMinimap(canvas, { board, players, focus, turnOf, look }) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  const toMap = (x, z) => [(x - MAP.x0) / (MAP.x1 - MAP.x0) * canvas.width, (z - MAP.z0) / (MAP.z1 - MAP.z0) * canvas.height];

  function drawBase() {
    const g = base.getContext('2d');
    const W = base.width, H = base.height, step = 4;
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        const x = MAP.x0 + (px / W) * (MAP.x1 - MAP.x0), z = MAP.z0 + (py / H) * (MAP.z1 - MAP.z0);
        const h = board.groundAt(x, z);
        let c;
        if (h < SEA - 2) c = '#1d4f80';
        else if (h < SEA + 0.2) c = '#3a8fb0';
        else if (h < 0.4 || beachMask(x, z) > 0.45) c = '#e6c88c';
        else if (h > 24) c = '#b4adbb';
        else if (h > 9) c = '#3f7f4a';
        else c = h > 4 ? '#55a04c' : '#66b356';
        g.fillStyle = c;
        g.fillRect(px, py, step, step);
      }
    }
    g.strokeStyle = '#45bde0';
    g.lineWidth = 5;
    g.lineJoin = g.lineCap = 'round';
    g.beginPath();
    RIVER.forEach(([x, z], i) => (i ? g.lineTo(...toMap(x, z)) : g.moveTo(...toMap(x, z))));
    g.stroke();
    // the path, then the tiles on it
    g.strokeStyle = 'rgba(255, 240, 210, 0.7)';
    g.lineWidth = 4;
    for (const t of board.tiles) for (const n of t.next) {
      const u = board.tiles[n];
      g.beginPath();
      g.moveTo(...toMap(t.x, t.z));
      g.lineTo(...toMap(u.x, u.z));
      g.stroke();
    }
    for (const t of board.tiles) {
      const [x, y] = toMap(t.x, t.z);
      g.fillStyle = TILE_COLORS[t.kind];
      g.fillRect(x - 4, y - 4, 8, 8);
    }
  }

  let wait = 0;
  function draw(dt, t) {
    wait -= dt;
    if (wait > 0) return;
    wait = 0.1;
    const g = ctx;
    g.drawImage(base, 0, 0);
    // where the camera is looking
    const at = focus();
    const [cx, cy] = toMap(at.x, at.z);
    g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    g.lineWidth = 3;
    g.strokeRect(cx - 34, cy - 24, 68, 48);
    // the cart: a pulsing gold star
    const sp = board.stand.group.position;
    const [sx, sy] = toMap(sp.x, sp.z);
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    g.fillStyle = '#ffc629';
    g.strokeStyle = '#6b4200';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = (k % 2 ? 6 : 14) * pulse, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
    // the panas
    for (const p of players) {
      const pos = p.token.group.position;
      const [x, y] = toMap(pos.x, pos.z);
      const r = turnOf() === p.i ? 11 + Math.sin(t * 8) * 2 : 9;
      g.fillStyle = p.color;
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.font = '14px "Luckiest Guy", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(p.i + 1), x, y + 1);
    }
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    look(MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0), MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0));
  });

  drawBase();
  return { draw, drawBase };
}
