// One player against the machine, played with real keys: the lobby shows the
// map of ?seed=6, a bigger size rebuilds it, and starts a match on it, our capi walks and fires La Bazuca de
// pintura (Space held, then released), the shell digs a crater, the bot plays
// its turn and fires, the weapon picker switches by key and by tap and every
// weapon fires once, and a won match shows the results, replays the same map
// and returns to the lobby with a new one.
// Run: npm run test:browser -- capis   (CAPIS_SHOTS=<folder> also saves screenshots)
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), shots = process.env.CAPIS_SHOTS;
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, `capis-${name}.png`) }) : null;
try {
  const page = await openGame(browser, 'capis', { name: 'Ana', query: 'debug&seed=6' });
  assert.equal(await page.evaluate(() => capisDebug.world.camera.isPerspectiveCamera), true, 'a 3D scene with a perspective camera');
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).has('room')), false, 'single player: no room in the address');
  await page.locator('[data-room-option="seconds"][data-value="30"]').click();
  await waitFor(page, () => capisDebug.options().seconds === 30);
  // The lobby shows the seed's map; a large map rebuilds the ground and the world at its new size.
  assert.match(await page.locator('#lobby-seed').textContent(), /#6\b/);
  assert.equal(await page.evaluate(() => capisDebug.match.map.width), 140);
  await page.evaluate(() => document.querySelector('[data-room-option="size"][data-value="large"]').click());
  await waitFor(page, () => capisDebug.match.map.width === 180 && capisDebug.world.match === capisDebug.match);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => document.querySelector('[data-room-option="size"][data-value="medium"]').click());
  await waitFor(page, () => capisDebug.match.map.width === 140 && capisDebug.match.map.seed === 6);
  await shot(page, 'lobby');
  await page.locator('#start').click();
  await waitFor(page, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.turn.team === 0);
  assert.equal(await page.evaluate(() => capisDebug.match.turn.time <= 30), true);
  assert.equal(await page.evaluate(() => capisDebug.match.map.seed), 6, 'the match is played on the lobby\'s map');
  assert.match(await page.locator('#map-seed').textContent(), /#6\b/);
  assert.match(await page.evaluate(() => location.search), /seed=6/, 'the address replays the map');

  // Walk right with the keyboard.
  const me = () => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy); };
  const start = await page.evaluate(me);
  await page.keyboard.down('d');
  await waitFor(page, ({ x }) => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy).x > x + .5; }, start);
  await page.keyboard.up('d');

  // Every capi is a pana from the shared studio model with a team bandana,
  // holding the shared La Bazuca (batched); only the capi on its turn raises it,
  // and the shell will leave from the barrel tip you see.
  const capis = await page.evaluate(() => capisDebug.world.inspect());
  assert.equal(capis.length, 6);
  for (const c of capis) {
    assert.equal(c.model, 'studio-v1', `${c.id} uses the Pana avatar`);
    assert.equal(c.launcher, 'La Bazuca', `${c.id} starts with La Bazuca`);
    assert.ok(c.held && c.draws <= 6, `${c.id}'s launcher is batched (${c.draws} draws)`);
  }
  assert.deepEqual([...new Set(capis.map(c => c.bandana))].length, 2, 'one bandana colour per team');
  assert.deepEqual(capis.filter(c => c.raised).map(c => c.id), [await page.evaluate(() => capisDebug.match.turn.capy)]);

  // Level of detail: in the play view the capi on its turn is the full pana
  // (dozens of meshes); in the whole-map view every capi, launcher included,
  // is one merged far copy, so the frame stays near its old draw count.
  const mine = capis.find(c => c.raised);
  assert.ok(!mine.far && mine.drawn > 20, `the capi on its turn is drawn at full detail (${mine.drawn} meshes)`);
  await page.evaluate(() => { capisDebug.world.wide = true; });
  await waitFor(page, () => capisDebug.world.inspect().every(c => c.far && c.drawn === 1));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const wideCalls = await page.evaluate(() => capisDebug.world.calls);
  assert.ok(wideCalls < 140, `the whole-map view stays light (${wideCalls} draws)`);
  await page.evaluate(() => { capisDebug.world.wide = false; });
  await waitFor(page, () => { const m = capisDebug.match, c = capisDebug.world.inspect().find(k => k.id === m.turn.capy); return !c.far && c.drawn > 20; });
  await page.keyboard.down('w');
  await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).aim > .9);
  await page.keyboard.up('w');
  await waitFor(page, () => { const c = capisDebug.world.inspect().find(k => k.raised); return Math.hypot(c.tip.x - c.muzzle.x, c.tip.y - c.muzzle.y) < .03; });
  if (shots) {
    await page.evaluate(() => { capisDebug.world.closeUp = 8; });
    await waitFor(page, () => { const m = capisDebug.match, c = m.capys.find(k => k.id === m.turn.capy); const p = capisDebug.world.camera.position; return Math.abs(p.x - c.x) < 1.5; });
    await page.screenshot({ path: path.join(shots, 'capis-models-aim.png') });
  }

  // Back to the usual lob. Calm the wind so the shell lands on the bank, then charge and release.
  await page.evaluate(() => { const m = capisDebug.match; m.capys.find(c => c.id === m.turn.capy).aim = .55; m.wind = 0; });
  const solid = () => capisDebug.match.mask.solid.reduce((a, b) => a + b, 0);
  const before = await page.evaluate(solid);
  await page.keyboard.down(' ');
  await waitFor(page, () => !document.getElementById('power-bar').hidden && parseInt(document.getElementById('power-value').textContent, 10) >= 55);
  await shot(page, 'charging');
  if (shots) await page.screenshot({ path: path.join(shots, 'capis-models-charge.png') });
  await page.keyboard.up(' ');
  await page.evaluate(() => { capisDebug.world.closeUp = 0; });
  await waitFor(page, () => capisDebug.match.shots === 1);
  await waitFor(page, () => capisDebug.match.phase === 'flight');
  await shot(page, 'flight');
  await waitFor(page, () => capisDebug.match.phase !== 'flight');
  const after = await page.evaluate(solid);
  assert.ok(after < before - 300, `the shell dug a crater (${before - after} cells)`);
  assert.ok(await page.evaluate(() => capisDebug.match.mask.stain.some(v => v > 0)), 'paint on the ground');
  await shot(page, 'crater');

  // The machine plays its turn and fires before its clock runs out.
  // Its shot may be La Piñita: fuse, retreat and settle are slow under software WebGL, so these waits are longer.
  await waitFor(page, () => capisDebug.match.turn.n === 2 && capisDebug.match.turn.team === 1, undefined, 240_000);
  await waitFor(page, () => capisDebug.match.shots === 2 || capisDebug.match.phase === 'finished', undefined, 240_000);
  await shot(page, 'bot');
  await waitFor(page, () => capisDebug.match.turn.n === 3 || capisDebug.match.phase === 'finished', undefined, 240_000);

  // The weapon picker: five square buttons, keys 1-5, Q E and Tab cycle, a tap
  // picks; the capi holds what it picked; then each weapon fired once.
  const ours = () => { const m = capisDebug.match; m.shells = []; m.shot = null; m.phase = 'aim'; m.turn.team = 0; m.turn.capy = m.capys.find(c => c.team === 0 && !c.out).id; m.turn.time = 999; m.wind = 0; m.capys.forEach(c => { if (!c.out) c.paint = Math.min(c.paint, 10); }); };
  const held = () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon;
  const lit = () => document.querySelector('.weapon-btn.is-on')?.dataset.weapon;
  if (await page.evaluate(() => capisDebug.match.phase) !== 'finished') {
    await page.evaluate(ours);
    assert.equal(await page.locator('.weapon-btn').count(), 5);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.weapon-btn')).borderRadius), '0px', 'square corners');
    await page.keyboard.press('2'); await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === 'grenade');
    await waitFor(page, () => document.querySelector('.weapon-btn.is-on')?.dataset.weapon === 'grenade');
    await waitFor(page, () => capisDebug.world.inspect().find(c => c.raised)?.launcher === 'La Piñita');
    // La Piñita has no grips: it sits in both paws, each paw's end on its surface.
    await waitFor(page, () => capisDebug.world.inspect().find(c => c.raised).grip.every(d => d < .3));
    // Far away (the whole map) each capi's one-draw copy shows the weapon in its paws, not La Bazuca.
    await page.evaluate(() => { capisDebug.match.capys.forEach((c, i) => { if (!c.out) c.weapon = ['grenade', 'sniper', 'scatter', 'drill', 'bazooka', 'grenade'][i]; }); capisDebug.world.wide = true; });
    await waitFor(page, () => capisDebug.world.inspect().filter(c => !capisDebug.match.capys.find(k => k.id === c.id).out).every(c => c.far && c.drawn === 1 && c.launcher === c.launcherFor));
    await page.evaluate(() => { capisDebug.world.wide = false; });
    await page.keyboard.press('e'); await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === 'sniper');
    await page.keyboard.press('q'); await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === 'grenade');
    await page.keyboard.press('Tab'); await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === 'sniper');
    await page.locator('.weapon-btn[data-weapon="drill"]').click(); await waitFor(page, () => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === 'drill');
    assert.equal(await page.evaluate(lit), 'drill');
    // Charging shows the weapon's own path: La Piñita's ends in a ring where it bursts.
    await page.keyboard.press('2');
    await page.keyboard.down(' ');
    await waitFor(page, () => !document.getElementById('power-bar').hidden && parseInt(document.getElementById('power-value').textContent, 10) >= 30);
    await page.keyboard.up(' ');
    await waitFor(page, () => capisDebug.match.phase !== 'aim');
    await waitFor(page, () => capisDebug.match.phase !== 'flight', undefined, 240_000);
    for (const [i, weapon] of ['bazooka', 'grenade', 'sniper', 'drill', 'scatter'].entries()) {
      await page.evaluate(ours);
      await page.evaluate(w => { capisDebug.match.ammo[0][w] = 5; }, weapon);
      await page.keyboard.press(String(i + 1));
      await waitFor(page, w => capisDebug.match.capys.find(c => c.id === capisDebug.match.turn.capy).weapon === w, weapon);
      const shots = await page.evaluate(() => capisDebug.match.shots);
      await page.evaluate(() => { const c = capisDebug.match.capys.find(k => k.id === capisDebug.match.turn.capy); c.facing = 1; c.aim = .5; capisDebug.fire(.6); });
      await waitFor(page, n => capisDebug.match.shots === n + 1, shots);
      assert.equal(await page.evaluate(() => capisDebug.match.used[capisDebug.match.shot?.weapon ?? 'none'] > 0 || capisDebug.match.phase !== 'flight'), true);
      await waitFor(page, () => capisDebug.match.phase !== 'flight', undefined, 240_000);
    }
    assert.deepEqual(page.errors, [], 'every weapon fired without errors');
    await page.evaluate(ours);
    assert.ok(await page.evaluate(() => capisDebug.world.calls) <= 150, 'the play view stays light with every weapon\'s models');
  }

  // Finish it: the rivals are all painted; the turn ends and we win.
  await page.evaluate(() => { const m = capisDebug.match; m.capys.filter(c => c.team === 1).forEach(c => { c.paint = 100; c.out = 'paint'; }); if (m.phase === 'aim') m.turn.time = .01; });
  if (shots) {
    await waitFor(page, () => capisDebug.match.phase === 'finished');
    await page.evaluate(() => { capisDebug.world.wide = true; });
    await page.screenshot({ path: path.join(shots, 'capis-models-cheer.png') });
  }
  await waitFor(page, () => capisDebug.match.phase === 'finished' && !document.getElementById('results').hidden);
  assert.equal(await page.evaluate(() => capisDebug.match.winner), 0);
  assert.match(await page.locator('#result-title').textContent(), /Ganaron/);
  await shot(page, 'results');
  // A rematch on the same map, then back to the lobby with a new one.
  const ground = await page.evaluate(() => capisDebug.match.mask.solid.length);
  await page.locator('#same-map').click();
  await waitFor(page, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.turn.n === 1 && capisDebug.match.shots === 0);
  assert.equal(await page.evaluate(() => capisDebug.match.map.seed), 6);
  assert.equal(await page.evaluate(() => capisDebug.match.mask.solid.length), ground);
  await page.evaluate(() => { const m = capisDebug.match; m.capys.filter(c => c.team === 1).forEach(c => { c.paint = 100; c.out = 'paint'; }); m.turn.time = .01; });
  await waitFor(page, () => capisDebug.match.phase === 'finished' && !document.getElementById('results').hidden);
  await page.locator('#again').click();
  await waitFor(page, () => !document.getElementById('lobby').hidden && !capisDebug.playing);
  assert.notEqual(await page.evaluate(() => capisDebug.match.map.seed), 6, 'another match brings another map');
  assert.deepEqual(page.errors, []);
  console.log('PASS capis: the seed map in the lobby, a size change, match, walk, charge and fire, crater and paint, the bot\'s turn, the weapon picker and every weapon fired, a win, results, a rematch on the same map, back to the lobby with a new map.');
} finally { await browser.close(); }
