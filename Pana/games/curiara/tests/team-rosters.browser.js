import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  for (const game of ['curiara', 'criollas', 'pintura']) {
    const handle = game === 'curiara' ? game : `${game}Debug`, code = `teams-${game}-${Date.now()}`;
    const host = await openGame(browser, game, { name: 'Ana', room: code, query: 'debug&manual' });
    const guest = await openGame(browser, game, { name: 'Luis', room: code, query: 'debug&manual' });
    await waitFor(host, h => window[h].room.state.players.filter(p => p.id != null && !p.bot).length === 2, handle);
    await waitFor(guest, h => window[h].room.state.players.filter(p => p.id != null && !p.bot).length === 2, handle);
    const own = await guest.evaluate(h => window[h].room.id, handle);
    if (game === 'curiara') await host.locator('[data-room-option="crew"][data-value="triples"]').click();
    if (game === 'pintura') await host.locator('[data-room-option="mode"][data-value="teams"]').click();
    const roster = game === 'curiara' ? '#seats' : game === 'criollas' ? '#lobby-roster' : '#team-roster';
    await guest.locator(`${roster}:not([hidden]) [data-roster-group]`).first().waitFor();
    assert.equal(await guest.locator(`${roster} [data-roster-select]`).count(), 0, 'only the host arranges another pana');
    assert.equal(await guest.locator(`${roster} [data-roster-seat]`).count(), game === 'pintura' ? 8 : 6);
    // The guest swaps directly with the occupied host card, then joins an empty card.
    await guest.locator(`${roster} [data-roster-move="0"]`).click();
    const seatOf = ({ handle, game, id, seat }) => {
      const state = window[handle].room.state, player = state.players.find(p => p.id === id);
      return game === 'curiara' ? player?.seat?.boat * 2 + player?.seat?.pos === seat : game === 'pintura' ? player?.seat === seat : state.players.indexOf(player) === seat;
    };
    await waitFor(host, seatOf, { handle, game, id: own, seat: 0 });
    // A network acknowledgement and the acting client's rendered source must both agree.
    await guest.locator(`${roster} [data-roster-seat="0"].is-own`).waitFor();
    await guest.locator(`${roster} [data-roster-move="3"]`).click();
    await waitFor(host, seatOf, { handle, game, id: own, seat: 3 });
    await host.locator(`${roster} [data-roster-seat="3"]`).getByText('Luis', { exact: true }).waitFor();
    // The host can arrange the guest; moving to the other team restores a playable match.
    await host.locator(`${roster} [data-roster-select="3"]`).click();
    await host.locator(`${roster} [data-roster-move="2"]`).click();
    await waitFor(guest, seatOf, { handle, game, id: own, seat: 2 });
    await guest.locator(`${roster} [data-roster-seat="2"].is-own`).waitFor();
    if (game === 'curiara') {
      await host.screenshot({ path: path.join(os.tmpdir(), 'pana-curiara-team-roster-desktop.png') });
      await guest.setViewportSize({ width: 390, height: 844 });
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await guest.screenshot({ path: path.join(os.tmpdir(), 'pana-curiara-team-roster-mobile.png') });
    }
    await host.context().close();
    await waitFor(guest, h => window[h].room.isHost, handle);
    await waitFor(guest, seatOf, { handle, game, id: own, seat: 2 });
    await guest.locator('#start').click();
    await waitFor(guest, h => window[h].room.state.phase !== 'lobby', handle);
    await waitFor(guest, seatOf, { handle, game, id: own, seat: 2 });
    assert.deepEqual(host.errors, []); assert.deepEqual(guest.errors, []);
    await guest.context().close();
    console.log(`PASS ${game}: shared cards, own occupied swap, empty move, host arrange, migration and start preserve teams.`);
  }
} finally { await browser.close(); }
