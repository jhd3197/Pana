// The chancla in the shared gloved hand: first person, Arma 2 in the real loop. The
// hand wraps the weapon's grip and leaves when the marker comes back.
// PANA_VIEWMODEL_SHOTS=<folder> saves viewmodel-<PANA_VIEWMODEL_TAG>-pepazo-chancla.png.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const shots = process.env.PANA_VIEWMODEL_SHOTS, tag = process.env.PANA_VIEWMODEL_TAG || 'after', check = text => console.log(`ok  ${text}`);
const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Juan', query: 'debug' });
  page.setDefaultTimeout(90_000);
  await waitFor(page, () => window.pinturaDebug?.world && pinturaDebug.room.connected && window.PANA_PREPARED);
  await page.locator('#practice').click();
  await waitFor(page, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing');
  await waitFor(page, () => pinturaDebug.world.held?.visible);
  assert.equal(await page.evaluate(() => pinturaDebug.world.meleeHand.visible), false, 'a marker has no shared hand');
  check('the marker keeps its own look');

  await page.keyboard.press('q');
  await waitFor(page, () => pinturaDebug.room.state.players.find(q => q.id === pinturaDebug.room.id).weapon === 'sandal' && pinturaDebug.world.meleeHand.visible);
  const apart = await page.evaluate(() => { const { held, meleeHand } = pinturaDebug.world; return meleeHand.hand.position.distanceTo(held.position) + meleeHand.hand.quaternion.angleTo(held.quaternion); });
  assert.ok(apart < .05, `the hand wraps the grip: ${apart}`);
  await page.evaluate(() => new Promise(r => { let n = 20; const f = () => --n <= 0 ? r() : requestAnimationFrame(f); f(); }));
  if (shots) await page.screenshot({ path: path.join(shots, `viewmodel-${tag}-pepazo-chancla.png`) });
  check('the chancla is held by the gloved hand');

  await page.keyboard.press('q');
  await waitFor(page, () => pinturaDebug.room.state.players.find(q => q.id === pinturaDebug.room.id).weapon !== 'sandal' && !pinturaDebug.world.meleeHand.visible);
  assert.deepEqual(page.errors, []);
  check('switching back hides the hand, no errors');
} finally { await browser.close(); }
