import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';
import path from 'node:path';
import os from 'node:os';
const browser = await launch();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { localStorage.setItem('pana:name', 'Ana'); if (!localStorage.getItem('pana:avatar')) localStorage.setItem('pana:avatar', JSON.stringify({ outfit: 'hawaiana', outfitColor: '#123456', hat: 'band', extra: 'cadena' })); });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/#mi-pana');
  await page.waitForURL('**/personaje');
  await page.waitForFunction(() => window.PANA_PREPARED, null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => panaEditor.state.top), 'tropical');
  await page.locator('[data-slot="hat"][data-item="casco"]').click();
  await page.locator('#save').click();
  await page.locator('#toast').filter({ hasText: 'Pana guardado' }).waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pana:avatar')));
  assert.equal(saved.wardrobe.hat, 'casco');
  await page.reload(); await page.waitForFunction(() => window.PANA_PREPARED, null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => panaEditor.state.hat), 'casco');
  await page.locator('#openload').click(); await page.locator('#codebox').fill('not-a-pana'); await page.locator('#load').click();
  assert.equal(await page.evaluate(() => panaEditor.state.hat), 'casco');
  await page.locator('#openload').click();
  await page.locator('[data-slot="hat"][data-item="boina"]').click();
  await page.locator('#undo').click(); assert.equal(await page.evaluate(() => panaEditor.state.hat), 'casco');
  await page.locator('#redo').click(); assert.equal(await page.evaluate(() => panaEditor.state.hat), 'boina');
  // Every exported accessory builds with the lighter gameplay profile as well.
  const geometry = await page.evaluate(async () => {
    const { WARDROBE } = await import('/engine/wardrobe.js');
    const { wardrobeToAvatar } = await import('/engine/avatar.js');
    const { buildCharacter } = await import('/engine/models/characters/pana/avatar-model.js');
    const results = [];
    for (const [slot, items] of Object.entries(WARDROBE)) for (const [id] of items) {
      const look = { ...panaEditor.state, extras: { ...panaEditor.state.extras } };
      if (slot === 'extras') look.extras[id] = true; else look[slot] = id;
      const model = buildCharacter(wardrobeToAvatar(look)); model.update(.016, { walk: true });
      model.group.traverseVisible(object => {
        if (object.geometry) for (const v of object.geometry.attributes.position.array) if (!Number.isFinite(v)) throw new Error(slot + ':' + id + ' has invalid geometry');
      });
      results.push(slot + ':' + id); model.dispose();
    }
    return results;
  });
  assert.ok(geometry.length > 50);
  await page.locator('[data-view="body"]').click();
  await page.screenshot({ path: path.join(os.tmpdir(), 'pana-editor-desktop.png') });
  for (const width of [950, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  await page.screenshot({ path: path.join(os.tmpdir(), 'pana-editor-mobile.png'), fullPage: true });
  // Two real Colyseus clients must receive the same extended avatar.
  const guest = await browser.newPage(); guest.on('pageerror', e => errors.push(e.message));
  await guest.goto(base + '/');
  const code = 'wardrobe-' + Date.now();
  await page.evaluate(async ({ code, saved }) => { const { joinRoom } = await import('/engine/net.js'); window.testLink = await joinRoom('domino', { code, name: 'Ana', avatar: saved, resume: false }); }, { code, saved });
  await guest.evaluate(async code => { const { joinRoom } = await import('/engine/net.js'); window.testLink = await joinRoom('domino', { code, name: 'Bruno', resume: false }); }, code);
  for (const client of [page, guest]) {
    await client.waitForFunction(() => testLink.state.players.length === 2);
    const remote = await client.evaluate(() => JSON.parse(testLink.state.players.find(p => p.name === 'Ana').avatar));
    assert.deepEqual(remote, saved);
  }
  await guest.close();
  const failed = await browser.newPage();
  await failed.route('**/character/editor.js', route => route.abort());
  await failed.goto(base + '/personaje');
  await failed.getByRole('button', { name: 'Volver a intentar' }).waitFor();
  assert.equal(await failed.locator('.panel').evaluate(n => n.inert), true);
  assert.deepEqual(errors, []);
  console.log('PASS Mi pana: migration, edits, undo/redo, save/reload, invalid codes, all accessories in games, responsive UI and two-client wardrobe sync.');
} finally { await browser.close(); }
