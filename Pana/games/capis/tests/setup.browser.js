// The free-for-all's setup with two real clients: the host's map switch
// reaches the guest and clears the picks, the guest places its own capi by a
// real click on the whole-map view, a forged pick for the host's capi and a
// stale one are turned down (and the guest is told), the guest reconnecting
// keeps the setup, the start locks it. Then solo on a phone: a tap places the
// pana's capi and the machine's five take fair spots. Screenshots go to
// PANA_SHOTS (or the temp folder's capis-shots).
// Run: npm run test:browser -- capis/tests/setup
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const dir = process.env.PANA_SHOTS || join(tmpdir(), 'capis-shots'); mkdirSync(dir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: join(dir, `${name}.png`) });
// The screen point where the whole-map view shows map x (pick is linear across the screen).
const screenAt = (page, x) => page.evaluate(x => {
  const y = innerHeight * .4, a = capisDebug.world.pick(0, y).x, b = capisDebug.world.pick(innerWidth, y).x;
  return { x: (x - a) / (b - a) * innerWidth, y };
}, x);
const auto = (page, capi) => page.evaluate(async capi => {
  const { groundOf } = await import('/g/capis/setup-rules.js'), s = capisDebug.setup;
  return groundOf(s.seeds[s.pick]).auto[capi];
}, capi);
const placeOwn = page => page.evaluate(async () => {
  const { groundOf } = await import('/g/capis/setup-rules.js'), s = capisDebug.setup;
  capisDebug.placeAt(groundOf(s.seeds[s.pick]).auto[1]);
});

const browser = await launch(), code = `capis-setup-${Date.now()}`;
try {
  const ana = await openGame(browser, 'capis', { name: 'Ana', room: code, query: 'debug' });
  await waitFor(ana, () => capisDebug.online && capisDebug.room.isHost && capisDebug.room.connected);
  const beto = await openGame(browser, 'capis', { name: 'Beto', room: code, query: 'debug' });
  await waitFor(beto, () => capisDebug.room.connected && capisDebug.room.state.players.length === 2);
  await ana.evaluate(() => document.querySelector('[data-room-option="mode"][data-value="ffa"]').click());
  await waitFor(beto, () => capisDebug.room.state.options.mode === 'ffa');
  await ana.locator('#start').click();
  await waitFor(beto, () => capisDebug.inSetup && capisDebug.setup?.seeds.length === 3);
  assert.equal(await beto.evaluate(() => capisDebug.playing), false, 'no turns in the setup');
  assert.equal(await beto.locator('#setup-go').isDisabled(), true, 'only the host starts');
  assert.equal(await beto.locator('[data-map="1"]').isDisabled(), true, 'only the host switches');
  assert.equal(await beto.evaluate(() => capisDebug.selected), 1, 'Beto places his own capi');

  // The host switches to map 2: the guest previews the same one.
  await ana.locator('[data-map="1"]').click();
  await waitFor(beto, () => capisDebug.setup.pick === 1 && capisDebug.match.map.seed === capisDebug.setup.seeds[1] && capisDebug.world.match === capisDebug.match);
  // Beto clicks the map on capi 3's fair spot.
  const target = await auto(beto, 3), at = await screenAt(beto, target);
  await beto.mouse.click(at.x, at.y);
  await waitFor(ana, () => capisDebug.setup.places[1] != null);
  const placed = await ana.evaluate(() => capisDebug.setup.places[1]);
  assert.ok(Math.abs(placed - target) < 1.5, `placed at ${placed}, clicked at ${target}`);
  await waitFor(beto, () => Math.abs(capisDebug.match.capys[1].x - capisDebug.setup.places[1]) < .01);
  await shot(beto, 'setup-desktop-guest');

  // Forged (Ana's capi 0) and stale picks: the host turns them down and Beto hears why.
  const rev = await beto.evaluate(() => capisDebug.setup.rev);
  await beto.evaluate(rev => capisDebug.room.action('setup', { step: 'place', capi: 0, x: 90, rev }), rev);
  await waitFor(beto, () => capisDebug.setup.rejects?.[capisDebug.room.id]?.reason === 'not-owner');
  await waitFor(beto, () => /no es tuyo|isn't yours/.test(document.getElementById('toast').textContent));
  await beto.evaluate(rev => capisDebug.room.action('setup', { step: 'place', capi: 1, x: 90, rev: rev - 1 }), rev);
  await waitFor(beto, () => capisDebug.setup.rejects?.[capisDebug.room.id]?.reason === 'stale');
  assert.equal(await ana.evaluate(() => capisDebug.setup.places[0]), undefined);

  // Beto drops and comes back: his capi's pick went with him, the setup carries on.
  await beto.context().close();
  await waitFor(ana, () => capisDebug.room.state.players.length === 1 && capisDebug.setup.places[1] == null, null, 60_000);
  const beto2 = await openGame(browser, 'capis', { name: 'Beto', room: code, query: 'debug' });
  await waitFor(beto2, () => capisDebug.inSetup && capisDebug.setup.pick === 1 && capisDebug.setup.owners[1] === capisDebug.room.id);
  await placeOwn(beto2);
  await waitFor(ana, () => capisDebug.setup.places[1] != null);
  // A switch resets every pick.
  await ana.locator('[data-map="2"]').click();
  await waitFor(beto2, () => capisDebug.setup.pick === 2 && Object.keys(capisDebug.setup.places).length === 0);
  await ana.locator('[data-map="1"]').click();
  await waitFor(beto2, () => capisDebug.setup.pick === 1 && capisDebug.match.map.seed === capisDebug.setup.seeds[1]);
  await placeOwn(beto2);
  await waitFor(ana, () => capisDebug.setup.places[1] != null);
  const spawns = await ana.evaluate(() => capisDebug.setup.spawns), seeds = await ana.evaluate(() => capisDebug.setup.seeds);
  await shot(ana, 'setup-desktop-host');
  // The host starts: both play on the chosen map from the locked spots; picks are refused now.
  await ana.locator('#setup-go').click();
  await waitFor(beto2, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.teams === 6);
  assert.equal(await beto2.evaluate(() => capisDebug.match.map.seed), seeds[1]);
  const xs = await ana.evaluate(() => capisDebug.match.capys.map(c => c.x));
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(xs[i] - spawns[i]) < 1.5, `capi ${i}: ${xs[i]} vs ${spawns[i]}`);
  assert.equal(await ana.evaluate(() => capisDebug.room.game.setupAct('x', 'place', { capi: 1, x: 90, rev: 0 }).reason), 'locked');
  assert.deepEqual([...ana.errors, ...beto2.errors], []);
  console.log('PASS capis setup online: host switch reaches the guest and clears picks, own capi only, forged and stale refused, rejoin, start locks.');
  await ana.context().close(); await beto2.context().close();

  // Solo on a phone: the setup, a tap places the pana's capi, the machine's take fair spots.
  const solo = await openGame(browser, 'capis', { name: 'Ana', mobile: true, query: 'debug&mode=ffa' });
  await solo.locator('#start').tap();
  await waitFor(solo, () => capisDebug.inSetup && capisDebug.world.match === capisDebug.match);
  await shot(solo, 'setup-mobile-before');
  const want = await auto(solo, 2) + 3, p = await screenAt(solo, want);
  await solo.touchscreen.tap(p.x, p.y);
  await waitFor(solo, () => capisDebug.setup.places[0] != null);
  const got = await solo.evaluate(() => capisDebug.setup.places[0]);
  assert.ok(Math.abs(got - want) < 1.5, `tapped ${want}, placed ${got}`);
  await shot(solo, 'setup-mobile-placed');
  await solo.locator('#setup-go').tap();
  await waitFor(solo, () => capisDebug.playing && capisDebug.match.teams === 6);
  const startXs = await solo.evaluate(() => capisDebug.match.capys.map(c => c.x));
  assert.ok(Math.abs(startXs[0] - got) < 1.5, 'the pana starts where it tapped');
  const sorted = [...startXs].sort((a, b) => a - b);
  for (let i = 1; i < 6; i++) assert.ok(sorted[i] - sorted[i - 1] >= 8, `apart: ${sorted.join()}`);
  assert.deepEqual(solo.errors, []);
  console.log('PASS capis setup solo: phone tap places the capi, the machine takes fair spots, the match starts there.');
} finally { await browser.close(); }
