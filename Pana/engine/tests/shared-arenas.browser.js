// Real rooms plus geometric/rendering proof for the maps shared by four games.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', out = 'art/shared-maps';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [], maps = ['puerto', 'hato', 'ruinas'];
const wait = (page, fn, value) => page.waitForFunction(fn, value, { timeout: 90000 });
const games = [['escondidas', 'hunt'], ['pintura', 'pinturaDebug'], ['billar', 'billarDebug'], ['caida', 'caidaDebug']];
async function open(game, debug, room, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 760 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(() => { localStorage.setItem('pana:name', 'Pana'); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(`${game}: ${e.message}`));
  await page.goto(`${base}/g/${game}/?room=${room}&debug`, { waitUntil: 'domcontentloaded' });
  await wait(page, debug => window[debug]?.room.connected && (debug !== 'caidaDebug' || window[debug].world), debug);
  await wait(page, () => window.PANA_LOBBY_LOADING === false);
  return page;
}
const state = (page, debug) => page.evaluate(debug => window[debug].room.state, debug);
async function chooseMap(page, mapId) {
  const picker = page.locator('#map-choice');
  if (await picker.isVisible()) return picker.selectOption(mapId);
  // Pepazo's sala exposes arrow buttons; its native select only stores state.
  const count = await picker.locator('option').count();
  for (let i = 0; i < count && await picker.inputValue() !== mapId; i++) {
    const previous = await picker.inputValue();
    await page.getByRole('button', { name: 'Mapa siguiente', exact: true }).click();
    await wait(page, value => document.getElementById('map-choice').value !== value, previous);
  }
  assert.equal(await picker.inputValue(), mapId);
}
async function leave(page, debug) {
  // A context kill is a dropped transport and reserves the seat for reconnect.
  // Exercise an explicit departure before immediately filling a two-seat room.
  await page.evaluate(debug => window[debug].room.dispose(), debug);
  await page.context().close();
}
async function attemptMap(page, game, debug, mapId) {
  await page.evaluate(({ game, debug, mapId }) => {
    const room = window[debug].room;
    // Bypass disabled UI to prove the room/rules enforce authority too.
    if (game === 'pintura') room.link.send('map', { mapId });
    else if (game === 'caida') room.action('configure', { options: { mapId } });
    else room.action('map', { mapId });
  }, { game, debug, mapId });
}
try {
  for (const [game, debug] of games.filter(([id]) => !process.env.PANA_ARENA_GAMES || process.env.PANA_ARENA_GAMES.split(',').includes(id))) {
    // Invite codes truncate at 24 characters; suffixes must remain distinct.
    const code = `${game.slice(0, 2)}-${Date.now().toString(36)}`, a = await open(game, debug, code), b = await open(game, debug, code);
    await wait(a, debug => window[debug].room.isHost, debug);
    await wait(b, () => document.querySelector('#map-choice').disabled);
    const advancedMap = ['billar', 'caida'].includes(game);
    if (advancedMap) await a.locator('#pana-room-more').click();
    for (const mapId of maps) {
      await chooseMap(a, mapId);
      for (const page of [a, b]) await wait(page, ({ debug, mapId }) => {
        const d = window[debug]; return d.room.state.mapId === mapId && (d.world?.scene || d.scene)?.userData.mapId === mapId;
      }, { debug, mapId });
      assert.equal(await b.locator('#map-choice').inputValue(), mapId);
      await a.screenshot({ path: `${out}/${game}-${mapId}-lobby.png` });
    }
    await attemptMap(b, game, debug, 'puerto'); await a.waitForTimeout(350);
    assert.equal((await state(a, debug)).mapId, 'ruinas');
    if (advancedMap) await a.locator('#pana-room-done').click();
    await a.locator('#start').click(); await wait(b, debug => window[debug].room.state.phase !== 'lobby', debug);
    await attemptMap(a, game, debug, 'hato'); await a.waitForTimeout(350);
    assert.equal((await state(b, debug)).mapId, 'ruinas');
    await a.screenshot({ path: `${out}/${game}-ruinas-playing.png` });
    if (game !== 'billar') {
      const late = await open(game, debug, code); await wait(late, debug => window[debug].room.state.mapId === 'ruinas', debug); await leave(late, debug);
    }
    await leave(a, debug); await wait(b, debug => window[debug].room.isHost, debug);
    assert.equal((await state(b, debug)).mapId, 'ruinas');
    const newcomer = await open(game, debug, code); await wait(newcomer, debug => window[debug].room.state.mapId === 'ruinas', debug);
    await leave(newcomer, debug); await leave(b, debug);
    console.log(`ok: ${game} all maps agree across peers; guest/mid-round rejection; late join and host change`);
    const mobile = await open(game, debug, `${code}-phone`, true);
    if (advancedMap) await mobile.locator('#pana-room-more').click();
    for (const mapId of maps) {
      await chooseMap(mobile, mapId);
      await wait(mobile, ({ debug, mapId }) => window[debug].room.state.mapId === mapId, { debug, mapId });
    }
    await mobile.locator(game === 'pintura' ? '.sala-map' : '#map-choice').scrollIntoViewIfNeeded();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.screenshot({ path: `${out}/${game}-phone-picker.png` });
    if (advancedMap) await mobile.locator('#pana-room-done').click();
    await mobile.locator(game === 'billar' ? '#practice' : '#start').click({ timeout: 30000 });
    await wait(mobile, debug => window[debug].room.state.phase !== 'lobby', debug);
    assert.equal((await state(mobile, debug)).mapId, 'ruinas');
    await mobile.screenshot({ path: `${out}/${game}-phone-playing.png` });
    await leave(mobile, debug);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message)); await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><canvas id="view"></canvas>');
  const proof = await page.evaluate(async () => {
    const THREE = await import('three'), { createArenaEnvironment } = await import('/engine/worlds/arenas.js');
    const { MAPS } = await import('/studio/catalog/maps.js');
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1.6, .1, 300);
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas') }); renderer.setSize(1280, 800);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7756, 2)); const sun = new THREE.DirectionalLight(0xffebc9, 3); sun.position.set(-15, 30, 15); scene.add(sun);
    camera.position.set(38, 35, 42); camera.lookAt(0, 0, -4);
    const records = [];
    for (let cycle = 0; cycle < 2; cycle++) for (const id of ['puerto', 'hato', 'ruinas']) for (const mode of ['hunt', 'paint', 'table']) {
      const world = createArenaEnvironment(id, { mode }); scene.add(world.group); world.update(12, .016); renderer.render(scene, camera);
      let finite = true; world.group.traverse(o => { if (o.geometry) { const a = o.geometry.getAttribute('position'); for (const v of a.array) if (!Number.isFinite(v)) finite = false; } });
      const blockedCenter = mode === 'table' && world.group.userData.placements.some(({ min, max }) => {
        const x = Math.max(min[0], Math.min(0, max[0])), z = Math.max(min[2], Math.min(0, max[2])); return Math.hypot(x, z) < 8;
      });
      for (const p of world.group.userData.placements.filter(p => p.perimeter)) {
        if (p.min[0] < 21.99 && p.max[0] > -21.99 && p.min[2] < 21.99 && p.max[2] > -21.99) throw new Error(`Scenery blocks the court/camera: ${id}/${p.assetId}`);
      }
      records.push({ id, mode, cycle, finite, blockedCenter, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
      world.dispose(); world.dispose(); renderer.render(scene, camera);
      if (renderer.info.memory.geometries !== 0) throw new Error(`Map geometry leaked: ${id}/${mode}`);
    }
    for (const id of ['puerto', 'hato', 'ruinas']) {
      const entry = MAPS.find(m => m.id === `arena-${id}`), model = await entry.build();
      if (model.group.userData.mapId !== id) throw new Error('Studio uses a different factory'); model.dispose();
    }
    renderer.dispose();
    const { createScene } = await import('/g/pintura/scene.js'), { Arena, spawnsFor } = await import('/g/pintura/rules.js');
    const canvas = document.createElement('canvas'); document.body.append(canvas); const paint = createScene(canvas);
    for (const id of ['puerto', 'hato', 'ruinas', 'muelle', 'noche', 'terminal']) {
      const game = new Arena(id); game.add(1, { name: 'Camera', avatar: {} }); game.start();
      for (const spawn of spawnsFor(id)) {
        Object.assign(game.players[0], spawn);
        paint.draw({ ...game.view(), phase: 'lobby' }, 1, .016);
        paint.draw(game.view(), 1, .016);
        if (Math.hypot(paint.camera.position.x - spawn.x, paint.camera.position.z - spawn.z) > .5 || paint.avatars.get(1).group.visible) throw new Error(`First-person camera is not at the pana's eyes: ${id}/${JSON.stringify(spawn)}`);
      }
    }
    paint.dispose(); return records;
  });
  for (const row of proof) { assert.equal(row.finite, true); assert.equal(row.blockedCenter, false); assert.ok(row.calls < 250, JSON.stringify(row)); assert.ok(row.triangles < 1500000, JSON.stringify(row)); }
  console.log('ok: all three map variants render twice, clear table footprints, release geometry and build in Studio');
  assert.deepEqual(errors, []); console.log('Shared arena browser proof passed.');
} catch (error) {
  console.error(errors); for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error;
} finally { await browser.close(); }
