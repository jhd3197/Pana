// Two real clients: both prepare the 3D barrio, the host picks the arena and
// starts, the guest's stick and a single tapped jab reach the host, the bell
// reads the card and both agree on the verdict.
// Run: npm run test:browser -- trifulca
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `trifulca-${Date.now()}`;
try {
  const host = await openGame(browser, 'trifulca', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'trifulca', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => trifulcaDebug.room.state.players.length === 2);
  assert.equal(await host.evaluate(() => trifulcaDebug.world.camera.isPerspectiveCamera), true, 'the barrio is a 3D scene');
  await host.locator('[data-room-option="arena"][data-value="mercado"]').click();
  await waitFor(guest, () => trifulcaDebug.room.state.options.arena === 'mercado');
  await waitFor(guest, () => trifulcaDebug.world.arenaId === 'mercado');
  await host.locator('#start').click();
  await waitFor(guest, () => trifulcaDebug.room.state.phase === 'intro');
  await waitFor(guest, () => [...document.querySelectorAll('#intro-card .fighter-portrait')].length === 2 && [...document.querySelectorAll('#intro-card .fighter-portrait')].every(img => img.complete && img.naturalWidth > 0));
  // Two panas and no bots: they fight each other.
  assert.deepEqual(await guest.evaluate(() => trifulcaDebug.room.state.bodies.map(b => b.id).sort()), await host.evaluate(() => trifulcaDebug.room.state.players.map(p => p.id).sort()));
  await host.evaluate(() => { trifulcaDebug.room.game.time = .05; });
  await waitFor(guest, () => trifulcaDebug.room.state.phase === 'fight');
  // The side chooser keeps the default side while a 1v1 stays on its line.
  assert.equal(await guest.evaluate(() => trifulcaDebug.world.cameraSide), 0, 'a 1v1 keeps the default camera side');
  const body = () => trifulcaDebug.room.state.bodies.find(b => b.id === trifulcaDebug.room.id);
  const start = await guest.evaluate(body);
  await guest.locator('#world').click({ position: { x: 640, y: 400 } });
  await guest.keyboard.down('a'); await guest.keyboard.down('w');
  await waitFor(host, ({ id, x, z }) => { const b = trifulcaDebug.room.state.bodies.find(b => b.id === id); return Math.hypot(b.x - x, b.z - z) > .8; }, start);
  await guest.keyboard.up('a'); await guest.keyboard.up('w');
  // One quick tap is still a jab on the host.
  await guest.keyboard.press('j');
  await waitFor(host, (id) => trifulcaDebug.room.state.events.some(e => e.type === 'jab' && e.id === id), start.id);
  // Real guest key presses: each new move must land on the host and appear
  // with the same move identity and score in the guest snapshot.
  for (const [move, key, score] of [['kick', 'i', 'kicks'], ['sweep', 'u', 'sweeps'], ['toss', 'o', 'tosses']]) {
    await host.evaluate(() => {
      const game = trifulcaDebug.room.game;
      game.time = game.fight.time = 90; game.fight.motoDone = true;
      game.bodies.forEach((b, i) => Object.assign(b, {
        x: i ? .46 : -.46, z: 0, h: i ? -Math.PI / 2 : Math.PI / 2,
        act: 'idle', at: 0, charge: -1, buffer: 0, vx: 0, vz: 0,
        aguante: 100, mareo: 0, inv: 0, contra: 0, moving: 0,
      }));
      trifulcaDebug.room.publish();
    });
    await waitFor(guest, () => trifulcaDebug.room.state.bodies.every(b => b.act === 'idle' && b.mareo === 0 && Math.abs(b.x) < .6));
    await guest.keyboard.press(key);
    await waitFor(host, ({ move, id }) => trifulcaDebug.room.state.events.some(e => e.type === 'hit' && e.move === move && e.by === id), { move, id: start.id });
    await waitFor(guest, ({ move, id, score }) => trifulcaDebug.room.state.events.some(e => e.type === 'hit' && e.move === move && e.by === id)
      && trifulcaDebug.room.state.bodies.find(b => b.id === id).score[score] === 1, { move, id: start.id, score });
    await waitFor(host, () => trifulcaDebug.room.state.bodies.every(b => b.act === 'idle'));
  }
  // The host owns the clock: ring the bell now.
  await host.evaluate(() => { trifulcaDebug.room.game.time = .01; });
  await waitFor(guest, () => trifulcaDebug.room.state.phase === 'after');
  const verdict = await guest.evaluate(() => trifulcaDebug.room.state.result);
  assert.deepEqual(verdict, await host.evaluate(() => trifulcaDebug.room.state.result));
  assert.ok(['puntos', 'publico'].includes(verdict.how));
  await waitFor(guest, () => !document.getElementById('verdict').hidden || trifulcaDebug.world.replaying);
  await waitFor(guest, () => !document.getElementById('verdict').hidden);
  assert.equal(await guest.locator('.fight-stats tbody tr').count(), 5, 'result shows the actual fight statistics');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS trifulca: two clients share the 3D barrio, the guest moves, jabs, kicks, sweeps and throws on the host, the bell gives both the same verdict.');
} finally { await browser.close(); }
