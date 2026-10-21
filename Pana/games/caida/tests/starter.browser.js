import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

// ¿Quién reparte primero?: two real clients shake their cachos at once (a held
// button on desktop, a finger on the table on a phone); the highest deals.
const browser = await launch(), code = `caida-cacho-${Date.now()}`, shot = name => path.join(tmpdir(), `pana-caida-${name}.png`);
const clients = [];
try {
  const a = await openGame(browser, 'caida', { room: code, name: 'Ana', query: 'debug' }); clients.push(a);
  await waitFor(a, () => caidaDebug.room.isHost && !!caidaDebug.world);
  const b = await openGame(browser, 'caida', { room: code, name: 'Beto', mobile: true, query: 'debug' }); clients.push(b);
  await waitFor(a, () => caidaDebug.room.members.size === 2);
  await waitFor(b, () => caidaDebug.room.seat === 1 && !!caidaDebug.world);
  assert.equal(await a.evaluate(() => caidaDebug.room.state.options.starter), 'cacho', 'the cacho is the default');
  await a.locator('#pana-room-more').click();
  assert.equal(await a.locator('[data-room-option="starter"]').count(), 4);
  await a.locator('#pana-room-done').click();

  await a.locator('#start').click();
  await waitFor(b, () => caidaDebug.room.state.phase === 'starter');
  await a.locator('#pana-starter-shake').waitFor(); await b.locator('#pana-starter-shake').waitFor();
  assert.equal(await a.locator('#dealer-panel').isVisible(), false, 'nobody deals before the cachos');
  // Ana holds the button: Beto sees her cacho rattling.
  await a.locator('#pana-starter-shake').dispatchEvent('pointerdown', { pointerId: 3, button: 0 });
  await waitFor(b, () => caidaDebug.room.state.starter.shaking.includes(0));
  assert.ok(await b.evaluate(() => caidaDebug.world.starter.group.visible), 'the cachos are on the table');
  await a.screenshot({ path: shot('starter-shake') }); await b.screenshot({ path: shot('starter-shake-mobile') });
  // Beto's finger on the table: down shakes, up slams.
  await b.locator('#world').tap();
  await waitFor(a, () => 1 in caidaDebug.room.state.starter.slammed || caidaDebug.room.state.starter.round > 1);
  await a.locator('#pana-starter-shake').dispatchEvent('pointerup', { pointerId: 3, button: 0 });
  // A tie at the top throws again: whoever is still up slams with a click.
  for (let i = 0; i < 40 && await a.evaluate(() => caidaDebug.room.state.phase === 'starter'); i++) {
    const revision = await a.evaluate(() => caidaDebug.room.state.revision);
    for (const page of [a, b]) {
      const up = await page.evaluate(() => { const s = caidaDebug.room.state.starter; return caidaDebug.room.state.phase === 'starter' && s.phase === 'shake' && s.contenders.includes(caidaDebug.room.seat) && !(caidaDebug.room.seat in s.slammed); });
      if (up && await page.locator('#pana-starter-shake').isVisible()) await page.locator('#pana-starter-shake').click();
    }
    await waitFor(a, r => caidaDebug.room.state.revision > r, revision, 30_000);
  }
  await waitFor(b, () => caidaDebug.world.starter?.revealed || caidaDebug.room.state.phase === 'dealing', undefined, 30_000);
  await b.screenshot({ path: shot('starter-lift-mobile') });
  await waitFor(a, () => caidaDebug.room.state.phase === 'dealing', undefined, 60_000);
  await waitFor(b, () => caidaDebug.room.state.phase === 'dealing');
  const state = await a.evaluate(() => caidaDebug.room.state), first = state.starter.history[0].rolls;
  assert.equal(state.dealer, state.starter.order[0], 'the cachos picked the dealer');
  assert.equal(first[state.dealer], Math.max(...Object.values(first)), 'the highest deals');
  assert.deepEqual(await b.evaluate(() => [caidaDebug.room.state.dealer, caidaDebug.room.state.starter.order]), [state.dealer, state.starter.order]);
  assert.equal(await b.evaluate(() => caidaDebug.world.starter.active), false, 'the cachos leave the table');
  const [dealer, other] = state.dealer === 0 ? [a, b] : [b, a];
  await dealer.locator('#dealer-panel').waitFor();
  assert.equal(await dealer.locator('#call-one').isDisabled(), false, 'the winner deals');
  assert.equal(await other.locator('#call-one').isDisabled(), true);
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('PASS two clients shake at once; the highest cacho deals the first reparto');
  for (const page of clients) assert.deepEqual(page.errors, []);
} finally { await browser.close(); }
