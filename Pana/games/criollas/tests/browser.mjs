import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [];
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 40000, polling: 50 });
async function open(name, query = '', viewport = { width: 1280, height: 800 }, touch = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await context.addInitScript(({ name, touch }) => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:avatar', JSON.stringify({ outfitColor: '#3d7bf2', hat: 'gorra' })); localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false })); if (!touch) window.requestAnimationFrame = () => 0; }, { name, touch });
  const page = await context.newPage(); page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
  page.on('requestfailed', r => console.error('Request failed:', r.url(), r.failure()?.errorText));
  console.log(`Opening ${name}`);
  await page.goto(`${base}/g/criollas/?debug&${query}`, { waitUntil: 'domcontentloaded' });
  await wait(page, () => !!window.criollasDebug); console.log(`Loaded ${name}`); return page;
}
// Background pages may not run animation frames: draw a couple of seconds by hand.
const frames = page => page.evaluate(() => { const d = criollasDebug; for (let i = 0; i < 60; i++) d.world.render(d.room.state, { dt: .05, shot: d.shot, active: d.room.state.turn === d.room.seat }); });
async function screenshot(page, name) {
  await page.evaluate(() => { const d = criollasDebug; d.world.render(d.room.state, { dt: .016, shot: d.shot, active: d.room.state.turn === d.room.seat }); });
  await page.screenshot({ path: `art/criollas/${name}.png` });
}
try {
  await mkdir('art/criollas', { recursive: true });
  const code = `criollas-${Date.now()}`, host = await open('Ana', `room=${code}`);
  await wait(host, () => criollasDebug.room.isHost && criollasDebug.room.connected);
  const guest = await open('Beto', `room=${code}`);
  await wait(guest, () => criollasDebug.room.state.players.filter(p => p.id !== null).length === 2);
  assert.equal(await guest.locator('#start').isDisabled(), true);
  assert.equal(await guest.evaluate(() => criollasDebug.room.seat), 1);
  assert.equal(await guest.evaluate(() => criollasDebug.room.state.players[0].avatar.outfitColor), '#3d7bf2');
  await screenshot(host, 'lobby');
  // The host chooses the place and difficulty; the guest sees both and cannot change them.
  await host.locator('#map-choice').selectOption('hato'); await host.locator('[data-room-option="difficulty"][data-value="dificil"]').click();
  await wait(guest, () => criollasDebug.room.state.mapId === 'hato' && criollasDebug.room.state.difficulty === 'dificil' && criollasDebug.world.venue === 'hato');
  assert.equal(await guest.locator('#map-choice').isDisabled(), true);
  assert.equal(await guest.locator('[data-room-option="difficulty"][data-value="facil"]').isDisabled(), true);
  console.log('PASS host-chosen court and difficulty reach the guest');
  // ¿Quién empieza?: a coin both screens watch spin decides which team throws the mingo.
  // The host's clock waits while the guest draws the flip frame by frame (frames are stubbed here).
  await host.locator('#start').click(); await host.evaluate(() => { const r = criollasDebug.room; r.held = r.step; r.step = () => false; });
  await wait(guest, () => criollasDebug.room.state.phase === 'opening');
  assert.equal(await guest.evaluate(() => criollasDebug.room.state.opening.flavour), 'moneda');
  const spin = n => guest.evaluate(n => { const d = criollasDebug; for (let i = 0; i < n; i++) d.world.render(d.room.state, { dt: .05, shot: d.shot, active: false }); }, n);
  await spin(22); assert.equal(await guest.evaluate(() => criollasDebug.world.opening.active), true);
  assert.match(await guest.locator('.pk-qe-say').textContent(), /Cara: Rojos · Sello: Verdes/);
  await guest.screenshot({ path: 'art/criollas/coin-flip.png' });
  await spin(30); assert.equal(await guest.evaluate(() => criollasDebug.world.opening.revealed), true, 'the coin landed');
  const face = await guest.evaluate(() => criollasDebug.room.state.opening.coin);
  assert.equal(await guest.locator('.pk-qe-say').textContent(), face === 'cara' ? '¡Cara! Empieza Rojos' : '¡Sello! Empieza Verdes');
  await guest.screenshot({ path: 'art/criollas/coin-landed.png' });
  await host.evaluate(() => { const r = criollasDebug.room; r.step = r.held; });
  await wait(guest, () => criollasDebug.room.state.opening?.phase === 'order'); await spin(2);
  assert.match(await guest.locator('.pk-qe-order li').first().textContent(), face === 'cara' ? /Rojos/ : /Verdes/);
  await wait(guest, () => criollasDebug.room.state.phase === 'aiming');
  const opened = await guest.evaluate(() => criollasDebug.room.state);
  assert.equal(opened.turn % 2, opened.opening.order[0], 'the team the coin chose throws first');
  assert.equal(opened.starter, opened.opening.order[0]);
  console.log('PASS the coin decides which team throws the mingo');
  // From here the Rojos open, whatever the coin said.
  await host.evaluate(() => { const r = criollasDebug.room; r.game.turn = r.game.starter = 0; r.game.revision++; r.publish(); });
  await wait(guest, () => criollasDebug.room.state.turn === 0);
  await guest.evaluate(() => criollasDebug.room.action('shoot', { angle: 0, power: .5 }));
  await host.waitForTimeout(200); assert.equal(await host.evaluate(() => criollasDebug.room.state.shots), 0);
  await screenshot(host, 'desktop');
  await host.locator('#shoot').click(); await wait(guest, () => criollasDebug.room.state.phase === 'rolling');
  await wait(guest, () => criollasDebug.room.state.phase === 'aiming' && criollasDebug.room.state.turn === 1);
  // Hold Space: the meter shows while the force rises, and letting go throws at that force.
  await guest.locator('#court').focus(); await guest.keyboard.down('Space');
  // Animation frames are stubbed here: the force is sampled from the hold time at release.
  await wait(guest, () => criollasDebug.charge && performance.now() - criollasDebug.charge.started > 400 && !document.querySelector('#power-bar').hidden);
  await guest.keyboard.up('Space'); await wait(host, () => criollasDebug.room.state.shots === 2);
  assert.equal(await guest.evaluate(() => document.querySelector('#power-bar').hidden), true);
  assert.ok(await guest.evaluate(() => criollasDebug.shot.power) >= .3, 'the throw used the charged force');
  assert.equal(await host.evaluate(() => criollasDebug.room.state.pitch.balls.at(-1).owner), 1);
  await wait(host, () => criollasDebug.room.state.phase !== 'rolling');
  console.log('PASS real two-client throws, seat ownership and saved avatars');
  await guest.reload({ waitUntil: 'domcontentloaded' }); await wait(guest, () => window.criollasDebug?.room.connected && criollasDebug.room.state.hand === 1);
  assert(await guest.evaluate(() => criollasDebug.room.state.shots >= 2));
  const late = await open('Caro', `room=${code}`); await wait(late, () => criollasDebug.room.state.hand === 1 && criollasDebug.room.seat >= 0);
  assert(await late.evaluate(() => criollasDebug.room.state.pitch.balls.length >= 3));
  await late.context().close();
  // The actual room adapter must reject the seventh session.
  assert.equal(await guest.evaluate(async () => {
    const { joinRoom } = await import('/engine/net.js'), links = [], code = `cap-${Date.now()}`;
    try { for (let i = 0; i < 6; i++) links.push(await joinRoom('criollas', { code, name: 'Pana', resume: false }));
      try { links.push(await joinRoom('criollas', { code, name: 'Séptimo', resume: false })); return false; } catch (e) { return e.full === true; }
    } finally { await Promise.all(links.map(l => l.leave())); }
  }), true);
  console.log('PASS reload, late join and six-seat room capacity');
  // Force a fresh host-owned turn, then leave while the real shot is rolling.
  await host.evaluate(() => { const r = criollasDebug.room; r.game.phase = 'aiming'; r.game.turn = r.seat; r.game.remaining[r.seat] = 1; r.game.pitch.balls.forEach(b => { b.vx = b.vz = 0; }); r.game.revision++; r.publish(); });
  await host.locator('#shoot').click(); await wait(guest, () => criollasDebug.room.state.phase === 'rolling');
  const shots = await guest.evaluate(() => criollasDebug.room.state.shots);
  await host.context().close(); await wait(guest, () => criollasDebug.room.isHost);
  await wait(guest, () => criollasDebug.room.state.phase !== 'rolling');
  assert(await guest.evaluate(() => criollasDebug.room.state.shots) >= shots);
  console.log('PASS host handoff preserves an in-flight throw');
  // Known final-ball layout proves synchronized match scoring and a real rematch.
  await guest.evaluate(async () => {
    const r = criollasDebug.room, { createPitch } = await import('/engine/play/bolas-criollas.js');
    r.game.pitch = createPitch(); r.game.pitch.balls.push({ id: 1, owner: r.seat, x: .6, z: -6, vx: 0, vz: 0, radius: .25, out: false }); r.game.pitch.nextId = 2;
    r.game.scores = [11, 11]; r.game.remaining = Array(6).fill(0); r.game.remaining[r.seat] = 1; r.game.turn = r.seat; r.game.phase = 'aiming'; r.game.revision++; r.publish();
  });
  const spectator = await open('Dani', `room=${code}`); await wait(spectator, () => criollasDebug.room.state.scores[0] === 11);
  await guest.locator('#shoot').click();
  await wait(spectator, () => criollasDebug.room.state.phase === 'finished');
  assert.deepEqual(await spectator.evaluate(() => criollasDebug.room.state.scores), await guest.evaluate(() => criollasDebug.room.state.scores));
  await screenshot(guest, 'results'); await guest.locator('#next').click();
  await wait(spectator, () => criollasDebug.room.state.phase === 'aiming' && criollasDebug.room.state.hand === 1 && criollasDebug.room.state.shots === 0);
  assert.deepEqual(await guest.evaluate(() => criollasDebug.room.state.scores), [0, 0]);
  await spectator.context().close(); await guest.context().close();
  console.log('PASS shared final score and rematch');
  const mobile = await open('Móvil', '', { width: 390, height: 844 }, true);
  await screenshot(mobile, 'mobile-lobby');
  await mobile.locator('#pana-room-more').click(); await mobile.locator('[data-room-option="opener"][data-value="anfitrion"]').click(); await mobile.locator('#pana-room-done').click();
  await mobile.locator('#practice').click();
  await wait(mobile, () => criollasDebug.room.state.phase === 'aiming');
  await screenshot(mobile, 'mobile');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert(await mobile.locator('#shoot').isVisible());
  await mobile.locator('#menu').click();
  const frozen = await mobile.evaluate(() => JSON.stringify(criollasDebug.room.state)); await mobile.waitForTimeout(250);
  assert.equal(await mobile.evaluate(() => JSON.stringify(criollasDebug.room.state)), frozen);
  await mobile.locator('#pana-resume').click();
  // This client runs its real render loop, including continuous touch controls.
  const before = await mobile.evaluate(() => criollasDebug.shot.angle);
  await mobile.locator('#aim-right').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
  await mobile.waitForTimeout(450);
  await mobile.locator('#aim-right').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  assert(await mobile.evaluate(() => criollasDebug.shot.angle) > before + .015);
  await mobile.locator('#court').focus(); await mobile.keyboard.press('ArrowRight');
  assert(await mobile.evaluate(() => criollasDebug.shot.angle) > before);
  await mobile.locator('#shoot').tap(); await wait(mobile, () => criollasDebug.room.state.shots === 1);
  await mobile.setViewportSize({ width: 844, height: 390 }); await screenshot(mobile, 'mobile-landscape');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.context().close();
  console.log('PASS portrait/landscape layout, shared pause and keyboard launch');
  const solo = await open('Solo');
  await solo.locator('#pana-room-more').click(); await solo.locator('[data-room-option="opener"][data-value="anfitrion"]').click(); await solo.locator('#pana-room-done').click();
  await solo.locator('#practice').click(); await wait(solo, () => criollasDebug.room.state.phase === 'aiming' && criollasDebug.room.state.turn === 0);
  // Behind the thrower by default: the camera stands past the calce, above head height.
  await frames(solo); assert(await solo.evaluate(() => { const c = criollasDebug.world.camera.position; return c.z > 15 && c.y > 3; }));
  await solo.evaluate(() => criollasDebug.room.action('difficulty', { difficulty: 'facil' }));
  await frames(solo); assert(await solo.evaluate(() => criollasDebug.room.state.difficulty === 'facil' && criollasDebug.world.guides.preview));
  await screenshot(solo, 'facil');
  await solo.locator('#court').focus(); await solo.keyboard.press('c');
  await frames(solo); assert(await solo.evaluate(() => criollasDebug.world.view === 'arriba' && criollasDebug.world.camera.position.y > 20));
  await screenshot(solo, 'arriba');
  await solo.evaluate(() => criollasDebug.room.action('difficulty', { difficulty: 'experto' }));
  await frames(solo); assert.equal(await solo.evaluate(() => criollasDebug.world.guides.preview), false);
  await solo.locator('#shoot').click(); await wait(solo, () => criollasDebug.room.state.shots >= 2);
  await solo.context().close();
  console.log('PASS thrower and overhead cameras, local difficulty changes and the Fácil preview');
  assert.deepEqual(errors, []);
  const games = await (await fetch(`${base}/api/games`)).json(); assert(JSON.stringify(games).includes('criollas'));
} finally { await browser.close(); }
