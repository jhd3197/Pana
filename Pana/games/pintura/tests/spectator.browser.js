import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
// Out of lives in practice: a look at the bot that got you, then the follow camera
// with its square label, next / previous (keys and a controller's LB / RB), the
// overhead view, and back to first person on respawn. Watching sends nothing new:
// the same input shape goes out and nothing about it lands in the room state.
// PANA_SHOTS=<folder> also saves spectator-follow.png, spectator-overhead.png and hints-gamepad.png.
const shots = process.env.PANA_SHOTS;
const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Prueba', query: 'debug' });
  await waitFor(page, () => window.pinturaDebug?.world && pinturaDebug.room.connected && window.PANA_PREPARED);
  await page.locator('#practice').click();
  await waitFor(page, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !(pinturaDebug.room.state.countdown > 0));
  // Everything that leaves this client, by shape: the inputs and any other message.
  await page.evaluate(() => {
    const room = pinturaDebug.room, input = room.input.bind(room);
    window.spy = { shapes: { alive: new Set(), out: new Set() }, sends: [] };
    room.input = value => { const r = input(value); spy.shapes[pinturaDebug.spectate.spectator.active ? 'out' : 'alive'].add(Object.keys(room.current).sort().join(',')); return r; };
    if (room.link) { const send = room.link.send.bind(room.link); room.link.send = (type, data) => { spy.sends.push(type); return send(type, data); }; }
    document.activeElement?.blur();
  });
  // The hints and chips come in a controller's buttons, as control-hints.browser.js does it.
  await page.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'gamepad' }));
  await waitFor(page, () => document.documentElement.dataset.panaInput === 'gamepad');

  // A bot paints you out of your last life.
  const killer = await page.evaluate(() => {
    const game = pinturaDebug.room.game, me = game.players.find(p => p.id === pinturaDebug.room.id), bot = game.players.find(p => p.bot && !p.respawn && !p.eliminated);
    me.hits = (game.options.lives || 3) - 1; game.hit(me, bot, bot.color, {}, Infinity); return bot.id;
  });
  await waitFor(page, k => pinturaDebug.spectate.spectator.mode === 'killcam' && pinturaDebug.spectate.spectator.killer === k, killer);
  // The killcam turns the view toward the killer.
  const offKiller = () => page.evaluate(k => {
    const { world } = pinturaDebug, e = world.camera.matrixWorld.elements, at = world.avatars.get(k).group.position, p = world.camera.position;
    const dx = at.x - p.x, dy = at.y + 1.2 - p.y, dz = at.z - p.z, d = Math.hypot(dx, dy, dz);
    return Math.acos(Math.max(-1, Math.min(1, (-e[8] * dx - e[9] * dy - e[10] * dz) / d)));
  }, killer);
  await waitFor(page, k => pinturaDebug.spectate.spectator.mode !== 'killcam' || (() => {
    const { world } = pinturaDebug, e = world.camera.matrixWorld.elements, at = world.avatars.get(k).group.position, p = world.camera.position;
    const dx = at.x - p.x, dy = at.y + 1.2 - p.y, dz = at.z - p.z; return (-e[8] * dx - e[9] * dy - e[10] * dz) / Math.hypot(dx, dy, dz) > .97;
  })(), killer);
  assert.equal(await page.evaluate(() => pinturaDebug.spectate.spectator.mode), 'killcam', 'facing the killer before the killcam ends');
  assert.ok(await offKiller() < .25);

  // Then the follow camera, with the label and the switch keys of the controller.
  await waitFor(page, () => pinturaDebug.spectate.spectator.mode === 'watch' && document.body.classList.contains('spectating') && !document.getElementById('spectate').hidden);
  const label = () => page.evaluate(() => ({ text: document.getElementById('spectate-name').textContent, target: pinturaDebug.spectate.spectator.target, shot: pinturaDebug.spectate.spectator.shot,
    keys: [...document.querySelectorAll('#spectate [data-key]')].filter(k => k.checkVisibility()).map(k => k.textContent), hints: [...document.querySelectorAll('#spectate-hints [data-hint] b')].filter(b => b.checkVisibility()).map(b => b.textContent), banner: document.getElementById('respawn').getBoundingClientRect().top,
    radius: [...document.querySelectorAll('#spectate, #spectate .spectate-btn, #spectate-swatch, #spectate-hints')].map(n => getComputedStyle(n).borderRadius) }));
  let seen = await label();
  const name = await page.evaluate(t => pinturaDebug.room.state.players.find(p => p.id === t)?.name, seen.target);
  assert.equal(seen.shot, 'follow'); assert.ok(seen.text.includes(name), `watching ${name}: ${seen.text}`);
  assert.deepEqual(seen.keys, ['LB', 'RB', 'A'], `controller chips: ${seen.keys}`);
  assert.ok(seen.hints.includes('LB / RB') && seen.hints.includes('A'), `controller hints: ${seen.hints}`);
  assert.ok(seen.radius.every(r => r === '0px'), `square: ${seen.radius}`);
  assert.ok(seen.banner < 160, `the out banner moves up out of the view: ${seen.banner}`);
  if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: `${shots}/hints-gamepad.png` }); }
  // Behind the watched pana, settled, the crosshair gone.
  const followGap = () => page.evaluate(() => { const { world, spectate } = pinturaDebug, at = world.avatars.get(spectate.spectator.target)?.group.position, p = world.camera.position; return at ? Math.hypot(at.x - p.x, at.z - p.z) : 99; });
  await waitFor(page, () => { const { world, spectate } = pinturaDebug, at = world.avatars.get(spectate.spectator.target)?.group.position, p = world.camera.position; return !!at && Math.hypot(at.x - p.x, at.z - p.z) < 4.5 && p.y < at.y + 4; });
  assert.ok(await followGap() < 4.5);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.crosshair')).display), 'none');

  // Next and previous: E / Q on a keyboard, RB / LB from a controller (engine/gamepad.js types G and Shift).
  await page.evaluate(async () => (await import('/engine/settings.js')).setSettings({ inputHints: 'keyboard' }));
  await waitFor(page, () => [...document.querySelectorAll('#spectate [data-key]')].map(k => k.textContent).join() === 'Q,E,Espacio');
  const step = async press => {
    const before = await page.evaluate(() => ({ target: pinturaDebug.spectate.spectator.target, many: pinturaDebug.room.state.players.filter(p => p.id !== pinturaDebug.room.id && !p.respawn && !p.eliminated).length > 1 }));
    await press();
    const after = await page.evaluate(() => pinturaDebug.spectate.spectator.target);
    if (before.many) assert.notEqual(after, before.target, 'switched pana');
    return after;
  };
  const pad = code => () => page.evaluate(c => dispatchEvent(new KeyboardEvent('keydown', { key: c === 'KeyG' ? 'g' : 'Shift', code: c, bubbles: true })), code);
  const first = (await label()).target;
  await step(() => page.keyboard.press('e'));
  const back = await step(() => page.keyboard.press('q'));
  assert.ok(back === first || !(await page.evaluate(t => pinturaDebug.room.state.players.some(p => p.id === t && !p.respawn && !p.eliminated), first)), 'previous comes back');
  await step(pad('KeyG')); await step(pad('ShiftLeft'));
  await waitFor(page, () => document.getElementById('spectate-name').textContent.includes(pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.spectate.spectator.target)?.name));
  await waitFor(page, () => { const { world, spectate } = pinturaDebug, at = world.avatars.get(spectate.spectator.target)?.group.position, p = world.camera.position; return !!at && Math.hypot(at.x - p.x, at.z - p.z) < 4.5; });
  if (shots) await page.screenshot({ path: `${shots}/spectator-follow.png` });

  // Space: the whole court from above, and back.
  await page.keyboard.press(' ');
  await waitFor(page, () => pinturaDebug.spectate.spectator.shot === 'overhead' && pinturaDebug.world.camera.position.y > 25);
  seen = await label();
  assert.equal(seen.shot, 'overhead'); assert.ok(seen.text.length > 0);
  if (shots) await page.screenshot({ path: `${shots}/spectator-overhead.png` });
  await page.keyboard.press(' ');
  await waitFor(page, () => pinturaDebug.spectate.spectator.shot === 'follow' && pinturaDebug.world.camera.position.y < 8);

  // Back in the round: the first-person eyes, controls and HUD as they were.
  await page.evaluate(() => { const game = pinturaDebug.room.game, me = game.players.find(p => p.id === pinturaDebug.room.id); Object.assign(me, { eliminated: false, respawn: .2 }); });
  await waitFor(page, () => pinturaDebug.spectate.spectator.mode === 'off' && !pinturaDebug.world.spectating);
  await waitFor(page, () => { const { world, room } = pinturaDebug, me = room.state.players.find(p => p.id === room.id), p = world.camera.position; return !me.respawn && Math.hypot(p.x - me.x, p.z - me.z) < .6; });
  const after = await page.evaluate(() => ({ spectating: document.body.classList.contains('spectating'), bar: document.getElementById('spectate').hidden, crosshair: getComputedStyle(document.querySelector('.crosshair')).display,
    touch: getComputedStyle(document.getElementById('touch')).visibility, held: pinturaDebug.world.held?.visible }));
  assert.deepEqual(after, { spectating: false, bar: true, crosshair: 'block', touch: 'visible', held: true });
  // Q turns the view again instead of switching pana.
  const yaw = await page.evaluate(() => pinturaDebug.world.yaw);
  await page.keyboard.down('q'); await waitFor(page, y => Math.abs(pinturaDebug.world.yaw - y) > .05, yaw); await page.keyboard.up('q');

  const spy = await page.evaluate(() => ({ alive: [...window.spy.shapes.alive], out: [...window.spy.shapes.out], sends: window.spy.sends,
    fields: [...Object.keys(pinturaDebug.room.state), ...pinturaDebug.room.state.players.flatMap(p => Object.keys(p))].filter(k => /spectat|watch|camera|follow|overhead/i.test(k)) }));
  assert.ok(spy.out.length, 'inputs went out while watching');
  for (const shape of spy.out) assert.ok(spy.alive.includes(shape), `nothing new in the input while watching: ${shape}`);
  assert.ok(spy.sends.every(type => type === 'input'), `only inputs: ${spy.sends}`);
  assert.deepEqual(spy.fields, [], 'nothing about watching lands in the room state');
  console.log('spectator: killcam on the killer, follow with square label, next/prev on keys and pad, overhead, back to first person; nothing new sent');
} finally { await browser.close(); }
