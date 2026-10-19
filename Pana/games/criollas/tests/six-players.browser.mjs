import assert from 'node:assert/strict';
import { launch, base, waitFor } from '../../../tests/browser-kit.js';
const browser = await launch(), pages = [], code = `cri-six-${Date.now()}`, errors = [];
try {
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(i => { localStorage.setItem('pana:name', `Pana ${i + 1}`); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); window.requestAnimationFrame = () => 0; }, i);
    const page = await ctx.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
    if (i < 2) {
      await page.goto(`${base}/g/criollas/?debug&room=${code}`, { waitUntil: 'domcontentloaded' });
      await waitFor(page, () => window.PANA_PREPARED === true, null, 120_000); await waitFor(page, () => window.criollasDebug?.room.connected);
      await page.evaluate(() => window.client = criollasDebug.room);
    } else {
      // Four additional isolated browser sessions use the real game adapter;
      // the two playable views prove geometry without six continuous renders.
      await page.goto(`${base}/api/games`);
      await page.evaluate(async ({ code, i }) => { const { CriollasRoom } = await import('/g/criollas/network.js'); window.client = new CriollasRoom({ code, name: `Pana ${i + 1}`, avatar: {} }); await client.connect(); }, { code, i });
      await waitFor(page, () => client.connected && client.seat >= 0);
    }
  }
  const [host, guest] = pages;
  await waitFor(host, () => client.state.players.every(p => p.id !== null));
  await host.locator('#pana-room-more').click();
  await host.locator('[data-room-option="ballsPerPlayer"][data-value="2"]').click();
  await host.locator('#pana-room-done').click();
  await waitFor(guest, () => client.state.ballsPerPlayer === 2);
  await host.locator('#start').click(); await waitFor(pages[5], () => client.state.phase === 'aiming');
  assert.deepEqual(await pages[5].evaluate(() => client.state.remaining), Array(6).fill(2));
  for (let seat = 0; seat < 6; seat++) {
    // Equal empty-court layouts isolate turn ownership from the scoring team.
    await host.evaluate(async seat => { const { createPitch } = await import('/engine/play/bolas-criollas.js'); client.game.pitch = createPitch(); client.game.turn = seat; client.game.phase = 'aiming'; client.game.revision++; client.publish(); }, seat);
    const revision = await host.evaluate(() => client.state.revision);
    await waitFor(pages[seat], revision => client.state.revision === revision, revision);
    await pages[seat].evaluate(() => client.action('shoot', { angle: .6, power: .1 }));
    await waitFor(guest, shots => client.state.shots === shots && client.state.phase === 'aiming', seat + 1);
    assert.equal(await guest.evaluate(() => client.state.pitch.balls.at(-1).owner), seat);
  }
  assert.deepEqual(await guest.evaluate(() => client.state.remaining), Array(6).fill(1));
  await host.context().close(); await waitFor(guest, () => client.isHost);
  assert.equal(await guest.evaluate(() => client.state.ballsPerPlayer), 2);
  assert.equal(await guest.evaluate(() => client.state.shots), 6);
  assert.deepEqual(errors, []);
  console.log('PASS six independent clients throw, shared short-hand setting synchronizes and host migration preserves it');
} finally { await browser.close(); }
