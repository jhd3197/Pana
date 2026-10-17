export function mount(canvas) {
  const ctx = canvas.getContext('2d');
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    canvas.width = w * Math.min(devicePixelRatio, 1.5); canvas.height = h * Math.min(devicePixelRatio, 1.5); ctx.scale(canvas.width / 500, canvas.height / 300);
    ctx.fillStyle = '#bdad77'; ctx.fillRect(0, 0, 500, 300);
    ctx.strokeStyle = '#fff0cc'; ctx.lineWidth = 3; ctx.strokeRect(26, 24, 448, 252);
    for (const [x, y, color] of [[110, 80, '#44a7a8'], [310, 150, '#e68b57'], [220, 40, '#e68b57'], [160, 220, '#44a7a8']]) {
      ctx.fillStyle = '#0003'; ctx.fillRect(x + 8, y + 12, 80, 42); ctx.fillStyle = color; ctx.fillRect(x, y, 80, 42); ctx.fillStyle = '#f8e6bc'; ctx.fillRect(x, y, 80, 5);
    }
    for (let i = 0; i < 14; i++) { const x = 45 + (i * 67) % 400, y = 40 + (i * 97) % 220; ctx.fillStyle = i % 2 ? '#ed6b42' : '#3dc3c4'; ctx.beginPath(); for (let j = 0; j < 18; j++) { const a = j * Math.PI / 9, r = j % 2 ? 8 : 15; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
  }
  const observer = new ResizeObserver(draw); observer.observe(canvas); draw(); addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
