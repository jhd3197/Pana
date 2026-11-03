import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
// The armory's two levels: four slots (Equipo, Arma 1, Arma 2, Granadas) whose labels
// are never cut, each gun's sub-menu and back with the mouse and with a controller
// (navigator.getGamepads stubbed), Arma 2 kept after a reload, and Q / Y swapping guns
// in a real practice round. PANA_SHOTS=<folder> also saves armory-hud-swap.png.
const shots = process.env.PANA_SHOTS;
const ORDER = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const browser = await launch();
// Labels wider or taller than their box, or cut with an ellipsis.
const cut = page => page.evaluate(() => [...document.querySelectorAll('#armory-slots button, #armory-slots button > span, #armory-slots button > b, #armory-gun button, #armory-gun button > span')]
  .filter(e => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === 'ellipsis')).map(e => e.textContent));
const level = page => page.evaluate(() => pinturaDebug.armory.level);
try {
  for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 600]]) {
    const page = await openGame(browser, 'pintura', { name: 'Prueba', query: 'debug', wait: false });
    await page.setViewportSize({ width: w, height: h });
    await waitFor(page, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
    await page.locator('#open-armory').click();
    assert.equal(await page.locator('#armory-slots button:visible').count(), 4, 'four slots on top');
    assert.deepEqual(await page.locator('#armory-slots button > span').allTextContents(), ['Equipo', 'Arma 1', 'Arma 2', 'Granadas']);
    assert.deepEqual(await cut(page), [], `${w}x${h}: no label is cut on top`);
    for (const hand of ['0', '1']) {
      await page.locator(`#armory-slots [data-hand="${hand}"]`).click(); await waitFor(page, l => pinturaDebug.armory.level === l, `gun${hand}`);
      assert.deepEqual(await cut(page), [], `${w}x${h}: no label is cut in Arma ${Number(hand) + 1}`);
      const boxes = await page.evaluate(() => [...document.querySelectorAll('#armory-gun button, #armory-stats, #armory footer button')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.dataset.slot, r.left, r.top, r.right, r.bottom]; }));
      const tiles = boxes.filter(b => !['armory-stats', 'armory-range', 'armory-go'].includes(b[0])), panels = boxes.filter(b => ['armory-range', 'armory-go'].includes(b[0]));
      for (const t of tiles) for (const p of panels) assert.ok(t[3] <= p[1] || t[1] >= p[3] || t[4] <= p[2] || t[2] >= p[4], `${t[0]} overlaps ${p[0]} at ${w}x${h}`);
      await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'top');
    }
    await page.context().close();
  }

  const page = await openGame(browser, 'pintura', { name: 'Prueba', query: 'debug', wait: false });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => localStorage.setItem('pintura:kit', JSON.stringify({ weapon: 'carbine', attachments: ['barrel'], armor: 'wind' })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(page, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
  assert.deepEqual(await page.evaluate(() => [pinturaDebug.armory.kit.weapon2, pinturaDebug.armory.kit.armor, pinturaDebug.armory.kit.slots.barrel]), ['sandal', 'rapido', 'barrel'], 'an old save loads into the new shape');

  // Mouse: Arma 1's sub-menu has its weapon, its four typed slots and the four looks.
  await page.locator('#open-armory').click();
  await page.locator('#armory-slots [data-hand="0"]').click();
  assert.deepEqual(await page.locator('#armory-gun button[data-slot]').evaluateAll(b => b.map(x => x.dataset.part || x.dataset.slot)), ['weapon', 'optic', 'barrel', 'hopper', 'stock', 'finish', 'camo', 'charm', 'pattern']);
  // Arma 2 lists only sidearms; La Chispa goes in and survives a reload.
  await page.locator('#armory-back').click();
  await page.locator('#armory-slots [data-hand="1"]').click();
  await page.locator('#armory-gun [data-slot=weapon]').click(); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  assert.deepEqual(await page.locator('#armory-classes [role=tab]').evaluateAll(t => t.map(x => x.dataset.class)), ['pistolas', 'melee']);
  await page.locator('#armory-classes [data-class=pistolas]').click();
  await page.locator('#armory-choices .armory-card[data-id=pistol]').click();
  await waitFor(page, () => JSON.parse(localStorage.getItem('pintura:kit')).weapon2 === 'pistol');
  await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  assert.deepEqual(await page.locator('#armory-gun button[data-slot]').evaluateAll(b => b.map(x => x.dataset.part || x.dataset.slot)), ['weapon', 'optic', 'barrel', 'hopper', 'stock', 'finish', 'camo', 'charm', 'pattern'], 'La Chispa has its own four slots');
  await page.keyboard.press('Escape'); await waitFor(page, () => pinturaDebug.armory.level === 'top' && document.getElementById('armory').open);
  await page.keyboard.press('Escape'); await waitFor(page, () => !document.getElementById('armory').open);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(page, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
  assert.equal(await page.evaluate(() => pinturaDebug.armory.kit.weapon2), 'pistol', 'Arma 2 is kept after a reload');
  await page.locator('#open-armory').click();
  assert.equal(await page.locator('#armory-slots [data-hand="1"] b').textContent(), 'La Chispa');

  // A controller: A drills in, the d-pad moves, B steps back a level, then closes.
  await page.evaluate(order => {
    window.__pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: order.map(() => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad]; dispatchEvent(new Event('gamepadconnected'));
  }, ORDER);
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const set = async (name, on) => { await page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [ORDER.indexOf(name), on]); await frames(); };
  const press = async name => { await set(name, true); await set(name, false); };
  await page.locator('#armory-slots [data-hand="0"]').focus(); await frames();
  await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'gun0');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'weapon', 'the sub-menu takes the focus');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'top');
  assert.equal(await page.evaluate(() => document.getElementById('armory').open), true, 'B steps back without closing');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.hand), '0', 'back on Arma 1');
  await press('right'); assert.equal(await page.evaluate(() => document.activeElement.dataset.hand), '1', 'the d-pad moves to Arma 2');
  await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  // The weapon list: RB / LB walk the class tabs and keep the focus on them.
  const tab = () => page.evaluate(() => document.querySelector('#armory-classes [aria-selected=true]')?.dataset.class);
  await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'choices'); assert.equal(await tab(), 'pistolas');
  await press('rb'); assert.equal(await tab(), 'melee'); assert.equal(await page.evaluate(() => document.activeElement.dataset.class), 'melee');
  await press('lb'); assert.equal(await tab(), 'pistolas');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'weapon');
  await press('right'); assert.equal(await page.evaluate(() => document.activeElement.dataset.part), 'optic');
  await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.part), 'optic', 'back on the slot that opened');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'top');
  await press('b'); await waitFor(page, () => !document.getElementById('armory').open);
  await page.evaluate(() => { navigator.getGamepads = () => []; });

  // A real round: Q, 1 / 2 and a pad's Y swap the guns; the room holds each its own pepas.
  await page.locator('#practice').click();
  await waitFor(page, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !(pinturaDebug.room.state.countdown > 0), null, 120_000);
  const mine = 'pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id)';
  await page.evaluate(() => document.activeElement?.blur());
  await waitFor(page, `${mine}.hand === 0 && ${mine}.weapon === 'carbine'`);
  await page.keyboard.press('q');
  await waitFor(page, `${mine}.hand === 1 && ${mine}.weapon === 'pistol'`);
  await waitFor(page, () => document.querySelector('#wpn-now img') && document.querySelector('#wpn-other img'));
  if (shots) await page.screenshot({ path: `${shots}/armory-hud-swap.png` });
  await page.keyboard.press('1'); await waitFor(page, `${mine}.hand === 0 && ${mine}.weapon === 'carbine'`);
  await page.keyboard.press('2'); await waitFor(page, `${mine}.hand === 1`);
  await page.evaluate(order => { window.__pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: order.map(() => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [window.__pad]; dispatchEvent(new Event('gamepadconnected')); }, ORDER);
  await press('y'); await waitFor(page, `${mine}.hand === 0`);
  assert.deepEqual(page.errors, []);
  console.log('PASS armory menu levels, controller, Arma 2 kept, swap in a round');
  await page.context().close();
} finally {
  await browser.close();
}
