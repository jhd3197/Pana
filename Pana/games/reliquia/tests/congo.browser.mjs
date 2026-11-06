// El Congo over a real relay with two panas: the lobby offers it, both deal the same vine
// channels over the same opaque water, each pana sits in a boat, the Mokele reaches the guest
// as plain state and shows as a shape and then as teeth on that screen, its cues fire before
// it is seen, a new host keeps it and the whirlpool still takes it. The Biblioteca keeps its
// own lamp and none of this. Waits on state only. Screenshots go to qa/congo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = path.join(qaDir(import.meta.url), 'congo'), room = `fosa-congo-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
fs.mkdirSync(output, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`) });
const browser = await launch();
const open = async (name, code = room) => { const p = await openGame(browser, 'reliquia', { name, room: code, query: 'debug' }); p.setDefaultTimeout(120_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
// A wait on the game's own clock, so the view has really drawn the last change.
const ticks = (page, seconds) => page.evaluate(s => new Promise(done => { const until = performance.now() + s * 1000; const look = () => performance.now() > until ? done() : requestAnimationFrame(look); look(); }), seconds);
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);

  // The Lugar picker: the Congo is one of the choices, and choosing it reaches the guest.
  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'congo' } }));
  await waitFor(b, () => reliquia.state.options.place === 'congo');
  const offered = await a.evaluate(async () => (await import('/g/reliquia/options.js')).FIELDS.find(f => f.id === 'place').choices.map(c => c[0]));
  assert.ok(offered.includes('congo')); check('the lobby offers the Congo and the guest sees the choice');
  await shot(a, 'lugar-picker');

  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  const deal = await a.evaluate(() => {
    const g = reliquia.room.game, run = g.layout.run, maze = run.rooms.find(r => r.kind === 'canal' || r.kind === 'manglar') || run.rooms.find(r => r.index === 1), guest = g.players.find(p => p.id !== reliquia.room.id);
    for (const r of run.rooms) g.woke[r.id] = 1; g.director.duration = 1e6; g.sucesoIn = 1e6; g.lift.floor = 1; g.deepest = 1; g.enemies = [];
    for (const p of g.players) p.invulnerable = 1e6;
    const at = c => { for (let r = 0; r < 9; r += .5) for (let k = 0; k < 8; k++) { const x = c.x + Math.cos(k * .785) * r, z = c.z + Math.sin(k * .785) * r; if (g.layout.walkable(x, z, g, .72)) return { x, z }; } return null; };
    const lane = run.corridors.find(c => !c.hidden && (c.horizontal ? c.rect[2] - c.rect[0] : c.rect[3] - c.rect[1]) >= 8) || run.corridors.find(c => !c.hidden);
    return { id: reliquia.room.id, guest: guest.id, maze: at(maze), lane: at({ x: (lane.rect[0] + lane.rect[2]) / 2, z: (lane.rect[1] + lane.rect[3]) / 2 }), horizontal: lane.horizontal, solids: run.solids.filter(s => s.kind === 'vine').map(s => s.rect) };
  });
  assert.ok(deal.solids.length > 10, `${deal.solids.length} vine walls`);
  await a.evaluate(d => { reliquia.place(d.id, d.maze.x, d.maze.z); reliquia.place(d.guest, d.maze.x + 1.1, d.maze.z); }, deal);
  for (const page of [a, b]) await waitFor(page, () => reliquia.view.world.floors.get(1)?.congo && reliquia.view.lookName === 'congo' && reliquia.view.congo);
  const scene = page => page.evaluate(() => {
    const floor = reliquia.view.world.floors.get(1), run = reliquia.view.world.run;
    return { solids: run.solids.filter(s => s.kind === 'vine').map(s => s.rect), vines: floor.congo.vines, water: floor.water.material.opacity, swirls: floor.congo.swirls, far: reliquia.view.camera.far };
  });
  const [ha, hb] = [await scene(a), await scene(b)];
  assert.deepEqual(ha, hb); assert.deepEqual(ha.solids, deal.solids); check('host and guest deal the same channels and the same dressing');
  assert.equal(ha.water, 1); assert.ok(ha.vines.sheets > ha.vines.solids); assert.ok(ha.swirls >= 1); assert.ok(ha.far < 35, `the fog closes the view: ${ha.far}`); check('opaque water, vine curtains, the whirlpool, dense fog');
  // A boat under you and under your pana; the eye sits low over the water.
  await waitFor(a, () => reliquia.view.congo.ownBoat.visible && reliquia.view.congo.eyeDrop > .4);
  const low = await a.evaluate(() => { const v = reliquia.view; return { eye: v.camera.position.y, hull: v.avatars.get(reliquia.state.players.find(p => p.id !== reliquia.room.id).id)?.hull?.visible }; });
  assert.ok(low.eye < 1.1, `eye at ${low.eye}`); assert.equal(low.hull, true); check('everyone sits in a boat, low over the water');
  await a.evaluate(d => { reliquia.place(d.id, d.lane.x, d.lane.z, d.horizontal ? Math.PI / 2 : Math.PI); reliquia.face(d.horizontal ? Math.PI / 2 : Math.PI, -.02); reliquia.place(d.guest, d.lane.x - (d.horizontal ? 2.5 : 0), d.lane.z + (d.horizontal ? 0 : 2.5)); }, deal);
  await waitFor(a, d => Math.hypot(reliquia.me.x - d.lane.x, reliquia.me.z - d.lane.z) < .5, deal); await ticks(a, .5);
  await shot(a, 'corridors');
  check('a corridor between vine walls');

  // Heard first: far off, its footfalls reach the guest's screen with the monster out of the fog.
  const cues = await b.evaluate(() => { window.cues = []; const before = reliquia.view.onFx; reliquia.view.onFx = e => { if (e.type === 'mokele') window.cues.push(e.sound); before?.(e); }; return true; });
  assert.ok(cues);
  const spawned = await a.evaluate(d => {
    const g = reliquia.room.game, me = g.players.find(p => p.id === d.id), h = me.h, e = reliquia.spawn('mokele', 0, 0);
    if (!e) return null; const boss = g.enemies.find(q => q.id === e.id);
    // Far past the fog but well within earshot, stood still by a long stun: only its sound reaches anyone.
    let away = 42; while (g.layout.overPit(me.x + Math.sin(h) * away, me.z + Math.cos(h) * away)) away += 1;
    Object.assign(boss, { x: me.x + Math.sin(h) * away, z: me.z + Math.cos(h) * away, mode: 'wander', stun: 1e4, immune: 1e4, stalkIn: 1e4, born: -9 });
    return { id: boss.id, d: Math.hypot(boss.x - me.x, boss.z - me.z) };
  }, deal);
  assert.ok(spawned, 'the Mokele spawns'); assert.ok(spawned.d > 30, `${spawned.d} m away`);
  await waitFor(b, id => reliquia.state.enemies.some(e => e.id === id && e.kind === 'mokele'), spawned.id);
  await waitFor(b, id => reliquia.view.congo?.bosses.get(id)?.stage === 'heard', spawned.id);
  // (The debug spawn publishes once beside the host before it is sent away: only what comes after counts.)
  await b.evaluate(() => { window.cues.length = 0; });
  await waitFor(b, () => window.cues.includes('footfall') || window.cues.includes('wake'));
  assert.ok(!(await b.evaluate(() => window.cues.includes('bellow'))), 'no call yet: it has not been seen'); check('the guest hears it long before it can be seen');

  // A shape in the mist: well inside the fog, high above the vines, on the guest's screen too.
  const place = (dist, extra, side = 0, page = a) => page.evaluate(({ dist, extra, side, id, me }) => {
    const g = reliquia.room.game, p = g.players.find(q => q.id === me), boss = g.enemies.find(q => q.id === id), s = Math.sin(p.h), c = Math.cos(p.h);
    // Not over the whirlpool: that would be the end of it.
    while (g.layout.overPit(p.x + s * dist, p.z + c * dist)) dist += 1;
    Object.assign(boss, { x: p.x + s * dist - c * side, z: p.z + c * dist + s * side, h: Math.atan2(-s, -c), stun: 1e4, immune: 1e4, stalkIn: 1e4, windup: 0, peek: null, ...extra });
  }, { dist, extra, side, id: spawned.id, me: deal.id });
  await a.evaluate(() => reliquia.face(reliquia.view.heading, .2));
  await place(22, { mode: 'wander' }, 3);   // Through the gap past the next knee of vines.
  await waitFor(a, id => reliquia.view.congo?.bosses.get(id)?.stage === 'shape', spawned.id);
  await waitFor(a, id => reliquia.view.enemies.get(id)?.model.userData.assetId === 'el-mokele', spawned.id); await ticks(a, .7);
  const up = await a.evaluate(id => { const m = reliquia.view.enemies.get(id).model; let head = 0; m.traverse(o => { if (o.isInstancedMesh) { const e = o.instanceMatrix.array; head = Math.max(head, e[(o.count - 1) * 16 + 13]); } }); return head; }, spawned.id);
  assert.ok(up > 8, `its neck stands ${up} m over the water`);
  await shot(a, 'silhouette');
  check(`a shape in the fog, its neck ${up.toFixed(1)} m up`);

  // Teeth: it is after you, a few metres off, and its head is far bigger than it is.
  await a.evaluate(() => reliquia.face(reliquia.view.heading, -.02));
  await place(4, { mode: 'chase', prey: deal.id });
  await waitFor(a, id => reliquia.view.congo.bosses.get(id).stage === 'teeth', spawned.id); await ticks(a, 1.1);
  const close = await a.evaluate(id => { const c = reliquia.view.congo.bosses.get(id); let scale = 1; reliquia.view.enemies.get(id).model.traverse(o => { if (o.scale.x > scale) scale = o.scale.x; }); return { teeth: c.teethNow, jaw: c.jaw, scale }; }, spawned.id);
  assert.ok(close.teeth > .7, `teeth ${close.teeth}`); assert.ok(close.jaw > .5, `jaws ${close.jaw}`); assert.ok(close.scale > 1.5, `head scale ${close.scale}`);
  await shot(a, 'teeth');
  check(`close up: jaws ${close.jaw.toFixed(2)}, head ${close.scale.toFixed(2)} times its size`);
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);

  // The host leaves mid-chase: the guest's new host carries on, and the whirlpool takes it.
  await a.context().close();
  await waitFor(b, () => reliquia.room.isHost && reliquia.room.game?.enemies.some(e => e.kind === 'mokele'));
  check('a new host keeps it');
  const seal = await b.evaluate(() => {
    const g = reliquia.room.game, room = g.layout.run.rooms.find(r => r.kind === 'puente'), pit = g.layout.run.pits.find(q => q.room === room.id), p = g.players.find(q => !q.held), e = g.enemies.find(q => q.kind === 'mokele');
    g.enemies = [e]; g.director.duration = 1e6; Object.assign(p, { invulnerable: 1e6, stun: 0, exposed: 0, downed: false, hp: 100, hidden: null });
    const wx = pit.rect[0] - 1.4, ex = pit.rect[2] + 1.4, inNook = (x, z) => g.layout.run.nooks.some(n => x > n.rect[0] - .3 && x < n.rect[2] + .3 && z > n.rect[1] - .3 && z < n.rect[3] + .3);
    const z = [0, -2, 2, -4, 4, -1, 1, -3, 3].map(dz => room.z + dz).find(q => !inNook(wx, q) && !inNook(ex, q) && g.layout.walkable(wx, q, g, .72) && g.layout.walkable(ex, q, g, .42) && g.layout.crossable({ x: wx, z: q }, { x: ex, z: q }, g, .72));
    Object.assign(e, { x: wx, z, mode: 'chase', stun: 0, peek: null, immune: 0, windup: 0, stalkIn: 1e4, prey: p.id }); Object.assign(p, { x: ex, z });
    return g.layout.run.seals[0]?.id ?? null;
  });
  await waitFor(b, () => !reliquia.state.enemies.some(e => e.kind === 'mokele'));
  if (seal) await waitFor(b, id => reliquia.state.open[id] === 1, seal);
  check('chased across the whirlpool it is gone, and the seal opens');
  assert.deepEqual(b.errors, []); check('no page errors');

  // The library keeps its own lamp and its roof, with nothing of the Congo.
  const c = await open('Lia', `${room}-lib`);
  await c.evaluate(() => reliquia.room.action('configure', { options: { place: 'biblioteca' } }));
  await c.locator('#start').click(); await waitFor(c, () => reliquia.state.phase === 'playing');
  await c.evaluate(() => { const g = reliquia.room.game, r = g.layout.run.rooms.find(q => q.index === 0); g.lift.floor = 1; g.director.duration = 1e6; for (const p of g.players) p.invulnerable = 1e6; reliquia.place(reliquia.room.id, r.x, r.z); });
  await waitFor(c, () => reliquia.view.lookName === 'biblioteca' && reliquia.view.world.floors.get(1));
  const clean = await c.evaluate(() => { const f = reliquia.view.world.floors.get(1); return { congo: !!f.congo, view: !!reliquia.view.congo, vines: reliquia.view.world.run.solids.filter(s => s.kind === 'vine').length, cases: !!f.cases?.length, boss: reliquia.view.world.run.sleepers.filter(s => s.kind === 'mokele').length }; });
  assert.deepEqual(clean, { congo: false, view: false, vines: 0, cases: true, boss: 0 }); check('the library has nothing of the Congo');
  assert.deepEqual(c.errors, []);
} finally { await browser.close(); }
