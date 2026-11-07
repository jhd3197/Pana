import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';
import { proveFlip } from '../../../tests/table-flip-kit.js';

// Voltear la mesa through Dominó's own server room: relayed on your turn, and
// the room's game never moves.
const browser = await launch(), code = `domino-flip-${Date.now()}`, qa = qaDir(import.meta.url);
try {
  const a = await openGame(browser, 'domino', { room: code, name: 'Juan', query: 'debug' });
  await waitFor(a, () => dominoDebug.room.connected && dominoDebug.world);
  const b = await openGame(browser, 'domino', { room: code, name: 'Ana', query: 'debug' });
  await waitFor(b, () => dominoDebug.room.connected && dominoDebug.world);
  await waitFor(a, () => dominoDebug.room.state.players.filter(p => p.id !== null).length === 2);
  await a.evaluate(() => dominoDebug.room.action('options', { patch: { starter: 'regla' } }));
  await waitFor(b, () => dominoDebug.room.state.options.starter === 'regla');
  await a.evaluate(() => dominoDebug.room.action('start'));
  for (const page of [a, b]) await waitFor(page, () => dominoDebug.room.state.phase === 'playing');
  // Bots may open: whichever pana the turn reaches first flips, and holds it.
  const mine = () => !document.querySelector('#flip').disabled;
  const flipper = await Promise.race([a, b].map(page => waitFor(page, mine).then(() => page)));
  const watcher = flipper === a ? b : a;
  await proveFlip(flipper, watcher, 'dominoDebug', { shot: path.join(qa, 'flip.jpg') });
  assert.deepEqual([...a.errors, ...b.errors], []);
  console.log('Dominó table flip passed');
} finally { await browser.close(); }
