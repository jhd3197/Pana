import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `paint-${Date.now()}`, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const out = 'Pana/games/pintura/qa'; await mkdir(out, { recursive: true });
const wait = (p, fn, arg, timeout = 60000) => p.waitForFunction(fn, arg, { timeout });
const mine = 'pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id)';
async function walk(p, key, until) { await p.keyboard.down(key); await wait(p, `${mine}.${until}`); await p.keyboard.up(key); }
// Spawns are drawn per round. From any plaza spawn: out to the clear lane past
// |24| round the court, along it to its south side (z < -25.5), then to x. Keys
// move along world axes (the overview, or first person facing yaw 0).
// edge: x is a wall to press against (the court ends near |26.4|), so walk on until past it;
// otherwise x only needs to be near.
async function toSouthLane(p, x, edge = false) {
  const at = () => p.evaluate(`(({ x, z }) => ({ x, z }))(${mine})`);
  let me = await at();
  if (Math.abs(me.z) >= Math.abs(me.x)) await walk(p, me.z < 0 ? 'w' : 's', me.z < 0 ? 'z < -24' : 'z > 24');
  else await walk(p, me.x < 0 ? 'a' : 'd', me.x < 0 ? 'x < -24' : 'x > 24');
  me = await at();
  if (me.z > -24) {
    // From the far x side, the lane itself leads south; from the north, cross to x's side first.
    if (Math.abs(me.x) < 24 || Math.sign(me.x) === Math.sign(x)) await walk(p, x < 0 ? 'a' : 'd', x < 0 ? 'x < -24.5' : 'x > 24.5');
    await walk(p, 'w', 'z < -25.5');
  }
  me = await at();
  if (edge) { if (x > 0 ? me.x <= x : me.x >= x) await walk(p, x > 0 ? 'd' : 'a', x > 0 ? `x > ${x}` : `x < ${x}`); }
  else if (Math.abs(me.x - x) > 1) await walk(p, me.x < x ? 'd' : 'a', me.x < x ? `x > ${x}` : `x < ${x}`);
  await walk(p, 'w', 'z < -25.5');
}
// Runs in the page: how many meshes of player id's pana render (every ancestor visible),
// and which other rendered meshes (not the held marker) stand inside that pana's body
// when this client watches through its eyes.
function bodyInView(id) {
  const { world, room } = pinturaDebug, avatar = world.avatars.get(id), seen = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  let shown = 0; avatar.group.traverse(o => { if (o.isMesh && seen(o)) shown++; });
  const inBody = [], me = room.state.players.find(p => p.id === id);
  if (id === room.id && world.view === 'primera') world.scene.traverse(o => {
    if (!o.isMesh || !seen(o)) return; for (let x = o; x; x = x.parent) if (x === world.camera || x === avatar.group) return;
    const at = o.getWorldPosition(o.position.clone()); if (at.y > .3 && at.y < 2 && Math.hypot(at.x - me.x, at.z - me.z) < .6) inBody.push(o.name || o.type);
  });
  return { shown, inBody };
}
async function open(name, room = code, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); localStorage.setItem('pana:avatar', JSON.stringify({ outfit: 'hoodie', outfitColor: '#3775cc', hat: 'gorra' })); }, name);
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(`${base}/g/pintura/?room=${room}&debug`, { waitUntil: 'domcontentloaded' });
  // Prepared, not just connected: the shared lobby docks the menu until the scene is ready.
  await wait(p, () => window.pinturaDebug?.room.connected && pinturaDebug.room.id && window.PANA_PREPARED === true, undefined, 120000); return p;
}
try {
  if (process.env.PANA_BROWSER_MOBILE_ONLY !== '1') {
  const a = await open('Juan'), b = await open('María'); await wait(a, () => pinturaDebug.room.state.players.length === 2);
  assert.equal(await a.evaluate(() => pinturaDebug.world.camera.isPerspectiveCamera), true);
  assert.ok(await b.locator('#start').isDisabled()); await wait(a, () => pinturaDebug.world.avatars.size === 2);
  // Guest-authored loadout travels through the real room and remains server-owned.
  await b.locator('#open-armory').click();
  // Markers are picked by class: a chip per class, then its markers (only La Chispa's class shows first).
  await b.locator('[data-slot="weapon"]').click();
  assert.equal(await b.locator('#armory-choices [data-id="rocket"]').count(), 0);
  assert.equal(await b.locator('#armory-classes [data-class="granadas"]').count(), 0, 'a class without markers has no chip');
  await b.locator('#armory-classes [data-class="lanzadores"]').click();
  assert.match(await b.locator('#armory-choices [data-id="revolver"]').textContent(), /El Tambor/);
  await b.locator('#armory-choices [data-id="rocket"]').click();
  assert.match(await b.locator('#armory-class').textContent(), /Lanzadores/);
  await b.locator('#armory-parts-back').click();
  // Attachment slots are explicit: a part lands in the slot that was clicked and stays there.
  const slotButton = i => b.locator(`[data-slot="attachments"][data-index="${i}"]`);
  const savedKit = () => b.evaluate(() => JSON.parse(localStorage.getItem('pintura:kit')));
  await slotButton(1).click(); assert.equal(await slotButton(1).getAttribute('aria-pressed'), 'true');
  assert.match(await b.locator('#armory-parts-back').textContent(), /Accesorio 2/);
  await b.locator('#armory-choices [data-id="hopper"]').click(); await b.locator('#armory-parts-back').click();
  assert.equal(await slotButton(1).locator('b').textContent(), 'Tolva grande'); assert.equal(await slotButton(0).locator('b').textContent(), 'Sin accesorio');
  assert.deepEqual((await savedKit()).attachments, [null, 'hopper', null]);
  await slotButton(0).click(); await b.locator('#armory-choices [data-id="stock"]').click(); await b.locator('#armory-parts-back').click();
  const guestId=await b.evaluate(()=>pinturaDebug.room.id);
  const seen = (want) => wait(a, ([id, want]) => JSON.stringify(pinturaDebug.room.state.players.find(p => p.id === id).kit.attachments) === want, [guestId, JSON.stringify(want)]);
  await seen(['stock', 'hopper', null]);
  // La Bazuca has a mount for every part (its stock is a pair of sliding rods): the parts stay put.
  await b.locator('[data-slot="weapon"]').click(); await b.locator('#armory-choices [data-id="bazooka"]').click();
  assert.equal(await b.locator('#armory-note').textContent(), '');
  assert.deepEqual((await savedKit()).attachments, ['stock', 'hopper', null]); await b.locator('#armory-parts-back').click();
  // The third slot takes the Mira, which names the kind this marker carries.
  await slotButton(2).click(); assert.match(await b.locator('#armory-parts-back').textContent(), /Accesorio 3/);
  assert.match(await b.locator('#armory-choices [data-id="optic"]').textContent(), /Holográfica/);
  await b.locator('#armory-choices [data-id="optic"]').click(); await b.locator('#armory-parts-back').click();
  await slotButton(0).click(); await b.locator('#armory-choices [data-id="barrel"]').click(); await b.locator('#armory-parts-back').click();
  await b.locator('[data-slot="weapon"]').click(); await b.locator('#armory-choices [data-id="rocket"]').click(); await b.locator('#armory-parts-back').click();
  await seen(['barrel', 'hopper', 'optic']);
  // The preview holds the real model with all three parts and its Mira kind.
  assert.equal(await b.evaluate(() => pinturaDebug.armory.preview.userData.optic), 'holo');
  // Clearing slot 0 leaves slots 1 and 2 where they were.
  await slotButton(0).click(); await b.locator('#armory-choices [data-id=""]').click(); await b.locator('#armory-parts-back').click();
  assert.equal(await slotButton(0).locator('b').textContent(), 'Sin accesorio'); assert.equal(await slotButton(1).locator('b').textContent(), 'Tolva grande'); assert.equal(await slotButton(2).locator('b').textContent(), 'Mira');
  assert.deepEqual((await savedKit()).attachments, [null, 'hopper', 'optic']);
  await b.locator('[data-slot="armor"]').click();await b.locator('#armory-choices [data-id="padded"]').click();
  await b.locator('#armory-parts-back').click();
  await b.locator('[data-slot="grenade"]').click();await b.locator('#armory-choices [data-id="pegajosa"]').click();
  await b.locator('#armory-close').click();
  await wait(a,id=>{const p=pinturaDebug.room.state.players.find(p=>p.id===id);return p.kit.weapon==='rocket' && JSON.stringify(p.kit.attachments)==='[null,"hopper","optic"]' && p.kit.armor==='padded' && p.kit.grenade==='pegajosa';},guestId);
  // Camuflajes: a fixed set. A solid one is everyone's and reaches the room; without pana.sh a
  // patterned one is locked in the armory, and the room swaps it for a solid one if sent anyway.
  await b.locator('#open-armory').click(); await b.locator('[data-slot="camo"]').click();
  await b.locator('#armory-choices .armory-camo[data-id="liso-uva"] .armory-choice').click();
  await wait(a, id => pinturaDebug.room.state.players.find(p => p.id === id).kit.camo === 'liso-uva', guestId);
  assert.equal((await savedKit()).camo, 'liso-uva');
  assert.equal(await b.evaluate(() => pinturaDebug.armory.preview.userData.camo?.pattern), 'solid');
  assert.equal(await b.locator('#armory-choices input[type="color"]').count(), 0, 'no free colour picker');
  const locked = b.locator('#armory-choices .armory-camo[data-id="selva"]');
  assert.equal(await locked.getAttribute('data-state'), 'locked'); assert.match(await locked.textContent(), /pana\.sh/);
  await locked.locator('.armory-choice').dispatchEvent('click'); assert.equal((await savedKit()).camo, 'liso-uva', 'a locked camo is not picked');
  assert.match(await b.locator('#armory-note').textContent(), /pana.sh/);
  await locked.locator('.armory-choice').hover(); await wait(b, () => pinturaDebug.armory.preview.userData.camo?.pattern === 'woodland');
  await b.locator('#armory-parts-back').click(); await b.locator('#armory-close').click();
  await b.evaluate(() => pinturaDebug.room.selectKit({ ...pinturaDebug.armory.kit, camo: 'selva' }));
  await wait(a, id => pinturaDebug.room.state.players.find(p => p.id === id).kit.camo === 'liso-mango', guestId);
  await wait(b, () => /camuflaje todavía no es tuyo/.test(document.getElementById('toast').textContent));
  await b.evaluate(() => pinturaDebug.room.selectKit({ ...pinturaDebug.armory.kit, camo: 'liso-uva' }));
  await wait(a, id => pinturaDebug.room.state.players.find(p => p.id === id).kit.camo === 'liso-uva', guestId);
  console.log('ok: a solid camo reaches the room and the preview, a locked one is refused and announced');
  // The routes below walk the plaza's outer lane; El Puerto is the default map.
  await a.evaluate(() => pinturaDebug.room.selectMap('plaza')); await wait(b, () => pinturaDebug.room.state.mapId === 'plaza');
  await a.screenshot({ path: `${out}/lobby.png` }); await a.locator('#start').click(); await wait(b, () => pinturaDebug.room.state.phase === 'playing');
  // Both clients load the court, then the room counts 3-2-1: input only counts after ¡YA!
  await wait(b, () => { const s = pinturaDebug.room.state; return !s.loading && !s.countdown; });
  assert.equal(await a.evaluate(() => pinturaDebug.world.view), 'primera');
  // First person hides every part of the pana's own body (no mesh of it renders, and no
  // stray mesh sits inside its body near the eye), while the other client still sees it.
  const hostId = await a.evaluate(() => pinturaDebug.room.id);
  await wait(a, () => pinturaDebug.world.camera.position.y > 1);
  assert.deepEqual(await a.evaluate(bodyInView, hostId), { shown: 0, inBody: [] }, 'own body hidden in first person');
  assert.ok((await b.evaluate(bodyInView, hostId)).shown > 5, 'the guest still sees the host');
  await b.evaluate(()=>pinturaDebug.room.selectKit({weapon:'rapid',armor:'wind'}));
  // A held throw: the guest looks up, holds G past 60% charge (the aim arc shows) and lets go.
  // The paint grenade leaves the hand on a real arc over the cover and blows more than 12 m away.
  await b.locator('#world').focus(); await b.evaluate(() => pinturaDebug.world.look(0, 1));
  await b.keyboard.down('g'); await wait(b, () => pinturaDebug.grenade.power > .6);
  await wait(b, () => pinturaDebug.world.scene.getObjectByName('Aim arc').visible && pinturaDebug.world.scene.getObjectByName('Aim ring').visible);
  const thrownFrom = await b.evaluate(`(({ x, z }) => ({ x, z }))(${mine})`); await b.keyboard.up('g');
  await wait(a,id=>!pinturaDebug.room.state.players.find(p=>p.id===id).grenadeReady,guestId);
  await wait(a, id => pinturaDebug.room.state.grenades.some(g => g.owner === id && g.y > 3), guestId);
  const blast = await (await wait(a, () => pinturaDebug.room.state.splats.find(s => s.blast))).jsonValue();
  assert.ok(Math.hypot(blast.x - thrownFrom.x, blast.z - thrownFrom.z) > 12, `grenade blew ${Math.hypot(blast.x - thrownFrom.x, blast.z - thrownFrom.z).toFixed(1)} m away`);
  console.log('ok: a held-charge grenade lobs from the hand over the cover and blows more than 12 m away');
  assert.equal(await a.evaluate(id=>pinturaDebug.room.state.players.find(p=>p.id===id).kit.weapon,guestId),'rocket','mid-round kit edit is rejected');
  // The refusal is said, not swallowed.
  await wait(b, () => /plena ronda/.test(document.getElementById('toast').textContent));
  // A number key changes the marker in the room and in the saved kit.
  await a.locator('#world').focus(); await a.keyboard.press('3');
  await wait(a, () => JSON.parse(localStorage.getItem('pintura:kit')).weapon === 'rapid' && pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).kit.weapon === 'rapid');
  // 7 is La Metra (new markers are pickable mid-round); X steps to the next marker in class order, Z back.
  await a.keyboard.press('7'); await wait(a, `${mine}.kit.weapon === 'smg'`);
  await a.keyboard.press('x'); await wait(a, `${mine}.kit.weapon === 'pdw'`);
  await a.keyboard.press('z'); await wait(a, `${mine}.kit.weapon === 'smg'`);
  await a.keyboard.press('1'); await wait(a, `${mine}.kit.weapon === 'pistol'`);
  assert.equal(await a.evaluate(() => JSON.parse(localStorage.getItem('pintura:kit')).weapon), 'pistol');
  console.log('ok: markers by class, three armory slots stay put, the Mira names its kind, kits replicate, mid-round kit lock is announced, number keys and Z/X update the saved kit');

  // The guest crosses the court with the overview option (world-axis keys); the
  // host plays the default first-person view: turn, walk, then fire along the crosshair.
  await b.locator('#menu').click(); await b.locator('#pana-tab-settings').click();
  await b.locator('.pana-settings-nav button', { hasText: 'Pepazo' }).click();
  await b.locator('#pana-opt-view').getByRole('radio', { name: 'Ver la cancha', exact: true }).click(); await b.keyboard.press('Escape');
  // Out of first person the guest's own pana shows again.
  await wait(b, fn => new Function(`return (${fn})`)()(pinturaDebug.room.id).shown > 5, bodyInView.toString());
  console.log('ok: first person hides the own pana (body, kit, vest, marker), the rival still sees it, the overview shows it again');
  await b.locator('#world').focus(); await toSouthLane(b, 26, true);
  await wait(b, `!${mine}.walk`);
  await a.locator('#world').focus(); await a.evaluate(() => pinturaDebug.world.look(-pinturaDebug.world.yaw)); await toSouthLane(a, -10);
  const guest = await b.evaluate(() => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id));
  await wait(a, id => { const g = pinturaDebug.room.state.players.find(p => p.id === id); return g.x > 26 && g.z < -25.5; }, guest.id);
  await a.evaluate(id => { const { room, world } = pinturaDebug, me = room.state.players.find(p => p.id === room.id), g = room.state.players.find(p => p.id === id); world.look(Math.atan2(-(g.x - me.x), -(g.z - me.z)) - world.yaw); }, guest.id);
  // Space hops (server-side), up and back down, before the duel.
  await a.keyboard.press(' '); await wait(a, `${mine}.jumpHeight > .2`); await wait(a, `${mine}.jumpHeight === 0`);
  await a.keyboard.down('Enter');
  // The first confirmed hit raises the feat toast (¡Pintaste a…!, then ¡Doble!/¡Triple pintada!).
  await wait(a, () => /Pintaste|pintada/.test(document.getElementById('toast').textContent));
  await wait(a, `${mine}.score > 0`); await a.keyboard.up('Enter');
  await wait(b, `${mine}.hits > 0`);
  await wait(a, id => !!pinturaDebug.world.avatars.get(id)?.knockout, guest.id);
  assert.equal(await a.evaluate(id => pinturaDebug.world.avatars.get(id).knockout.physics.points.every(p => Number.isFinite(p.x+p.y+p.z)), guest.id), true);
  const impact = await b.evaluate(() => pinturaDebug.room.state.players.find(p=>p.id===pinturaDebug.room.id).impact);
  assert.ok(Math.abs(Math.hypot(impact.x,impact.z)-1)<1e-6);
  console.log('ok: authoritative impact drives finite own-pana knockout physics');
  console.log('ok: real guest movement and first-person host aim/fire produce a server-confirmed hit on both clients, with the feat toast');
  await a.screenshot({ path: `${out}/playing.png` });
  await wait(b, () => !pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).respawn);
  assert.equal(await b.evaluate(() => pinturaDebug.world.avatars.get(pinturaDebug.room.id).knockout), null);
  await a.close(); await wait(b, () => pinturaDebug.room.isHost); const before = await b.evaluate(() => pinturaDebug.room.state.time); await b.waitForTimeout(700); assert.ok(await b.evaluate(() => pinturaDebug.room.state.time) < before);
  const c = await open('Luis'); await wait(c, () => pinturaDebug.room.state.phase === 'playing'); assert.equal(await c.evaluate(() => pinturaDebug.room.state.round), 1);
  console.log('ok: respawn, host departure and late arrival preserve the running round');
  // The real round clock or a player reaching ten ends this without a debug server mutation.
  await wait(b, () => pinturaDebug.room.state.phase === 'finished', undefined, 210000); await wait(c, () => pinturaDebug.room.state.phase === 'finished');
  const scores = await b.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])); assert.deepEqual(await c.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])), scores);
  await b.screenshot({ path: `${out}/results.png` }); await b.locator('#again').click(); await wait(c, () => pinturaDebug.room.state.phase === 'lobby');
  // Back in the lobby the host picks the next map, and the next round plays it.
  assert.ok(await b.locator('#map-choice').isEnabled());
  await b.evaluate(() => pinturaDebug.room.selectMap('muelle')); await wait(c, () => pinturaDebug.room.state.mapId === 'muelle');
  await b.locator('#start').click(); await wait(c, () => pinturaDebug.room.state.round === 2 && pinturaDebug.room.state.phase === 'playing' && pinturaDebug.room.state.mapId === 'muelle');
  console.log('ok: real round end agrees across clients, Otra ronda returns to the lobby and the next map is the host\'s pick');
  await b.close(); await c.close();
  // Los del pescozón: La Chancleta from the armory, a swing that paints the bot in
  // front, then the throw: it leaves the hand (the held model hides, the real
  // sandal flies), paints a bot 12 m away and comes back to the hand.
  const s = await open('Chancla', `${code}-melee`);
  await s.locator('#open-armory').click(); await s.locator('[data-slot="weapon"]').click();
  await s.locator('#armory-classes [data-class="melee"]').click();
  assert.match(await s.locator('#armory-choices [data-id="sandal"]').textContent(), /La Chancleta/);
  await s.locator('#armory-choices [data-id="sandal"]').click();
  assert.match(await s.locator('#armory-class').textContent(), /Cuerpo a cuerpo/);
  assert.match(await s.locator('#armory-stats').textContent(), /Golpes\/s/); assert.doesNotMatch(await s.locator('#armory-stats').textContent(), /Capacidad/);
  await s.locator('#armory-parts-back').click(); await s.locator('[data-slot="attachments"][data-index="0"]').click();
  assert.equal(await s.locator('#armory-choices [data-id="barrel"]').count(), 0, 'melee lists its own parts');
  await s.locator('#armory-choices [data-id="tape"]').click(); await s.locator('#armory-parts-back').click(); await s.locator('#armory-close').click();
  assert.equal(await s.evaluate(() => JSON.parse(localStorage.getItem('pintura:kit')).weapon), 'sandal');
  // The positions below are on the plaza (open from x -14, z 22 down to z 10).
  await s.evaluate(() => pinturaDebug.room.selectMap('plaza')); await wait(s, () => pinturaDebug.room.state.mapId === 'plaza');
  await s.locator('#practice').click();
  await wait(s, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown);
  // The bots stand still; the pana looks down -z at the first one, `gap` metres away.
  const place = gap => s.evaluate(gap => {
    const g = pinturaDebug.room.game, [me, bot] = g.players;
    g.bot = () => ({ x: 0, z: 0, ax: 0, az: 1, weapon: null, fire: false, alt: false, aim: false, reload: false, sprint: false, grenade: false, pitch: 0, charge: 0, jump: 0 });
    g.players.slice(2).forEach(p => Object.assign(p, { x: 20, z: -20 }));
    Object.assign(me, { x: -14, z: 22, shield: 0, respawn: 0 }); Object.assign(bot, { x: -14, z: 22 - gap, shield: 0, respawn: 0, paint: 0, hits: 0 });
    pinturaDebug.world.look(-pinturaDebug.world.yaw, -pinturaDebug.world.pitch);
  }, gap);
  await s.locator('#world').focus(); await place(1.4);
  await wait(s, `${mine}.kit.weapon === 'sandal' && ${mine}.melee.phase === 'ready'`);
  await s.keyboard.press('Enter');
  await wait(s, () => pinturaDebug.room.state.players[1].hits > 0 && pinturaDebug.room.state.players[0].smacks > 0);
  assert.equal(await s.evaluate(() => pinturaDebug.room.state.players[0].ammo), 0, 'no ammo involved');
  console.log('ok: La Chancleta picked by its class chip with melee stats and parts; a swing paints the bot in front');
  await wait(s, () => !pinturaDebug.room.state.players[1].respawn); await place(12);
  await wait(s, `${mine}.melee.phase === 'ready' && pinturaDebug.world.held.visible`);
  await s.keyboard.press('v');
  await wait(s, () => pinturaDebug.room.state.thrown.length > 0 && !pinturaDebug.world.held.visible && pinturaDebug.world.scene.getObjectByName('Thrown sandal')?.visible);
  await wait(s, () => pinturaDebug.room.state.players[1].hits > 0);
  assert.equal(await s.evaluate(() => pinturaDebug.room.state.events.filter(e => e.type === 'out').at(-1).thrown), true);
  await wait(s, `${mine}.melee.phase === 'ready' && ${mine}.recalls > 0 && pinturaDebug.world.held.visible`);
  assert.match(await s.locator('#aim').textContent(), /Lanzar/);
  console.log('ok: V throws the chancla on an arc: it leaves the hand, paints a bot 12 m away and comes back');
  await s.close();
  }
  const m = await open('Móvil', `${code}-mobile`, true); await m.screenshot({ path: `${out}/mobile-lobby.png` }); await m.locator('#practice').tap();
  await wait(m, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown); assert.ok(await m.locator('#fire').isVisible());
  // A bot's hit would respawn the pana elsewhere mid-check: shield it while touch movement is measured.
  await wait(m, () => pinturaDebug.room.game.players[0].respawn === 0);
  await m.evaluate(() => { pinturaDebug.room.game.players[0].shield = 30; });
  const start = await m.evaluate(() => { const p = pinturaDebug.room.state.players[0]; return { x: p.x, z: p.z, direction: pinturaDebug.world.movement(1, 0) }; });
  // Hold until the pana has moved (state, not a fixed sleep), then release.
  await m.locator('#right').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', button: 0, buttons: 1 });
  // Measure along the input the pad actually sent: the camera's yaw (and so the
  // pad's world direction) is only known once the first playing frame drew.
  await wait(m, start => { const p = pinturaDebug.room.state.players[0], c = pinturaDebug.room.current; return (c.x || c.z) && (p.x - start.x) * c.x + (p.z - start.z) * c.z > .1; }, start, 20000);
  await m.locator('#right').dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch', button: 0 });
  await m.locator('#fire').tap(); await m.screenshot({ path: `${out}/mobile-playing.png` });
  for (const id of ['fire', 'up', 'reload']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845); }
  await m.locator('#menu').tap(); const time = await m.evaluate(() => pinturaDebug.room.state.time); await m.waitForTimeout(400); assert.equal(await m.evaluate(() => pinturaDebug.room.state.time), time); await m.locator('#pana-resume').tap();
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await m.setViewportSize({ width: 844, height: 390 }); await m.screenshot({ path: `${out}/mobile-landscape.png` });
  for (const id of ['fire', 'up', 'reload']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 845 && box.y + box.height <= 391); }
  console.log('ok: touch movement/fire, local pause and both phone orientations'); assert.deepEqual(errors, []); console.log('Paintball browser proof passed.');
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.log(await page.evaluate(() => window.pinturaDebug ? { id: pinturaDebug.room.id, input: pinturaDebug.input(), state: pinturaDebug.room.state } : 'Game not loaded').catch(() => 'Page closed'));
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  }
  console.log(errors); throw error;
} finally { await browser.close(); }
