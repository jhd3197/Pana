// The first-time tutorial, played with real keys: every step of it is one of
// the moves (walk, jab, trompón, block, dodge, counter, grab, get up), so
// finishing it proves the controls reach the fight.
// Run: npm run test:browser -- trifulca
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'trifulca', { name: 'Ana', room: `trifulca-tuto-${Date.now()}`, query: 'debug' });
  await waitFor(page, () => trifulcaDebug.room.connected && trifulcaDebug.room.isHost);
  // Neck pivots persist between updates: idle and gasp must never accumulate.
  await page.evaluate(async () => {
    const { animateNpc, npcLife } = await import('/g/trifulca/crowd-life.js');
    const npc = { life: npcLife(2), group: { position: { x: 2, z: 2 }, rotation: { y: 0 } }, neck: { rotation: { x: 0, y: 0, z: 0 } } };
    for (let i = 0; i < 3600; i++) {
      if (i % 120 === 0) npc.life.gasp = 1;
      animateNpc(npc, 1 / 60, i / 60, { x: 0, z: 0 });
      if (Math.abs(npc.neck.rotation.x) > .5 || Math.abs(npc.neck.rotation.z) > .061) throw new Error('Head rotation accumulated');
    }
    const { createPana } = await import('/g/trifulca/fighters.js');
    const fighter = createPana({});
    try {
      for (let i = 0; i < 90; i++) {
        if (i % 5 === 0) fighter.hit(1.3, true);
        fighter.update(.2, { act: 'stun', at: .1 });
        const neck = fighter.root.getObjectByName('neck');
        if (!Number.isFinite(neck.rotation.x) || Math.abs(neck.rotation.x) > .351 || Math.abs(neck.rotation.z) > .201) throw new Error('Unbounded hit reaction');
      }
    } finally { fighter.dispose(); }
  });
  await page.locator('#start').click();   // first time alone: the tutorial
  await waitFor(page, () => trifulcaDebug.room.state.tutorial?.step === 0);
  await page.locator('#world').click({ position: { x: 640, y: 300 } });
  assert.match(await page.locator('#bars').innerText(), /Mareo.*Aguante/s);
  assert.equal(await page.locator('.caidas').first().getAttribute('data-label'), 'Caídas 0/3');
  await page.evaluate(() => {
    window.__pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [__pad]; dispatchEvent(new Event('gamepadconnected'));
  });
  await waitFor(page, () => document.documentElement.dataset.panaInput === 'gamepad');
  assert.equal(await page.locator('#keys').isVisible(), false, 'only the shared controller guide is shown');
  await page.locator('#menu').click();
  const counts = await page.evaluate(() => trifulcaDebug.controls.read().e);
  await page.evaluate(() => { __pad.buttons[1] = { pressed: true, value: 1 }; trifulcaDebug.controls.read(); });
  assert.equal(await page.evaluate(() => trifulcaDebug.controls.read().e), counts, 'menu buttons do not enqueue dodge commands');
  await page.evaluate(() => { __pad = null; dispatchEvent(new Event('gamepaddisconnected')); });
  if (await page.locator('dialog.pana-menu[open]').count()) await page.keyboard.press('Escape');
  const step = () => page.evaluate(() => trifulcaDebug.room.state.tutorial);
  const until = (n) => waitFor(page, (n) => trifulcaDebug.room.state.tutorial.step >= n || trifulcaDebug.room.state.tutorial.done, n, 30_000);
  // Walk up: right is always toward the rival.
  await page.keyboard.down('d'); await until(1); await page.keyboard.up('d');
  console.log('PASS tutorial: movement');
  // Three jabs.
  while ((await step()).step === 1) { await page.keyboard.press('j'); await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act !== 'jab'); }
  console.log('PASS tutorial: jabs');
  // A trompón: hold J.
  while ((await step()).step === 2) {
    await page.keyboard.down('j');
    await waitFor(page, () => ['trompon', 'open', 'idle'].includes(trifulcaDebug.room.state.bodies[0].act) && trifulcaDebug.room.state.bodies[0].thrown > 0);
    await page.keyboard.up('j');
    await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act === 'idle' || trifulcaDebug.room.state.tutorial.step > 2);
  }
  console.log('PASS tutorial: trompón');
  // Block the profe's jabs.
  await page.keyboard.down('k'); await until(4); await page.keyboard.up('k');
  console.log('PASS tutorial: guard');
  // Dodge when he winds up (twice), then counter.
  for (const target of [5, 6]) {
    let attempts = 0;
    while ((await step()).step < target) {
      assert.ok(++attempts <= 15, `Tutorial step ${target} did not complete: ${JSON.stringify(await page.evaluate(() => ({ tutorial: trifulcaDebug.room.state.tutorial, bodies: trifulcaDebug.room.state.bodies })))}`);
      // Published snapshots can skip the end of windup during catch-up. An
      // early, unlanded swing is still a valid cue to dodge before contact.
      await waitFor(page, target => {
        const state=trifulcaDebug.room.state, foe=state.bodies[1];
        return state.tutorial.step>=target || (foe.act==='wind' && foe.at>=.25) || (foe.act==='trompon' && !foe.landed && foe.at<.1);
      }, target, 20_000).catch(async error => {
        throw new Error(`${error.message}: ${JSON.stringify(await page.evaluate(()=>({tutorial:trifulcaDebug.room.state.tutorial,bodies:trifulcaDebug.room.state.bodies,dialog:!!document.querySelector('dialog[open]'),input:trifulcaDebug.controls.read()})))}`);
      });
      if ((await step()).step >= target) break;
      await page.keyboard.press(' ');
      if (target === 6) {
        await waitFor(page,()=>{const s=trifulcaDebug.room.state,b=s.bodies[0];return s.tutorial.step>=6 || (b.contra>0 && (b.act==='idle' || (b.act==='dodge' && b.at>=.3)));},null,5_000).catch(()=>{});
        await page.keyboard.press('j');
      }
      await waitFor(page, () => !['wind', 'trompon'].includes(trifulcaDebug.room.state.bodies[1].act));
    }
  }
  console.log('PASS tutorial: dodge and counter');
  // Grab through the guard.
  while ((await step()).step === 6) { await page.keyboard.press('l'); await waitFor(page, () => trifulcaDebug.room.state.bodies[0].act !== 'grab'); }
  console.log('PASS tutorial: grab');
  // Knocked down: mash to get up.
  while (!(await step()).done) { await page.keyboard.press('j'); }
  assert.equal(await page.isVisible('#tutorial-go'), true);
  assert.deepEqual(page.errors, []);
  // Done: the ladder starts with you in the ring.
  await page.locator('#tutorial-go').click();
  await waitFor(page, () => trifulcaDebug.room.state.phase === 'intro' && !!trifulcaDebug.room.state.ladder);
  assert.equal(await page.evaluate(() => trifulcaDebug.room.state.bodies.some(b => b.id === trifulcaDebug.room.id)), true);
  console.log('PASS trifulca tutorial: every move works with real keys, then the ladder starts with you fighting.');
} finally { await browser.close(); }
