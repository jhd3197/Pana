// Four real two-client rooms prove the common settings UI reaches each authority.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { inspect } from 'node:util';
const browser = await launch();
const configs = [
  ['escondidas', 'hunt', { rounds: 6, disguises: 'barrels', seekers: 2, hideSeconds: 45, hints: 'whistle', moveDisguised: false, seekerMap: true, huntSeconds: 240 }],
  ['cocina', 'cocina', { kitchen: 'playa', duration: 300, difficulty: 'chaos', orders: 'arepa', impatient: false, fire: 'fast', tips: false, switchKitchen: true, helpers: false }],
  ['pintura', 'pinturaDebug', { mode: 'teams', duration: 300, lives: 1, paint: 'sticky', weapons: 'pistol', friendlyFire: true, fastReload: true, flag: true }],
  ['reliquia', 'reliquia', { temple: 'tepuy', difficulty: 'hard', lightAllocation: 'each', mummies: 3, traps: 'many', revive: false, map: false, hints: false, lanterns: false }],
];
try {
  for (const [game, debug, values] of configs) {
    const code = `opts-${game}-${Date.now()}`, host = await openGame(browser, game, { room: code, name: 'Ana', query: 'debug' });
    const guest = await openGame(browser, game, { room: code, name: 'Luis', mobile: true, query: 'debug' });
    await waitFor(host, key => window[key]?.room.isHost && window[key].room.state.players.length === 2, debug);
    await waitFor(guest, key => window[key]?.room.state.players.length === 2, debug);
    const fields = await host.evaluate(async game => (await import(`/g/${game}/options.js`)).FIELDS, game);
    const defaults = Object.fromEntries(fields.map(f => [f.id, f.default]));
    if (['escondidas', 'pintura'].includes(game)) await host.locator('#map-choice').selectOption('puerto');
    for (const advanced of [false, true]) {
      if (advanced) await host.locator('#pana-room-more').click();
      for (const f of fields.filter(f => !!f.advanced === advanced)) await host.locator(`[data-room-option="${f.id}"][data-value="${values[f.id]}"]`).click();
    }
    if (game === 'escondidas') await host.locator('#role-seek').click();
    if (game === 'pintura') await host.locator('[data-difficulty="experto"]').click();
    await waitFor(guest, ({ key, values }) => Object.entries(values).every(([k, v]) => window[key].room.state.options[k] === v), { key: debug, values });
    await waitFor(host, ({ key, values }) => Object.entries(values).every(([k, v]) => window[key].room.state.options[k] === v), { key: debug, values });
    assert.deepEqual(await host.evaluate(key => window[key].room.state.options, debug), values);
    await guest.locator('#pana-room-more').click(); assert.equal(await guest.locator('#pana-room-reset').isDisabled(), true);
    assert.equal(await guest.locator('#pana-room-dialog [data-room-option]').first().isDisabled(), true);
    assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await guest.locator('#pana-room-dialog').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await host.screenshot({ path: path.join(tmpdir(), `pana-${game}-options-desktop.png`) });
    await guest.screenshot({ path: path.join(tmpdir(), `pana-${game}-options-mobile.png`) });
    await guest.evaluate(({ key, game }) => { const r = window[key].room; if (game === 'pintura') r.link.send('configure', { options: { duration: 180 } }); else r.action('configure', { options: { [game === 'escondidas' ? 'rounds' : game === 'cocina' ? 'duration' : 'mummies']: 1 } }); }, { key: debug, game });
    await host.locator('#pana-room-reset').click();
    await waitFor(guest, ({ key, values }) => Object.entries(values).every(([k, v]) => window[key].room.state.options[k] === v), { key: debug, values: defaults });
    if (['escondidas', 'pintura'].includes(game)) await waitFor(guest, key => window[key].room.state.mapId === 'plaza', debug);
    if (game === 'escondidas') assert.equal(await host.locator('#role-hide').getAttribute('aria-pressed'), 'true');
    if (game === 'pintura') await waitFor(guest, () => pinturaDebug.room.state.difficulty === 'normal');
    await host.locator('#pana-room-done').click(); await guest.locator('#pana-room-done').click();
    await host.evaluate(({ key, game, values }) => { const r = window[key].room; if (game === 'pintura') r.configure(values); else r.action('configure', { options: values }); }, { key: debug, game, values });
    await waitFor(guest, ({ key, values }) => Object.entries(values).every(([k, v]) => window[key].room.state.options[k] === v), { key: debug, values });
    // A departing host must not reset lobby choices.
    await host.evaluate(key => window[key].room.dispose(), debug); await host.context().close();
    await waitFor(guest, key => window[key].room.isHost, debug);
    assert.deepEqual(await guest.evaluate(key => window[key].room.state.options, debug), values);
    await guest.locator('#start').click();
    await waitFor(guest, key => ['playing', 'hide'].includes(window[key].room.state.phase), debug);
    assert.deepEqual(await guest.evaluate(key => window[key].room.state.options, debug), values);
    if (game === 'escondidas') assert.equal(await guest.evaluate(() => hunt.state.seekers.length), 2);
    if (game === 'cocina') assert.ok(await guest.evaluate(() => cocina.state.kitchen === 'playa' && cocina.state.orders.every(o => o.recipe === 'arepa') && cocina.state.remaining > 290));
    if (game === 'pintura') await waitFor(guest, () => pinturaDebug.world.scene.getObjectByName('Bandera 0')?.visible && pinturaDebug.room.state.flags.length === 2);
    if (game === 'reliquia') { await waitFor(guest, () => reliquia.world.group.getObjectByName('Losas trampa')?.children.length === 9); assert.equal(await guest.locator('#minimap').isVisible(), false); assert.equal(await guest.locator('#mission-steps').isVisible(), false); }
    await guest.screenshot({ path: path.join(tmpdir(), `pana-${game}-options-playing-mobile.png`) });
    assert.deepEqual(host.errors, []); assert.deepEqual(guest.errors, []);
    await guest.context().close(); console.log(`ok: ${game} options sync, reset, read-only guests, mobile modal and host migration`);
  }
} catch (error) { await writeFile(path.join(tmpdir(), 'pana-action-options-failure.txt'), inspect(error, { depth: 6 })); throw error; }
finally { await browser.close(); }
