// Check the pips on the face the camera actually sees, plus repeated online rolls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true });
const errors = [];
const wait = (page, fn) => page.waitForFunction(fn, null, { timeout: 120000, polling: 50 });

async function open(query = '') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.addInitScript(() => {
    localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false }));
    // Advance the local board explicitly; real online snapshots use their own clock.
    window.requestAnimationFrame = () => 0;
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/g/bululu/?debug&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(page, () => window.dice?.length === 2);
  await page.evaluate(() => {
    window.readDiePips = (material) => {
      const ctx = material.map.image.getContext('2d');
      return [[32, 32], [96, 32], [32, 64], [64, 64], [96, 64], [32, 96], [96, 96]]
        .filter(([x, y]) => {
          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
          return (r < 80 && g < 80 && b < 80) || (r > 120 && g < 100 && b < 100);
        }).length;
    };
  });
  return page;
}

try {
  const local = await open();
  const faces = await local.evaluate(async () => {
    const THREE = await import('three');
    const results = [];
    for (let n = 1; n <= 6; n++) {
      dice.forEach((die, i) => {
        die.mesh.visible = true;
        die.mesh.position.copy(players[0].token.rest).add(new THREE.Vector3(i ? 0.95 : -0.95, 4.8, 0));
        die.mesh.rotation.set(n * 0.7, n * 1.3, n * 0.4);
        die.rolling = false;
        die.show(i ? 7 - n : n);
      });
      await fastForward(2);
      results.push(dice.map(die => {
        die.mesh.updateMatrixWorld(true);
        const direction = die.mesh.position.clone().sub(boardCam.position).normalize();
        const [hit] = new THREE.Raycaster(boardCam.position, direction).intersectObject(die.mesh);
        return readDiePips(die.mesh.material[hit.face.materialIndex]);
      }));
    }
    return results;
  });
  assert.deepEqual(faces, [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]], 'both visible faces match every rolled value');
  console.log('PASS both dice face the camera with the correct pips for all six values');
  await local.context().close();

  const room = `dice-${Date.now()}`;
  const host = await open(`room=${room}`);
  await wait(host, () => onlineState().room?.isHost);
  const guest = await open(`room=${room}`);
  await wait(guest, () => players.filter(p => p.human).length === 2);
  for (let roll = 0; roll < 2; roll++) {
    await host.evaluate(() => dice.forEach(d => { d.mesh.visible = true; d.rolling = true; }));
    await wait(guest, () => dice.every(d => d.rolling));
    // A spin can show any temporary face, even when the next result repeats.
    await guest.evaluate(() => dice.forEach(d => d.show(6)));
    await host.evaluate(() => dice.forEach((d, i) => {
      d.value = i ? 5 : 2;
      d.show(d.value);
      d.rolling = false;
    }));
    await wait(guest, () => dice.every(d => !d.rolling));
    assert.deepEqual(await guest.evaluate(() => dice.map(d => readDiePips(d.mesh.material[4]))), [2, 5], `guest sees the host's result on roll ${roll + 1}`);
  }
  console.log('PASS a second real client displays repeated results after spinning');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
