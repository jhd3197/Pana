import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || 'art/grand-prix/cup-local';
await mkdir(output, { recursive: true });
const errors = [];
const cups = [
  { id: 'pana', tracks: ['estadio', 'plaza', 'llanos', 'bululu'], laps: [2, 2, 2, 2] },
  { id: 'aventura', tracks: ['desierto', 'chichi', 'selva', 'paramo'], laps: [2, 1, 2, 2] },
];

async function makePage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/derrape/?debug&auto&manual`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => { localStorage.removeItem('derrape:profile'); localStorage.removeItem('derrape:setup'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.garage?.car, null, { timeout: 120000 });
  return page;
}

const finishFixture = page => page.evaluate(() => {
  race.state = 'go'; race.count = 0;
  race.player.lap = race.laps + 1;
  if (race.p2) race.p2.lap = race.laps + 1;
  for (let i = 0; i < 3 && race.state !== 'end'; i++) updateRace(1 / 60);
  return race.state;
});

async function selectCup(page, id) {
  await page.locator(`[data-mode="${id}"]`).click();
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
}

async function driveStage(page) {
  await page.evaluate(() => { for (let i = 0; i < 300 && race.state === 'count'; i++) updateRace(1 / 60); });
  const started = Date.now();
  let current = null;
  for (let chunk = 0; chunk < 10; chunk++) {
    current = await page.evaluate(() => {
      for (let i = 0; i < 1800 && race.state !== 'end'; i++) updateRace(1 / 60);
      return { state: race.state, clock: race.clock, lap: race.player.lap, cap: race.stageCap };
    });
    if (current.state === 'end') break;
  }
  assert.ok(current?.state === 'end', `actual driving reaches the stage result ${JSON.stringify(current)}`);
  return { ...current, wallSeconds: (Date.now() - started) / 1000 };
}

try {
  const page = await makePage();
  await selectCup(page, 'pana');
  const initial = await page.evaluate(() => ({
    cars: race.cars.length,
    entrants: race.cup.session.entrants.map(e => e.id),
    stage: race.cup.session.stageIndex,
    attempt: race.cup.session.attempts[0],
    laps: race.laps,
  }));
  assert.equal(initial.cars, 8);
  assert.equal(new Set(initial.entrants).size, 8);
  assert.deepEqual(initial.laps, 2);

  await page.evaluate(() => startRace(race.playerIndex, race.playerWheel));
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  const restarted = await page.evaluate(() => ({ stage: race.cup.session.stageIndex, attempt: race.cup.session.attempts[0], ledger: race.cup.session.ledger.length }));
  assert.equal(restarted.stage, 0);
  assert.equal(restarted.attempt, initial.attempt + 1);
  assert.equal(restarted.ledger, 0);

  assert.equal(await finishFixture(page), 'end');
  await page.locator('#again').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => race.cup.session.stageIndex), 1);
  assert.equal(await finishFixture(page), 'end');
  await page.locator('#back').click();
  const abandoned = await page.evaluate(() => ({ cup: race.cup, trophy: JSON.parse(localStorage.getItem('derrape:profile')).trophies.pana ?? null }));
  assert.equal(abandoned.cup, null);
  assert.equal(abandoned.trophy, null, 'leaving after race two pays no cup trophy');

  await selectCup(page, 'pana');
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(await finishFixture(page), 'end');
    if (stage < 3) {
      await page.locator('#again').click();
      await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
    }
  }
  const completed = await page.evaluate(() => ({ status: race.cup.session.status, oldId: race.cup.session.sessionId }));
  assert.equal(completed.status, 'complete');
  await page.locator('#again').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  const replay = await page.evaluate(() => ({ id: race.cup.session.sessionId, stage: race.cup.session.stageIndex, ledger: race.cup.session.ledger.length }));
  assert.notEqual(replay.id, completed.oldId);
  assert.equal(replay.stage, 0);
  assert.equal(replay.ledger, 0);
  await page.evaluate(() => toGarage());

  await page.locator('[data-mode="race"]').click();
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => ({ cup: race.cup, cars: race.cars.length }).cars), 4);
  await page.evaluate(() => toGarage());
  await page.locator('[data-mode="battle"]').click();
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => race.mode), 'battle');
  await page.evaluate(() => toGarage());

  await page.locator('[data-mode="pana"]').click();
  const stageButtons = await page.locator('#cup-stages .cup-stage').count();
  assert.equal(stageButtons, 4, 'cup selection lists all four tracks');
  assert.match(await page.locator('#setup-note').textContent(), /Duración aproximada:/);
  await page.locator('#cup-stages .cup-stage').nth(2).click();
  assert.equal(await page.locator('#track-name').textContent(), 'Los Llanos');
  assert.equal(await page.evaluate(() => window.getActiveTrack()?.id ?? null), 'estadio', 'browsing cup stages does not rebuild the 3D world');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'setup-390x844.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#split').click();
  await page.locator('#mirror').click();
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
  const split = await page.evaluate(() => ({
    cars: race.cars.length, guest: race.p2?.entrantId, player: race.player.entrantId,
    mirror: race.scene.scale.x, entrants: race.cup.session.entrants.length,
    stagePill: !document.getElementById('stage-pill').hidden && document.getElementById('stage-readout').textContent,
  }));
  assert.equal(split.cars, 8);
  assert.equal(split.entrants, 8);
  assert.equal(split.guest, 'local-guest');
  assert.equal(split.player, 'local-player');
  assert.equal(split.mirror, -1);
  assert.equal(split.stagePill, '1/4');
  await page.screenshot({ path: join(output, 'mobile-landscape-844x390.png') });
  assert.equal(await finishFixture(page), 'end');
  await page.screenshot({ path: join(output, 'guest-results.png') });
  const coinsAfterFirstFinish = await page.evaluate(() => getWallet().coins);
  await page.evaluate(() => { finish(); renderResults(race.cars, race.player); renderCup(); });
  assert.equal(await page.evaluate(() => getWallet().coins), coinsAfterFirstFinish, 'reopening results cannot pay a second bonus');

  // Test long names, duplicate names and tied podium presentation
  const tieCheck = await page.evaluate(() => {
    const entrants = race.cup.session.entrants.map((e, idx) => idx < 2
      ? { ...e, name: 'Pana Con Un Nombre Bastante Largo Iguales' }
      : e);
    race.cup.session.entrants = Object.freeze(entrants);
    race.cars[0].name = entrants[0].name;
    race.cars[1].name = entrants[1].name;
    renderCup();
    return {
      rows: [...document.querySelectorAll('#cup-board li .pk-row-name')].map(n => n.firstChild.textContent),
      details: [...document.querySelectorAll('#cup-board li .pk-row-name small')].map(n => n.textContent),
      nextText: document.getElementById('cup-next').textContent,
    };
  });
  assert.equal(tieCheck.rows.filter(n => n === 'Pana Con Un Nombre Bastante Largo Iguales').length, 2);
  assert.ok(tieCheck.details.some(d => d.includes('pts')));
  assert.match(tieCheck.nextText, /Siguiente:/);
  await page.screenshot({ path: join(output, 'intermediate-standings.png') });
  await page.close();

  const proof = [];
  for (const cup of cups) {
    const actual = await makePage();
    await actual.locator('[data-difficulty="facil"]').click();
    await selectCup(actual, cup.id);
    const frozen = await actual.evaluate(() => JSON.stringify(race.cup.session.entrants));
    const stages = [];
    for (let n = 0; n < 4; n++) {
      const before = await actual.evaluate(() => ({
        track: getActiveTrack().id, laps: race.laps,
        stage: race.cup.session.stageIndex,
        entrants: JSON.stringify(race.cup.session.entrants),
      }));
      assert.equal(before.track, cup.tracks[n]);
      assert.equal(before.laps, cup.laps[n]);
      assert.equal(before.stage, n);
      assert.equal(before.entrants, frozen, 'same entrants and loadouts for the whole cup');
      const timing = await driveStage(actual);
      const result = await actual.evaluate(() => ({
        status: race.cup.session.status,
        finalized: race.cup.session.finalized.map(Boolean),
        ledger: race.cup.session.ledger.length,
        totals: race.cup.session.entrants.map(e => ({ id: e.id,
          points: race.cup.session.ledger.filter(r => r.id === e.id).reduce((sum, r) => sum + r.points, 0) })),
      }));
      assert.equal(result.finalized[n], true);
      assert.equal(result.ledger, (n + 1) * 8);
      stages.push({ track: cup.tracks[n], ...timing, status: result.status });
      if (n < 3) {
        await actual.locator('#again').click();
        await actual.waitForFunction(() => race.state === 'count', null, { timeout: 180000 });
      } else assert.equal(result.status, 'complete');
    }
    proof.push({ cup: cup.id, stages });
    await actual.screenshot({ path: join(output, `${cup.id}-final.png`) });
    await actual.close();
  }
  await writeFile(join(output, 'actual-cups.json'), JSON.stringify(proof, null, 2));
  assert.deepEqual(errors, []);
  console.log(`derrape local cups: restart, abandon, replay, quick/battle, split/mirror, UI/rewards and ${proof.length} actual four-race cups OK`);
} finally {
  await browser.close();
}
