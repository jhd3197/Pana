// Every game in real play: no HUD piece reads as a controls list (those live
// in the pause menu's Instrucciones page), no panel paints an empty box, and
// no two HUD pieces overlap, at
// 1280×720, 1920×1080, 1024×600 and a 390×844 phone held upright. A game
// with a hold-to-see layer (engine/hold-overlay.js, HOLD below) is checked
// with it closed, held open, and closed again on release.
// Run: node Pana/engine/tests/hud-layout.browser.js   (env PANA_TEST_URL; PANA_HUD_GAMES=a,b;
// PANA_HUD_SHOTS=<dir> saves a picture per game and size)
//
// A HUD piece is a visible fixed/absolute element that paints something,
// outside menus, dialogs, toasts, shouts and the lobby (tests/hud-check.js).
// Nested pieces count as one: a panel and its contents never "overlap".
import assert from 'node:assert/strict';
import { games, launch, openGame, waitFor } from '../../tests/browser-kit.js';
import { enterPlay, PLAY } from '../../tests/play-kit.js';
import { hudReport } from '../../tests/hud-check.js';

const SIZES = [[1280, 720], [1920, 1080], [1024, 600], [390, 844]];
// Overlaps that are the design, game:a|b → why. Keep it short.
const OVERLAP_OK = {};
// Hold-to-see layers: the key, and when the layer is open and filled.
const HOLD = {
  reliquia: { key: 'Tab', open: () => !document.getElementById('intel').hidden && document.getElementById('floor-name').textContent.includes('·'), closed: () => document.getElementById('intel').hidden },
};
const only = process.env.PANA_HUD_GAMES?.split(',').filter(Boolean) || games;
const browser = await launch();
const failures = [];
try {
  for (const game of only) {
    const started = Date.now();
    try {
      const page = await openGame(browser, game, { room: `hud-${game}-${Date.now()}`, query: PLAY[game]?.query ?? 'debug', wait: false });
      await page.setViewportSize({ width: 1280, height: 720 });
      await enterPlay(page, game);
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        // Two frames for the layout to settle after the resize.
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const hold = HOLD[game];
        for (const held of hold ? [false, true] : [false]) {
          if (held) { await page.keyboard.down(hold.key); await waitFor(page, hold.open, null, 10_000); }
          const where = `${game} ${width}×${height}${held ? ` holding ${hold.key}` : ''}`;
          const report = await page.evaluate(hudReport);
          if (process.env.PANA_HUD_SHOTS) await page.screenshot({ path: `${process.env.PANA_HUD_SHOTS}/${game}-${width}x${height}${held ? '-held' : ''}.png` });
          for (const list of report.lists) failures.push(`${where}: controls list on the HUD ${list}`);
          for (const empty of report.empties) failures.push(`${where}: empty HUD panel ${empty}`);
          for (const [a, b, area] of report.overlaps) {
            if (OVERLAP_OK[`${game}:${a}|${b}`] || OVERLAP_OK[`${game}:${b}|${a}`]) continue;
            failures.push(`${where}: ${a} overlaps ${b} (${area} px²)`);
          }
          if (held) {
            await page.keyboard.up(hold.key);
            await waitFor(page, hold.closed, null, 5000).catch(() => failures.push(`${where}: the layer stayed open after letting go`));
          }
        }
      }
      failures.push(...page.errors);
      console.log(`${failures.some(f => f.startsWith(game)) ? 'FAIL' : 'ok  '}  ${game}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      failures.push(`${game}: ${error.message.split('\n')[0]}`);
      console.log(`FAIL  ${game}`);
    } finally {
      for (const context of browser.contexts()) await context.close();
    }
  }
  assert.deepEqual(failures, []);
  console.log(`PASS ${only.length} games: no controls lists and no overlapping HUD pieces in play.`);
} finally { await browser.close(); }
