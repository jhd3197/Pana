import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/api/health`);
  await page.setContent('<link rel="stylesheet" href="/engine/kit.css"><link rel="stylesheet" href="/engine/lobby-roster.css"><main id="roster" style="max-width:1000px"></main>');
  await page.evaluate(async () => {
    const { createLobbyRoster } = await import('/engine/lobby-roster.js');
    window.moves = []; window.roster = createLobbyRoster(document.querySelector('#roster'), { onMove: (from, to) => moves.push([from, to]) });
    window.groups = [
      { id: 'a', title: 'Equipo A', color: '#ff4b4b', seats: [{ key: 0, player: { id: 1, name: 'Ana' } }, { key: 2, player: { id: 3, name: 'Caro' } }, { key: 4, player: null }] },
      { id: 'b', title: 'Equipo B', color: '#2ad1b2', seats: [{ key: 1, player: { id: 2, name: 'Luis' } }, { key: 3, player: null }, { key: 5, player: null }] },
    ];
    window.options = { ownId: 2, hostId: 1, enabled: true, canArrange: false, members: [{ id: 1, assetsReady: true, lobbyReady: true }, { id: 2, assetsReady: true, lobbyReady: false }, { id: 3, assetsReady: false }] };
    roster.update(groups, options);
  });
  assert.equal(await page.locator('select').count(), 0);
  assert.equal(await page.locator('[data-roster-select]').count(), 0);
  assert.equal(await page.locator('.pk-roster-own').textContent(), 'Tu equipo');
  assert.deepEqual(await page.locator('.pk-roster-card:not(.is-empty) .pk-roster-status').allTextContents(), ['Listo', 'Cargando', 'Esperando']);
  await page.locator('[data-roster-group="a"]').getByRole('button', { name: 'Cambiarme aquí' }).click();
  await page.locator('[data-roster-move="0"]').click();
  await page.locator('[data-roster-move="3"]').focus(); await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => moves), [[1, 4], [1, 0], [1, 3]]);
  await page.evaluate(() => roster.update(groups, { ...options, ownId: 1, canArrange: true }));
  await page.locator('[data-roster-select="2"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.rosterSelect), '2');
  await page.locator('[data-roster-move="5"]').click();
  assert.deepEqual(await page.evaluate(() => moves.at(-1)), [2, 5]);
  await page.locator('[data-roster-select="2"]').click();
  await page.evaluate(() => { groups[0].seats[1].player = { id: 4, name: 'Dani' }; roster.update(structuredClone(groups), { ...options, ownId: 1, canArrange: true }); });
  assert.equal(await page.locator('.is-selected').count(), 0);
  // Use a separate authoritative object, as snapshots do, when changing the seat.
  await page.locator('[data-roster-select="2"]').click();
  await page.evaluate(() => { const next = structuredClone(groups); next[0].seats[1].player = { id: 5, name: 'Eva' }; roster.update(next, { ...options, ownId: 1, canArrange: true }); });
  assert.equal(await page.locator('.is-selected').count(), 0);
  await page.evaluate(() => roster.update(groups, { ...options, enabled: false }));
  assert.equal(await page.locator('button:enabled').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { document.querySelector('#roster').hidden = true; });
  assert.equal(await page.locator('#roster').isVisible(), false);
  await page.evaluate(() => roster.update([{ id: 'bots', title: 'Mesa', seats: [{ key: 0, player: { id: null, name: 'Coco', bot: true } }] }], { ownId: null, hostId: null }));
  assert.equal(await page.locator('.pk-roster-host,.is-own').count(), 0);
  console.log('PASS grouped roster cards, self/team/empty-seat moves, host arrangement, readiness, keyboard and mobile');
} finally { await browser.close(); }
