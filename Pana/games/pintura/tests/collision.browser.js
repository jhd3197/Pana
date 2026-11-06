// Pepazo's collision debug mode: off and unloaded by default, F9 measures the
// court and draws its colliders, Shift+F9 saves the JSON report. Then every
// court and variant is audited in turn: none may have a flagged collider.
// Blockers that are invisible on purpose (the court's edge) are listed, with
// the reason, in COLLISION_ALLOW in games/pintura/public/colliders.js.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
import { PAINT_ARENAS } from '../../../engine/worlds/arena-layouts.js';
import { VARIANTS } from '../public/rules.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Prueba' }), requested = [];
  page.on('request', r => requested.push(r.url()));
  assert.equal(await page.evaluate(() => 'PANA_COLLISION' in window), false, 'nothing loads without the flag');
  assert.ok(!requested.some(url => /collision-(debug|audit)\.js/.test(url)), 'the debug modules are not fetched');

  await page.keyboard.press('F9');
  await waitFor(page, () => window.PANA_COLLISION?.debug.report && window.PANA_COLLISION.debug.overlay.visible);
  const view = await page.evaluate(() => {
    const { report, overlay } = window.PANA_COLLISION.debug;
    const red = overlay.children.filter(line => line.material.color.getHexString() === 'ff2a2a').length;
    return { map: report.map, count: report.colliders.length, lines: overlay.children.length, red, flagged: report.flagged.length, sample: report.colliders[0], bounds: report.colliders.filter(c => c.source === 'court-bounds').map(c => c.allowed) };
  });
  assert.equal(view.map, 'terminal');
  assert.ok(view.count > 40, `El Puerto has its containers, shed and base gear (${view.count})`);
  assert.equal(view.lines, view.count, 'one wireframe per collider');
  assert.equal(view.red, view.flagged, 'flagged colliders are drawn red');
  for (const key of ['id', 'source', 'position', 'size', 'blocksShots', 'blocksMovement', 'health', 'mesh', 'flags']) assert.ok(key in view.sample, `a collider reports ${key}`);
  assert.deepEqual(view.bounds, [true, true, true, true], 'the court edge is invisible on purpose');

  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Shift+F9')]);
  assert.equal(download.suggestedFilename(), 'collision-terminal-0.json');
  await page.keyboard.press('F9');
  assert.equal(await page.evaluate(() => window.PANA_COLLISION.debug.overlay.visible), false, 'F9 again hides it');
  // One court at a time in this page, so the machine renders one map at once.
  const flagged = [];
  for (const { id } of PAINT_ARENAS) for (let variant = 0; variant < VARIANTS; variant++) {
    const found = await page.evaluate(([id, variant]) => window.PANA_COLLISION.audit(id, variant).then(r => r.flagged.map(c => `${c.id} ${c.source} [${c.flags}] -> ${c.fix?.action}`)), [id, variant]);
    flagged.push(...found);
  }
  assert.deepEqual(flagged, [], 'no court has a collider without a mesh to match (npm run collision-report -- --fix)');
  assert.deepEqual(page.errors, []);
  console.log(`ok: collision debug loads on F9, ${view.count} colliders on El Puerto, report downloads, ${PAINT_ARENAS.length * VARIANTS} courts with no flagged collider`);
} finally { await browser.close(); }
