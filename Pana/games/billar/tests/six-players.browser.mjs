import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch, base, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), pages = [], errors = [], code = `pool-six-${Date.now()}`;
try {
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(i => {
      localStorage.setItem('pana:name', `Pana ${i + 1}`);
      localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false }));
      // Network simulation uses its independent timer. Render an explicit frame
      // for visual proof without continuously drawing six software WebGL scenes.
      window.requestAnimationFrame = () => 0;
    }, i);
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', e => errors.push(e.message));
    if (i < 2) {
      await page.goto(`${base}/g/billar/?debug&room=${code}`, { waitUntil: 'domcontentloaded' });
      await waitFor(page, () => window.PANA_PREPARED === true, null, 120_000); await waitFor(page, () => window.billarDebug?.room.connected);
    } else {
      await page.goto(`${base}/api/games`);
      await page.evaluate(async ({ code, i }) => { const { PoolRoom } = await import('/g/billar/network.js'); window.billarDebug = { room: new PoolRoom({ code, name: `Pana ${i + 1}`, avatar: {} }) }; await billarDebug.room.connect(); }, { code, i });
      await waitFor(page, () => billarDebug.room.connected && billarDebug.room.seat >= 0);
    }
  }
  const [host, guest] = pages, last = pages[5];
  await waitFor(last, () => billarDebug.room.state.players.every(p => p.id !== null));
  assert.deepEqual(await host.evaluate(() => billarDebug.room.state.players.map(p => p.name)), Array.from({ length: 6 }, (_, i) => `Pana ${i + 1}`));
  const initialIds = await host.evaluate(() => billarDebug.room.state.players.map(p => p.id));
  assert.equal(await guest.locator('#seating select').count(), 0);
  assert.equal(await guest.locator('#seating [data-roster-group]').count(), 2);
  await guest.evaluate(() => billarDebug.room.action('swap', { from: 0, to: 2 }));
  await guest.locator('#seating [data-roster-move="4"]').click();
  await waitFor(host, id => billarDebug.room.state.players[4].id === id, initialIds[1]);
  await guest.locator('#seating [data-roster-move="1"]').click();
  await waitFor(host, ids => billarDebug.room.state.players.every((p, i) => p.id === ids[i]), initialIds);
  await host.screenshot({ path: path.join(tmpdir(), 'pana-billar-team-roster-desktop.png') });
  await guest.setViewportSize({ width: 390, height: 844 });
  assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await guest.screenshot({ path: path.join(tmpdir(), 'pana-billar-team-roster-mobile.png') });
  await guest.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await guest.evaluate(async code => {
    const { joinRoom } = await import('/engine/net.js');
    try { const link = await joinRoom('billar', { code, name: 'Séptimo', resume: false }); await link.leave(); return false; } catch (error) { return error.full === true; }
  }, code), true, 'seventh client cannot create a duplicate room');
  const choose = (id, value) => host.locator(`[data-room-option="${id}"][data-value="${value}"]`).click();
  await choose('variant', 'nine'); await choose('venue', 'cafe'); await choose('guide', 'none');
  await host.locator('#pana-room-more').click();
  for (const [key, value] of [['breakPolicy', 'loser'], ['foulPlacement', 'kitchen'], ['calledPocket', true], ['bestOf', 3], ['shotSeconds', 60]]) await choose(key, value);
  await waitFor(last, () => billarDebug.room.state.options.shotSeconds === 60);
  const configured = await host.evaluate(() => billarDebug.room.state.options);
  assert.deepEqual(await last.evaluate(() => billarDebug.room.state.options), configured);
  await host.keyboard.press('Escape');
  assert.equal(await host.locator('#pana-room-dialog').evaluate(d => d.open), false);
  assert.equal(await host.evaluate(() => billarDebug.menu.isOpen), false);
  assert.equal(await host.evaluate(() => document.activeElement.id), 'pana-room-more');
  await guest.locator('#pana-room-more').click();
  assert.equal(await guest.locator('[data-room-option="bestOf"][data-value="5"]').isDisabled(), true);
  await guest.locator('#pana-room-done').click();
  await guest.evaluate(() => billarDebug.room.action('options', { options: { bestOf: 5 } }));
  // A subsequent accepted host action provides an authoritative ordering fence.
  await host.locator('#pana-room-more').click(); await choose('shotSeconds', 30);
  await waitFor(guest, () => billarDebug.room.state.options.shotSeconds === 30);
  assert.equal(await guest.evaluate(() => billarDebug.room.state.options.bestOf), 3);
  await host.locator('#map-choice').selectOption('puerto');
  await waitFor(last, () => billarDebug.room.state.mapId === 'puerto');
  await host.locator('[data-difficulty="experto"]').click();
  await waitFor(last, () => billarDebug.room.state.difficulty === 'experto');
  await host.locator('#pana-room-reset').click();
  await waitFor(last, () => billarDebug.room.state.options.bestOf === 1);
  assert.equal(await last.evaluate(() => billarDebug.room.state.mapId), 'plaza');
  assert.equal(await last.evaluate(() => billarDebug.room.state.difficulty), 'normal');
  assert.equal(await host.locator('[data-room-option="calledPocket"][data-value="false"]').getAttribute('aria-pressed'), 'true');
  await host.setViewportSize({ width: 390, height: 844 });
  const fit = await host.locator('#pana-room-dialog').evaluate(d => { const r = d.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && d.scrollWidth <= d.clientWidth; });
  assert(fit, 'advanced settings fit mobile and scroll vertically');
  await host.locator('#pana-room-done').click(); await host.setViewportSize({ width: 1280, height: 800 });
  const start = await host.locator('#start').boundingBox(); assert(start.y + start.height <= 800, 'start remains visible on laptop');
  console.log('PASS six seats, synchronized host options, guest protection, reset, Escape/focus and mobile dialog');

  await host.locator('#start').click();
  await waitFor(last, () => billarDebug.room.state.phase === 'aiming');
  assert.deepEqual(await last.evaluate(() => billarDebug.room.state.activeSeats), [0, 1, 2, 3, 4, 5]);
  for (let seat = 0; seat < 6; seat++) {
    await waitFor(pages[seat], seat => billarDebug.room.state.turn === seat, seat);
    // An unobstructed, short actual shot misses. The real physics resolves it,
    // granting the other team ball in hand and rotating both teammate queues.
    await host.evaluate(() => {
      const r = billarDebug.room, s = r.game;
      s.balls.forEach(b => { b.pocketed = b.id > 1; b.vx = b.vy = 0; });
      Object.assign(s.balls[0], { x: 150, y: 250 }); Object.assign(s.balls[1], { x: 850, y: 250 });
      s.ballInHand = false; s.revision++; r.publish();
    });
    const revision = await host.evaluate(() => billarDebug.room.state.revision);
    await waitFor(pages[seat], r => billarDebug.room.state.revision === r, revision);
    await pages[seat].evaluate(() => billarDebug.room.action('shoot', { angle: Math.PI / 2, power: .05 }));
    await waitFor(last, n => billarDebug.room.state.shots === n && billarDebug.room.state.phase === 'aiming', seat + 1);
    assert.equal(await last.evaluate(() => billarDebug.room.state.turn), (seat + 1) % 6);
  }
  await host.evaluate(() => { const d = billarDebug; d.world.draw(d.room.state, { active: true, dt: .016 }); });
  assert.equal(await host.evaluate(() => billarDebug.world.avatars.size), 6);
  console.log('PASS six real clients take six authoritative physical shots in team rotation');

  await host.context().close();
  await waitFor(guest, () => billarDebug.room.isHost);
  await waitFor(last, () => billarDebug.room.state.players[0].id === null);
  assert.equal(await guest.evaluate(() => billarDebug.room.state.shots), 6);
  const revision = await guest.evaluate(() => billarDebug.room.state.revision);
  await guest.evaluate(() => billarDebug.room.action('shoot', { power: .5, angle: 0 }));
  assert.equal(await guest.evaluate(() => billarDebug.room.state.revision), revision);
  assert.deepEqual(errors, []);
  console.log('PASS host handoff retains team rotation and pauses shots for the missing teammate');
} finally { await browser.close(); }
