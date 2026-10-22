import { resultClick } from './menu-helpers.js';
import { menuClick } from './menu-helpers.js';
// npm start, then node this file. The garage setup drives real races: a full
// four-track cup with points and a trophy, a balloon battle to the last car,
// mirror mode, lap count and rival difficulty.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'carreritas-qa');
await mkdir(output, { recursive: true });
const errors = [];
const finishRace = (page) => page.evaluate(() => {
  race.state = 'go'; race.count = 0;
  const p = race.player;
  p.lap = race.laps + 1;
  for (let i = 0; i < 3 && race.state !== 'end'; i++) updateRace(1 / 60);
  return race.state;
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/carreritas/?debug&manual`);
  // A bronze trophy unlocks mirror mode (the taller's first unlock).
  await page.evaluate(() => { localStorage.removeItem('carreritas:setup'); localStorage.removeItem('carreritas:profile'); localStorage.setItem('carreritas:trophies', JSON.stringify({ arepa: 'bronce' })); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);

  // Easy rivals, two laps, mirrored.
  await menuClick(page, '[data-difficulty="facil"]');
  await menuClick(page, '[data-laps="2"]');
  await menuClick(page, '#mirror');
  await page.screenshot({ path: join(output, 'modes-garage.png') });
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');
  const options = await page.evaluate(() => ({ laps: race.laps, mirror: race.scene.scale.x,
    skills: race.cars.filter(c => !c.isPlayer).map(c => c.skill), lap: document.getElementById('lap').textContent }));
  assert.equal(options.laps, 2);
  assert.equal(options.mirror, -1);
  assert.ok(options.skills.every(s => s >= 0.8 && s <= 0.88), `easy skills ${options.skills}`);
  await page.evaluate(() => { race.state = 'go'; race.count = 0; for (let i = 0; i < 30; i++) updateRace(1 / 60); renderer.render(race.scene, race.camera); });
  await page.screenshot({ path: join(output, 'modes-mirror.png') });
  assert.equal(await finishRace(page), 'end');
  await resultClick(page, '#back');
  await menuClick(page, '#mirror');

  // A full Copa Pana: four tracks, same rivals, points, a trophy.
  await menuClick(page, '[data-mode="pana"]');
  const tracks = [], rivals = [];
  for (let n = 0; n < 4; n++) {
    if (n === 0) await menuClick(page, '#play');
    else await resultClick(page, '#again');
    await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ track: getActiveTrack().id, rivals: race.cars.filter(c => !c.isPlayer).map(c => c.entrantId).sort().join() }));
    tracks.push(info.track); rivals.push(info.rivals);
    assert.equal(await finishRace(page), 'end');
    const cup = await page.evaluate(() => ({ visible: !document.getElementById('cup-table').hidden,
      rows: document.querySelectorAll('#cup-board li').length, again: document.getElementById('again').textContent }));
    assert.ok(cup.visible && cup.rows === 8, `cup table ${JSON.stringify(cup)}`);
    assert.equal(cup.again, n < 3 ? 'Siguiente pista' : 'Otra copa');
  }
  await page.screenshot({ path: join(output, 'modes-cup.png') });
  assert.deepEqual(tracks, ['estadio', 'plaza', 'llanos', 'bululu']);
  assert.equal(new Set(rivals).size, 1, 'the same rivals race the whole cup');
  const trophy = await page.evaluate(() => JSON.parse(localStorage.getItem('carreritas:profile') || '{}').trophies.pana);
  assert.equal(trophy, 'oro', 'winning every race wins gold');
  await resultClick(page, '#back');

  // Balloon battle: hits pop balloons, the last car standing wins.
  await menuClick(page, '[data-mode="battle"]');
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
  const battle = await page.evaluate(() => {
    race.state = 'go'; race.count = 0;
    const p = race.player, rivals = race.cars.filter(c => !c.isPlayer);
    const start = race.cars.map(c => c.balloons);
    const spread = new Set(race.cars.map(c => Math.round(c.prog / 50))).size;
    for (let i = 0; i < 20; i++) updateRace(1 / 60);
    renderer.render(race.scene, race.camera);
    crash(rivals[0], 16, 1);
    const popped = rivals[0].balloons;
    crash(rivals[0], 16, 1);
    const grace = rivals[0].balloons;
    for (const r of rivals) for (let n = 0; n < 3; n++) { r.popT = 0; popBalloon(r); }
    updateRace(1 / 60);
    return { start, spread, popped, grace, state: race.state, title: document.getElementById('result-title').textContent, lap: document.getElementById('lap-label').textContent };
  });
  assert.deepEqual(battle.start, [3, 3, 3, 3]);
  assert.equal(battle.spread, 4, 'battle starts spread around the lap');
  assert.equal(battle.popped, 2);
  assert.equal(battle.grace, 2, 'one crash cannot pop two balloons at once');
  assert.equal(battle.state, 'end');
  assert.equal(battle.title, '¡Ganaste la batalla!');
  assert.equal(battle.lap, 'Globos');
  assert.equal(await page.locator('#cup-table').isVisible(), false, 'no cup table after a battle');
  await page.screenshot({ path: join(output, 'modes-battle.png') });
  assert.deepEqual(errors, []);
  console.log('carreritas modes: setup, mirror, cup with trophy, balloon battle OK');
} finally {
  await browser.close();
}
