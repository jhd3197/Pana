// Capis with friends, two real clients in one room: the invite link shows the
// room's code, the guest arrives straight from the ?room= link on the other
// team, the host's map reaches the guest, both play a turn (the guest with its
// own keys) and each sees the other's shot land on the same ground.
// Run: npm run test:browser -- capis
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `capis-${Date.now()}`;
try {
  const host = await openGame(browser, 'capis', { name: 'Ana', room, query: 'debug' });
  await waitFor(host, () => capisDebug.online && capisDebug.room.isHost && capisDebug.room.connected);
  const guest = await openGame(browser, 'capis', { name: 'Beto', room, query: 'debug' });
  await waitFor(guest, () => capisDebug.room.connected && capisDebug.room.state.players.length === 2);
  assert.equal(await guest.evaluate(() => capisDebug.room.isHost), false);
  assert.deepEqual(await guest.evaluate(() => capisDebug.room.state.players.map(p => [p.name, p.team])), [['Ana', 0], ['Beto', 1]]);
  // The shared lobby: the room code, a copy-link button, no Con amigos button once in a room.
  assert.equal((await host.locator('.pk-game-lobby-code').textContent()).trim(), room.toUpperCase());
  assert.equal(await host.locator('#pana-lobby-invite').isDisabled(), false);
  assert.equal(await guest.locator('#online').isHidden(), true);
  assert.equal(await guest.locator('#start').isDisabled(), true, 'only the host starts');

  // The host picks a small map; the guest's lobby shows the same one.
  await host.evaluate(() => { document.querySelector('[data-room-option="size"][data-value="small"]').click(); capisDebug.room.action('seed', { seed: 6 }); });
  await waitFor(guest, () => capisDebug.match.map.seed === 6 && capisDebug.match.map.size === 'small');
  await host.locator('#start').click();
  await waitFor(guest, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.room.state.controller === capisDebug.room.state.players[0].id);

  // Ana's turn: she fires; Beto sees the shell fly and the ground change.
  await host.evaluate(() => capisDebug.room.action('fire', { power: .8, aim: .6, face: 1 }));
  await waitFor(guest, () => capisDebug.room.state.events.some(e => e.type === 'fire' && e.team === 0));
  await waitFor(guest, () => capisDebug.room.state.controller === capisDebug.room.id && capisDebug.match.phase === 'aim', null, 90_000);
  const edits = await host.evaluate(() => capisDebug.match.edits.length);
  assert.equal(await guest.evaluate(() => capisDebug.match.edits.length), edits, 'the guest replayed every crater');

  // Beto's turn, with his own keys: walk left, then hold Space and let go.
  await guest.bringToFront();
  const capi = () => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy).x; };
  const from = await host.evaluate(capi);
  await guest.keyboard.down('a');
  await waitFor(host, x => { const m = capisDebug.match; return m.capys.find(c => c.id === m.turn.capy).x < x - .5; }, from);
  await guest.keyboard.up('a');
  await guest.keyboard.down(' ');
  await waitFor(guest, () => !document.getElementById('power-bar').hidden);
  // The meter swings up and down every two seconds and repaints once a frame; a slow
  // software-GL frame can keep landing on the low side, so sample it on the clock.
  await guest.waitForFunction(() => capisDebug.charge.update() >= .4 && parseInt(document.getElementById('power-value').textContent) >= 40, null, { timeout: 30_000, polling: 30 }).catch(async e => {
    console.log('DIAG', await guest.evaluate(() => ({ hidden: document.hidden, bar: document.getElementById('power-bar').hidden, text: document.getElementById('power-value').textContent, phase: capisDebug.match.phase, ctl: capisDebug.room.state.controller, id: capisDebug.room.id, playing: capisDebug.playing })));
    throw e; });
  await guest.keyboard.up(' ');
  await waitFor(host, () => capisDebug.room.state.events.some(e => e.type === 'fire' && e.team === 1));
  await waitFor(host, () => capisDebug.match.turn.team === 0 && capisDebug.match.phase === 'aim', null, 90_000);
  await waitFor(guest, () => capisDebug.match.turn.team === 0 && capisDebug.match.phase === 'aim');
  const ground = page => page.evaluate(() => { const m = capisDebug.match.mask; let h = 0; for (let i = 0; i < m.solid.length; i++) h = (h * 31 + m.solid[i] * 7 + m.stain[i]) >>> 0; return [capisDebug.match.edits.length, h]; });
  const [a, b] = [await ground(host), await ground(guest)];
  assert.ok(a[0] > edits || a[0] >= 1, 'the shots changed the ground');
  assert.deepEqual(b, a, 'both screens show the same ground');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS capis online: room link, host settings, a turn each (guest by keys), the same craters on both screens.');
  await host.context().close(); await guest.context().close();

  // Todos contra todos in a room: each pana its own capi, the machine plays the rest, the same six at the same spots on
  // both screens, a crate coming down reaches both, and a capi out leaves its tombstone on both.
  const code = `capis-ffa-${Date.now()}`, ana = await openGame(browser, 'capis', { name: 'Ana', room: code, query: 'debug' });
  await waitFor(ana, () => capisDebug.online && capisDebug.room.isHost && capisDebug.room.connected);
  const beto = await openGame(browser, 'capis', { name: 'Beto', room: code, query: 'debug' });
  await waitFor(beto, () => capisDebug.room.connected && capisDebug.room.state.players.length === 2);
  await ana.evaluate(() => { document.querySelector('[data-room-option="mode"][data-value="ffa"]').click(); capisDebug.room.action('seed', { seed: 6 }); });
  await waitFor(beto, () => capisDebug.room.state.options.mode === 'ffa' && capisDebug.match.mode === 'ffa' && capisDebug.match.map.seed === 6 && capisDebug.match.map.size === 'large');
  assert.deepEqual(await beto.evaluate(() => capisDebug.room.state.players.map(p => [p.name, p.team])), [['Ana', 0], ['Beto', 1]], 'one capi each');
  assert.equal(await ana.locator('#capis-roster').isHidden(), true, 'no team cards');
  await ana.locator('#start').click();
  // The setup comes first (setup.browser.js covers it); the host starts at once.
  await waitFor(beto, () => capisDebug.inSetup);
  await ana.locator('#setup-go').click();
  await waitFor(beto, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.teams === 6);
  const six = page => page.evaluate(() => capisDebug.match.capys.map(c => [c.id, c.team, +c.x.toFixed(1)]));
  assert.deepEqual(await six(beto), await six(ana), 'the same six capis at the same spots');
  // Ana, then Beto, then the machine: the turn goes round the sides.
  await ana.evaluate(() => capisDebug.room.action('fire', { power: .7, aim: .9, face: 1 }));
  await waitFor(beto, () => capisDebug.room.state.controller === capisDebug.room.id && capisDebug.match.turn.team === 1 && capisDebug.match.phase === 'aim', null, 120_000);
  await beto.evaluate(() => capisDebug.room.action('fire', { power: .7, aim: .9, face: -1 }));
  await waitFor(ana, () => capisDebug.match.turn.team === 2 && capisDebug.match.phase === 'aim' && capisDebug.room.state.controller == null, null, 120_000);
  await waitFor(beto, () => capisDebug.match.turn.team === 2 && capisDebug.match.crates.length > 0, null, 60_000);
  const crate = page => page.evaluate(() => capisDebug.match.crates.map(k => [k.id, +k.x.toFixed(1), k.weapon]));
  assert.deepEqual(await crate(beto), await crate(ana), 'the crate on turn 3 reaches both');
  const eliminated = await ana.evaluate(async () => {
    const m = capisDebug.match, c = m.capys.find(k => k.team === 1), { explode } = await import('/g/capis/rules.js');
    c.paint = 99; explode(m, c.x, c.y + .6, 2, 'grenade');
    return { id: c.id, out: c.out, tomb: m.tombs.some(t => t.id === c.id) };
  });
  assert.equal(eliminated.out, 'paint', 'the host eliminates the intended capi');
  assert.equal(eliminated.tomb, true, 'the host creates its tombstone');
  // Another capi can already be out on an authored map. Check this capi's
  // replicated tombstone rather than assuming it is the only one in the match.
  await waitFor(beto, id => capisDebug.match.tombs.some(t => t.id === id) && capisDebug.match.capys.find(c => c.id === id).out === 'paint', eliminated.id);
  assert.deepEqual([...ana.errors, ...beto.errors], []);
  console.log('PASS capis online: todos contra todos, a capi per pana, the machine plays the rest, crates and tombstones on both screens.');
} finally { await browser.close(); }
