// The mine's own look in the real loop, over a real room with two panas: both deal
// the same narrow drifts and see the same black water and timber, the lamp narrows
// and tightens with depth, and a host on the library keeps the library's lamp and
// none of it. Waits on state only.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-mina-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async (name, code = room) => { const p = await openGame(browser, 'reliquia', { name, room: code, query: 'debug' }); p.setDefaultTimeout(120_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const lamp = page => page.evaluate(() => { const l = reliquia.view.camera.children.find(c => c.isSpotLight); return { angle: l.angle, reach: l.distance, look: reliquia.view.lookName }; });
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'mina' } }));
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  // A deal with a flooded shaft, a sump and a machinery gallery, dealt to both.
  const deal = await a.evaluate(async () => {
    const { generateRun } = await import('/g/reliquia/deck.js'), g = reliquia.room.game;
    let seed = 1; for (; seed < 2000; seed++) { const k = generateRun(seed, { depth: 1, theme: 'mina' }).rooms.map(r => r.kind); if (k.includes('pozo') && k.includes('galeria') && k.includes('puente')) break; }
    g.start(seed); for (const r of g.layout.run.rooms) g.woke[r.id] = 1; g.director.duration = 1e6; g.sucesoIn = 1e6; g.lift.floor = 1; g.deepest = 1;
    for (const p of g.players) p.invulnerable = 1e6;
    reliquia.room.publish();
    const run = g.layout.run, galeria = run.rooms.find(r => r.kind === 'galeria');
    return { seed, galeria: { x: galeria.x, z: galeria.z }, a: reliquia.room.id, b: g.players.find(p => p.id !== reliquia.room.id).id, corridors: run.corridors.map(c => c.rect) };
  });
  await waitFor(b, seed => reliquia.state.seed === seed, deal.seed);
  // Both go down: each client builds the floor on arrival.
  await a.evaluate(({ a, b, galeria }) => { reliquia.place(a, galeria.x, galeria.z); reliquia.place(b, galeria.x, galeria.z + 1.2); }, deal);
  for (const page of [a, b]) await waitFor(page, () => reliquia.view.world.floors.get(1)?.drips && reliquia.view.lookName === 'mina');
  const scene = page => page.evaluate(() => {
    const floor = reliquia.view.world.floors.get(1), run = reliquia.view.world.run;
    return { corridors: run.corridors.map(c => c.rect), machines: floor.machines.length, pools: floor.pools.map(p => p.material.opacity), crawlers: floor.crawlers.count };
  });
  const [ha, hb] = [await scene(a), await scene(b)];
  assert.deepEqual(ha.corridors, deal.corridors); assert.deepEqual(hb, ha); check('host and guest deal the same drifts and the same dressing');
  assert.ok(ha.machines >= 1, 'a hoist turning in the gallery'); check('the gallery has its hoist');
  assert.ok(ha.pools.length >= 2 && ha.pools.every(o => o === 1), `every shaft's water is opaque: ${ha.pools}`); check('every shaft has opaque black water');
  assert.ok(ha.crawlers > 0); check('crawlers on the timber');
  // The flywheel really moves in the loop.
  const spin = () => a.evaluate(() => reliquia.view.world.floors.get(1).machines[0].children.at(-1).rotation.z);
  const before = await spin(); await waitFor(a, r => reliquia.view.world.floors.get(1).machines[0].children.at(-1).rotation.z !== r, before); check('the hoist turns');
  // A crawler runs off its beam when you stand under it with a lit farol.
  await a.evaluate(({ id }) => { const g = reliquia.room.game, p = g.players.find(q => q.id === id); p.hands[0] = { id: 9101, kind: 'farol' }; reliquia.room.publish(); }, { id: deal.a });
  const beam = await a.evaluate(() => { const { x, z } = reliquia.view.world.floors.get(1).crawlers.userData.bugs.find(q => q.b.length < 3).b; return { x, z }; });
  await a.evaluate(({ id, x, z }) => reliquia.place(id, x, z), { id: deal.a, ...beam });
  await waitFor(a, () => reliquia.view.world.floors.get(1).crawlers.userData.bugs.some(q => q.away > 0)); check('a lit farol sends the crawlers off their beam');
  const shallow = await lamp(a); assert.ok(shallow.angle < .44 && shallow.reach < 24, JSON.stringify(shallow)); check(`the mine's lamp is a narrow cone (${shallow.angle})`);
  // Deeper down it tightens and the rock goes dark.
  await a.evaluate(() => reliquia.jornada(3));
  await waitFor(a, () => reliquia.state.level === 3 && reliquia.view.world.run.depth === 3);
  await a.evaluate(({ id }) => { const g = reliquia.room.game, r = g.layout.run.rooms.find(q => q.index === 0); g.lift.floor = 1; reliquia.place(id, r.x, r.z); }, { id: deal.a });
  await waitFor(a, () => reliquia.view.lookName === 'minaHonda');
  const deep = await lamp(a); assert.ok(deep.angle < shallow.angle && deep.reach < shallow.reach, JSON.stringify(deep)); check(`and tighter on the deep levels (${deep.angle})`);
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);

  // The library keeps its own lamp, and none of the mine.
  const c = await open('Lia', `${room}-lib`);
  await c.evaluate(() => reliquia.room.action('configure', { options: { place: 'biblioteca' } }));
  await c.locator('#start').click(); await waitFor(c, () => reliquia.state.phase === 'playing');
  await c.evaluate(() => { const g = reliquia.room.game, r = g.layout.run.rooms.find(q => q.index === 0); g.lift.floor = 1; g.director.duration = 1e6; for (const p of g.players) p.invulnerable = 1e6; reliquia.place(reliquia.room.id, r.x, r.z); });
  await waitFor(c, () => reliquia.view.lookName === 'biblioteca' && reliquia.view.world.floors.get(1));
  const library = await lamp(c); assert.equal(library.angle, .44); assert.equal(library.reach, 24);
  const clean = await c.evaluate(() => { const f = reliquia.view.world.floors.get(1); return { drips: !!f.drips, crawlers: !!f.crawlers, machines: f.machines.length, pools: (f.pools || []).length, hasCases: !!f.cases?.length }; });
  assert.deepEqual(clean, { drips: false, crawlers: false, machines: 0, pools: 0, hasCases: true }); check('the library keeps its lamp and its shelves, with nothing of the mine');
  assert.deepEqual(c.errors, []); check('no page errors');
} finally { await browser.close(); }
