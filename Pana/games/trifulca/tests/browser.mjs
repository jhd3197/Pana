// Two real clients: both prepare the 3D barrio, the host picks the arena and
// starts, the guest's stick and a single tapped jab reach the host, the bell
// reads the card and both agree on the verdict.
// Run: npm run test:browser -- trifulca
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `trifulca-${Date.now()}`;
try {
  // Both wear something on the head: a hat of the old look and a wardrobe one with goggles.
  const host = await openGame(browser, 'trifulca', { name: 'Ana', room, query: 'debug', avatar: { hat: 'llanero', hatColor: '#7a5230' } });
  const guest = await openGame(browser, 'trifulca', { name: 'Bruno', room, query: 'debug', avatar: { wardrobe: { top: 'franela', hat: 'copa', glasses: 'piloto', neck: 'none', back: 'none', extras: {} } } });
  await waitFor(host, () => trifulcaDebug.room.state.players.length === 2);
  assert.equal(await host.evaluate(() => trifulcaDebug.world.camera.isPerspectiveCamera), true, 'the barrio is a 3D scene');
  assert.equal(await host.evaluate(() => trifulcaDebug.room.state.options.arena), 'rotar', 'Varios is the default');
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
  // Each client sees its own pana and the remote one in the helmet, and nothing else.
  for (const page of [host, guest]) await waitFor(page, () => {
    const heads = [...trifulcaDebug.world.panas.values()].map(entry => entry.pana.character.head.children.filter(o => o.visible));
    return heads.length === 2 && heads.every(parts => parts.some(o => o.name === 'hat:casco') && !parts.some(o => !o.name || (/^(hat|outfit|glasses|accessory):/.test(o.name) && o.name !== 'hat:casco')));
  });
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
  // A pinned map stays; pin Varios on a new night and the next fights change map
  // on both clients, with what the old map held gone from the renderer.
  await host.evaluate(() => { const g = trifulcaDebug.room.game; g.options.arena = 'rotar'; g.arenaLast = g.arenaNow = 'mercado'; g.arenaCycle = ['toldo', 'cebra', 'motos']; g.arenaNext = 'toldo'; g.time = 6; trifulcaDebug.room.publish(); });
  await waitFor(guest, () => trifulcaDebug.world.spareArena === 'toldo', null, 60000);
  await host.evaluate(() => { trifulcaDebug.room.game.time = .01; });
  for (const page of [host, guest]) await waitFor(page, () => trifulcaDebug.room.state.phase === 'intro' && trifulcaDebug.world.arenaId === 'toldo', null, 60000);
  assert.equal(await guest.evaluate(() => trifulcaDebug.world.spareArena), null, 'the dressed map went on stage');
  const memory = () => trifulcaDebug.world.renderer.info.memory.geometries;
  await guest.evaluate(() => { const g = trifulcaDebug.world; g.setArena('cebra'); g.setArena('toldo'); });
  const settled = await guest.evaluate(memory);
  for (let i = 0; i < 2; i++) await guest.evaluate(() => { const g = trifulcaDebug.world; g.setArena('cebra'); g.setArena('toldo'); });
  await waitFor(guest, (cap) => trifulcaDebug.world.renderer.info.memory.geometries <= cap, settled + 40, 60000);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS trifulca: two clients share the 3D barrio, the guest moves, jabs, kicks, sweeps and throws on the host, the bell gives both the same verdict.');
} finally { await browser.close(); }
