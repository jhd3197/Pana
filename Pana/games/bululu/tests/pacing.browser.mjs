// A whole Bululú party, played by bots in simulated time: how long it takes,
// how much of it is minigames, and that the short preset and the
// minigame-only party really are shorter and still reach the results.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser = await launch();
const runs = {};
try {
  for (const [name, patch] of [['10 rondas', {}], ['5 rondas', { rounds: 5 }], ['solo minijuegos', { mode: 'minis', rounds: 5 }]]) {
    const page = await openGame(browser, 'bululu', { query: 'debug&auto', wait: false });
    await page.waitForFunction(() => typeof window.fastForward === 'function' && typeof window.changeOptions === 'function', null, { timeout: 120_000 });
    runs[name] = await page.evaluate(async (patch) => {
      window.requestAnimationFrame = () => 0;
      if (Object.keys(patch).length) changeOptions(patch);
      let total = 0, playing = 0, firstMini = null, minis = 0, last = null;
      while (document.querySelector('#results').classList.contains('hidden') && total < 3600) {
        await fastForward(1);
        total++;
        const m = minigame();
        if (m?.state === 'run') { playing++; firstMini ??= total; if (m.game !== last) { minis++; last = m.game; } }
      }
      return { total, playing, firstMini, minis, done: !document.querySelector('#results').classList.contains('hidden'), board: players.some(p => p.tile !== 0) };
    }, patch);
    assert.deepEqual(page.errors, []);
    await page.context().close();
    console.log(name, JSON.stringify(runs[name]));
  }
  const [ten, five, minis] = Object.values(runs);
  for (const run of Object.values(runs)) assert(run.done, 'the party reaches the results screen');
  assert.equal(ten.minis, 10); assert.equal(five.minis, 5); assert.equal(minis.minis, 5);
  assert(five.total < ten.total * 0.65, `5 rounds is a short party (${five.total} s vs ${ten.total} s)`);
  assert(!minis.board, 'Solo minijuegos never moves a token');
  assert(minis.firstMini < 15, `Solo minijuegos starts playing at once (${minis.firstMini} s)`);
  assert(minis.playing / minis.total > 0.6, 'and is mostly playing');
  console.log(`PASS pacing: 10 rounds ${ten.total} s (${Math.round(ten.playing / ten.total * 100)}% playing), 5 rounds ${five.total} s, solo minijuegos ${minis.total} s`);
} finally { await browser.close(); }
