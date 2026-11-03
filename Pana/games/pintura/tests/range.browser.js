// The armory's shooting range in a real page: Probar shows a small loading square
// (module, stylesheet, shaders), then a first-person lane with the saved kit; shots
// land on the 10 and 50 m targets with their distance, the 100 m board is past El
// Tuqueque's range (the ball falls short where the rules say), splats show, a real
// mouse click and a controller (sticks, RT, B) fire, look, walk and leave, the room
// hears nothing while it is up, the lobby's Cambiar pana never shows over it, the
// HUD pieces never overlap at four sizes, and Esc, B or Volver leave the armory
// exactly as it was with the range's WebGL context gone.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const SIZES = [[1280, 720], [1920, 1080], [1024, 600]];
// Runs in the page: the range's HUD pieces that show, any that leave the screen, any two that overlap.
function layout() {
  const read = document.getElementById('range-read'); read.hidden = false; read.querySelector('b').textContent = '100 m'; read.querySelector('span').textContent = '3 pepazos';
  const ids = ['range-back', 'range-reset', 'range-read', 'range-ammo', 'range-cross', 'range-fire', 'range-aim', 'range-reload', 'range-grenade'];
  const boxes = ids.map(id => [id, document.getElementById(id)]).filter(([, el]) => el && el.checkVisibility()).map(([id, el]) => [id, el.getBoundingClientRect()]);
  const off = boxes.filter(([, r]) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map(([id]) => id), overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, r] = boxes[i], [b, q] = boxes[j], w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (w > 2 && h > 2) overlaps.push(`${a}|${b}`);
  }
  const round = [...document.querySelectorAll('#range *')].filter(el => !el.closest('.pk-scope') && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0).length;
  return { shown: boxes.map(([id]) => id), off, overlaps, round };
}
// A standard controller the page reads through navigator.getGamepads(), driven by window.fakePad.
function fakeController() {
  const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 1, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: NAMES.map(() => ({ pressed: false, touched: false, value: 0 })) };
  // Slot 0 is a headset, as Windows often lists one first.
  const headset = { id: 'USB Audio Headset', index: 0, connected: true, mapping: '', timestamp: 0, axes: [], buttons: [{ pressed: false, value: 0 }] };
  window.fakePad = {
    press(name, on = true) { const b = pad.buttons[NAMES.indexOf(name)]; b.pressed = on; b.value = on ? 1 : 0; pad.timestamp++; },
    stick(lx, ly, rx, ry) { pad.axes = [lx, ly, rx, ry]; pad.timestamp++; },
    connect() { const e = new Event('gamepadconnected'); e.gamepad = pad; dispatchEvent(e); },
  };
  navigator.getGamepads = () => [headset, pad, null, null];
}
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const range = (page, fn, arg) => page.evaluate(fn, arg);
// Probar from the armory: the loading square shows (never for a single frame) and goes once the range drew.
async function enter(page) {
  if (!(await page.evaluate(() => document.getElementById('armory').open))) await page.locator('#open-armory').click();
  await page.evaluate(() => {
    window.rangeLoading = { shown: 0, gone: 0, frames: 0 };
    const seen = new MutationObserver(() => { const el = document.getElementById('range-loading'), t = performance.now(); if (el && !rangeLoading.shown) { rangeLoading.shown = t; const count = () => { if (document.getElementById('range-loading')) { rangeLoading.frames++; requestAnimationFrame(count); } }; requestAnimationFrame(count); } if (!el && rangeLoading.shown && !rangeLoading.gone) { rangeLoading.gone = t; seen.disconnect(); } });
    seen.observe(document.getElementById('armory'), { childList: true });
  });
  await page.locator('#armory-range').click();
  await waitFor(page, () => pinturaDebug.armory.range?.ready && pinturaDebug.armory.range.view.renderer.info.render.calls > 0 && !document.getElementById('range-loading'));
  const loading = await page.evaluate(() => ({ ...window.rangeLoading, ms: rangeLoading.gone - rangeLoading.shown }));
  assert.ok(loading.shown && loading.gone, `the loading square came and went ${JSON.stringify(loading)}`);
  assert.ok(loading.ms >= 400 && loading.frames >= 2, `never a one-frame flash ${JSON.stringify(loading)}`);
  return loading;
}
async function load(page) {
  await page.evaluate(() => localStorage.setItem('pintura:kit', JSON.stringify({ weapon: 'bullpup' })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(page, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
  // Every room message from here on; the connection's clock pings (net.js sync) are not the game's.
  await page.evaluate(() => { const link = pinturaDebug.room.link, send = link.send.bind(link); window.roomSent = []; link.send = (type, data) => { if (type !== 'ping') roomSent.push([type, pinturaDebug.armory.ranging]); return send(type, data); }; });
}
const hidden = page => page.evaluate(() => { const b = document.getElementById('pana-lobby-change'); return !b || !b.checkVisibility(); });
const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Tiro', query: 'debug', wait: false });
  await page.context().addInitScript(fakeController);
  await load(page);
  await page.locator('#open-armory').click();
  const name = await page.locator('#armory-name').textContent();
  assert.match(name, /Tuqueque/);
  assert.ok(await hidden(page), 'no Cambiar pana over the armory');
  const lobby = await page.evaluate(() => ({ phase: pinturaDebug.room.state.phase, players: pinturaDebug.room.link.state.players.map(p => [p.id, p.lobbyReady]) }));
  // Nothing of the range is fetched before Probar.
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(e => /\/range(-scene|-sim)?\.(js|css)/.test(e.name))), false, 'no hidden preload');
  await page.evaluate(() => { roomSent.length = 0; });
  const loading = await enter(page);
  assert.ok(await hidden(page), 'no Cambiar pana over the range');
  // The 10 m target and the moving one at 50 m, then the 100 m board.
  await range(page, () => pinturaDebug.armory.range.debugShoot([0, 3], 6));
  await waitFor(page, () => !pinturaDebug.armory.range.busy);
  const shot = await range(page, () => { const r = pinturaDebug.armory.range, info = r.view.renderer.info.render; return { on: r.stats.on, splats: r.view.splats, read: document.getElementById('range-read').textContent, calls: info.calls, tris: info.triangles }; });
  assert.ok(shot.on[10] > 0 && shot.on[50] > 0, `hits by target ${JSON.stringify(shot.on)}`);
  assert.ok(shot.splats >= 2, 'paint stays on the targets');
  assert.match(shot.read, /\d+ m/);
  assert.ok(shot.calls < 140, `${shot.calls} draw calls`);
  await range(page, () => pinturaDebug.armory.range.debugShoot([5], 1));
  await waitFor(page, () => !pinturaDebug.armory.range.busy && pinturaDebug.armory.range.stats.short != null);
  const short = await range(page, () => ({ at: pinturaDebug.armory.range.stats.short, on: pinturaDebug.armory.range.stats.on[100] || 0 }));
  assert.equal(short.on, 0); assert.ok(Math.abs(short.at - 61) <= 3, `fell short at ${short.at} m`);
  // T resets the targets.
  await page.keyboard.press('t');
  assert.equal(await range(page, () => pinturaDebug.armory.range.view.splats), 0);

  // A real mouse: the click that takes the pointer lock already fires; held, it keeps firing; hits land on the 10 m paper.
  await range(page, () => pinturaDebug.armory.range.aimAt(0));
  const view = await page.locator('#range-view').boundingBox();
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
  await page.mouse.down();
  await waitFor(page, () => pinturaDebug.armory.range.stats.on[10] >= 3);
  await page.mouse.up();
  const mouse = await range(page, () => { const r = pinturaDebug.armory.range; return { hits: r.stats.on[10], fired: r.sim.me.fired, splats: r.view.splats, read: document.getElementById('range-read').textContent, lock: document.pointerLockElement?.id || null }; });
  assert.ok(mouse.fired >= 3 && mouse.splats >= 3, `mouse fire ${JSON.stringify(mouse)}`);
  assert.match(mouse.read, /10 m/);
  // Leaving the pointer lock is Esc: the range closes; back in for the controller.
  if (mouse.lock) await page.evaluate(() => { document.exitPointerLock(); });
  await waitFor(page, () => !pinturaDebug.armory.ranging || !document.pointerLockElement);
  if (!(await page.evaluate(() => pinturaDebug.armory.ranging))) await enter(page);

  // A controller (behind a headset in slot 0): the right stick looks, the left stick walks, RT fires and hits, A presses nothing behind.
  await page.evaluate(() => fakePad.connect());
  const yaw = await range(page, () => pinturaDebug.armory.range.view.yaw);
  await page.evaluate(() => fakePad.stick(0, 0, .8, 0));
  await waitFor(page, y => Math.abs(pinturaDebug.armory.range.view.yaw - y) > .2, yaw);
  // Sideways and back: the firing line already stops a step ahead.
  await page.evaluate(() => fakePad.stick(-1, 1, 0, 0));
  await waitFor(page, () => pinturaDebug.armory.range.sim.stand.x < -55.5);
  await page.evaluate(() => fakePad.stick(0, 0, 0, 0));
  await range(page, () => { pinturaDebug.armory.range.view.clear(); pinturaDebug.armory.range.stats.on = {}; pinturaDebug.armory.range.aimAt(1); });
  await page.evaluate(() => fakePad.press('rt'));
  await waitFor(page, () => pinturaDebug.armory.range.stats.on[25] >= 2);
  await page.evaluate(() => fakePad.press('rt', false));
  await page.evaluate(() => fakePad.press('a')); await frames(page); await page.evaluate(() => fakePad.press('a', false)); await frames(page);
  const pad = await range(page, () => ({ ranging: pinturaDebug.armory.ranging, armory: document.getElementById('armory').open, phase: pinturaDebug.room.state.phase, read: document.getElementById('range-read').textContent }));
  assert.deepEqual({ ...pad, read: /\d+ m/.test(pad.read) }, { ranging: true, armory: true, phase: 'lobby', read: true });

  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height }); await frames(page);
    const l = await range(page, layout);
    assert.deepEqual(l.overlaps, [], `${width}×${height}`); assert.deepEqual(l.off, [], `${width}×${height}`); assert.equal(l.round, 0, 'square corners');
  }
  // Esc leaves the range, not the armory; the armory is as it was and the range's context is gone.
  await page.evaluate(() => { window.rangeRenderer = pinturaDebug.armory.range.view.renderer; });
  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.getElementById('range') && !pinturaDebug.armory.ranging);
  const after = await page.evaluate(() => ({ open: document.getElementById('armory').open, name: document.getElementById('armory-name').textContent, lost: window.rangeRenderer.getContext().isContextLost() }));
  assert.deepEqual(after, { open: true, name, lost: true });
  // Again, out through B on the controller: only the range closes.
  await enter(page);
  await page.evaluate(() => fakePad.press('b')); await waitFor(page, () => !document.getElementById('range'));
  await page.evaluate(() => fakePad.press('b', false)); await frames(page); await frames(page);
  assert.equal(await page.evaluate(() => document.getElementById('armory').open), true, 'B leaves the armory open');
  // And through Volver.
  await enter(page);
  await page.locator('#range-back').click();
  await waitFor(page, () => !document.getElementById('range'));
  assert.equal(await page.evaluate(() => document.getElementById('armory').open), true);
  // Probar inside Arma 2's sub-menu tries that gun (La Chancleta by default), then Atrás is still there.
  await page.locator('#armory-slots [data-hand="1"]').click(); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  await enter(page);
  assert.equal(await range(page, () => pinturaDebug.armory.range.sim.me.weapon), 'sandal', 'the range holds Arma 2');
  await page.locator('#range-back').click(); await waitFor(page, () => !document.getElementById('range'));
  assert.equal(await page.evaluate(() => pinturaDebug.armory.level), 'gun1', 'back in the same sub-menu');
  await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'top');
  // Solo practice: not one room message while ranging, and the room is as it was.
  // (The armory's own idle inputs between visits are the lobby's, as before.)
  const room = await page.evaluate(() => ({ ranging: roomSent.filter(([, r]) => r).map(([t]) => t), other: [...new Set(roomSent.map(([t]) => t))].filter(t => t !== 'input'), phase: pinturaDebug.room.state.phase, players: pinturaDebug.room.link.state.players.map(p => [p.id, p.lobbyReady]) }));
  assert.deepEqual(room, { ranging: [], other: [], ...lobby }, 'the range sends nothing to the room');
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // A phone held upright: the touch buttons show, nothing overlaps, Pinta fires.
  const phone = await openGame(browser, 'pintura', { name: 'Tel', query: 'debug', mobile: true, wait: false });
  await load(phone); await enter(phone); await frames(phone);
  assert.ok(await hidden(phone), 'no Cambiar pana on a phone');
  const l = await range(phone, layout);
  assert.ok(l.shown.includes('range-fire'), 'touch buttons on a phone');
  assert.deepEqual(l.overlaps, []); assert.deepEqual(l.off, []);
  const before = await range(phone, () => pinturaDebug.armory.range.sim.me.fired);
  const box = await phone.locator('#range-fire').boundingBox();
  await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await waitFor(phone, n => pinturaDebug.armory.range.sim.me.fired > n, before);
  assert.deepEqual(phone.errors, []);
  console.log('range: loading', Math.round(loading.ms), 'ms · hits', JSON.stringify(shot.on), '· short at', short.at, 'm · mouse', mouse.fired, 'shots ·', shot.calls, 'calls ·', shot.tris, 'triangles');
} finally {
  await browser.close();
}
