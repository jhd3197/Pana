import { menuClick } from './menu-helpers.js';
// Derrape online: two real browser clients in one Colyseus room. Lobby sync,
// host controls, shared countdown, live remote cars, relayed mango throws,
// one finish order, reload-and-resume, and host handoff with the bots.
// npm start, then: node games/derrape/tests/online.browser.js [playwright path]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const errors = [];
const code = 'test' + Math.random().toString(36).slice(2, 8);
const step = (label) => console.log(`· ${label}`);

async function player(name) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await context.addInitScript((n) => localStorage.setItem('pana:name', n), name);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  // Warm each independent garage before the room test.
  await page.goto(`${origin}/g/derrape/?debug&auto&speed=5`);
  await page.waitForFunction(() => window.garage?.car, null, { timeout: 30000 });
  return page;
}
async function join(page, query) {
  await page.goto(`${origin}/g/derrape/?debug&auto&speed=5&room=${code}${query}`);
  await page.waitForFunction(() => window.getNet?.()?.state.players.length > 0, null, { timeout: 30000 });
}
const state = (page) => page.evaluate(() => {
  const n = getNet();
  return { ...n.state, id: n.id, isHost: n.isHost, mode: document.getElementById('garage').classList.contains('hidden') ? 'race' : 'garage',
    raceState: race.state, cars: race.cars.map(c => ({ id: c.netId, remote: !!c.remote, x: c.x, z: c.z, done: c.done, bot: !!c.bot, buf: c.buf?.length ?? 0 })) };
});
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });

try {
  // Guest first: the party leader still hosts when they arrive.
  const guest = await player('Guest');
  const host = await player('Leader');
  // The SDK loads only on joining, so an offline garage warmup cannot prevent
  // a cold CDN request from exceeding the room's 15-second leader window.
  // Hold the real leader matchmaking request until the guest has joined.
  // Both clients still use the normal app flow and real room host election.
  let releaseLeader;
  const leaderGate = new Promise(resolve => { releaseLeader = resolve; });
  const matchmaking = '**/matchmake/joinOrCreate/derrape';
  await host.route(matchmaking, async route => { await leaderGate; await route.continue(); });
  const leaderReady = host.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/matchmake/joinOrCreate/derrape'), { timeout: 30000 });
  await host.goto(`${origin}/g/derrape/?debug&auto&speed=5&room=${code}&lead=1`);
  await leaderReady;
  await join(guest, '');
  releaseLeader();
  await until(host, () => window.getNet?.()?.state.players.length === 2);
  await host.unroute(matchmaking);
  await until(guest, () => getNet().state.players.length === 2);
  await until(host, () => getNet().state.players.length === 2);
  let g = await state(guest), h = await state(host);
  const arrivals = h.players.map(p => p.joinedAt);
  assert.ok(Math.max(...arrivals) - Math.min(...arrivals) < 15000, 'both players arrive inside the party-leader window');
  assert.equal(h.isHost, true, 'the lead=1 player hosts');
  assert.equal(g.isHost, false);
  assert.equal(g.players.find(p => p.id === h.id).name, 'Leader');
  step('lobby: both panas listed, the leader hosts');

  // Guest's car pick reaches the room; host's track pick reaches the guest.
  await guest.evaluate(() => document.getElementById('next').click());
  await menuClick(host, '#t-next');
  await until(guest, () => getNet().state.track === 'desierto');
  await until(host, (id) => getNet().state.players.find(p => p.id === id)?.car === 1, g.id);
  assert.equal(await guest.evaluate(() => document.getElementById('track-name').textContent), 'Pana Desierto');
  assert.equal(await guest.isDisabled('#t-next'), true, 'guests cannot change the track');
  assert.equal(await guest.isDisabled('#play'), true, 'guests cannot start');
  step('host picks the track, guest picks a car');

  await menuClick(host, '#play');
  await until(host, () => race.state === 'go', null, 90000);
  await until(guest, () => race.state === 'go', null, 90000);
  h = await state(host); g = await state(guest);
  assert.equal(h.cars.length, 4, 'two panas plus two bots');
  assert.deepEqual(h.cars.map(c => c.id).sort(), g.cars.map(c => c.id).sort(), 'same roster on both screens');
  assert.ok(h.cars.filter(c => c.bot).every(c => !c.remote), 'the host drives the bots');
  assert.ok(g.cars.filter(c => c.bot).every(c => c.remote), 'the guest sees them as remote');
  step('race started on both screens with the same grid');

  // Live remote cars: the guest's view of the host's car lies on the path the
  // host actually drove a moment ago (?speed=5 stretches the 110 ms delay).
  await host.evaluate(() => { window.trail = []; window.trailTimer = setInterval(() => race.player && trail.push([race.player.x, race.player.z, getNet().now()]), 20); });
  // Wait for an actual observed path. A fixed delay can expire with zero
  // samples while another WebGL page is compiling, yielding Infinity below.
  await host.waitForFunction(() => trail.length > 10 && trail.at(-1)[2] - trail[0][2] > 1500, null, { timeout: 30000 });
  const seen = await guest.evaluate((id) => { const c = race.cars.find(c => c.netId === id); return { x: c.x, z: c.z, buf: c.buf.length, now:getNet().now(), delay:c.delay, poses:c.buf.map(p=>({t:p.t,x:p.p[0],z:p.p[2]})) }; }, h.id);
  const gap = await host.evaluate(({ x, z }) => Math.min(...trail.slice(1).map(([bx, bz], i) => {
    const [ax, az] = trail[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l));
    return Math.hypot(ax + dx * k - x, az + dz * k - z);
  })), seen);
  assert.ok(seen.buf > 0, 'poses are arriving');
  if (gap >= 6) console.log(JSON.stringify({seen,trail:await host.evaluate(()=>({first:trail[0],last:trail.at(-1),count:trail.length,now:getNet().now()})),gap}));
  assert.ok(gap < 6, `remote car follows the real path (${gap.toFixed(1)} m off)`);
  step('remote cars follow their owners');

  // A mango the host throws flies on the guest's screen too.
  // At 5x speed a projectile can hit or expire between polling snapshots.
  // Observe its actual scene object at delivery, and match the exact throw ID.
  await guest.evaluate(() => {
    window.receivedMangos = [];
    getNet().on('fx', (owner, kind, data) => {
      if (kind !== 'throw' || data.kind !== 'mango') return;
      const projectile = race.items.projectiles.find(f => f.id === data.id && f.owner.netId === owner);
      if (projectile && race.scene.getObjectById(projectile.m.id) === projectile.m) receivedMangos.push({ owner, id: data.id });
    });
  });
  await host.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    window.throwTestMango = () => {
      const car = race.player;
      // Collisions temporarily prevent throwing; let the real recovery finish.
      if (car.spin > 0 || car.done) return false;
      car.inventory = [null, null]; addItem(car, 'mango', 0);
      if (!race.items.use(car, 1)) return false;
      window.testMangoId = race.items.projectiles.at(-1).id;
      return true;
    };
  });
  await until(host, () => throwTestMango(), null, 5000);
  const thrownId = await host.evaluate(() => testMangoId);
  await until(guest, ({ owner, id }) => receivedMangos.some(f => f.owner === owner && f.id === id), { owner: h.id, id: thrownId }, 5000);
  step('mango throws are relayed');

  // Reload mid-race: the guest comes back to the same car.
  await guest.reload();
  await until(guest, () => window.getNet?.() && race.state === 'go', null, 90000);
  assert.equal(await guest.evaluate(() => getNet().id), g.id, 'same session after reload');
  step('reload resumes the same car');

  await until(host, () => getNet().state.phase === 'results', null, 240000);
  await until(guest, () => getNet().state.phase === 'results', null, 30000);
  h = await state(host); g = await state(guest);
  const order = (s) => s.racers.filter(r => !r.retired).sort((a, b) => a.place - b.place).map(r => r.id);
  assert.deepEqual(order(h), order(g), 'one finish order');
  assert.equal(await guest.evaluate(() => document.getElementById('result').classList.contains('hidden')), false);
  assert.equal(await guest.isDisabled('#again'), true, 'only the host restarts');
  step(`results agree: ${order(h).join(' > ')}`);

  // Next race, then the host leaves: the guest hosts and drives the bots.
  await host.click('#again');
  await until(guest, () => race.state === 'go', null, 90000);
  await host.context().close();
  await until(guest, () => getNet().isHost && race.cars.filter(c => c.bot).every(c => !c.remote), null, 15000);
  const before = await guest.evaluate(() => race.cars.filter(c => c.bot).map(c => c.prog + c.lap * 1e5));
  await guest.waitForTimeout(1500);
  const after = await guest.evaluate(() => race.cars.filter(c => c.bot).map(c => c.prog + c.lap * 1e5));
  assert.ok(after.some((v, i) => v !== before[i]), 'bots keep driving under the new host');
  step('host handoff keeps the bots racing');

  assert.deepEqual(errors, []);
  console.log('derrape online: all good');
} finally {
  await browser.close();
}
