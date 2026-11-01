import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
// The one-time control hints: shown when the first round starts, in the keys of
// the device in use (switching live to controller buttons), gone on the first
// press and never back in the same session.
const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Prueba', query: 'debug' });
  await waitFor(page, () => window.pinturaDebug?.world && pinturaDebug.room.connected && window.PANA_PREPARED);
  await page.locator('#practice').click();
  await waitFor(page, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing');
  await waitFor(page, () => pinturaDebug.controlHints.visible);
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#control-hints [data-hint] b')].map(b => b.textContent));
  const keyboard = await keys();
  assert.ok(keyboard.includes('R') && keyboard.includes('WASD'), `keyboard keys: ${keyboard}`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('control-hints')).borderRadius), '0px');

  await page.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'gamepad' }));
  await waitFor(page, () => document.querySelector('#control-hints')?.dataset.device === 'gamepad');
  const pad = await keys();
  assert.ok(pad.includes('RT') && pad.includes('X') && !pad.includes('R') && !pad.includes('WASD'), `controller buttons: ${pad}`);

  await page.mouse.click(5, 5);
  await waitFor(page, () => !pinturaDebug.controlHints.visible);
  assert.equal(await page.evaluate(() => pinturaDebug.controlHints.show()), false, 'never shown twice in a session');
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pana:hints:pintura')).includes('reload')));
  console.log('control hints: device keys, live switch, dismissed once for the session');
} finally { await browser.close(); }
