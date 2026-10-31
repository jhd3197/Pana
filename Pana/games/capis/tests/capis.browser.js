// One player against the machine, played with real keys: the lobby starts a
// match on the Llanos riverbank, our capi walks and fires La Bazuca de
// pintura (Space held, then released), the shell digs a crater, the bot plays
// its turn and fires, and a won match shows the results and returns to the lobby.
// Run: npm run test:browser -- capis   (CAPIS_SHOTS=<folder> also saves screenshots)
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), shots = process.env.CAPIS_SHOTS;
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, `capis-${name}.png`) }) : null;
try {
  const page = await openGame(browser, 'capis', { name: 'Ana', query: 'debug' });
  assert.equal(await page.evaluate(() => capisDebug.world.camera.isPerspectiveCamera), true, 'a 3D scene with a perspective camera');
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).has('room')), false, 'single player: no room in the address');
  await page.locator('[data-room-option="seconds"][data-value="30"]').click();
  await waitFor(page, () => capisDebug.options().seconds === 30);
  await shot(page, 'lobby');
  await page.locator('#start').click();
  await waitFor(page, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.turn.team === 0);
  assert.equal(await page.evaluate(() => capisDebug.match.turn.time <= 30), true);

  // Walk right with the keyboard.
  const me = () => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy); };
  const start = await page.evaluate(me);
  await page.keyboard.down('d');
  await waitFor(page, ({ x }) => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy).x > x + .5; }, start);
  await page.keyboard.up('d');

  // Calm the wind so the shell lands on the bank, then charge and release.
  await page.evaluate(() => { capisDebug.match.wind = 0; });
  const solid = () => capisDebug.match.mask.solid.reduce((a, b) => a + b, 0);
  const before = await page.evaluate(solid);
  await page.keyboard.down(' ');
  await waitFor(page, () => !document.getElementById('power-bar').hidden && parseInt(document.getElementById('power-value').textContent, 10) >= 55);
  await shot(page, 'charging');
  await page.keyboard.up(' ');
  await waitFor(page, () => capisDebug.match.shots === 1);
  await waitFor(page, () => capisDebug.match.phase === 'flight');
  await shot(page, 'flight');
  await waitFor(page, () => capisDebug.match.phase !== 'flight');
  const after = await page.evaluate(solid);
  assert.ok(after < before - 300, `the shell dug a crater (${before - after} cells)`);
  assert.ok(await page.evaluate(() => capisDebug.match.mask.stain.some(v => v > 0)), 'paint on the ground');
  await shot(page, 'crater');

  // The machine plays its turn and fires before its clock runs out.
  await waitFor(page, () => capisDebug.match.turn.n === 2 && capisDebug.match.turn.team === 1);
  await waitFor(page, () => capisDebug.match.shots === 2 || capisDebug.match.phase === 'finished');
  await shot(page, 'bot');
  await waitFor(page, () => capisDebug.match.turn.n === 3 || capisDebug.match.phase === 'finished');

  // Finish it: the rivals are all painted; the turn ends and we win.
  await page.evaluate(() => { const m = capisDebug.match; m.capys.filter(c => c.team === 1).forEach(c => { c.paint = 100; c.out = 'paint'; }); if (m.phase === 'aim') m.turn.time = .01; });
  await waitFor(page, () => capisDebug.match.phase === 'finished' && !document.getElementById('results').hidden);
  assert.equal(await page.evaluate(() => capisDebug.match.winner), 0);
  assert.match(await page.locator('#result-title').textContent(), /Ganaron/);
  await shot(page, 'results');
  await page.locator('#again').click();
  await waitFor(page, () => !document.getElementById('lobby').hidden && !capisDebug.playing);
  assert.deepEqual(page.errors, []);
  console.log('PASS capis: lobby → match, walk, charge and fire, crater and paint, the bot\'s turn, a win, results, back to the lobby.');
} finally { await browser.close(); }
