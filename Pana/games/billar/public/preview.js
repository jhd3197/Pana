import { RADIUS, POCKETS } from './rules.js';


const COLORS = ['#f8f2dc', '#efc337', '#3775cc', '#d84c44', '#874ea2', '#eb8739', '#398e67', '#a43e4c', '#20242b'];
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function rounded(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }

export function drawBall(ctx, b, rotation = 0) {
  const r = RADIUS, color = COLORS[b.id > 8 ? b.id - 8 : b.id];
  circle(ctx, b.x + 2, b.y + 4, r + 1, '#0005');
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-rotation);
  circle(ctx, 0, 0, r, b.id > 8 ? '#f7f0d9' : color);
  if (b.id > 8) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(-r, -6, r * 2, 12); ctx.restore(); }
  const shine = ctx.createRadialGradient(-4, -5, 0, 1, 3, 15);
  shine.addColorStop(0, '#fff8'); shine.addColorStop(.4, '#fff0'); shine.addColorStop(1, '#0008'); circle(ctx, 0, 0, r, shine);
  if (b.id) { circle(ctx, 0, 0, 5.6, '#fff9eb'); ctx.fillStyle = '#20242b'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.id, 0, .6); }
  else circle(ctx, -3, -4, 2, '#fff9');
  ctx.restore();
}

export function drawTable(ctx) {
  ctx.save();
  ctx.shadowColor = '#0009'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 13;
  rounded(ctx, -54, -54, 1108, 608, 38, '#251b16'); ctx.shadowColor = 'transparent';
  const wood = ctx.createLinearGradient(0, -52, 0, 552);
  wood.addColorStop(0, '#986440'); wood.addColorStop(.13, '#663c28'); wood.addColorStop(.88, '#613a28'); wood.addColorStop(1, '#a77546');
  rounded(ctx, -50, -50, 1100, 600, 34, wood);
  ctx.strokeStyle = '#d1a16538'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.roundRect(-46 + i * 3, -46 + i * 3, 1092 - i * 6, 592 - i * 6, 32); ctx.stroke(); }
  rounded(ctx, -24, -24, 1048, 548, 15, '#103f33');
  const felt = ctx.createLinearGradient(0, 0, 0, 500); felt.addColorStop(0, '#20856b'); felt.addColorStop(1, '#17654f');
  ctx.fillStyle = felt; ctx.fillRect(0, 0, 1000, 500);
  ctx.fillStyle = '#fff'; ctx.globalAlpha = .035;
  for (let x = 3; x < 1000; x += 7) for (let y = 3; y < 500; y += 7) ctx.fillRect(x + (y % 2), y, 1, 1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#82bea055'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 998, 498);
  ctx.fillStyle = '#083b2a';
  for (const [x, w] of [[24, 450], [526, 450]]) {
    ctx.beginPath(); ctx.moveTo(x - 14, -21); ctx.lineTo(x + w + 14, -21); ctx.lineTo(x + w, 0); ctx.lineTo(x, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(x + w, 500); ctx.lineTo(x + w + 14, 521); ctx.lineTo(x - 14, 521); ctx.fill();
  }
  for (const x of [0, 1000]) { ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x + (x ? 21 : -21), 12); ctx.lineTo(x + (x ? 21 : -21), 488); ctx.lineTo(x, 472); ctx.fill(); }
  for (const [x, y] of POCKETS) {
    circle(ctx, x, y, 31, '#c6a36b'); circle(ctx, x, y, 27, '#332b23'); circle(ctx, x, y + 2, 24.5, '#090e0d');
    ctx.beginPath(); ctx.arc(x, y + 2, 20, 0, Math.PI); ctx.strokeStyle = '#fff1'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.fillStyle = '#dfc18a';
  for (const x of [125, 250, 375, 625, 750, 875]) for (const y of [-36, 536]) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); }
  for (const y of [125, 250, 375]) for (const x of [-36, 1036]) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); }
  ctx.fillStyle = '#ddf1cf19'; ctx.textAlign = 'center'; ctx.font = '900 40px Nunito, sans-serif'; ctx.fillText('PANA', 500, 264);
  circle(ctx, 250, 250, 2, '#c9e3cb66'); circle(ctx, 690, 250, 2, '#c9e3cb66');
  ctx.restore();
}
