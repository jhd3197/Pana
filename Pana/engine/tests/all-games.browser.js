// Smoke check for every game on disk: the page prepares its scene, shows the
// shared lobby, draws a WebGL (3D) canvas and logs no errors. New games are
// covered automatically. CI runs this suite on every push.
// Run: node Pana/engine/tests/all-games.browser.js   (env PANA_TEST_URL)
import assert from 'node:assert/strict';
import { games, launch, openGame, waitPrepared } from '../../tests/browser-kit.js';
import { wardrobeToAvatar } from '../avatar.js';

// Exercise the editor's complete saved schema in every game's actual renderer.
const avatar = wardrobeToAvatar({ hat: 'casco', glasses: 'visor', top: 'hoodie',
  print: 'rayo', neck: 'bandana', back: 'capa', extras: { pecas: true }, wrist: true,
  colors: { 'top:hoodie:main': '#2ad1b2', 'hat:casco:main': '#ff4b4b' } });

// Games that keep their own pre-game menu instead of the shared lobby, and why.
const OWN_MENU = { carreritas: 'four-step garage menu (docs/knowledge/carreritas-menu.md)' };
const only = process.env.PANA_SMOKE_GAMES?.split(',').filter(Boolean) || games;
const browser = await launch();
const failures = [];
try {
  for (const game of only) {
    const started = Date.now();
    let page;
    try {
      page = await openGame(browser, game, { room: `smoke-${game}-${Date.now()}`, avatar, wait: false });
      await waitPrepared(page);
      const view = await page.evaluate(() => ({
        lobby: !!document.querySelector('#pana-lobby-shell'),
        // A canvas already bound to WebGL refuses a 2D context; asking for WebGL
        // instead would create one on any spare canvas and always pass.
        webgl: [...document.querySelectorAll('canvas')].some(c => c.getContext('2d') === null),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      if (!view.lobby && !OWN_MENU[game]) failures.push(`${game}: no shared lobby (#pana-lobby-shell)`);
      if (!view.webgl) failures.push(`${game}: no WebGL canvas; every game is a 3D scene`);
      if (view.overflow) failures.push(`${game}: page scrolls sideways`);
      if (!OWN_MENU[game]) {
        for (const viewport of [{ width: 860, height: 560 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
          await page.setViewportSize(viewport);
          const footerFits = await page.locator('.pk-game-lobby-foot').first().evaluate(footer => {
            const r = footer.getBoundingClientRect();
            return r.y >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
          });
          if (!footerFits) failures.push(`${game}: lobby actions clipped at ${viewport.width}×${viewport.height}`);
          const leftovers = await page.locator('.pk-game-lobby-settings').evaluate(settings => {
            const more = settings.querySelector('#pana-room-more');
            if (!more || more.hidden) return ['missing Más ajustes'];
            const bottom = more.getBoundingClientRect().bottom;
            return [...settings.querySelectorAll('*')].filter(el =>
              !el.closest('.sala-connection') && el !== more && !el.contains(more) && !more.contains(el) &&
              el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
              el.getClientRects().length && el.getBoundingClientRect().bottom > bottom + 1
            ).map(el => el.id || el.className || el.tagName);
          });
          if (leftovers.length) failures.push(`${game}: controls after Más ajustes: ${leftovers.join(', ')}`);
        }
      }
      // The same settings room must remain usable under every game's CSS.
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.keyboard.press('Escape');
      await page.locator('.pana-menu[open]').waitFor();
      await page.locator('#pana-tab-settings').click();
      await page.locator('.pana-settings-workspace').waitFor();
      await page.locator('.pana-settings-nav button', { hasText: 'Ratón y teclado' }).click();
      assert.equal(await page.locator('#pana-input-mouseSensitivity').isVisible(), true, `${game}: shared input controls visible`);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('.pana-menu').evaluate(n => n.scrollWidth > n.clientWidth + 1), false, `${game}: settings fit a phone`);
      await page.keyboard.press('Escape');
      failures.push(...page.errors);
      await page.context().close();
      console.log(`${failures.some(f => f.startsWith(game)) ? 'FAIL' : 'ok  '}  ${game}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      failures.push(`${game}: ${error.message.split('\n')[0]}`);
      if (page) failures.push(...page.errors);
      console.log(`FAIL  ${game}`);
    } finally {
      // A failed preparation must not leave a scene rendering during later games.
      for (const context of browser.contexts()) await context.close();
    }
  }
  assert.deepEqual(failures, []);
  console.log(`PASS ${only.length} games prepare a 3D scene without errors.`);
} finally { await browser.close(); }
