// Reliquia with real relay sessions: two desktop panas and a late phone.
// Encounters are placed with ?debug; every action (E, Q, G, barks, carrying,
// reviving, extraction) goes through the normal keyboard and room paths.
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { launch, openGame, waitFor, qaDir, base } from '../../../tests/browser-kit.js';

const output = qaDir(import.meta.url), room = `reliquia-qa-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async (name, mobile = false) => { const p = await openGame(browser, 'reliquia', { name, room, mobile, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const mine = page => page.evaluate(() => reliquia.state.players.find(p => p.id === reliquia.room.id));
const place = (host, id, x, z, h) => host.evaluate(({ id, x, z, h }) => reliquia.place(id, x, z, h), { id, x, z, h });
const settled = (page, x, z) => waitFor(page, ({ x, z }) => { const p = reliquia.state.players.find(p => p.id === reliquia.room.id); return Math.hypot(p.x - x, p.z - z) < .4; }, { x, z });
const face = (page, h) => page.evaluate(h => reliquia.face(h), h);
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  assert.equal(await b.locator('#start').isDisabled(), true); check('two panas share the lobby and the host owns the start');
  await a.screenshot({ path: path.join(output, 'lobby.png') });
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  const ids = await a.evaluate(() => ({ a: reliquia.room.id, b: reliquia.state.players.find(p => p.id !== reliquia.room.id).id }));

  // Walking: the guest predicts its own steps and the host agrees.
  const z0 = (await mine(b)).z;
  await b.keyboard.down('w'); await waitFor(b, z => reliquia.me.z < z - 1, z0); await b.keyboard.up('w');
  await waitFor(a, ({ id, z }) => reliquia.state.players.find(p => p.id === id).z < z - 1, { id: ids.b, z: z0 }); check('first-person W walks where the guest looks, on both screens');

  // The starting kit: a farol from the table with a real E press.
  const table = await a.evaluate(() => reliquia.view.world.run.loot.find(l => l.kind === 'farol'));
  await place(a, ids.b, table.x, table.z + 1.9, Math.PI); await settled(b, table.x, table.z + 1.9); await face(b, Math.PI);
  await waitFor(b, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'pick');
  await b.keyboard.press('e'); await waitFor(a, id => reliquia.state.players.find(p => p.id === id).hands.some(h => h?.kind === 'farol'), ids.b);
  await b.screenshot({ path: path.join(output, 'farol.png') }); check('a guest picks a farol off the camp table');

  // Throw it: it flies, lands, and stays pickable.
  await face(b, 0); await b.keyboard.press('g');
  await waitFor(a, () => reliquia.state.items.some(i => i.kind === 'farol' && i.state === 'air'));
  await waitFor(a, () => reliquia.state.items.some(i => i.kind === 'farol' && i.state === 'ground')); check('thrown loot flies and lands for everyone');

  // A big treasure needs both: each grabs a side and they walk it to the truck.
  const disk = await a.evaluate(() => { const g = reliquia.room.game, d = g.spawnItem('sunDisk', -1, 20, { y: 0, h: Math.PI / 2 }); reliquia.room.publish(); return { x: d.x, z: d.z, id: d.id }; });
  await place(a, ids.a, disk.x - 1.6, disk.z, Math.PI / 2); await place(a, ids.b, disk.x + 1.6, disk.z, -Math.PI / 2);
  await settled(a, disk.x - 1.6, disk.z); await settled(b, disk.x + 1.6, disk.z); await face(a, Math.PI / 2); await face(b, -Math.PI / 2);
  await waitFor(a, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'pick'); await a.keyboard.press('e');
  await waitFor(b, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'pick'); await b.keyboard.press('e');
  await waitFor(a, id => reliquia.state.items.find(i => i.id === id)?.carriers.length === 2, disk.id);
  await face(a, Math.PI / 2); await face(b, Math.PI / 2);
  await a.keyboard.down('w'); await b.keyboard.down('w');
  await waitFor(b, () => reliquia.state.haul >= 600, null, 90_000);
  await a.keyboard.up('w'); await b.keyboard.up('w');
  assert.equal(await a.evaluate(() => reliquia.state.truck.includes('sunDisk')), true);
  await a.screenshot({ path: path.join(output, 'truck.png') }); check('two panas carry the sun disk to the truck and it banks for both');

  // Barks travel: the guest votes for one more room.
  await b.keyboard.press('2');
  await waitFor(a, id => reliquia.state.events.some(e => e.kind === 'bark' && e.player === id && e.line === 1), ids.b); check('a shouted vote reaches the other pana');

  // Down the mine: the portal carries the host to floor 1.
  await place(a, ids.a, 0, -3, Math.PI); await face(a, Math.PI);
  await a.keyboard.down('w'); await waitFor(b, id => reliquia.state.players.find(p => p.id === id).x > 100, ids.a); await a.keyboard.up('w');
  assert.equal(await a.evaluate(() => reliquia.state.deepest), 1);
  await a.screenshot({ path: path.join(output, 'floor1.png') }); check('the mine mouth takes a pana down to floor 1');

  // A fallen pana, a held revive.
  const p = await mine(a); await place(a, ids.b, p.x + 1.4, p.z); await settled(b, p.x + 1.4, p.z);
  await a.evaluate(() => { const g = reliquia.room.game, me = g.players.find(q => q.id === reliquia.room.id); me.invulnerable = 0; g.damage(me, 100); reliquia.room.publish(); });
  await waitFor(b, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'revive');
  await b.keyboard.down('e'); await waitFor(a, id => !reliquia.state.players.find(q => q.id === id).downed, ids.a); await b.keyboard.up('e');
  await waitFor(b, () => reliquia.me.stats.revives === 1); check('a guest holds E to get the host back up');
  // Back to the camp, where nothing hunts them, before the rest of the checks.
  await place(a, ids.a, -2, 14); await place(a, ids.b, 2, 14); await settled(b, 2, 14);

  // The menu does not pause a shared run.
  await a.locator('#menu').click(); const t = await a.evaluate(() => reliquia.state.time);
  await waitFor(a, t => reliquia.state.time > t + .2, t); await a.locator('#pana-resume').click(); check('a multiplayer menu does not pause the expedition');

  // A late phone joins at the camp and walks with the touch pad.
  const c = await open('Luisa', true); await waitFor(c, () => reliquia.state.phase === 'playing');
  const cid = await c.evaluate(() => reliquia.room.id); const start = await mine(c);
  assert.equal(Math.round(start.x / 220), 0, 'late arrivals start at the camp');
  const pad = await c.locator('[data-move="w"]').boundingBox(), touch = await c.context().newCDPSession(c);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 }] });
  await waitFor(c, z => reliquia.me.z < z - .5, start.z);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
  assert.equal(await c.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await c.screenshot({ path: path.join(output, 'mobile.png') }); check('a late phone starts at the camp and moves with the touch pad');

  // The host leaves: the run carries on with its haul.
  const haul = await b.evaluate(() => reliquia.state.haul); await a.close();
  await waitFor(b, () => reliquia.room.isHost);
  assert.equal(await b.evaluate(() => reliquia.state.haul), haul); assert.equal(await b.evaluate(() => reliquia.state.phase), 'playing'); check('host migration keeps the run and the truck');

  // Everyone standing at the truck holds E: ¡Nos vamos!
  await place(b, ids.b, 12, 21); await place(b, cid, 12.5, 18); await settled(b, 12, 21);
  await b.keyboard.down('e'); await waitFor(b, () => reliquia.state.phase === 'results'); await b.keyboard.up('e');
  await waitFor(c, () => reliquia.state.outcome === 'extracted');
  assert.match(await c.locator('#result-payout').textContent(), /600/);
  await b.screenshot({ path: path.join(output, 'results.png') }); check('extraction pays the truck to everyone');
  await b.locator('#again').click(); await waitFor(c, () => reliquia.state.phase === 'playing' && reliquia.state.haul === 0); check('another expedition starts clean');

  await c.close(); await waitFor(b, () => reliquia.room.members.size === 1);
  await b.locator('#menu').click(); const frozen = await b.evaluate(() => reliquia.state.time); await b.waitForTimeout(350);
  assert.equal(await b.evaluate(() => reliquia.state.time), frozen); await b.locator('#pana-resume').click(); check('alone, the menu pauses the run');
  await b.evaluate(() => reliquia.room.cut()); await waitFor(b, () => !reliquia.room.connected);
  await b.locator('#offline-inline').click(); await waitFor(b, () => reliquia.room.offline && reliquia.state.phase === 'lobby'); await b.locator('#start').click();
  await waitFor(b, () => reliquia.state.phase === 'playing'); check('a lost connection offers a local expedition');
  console.log('render', await b.evaluate(() => ({ calls: reliquia.view.renderer.info.render.calls, triangles: reliquia.view.renderer.info.render.triangles })));
  await b.goto(base + '/'); await b.getByRole('heading', { name: 'Reliquia', exact: true }).waitFor(); check('the hub lists Reliquia');
  const errors = [a, b, c].flatMap(p => p.errors);
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} catch (error) {
  const clients = [];
  for (const context of browser.contexts()) for (const p of context.pages()) clients.push(await p.evaluate(() => window.reliquia ? { id: reliquia.room.id, phase: reliquia.state.phase, me: reliquia.me, items: reliquia.state.items, events: reliquia.state.events.slice(-6) } : location.href).catch(() => null));
  await writeFile(path.join(output, 'failure.json'), JSON.stringify(clients, null, 2));
  throw error;
} finally { await browser.close(); }
