// Two real clients race one room at normal speed; each records 40 s of frame
// intervals, WebSocket traffic, and how smoothly it sees the other player's
// car (frame-to-frame velocity change, "jerk") next to its own. A remote car
// far jerkier than one's own is visible stutter, whatever the message rate.
//   node Pana/games/carreritas/tests/online-smoothness.proof.js   (PANA_TEST_URL)
import { menuClick } from './menu-helpers.js';
import { createRequire } from 'node:module';
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461', SECONDS = 40;
// The hardware GPU, as the bench does: software WebGL stutters on its own.
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const code = 'smooth' + Math.random().toString(36).slice(2, 8), errors = [];
async function player(name, lead) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await context.addInitScript(n => { localStorage.setItem('pana:name', n); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'alta' })); }, name);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(`${name}: ${e}`));
  const cdp = await context.newCDPSession(page); await cdp.send('Network.enable');
  const ws = { in: 0, out: 0, inBytes: 0, outBytes: 0, on: false };
  cdp.on('Network.webSocketFrameReceived', e => { if (ws.on) { ws.in++; ws.inBytes += e.response.payloadData.length; } });
  cdp.on('Network.webSocketFrameSent', e => { if (ws.on) { ws.out++; ws.outBytes += e.response.payloadData.length; } });
  await page.goto(`${origin}/g/carreritas/?debug&auto&room=${code}${lead ? '&lead=1' : ''}`);
  await page.waitForFunction(() => window.getNet?.()?.state.players.length > 0, null, { timeout: 60000 });
  return { page, ws };
}
try {
  const host = await player('Host', true), guest = await player('Guest', false);
  await host.page.waitForFunction(() => getNet().state.players.length === 2, null, { timeout: 60000 });
  await menuClick(host.page, '#play');
  for (const p of [host, guest]) await p.page.waitForFunction(() => race.state === 'go', null, { timeout: 120000 });
  const record = p => p.page.evaluate(async seconds => {
    const me = race.player, other = race.cars.find(c => c.remote && !c.bot && c !== me);
    const frames = [], own = [], seen = []; let last = performance.now(); const end = last + seconds * 1000;
    while (performance.now() < end) {
      const now = await new Promise(requestAnimationFrame); frames.push(now - last); last = now;
      own.push([me.x, me.z, now]); if (other) seen.push([other.x, other.z, now]);
    }
    const jerk = pts => {
      const v = [], j = [];
      for (let i = 1; i < pts.length; i++) { const dt = (pts[i][2] - pts[i - 1][2]) / 1000 || 1 / 60; v.push([(pts[i][0] - pts[i - 1][0]) / dt, (pts[i][1] - pts[i - 1][1]) / dt]); }
      for (let i = 1; i < v.length; i++) j.push(Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]));
      j.sort((a, b) => a - b); return { p50: +j[j.length >> 1].toFixed(2), p95: +j[Math.floor(j.length * 0.95)].toFixed(2) };
    };
    frames.sort((a, b) => a - b);
    return { track: getActiveTrack().id, p50: +frames[frames.length >> 1].toFixed(1), p95: +frames[Math.floor(frames.length * 0.95)].toFixed(1), worst: Math.round(frames.at(-1)),
      freezes: frames.filter(f => f > 50).length, ownJerk: jerk(own), remoteJerk: other ? jerk(seen) : null };
  }, SECONDS);
  for (const p of [host, guest]) p.ws.on = true;
  const [h, g] = await Promise.all([record(host), record(guest)]);
  const rate = ws => ({ inPerSec: +(ws.in / SECONDS).toFixed(1), outPerSec: +(ws.out / SECONDS).toFixed(1), inKBps: +(ws.inBytes / SECONDS / 1024).toFixed(2), outKBps: +(ws.outBytes / SECONDS / 1024).toFixed(2) });
  console.log(JSON.stringify({ host: { ...h, ws: rate(host.ws) }, guest: { ...g, ws: rate(guest.ws) }, errors }, null, 1));
} finally { await browser.close(); }
