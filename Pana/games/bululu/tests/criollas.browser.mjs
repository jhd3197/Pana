import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [], wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 120000, polling: 50 });
async function open(name, query) {
  console.log(`Opening ${name}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false })); window.requestAnimationFrame = () => 0; }, name);
  const p = await context.newPage(); p.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
  await p.goto(`${base}/g/bululu/?debug&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(p, () => window.onlineState?.().room?.connected);
  console.log(`Connected ${name}`);
  return p;
}
try {
  const code = `mini-bolas-${Date.now()}`, host = await open('Ana', `room=${code}&play=criollas`), guest = await open('Beto', `room=${code}`);
  await wait(host, () => players.filter(p => p.human).length === 2);
  await host.locator('#start').click();
  await host.locator('#prompt button').filter({ hasText: 'Listo' }).click({ timeout: 120000 });
  await wait(guest, () => minigame()?.state === 'run' && minigame()?.def.id === 'criollas');
  console.log('Both playing Criollas');
  await host.locator('#menu').click();
  await guest.keyboard.down('ArrowRight'); await guest.waitForTimeout(300); await guest.keyboard.up('ArrowRight');
  // Holding Space charges on the host's simulation; letting go throws at that force.
  await guest.keyboard.down('Space');
  await wait(host, () => minigame()?.game.sim.players[1].power >= .3);
  await guest.keyboard.up('Space');
  await wait(host, () => minigame()?.game.sim.players[1].left === 1);
  assert(await host.evaluate(() => minigame().game.sim.players[1].power) >= .3);
  console.log('Guest first throw');
  assert.equal(await host.evaluate(() => minigame().game.sim.players[0].left), 2);
  assert(await host.evaluate(() => minigame().game.sim.players[1].angle) > 0);
  await wait(guest, () => minigame()?.game.sim.players[1].cooldown === 0);
  await guest.keyboard.press('Space'); await wait(host, () => minigame()?.game.sim.players[1].left === 0);
  console.log('Guest second throw');
  await host.locator('#pana-resume').click();
  await host.evaluate(() => document.activeElement?.blur());
  await host.keyboard.press('Space'); await wait(guest, () => minigame()?.game.sim.players[0].left === 1);
  console.log('Host first throw');
  await wait(host, () => minigame()?.game.sim.players[0].cooldown === 0);
  await host.keyboard.press('Space');
  await mkdir('art/criollas', { recursive: true });
  await guest.evaluate(() => { renderer.shadowMap.enabled = false; renderer.render(minigame().game.scene, minigame().game.camera); });
  await guest.screenshot({ path: 'art/criollas/bululu.png' });
  await wait(host, () => minigame()?.state === 'outro'); await wait(guest, () => minigame()?.state === 'outro');
  assert.deepEqual(await guest.evaluate(() => minigame().game.sim.pitch), await host.evaluate(() => minigame().game.sim.pitch));
  assert.deepEqual(await guest.evaluate(() => minigame().game.winners()), await host.evaluate(() => minigame().game.winners()));
  assert.deepEqual(errors, []);
  console.log('PASS Bolas Criollas: real guest aiming/throws, independent seats, online pause, identical final balls and winners');
} finally { await browser.close(); }
