import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `qqsmp-panas-${Date.now()}`;
try {
  const host = await openGame(browser, 'qqsmp', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'qqsmp', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => qqsmpDebug.room.state.players.filter(p => p.id !== null).length === 2);
  await host.locator('.pk-cover').waitFor({ state: 'detached' });
  for (const viewport of [{ width: 2048, height: 1084 }, { width: 1440, height: 900 }, { width: 1024, height: 640 }, { width: 390, height: 844 }]) {
    await host.setViewportSize(viewport);
    const overflow = await host.evaluate(() => ['.pana-sala', '.pk-game-lobby-roster', '.pk-game-lobby-settings'].map(selector => {
      const el = document.querySelector(selector);
      return { selector, extra: el.scrollWidth - el.clientWidth };
    }));
    assert.ok(overflow.every(item => item.extra <= 1), `${viewport.width}px lobby: ${JSON.stringify(overflow)}`);
    await host.locator('#pana-room-more').evaluate(el => el.click());
    const dialog = await host.locator('#pana-room-dialog').evaluate(el => {
      const r = el.getBoundingClientRect();
      return { extra: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, viewport: innerWidth };
    });
    assert.ok(dialog.extra <= 1 && dialog.left >= 0 && dialog.right <= dialog.viewport, JSON.stringify(dialog));
    await host.locator('.pk-room-close').evaluate(el => el.click());
  }
  await host.setViewportSize({ width: 1280, height: 800 });
  const selector = '[data-room-option="mode"][data-value="panas"]';
  assert.equal(await guest.locator(selector).isDisabled(), true, 'only the host changes the room mode');
  await host.locator(selector).evaluate(el => el.click());
  await waitFor(guest, () => qqsmpDebug.room.state.options.mode === 'panas');
  await host.evaluate(() => { qqsmpDebug.room.step = () => false; });
  await host.locator('#start').evaluate(el => el.click());
  await waitFor(guest, () => qqsmpDebug.room.state.phase === 'question');
  for (const page of [host, guest]) {
    assert.equal(await page.evaluate(() => qqsmpDebug.world.podiums.filter(p => p.podium.visible).length), 2);
    assert.equal(await page.evaluate(() => qqsmpDebug.world.podiums.filter(p => p.character?.group.visible).length), 2);
    assert.equal(await page.evaluate(() => {
      qqsmpDebug.world.frame(0);
      const event = qqsmpDebug.world.animations.current;
      return !event || qqsmpDebug.room.state.players[event.seat].id !== null;
    }), true, 'comedy scenes only select active friends');
  }
  await host.locator('[data-comodin="copy"]').evaluate(el => el.click());
  assert.equal(await host.locator('#copy-list button').count(), 1, 'only the other pana can be copied');
  await host.locator('[data-comodin="copy"]').evaluate(el => el.click());
  await host.locator('#answers [data-choice="0"]').evaluate(el => el.click());
  await waitFor(guest, () => qqsmpDebug.room.state.players.find(p => p.name === 'Ana').locked);
  await host.locator('#cancel-answer').evaluate(el => el.click());
  await waitFor(guest, () => !qqsmpDebug.room.state.players.find(p => p.name === 'Ana').locked);
  await host.locator('#answers [data-choice="1"]').evaluate(el => el.click());
  await guest.locator('#answers [data-choice="2"]').evaluate(el => el.click());
  await waitFor(guest, () => qqsmpDebug.room.state.reveal?.done);
  const result = await guest.evaluate(() => ({ order: qqsmpDebug.room.state.reveal.order,
    empty: qqsmpDebug.room.state.players.filter(p => p.id === null).map(p => ({ locked: p.locked, outcome: p.outcome, wrong: p.stats.wrong })) }));
  assert.equal(result.order.length, 2);
  assert.ok(result.empty.every(p => !p.locked && p.outcome === null && p.wrong === 0));
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS Solo panas: two humans, no bot votes or podiums, responsive lobby and settings.');
} finally { await browser.close(); }
