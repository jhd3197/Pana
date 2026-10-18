// Real peers prove that shuffled props and lobby settings share one authority.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', out = 'art/escondidas-rounds';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [], code = `shuffle-${Date.now().toString(36)}`;
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
async function open(mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 760 }, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(() => { localStorage.setItem('pana:name', 'Pana'); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/g/escondidas/?room=${code}&debug`, { waitUntil: 'domcontentloaded' });
  await wait(page, () => window.hunt?.room.connected);
  return page;
}
async function layout(page) {
  return page.evaluate(async () => {
    const { huntLayout } = await import('/g/escondidas/layout.js'), s = hunt.state;
    const data = huntLayout(s.mapId, s.layoutSeed);
    if (JSON.stringify(data.props) !== JSON.stringify(hunt.environment.props.userData.placements)) throw new Error('Rendered props disagree with collision');
    if (hunt.scene.userData.layoutSeed !== s.layoutSeed) throw new Error('Wrong rendered seed');
    return { mapId: s.mapId, seed: s.layoutSeed, hideSeconds: s.hideSeconds, props: data.props };
  });
}
async function chooseHide(page, seconds) { await page.locator('#pana-room-more').click(); await page.locator(`[data-room-option="hideSeconds"][data-value="${seconds}"]`).click(); await page.locator('#pana-room-done').click(); }
async function leave(page) { await page.evaluate(() => hunt.room.dispose()); await page.context().close(); }
try {
  const host = await open(), guest = await open(true);
  await wait(host, () => hunt.room.isHost && hunt.room.members.size === 2);
  assert.equal(await host.locator('[data-room-option="hideSeconds"][data-value="30"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await host.locator('[data-room-option="hideSeconds"]').evaluateAll(options => options.map(o => Number(o.dataset.value))), [15, 20, 30, 45, 60]);
  assert.equal(await guest.locator('[data-room-option="hideSeconds"]').first().isDisabled(), true);
  await chooseHide(host, 45);
  await wait(guest, () => hunt.state.hideSeconds === 45 && document.querySelector('#hide-seconds-stat').textContent === '45s');
  await guest.evaluate(() => hunt.room.action('configure', { options: { hideSeconds: 15 } }));
  await host.evaluate(() => hunt.room.action('configure', { options: { hideSeconds: -10 } }));
  await host.waitForTimeout(500);
  assert.equal((await layout(host)).hideSeconds, 45);
  for (const mapId of ['puerto', 'hato', 'ruinas', 'plaza']) {
    await host.selectOption('#map-choice', mapId);
    await wait(guest, id => hunt.state.mapId === id && hunt.scene.userData.mapId === id, mapId);
    assert.deepEqual(await layout(host), await layout(guest));
  }
  await host.screenshot({ path: `${out}/laptop-lobby.png` });
  const lobby = await layout(host);
  await host.locator('#pana-room-more').click(); await host.locator('#role-seek').click(); await host.locator('#pana-room-done').click(); await host.locator('#start').click();
  await wait(guest, () => hunt.state.phase === 'hide');
  const first = await layout(host);
  assert.notEqual(first.seed, lobby.seed); assert.notDeepEqual(first.props, lobby.props);
  assert.deepEqual(first, await layout(guest));
  assert.equal(await host.evaluate(() => hunt.state.events.at(-1).text.includes('45 segundos')), true);
  const position = await host.evaluate(() => { const p = hunt.state.players.find(p => p.id === hunt.room.id); return [p.x, p.z]; });
  await host.keyboard.down('d'); await host.waitForTimeout(500); await host.keyboard.up('d');
  assert.deepEqual(await host.evaluate(() => { const p = hunt.state.players.find(p => p.id === hunt.room.id); return [p.x, p.z]; }), position);
  await host.evaluate(() => hunt.room.action('configure', { options: { hideSeconds: 60 } }));
  assert.equal((await layout(host)).hideSeconds, 45);
  await host.evaluate(() => { hunt.room.game.finish('hiders', 'Fin de prueba'); hunt.room.tick(0, {}); });
  await host.locator('#next').click(); await wait(guest, () => hunt.state.round === 2);
  const second = await layout(host);
  assert.notEqual(second.seed, first.seed); assert.notDeepEqual(second.props, first.props);
  assert.deepEqual(second, await layout(guest));
  const late = await open();
  await wait(late, () => hunt.state.players.find(p => p.id === hunt.room.id)?.spectator);
  assert.deepEqual(second, await layout(late));
  console.log('ok: all four maps agree across real peers; new rounds shuffle; host-only time and seeker freeze');
  await leave(host);
  await wait(guest, () => hunt.room.isHost && hunt.state.phase === 'lobby');
  await wait(late, () => hunt.state.phase === 'lobby');
  assert.deepEqual(second, await layout(guest)); assert.deepEqual(second, await layout(late));
  assert.equal(await guest.locator('[data-room-option="hideSeconds"]').first().isEnabled(), true);
  await chooseHide(guest, 60); await guest.selectOption('#map-choice', 'hato');
  await wait(late, () => hunt.state.hideSeconds === 60 && hunt.state.mapId === 'hato');
  await guest.locator('#pana-room-more').scrollIntoViewIfNeeded();
  assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await guest.screenshot({ path: `${out}/phone-settings.png` });
  await guest.locator('#pana-room-more').tap(); await guest.locator('#role-seek').tap(); await guest.locator('#pana-room-done').tap(); await guest.locator('#start').tap();
  await wait(late, () => hunt.state.phase === 'hide');
  assert.deepEqual(await layout(guest), await layout(late));
  assert.equal(await guest.evaluate(() => hunt.state.remaining > 55 && hunt.state.remaining <= 60), true);
  await leave(late);
  const beforePractice = await layout(guest);
  await guest.evaluate(() => hunt.room.cut()); await wait(guest, () => !hunt.room.connected);
  await guest.locator('#practice').tap(); await wait(guest, () => hunt.room.offline && hunt.state.phase === 'lobby');
  assert.deepEqual(beforePractice, await layout(guest));
  await guest.locator('#start').tap(); await wait(guest, () => hunt.state.phase === 'hide');
  assert.equal((await layout(guest)).hideSeconds, 60);
  assert.notEqual((await layout(guest)).seed, beforePractice.seed);
  await leave(guest);
  console.log('ok: late join, host change, phone settings and practice preserve the selected time and layout');

  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><canvas></canvas>');
  await page.evaluate(async () => {
    const THREE = await import('three'), { createHuntEnvironment } = await import('/g/escondidas/scene.js');
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas') }); renderer.setSize(500, 500);
    camera.position.set(30, 35, 30); camera.lookAt(0, 0, 0);
    const environment = createHuntEnvironment(scene);
    for (const id of ['plaza', 'puerto', 'hato', 'ruinas']) {
      let previous, geometries;
      for (const seed of [1, 17, 4294967295]) {
        environment.setMap(id, seed); renderer.render(scene, camera);
        const props = JSON.stringify(environment.props.userData.placements);
        if (props === previous) throw new Error('Props did not change'); previous = props;
        scene.traverse(o => { for (const v of o.geometry?.attributes.position?.array || []) if (!Number.isFinite(v)) throw new Error('Nonfinite geometry'); });
        if (geometries !== undefined && renderer.info.memory.geometries !== geometries) throw new Error('Round swap leaked geometry');
        geometries = renderer.info.memory.geometries;
      }
    }
    environment.dispose(); environment.dispose(); renderer.render(scene, camera);
    if (renderer.info.memory.geometries !== 0) throw new Error('Environment leaked geometry');
    renderer.dispose();
  });
  assert.deepEqual(errors, []);
  console.log('ok: twelve rendered layouts have finite geometry; round/map swaps and disposal release GPU resources');
} catch (error) {
  console.error(errors);
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
