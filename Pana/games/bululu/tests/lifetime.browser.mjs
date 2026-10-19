// Repeated minigames must not pile up GPU resources: each one frees its scene
// (including objects it removed mid-game) when the board takes over again.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';

const ROUNDS = 6;
const browser = await launch();
try {
  for (const id of (process.env.ONLY || 'atrapa,caida,chinazo').split(',')) {
    const page = await openGame(browser, 'bululu', { query: `debug&auto&play=${id}`, wait: false });
    await page.waitForFunction(() => typeof window.fastForward === 'function', null, { timeout: 120_000 });
    const counts = await page.evaluate(async (rounds) => {
      // Game time only advances through fastForward, so every round is the same length.
      window.requestAnimationFrame = () => 0;
      const out = [];
      let last = null;
      while (out.length < rounds) {
        await fastForward(1);
        const m = minigame();
        if (m?.state === 'run' && m.game !== last) {
          last = m.game;
          await fastForward(8);   // let falling fruit, cards and stones come and go
          renderer.shadowMap.enabled = false;
          renderer.render(m.game.scene, m.game.camera);
          renderer.render(boardScene, boardCam);
          const { geometries, textures } = renderer.info.memory;
          out.push({ geometries, textures });
        }
      }
      return out;
    }, ROUNDS);
    console.log(id, counts.map(c => `${c.geometries}/${c.textures}`).join(' '));
    // after the first two rounds have warmed every cache, the counts stop growing
    const warm = counts[2], end = counts.at(-1);
    assert(end.geometries <= warm.geometries * 1.05 + 20, `${id}: geometries kept growing ${warm.geometries} → ${end.geometries}`);
    assert(end.textures <= warm.textures + 4, `${id}: textures kept growing ${warm.textures} → ${end.textures}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
  console.log(`PASS minigame lifetime: ${ROUNDS} rounds each of Atrapa, Caída and Chinazo plateau`);
} finally { await browser.close(); }
