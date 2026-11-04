// The swarm over a real relay with two panas: the telegraph and the bodies reach
// the guest, draw calls do not grow with the snakes, a bite slows the guest, the
// guest's machete scatters on both screens, and when the host leaves the guest
// rebuilds the swarm from its last snapshot and carries on.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = qaDir(import.meta.url), room = `reliquia-swarm-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
// Draw calls of the frame this page just rendered, with the swarm's group on or off.
const calls = (page, on) => page.evaluate(visible => new Promise(done => {
  reliquia.view.swarm.group.visible = visible;
  const r = reliquia.view.renderer.info.render;
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => { const n = r.calls; reliquia.view.swarm.group.visible = true; done(n); })));
}), on);
const browser = await launch();
try {
  const host = await openGame(browser, 'reliquia', { name: 'Ana', room, query: 'debug' });
  host.setDefaultTimeout(90_000);
  await waitFor(host, () => window.reliquia?.room.connected);
  const guest = await openGame(browser, 'reliquia', { name: 'Beto', room, query: 'debug' });
  guest.setDefaultTimeout(90_000);
  await waitFor(guest, () => window.reliquia?.room.connected);
  await waitFor(host, () => reliquia.room.members.size === 2);
  await host.locator('#start').click();
  await waitFor(guest, () => reliquia.state.phase === 'playing');

  // Both in a roomy spot below, nobody else around, nobody dying for the first part.
  await host.evaluate(() => {
    const g = reliquia.room.game, L = g.layout, room = g.layout.run.rooms.filter(r => r.floor === 1 && r.w > 10 && r.d > 10).sort((a, b) => b.w * b.d - a.w * a.d)[0];
    for (const r of L.run.rooms) g.woke[r.id] = 1;
    g.enemies = []; g.director.duration = 1e6;
    let spot = { x: room.x, z: room.z };
    for (let i = 0; i < 60 && !L.walkable(spot.x, spot.z, g, .8); i++) spot = { x: room.x + Math.sin(i) * i * .12, z: room.z + Math.cos(i) * i * .12 };
    for (const [i, p] of g.players.entries()) Object.assign(p, { x: spot.x + i, z: spot.z, h: 0, invulnerable: 1e6 });
    reliquia.room.publish();
  });
  await waitFor(guest, () => reliquia.me?.x > 100);
  assert.equal(await host.evaluate(() => reliquia.snakes(30)), true, 'the debug hook starts one');
  await waitFor(guest, () => reliquia.state.swarm?.phase === 'hiss');
  assert.ok(await guest.evaluate(() => reliquia.state.events.some(e => e.kind === 'swarm' && e.holes?.length)), 'the guest hears where');
  await waitFor(guest, () => reliquia.view.swarm.stats().cracks > 0);
  check('the telegraph reaches the guest: an event and open cracks, no text');

  // Pull everyone near so the bodies are in sight, on the host and on the guest.
  await waitFor(host, () => reliquia.state.swarm?.phase === 'crawl' && reliquia.state.swarm.out === 30);
  await host.evaluate(() => { const g = reliquia.room.game, me = g.players[0], c = g.swarmSim.chains; for (let i = 0; i < 30; i++) c.place(i, me.x + Math.cos(i) * 5, me.z + Math.sin(i) * 5, Math.cos(i), Math.sin(i), .17); });
  for (const page of [host, guest]) await waitFor(page, () => reliquia.view.swarm.stats().snakes === 30);
  const stats = await guest.evaluate(() => reliquia.view.swarm.stats());
  assert.equal(stats.segments, 30 * 12, 'every segment is one instance');
  const body = await guest.evaluate(() => { const c = reliquia.view.swarm.follower.chains; let long = 0; for (let s = 0; s < 30; s++) for (let i = 1; i < c.points; i++) { const k = s * c.points + i; long = Math.max(long, Math.hypot(c.x[k] - c.x[k - 1], c.z[k] - c.z[k - 1])); } return long; });
  assert.ok(body < .8, `the guest's own bodies hold together (longest link ${body})`);
  check('thirty snakes on both screens, with bodies the guest simulated itself');
  await guest.screenshot({ path: path.join(output, 'swarm-thirty.png') });

  // Draw calls: on minus off, at 30 snakes and at 150.
  const off30 = await calls(host, false), on30 = await calls(host, true);
  await host.evaluate(() => reliquia.snakes(150));
  await waitFor(host, () => reliquia.state.swarm?.phase === 'crawl' && reliquia.state.swarm.out === 150);
  await host.evaluate(() => { const g = reliquia.room.game, me = g.players[0], c = g.swarmSim.chains; for (let i = 0; i < 150; i++) c.place(i, me.x + Math.cos(i) * (3 + i * .05), me.z + Math.sin(i) * (3 + i * .05), Math.cos(i), Math.sin(i), .17); });
  await waitFor(host, () => reliquia.view.swarm.stats().snakes >= 140);
  const off150 = await calls(host, false), on150 = await calls(host, true);
  console.log(`swarm draw calls: 30 snakes +${on30 - off30}, 150 snakes +${on150 - off150} (of ${on150})`);
  assert.ok(on30 - off30 <= 3 && on150 - off150 <= 3, `${on30 - off30} and ${on150 - off150} extra draw calls`);
  check('three draw calls for the whole swarm, at 30 snakes and at 150');
  await host.screenshot({ path: path.join(output, 'swarm-hundred-fifty.png') });

  // A bite on the guest: small damage, the short slow, and it reaches the guest.
  await host.evaluate(() => {
    const g = reliquia.room.game, b = g.players.find(p => p.id !== reliquia.room.id), c = g.swarmSim.chains;
    b.invulnerable = 0; b.hp = 100;
    for (let i = 0; i < 12; i++) c.place(i, b.x + .1, b.z, 1, 0, .1);
  });
  await waitFor(guest, () => reliquia.me?.slow > 0 && reliquia.me.hp < 100);
  const bitten = await guest.evaluate(() => ({ hp: reliquia.me.hp, slow: reliquia.me.slow }));
  // A slow test machine may see a few bites by now: each is 3 HP, and the slow never stacks past its length.
  assert.equal((100 - bitten.hp) % 3, 0, `small bites: ${bitten.hp}`);
  assert.ok(bitten.slow <= 1.4, `a short slow: ${bitten.slow}`);
  check('a bite hurts a little and slows, as the guest sees it');

  // The guest swings a machete: the host's chains and the guest's own both let go.
  await host.evaluate(() => {
    const g = reliquia.room.game, b = g.players.find(p => p.id !== reliquia.room.id), c = g.swarmSim.chains;
    b.invulnerable = 1e6; b.h = 0; b.cooldown = 0; b.hands = [{ id: 901, kind: 'machete' }, null];
    for (let i = 0; i < 60; i++) c.place(i, b.x + Math.cos(i) * 1.1, b.z + 1.2 + Math.sin(i) * .6, Math.cos(i), Math.sin(i), .17);
    reliquia.room.publish();
  });
  await waitFor(guest, () => reliquia.me?.hands?.[0]?.kind === 'machete');
  await waitFor(guest, () => reliquia.view.swarm.follower.chains && reliquia.view.swarm.stats().snakes > 100);
  await guest.evaluate(() => { reliquia.face(0, 0); reliquia.room.action('use', { hand: 0 }); });
  await waitFor(guest, () => reliquia.state.events.some(e => e.kind === 'snake-scatter'));
  await waitFor(guest, () => reliquia.view.swarm.follower.chains.loose.some(v => v > 0));
  // The event only exists when the host's own chains let go, so it proves both ends.
  check('a machete swing scatters them on both screens');
  await guest.screenshot({ path: path.join(output, 'swarm-scatter.png') });

  // The host leaves: the guest rebuilds the swarm from the plain snapshot.
  const before = await guest.evaluate(() => ({ id: reliquia.state.swarm.id, out: reliquia.state.swarm.out }));
  await host.context().close();
  await waitFor(guest, () => reliquia.room.isHost && reliquia.room.game?.swarm);
  const after = await guest.evaluate(() => { const s = reliquia.room.game.swarm; return { id: s.id, out: s.out }; });
  assert.deepEqual(after, before, 'the same swarm');
  await waitFor(guest, () => !!reliquia.room.game.swarmSim);
  const heads = await guest.evaluate(() => reliquia.state.swarm.heads);
  await waitFor(guest, was => reliquia.state.swarm && reliquia.state.swarm.heads !== was, heads);
  check('the new host rebuilds it from the snapshot, and the heads keep moving');
  await waitFor(guest, () => reliquia.view.swarm.stats().snakes > 0);
  assert.deepEqual(guest.errors, []);
  check('no page errors');
} finally { await browser.close(); }
