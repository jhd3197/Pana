// Real room snapshots, host migration and race starts use the same bot choice.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../tests/browser-kit.js';

const browser = await launch();
const globals = { galope: 'galope', curiara: 'curiara', lancha: 'lanchaDebug', parapente: 'parapenteDebug' };
try {
  for (const [game, key] of Object.entries(globals)) {
    const room = `bot-settings-${game}-${Date.now()}`;
    const host = await openGame(browser, game, { name: 'Ana', room, query: 'debug' });
    const guest = await openGame(browser, game, { name: 'Bruno', room, query: 'debug' });
    await waitFor(host, key => window[key].room.members.size === 2, key);
    const choice = (page, value) => page.locator(`[data-room-option="bots"][data-value="${value}"]`);
    assert.equal(await choice(guest, false).isDisabled(), true, `${game}: only host edits`);
    if (game === 'lancha' || game === 'parapente') {
      await host.locator('[data-room-option="rivals"][data-value="hard"]').click();
    }
    await choice(host, false).click();
    await waitFor(guest, key => window[key].room.state.options.bots === false, key);
    if (game === 'lancha' || game === 'parapente') {
      await host.locator('[data-room-option="rivals"]').first().waitFor({ state: 'hidden' });
      await choice(host, true).click();
      await waitFor(guest, key => window[key].room.state.options.bots === true, key);
      assert.equal(await host.locator('[data-room-option="rivals"][data-value="hard"]').getAttribute('aria-pressed'), 'true');
      await choice(host, false).click();
      await waitFor(guest, key => window[key].room.state.options.bots === false, key);
    }
    await host.context().close();
    await waitFor(guest, key => window[key].room.isHost && !document.querySelector('#start').disabled, key);
    assert.equal(await choice(guest, false).getAttribute('aria-pressed'), 'true', `${game}: new host retains Solo panas`);
    await guest.locator('#start').click();
    await waitFor(guest, key => ['countdown', 'racing'].includes(window[key].room.state.phase), key);
    const racers = await guest.evaluate(({ game, key }) => {
      const s = window[key].room.state;
      if (game === 'galope') return s.players.filter(p => !p.spectator).map(p => !!p.bot);
      if (game === 'parapente') return s.pilots.map(p => !!p.bot);
      return s.boats.flatMap(b => game === 'lancha' ? [!!b.driver.bot] : b.crew.filter(p => !p.empty).map(p => !!p.bot));
    }, { game, key });
    assert.deepEqual(racers, [false], `${game}: actual start has only the remaining pana`);
    assert.deepEqual(guest.errors, []);
    await guest.context().close();
    console.log(`ok: ${game} sync, permissions, migration and Solo panas start`);
  }
  const quiz = await openGame(browser, 'qqsmp', { room: `bot-quiz-${Date.now()}`, query: 'debug' });
  await quiz.locator('#pana-room-more').click();
  await quiz.locator('[data-room-option="bots"][data-value="genios"]').click();
  await waitFor(quiz, () => qqsmpDebug.room.state.options.bots === 'genios');
  await quiz.locator('#pana-room-done').click();
  await quiz.locator('[data-room-option="mode"][data-value="panas"]').click();
  await waitFor(quiz, () => qqsmpDebug.room.state.options.mode === 'panas');
  await waitFor(quiz, () => document.querySelector('[data-room-option="bots"]').closest('fieldset').hidden);
  await quiz.locator('[data-room-option="mode"][data-value="bots"]').click();
  await quiz.locator('#pana-room-more').click();
  await quiz.locator('[data-room-option="bots"][data-value="genios"][aria-pressed="true"]').waitFor();
  await quiz.locator('#pana-room-reset').click();
  await waitFor(quiz, () => qqsmpDebug.room.state.options.mode === 'bots' && qqsmpDebug.room.state.options.bots === 'normal');
  assert.deepEqual(quiz.errors, []);
  await quiz.context().close();
  console.log('ok: quiz bot skill hides, retains its choice and resets with the room');
} finally { await browser.close(); }
