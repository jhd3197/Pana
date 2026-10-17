// Real Colyseus clients: lobby, ownership, minigames, late join and host handoff.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [];
const clients = [];
async function open(name, query, viewport = { width: 1100, height: 700 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.addInitScript(name => {
    localStorage.setItem('pana:name', name);
    localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false }));
    // Two full islands otherwise saturate software WebGL in headless CI.
    // Networking and game simulation keep their real independent 20 Hz clock.
    window.requestAnimationFrame = () => 0;
  }, name);
  const page = await context.newPage(); clients.push(page);
  const pending = new Set();
  page.on('request', r => pending.add(r.url()));
  page.on('requestfinished', r => pending.delete(r.url()));
  page.on('requestfailed', r => pending.delete(r.url()));
  page.on('pageerror', e => { errors.push(e.message); console.error(name, e.stack); });
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) console.error(name, m.text()); });
  console.log(`Opening ${name}`);
  try { await page.goto(`${base}/g/bululu/?debug&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); }
  catch (error) { console.error('Pending requests:', [...pending]); throw error; }
  console.log(`Loaded ${name}`);
  await page.waitForFunction(() => window.onlineState?.().room?.connected, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => {
    renderer.shadowMap.enabled = false; renderer.setPixelRatio(0.5);
    // The existing Chinazo suite covers live rendering. Keep these two heavy
    // islands from starving real room/input timers on software-only runners.
    const render = renderer.render.bind(renderer);
    window.renderOnlineProof = () => render(minigame()?.game.scene || boardScene, minigame()?.game.camera || boardCam);
    renderer.render = () => {};
  });
  console.log(`Connected ${name}`);
  return page;
}
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 60000, polling: 50 });
async function clickPrompt(page, label) {
  await page.locator('#prompt button').filter({ hasText: label }).click({ timeout: 60000 });
}
try {
  const code = `bululu-${Date.now()}`;
  const host = await open('Ana', `room=${code}&rounds=1&speed=3&mini=chinazo`);
  const guest = await open('Beto', `room=${code}`, { width: 844, height: 390 });
  await wait(guest, () => players.filter(p => p.human).length === 2);
  console.log('Both humans in the lobby');
  assert.deepEqual(await guest.evaluate(() => players.filter(p => p.human).map(p => p.name)), ['Ana', 'Beto']);
  assert.equal(await guest.locator('#start').isDisabled(), true);
  assert.equal(await guest.evaluate(() => onlineState().me), 1);
  await host.locator('#start').click();
  console.log('Host started');
  await wait(host, () => onlineState().pendingChoice?.seat === onlineState().room.id);
  const first = await host.evaluate(() => onlineState().pendingChoice.id);
  await guest.evaluate(id => onlineState().room.choose(id, 0), first);
  await host.waitForTimeout(300);
  assert.equal(await host.evaluate(() => onlineState().pendingChoice.id), first, 'guest cannot roll host dice');
  await clickPrompt(host, 'Tira');
  console.log('Host rolled');
  // Resolve any purchase on the host's first turn, then wait for the guest.
  for (let i = 0; i < 100; i++) {
    const s = await host.evaluate(() => ({ seat: onlineState().pendingChoice?.seat, host: onlineState().room.id, tile: players[1].tile }));
    if (s.seat && s.seat !== s.host) break;
    const buttons = host.locator('#prompt:not(.hidden) button');
    if (await buttons.count()) await buttons.first().click();
    await host.waitForTimeout(150);
  }
  await clickPrompt(guest, 'Tira');
  console.log('Guest rolled');
  await wait(host, () => players[1].tile > 0);
  console.log('PASS two-player lobby and remote dice; wrong-seat choices rejected');

  // Finish the round using the actual prompts; no direct state edits.
  for (let i = 0; i < 250; i++) {
    if (await host.evaluate(() => minigame()?.state === 'run')) break;
    for (const page of [host, guest]) {
      const buttons = page.locator('#prompt:not(.hidden) button');
      if (await buttons.count()) await buttons.first().click();
    }
    await host.waitForTimeout(100);
  }
  await wait(guest, () => minigame()?.state === 'run');
  console.log('Both playing Chinazo');
  await mkdir('art/bululu', { recursive: true });
  await guest.evaluate(() => renderOnlineProof());
  await guest.screenshot({ path: 'art/bululu/online-guest.png' });
  await host.evaluate(() => menu.open());
  await guest.mouse.move(650, 100); await guest.mouse.down();
  await wait(host, () => minigame().game.sim.shooters[1].pulling);
  assert.equal(await host.evaluate(() => minigame().game.sim.shooters[0].pulling), false);
  await guest.mouse.up();
  await wait(host, () => minigame().game.sim.shooters[1].shots === 1);
  await wait(guest, () => minigame().game.sim.shooters[1].shots === 1);
  await host.evaluate(() => menu.close());
  console.log('PASS guest aim/fire reaches only their own pana on both browsers');
  await wait(host, () => !document.querySelector('#results').classList.contains('hidden'));
  await wait(guest, () => !document.querySelector('#results').classList.contains('hidden'));
  assert.deepEqual(await guest.evaluate(() => players.map(p => [p.tile, p.coins, p.mangos])), await host.evaluate(() => players.map(p => [p.tile, p.coins, p.mangos])));
  console.log('PASS shared round, minigame rewards and final standings');
  assert.equal(await guest.evaluate(async () => {
    const { joinRoom } = await import('/engine/net.js');
    const code = `capacity-${Date.now()}`, links = [];
    try {
      for (let i = 0; i < 4; i++) links.push(await joinRoom('bululu', { code, name: `Pana ${i}`, resume: false }));
      try { links.push(await joinRoom('bululu', { code, name: 'Quinto', resume: false })); return false; }
      catch (error) { return error.full === true; }
    } finally { await Promise.all(links.map(link => link.leave())); }
  }), true);
  console.log('PASS fifth player gets a full-room response');
  await host.context().close();
  await wait(guest, () => onlineState().room.isHost);
  assert.equal(await guest.locator('#results').isVisible(), true);
  console.log('PASS host departure preserves completed results');
  await guest.locator('#again').click();
  await wait(guest, () => document.querySelector('#results').classList.contains('hidden') && players.every(p => p.tile === 0 && p.coins === 10 && p.mangos === 0));
  console.log('PASS rematch resets the board and scores in the same room');
  await guest.context().close();

  const nextCode = `mini-${Date.now()}`;
  const a = await open('Caro', `room=${nextCode}&play=chinazo`);
  const b = await open('Dani', `room=${nextCode}&play=chinazo`);
  await wait(b, () => players.filter(p => p.human).length === 2);
  await a.locator('#start').click(); await clickPrompt(a, 'Listo');
  await wait(b, () => minigame()?.state === 'run');
  await b.keyboard.down(' ');
  await wait(a, () => minigame().game.sim.shooters[1].pulling);
  await b.keyboard.up(' ');
  await wait(a, () => minigame().game.sim.shooters[1].shots === 1);
  await b.reload();
  await wait(b, () => window.minigame?.()?.state === 'run');
  await wait(b, () => minigame().game.sim.shooters[1].shots === 1);
  console.log('PASS reloaded guest catches up the running minigame');
  await a.context().close();
  await wait(b, () => onlineState().room.isHost);
  await clickPrompt(b, 'Listo');
  await wait(b, () => minigame()?.state === 'run');
  console.log('PASS new host resumes from the minigame checkpoint');
  assert.deepEqual(errors, []);
} catch (error) {
  for (const page of clients.filter(p => !p.isClosed())) {
    console.error(await page.evaluate(() => ({ status: document.querySelector('#room-status')?.textContent,
      state: window.onlineState?.() && { me: onlineState().me, host: onlineState().room?.isHost, prompt: onlineState().pendingChoice, checkpoint: onlineState().checkpoint?.stage },
      prompt: document.querySelector('#prompt')?.textContent })).catch(() => 'Page unavailable'));
  }
  throw error;
} finally { await browser.close(); }
