// Device arbitration, real input deltas, persistence and the full-screen UI.
import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';
const browser = await launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/ajustes.html`);
  await page.locator('.pana-settings-workspace').waitFor();
  const category = name => page.locator('.pana-settings-nav button', { hasText: name }).click();
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const setting = (key, value) => page.locator(`#pana-input-${key}`).evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  await category('Ratón y teclado'); await setting('mouseSensitivity', 2);
  await setting('mouseVertical', .5);
  await page.getByRole('switch', { name: 'Invertir eje vertical', exact: true }).first().click();
  // Use the same first-person controls as gameplay and measure actual deltas.
  const deltas = await page.evaluate(async () => {
    const { createLookControls } = await import('/engine/play/first-person.js');
    const { setSettings } = await import('/engine/settings.js');
    const canvas = document.createElement('canvas'); document.body.append(canvas);
    canvas.setPointerCapture = () => {}; canvas.requestPointerLock = null;
    const seen = [], look = createLookControls(canvas, { look: (x, y) => seen.push([x, y]) });
    const drag = type => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 99, pointerType: type, clientX: 0, clientY: 0 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 99, pointerType: type, clientX: 100, clientY: 100 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99, pointerType: type }));
    };
    drag('mouse'); setSettings({ touchSensitivity: .5, touchInvertY: false }); drag('touch');
    look.dispose(); canvas.remove(); return seen;
  });
  assert.ok(Math.abs(deltas[0][0] + .48) < 1e-8);
  assert.ok(Math.abs(deltas[0][1] - .24) < 1e-8, 'mouse vertical scaling and inversion apply');
  assert.deepEqual(deltas[1], [-.3, -.3], 'touch uses its own sensitivity');
  const other = await context.newPage(); await other.goto(`${base}/ajustes.html`);
  await other.locator('.pana-settings-workspace').waitFor();
  await setting('mouseSensitivity', 1.5);
  await other.waitForFunction(async () => (await import('/engine/settings.js')).getSettings().mouseSensitivity === 1.5);
  await other.close(); await page.bringToFront();
  await page.reload(); await page.locator('.pana-settings-workspace').waitFor();
  assert.equal(await page.evaluate(async () => (await import('/engine/settings.js')).getSettings().mouseSensitivity), 1.5);
  console.log('PASS input deltas, independent touch settings, persistence and cross-tab changes');

  await page.evaluate(() => {
    window.__pad = { id: 'Sony DualSense 054c', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad]; dispatchEvent(new Event('gamepadconnected'));
  });
  await page.waitForFunction(() => document.documentElement.dataset.panaInput === 'gamepad');
  assert.match(await page.locator('.pana-menu-pad-hint').innerText(), /Cruz.*Círculo/);
  await page.keyboard.press('ArrowDown');
  await frames();
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'keyboard', 'idle pad does not reclaim keyboard focus');
  await page.evaluate(() => new Promise(resolve => { let value=0; function ramp(){ window.__pad.axes[0]=value+=.01; if(value>=.5)resolve();else requestAnimationFrame(ramp); } ramp(); }));
  await frames();
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'gamepad', 'slow stick travel detects the controller');
  await page.mouse.move(100,100); await page.mouse.move(700,400); await frames();
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'gamepad', 'mouse hover does not steal sustained controller input');
  await page.evaluate(() => { __pad.axes[0]=0; }); await frames();
  await category('Mando'); await setting('padDeadzone', .3); await setting('padLookSensitivity', 2);
  await page.getByRole('button', { name: 'Probar sticks y botones', exact: true }).click();
  await page.evaluate(() => { __pad.axes = [.2, 0, 1, 0]; __pad.buttons[7] = { pressed: true, value: .7 }; });
  await page.waitForFunction(() => document.querySelectorAll('.pana-stick-values')[1].value.startsWith('2.00'));
  assert.equal(await page.locator('.pana-stick-values').first().evaluate(n => n.value), '0.00 / 0.00');
  assert.equal(await page.locator('[data-button=rt]').getAttribute('class'), 'pana-test-cap pressed');
  assert.equal(await page.locator('[data-pad-test-active]').count(), 1, 'tester consumes navigation');
  await page.evaluate(() => { __pad.buttons[1] = { pressed: true, value: 1 }; });
  await page.waitForFunction(() => !document.querySelector('[data-pad-test-active]'));
  assert.equal(await page.locator('dialog').evaluate(d => d.open), true, 'B exits tester before closing settings');
  await page.evaluate(() => { __pad.buttons[1] = { pressed: false, value: 0 }; __pad.axes = [0, 0, 0, 0]; __pad.buttons[7] = { pressed: false, value: 0 }; });
  await frames();
  await page.evaluate(() => { __pad = null; dispatchEvent(new Event('gamepaddisconnected')); });
  await page.waitForFunction(() => document.querySelector('.pana-device-status').textContent === 'Sin mando conectado');
  assert.equal(await page.locator('html').getAttribute('data-pana-input'), 'keyboard');
  console.log('PASS controller detection, family labels, idle arbitration, live test and disconnect');

  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    for (const name of ['Ratón y teclado', 'Mando', 'Pantalla táctil', 'Imagen', 'Audio']) {
      await category(name);
      assert.equal(await page.locator('.pana-menu').evaluate(n => n.scrollWidth > n.clientWidth + 1), false, `${name} fits ${viewport.width}`);
    }
  }
  await page.locator('.pana-reset').click();
  assert.equal(await page.evaluate(async () => (await import('/engine/settings.js')).getSettings().mouseSensitivity), 1);
  await page.evaluate(async () => {
    const { padControls } = await import('/engine/gamepad.js');
    const { setSettings } = await import('/engine/settings.js');
    document.querySelector('dialog').close();
    padControls({ playing: () => true, keys: { rt: ['Space', 'Probar acción'] } });
    setSettings({ inputHints: 'gamepad' });
  });
  await page.locator('.pana-pad-prompts').waitFor();
  assert.match(await page.locator('.pana-pad-prompts').innerText(), /Probar acción/, 'manual prompts work without a connected pad');
  assert.deepEqual(errors, []); await context.close();
  // A physical touch input changes hints too; a saved explicit choice wins.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touch = await mobile.newPage(); await touch.goto(`${base}/ajustes.html`);
  await touch.locator('.pana-settings-workspace').waitFor();
  await touch.getByText('Opciones de las ayudas', { exact: true }).tap();
  await touch.getByRole('radio', { name: 'Teclado', exact: true }).tap();
  assert.equal(await touch.locator('html').getAttribute('data-pana-input'), 'keyboard');
  await touch.getByRole('radio', { name: 'Automático', exact: true }).first().tap();
  assert.equal(await touch.locator('html').getAttribute('data-pana-input'), 'touch');
  await mobile.close();
  console.log('PASS responsive categories, reset, touch detection and explicit hint preference');
} finally { await browser.close(); }
