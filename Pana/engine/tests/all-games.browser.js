// Smoke check for every game on disk: the page prepares its scene, shows the
// shared lobby, draws a WebGL (3D) canvas and logs no errors. New games are
// covered automatically. CI runs this suite on every push.
// Run: node Pana/engine/tests/all-games.browser.js   (env PANA_TEST_URL)
import assert from 'node:assert/strict';
import { games, launch, openGame } from '../../tests/browser-kit.js';

// Games that keep their own pre-game menu instead of the shared lobby, and why.
const OWN_MENU = { derrape: 'four-step garage menu (docs/knowledge/derrape-menu.md)' };
const only = process.env.PANA_SMOKE_GAMES?.split(',').filter(Boolean) || games;
const browser = await launch();
const failures = [];
try {
  for (const game of only) {
    const started = Date.now();
    try {
      const page = await openGame(browser, game, { room: `smoke-${game}-${Date.now()}` });
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
      failures.push(...page.errors);
      await page.context().close();
      console.log(`${failures.some(f => f.startsWith(game)) ? 'FAIL' : 'ok  '}  ${game}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      failures.push(`${game}: ${error.message.split('\n')[0]}`);
      console.log(`FAIL  ${game}`);
    }
  }
  assert.deepEqual(failures, []);
  console.log(`PASS ${only.length} games prepare a 3D scene without errors.`);
} finally { await browser.close(); }
