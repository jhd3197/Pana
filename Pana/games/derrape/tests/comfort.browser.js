import { menuClick } from './menu-helpers.js';
// npm start, then node this file. Comfort features in a real race: a game
// controller drives and fires items, the wrong-way warning, the incoming
// item arrow, lap splits, look back and two-player split screen.
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
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'derrape-qa');
await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  // A fake controller: RT held, RB held, LB pressed on demand.
  await page.addInitScript(() => {
    const button = (v) => ({ pressed: v > 0.5, value: v, touched: v > 0 });
    window.fakePad = { rt: 0, lb: 0 };
    navigator.getGamepads = () => [{ id: 'test', mapping: 'standard', connected: true, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => button(i === 7 ? fakePad.rt : i === 4 ? fakePad.lb : 0)) }];
  });
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.evaluate(() => { localStorage.removeItem('derrape:setup'); localStorage.removeItem('derrape:profile'); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');

  // Controller: RT accelerates, LB throws the held item.
  const pad = await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    race.state = 'go'; race.count = 0;
    const p = race.player;
    for (const c of race.cars) if (c !== p) { c.done = true; c.x += 900; }
    fakePad.rt = 1;
    for (let i = 0; i < 60; i++) { pollPads(); updateRace(1 / 60); }
    const speed = p.vf;
    addItem(p, 'mango', 0);
    fakePad.lb = 1; pollPads(); fakePad.lb = 0; pollPads();
    fakePad.rt = 0; pollPads();
    return { speed, thrown: race.items.projectiles.length > 0 };
  });
  assert.ok(pad.speed > 8 && pad.thrown, `controller ${JSON.stringify(pad)}`);

  // Wrong way, an incoming rocket, a lap split.
  const hud = await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    const p = race.player, T = getActiveTrack();
    race.items.clear();
    p.h += Math.PI; p.vx = Math.sin(p.h) * 15; p.vz = Math.cos(p.h) * 15; p.vf = 15;
    for (let i = 0; i < 80; i++) { updateRace(1 / 60); p.vx = Math.sin(p.h) * 15; p.vz = Math.cos(p.h) * 15; }
    const wrong = !document.getElementById('wrong-way').hidden;
    p.h -= Math.PI; p.vx = p.vz = 0;
    for (let i = 0; i < 90; i++) updateRace(1 / 60);
    const cleared = document.getElementById('wrong-way').hidden;
    const rival = race.cars[1];
    Object.assign(rival, { done: false, x: p.x - Math.sin(p.h) * 30, z: p.z - Math.cos(p.h) * 30, h: p.h, inventory: [null, null], selected: 0 });
    rival.y = T.groundAt(rival.x, rival.z);
    rival.prog = p.prog - 30; rival.lap = p.lap;
    addItem(rival, 'cohete', 0);
    race.items.use(rival, 1);
    updateRace(1 / 60);
    const incoming = !document.getElementById('incoming').hidden && document.getElementById('incoming-text').textContent;
    race.items.clear(); rival.done = true; rival.x += 900;
    p.lap = 2; race.clock = 61.5; updateRace(1 / 60);
    return { wrong, cleared, incoming, best: !document.getElementById('best-pill').hidden && document.getElementById('lap-best').textContent };
  });
  assert.ok(hud.wrong && hud.cleared, `wrong way ${JSON.stringify(hud)}`);
  assert.equal(hud.incoming, '¡Cohete!');
  assert.ok(hud.best && hud.best.startsWith('1:01'), `lap split ${JSON.stringify(hud)}`);

  // Look back with C turns the camera around.
  const look = await page.evaluate(() => {
    const p = race.player;
    const ahead = (cam) => (cam.position.x - p.x) * Math.sin(p.h) + (cam.position.z - p.z) * Math.cos(p.h);
    updateRace(1 / 60);
    const before = ahead(race.camera);
    race.keys.c = true; updateRace(1 / 60); race.keys.c = false;
    return { before, after: ahead(race.camera) };
  });
  assert.ok(look.before < 0 && look.after > 0, `look back ${JSON.stringify(look)}`);
  await page.evaluate(() => toGarage());

  // Two players: split screen, the second pana drives with the arrows.
  await menuClick(page, '#split');
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');
  const split = await page.evaluate(() => {
    race.state = 'go'; race.count = 0;
    const p2 = race.p2;
    const x = p2.x, z = p2.z;
    race.codes = { ArrowUp: true };
    for (let i = 0; i < 60; i++) updateRace(1 / 60);
    race.codes = {};
    return { humans: race.cars.filter(c => c.isPlayer || c.human).length, moved: Math.hypot(p2.x - x, p2.z - z), p1Still: Math.abs(race.player.vf) < 1,
      splitClass: document.getElementById('race').classList.contains('split'), hud: !document.getElementById('p2-hud').hidden,
      aspect: race.camera2.aspect.toFixed(2) };
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(output, 'split.png') });
  assert.equal(split.humans, 2);
  assert.ok(split.moved > 5 && split.p1Still, `p2 drives alone ${JSON.stringify(split)}`);
  assert.ok(split.splitClass && split.hud);
  assert.equal(split.aspect, (1440 / 2 / 900).toFixed(2));
  await page.evaluate(() => { setup.split = false; toGarage(); });
  assert.deepEqual(errors, []);
  console.log('derrape comfort: controller, wrong way, incoming, splits, look back, split screen OK');
} finally {
  await browser.close();
}
