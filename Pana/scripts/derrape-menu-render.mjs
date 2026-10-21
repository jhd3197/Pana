// Renders a Derrape circuit's menu picture from its real scene (1200x800 PNG).
// Usage (with a Pana server running):
//   PANA_TEST_URL=http://127.0.0.1:8461 node Pana/scripts/derrape-menu-render.mjs <out-dir> <id>[:yaw:pitch:dist] ...
//   yaw/pitch are radians around the map centre (defaults .6 and .75); dist
//   scales the orbit radius (default 1, smaller is closer). Racers are hidden.
// The menu wants <id>.webp (1200x800) and <id>-thumb.webp (480x320) in
// games/derrape/public/images/menu plus a sources.json entry; convert the PNG
// with any webp encoder (for example Pillow: Image.save(..., quality=80)).
import fs from 'node:fs';
import { chromium } from 'playwright';

const [out, ...specs] = process.argv.slice(2);
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
if (!out || !specs.length) {
  console.error('usage: node Pana/scripts/derrape-menu-render.mjs <out-dir> <id>[:yaw:pitch:dist] ...');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('pana:name', 'Render');
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'alta' }));
  });
  await page.goto(`${origin}/g/derrape/?debug&auto&track=estadio`);
  await page.waitForFunction(() => window.getActiveTrack && garage.car, null, { timeout: 180000 });
  for (const spec of specs) {
    const [id, yaw = '0.6', pitch = '0.75', dist = '1'] = spec.split(':');
    const url = await page.evaluate(async ([id, yaw, pitch, dist]) => {
      toGarage(); buildTrack(id); await startRace(0);
      const T = getActiveTrack(), cam = race.camera, sun = race.sun;
      for (let i = 0; i < 20; i++) updateRace(1 / 60, false);
      for (const c of race.cars) if (c.root) c.root.visible = false;
      const r = Math.max(T.bounds.x, T.bounds.z) * 1.35 * dist;
      cam.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
      cam.lookAt(0, 0, 0); cam.far = 6000; cam.aspect = 1.5; cam.updateProjectionMatrix();
      // One shadow frustum over the whole map, not the racer's local box.
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, far: r * 4 });
      sun.target.position.set(0, 0, 0); sun.position.set(-r * .6, r * 1.2, r * .5);
      sun.shadow.camera.updateProjectionMatrix();
      renderer.setPixelRatio(1); renderer.setSize(1200, 800);
      for (const o of T.animated) o.userData.tick(30, 1 / 60);
      race.sky.update(30, T.def.palette?.daylight ?? 1);
      renderer.render(race.scene, cam);
      return renderer.domElement.toDataURL('image/png');
    }, [id, +yaw, +pitch, +dist]);
    fs.writeFileSync(`${out}/${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`rendered ${out}/${id}.png`);
  }
} finally { await browser.close(); }
