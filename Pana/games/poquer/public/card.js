export function mount(canvas) {
  const ctx = canvas.getContext('2d');
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    canvas.width = w * Math.min(devicePixelRatio, 1.5); canvas.height = h * Math.min(devicePixelRatio, 1.5); ctx.scale(canvas.width / 500, canvas.height / 300);
    ctx.fillStyle = '#153e37'; ctx.fillRect(0, 0, 500, 300); ctx.strokeStyle = '#b58a51'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(250, 150, 225, 120, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(190 + i * 66, 150); ctx.rotate((i - 1) * .16); ctx.fillStyle = '#fff5dd'; ctx.beginPath(); ctx.roundRect(-42, -63, 78, 112, 8); ctx.fill(); ctx.fillStyle = i === 1 ? '#bd4051' : '#232235'; ctx.font = 'bold 32px sans-serif'; ctx.fillText(['A', 'K', 'A'][i], -29, -25); ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(14, 10); ctx.lineTo(-3, 30); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill(); ctx.restore(); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5 - i; j++) { ctx.fillStyle = ['#ebbe5f', '#dd6370', '#69b3a3'][i]; ctx.strokeStyle = '#fff5dd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(105 + i * 27, 232 - j * 6, 21, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  const observer = new ResizeObserver(draw); observer.observe(canvas); draw(); addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
