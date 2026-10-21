// Driver-view screenshots of Derrape circuits at fractions of the lap, for
// judging a map the way a racer sees it (HUD included, 1280x720 JPEG).
// Usage (with a Pana server running):
//   PANA_TEST_URL=http://127.0.0.1:8461 node Pana/scripts/derrape-drive-shots.mjs <out-dir> <prefix> <id>[,<id>...] [fractions]
//   fractions defaults to 0.05,0.35,0.7; files are <prefix>-<id>-<fraction>.jpg.
// The player is set on the road with the game's own grid placement and the
// chase camera is reset, so the view is from behind the car, not inside scenery.
import fs from 'node:fs';
import { chromium } from 'playwright';

const [out, prefix, ids, fractions = '0.05,0.35,0.7'] = process.argv.slice(2);
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
if (!out || !prefix || !ids) {
  console.error('usage: node Pana/scripts/derrape-drive-shots.mjs <out-dir> <prefix> <id>[,<id>...] [fractions]');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('pana:name', 'Shots');
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'alta' }));
  });
  await page.goto(`${origin}/g/derrape/?debug&auto&track=estadio`);
  await page.waitForFunction(() => window.getActiveTrack && garage.car, null, { timeout: 180000 });
  for (const id of ids.split(',')) {
    for (const f of fractions.split(',').map(Number)) {
      const url = await page.evaluate(async ([id, f]) => {
        if (getActiveTrack()?.id !== id || !race.trackReady) { toGarage(); buildTrack(id); await startRace(0); }
        const T = getActiveTrack(), p = race.player;
        // placeRacer puts grid row n at LINE - 9 - 8n: solve for the wanted distance.
        const s = ((f * T.TOTAL) % T.TOTAL + T.TOTAL) % T.TOTAL;
        placeRacer(p, 0, (T.LINE - 9 - s) / 8);
        race.state = 'go'; race.camPos = null;
        for (let i = 0; i < 30; i++) updateRace(1 / 60, true);
        renderer.render(race.scene, race.camera);
        return renderer.domElement.toDataURL('image/jpeg', .85);
      }, [id, f]);
      fs.writeFileSync(`${out}/${prefix}-${id}-${f}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log(`shot ${id}`);
  }
} finally { await browser.close(); }
