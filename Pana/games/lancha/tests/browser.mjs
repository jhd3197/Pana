// Two real clients in one room: both prepare the 3D river, host options reach
// the guest, the guest's held W drives its lancha on the host, the gold guide
// shows on the water, host migration keeps the race and both agree on the
// result. Then a 390 px phone drives with the touch Gas button.
// Run: npm run test:browser -- lancha
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `lancha-${Date.now()}`;
const check = text => console.log(`ok: ${text}`);
try {
  const host = await openGame(browser, 'lancha', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'lancha', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => lanchaDebug.state.players.length === 2, undefined, 90_000);
  assert.equal(await host.evaluate(() => lanchaDebug.world.camera.isPerspectiveCamera), true, 'the river is a 3D scene');
  assert.equal(await guest.locator('#start').isDisabled(), true, 'only the host starts');
  await host.locator('[data-room-option="rivals"][data-value="easy"]').click();
  await waitFor(guest, () => lanchaDebug.state.options.rivals === 'easy');
  check('host options reach the guest');
  await host.locator('#start').click();
  await waitFor(guest, () => lanchaDebug.state.phase === 'racing', undefined, 90_000);
  assert.equal(await guest.evaluate(() => lanchaDebug.state.boats.length), 8, 'river drivers fill the start to 8');
  // Drawing paused while keys are held, so software WebGL doesn't starve input.
  const quiet = v => Promise.all([host, guest].map(p => p.evaluate(v => lanchaDebug.quiet(v), v)));
  await quiet(true);
  const id = await guest.evaluate(() => lanchaDebug.room.id), start = await host.evaluate(id => lanchaDebug.state.boats.find(b => b.driver.id === id).progress, id);
  await guest.locator('#world').click({ position: { x: 640, y: 400 } });
  await guest.keyboard.down('w');
  await waitFor(host, ({ id, start }) => { const b = lanchaDebug.state.boats.find(b => b.driver.id === id); return b.throttle === 1 && b.progress > start + 25; }, { id, start }, 90_000);
  await guest.keyboard.up('w');
  await waitFor(host, id => lanchaDebug.state.boats.find(b => b.driver.id === id).throttle === 0, id);
  check('holding W on the guest drives its lancha on the host; letting go cuts the gas');
  await quiet(false);
  await waitFor(guest, () => lanchaDebug.guide.group.visible === true);
  check('the gold guide shows on the water around the guest');
  // Late arrivals spectating is covered by tests/rules.test.js (a third
  // WebGL page made this suite time out on busy machines).
  // The host leaves mid-race: the guest takes over with the race intact.
  const before = await guest.evaluate(() => lanchaDebug.state.time);
  await host.close();
  await waitFor(guest, () => lanchaDebug.room.isHost, undefined, 90_000);
  assert.equal(await guest.evaluate(() => lanchaDebug.state.phase), 'racing');
  await waitFor(guest, t => lanchaDebug.state.time > t + 1, before);
  assert.equal(await guest.evaluate(() => lanchaDebug.state.boats.length), 8, 'a river driver takes the host\'s lancha');
  check('host migration keeps the race going');
  // Finish → results.
  await guest.evaluate(() => { const d = lanchaDebug; d.place(d.room.id, d.RIVER.LENGTH - 8, 0); d.room.game.boatOf(d.room.id).v = 10; for (const b of d.room.game.boats) if (b.driver.id !== d.room.id) b.finish = 200; d.room.publish(); });
  await guest.locator('#results').waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await guest.evaluate(() => document.querySelectorAll('#result-board .pk-row').length), 8);
  assert.equal(await guest.evaluate(() => lanchaDebug.state.boats.find(b => b.driver.id === lanchaDebug.room.id).finish !== null), true);
  check('finish line and results');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await guest.close();
  // Phone: the Gas button drives.
  const phone = await openGame(browser, 'lancha', { name: 'Móvil', room: `${room}-touch`, mobile: true, query: 'debug' });
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll at 390 px');
  await phone.locator('#start').click();
  await waitFor(phone, () => lanchaDebug.state.phase === 'racing', undefined, 90_000);
  await phone.evaluate(() => lanchaDebug.quiet(true));
  const box = await phone.locator('[data-input="gas"]').boundingBox(), cdp = await phone.context().newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await waitFor(phone, () => { const d = lanchaDebug, b = d.state.boats.find(b => b.driver.id === d.room.id); return b.throttle === 1 && b.v > 6; }, undefined, 90_000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  check('the touch Gas button drives on a 390 px phone');
  assert.deepEqual(phone.errors, []);
  console.log('PASS lancha: two clients share the river, guest throttle drives on the host, guide, migration, results and touch.');
} finally { await browser.close(); }
