// Lightweight hub art; the game itself is rendered in WebGL.
export function mount(canvas) {
  const c = canvas.getContext('2d');
  function paint() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio, 1.5); canvas.width = w * ratio; canvas.height = h * ratio; c.scale(ratio, ratio);
    c.fillStyle = '#78995a'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w * .5, h * .52); c.rotate(-.12);
    c.fillStyle = '#ad5d42'; c.fillRect(-w * .43, -h * .36, w * .86, h * .72);
    c.fillStyle = '#cf9567'; c.fillRect(-w * .41, -h * .33, w * .82, h * .66);
    c.strokeStyle = '#fff0cb'; c.lineWidth = 1.5; c.strokeRect(-w * .39, -h * .3, w * .78, h * .6);
    function ball(x, y, r, color) {
      c.fillStyle = 'rgba(50,30,10,.2)'; c.beginPath(); c.ellipse(x + r * .3, y + r * .6, r * 1.2, r * .65, 0, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(x - r * .3, y - r * .4, 0, x, y, r); g.addColorStop(0, '#fff0cb'); g.addColorStop(.27, color); g.addColorStop(1, color);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff0cb'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, r * .3, r * .95, -.6, 0, Math.PI * 2); c.stroke();
    }
    const r = h * .075; ball(w * .12, -h * .035, r * .52, '#ffe5a0');
    ball(w * .055, h * .025, r, '#ed5949'); ball(w * .18, h * .12, r, '#299e72'); ball(-w * .18, h * .12, r, '#ed5949');
    c.restore();
  }
  const observer = new ResizeObserver(paint); observer.observe(canvas); paint();
  addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
