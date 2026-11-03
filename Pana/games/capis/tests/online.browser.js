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
  await guest.waitForFunction(() => parseInt(document.getElementById('power-value').textContent) >= 40, null, { timeout: 30_000, polling: 30 }).catch(async e => {
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
} finally { await browser.close(); }
