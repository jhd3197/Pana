// Shared cartoon lettering for painted boards (wood signs, banners, shop
// fronts): Luckiest Guy with a dark outline. Each line shrinks to fit its
// board, never squashed or clipped. Canvases painted before the web font
// arrives are repainted once it loads.
export const FONT = '"Luckiest Guy", system-ui, sans-serif';
export function letter(ctx, rows, W, H, { top = 0, bottom = H, margin = .07, cream = '#fdf6e3', gold = '#ffd23f' } = {}) {
  const space = bottom - top, lineH = Math.min(space * .78 / rows.length, space * .62), maxW = W * (1 - margin * 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#16161a';
  rows.forEach((line, i) => {
    let size = Math.round(lineH * (rows.length > 1 && i ? .8 : 1));
    ctx.font = `${size}px ${FONT}`;
    const width = ctx.measureText(line).width + size / 3;
    if (width > maxW) size = Math.floor(size * maxW / width);
    ctx.font = `${size}px ${FONT}`; ctx.lineWidth = Math.max(3, size / 6.5);
    const y = top + space / 2 + (i - (rows.length - 1) / 2) * lineH * 1.05 + size * .06;
    ctx.fillStyle = rows.length > 1 && i === rows.length - 1 ? gold : rows.length === 1 ? gold : cream;
    ctx.strokeText(line, W / 2, y); ctx.fillText(line, W / 2, y);
  });
}
export function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
export function whenFont(material, paint) {
  if (typeof document === 'undefined' || !document.fonts || document.fonts.check(`40px ${FONT}`)) return;
  document.fonts.load(`40px ${FONT}`).then(() => { if (!material.map?.image) return; paint(material.map.image.getContext('2d')); material.map.needsUpdate = true; }).catch(() => {});
}

