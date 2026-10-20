// The first-time tutorial, played with real keys: every step of it is one of
// the moves (walk, jab, trompón, block, dodge, counter, grab, get up), so
// finishing it proves the controls reach the fight.
// Run: npm run test:browser -- trifulca
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'trifulca', { name: 'Ana', room: `trifulca-tuto-${Date.now()}`, query: 'debug' });
  await waitFor(page, () => trifulcaDebug.room.connected && trifulcaDebug.room.isHost);
  await page.locator('#start').click();   // first time alone: the tutorial
  await waitFor(page, () => trifulcaDebug.room.state.tutorial?.step === 0);
  await page.locator('#world').click({ position: { x: 640, y: 300 } });
  const step = () => page.evaluate(() => trifulcaDebug.room.state.tutorial);
  const until = (n) => waitFor(page, (n) => trifulcaDebug.room.state.tutorial.step >= n || trifulcaDebug.room.state.tutorial.done, n, 30_000);
  // Walk up: right is always toward the rival.
  await page.keyboard.down('d'); await until(1); await page.keyboard.up('d');
  // Three jabs.
  while ((await step()).step === 1) { await page.keyboard.press('j'); await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act !== 'jab'); }
  // A trompón: hold J.
  while ((await step()).step === 2) {
    await page.keyboard.down('j');
    await waitFor(page, () => ['trompon', 'open', 'idle'].includes(trifulcaDebug.room.state.bodies[0].act) && trifulcaDebug.room.state.bodies[0].thrown > 0);
    await page.keyboard.up('j');
    await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act === 'idle' || trifulcaDebug.room.state.tutorial.step > 2);
  }
  // Block the profe's jabs.
  await page.keyboard.down('k'); await until(4); await page.keyboard.up('k');
  // Dodge when he winds up (twice), then counter.
  for (const target of [5, 6]) {
    while ((await step()).step < target) {
      await waitFor(page, () => trifulcaDebug.room.state.bodies[1].act === 'wind' && trifulcaDebug.room.state.bodies[1].at > .2, null, 20_000);
      await page.keyboard.press(' ');
      if (target === 6) { await waitFor(page, () => trifulcaDebug.room.state.bodies[0].contra > 0 || trifulcaDebug.room.state.tutorial.step >= 6, null, 5_000).catch(() => {}); await page.keyboard.press('j'); }
      await waitFor(page, () => !['wind', 'trompon'].includes(trifulcaDebug.room.state.bodies[1].act));
    }
  }
  // Grab through the guard.
  while ((await step()).step === 6) { await page.keyboard.press('l'); await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act !== 'grab'); }
  // Knocked down: mash to get up.
  while (!(await step()).done) { await page.keyboard.press('j'); }
  assert.equal(await page.isVisible('#tutorial-go'), true);
  assert.deepEqual(page.errors, []);
  // Done: the ladder starts with you in the ring.
  await page.locator('#tutorial-go').click();
  await waitFor(page, () => trifulcaDebug.room.state.phase === 'intro' && !!trifulcaDebug.room.state.ladder);
  assert.equal(await page.evaluate(() => trifulcaDebug.room.state.bodies.some(b => b.id === trifulcaDebug.room.id)), true);
  console.log('PASS trifulca tutorial: every move works with real keys, then the ladder starts with you fighting.');
} finally { await browser.close(); }
