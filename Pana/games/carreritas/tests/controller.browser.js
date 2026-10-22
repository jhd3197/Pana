// Native racing input and its shared hints must agree, including light RT use.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';
import { leaveLobby, menuStep } from './menu-helpers.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&track=estadio' });
  await leaveLobby(page); await menuStep(page, 'car');
  await page.locator('#play').click();
  await page.locator('#parrilla.preparing').waitFor({ timeout: 120000 });
  assert.equal(await page.locator('#garage').isVisible(), false);
  assert.equal(await page.locator('#loading').isVisible(), false);
  await page.evaluate(() => {
    window.__pad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected'));
  });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const press = async index => {
    await page.evaluate(i => { __pad.buttons[i] = { pressed: true, value: 1 }; }, index); await frames();
    await page.evaluate(i => { __pad.buttons[i] = { pressed: false, value: 0 }; }, index); await frames();
  };
  await page.waitForFunction(() => document.activeElement.classList.contains('grid-ready'));
  await press(0);
  await page.waitForFunction(() => race.state === 'go', null, { timeout: 120000 });
  await page.keyboard.press('h'); await frames();
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'keyboard');
  await page.evaluate(() => { __pad.buttons[7] = { pressed: false, value: .2 }; });
  await page.waitForFunction(() => race.pads?.[0]?.throttle === .2 && document.documentElement.dataset.panaInput === 'gamepad');
  await page.mouse.move(100, 100); await page.mouse.move(600, 400); await frames();
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'gamepad');
  assert.equal(await page.locator('#swap-item kbd').isVisible(), false, 'Q disappears while native controller input drives the car');
  assert.equal(await page.locator('kbd:not([data-pad-key]):visible').count(), 0);
  await page.evaluate(() => { __pad.buttons[7] = { pressed: false, value: 0 }; });
  await press(9); await page.locator('dialog.pana-menu[open]').waitFor();
  await press(5); await page.locator('[data-settings-category=pad]').waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Controles', exact: true }).count(), 0);
  assert.match(await page.locator('[data-settings-category=pad]').innerText(), /Objeto adelante.*Objeto atrás/s);
  assert.equal(await page.locator('.pana-device-name').innerText(), 'Mando Xbox');
  assert.equal(await page.locator('kbd:not([data-pad-key]):visible').count(), 0, 'controller settings contain no PC key hints');
  if (process.env.PANA_TEST_ARTIFACTS) await page.screenshot({ path: `${process.env.PANA_TEST_ARTIFACTS}/carreritas-controller-settings.png` });
  assert.deepEqual(page.errors, []);
  console.log('PASS native light throttle, persistent controller hints, clean grid and unified settings');
} finally { await browser.close(); }
