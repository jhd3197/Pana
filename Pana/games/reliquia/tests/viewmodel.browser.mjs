// Your hands in the real game: gloves and sleeves on show with nothing held, each
// tool in the fist, loot on the palm, a blow, the hiding rules and a portrait screen.
// PANA_VIEWMODEL_SHOTS=<folder> saves the views (viewmodel-<PANA_VIEWMODEL_TAG>-fosa-*.png).
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const shots = process.env.PANA_VIEWMODEL_SHOTS, tag = process.env.PANA_VIEWMODEL_TAG || 'after', check = text => console.log(`ok  ${text}`);
const frames = (page, n = 8) => page.evaluate(n => new Promise(r => { const f = () => --n <= 0 ? r() : requestAnimationFrame(f); f(); }), n);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, `viewmodel-${tag}-fosa-${name}.png`) }); };
const browser = await launch();
const start = async (name, mobile = false) => {
  const page = await openGame(browser, 'reliquia', { name, mobile, room: `fosa-hands-${name}-${Date.now().toString(36)}`, query: 'debug' });
  page.setDefaultTimeout(90_000);
  await waitFor(page, () => window.reliquia?.room.connected && reliquia.room.isHost);
  // The lobby holds the start until this client's assets are ready, so press until it goes.
  await waitFor(page, () => { if (reliquia.state.phase === 'playing') return true; document.getElementById('start').click(); return false; });
  return page;
};
const edit = (page, fields) => page.evaluate(fields => { const p = reliquia.room.game.players.find(p => p.id === reliquia.room.id); Object.assign(p, fields); reliquia.room.publish(); }, fields);
const give = (page, right, left = null) => edit(page, { hands: [right && { id: 9001, kind: right, worth: 1 }, left && { id: 9002, kind: left, worth: 1 }] });
// What the hands show right now, read from the rig.
const read = page => page.evaluate(() => reliquia.view.hands.hands.map(({ rig, key }) => ({ key, grip: rig.grip, visible: rig.visible, items: rig.slot.children.length, x: rig.hand.position.x, rx: rig.hand.rotation.x, sleeve: `#${rig.arm.children[0].material.color.getHexString()}` })));
const onScreen = page => page.evaluate(async () => { const THREE = await import('three'), { camera } = reliquia.view; return reliquia.view.hands.hands.map(({ rig }) => { const p = new THREE.Vector3(); rig.hand.getWorldPosition(p); p.project(camera); return { x: p.x, y: p.y }; }); });
try {
  const page = await start('Juan');
  await give(page, null); await frames(page);
  const empty = await read(page);
  assert.deepEqual(empty.map(h => [h.grip, h.visible, h.items]), [['open', true, 0], ['open', true, 0]], 'two open gloves with nothing held');
  assert.ok(empty[0].x > 0 && empty[1].x < 0, 'one on each side');
  for (const p of await onScreen(page)) assert.ok(Math.abs(p.x) < 1 && p.y > -1 && p.y < 0, `the empty hand is in view and low: ${JSON.stringify(p)}`);
  await shot(page, 'empty');
  check('empty hands rest in view');

  for (const kind of ['machete', 'farol', 'bengala', 'cuerda', 'botiquin', 'marcadora', 'honda']) {
    await give(page, kind);
    await waitFor(page, kind => reliquia.view.hands.hands[0].key.includes(`:${kind}:`) && reliquia.view.hands.hands[0].motion.swap === 0, kind);
    await frames(page, 3);
    const [right, left] = await read(page);
    assert.deepEqual([right.grip, right.items, left.grip, left.items], ['fist', 1, 'open', 0], kind);
    await shot(page, kind);
  }
  check('each tool sits in the right fist, the left stays open');

  await give(page, 'idol', 'machete'); await frames(page);
  const [palm, fist] = await read(page);
  assert.deepEqual([palm.grip, palm.items, fist.grip, fist.items], ['cup', 1, 'fist', 1]);
  assert.ok(fist.x < 0, 'the left hand holds on the left');
  await shot(page, 'two-hands');
  check('loot sits on a palm, and either hand holds');

  // A blow: the rules' swing countdown going up plays the chop on that hand.
  await give(page, 'machete');
  await waitFor(page, () => reliquia.view.hands.hands[0].motion.swap === 0); await frames(page, 3);
  const rest = (await read(page))[0].rx;
  let moved = 0;
  for (let i = 0; i < 6 && moved < .3; i++) {
    await edit(page, { swing: .3, swingHand: 0 });
    moved = Math.max(moved, await page.evaluate(rest => new Promise(done => { let most = 0, n = 12; const f = () => { most = Math.max(most, Math.abs(reliquia.view.hands.hands[0].rig.hand.rotation.x - rest)); --n <= 0 ? done(most) : requestAnimationFrame(f); }; f(); }), rest));
  }
  assert.ok(moved >= .3, `the chop moves the hand: ${moved}`);
  await waitFor(page, () => reliquia.view.hands.hands[0].motion.since < 0 && reliquia.me.swing === 0); await frames(page, 3);
  assert.ok(Math.abs((await read(page))[0].rx - rest) < .08, 'and it comes back to rest');
  check('using the item swings it and it settles');

  // Gripping or pushing a treasure and going down hide both, as the paws did.
  for (const fields of [{ grip: 1 }, { grip: null, push: 1 }, { push: null, downed: true }]) {
    await edit(page, fields);
    await waitFor(page, () => reliquia.view.hands.hands.every(h => !h.rig.visible));
  }
  await edit(page, { downed: false, hp: 100 });
  await waitFor(page, () => reliquia.view.hands.hands.every(h => h.rig.visible));
  check('both hands hide on a grip, a push and when down, and come back');

  // The sleeve is your suit's colour.
  const suit = await page.evaluate(async () => { const { seatColor } = await import('/g/reliquia/suit-look.js'); const { Color } = await import('three'); return `#${new Color(seatColor(reliquia.me.seat)).getHexString()}`; });
  assert.deepEqual((await read(page)).map(h => h.sleeve), [suit, suit]);
  check('the sleeves wear the suit');

  // Underground: the gloves still read by the headlamp, the farol lights the room.
  await page.evaluate(() => { const g = reliquia.room.game, p = g.players.find(p => p.id === reliquia.room.id), s = g.layout.run.lifts.find(l => l.floor === 1); Object.assign(p, { x: s.x, z: s.z - 5, h: Math.PI }); reliquia.room.publish(); reliquia.face(Math.PI, 0); });
  await give(page, 'farol', 'machete');
  await waitFor(page, () => reliquia.view.look !== 'camp'); await frames(page);
  await shot(page, 'deep');
  await give(page, null); await frames(page);
  await shot(page, 'deep-empty');
  assert.deepEqual(page.errors, []);
  check('no errors in the real loop');

  // Portrait: the hands come in so they stay on a narrow screen.
  const phone = await start('Ana', true);
  await give(phone, 'machete', 'farol'); await frames(phone);
  for (const p of await onScreen(phone)) assert.ok(Math.abs(p.x) < 1, `on a portrait screen: ${JSON.stringify(p)}`);
  await shot(phone, 'portrait');
  assert.deepEqual(phone.errors, []);
  check('portrait keeps both hands on screen');
} finally { await browser.close(); }
