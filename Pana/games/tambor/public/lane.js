// The drum lane: a HUD overlay (Canvas 2D) where your notes fall onto the hit
// line in time with your own music. One lane for Palo, Charrasca and Caracol,
// two for Mano (left and right hand) and for ¡Golpe!.
const AHEAD = 1.7; // seconds of notes shown above the hit line

export function createLane(canvas) {
  const g = canvas.getContext('2d'), css = getComputedStyle(document.body);
  const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const palette = { perfect: color('--tb-perfect', '#ffc629'), good: color('--tb-good', '#5fdc8c'), miss: color('--tb-miss', '#ff5a5a'),
    lane: [color('--tb-perfect', '#ffc629'), color('--pk-game', '#ff5a3d')], text: color('--pk-text', '#f3e9d7'), muted: color('--pk-muted', '#a49cc8'),
    line: color('--pk-line', '#2e2558'), mcp: color('--pk-teal', '#2ad1b2') };

  // notes: [{ t, lane, len (s), kind: 'note' | 'mcp' | 'ghost', done, held }]; t is song seconds.
  function draw({ notes = [], lanes = 1, t = 0, spb = .5, keys = ['Espacio'], banner = '', flash = null }) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth || 320, h = canvas.clientHeight || 230;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const hitY = h - 40, top = 8, laneW = w / lanes, y = (at) => hitY - (at - t) / AHEAD * (hitY - top);
    // Beat lines scroll with the music.
    g.strokeStyle = palette.line; g.lineWidth = 1;
    for (let b = Math.ceil((t - .5) / spb); b * spb < t + AHEAD; b++) {
      const yy = y(b * spb); g.globalAlpha = b % 4 === 0 ? .9 : .4;
      g.beginPath(); g.moveTo(6, yy); g.lineTo(w - 6, yy); g.stroke();
    }
    g.globalAlpha = 1;
    for (let lane = 0; lane < lanes; lane++) {
      const cx = laneW * (lane + .5);
      g.strokeStyle = palette.lane[lane % 2]; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, hitY, 19, 0, Math.PI * 2); g.stroke();
      g.fillStyle = palette.muted; g.font = '900 13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(keys[lane] ?? '', cx, hitY + 23);
    }
    for (const n of notes) {
      if (n.done && !n.held) continue;
      const cx = laneW * ((n.lane % lanes) + .5), y0 = n.held ? hitY : y(n.t), y1 = y(n.t + (n.len || 0));
      if (y1 > h + 20 || y0 < -30) continue;
      const tint = n.kind === 'mcp' ? palette.mcp : palette.lane[n.lane % 2];
      g.globalAlpha = n.kind === 'ghost' ? .5 : 1;
      if (n.len > 0) {
        g.fillStyle = tint; g.globalAlpha *= .55;
        g.beginPath(); g.roundRect(cx - 11, Math.min(y0, y1), 22, Math.abs(y0 - y1), 11); g.fill();
        g.globalAlpha = n.kind === 'ghost' ? .5 : 1;
      }
      if (n.kind === 'ghost') { g.strokeStyle = tint; g.lineWidth = 3; g.beginPath(); g.arc(cx, y0, 15, 0, Math.PI * 2); g.stroke(); }
      else { g.fillStyle = tint; g.beginPath(); g.arc(cx, y0, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(cx - 5, y0 - 5, 5, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    if (banner) { g.fillStyle = palette.text; g.font = '900 18px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(banner, w / 2, 10); }
    if (flash && t - flash.t < .5) {
      g.globalAlpha = 1 - (t - flash.t) / .5; g.fillStyle = palette[flash.grade] || palette.text;
      g.font = '900 20px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(flash.text || '', w / 2, hitY - 30);
      g.globalAlpha = 1;
    }
  }
  return { draw };
}
