import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
// The armory's levels: four slots (Equipo, Arma 1, Arma 2, Granadas) whose labels
// are never cut, each gun's sub-menu and its Estilo page (Acabado, Camuflaje, Llavero),
// and back one level at a time with the mouse, the keyboard and a controller
// (navigator.getGamepads stubbed), Arma 2 kept after a reload, and Q / Y swapping guns
// in a real practice round. PANA_SHOTS=<folder> also saves the
// Estilo menus (1-gun-submenu, 2-cosmetics-group, 3-camo-colors) and armory-hud-swap.png.
const shots = process.env.PANA_SHOTS;
const ORDER = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const browser = await launch();
// Labels wider or taller than their box, or cut with an ellipsis.
const cut = page => page.evaluate(() => [...document.querySelectorAll('#armory-slots button, #armory-slots button > span, #armory-slots button > b, #armory-gun button, #armory-gun button > span')]
  .filter(e => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === 'ellipsis')).map(e => e.textContent));
const level = page => page.evaluate(() => pinturaDebug.armory.level);
// The sub-menu's tiles never overlap Probar or ¡A pepear!.
async function apart(page, where) {
  const boxes = await page.evaluate(() => [...document.querySelectorAll('#armory-gun button, #armory-stats, #armory footer button')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.dataset.slot, r.left, r.top, r.right, r.bottom]; }));
  const tiles = boxes.filter(b => !['armory-stats', 'armory-range', 'armory-go'].includes(b[0])), panels = boxes.filter(b => ['armory-range', 'armory-go'].includes(b[0]));
  for (const t of tiles) for (const p of panels) assert.ok(t[3] <= p[1] || t[1] >= p[3] || t[4] <= p[2] || t[2] >= p[4], `${t[0]} overlaps ${p[0]} at ${where}`);
}
try {
  for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 600], [390, 844]]) {
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
      await apart(page, `${w}x${h} Arma ${Number(hand) + 1}`);
      // Its Estilo page: Atrás and three looks, as whole and as clear of the buttons.
      await page.locator('#armory-gun [data-slot=style]').click(); await waitFor(page, () => pinturaDebug.armory.level === 'style');
      assert.deepEqual(await cut(page), [], `${w}x${h}: no label is cut in Estilo`);
      await apart(page, `${w}x${h} Estilo`);
      await page.locator('#armory-back').click(); await waitFor(page, l => pinturaDebug.armory.level === l, `gun${hand}`);
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

  // Mouse: Arma 1's sub-menu has its weapon, its four typed slots, Estilo and Salpicadura.
  await page.locator('#open-armory').click();
  await page.locator('#armory-slots [data-hand="0"]').click();
  if (shots) await page.screenshot({ path: `${shots}/1-gun-submenu.png` });
  assert.deepEqual(await page.locator('#armory-gun button[data-slot]').evaluateAll(b => b.map(x => x.dataset.part || x.dataset.slot)), ['weapon', 'optic', 'barrel', 'hopper', 'stock', 'style', 'pattern']);
  // Estilo holds Acabado, Camuflaje and Llavero; each opens its own choices, and Atrás climbs one level at a time.
  const slots = () => page.locator('#armory-gun button[data-slot]').evaluateAll(b => b.map(x => x.dataset.part || x.dataset.slot));
  const focused = () => page.evaluate(() => document.activeElement.dataset.part || document.activeElement.dataset.slot || document.activeElement.id);
  await page.locator('#armory-gun [data-slot=style]').click(); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  assert.deepEqual(await slots(), ['finish', 'camo', 'charm']);
  assert.deepEqual(await cut(page), [], 'no label is cut in Estilo');
  if (shots) await page.screenshot({ path: `${shots}/2-cosmetics-group.png` });
  for (const [look, card] of [['finish', '.armory-card'], ['camo', '.armory-camo'], ['charm', '.armory-card']]) {
    await page.locator(`#armory-gun [data-slot=${look}]`).click(); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
    assert.equal(await page.locator('#armory-choices').getAttribute('data-category'), look);
    assert.ok(await page.locator(`#armory-choices ${card}`).count() > 1, `${look} lists its options`);
    if (shots && look === 'camo') await page.screenshot({ path: `${shots}/3-camo-colors.png` });
    await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'style');
    assert.equal(await focused(), look, 'back on the look that opened');
  }
  await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'gun0');
  assert.equal(await focused(), 'style', 'back on Estilo');
  // The keyboard: the arrows walk the tiles, Enter drills in, Backspace and Esc climb back.
  await page.keyboard.press('ArrowLeft'); assert.equal(await focused(), 'stock');
  await page.keyboard.press('ArrowRight'); assert.equal(await focused(), 'style');
  await page.keyboard.press('Enter'); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  assert.equal(await focused(), 'finish', 'Estilo takes the focus');
  await page.keyboard.press('ArrowRight'); assert.equal(await focused(), 'camo');
  await page.keyboard.press('Enter'); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  await page.keyboard.press('Backspace'); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  assert.equal(await focused(), 'camo');
  await page.keyboard.press('Enter'); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  await page.keyboard.press('Escape'); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  await page.keyboard.press('Backspace'); await waitFor(page, () => pinturaDebug.armory.level === 'gun0');
  assert.equal(await focused(), 'style');
  await page.keyboard.press('Escape'); await waitFor(page, () => pinturaDebug.armory.level === 'top' && document.getElementById('armory').open);
  // Arma 2 lists only sidearms; La Chispa goes in and survives a reload.
  await page.locator('#armory-slots [data-hand="1"]').click();
  await page.locator('#armory-gun [data-slot=weapon]').click(); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  assert.deepEqual(await page.locator('#armory-classes [role=tab]').evaluateAll(t => t.map(x => x.dataset.class)), ['pistolas', 'melee']);
  await page.locator('#armory-classes [data-class=pistolas]').click();
  await page.locator('#armory-choices .armory-card[data-id=pistol]').click();
  await waitFor(page, () => JSON.parse(localStorage.getItem('pintura:kit')).weapon2 === 'pistol');
  await page.locator('#armory-back').click(); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  assert.deepEqual(await page.locator('#armory-gun button[data-slot]').evaluateAll(b => b.map(x => x.dataset.part || x.dataset.slot)), ['weapon', 'optic', 'barrel', 'hopper', 'stock', 'style', 'pattern'], 'La Chispa has its own four slots');
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
  // Estilo on a controller: A opens it and the camo grid, B climbs back one level each time.
  await page.locator('#armory-gun [data-slot=style]').focus(); await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  await press('right'); assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'camo');
  await press('a'); await waitFor(page, () => pinturaDebug.armory.level === 'choices');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'style');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'camo');
  await press('b'); await waitFor(page, () => pinturaDebug.armory.level === 'gun1');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'style');
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

  // Why a locked camo is locked: public Pana points to pana.sh; a hosted page whose
  // gateway has no camos() yet (its stats script still sets window.PanaSh) must not.
  const lockedText = async hosted => {
    const tab = await openGame(browser, 'pintura', { name: 'Prueba', query: 'debug', wait: false });
    if (hosted) { await tab.context().addInitScript(() => { window.PanaSh = { stats() {} }; }); await tab.reload({ waitUntil: 'domcontentloaded' }); }
    await waitFor(tab, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
    await tab.locator('#open-armory').click();
    await tab.locator('#armory-slots [data-hand="0"]').click();
    await tab.locator('#armory-gun [data-slot=style]').click(); await waitFor(tab, () => pinturaDebug.armory.level === 'style');
    await tab.locator('#armory-gun [data-slot=camo]').click();
    await tab.locator('#armory-choices .armory-camo[data-id=caribe]').waitFor();
    await waitFor(tab, () => pinturaDebug.armory.camos);
    const texts = await tab.locator('#armory-choices').evaluate(list => ['caribe', 'selva'].map(id => list.querySelector(`.armory-camo[data-id=${id}] .armory-choice`).title));
    assert.deepEqual(tab.errors, []);
    await tab.context().close();
    return texts;
  };
  assert.deepEqual(await lockedText(false), ['Disponible en pana.sh', 'Disponible en pana.sh']);
  assert.deepEqual(await lockedText(true), ['Muy pronto', 'Muy pronto']);
  console.log('PASS locked camos say where they are got, and never send pana.sh to itself');
} finally {
  await browser.close();
}
