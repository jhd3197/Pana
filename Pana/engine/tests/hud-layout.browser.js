// Every game in real play: no HUD piece reads as a controls list (those live
// in the pause menu's Instrucciones page), no panel paints an empty box, and
// no two HUD pieces overlap, at
// 1280×720, 1920×1080, 1024×600 and a 390×844 phone held upright. A game
// with a hold-to-see layer (engine/hold-overlay.js, HOLD below) is checked
// with it closed, held open, and closed again on release; held open, the
// pieces it lists as `apart` (Reliquia's compass tags) must not touch either.
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
  // stage: put the layer's busiest case on screen first; apart: pieces inside the layer that
  // must not touch each other (the HUD check counts the layer as one piece).
  reliquia: {
    key: 'Tab', query: 'debug', apart: '#compass .compass-mark, #compass .compass-tag', least: ['#compass .compass-tag', 3],
    open: () => !document.getElementById('intel').hidden && document.getElementById('floor-name').textContent.includes('·'),
    closed: () => document.getElementById('intel').hidden,
    // A floor with a lift, a cargo pad and a seal, standing past the pad on the line from the
    // lift so MONTACARGAS and CARGA share a bearing, with the compass in hand for TESORO.
    stage: () => {
      const r = window.reliquia, g = r.room.game, run = g.layout.run, p = g.players.find(q => q.id === r.room.id);
      const f = run.seals.find(s => run.cargo.some(c => c.floor === s.floor) && run.lifts.some(l => l.floor === s.floor)).floor;
      const lift = run.lifts.find(l => l.floor === f), pad = run.cargo.find(c => c.floor === f), dx = pad.x - lift.x, dz = pad.z - lift.z, d = Math.hypot(dx, dz), h = Math.atan2(-dx, -dz);
      p.hands[0] = { id: -1, kind: 'compass', worth: 1 };
      r.place(p.id, pad.x + dx / d * 2, pad.z + dz / d * 2, h); r.face(h);
    },
  },
};
const only = process.env.PANA_HUD_GAMES?.split(',').filter(Boolean) || games;
const browser = await launch();
const failures = [];
try {
  for (const game of only) {
    const started = Date.now();
    try {
      const page = await openGame(browser, game, { room: `hud-${game}-${Date.now()}`, query: HOLD[game]?.query ?? PLAY[game]?.query ?? 'debug', wait: false });
      await page.setViewportSize({ width: 1280, height: 720 });
      await enterPlay(page, game);
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        // Two frames for the layout to settle after the resize.
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const hold = HOLD[game];
        for (const held of hold ? [false, true] : [false]) {
          if (held) { if (hold.stage) await page.evaluate(hold.stage); await page.keyboard.down(hold.key); await waitFor(page, hold.open, null, 10_000); }
          const where = `${game} ${width}×${height}${held ? ` holding ${hold.key}` : ''}`;
          const report = await page.evaluate(hudReport);
          if (process.env.PANA_HUD_SHOTS) await page.screenshot({ path: `${process.env.PANA_HUD_SHOTS}/${game}-${width}x${height}${held ? '-held' : ''}.png` });
          for (const list of report.lists) failures.push(`${where}: controls list on the HUD ${list}`);
          for (const empty of report.empties) failures.push(`${where}: empty HUD panel ${empty}`);
          for (const [a, b, area] of report.overlaps) {
            if (OVERLAP_OK[`${game}:${a}|${b}`] || OVERLAP_OK[`${game}:${b}|${a}`]) continue;
            failures.push(`${where}: ${a} overlaps ${b} (${area} px²)`);
          }
          if (held && hold.apart) {
            // The layer has drawn the staged scene once its pieces are all there.
            await waitFor(page, ([selector, n]) => [...document.querySelectorAll(selector)].filter(e => e.checkVisibility()).length >= n, hold.least, 5000).catch(() => {});
            const { labels, least, hits } = await page.evaluate(([selector, many]) => {
              const shown = [...document.querySelectorAll(selector)].filter(n => n.checkVisibility());
              const boxes = shown.map(n => [n.textContent, n.getBoundingClientRect()]);
              const hits = [];
              for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
                const [a, p] = boxes[i], [b, q] = boxes[j], w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
                if (w > 0 && h > 0) hits.push(`${a} overlaps ${b} (${Math.round(w * h)} px²)`);
              }
              return { labels: boxes.map(([text]) => text), least: shown.filter(n => n.matches(many)).length, hits };
            }, [hold.apart, hold.least[0]]);
            if (least < hold.least[1]) failures.push(`${where}: only ${least} of ${hold.least[0]} to keep apart (${labels.join(', ')})`);
            for (const hit of hits) failures.push(`${where}: ${hit}`);
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
