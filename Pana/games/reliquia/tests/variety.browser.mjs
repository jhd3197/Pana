// Two real clients through the variety pass: a guest climbs down a rope with E, the
// host ties a rope bridge the guest then sees, and a suceso and a thrown flare reach
// both screens. Layouts come from a seed found in the page; everything after that
// goes through the normal keys and the normal room.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-var-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'mina' } }));
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');

  // A deal with a hanging rope and a broken bridge, dealt to both.
  const deal = await a.evaluate(async () => {
    const { generateRun } = await import('/g/reliquia/deck.js'), g = reliquia.room.game;
    let seed = 1; for (; seed < 2000; seed++) { const run = generateRun(seed, { depth: 1, theme: 'mina' }); if (run.ropes.some(r => !r.needs) && run.bridges.some(q => q.needs)) break; }
    g.start(seed); for (const r of g.layout.run.rooms) g.woke[r.id] = 1; g.director.duration = 1e6; g.sucesoIn = 1e6; g.lift.floor = 1; g.deepest = 1;
    for (const p of g.players) p.invulnerable = 1e6;
    reliquia.room.publish();
    const run = g.layout.run, span = run.bridges.find(q => q.needs), rope = run.ropes.find(r => !r.needs);
    return { seed, rope: { id: rope.id, x: rope.x, z: rope.z, bz: rope.bz, low: rope.low }, span: { id: span.id, x: span.x, z: span.z, rect: span.rect }, ids: { a: reliquia.room.id, b: g.players.find(p => p.id !== reliquia.room.id).id } };
  });
  await waitFor(b, seed => reliquia.state.seed === seed, deal.seed);
  const stand = (id, x, z) => a.evaluate(({ id, x, z }) => reliquia.place(id, x, z), { id, x, z });
  const aim = (page, at, y) => page.evaluate(({ at, y }) => { const me = reliquia.me; reliquia.face(Math.atan2(at.x - me.x, at.z - me.z), Math.atan2(y - (me.y + 1.45), Math.hypot(at.x - me.x, at.z - me.z))); }, { at, y });
  // Scenery of the floor is built on arrival on each client.
  await stand(deal.ids.b, deal.rope.x, deal.rope.z); await waitFor(b, r => Math.hypot(reliquia.me.x - r.x, reliquia.me.z - r.z) < .5, deal.rope);
  await aim(b, deal.rope, 1);
  await waitFor(b, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'rope');
  await b.keyboard.press('e');
  await waitFor(a, id => reliquia.state.players.find(p => p.id === id).rope, deal.ids.b); check('the guest grabs the rope with E, and the host agrees');
  await waitFor(a, ({ id, low }) => { const p = reliquia.state.players.find(p => p.id === id); return !p.rope && Math.abs(p.y + low) < .2; }, { id: deal.ids.b, low: deal.rope.low });
  await waitFor(b, low => Math.abs(reliquia.me.y + low) < .3, deal.rope.low);
  check('down on the platform on both screens');
  // The guest's own step keeps them at that height: no fight with the host.
  await b.keyboard.down('a'); await waitFor(b, x => Math.abs(reliquia.me.x - x) > .5, deal.rope.x); await b.keyboard.up('a');
  assert.ok(Math.abs(await b.evaluate(() => reliquia.me.y) + deal.rope.low) < .3); check('a guest walks the platform at its own height');

  // The host ties the bridge; the guest's world shows it and its collision opens.
  await a.evaluate(() => { const g = reliquia.room.game, p = g.players.find(q => q.id === reliquia.room.id); p.hands[0] = { id: 9001, kind: 'cuerda' }; reliquia.room.publish(); });
  await stand(deal.ids.a, deal.span.x, deal.span.z); await waitFor(a, s => Math.hypot(reliquia.me.x - s.x, reliquia.me.z - s.z) < .5, deal.span);
  await aim(a, deal.span, .6);
  await waitFor(a, () => reliquia.interaction(reliquia.state, reliquia.me)?.kind === 'tie');
  await a.keyboard.press('e');
  await waitFor(b, id => reliquia.state.strung?.[id] === 1, deal.span.id);
  await waitFor(b, id => reliquia.view.world.floors.get(1)?.spans.get(id)?.visible === true, deal.span.id); check('the host ties the bridge; it appears for the guest');

  // A suceso reaches both; a flare the guest throws burns for the host.
  await a.evaluate(() => reliquia.suceso('apagon'));
  await waitFor(b, () => reliquia.state.suceso?.kind === 'apagon'); check('a blackout reaches the guest');
  await a.evaluate(id => { const p = reliquia.room.game.players.find(q => q.id === id); p.hands[0] = { id: 9002, kind: 'bengala' }; reliquia.room.publish(); }, deal.ids.b);
  await waitFor(b, () => reliquia.me.hands[0]?.kind === 'bengala');
  await b.keyboard.press('v');
  await waitFor(a, () => reliquia.state.flares?.length === 1); await waitFor(b, () => reliquia.state.flares?.length === 1); check('a guest throws a flare, and it burns on both screens');
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []); check('no page errors');
} finally { await browser.close(); }
