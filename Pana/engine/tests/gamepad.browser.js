// A controller from the lobby to the race and the pause menu, with a fake
// "standard" pad in place of navigator.getGamepads: the lobby takes the
// d-pad and A, RT holds the gas through Galope's own keys, Start pauses.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../tests/browser-kit.js';

const browser = await launch();
const ORDER = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
try {
  const page = await openGame(browser, 'galope', { room: 'pad-' + Date.now(), query: 'debug' });
  await page.evaluate(order => {
    window.__pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: order.map(() => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected'));
  }, ORDER);
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const set = async (name, on) => { await page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [ORDER.indexOf(name), on]); await frames(); };
  const press = async name => { await set(name, true); await set(name, false); };

  await page.locator('.pana-toast', { hasText: 'Mando conectado' }).waitFor();
  await frames();
  const first = await page.evaluate(() => document.activeElement.id);
  assert.equal(first, 'start', 'the lobby focuses its main button for the pad');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('pana-pad-focus')), true);
  await press('up');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'start', 'the d-pad moves between the lobby buttons');
  await press('down');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'start', 'and back');
  console.log('PASS the d-pad works the lobby');

  await press('a');
  await page.waitForFunction(() => ['countdown', 'racing'].includes(galope.state.phase), null, { timeout: 60000 });
  await page.waitForFunction(() => galope.state.phase === 'racing', null, { timeout: 60000 });
  await set('rt', true);
  assert.equal(await page.evaluate(() => galope.input().throttle), 1, 'RT holds the gas');
  await page.evaluate(() => { window.__pad.axes[0] = -1; }); await frames();
  assert.ok(await page.evaluate(() => galope.input().steer !== 0), 'the stick steers');
  await page.evaluate(() => { window.__pad.axes[0] = 0; }); await set('rt', false);
  assert.equal(await page.evaluate(() => galope.input().throttle), 0, 'letting go lifts the key');
  console.log('PASS A starts the race; RT and the stick press the game keys');

  await press('start');
  await page.locator('dialog.pana-menu[open]').waitFor();
  await press('rb'); await press('rb');
  const panel = await page.locator('dialog.pana-menu [role=tabpanel]:not([hidden])').innerText();
  assert.match(panel, /con mando/i); assert.match(panel, /Avanzar/);
  await press('b');
  await page.waitForFunction(() => !document.querySelector('dialog.pana-menu[open]'));
  console.log('PASS Start opens the menu, RB changes tab, B closes it');
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // First person: the right stick turns the camera (engine/play/first-person.js).
  const fps = await openGame(browser, 'pintura', { room: 'pad-fps-' + Date.now(), query: 'debug' });
  await fps.evaluate(order => {
    window.__pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: order.map(() => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected'));
  }, ORDER);
  await fps.waitForFunction(() => !document.getElementById('start').disabled && document.activeElement.id === 'start', null, { timeout: 60000 });
  await fps.evaluate(i => { window.__pad.buttons[i] = { pressed: true, value: 1 }; }, ORDER.indexOf('a'));
  await fps.waitForFunction(() => document.getElementById('pana-lobby-shell').hidden, null, { timeout: 60000 });
  await fps.evaluate(i => { window.__pad.buttons[i] = { pressed: false, value: 0 }; }, ORDER.indexOf('a'));
  const facing = () => fps.evaluate(() => pinturaDebug.world.camera.getWorldDirection(new pinturaDebug.world.camera.position.constructor()).toArray());
  await fps.waitForFunction(() => pinturaDebug.world.camera, null, { timeout: 60000 });
  const before = await facing();
  await fps.evaluate(() => { window.__pad.axes[2] = 1; });
  await fps.waitForFunction(b => { const d = pinturaDebug.world.camera.getWorldDirection(new pinturaDebug.world.camera.position.constructor()); return Math.hypot(d.x - b[0], d.z - b[2]) > .3; }, before, { timeout: 30000 });
  await fps.evaluate(() => { window.__pad.axes[2] = 0; });
  console.log('PASS the right stick looks around in first person');
  assert.deepEqual(fps.errors, []);
  await fps.context().close();
} finally {
  await browser.close();
}
