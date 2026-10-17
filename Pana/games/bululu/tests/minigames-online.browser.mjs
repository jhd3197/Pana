// Every minigame must reproduce the host's state from separate seat inputs,
// regardless of local player, sound settings or unrelated random rendering.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/api/health`);
  await page.setContent(`<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>`);
  for (const id of ['atrapa', 'caigas', 'caida', 'momia', 'coleo', 'choque', 'embuste', 'remada', 'raudal', 'remolino', 'chinazo']) {
    const result = await page.evaluate(async id => {
      const { default: def } = await import(`/g/bululu/minigames/${id}.js`);
      const { seeded, withRandom } = await import('/g/bululu/online-rules.js');
      const { normalizeAvatar } = await import('/engine/avatar.js');
      const players = ['#ff4b4b', '#3d7bf2', '#ffc629', '#2ad1b2'].map((color, i) => ({ i, color, name: `Pana ${i}`, human: i < 2, avatar: normalizeAvatar({}) }));
      const rngs = [seeded(672), seeded(672)];
      const games = rngs.map((r, i) => withRandom(r, () => def.create({ players, auto: false, aspect: 16 / 9, localIndex: i })));
      function signature(g) {
        return JSON.stringify({ scores: g.scores(), stats: g.stats?.(), over: g.over?.(),
          actors: g.actors?.map(a => Object.fromEntries(['x', 'y', 'z', 's', 'score', 'out', 'work', 'vote', 'votes'].map(k => [k, a[k]]))) });
      }
      let mismatch = null;
      for (let frame = 0; frame < Math.ceil(def.time * 20); frame++) {
        const inputs = players.map((_, i) => ({ x: i === 0 ? Math.sin(frame / 8) : -Math.cos(frame / 11), z: i % 2 ? 1 : -1,
          jump: frame % (i ? 9 : 7) === 0, aim: { x: i ? 0.45 : -0.45, y: Math.sin(frame / 12) * 0.5 }, pull: frame % 12 < 5, fire: frame % 12 === 5 }));
        withRandom(rngs[0], () => games[0].update(0.05, inputs));
        Math.random(); Math.random();
        withRandom(rngs[1], () => games[1].update(0.05, inputs));
        if (signature(games[0]) !== signature(games[1])) { mismatch = { frame, host: signature(games[0]), guest: signature(games[1]) }; break; }
        if (games[0].over?.()) break;
      }
      const scores = games[0].scores();
      const geometry = new Set(), materials = new Set();
      for (const game of games) game.scene.traverse(o => { if (o.geometry) geometry.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) materials.add(m); });
      for (const g of geometry) g.dispose();
      for (const m of materials) m.dispose();
      return { mismatch, scores };
    }, id);
    assert.equal(result.mismatch, null, `${id}: ${JSON.stringify(result.mismatch)}`);
    console.log(`PASS ${id}: separate local players replay identical states (${result.scores})`);
  }
} finally { await browser.close(); }
