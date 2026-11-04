// El Silbón over a real relay with two panas: the guest hides in a nook and
// gets the host's peek windup as plain state, the look flushes the guest on the
// host and shows on the guest, the boss keeps going when the host leaves, and
// falling into the pit opens the seal for whoever is left. Also renders a bat, a
// loaded open carrito and a nook without page errors.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = qaDir(import.meta.url), room = `reliquia-silbon-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
const browser = await launch();
try {
  const host = await openGame(browser, 'reliquia', { name: 'Ana', room, query: 'debug' });
  host.setDefaultTimeout(90_000);
  await waitFor(host, () => window.reliquia?.room.connected);
  const guest = await openGame(browser, 'reliquia', { name: 'Beto', room, query: 'debug' });
  guest.setDefaultTimeout(90_000);
  await waitFor(guest, () => window.reliquia?.room.connected);
  await waitFor(host, () => reliquia.room.members.size === 2);
  await host.evaluate(() => reliquia.room.action('configure', { options: { place: 'mina', difficulty: 'hard' } }));
  await waitFor(host, () => reliquia.state.options.difficulty === 'hard');
  await host.locator('#start').click();
  await waitFor(guest, () => reliquia.state.phase === 'playing');

  // A quiet floor, the guest deep in a nook of the pit room, the boss at its opening.
  const ids = await host.evaluate(() => {
    const g = reliquia.room.game, [a, b] = g.players, n = g.layout.run.nooks.find(q => g.layout.run.rooms.find(r => r.id === q.room).kind === 'puente') || g.layout.run.nooks[0];
    for (const r of g.layout.run.rooms) g.woke[r.id] = 1; g.enemies = []; g.director.duration = 1e6; a.invulnerable = 1e6; b.invulnerable = 1e6;
    const guestId = g.players.find(p => p.id !== reliquia.room.id).id, q = g.players.find(p => p.id === guestId);
    Object.assign(q, { x: n.mouth.x - n.nx * 1.1, z: n.mouth.z - n.nz * 1.1 });
    reliquia.place(reliquia.room.id, g.layout.run.lifts.find(l => l.floor === 1).x, g.layout.run.lifts.find(l => l.floor === 1).z - 5);
    return { guestId, nook: n.id };
  });
  await waitFor(guest, nook => reliquia.me?.hidden === nook, ids.nook);
  await guest.waitForFunction(() => document.body.classList.contains('in-nook'));
  check('the guest is hidden in a nook, and sees it');

  await host.evaluate(({ nook }) => {
    const g = reliquia.room.game, n = g.layout.run.nooks.find(q => q.id === nook), e = reliquia.spawn('silbon', 0, 0), b = g.enemies.find(q => q.id === e.id);
    Object.assign(b, { x: n.front.x, z: n.front.z, mode: 'peek', peek: { spot: n.id, t: 2, of: 2, seq: 1 }, h: n.h + Math.PI }); g.players.find(p => p.id !== reliquia.room.id).invulnerable = 0;
  }, ids);
  await waitFor(guest, () => reliquia.state.enemies.some(e => e.kind === 'silbon' && e.peek?.seq === 1));
  check('the windup reaches the guest as plain state');
  await waitFor(guest, () => reliquia.me?.exposed > 0 && !reliquia.me?.hidden);
  // Flushed and out in the open: keep the guest standing for the rest of the suite.
  await host.evaluate(() => { for (const p of reliquia.room.game.players) p.invulnerable = 1e6; });
  assert.ok(await guest.evaluate(() => reliquia.state.events.some(e => e.kind === 'flush')), 'the guest hears about it');
  check('the look lands after the windup and pulls the guest out');
  await guest.screenshot({ path: path.join(output, 'silbon-peek.png') });

  // Some things only have to render: a bat asleep and flying, a loaded carrito.
  await host.evaluate(() => {
    const g = reliquia.room.game, cart = g.carts[0]; cart.contents = ['coins', 'mask', 'cup'].map(kind => ({ kind, worth: 1 })); cart.big = { kind: 'drum', worth: 1 };
    reliquia.spawn('bat', 2, 0); const b = reliquia.spawn('bat', 3, 1); if (b) g.enemies.find(q => q.id === b.id).hanging = true;
    reliquia.place(reliquia.room.id, cart.x, cart.z + 2.2, Math.PI); reliquia.face(Math.PI, -.3);
  });
  await waitFor(host, () => reliquia.view.enemies.size >= 2);
  await waitFor(host, t => reliquia.state.time > t + .4, await host.evaluate(() => reliquia.state.time));
  await host.screenshot({ path: path.join(output, 'silbon-cart.png') });
  check('bats and the open carrito render');

  // The host leaves mid-hunt: the boss goes on, and the pit still takes it.
  await host.context().close();
  await waitFor(guest, () => reliquia.room.isHost && reliquia.room.game?.enemies.some(e => e.kind === 'silbon'));
  check('a new host keeps the boss');
  const seal = await guest.evaluate(() => {
    const inRect = (x, z, [a, b, c, d], pad) => x > a - pad && x < c + pad && z > b - pad && z < d + pad, g = reliquia.room.game, room = g.layout.run.rooms.find(r => r.kind === 'puente'), pit = g.layout.run.pits.find(p => p.room === room.id), p = g.players.find(q => !q.held), e = g.enemies.find(q => q.kind === 'silbon');
    g.enemies = [e]; g.director.duration = 1e6; Object.assign(p, { invulnerable: 1e6, stun: 0, exposed: 0, downed: false, hp: 100 });
    // West rim to east rim with the pit between them, clear of whatever nook this deal put there.
    const wx = pit.rect[0] - 1.4, ex = pit.rect[2] + 1.4, inNook = (x, z) => g.layout.run.nooks.some(n => inRect(x, z, n.rect, .3));
    const z = [0, -2, 2, -4, 4, -1, 1, -3, 3].map(dz => room.z + dz).find(q => !inNook(wx, q) && !inNook(ex, q) && g.layout.walkable(wx, q, g, .72) && g.layout.walkable(ex, q, g, .42) && g.layout.crossable({ x: wx, z: q }, { x: ex, z: q }, g, .72));
    Object.assign(e, { x: wx, z, mode: 'chase', stun: 0, peek: null, immune: 0, windup: 0 }); Object.assign(p, { x: ex, z });
    return g.layout.run.seals[0]?.id ?? null;
  });
  // Nothing else removes it: gone means it fell (the fall itself can pass between polls).
  await waitFor(guest, () => !reliquia.state.enemies.some(e => e.kind === 'silbon'));
  if (seal) await waitFor(guest, id => reliquia.state.open[id] === 1, seal);
  check('chased across the pit it falls, is gone, and the seal opens');
  assert.deepEqual(guest.errors, []);
  check('no page errors');
} finally { await browser.close(); }
