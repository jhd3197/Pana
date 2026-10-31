import { menuStep } from './menu-helpers.js';
// Real startup, browsing, cancellation and replay. No frozen animation loop.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const output = process.env.PANA_TEST_ARTIFACTS || 'art/performance';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
  await page.goto(`${origin}/g/carreritas/?debug&track=estadio`);
  await page.waitForFunction(() => window.garage?.car && performance.getEntriesByName('carreritas:garage-ready').length, null, { timeout: 120000 });
  const initial = await page.evaluate(() => ({ readyMs: performance.getEntriesByName('carreritas:garage-ready')[0].startTime,
    mapBuilt: !!race.trackGroup }));
  assert.equal(initial.mapBuilt, false, 'startup does not construct an invisible map');

  const tracks = await page.evaluate(() => {
    const start = performance.now();
    for (let i = 0; i < TRACKS.length * 2; i++) document.getElementById('t-next').click();
    return { ms: performance.now() - start, built: !!race.trackGroup, name: document.getElementById('track-name').textContent };
  });
  assert.equal(tracks.built, false, 'rapid track selection never builds scenery');
  assert.equal(tracks.name, 'El Estadio');
  await menuStep(page, 'car');
  await page.locator('#loadout-garage').click();
  assert.equal(await page.locator('#shop-car .shop-item').count(), 16);
  await page.waitForFunction(() => [...document.querySelectorAll('#shop-car img')].length === 16 && [...document.querySelectorAll('#shop-car img')].every(img => img.naturalWidth > 0));
  await page.locator('#loadout-back').click();
  const cars = await page.evaluate(() => {
    const identities = [...garage.cars.values()];
    const start = performance.now();
    for (let i = 0; i < 32; i++) document.getElementById('loadout-next').click();
    return { ms: performance.now() - start, count: garage.cars.size,
      reused: [...garage.cars.values()].every((car, i) => car === identities[i]),
      currentAttached: garage.car.root.parent === garage.turn };
  });
  assert.equal(cars.count, 16); assert.ok(cars.reused && cars.currentAttached);
  await page.screenshot({ path: `${output}/garage-after.png` });
  await menuStep(page, 'car');
  const cameraBefore = await page.evaluate(() => garage.camera.position.toArray());
  await page.mouse.move(950, 400); await page.mouse.down(); await page.mouse.move(1150, 460, { steps: 8 }); await page.mouse.up();
  assert.notDeepEqual(await page.evaluate(() => garage.camera.position.toArray()), cameraBefore, 'drag rotates the garage camera');
  // Cancel before construction, then immediately retry. Stale loads cannot win.
  await page.evaluate(async () => { const pending = startRace(0); toGarage(); await pending; });
  assert.equal(await page.evaluate(() => race.state), 'off');
  assert.ok(await page.locator('#loading').isHidden());
  await page.evaluate(() => { window.loadStart = performance.now(); window.pendingRace = startRace(0); });
  assert.ok(await page.locator('#loading').isVisible());
  await page.screenshot({ path: `${output}/loading.png` });
  await page.evaluate(() => window.pendingRace);
  const firstRace = await page.evaluate(() => ({ ms: performance.now() - window.loadStart, count: race.cars.length,
    ready: race.trackReady, track: getActiveTrack().id, state: race.state }));
  assert.equal(firstRace.count, 4); assert.ok(firstRace.ready); assert.equal(firstRace.track, 'estadio');
  assert.ok(['count', 'go'].includes(firstRace.state));
  await page.screenshot({ path: `${output}/race-after.png` });
  const replay = await page.evaluate(async () => {
    const group = race.trackGroup;
    toGarage();
    // Browsing other maps and coming back must not discard the loaded map.
    document.getElementById('t-next').click(); document.getElementById('t-prev').click();
    const start = performance.now(); await startRace(0);
    return { ms: performance.now() - start, reused: group === race.trackGroup, count: race.cars.length };
  });
  assert.ok(replay.reused); assert.equal(replay.count, 4);
  // Cancel after a partially built map, then retry it from a clean group.
  await page.evaluate(() => {
    toGarage(); document.getElementById('t-next').click();
    window.pendingRace = startRace(1);
    const watch = new MutationObserver(() => {
      if (document.getElementById('loading-status').textContent === 'Preparando la carretera…') {
        watch.disconnect(); toGarage();
      }
    });
    watch.observe(document.getElementById('loading-status'), { childList: true });
  });
  await page.evaluate(() => window.pendingRace);
  assert.equal(await page.evaluate(() => race.state), 'off');
  await page.evaluate(() => startRace(1));
  assert.equal(await page.evaluate(() => getActiveTrack().id), 'llanos');
  assert.equal(await page.evaluate(() => race.cars.length), 4);
  // A failed constructor leaves a usable return path and can be retried.
  await page.evaluate(async () => {
    toGarage(); document.getElementById('t-next').click();
    const def = TRACKS.find(t => t.id === 'llanos'), original = def.environment;
    def.environment = () => { throw new Error('Expected loading recovery test'); };
    try { await startRace(0); } finally { def.environment = original; }
  });
  assert.ok(await page.locator('#loading').isVisible());
  assert.match(await page.locator('#loading-status').innerText(), /No pudimos/);
  await page.locator('#loading-back').click();
  assert.ok(await page.locator('#loading').isHidden());
  await page.evaluate(() => startRace(0));
  assert.equal(await page.evaluate(() => getActiveTrack().id), 'llanos');
  assert.equal(await page.evaluate(() => race.cars.length), 4);
  assert.deepEqual(errors, []);
  const metrics = { initial, tracks, cars, firstRace, replay };
  await writeFile(`${output}/loading-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
