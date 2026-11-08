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
import { inflateSync } from 'node:zlib';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const dir = process.env.PANA_SHOTS || join(tmpdir(), 'capis-shots'); mkdirSync(dir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: join(dir, `${name}.png`) });
// The screen point where the whole-map view shows map x (pick is linear across the screen).
const screenAt = (page, x) => page.evaluate(x => {
  const y = innerHeight * .4, a = capisDebug.world.pick(0, y).x, b = capisDebug.world.pick(innerWidth, y).x;
  return { x: (x - a) / (b - a) * innerWidth, y };
}, x);
// A screenshot's pixels (8-bit RGB/RGBA PNG, as Playwright writes them).
function decodePng(buf) {
  let at = 8, w = 0, h = 0, ch = 4; const parts = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString('ascii', at + 4, at + 8), data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') parts.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = i >= ch && y ? out[(y - 1) * stride + i - ch] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      out[y * stride + i] = (row[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
  }
  return (x, y) => { const k = Math.round(y) * stride + Math.round(x) * ch; return [out[k], out[k + 1], out[k + 2]]; };
}
// The whole map is on screen between the bars: the ground is drawn (unlike the
// sky over it), not under the setup bar, and every capi stands in the band.
async function assertMapShown(page, label) {
  await waitFor(page, () => capisDebug.world.settled && capisDebug.world.match === capisDebug.match);
  const g = await page.evaluate(async () => {
    const { surfaceY } = await import('/engine/play/terrain-mask.js'), m = capisDebug.match, w = capisDebug.world;
    const bar = document.getElementById('setup').getBoundingClientRect(), head = document.querySelector('.topbar').getBoundingClientRect();
    const xs = Array.from({ length: 10 }, (_, i) => 12 + i * (m.map.width - 24) / 9);
    return { bar: bar.top, head: head.bottom, w: innerWidth,
      ground: xs.map(x => w.screenOf(x, (surfaceY(m.mask, x) ?? m.map.water) - 1.2)), left: w.screenOf(0, m.map.water), right: w.screenOf(m.map.width, m.map.water),
      capis: m.capys.map(c => w.screenOf(c.x, c.y + .5)) };
  });
  assert.ok(g.left.x >= -2 && g.right.x <= g.w + 2, `${label}: the whole width fits (${g.left.x.toFixed(0)}..${g.right.x.toFixed(0)})`);
  for (const p of [...g.ground, ...g.capis]) assert.ok(p.y > g.head && p.y < g.bar - 2, `${label}: ${p.y.toFixed(0)} between ${g.head.toFixed(0)} and the setup bar at ${g.bar.toFixed(0)}`);
  const px = decodePng(await page.screenshot()), skyY = g.head + 6;
  const drawn = g.ground.filter(p => { const a = px(p.x, p.y), b = px(p.x, skyY); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 40; }).length;
  assert.ok(drawn >= 8, `${label}: ground drawn at ${drawn} of 10 columns`);
  // The capis (the placement markers) and the map choice are visible.
  const capiPx = g.capis.filter(p => { const a = px(p.x, p.y), b = px(p.x, skyY); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 30; }).length;
  assert.ok(capiPx >= 5, `${label}: capis drawn at ${capiPx} of 6`);
  assert.equal(await page.locator('#setup-maps [aria-checked="true"]').count(), 1);
  assert.ok(await page.locator('#setup-maps [aria-checked="true"]').isVisible());
}
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
  await assertMapShown(beto, 'desktop guest');
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
  await assertMapShown(ana, 'desktop host');
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
  await assertMapShown(solo, 'phone');
  await shot(solo, 'setup-mobile-before');
  const want = await auto(solo, 2) + 3, p = await screenAt(solo, want);
  await solo.touchscreen.tap(p.x, p.y);
  await waitFor(solo, () => capisDebug.setup.places[0] != null);
  const got = await solo.evaluate(() => capisDebug.setup.places[0]);
  assert.ok(Math.abs(got - want) < 1.5, `tapped ${want}, placed ${got}`);
  await assertMapShown(solo, 'phone placed');
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
