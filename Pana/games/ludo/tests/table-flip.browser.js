import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';
import { proveFlip } from '../../../tests/table-flip-kit.js';

// Voltear la mesa: the other pana sees it, and no game state moves.
const browser = await launch(), code = `ludo-flip-${Date.now()}`, qa = qaDir(import.meta.url);
try {
  const a = await openGame(browser, 'ludo', { room: code, name: 'Juan', query: 'debug' });
  await waitFor(a, () => ludoDebug.room.isHost && !!ludoDebug.world);
  const b = await openGame(browser, 'ludo', { room: code, name: 'Ana', query: 'debug' });
  await waitFor(a, () => ludoDebug.room.members.size === 2);
  await waitFor(b, () => ludoDebug.room.seat === 1 && !!ludoDebug.world);
  await a.evaluate(() => ludoDebug.room.action('options', { options: { ...ludoDebug.room.state.options, starter: 'anfitrion', turnSeconds: 0 } }));
  await waitFor(b, () => ludoDebug.room.state.options.starter === 'anfitrion');
  await a.evaluate(() => ludoDebug.room.action('start'));
  for (const page of [a, b]) await waitFor(page, () => ludoDebug.room.state.phase === 'playing');
  const turn = await a.evaluate(() => ludoDebug.room.state.turn), [flipper, watcher] = turn === 0 ? [a, b] : [b, a];
  await waitFor(flipper, () => !document.querySelector('#flip').disabled);
  await proveFlip(flipper, watcher, 'ludoDebug', { shot: path.join(qa, 'flip.jpg') });
  assert.deepEqual([...a.errors, ...b.errors], []);
  console.log('Ludo table flip passed');
} finally { await browser.close(); }
