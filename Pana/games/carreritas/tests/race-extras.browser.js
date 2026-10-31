import { menuClick } from './menu-helpers.js';
// npm start, then node this file. The race extras around the driving: barrels
// and crates that smash, name tags over nearby racers, El Chocón on the
// results, drift audio running on a real AudioContext, and the ghost turning
// lancha on Chuao's river run.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'carreritas-qa');
await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/carreritas/?debug&manual&noghost&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
  await page.waitForFunction(() => race.props.props?.length > 0 && race.tags.update.length > 0);

  // Barrels and crates: drive straight into the first cluster.
  const smash = await page.evaluate(() => {
    race.state = 'go'; race.count = 0;
    const T = getActiveTrack(), p = race.player, pr = race.props.props[0], s = T.paramOf(pr.x, pr.z) - 25;
    for (const c of race.cars) if (c !== p) { c.x += 600; c.done = true; }
    const a = T.pointAt(s), b = T.pointAt(s + 0.5), h = Math.atan2(b.x - a.x, b.y - a.y);
    const off = T.offsetOf(pr.x, pr.z), nx = -(b.y - a.y), nz = b.x - a.x, l = Math.hypot(nx, nz);
    Object.assign(p, { x: a.x + nx / l * off, z: a.y + nz / l * off, y: T.groundAt(a.x, a.y), h, onGround: true, vy: 0, pitch: 0, roll: 0,
      vf: 22, vx: Math.sin(h) * 22, vz: Math.cos(h) * 22, hits: 0, boost: 0 });
    race.keys = { w: true };
    let slowed = false;
    for (let i = 0; i < 120 && !p.hits; i++) { const v = Math.hypot(p.vx, p.vz); updateRace(1 / 60); presentRace(1 / 60); if (p.hits) slowed = Math.hypot(p.vx, p.vz) < v; }
    for (let i = 0; i < 20; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    return { placed: race.props.props.length, hits: p.hits, smashed: race.props.props.filter(q => q.down > 0).length, slowed };
  });
  await page.evaluate(() => renderer.render(race.scene, race.camera));
  await page.screenshot({ path: join(output, 'race-extras-smash.png') });
  assert.ok(smash.placed >= 6, `the track has props to smash ${JSON.stringify(smash)}`);
  assert.ok(smash.hits >= 1 && smash.smashed >= 1 && smash.slowed, `driving through a prop smashes it and costs speed ${JSON.stringify(smash)}`);

  // Name tags: a rival a few metres ahead gets its name over the roof.
  const tags = await page.evaluate(() => {
    const T = getActiveTrack(), p = race.player, rival = race.cars.find(c => c !== p);
    const s = T.paramOf(p.x, p.z) + 9, q = T.pointAt(s);
    Object.assign(rival, { x: q.x, z: q.y, y: T.groundAt(q.x, q.y), done: false, h: p.h });
    presentRace(1 / 60);
    const tag = [...document.querySelectorAll('.pk-tag')].find(t => t.dataset.name === rival.name);
    return { name: rival.name, shown: !!tag && tag.style.display !== 'none' && Number(tag.style.opacity) > 0.5, mine: [...document.querySelectorAll('.pk-tag')].some(t => t.dataset.name === p.name && t.style.display !== 'none') };
  });
  assert.ok(tags.shown, `a nearby rival shows its name tag ${JSON.stringify(tags)}`);
  assert.ok(!tags.mine, `the player's own car has no tag ${JSON.stringify(tags)}`);

  // Drift audio on a live context: a held drift and a release run clean.
  const audio = await page.evaluate(() => {
    sound.unlock();
    const p = race.player;
    race.keys = { w: true, shift: true, d: true };
    for (let i = 0; i < 90; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    race.keys = { w: true };
    for (let i = 0; i < 10; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    return { ctx: !!sound.ctx, state: sound.ctx?.state };
  });
  assert.ok(audio.ctx, `the drift audio ran on a real context ${JSON.stringify(audio)}`);

  // El Chocón: the most hits (5 or more) gets the tag on the results.
  const chocon = await page.evaluate(() => {
    race.player.hits = 7;
    renderResults([...race.cars], race.player);
    return document.getElementById('result-board').textContent;
  });
  assert.ok(chocon.includes('El Chocón: 7 choques'), `the results crown El Chocón ${chocon.slice(0, 300)}`);

  // The ghost turns lancha on Chuao's river run: a stored lap that crosses
  // the waterfall gate.
  await page.goto(`${origin}/g/carreritas/?debug&manual&track=llanos`);
  await page.waitForFunction(() => window.garage?.car && window.getGates);
  const ghost = await page.evaluate(async () => {
    toGarage(); buildTrack('llanos');
    const T = getActiveTrack(), run = getGates().runs[0], poses = [];
    for (let i = 0; i <= 40; i++) {
      const s = run.s0 - 40 + i * 4, a = T.pointAt(s), b = T.pointAt(s + 0.5), h = Math.atan2(b.x - a.x, b.y - a.y);
      poses.push([i * 120, a.x, T.groundAt(a.x, a.y), a.y, h, 0, 0, 30, 0, 0, 0, 1, 1, 0, 0, 0]);
    }
    localStorage.setItem('carreritas:ghost:llanos', JSON.stringify({ lap: 4.8, poses }));
    return true;
  });
  assert.ok(ghost);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count' && race.ghost, null, { timeout: 120000 });
  const boat = await page.evaluate(() => {
    const g = race.ghost;
    for (let t = 0; t < 2600; t += 1000 / 60) { g.update(t, 1 / 60); presentRace(1 / 60); }
    const lancha = g.car.car.lancha;
    let translucent = true;
    const opaque = []; lancha?.group.traverse(o => { if (o.material && [].concat(o.material).some(m => !m.transparent)) { translucent = false; opaque.push(o.name || o.type + ':' + (o.parent?.name || '')); } });
    return { boat: !!g.car.boat, lancha: !!lancha?.group.visible, translucent, name: g.car.name, opaque: opaque.slice(0, 12), count: opaque.length };
  });
  assert.ok(boat.boat && boat.lancha, `the ghost becomes a lancha on the river run ${JSON.stringify(boat)}`);
  assert.ok(boat.translucent, `the ghost's lancha is translucent like the ghost ${JSON.stringify(boat)}`);
  assert.deepEqual(errors, []);
  console.log('carreritas race extras: smash, tags, audio, El Chocón, ghost lancha OK', JSON.stringify({ smash, tags, boat }));
} finally {
  await browser.close();
}
