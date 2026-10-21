import { menuClick } from './menu-helpers.js';
// npm start, then node this file. Proves the driving skills in a real race:
// rocket start, stall, drift charge and release, ramp trick.
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');

  // Gas held from the second half of "1": rocket start.
  const rocket = await page.evaluate(() => {
    race.count = 1.5; race.keys = { w: true };
    for (let i = 0; i < 60 && race.state === 'count'; i++) updateRace(1 / 60);
    return { state: race.state, boost: race.player.boost, stall: race.player.stall };
  });
  assert.equal(rocket.state, 'go');
  assert.ok(rocket.boost > 0.5 && rocket.stall === 0, `rocket start ${JSON.stringify(rocket)}`);

  // Gas mashed on "3": the engine floods and the car cannot accelerate.
  const stall = await page.evaluate(() => {
    const p = race.player;
    race.state = 'count'; race.count = 3.5; race.throttleAt = null; p.boost = 0;
    race.keys = { w: true };
    for (let i = 0; i < 200 && race.state === 'count'; i++) updateRace(1 / 60);
    const stalled = p.stall > 0;
    p.vx = p.vz = 0;
    for (let i = 0; i < 20; i++) updateRace(1 / 60);
    return { stalled, speed: Math.abs(p.vf) };
  });
  // A jumped start floods the engine: the car still moves, only weakly.
  assert.ok(stall.stalled && stall.speed > 0 && stall.speed < 4.5, `stall ${JSON.stringify(stall)}`);

  // Drive a real bend with simple held input, then release for a turbo.
  // Never pin the car in place: that used to hide the forced-turn wall crashes.
  const drift = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), s = 1254;
    for (const c of race.cars) if (c !== p) { c.x += 400; c.done = true; }
    const a=T.pointAt(s), b=T.pointAt(s+.5), h=Math.atan2(b.x-a.x,b.y-a.y);
    Object.assign(p,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h,onGround:true,vy:0,pitch:0,roll:0,
      drift:0,driftT:0,driftHeld:false,driftExitT:0,stall:0,boost:0,vf:32,vx:Math.sin(h)*32,vz:Math.cos(h)*32});
    race.keys = { w: true, shift: true, d: true };
    let started = false, level = 0, maxOff = 0;
    for (let i = 0; i < 90; i++) {
      updateRace(1 / 60);
      if (p.drift) { started = true; level = Math.max(level, p.driftLvl); }
      maxOff=Math.max(maxOff,Math.abs(T.offsetOf(p.x,p.z)));
    }
    const before = p.boost, field = n => race.scene.getObjectByName(n)?.geometry.drawRange.count ?? 0;
    const puffs = field('drift-smoke'), sparks = field('drift-sparks');
    renderer.render(race.scene, race.camera);
    race.keys = { w: true };
    updateRace(1 / 60);
    return { started, level, before, after: p.boost, dir: p.drift, maxOff, limit:T.HW-1.6, marks: race.skidMarks.count, puffs, sparks,
      score: window.PANA_DRIFT_SCORE?.() };
  });
  await page.screenshot({ path: join(output, 'drive-drift.png') });
  assert.ok(drift.started, 'a held drift button with steering starts a drift');
  assert.ok(drift.level>=1, `real cornering earns sparks ${JSON.stringify(drift)}`);
  assert.ok(drift.maxOff<drift.limit, `drift stays off the walls ${JSON.stringify(drift)}`);
  assert.ok(drift.after > 0.4 && drift.dir === 0, `release pays the earned turbo ${JSON.stringify(drift)}`);
  assert.ok(drift.marks >= 10, `drifting lays skid marks on the road ${JSON.stringify(drift)}`);
  assert.ok(drift.puffs >= 30, `drifting billows a smoke plume ${JSON.stringify(drift)}`);
  assert.ok(drift.sparks >= 20, `a charged drift throws glowing sparks ${JSON.stringify(drift)}`);
  assert.ok(drift.score?.points > 0 && drift.score.active, `the drift earns live style points ${JSON.stringify(drift)}`);

  // Feats: hold one drift past 100 m — re-entering the same bend keeps the run
  // on the road without touching drift state — and the toast celebrates; the
  // drift charges to purple on the way, so releasing it celebrates too.
  const feats = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), s = 1254;
    const toast = document.getElementById('toast');
    const place = () => {
      const a = T.pointAt(s), b = T.pointAt(s + .5), h = Math.atan2(b.x - a.x, b.y - a.y);
      Object.assign(p, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h, onGround: true, vy: 0, pitch: 0, roll: 0, spin: 0, stall: 0 });
      p.vx = Math.sin(h) * p.vf; p.vz = Math.cos(p.h) * p.vf;
    };
    p.vf = 32; p.boost = 0; place();
    race.keys = { w: true, shift: true, d: true };
    let longText = '', maxOff = 0;
    for (let leg = 0; leg < 14 && !(longText && p.driftLvl === 3); leg++) {
      for (let i = 0; i < 55 && !(longText && p.driftLvl === 3); i++) {
        updateRace(1 / 60);
        maxOff = Math.max(maxOff, Math.abs(T.offsetOf(p.x, p.z)));
        if (toast.textContent.includes('Derrapón')) longText = toast.textContent;
      }
      p.vf = Math.max(p.vf, 28); place();   // same bend again, drift untouched
    }
    const level = p.driftLvl, distance = getDriftFeats()?.current ?? 0;
    race.keys = { w: true };
    updateRace(1 / 60);
    return { longText, level, distance, maxOff, limit: T.HW - 1.6, purpleText: toast.textContent, boost: p.boost,
      slow: race.slowMo.active, shake: race.shake, chain: window.PANA_DRIFT_SCORE?.().chain ?? 0 };
  });
  assert.ok(feats.longText.includes('100 m'), `one 100 m drift fires its feat ${JSON.stringify(feats)}`);
  assert.ok(feats.distance >= 100, `the drift really ran 100 m ${JSON.stringify(feats)}`);
  assert.ok(feats.maxOff < feats.limit, `the feat drift stays off the walls ${JSON.stringify(feats)}`);
  assert.equal(feats.level, 3, `the held drift charged to purple ${JSON.stringify(feats)}`);
  assert.ok(feats.purpleText.includes('púrpura'), `releasing purple fires its feat ${JSON.stringify(feats)}`);
  assert.ok(feats.boost > 1, `the purple release pays its turbo ${JSON.stringify(feats)}`);
  assert.ok(feats.slow, `the purple release dilates time ${JSON.stringify(feats)}`);
  assert.ok(feats.shake > 0.2, `the purple release pulses the camera ${JSON.stringify(feats)}`);
  assert.ok(feats.chain >= 2, `a drift inside the window chains the multiplier ${JSON.stringify(feats)}`);

  // Purple is a window: held past it, the tyres burn — charge gone, speed
  // scrubbed, and no new drift until the button comes up again.
  const burn = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), s = 1254;
    const a=T.pointAt(s), b=T.pointAt(s+.5), h=Math.atan2(b.x-a.x,b.y-a.y);
    Object.assign(p,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h,onGround:true,vy:0,pitch:0,roll:0,spin:0,stall:0,boost:0,tireHeat:0,burnLock:false,
      drift:1,driftT:3.2+1.4-0.01,driftHeld:true,driftExitT:0,vf:32,vx:Math.sin(h)*32,vz:Math.cos(h)*32});
    race.keys = { w: true, shift: true, d: true };
    let speed = Math.hypot(p.vx, p.vz);
    let burnt = false, after = 0;
    for (let i = 0; i < 90 && !burnt; i++) { const was = Math.hypot(p.vx, p.vz); updateRace(1 / 60); burnt = p.burnT > 0; if (burnt) { after = Math.hypot(p.vx, p.vz); speed = was; } }
    for (let i = 0; i < 10; i++) updateRace(1 / 60);
    const relocked = p.drift === 0 && p.burnLock;
    race.keys = { w: true };
    updateRace(1 / 60);
    return { burnt, speed, after, relocked, boost: p.boost, unlocked: !p.burnLock };
  });
  assert.ok(burn.burnt && burn.after < burn.speed * 0.9 && burn.boost === 0, `held too long, the tyres burn ${JSON.stringify(burn)}`);
  assert.ok(burn.relocked && burn.unlocked, `a burnt drift waits for the button to come up ${JSON.stringify(burn)}`);

  // A trick pressed in the air lands with a short turbo.
  const trick = await page.evaluate(() => {
    const p = race.player;
    race.keys = {};
    updateRace(1 / 60);
    p.boost = 0; p.onGround = false; p.y += 5; p.vy = 7; p.airTime = 0.1; p.hopping = false;
    p.pitch = p.roll = p.pitchV = p.rollV = 0; p.vx = p.vz = p.vf = 0;
    race.keys = { shift: true };
    updateRace(1 / 60);
    const tricked = p.trick;
    race.keys = {};
    for (let i = 0; i < 120 && !p.onGround; i++) updateRace(1 / 60);
    return { tricked, landed: p.onGround, boost: p.boost };
  });
  assert.ok(trick.tricked && trick.landed && trick.boost > 0.3, `trick ${JSON.stringify(trick)}`);

  // Ghost recording: crossing the last line ends the race and saves the
  // fastest lap; a fresh race on the same track fields the ghost on it.
  const stored = await page.evaluate(() => {
    const p = race.player;
    race.keys = { w: true };
    for (let i = 0; i < 180; i++) updateRace(1 / 60);   // a few seconds of tape
    p.lap = race.laps + 1;                              // the last crossing…
    updateRace(1 / 60);                                 // …ends the race, saving the ghost
    const ghost = JSON.parse(localStorage.getItem('derrape:ghost:estadio') || 'null');
    return { state: race.state, done: p.done, lap: ghost?.lap, poses: ghost?.poses?.length ?? 0,
      rounded: ghost ? ghost.poses.every(q => q.every(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6)) : false };
  });
  assert.equal(stored.state, 'end', `the last crossing finishes the race ${JSON.stringify(stored)}`);
  assert.ok(stored.done, 'the player is done');
  assert.ok(stored.lap > 3 && stored.poses > 30, `a lap of poses was stored ${JSON.stringify(stored)}`);
  assert.ok(stored.rounded, 'stored poses keep the 2-decimal packPose rounding');

  await page.evaluate(() => startRace(race.playerIndex, race.playerWheel));
  await page.waitForFunction(() => race.state === 'count');
  const replay = await page.evaluate(() => {
    const g0 = window.PANA_GHOST();
    const ghost = JSON.parse(localStorage.getItem('derrape:ghost:estadio'));
    race.state = 'go'; race.count = 0;
    for (let i = 0; i < 90; i++) updateRace(1 / 60);    // 1.5 s of racing
    const g1 = window.PANA_GHOST();
    const poses = ghost.poses, at = Math.round(1.5 * 20);
    const a = poses[at - 1] || poses[0], b = poses[at] || poses.at(-1);
    const k = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (1500 - a[0]) / (b[0] - a[0])));
    return { g0, g1, expectX: a[1] + (b[1] - a[1]) * k, expectZ: a[3] + (b[3] - a[3]) * k,
      startX: poses[0][1], startZ: poses[0][3],
      pill: !document.getElementById('ghost-pill').hidden,
      pillText: document.getElementById('ghost-time').textContent };
  });
  assert.ok(replay.g0, 'a fresh race on the track fields the ghost');
  assert.ok(Math.abs(replay.g0.x - replay.startX) < 0.5 && Math.abs(replay.g0.z - replay.startZ) < 0.5,
    `the ghost waits on the recording's grid pose ${JSON.stringify(replay)}`);
  assert.ok(Math.abs(replay.g1.x - replay.expectX) < 0.5 && Math.abs(replay.g1.z - replay.expectZ) < 0.5,
    `the ghost follows the recording at t=1.5s ${JSON.stringify(replay)}`);
  assert.ok(replay.pill && /\d/.test(replay.pillText), `the Fantasma pill shows the lap ${JSON.stringify(replay)}`);
  await page.screenshot({ path: join(output, 'drive-ghost.png') });
  assert.deepEqual(errors, []);
  console.log('derrape drive: rocket start, stall, drift levels and tricks OK');
} finally {
  await browser.close();
}
