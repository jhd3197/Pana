// The pause menu's Instrucciones page (engine/controls-page.js): it opens from
// the menu, shows the game's declared goal and controls for the keyboard, then
// a controller's own button names when one is in use (live, PlayStation names
// for a PlayStation pad), and the touch column on a phone. Games' "Reglas"
// buttons (menu.open('controls')) land on it too.
// Run: node Pana/engine/tests/controls-page.browser.js   (env PANA_TEST_URL)
import assert from 'node:assert/strict';
import { launch, openGame } from '../../tests/browser-kit.js';

const GAMES = (process.env.PANA_HELP_GAMES || 'domino,galope,pintura').split(',');
const browser = await launch();
try {
  for (const game of GAMES) {
    const page = await openGame(browser, game, { room: `help-${game}-${Date.now()}` });
    await page.keyboard.press('Escape');
    await page.locator('dialog.pana-menu[open]').waitFor();
    await page.locator('#pana-tab-help').click();
    await page.locator('#pana-panel-help[data-ready]').waitFor();
    const help = page.locator('#pana-panel-help');
    assert.equal(await page.locator('#pana-tab-help').getAttribute('aria-selected'), 'true');
    assert.ok(await help.locator('.pana-help-goal').isVisible(), `${game}: the goal is on the page`);
    assert.equal(await help.locator('.pana-help-controls').getAttribute('data-device'), 'keyboard', `${game}: keyboard by default`);
    assert.ok(await help.locator('.pana-help-row').count() > 0, `${game}: keyboard rows`);
    assert.ok(await help.locator('.pana-help-row kbd').first().isVisible(), `${game}: keycaps visible`);

    // A controller in hand: the page follows it live and names its buttons.
    await page.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'gamepad', padFamily: 'playstation' }));
    await help.locator('.pana-help-controls[data-device=gamepad]').waitFor();
    const padText = await help.locator('.pana-help-controls').innerText();
    assert.ok(await help.locator('.pana-help-row kbd[data-pad-key]').count() > 0, `${game}: controller rows`);
    assert.match(padText, /Cruz|Círculo|Cuadrado|Triángulo|R2|L2|R1|L1|Joystick/, `${game}: PlayStation names`);
    assert.doesNotMatch(padText, /\bRT\b|\bLT\b/, `${game}: no Xbox names on a PlayStation pad`);
    // The player may still look at the keyboard column.
    await help.locator('[data-help-device=keyboard]').click();
    assert.equal(await help.locator('.pana-help-controls').getAttribute('data-device'), 'keyboard');
    await page.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'auto', padFamily: 'auto' }));

    // Reglas buttons and legacy open('controls') land on this page.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.pana-menu[open]'));
    await page.evaluate(() => document.querySelector('#rules')?.click());
    if (await page.locator('#rules').count()) {
      await page.locator('dialog.pana-menu[open]').waitFor();
      assert.equal(await page.locator('#pana-tab-help').getAttribute('aria-selected'), 'true', `${game}: Reglas opens Instrucciones`);
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
    console.log(`PASS ${game}: Instrucciones opens from the menu and follows the device`);
  }

  // A phone shows the touch column.
  const phone = await openGame(browser, GAMES[0], { room: `help-phone-${Date.now()}`, mobile: true });
  await phone.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'touch' }));
  await phone.locator('.pana-hud-button[aria-haspopup=dialog]').first().evaluate(b => b.click());
  await phone.locator('dialog.pana-menu[open]').waitFor();
  await phone.locator('#pana-tab-help').click();
  await phone.locator('.pana-help-controls[data-device=touch]').waitFor();
  assert.equal(await phone.locator('.pana-menu').evaluate(n => n.scrollWidth > n.clientWidth + 1), false, 'the page fits a phone');
  assert.deepEqual(phone.errors, []);
  console.log('PASS a phone sees the touch controls');
} finally { await browser.close(); }
