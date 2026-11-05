// The ruin rooms in the real loop, over a real relay with two panas: the keyboard walks
// into a nook's door, the stone jaguar stays one baked mesh, a fire feeds its pool light,
// and a cave-in dug by the guest cracks and breaks on both screens with the rules none
// the wiser. Waits on state only.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-ruin-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const MAX_STATUE_TRIANGLES = 2600, MAX_FIRE_DRAWS = 2;
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(120_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'templo' } }));
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');

  const deal = await a.evaluate(async () => {
    const { generateRun } = await import('/g/reliquia/deck.js'), g = reliquia.room.game;
    let seed = 1; for (; seed < 3000; seed++) { const run = generateRun(seed, { depth: g.level || 1, theme: 'templo' }); if (run.lights.some(l => l.floor === 1 && l.kind === 'brazier') && run.nooks.some(n => n.floor === 1)) break; }
    g.start(seed); for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
    Object.assign(g, { sucesoIn: 1e9, collapseIn: 1e9, swarmAt: 1e9, deepest: 1 }); g.director.duration = 1e9; g.lift.floor = 1; g.enemies = [];
    for (const p of g.players) p.invulnerable = 1e9;
    reliquia.room.publish();
    const run = g.layout.run, L = g.layout, free = (x, z) => L.walkable(x, z, g, .42);
    const nook = run.nooks.find(n => n.floor === 1 && [.5, 1, 1.5, 2.5].every(d => free(n.mouth.x + n.nx * d, n.mouth.z + n.nz * d)));
    const fire = run.lights.find(l => l.floor === 1 && l.kind === 'brazier'), corridor = run.corridors.find(c => c.floor === 1 && !c.hidden);
    const mid = { x: (corridor.rect[0] + corridor.rect[2]) / 2, z: (corridor.rect[1] + corridor.rect[3]) / 2 };
    return { seed, nook, fire, corridor, mid, ids: { a: reliquia.room.id, b: g.players.find(p => p.id !== reliquia.room.id).id } };
  });
  await waitFor(b, seed => reliquia.state.seed === seed, deal.seed);

  // The door: the guest walks at it with the W key, off its middle, and ends up inside.
  const n = deal.nook, heading = Math.atan2(-n.nx, -n.nz), off = .5;
  const start = { x: n.mouth.x + n.nx * 2 + n.nz * off, z: n.mouth.z + n.nz * 2 - n.nx * off };
  await a.evaluate(({ id, start }) => reliquia.place(id, start.x, start.z), { id: deal.ids.b, start });
  await waitFor(b, s => Math.hypot(reliquia.me.x - s.x, reliquia.me.z - s.z) < .4, start);
  await b.evaluate(h => reliquia.face(h, -.05), heading);
  await b.keyboard.down('w');
  await waitFor(a, ({ id, nook }) => reliquia.state.players.find(p => p.id === id).hidden === nook, { id: deal.ids.b, nook: n.id });
  await b.keyboard.up('w');
  check('walking at a nook off its middle takes the guest inside, and the host agrees');
  const dressed = await b.evaluate(() => reliquia.view.world.floors.get(1).flames?.userData.count ?? 0);
  assert.ok(dressed >= (await b.evaluate(() => reliquia.view.world.run.nooks.filter(q => q.floor === 1).length)), 'a candle in every nook');
  check('every nook on the floor has its candle');

  // The stone jaguar: one mesh, within its triangles, gold or stone.
  const statue = await a.evaluate(async () => {
    const { jaguarStatue } = await import('/engine/models/props/jaguar-stone.js');
    const count = s => { let meshes = 0, triangles = 0; s.traverse(o => { if (o.isMesh) { meshes++; triangles += o.geometry.attributes.position.count / 3; } }); return { meshes, triangles }; };
    const stone = jaguarStatue({ seed: 4, scale: .75 }), gold = jaguarStatue({ gold: true, scale: .7 });
    return { stone: count(stone), gold: count(gold), radius: stone.userData.footprintRadius };
  });
  assert.equal(statue.stone.meshes, 1); assert.equal(statue.gold.meshes, 1); assert.equal(statue.radius, .9);
  assert.ok(statue.stone.triangles <= MAX_STATUE_TRIANGLES, `statue: ${statue.stone.triangles} triangles`);
  check(`the stone jaguar is one mesh of ${statue.stone.triangles} triangles`);

  // A fire: two draws, its pool light wanders around it, and a feed spikes both.
  await a.evaluate(({ id, x, z }) => reliquia.place(id, x, z), { id: deal.ids.a, x: deal.fire.x + 2.4, z: deal.fire.z });
  const fire = await a.evaluate(async at => {
    const { x, z } = at, frame = () => new Promise(r => requestAnimationFrame(r)), world = reliquia.view.world;
    reliquia.face(Math.atan2(x - reliquia.me.x, z - reliquia.me.z), 0);
    for (let i = 0; i < 40; i++) await frame();
    const f = world.fireAt(1, x, z), meshes = []; f.group.traverse(o => { if (o.isMesh || o.isPoints) meshes.push(o); });
    const light = reliquia.view.scene.children.filter(o => o.isPointLight).find(l => l.userData.fire === f);
    const seen = new Set(), intensities = [];
    for (let i = 0; i < 12; i++) { await frame(); seen.add(light.position.x.toFixed(3)); intensities.push(light.intensity); }
    const before = Math.max(...intensities), flare0 = f.flare; world.feedFires(1, 1, { x, z }, 4);
    await frame(); await frame();
    return { draws: meshes.length, hasLight: !!light, wander: seen.size, spike: light.intensity > before, flare0, flare: f.flare, embers: f.embers.alive, cards: f.cards, quality: f.quality };
  }, deal.fire);
  assert.ok(fire.draws <= MAX_FIRE_DRAWS, `draws: ${fire.draws}`);
  assert.ok(fire.hasLight, 'the pool lends the nearest fire a light');
  assert.ok(fire.wander >= 4, `the light wanders: ${fire.wander}`);
  assert.ok(fire.flare > fire.flare0 + .5 && fire.spike, 'a feed flares the fire and spikes its light');
  assert.ok(fire.embers > 0, 'embers fly');
  assert.equal(fire.quality, 'baja'); assert.equal(fire.cards, 3);
  check('a fire is two draws, drives its pool light, and flares when fed (low quality: three cards)');

  // A cave-in: the guest holds E; both screens crack, and only the rules decide when it clears.
  const { corridor, mid } = deal, along = corridor.horizontal ? [1, 0] : [0, 1], reach = (corridor.horizontal ? corridor.rect[2] - corridor.rect[0] : corridor.rect[3] - corridor.rect[1]) / 2 + .7;
  await a.evaluate(({ id, ids, mid, along, reach }) => {
    const g = reliquia.room.game, spot = s => { const x = mid.x + along[0] * s * reach, z = mid.z + along[1] * s * reach; return g.layout.walkable(x, z, g, .42) ? { x, z } : null; }, at = spot(1) || spot(-1), other = spot(-1) || at;
    g.rubble[id] = 0; g.paths.clear();
    reliquia.place(ids.b, at.x, at.z, Math.atan2(mid.x - at.x, mid.z - at.z)); reliquia.place(ids.a, other.x, other.z, Math.atan2(mid.x - other.x, mid.z - other.z));
  }, { id: corridor.id, ids: deal.ids, mid, along, reach });
  const aim = page => page.evaluate(m => { const me = reliquia.me; reliquia.face(Math.atan2(m.x - me.x, m.z - me.z), -.2); }, mid);
  await waitFor(b, id => id in (reliquia.state.rubble || {}), corridor.id);
  await aim(a); await aim(b);
  const heapReady = id => { const h = reliquia.view.world.heaps.get(id); return !!h?.crack; };
  await waitFor(a, heapReady, corridor.id); await waitFor(b, heapReady, corridor.id);
  await waitFor(b, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'rubble');
  const listen = () => { window.fxSeen = []; const next = reliquia.view.onFx, spawn = reliquia.view.puffs.spawn; reliquia.view.onFx = e => { window.fxSeen.push(e.type); next?.(e); }; reliquia.view.puffs.spawn = function (...args) { window.fxSeen.push('dust'); return spawn.apply(this, args); }; };
  await a.evaluate(listen); await b.evaluate(listen);
  await b.keyboard.down('e');
  // Half way: the shared progress has moved and both screens show the same cracks from it.
  await waitFor(a, id => reliquia.state.rubble[id] > 2.4, corridor.id);
  // Stop digging so nothing moves, and wait for both screens to settle on the host's number.
  await b.keyboard.up('e');
  await waitFor(a, id => { const g = reliquia.room.game; return g.rubble[id] === window.lastDug || ((window.lastDug = g.rubble[id]), false); }, corridor.id);
  const dug = await a.evaluate(id => reliquia.room.game.rubble[id] / 5, corridor.id);
  const settled = ({ id, dug }) => Math.abs(reliquia.view.world.heaps.get(id).crack.progress - dug) < .01;
  await waitFor(a, settled, { id: corridor.id, dug }); await waitFor(b, settled, { id: corridor.id, dug });
  await a.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await b.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const crackOn = page => page.evaluate(id => { const c = reliquia.view.world.heaps.get(id).crack; return { progress: c.progress, reveal: c.reveal, glow: c.glow }; }, corridor.id);
  const [host, guest] = [await crackOn(a), await crackOn(b)];
  for (const v of [host, guest]) { assert.ok(v.reveal > .3, `cracks have run: ${v.reveal}`); assert.ok(v.glow > .2, `and glow: ${v.glow}`); }
  assert.ok(Math.abs(host.reveal - guest.reveal) < .01, `the same breaking on both screens: ${host.reveal}, ${guest.reveal}`);
  check('half dug: both screens show the same growing, glowing cracks');
  const fxHalf = [await a.evaluate(() => window.fxSeen), await b.evaluate(() => window.fxSeen)];
  for (const seen of fxHalf) { assert.ok(seen.includes('hit'), `hits: ${seen}`); assert.ok(seen.includes('dust'), `dust: ${seen}`); }
  check('hits, chips and dust land on the digger\'s screen and the watcher\'s alike');
  const chipsCap = await b.evaluate(id => reliquia.view.world.heaps.get(id).crack.flying, corridor.id);
  assert.ok(chipsCap <= 80, `flying: ${chipsCap}`);
  // The break comes from the rules clearing it, at the rules' own hold time.
  await b.keyboard.down('e');
  await waitFor(a, id => !(id in reliquia.state.rubble), corridor.id);
  await b.keyboard.up('e');
  await waitFor(b, id => !(id in reliquia.state.rubble), corridor.id);
  for (const page of [a, b]) {
    const type = await page.evaluate(() => window.fxSeen);
    assert.ok(type.includes('break'), `break on screen: ${type}`); assert.ok(type.includes('crunch'), `crunch: ${type}`);
    await waitFor(page, id => !reliquia.view.world.heaps.has(id), corridor.id);
  }
  check('the rules clear it and it splits on both screens, then cleans up after itself');
  const hostWalks = await a.evaluate(({ x, z }) => reliquia.room.game.layout.walkable(x, z, reliquia.room.game, .42), mid);
  assert.ok(hostWalks, 'the tunnel is open again');
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  check('no errors on either screen');
} finally { await browser.close(); }
