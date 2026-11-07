import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';
import { proveFlip } from '../../../tests/table-flip-kit.js';

// Voltear la mesa: the guest sees the host's flip, and no game state moves.
const browser = await launch(), code = `caida-flip-${Date.now()}`, qa = qaDir(import.meta.url);
const clients = [];
try {
  const a = await openGame(browser, 'caida', { room: code, name: 'Ana', query: 'debug' }); clients.push(a);
  await waitFor(a, () => caidaDebug.room.isHost && !!caidaDebug.world);
  const b = await openGame(browser, 'caida', { room: code, name: 'Beto', query: 'debug' }); clients.push(b);
  await waitFor(a, () => caidaDebug.room.members.size === 2);
  await waitFor(b, () => caidaDebug.room.seat === 1 && !!caidaDebug.world);
  await a.locator('#pana-room-more').click();
  await a.locator('[data-room-option="starter"][data-value="anfitrion"]').click();
  await a.locator('#pana-room-done').click();
  await a.locator('#start').click();
  await waitFor(b, () => caidaDebug.room.state.phase === 'dealing');
  await a.evaluate(() => { caidaDebug.room.action('cut', { at: 7 }); caidaDebug.room.action('call', { call: 'up' }); caidaDebug.room.action('deal'); });
  for (const page of [a, b]) await waitFor(page, () => caidaDebug.room.state.phase === 'playing');
  const turn = await a.evaluate(() => caidaDebug.room.state.turn), [flipper, watcher] = turn === 0 ? [a, b] : [b, a];
  await waitFor(flipper, () => !document.querySelector('#flip').disabled);
  await proveFlip(flipper, watcher, 'caidaDebug', { shot: path.join(qa, 'flip.jpg') });
  assert.deepEqual([...a.errors, ...b.errors], []);
  console.log('Caída table flip passed');
} finally { await browser.close(); }
