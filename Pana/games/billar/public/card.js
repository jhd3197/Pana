import { drawTable, drawBall } from './preview.js';
import { rack } from './rules.js';

export function mount(canvas) {
  const ctx = canvas.getContext('2d'), balls = rack();
  function paint() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    canvas.width = w * Math.min(devicePixelRatio, 1.5); canvas.height = h * Math.min(devicePixelRatio, 1.5);
    ctx.fillStyle = '#112b25'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width * .49, canvas.height * .53); ctx.rotate(-.16);
    const scale = Math.min(canvas.width / 1100, canvas.height / 640); ctx.scale(scale, scale); ctx.translate(-500, -250);
    drawTable(ctx); balls.forEach(b => drawBall(ctx, b));
    ctx.strokeStyle = '#eacda0'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(50, 290); ctx.lineTo(228, 254); ctx.stroke();
  }
  const observer = new ResizeObserver(paint); observer.observe(canvas); paint();
  addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
