import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&auto&track=estadio' });
  await waitFor(page, () => window.garage?.car);
  await page.evaluate(async () => {
    await startRace(0);
    race.state = 'go'; race.count = 0;
    // Disable celebratory slow-mo so this measures the frame accumulator.
    race.slowMo.update(1); race.slowMo.trigger = () => {};
    // Feed a known 8 FPS delta into the real loop. Software WebGL can itself
    // stall beyond the intentional 250 ms limit; wall time is not this proof.
    const { Timer } = await import('three');
    Timer.prototype.getDelta = () => .125;
    window.slowFrameProof = [];
    const nativeFrame = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (callback.name !== 'frame') return nativeFrame(callback);
      return nativeFrame(now => {
        callback(now);
        const c = race.player;
        slowFrameProof.push({ clock: race.clock,
          x: c.x, z: c.z, height: c.car.root.position.y - c.y });
      });
    };
  });
  await waitFor(page, () => slowFrameProof.length >= 32);
  const proof = await page.evaluate(() => slowFrameProof.slice(1, 32));
  const first = proof[0], last = proof.at(-1), elapsed = (proof.length - 1) * .125;
  assert.ok(Math.abs(last.clock - first.clock - elapsed) < 1 / 60, '125 ms frames preserve elapsed simulation time');
  assert.ok(Math.hypot(last.x - first.x, last.z - first.z) > 20, 'the player keeps driving');
  assert.ok(proof.every(p => Number.isFinite(p.height) && Math.abs(p.height) < 20), 'suspension remains bounded');
  assert.deepEqual(page.errors, []);
  console.log('PASS real frame loop with injected 125 ms deltas', { elapsed, simulated: last.clock - first.clock });
} finally { await browser.close(); }
