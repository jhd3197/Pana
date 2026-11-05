// Pepazo's minimap with a real room: a rival's dot is hidden until they fire, shows
// on the other client from the room's snapshot, and goes away again.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `minimap-${Date.now()}`, browser = await launch();
const playing = () => { const s = pinturaDebug.room.state; return s.phase === 'playing' && !s.loading && !(s.countdown > 0); };
const shown = id => pinturaDebug.minimap.reveal.amount(id, performance.now() / 1000);
try {
  const a = await openGame(browser, 'pintura', { name: 'Juan', room, query: 'debug' });
  const b = await openGame(browser, 'pintura', { name: 'María', room, query: 'debug' });
  await waitFor(a, () => pinturaDebug.room.connected && pinturaDebug.room.state.players.length === 2);
  await a.evaluate(() => pinturaDebug.room.configure({ bots: 0 }));
  await waitFor(b, () => pinturaDebug.room.state.options.bots === 0);
  await a.locator('#start').click();
  await waitFor(a, playing, null, 120_000); await waitFor(b, playing, null, 120_000);
  const rival = await a.evaluate(() => pinturaDebug.room.state.players.find(p => p.id !== pinturaDebug.room.id).id);
  // Reads the running map, so this client has seen the rival's count by now.
  await waitFor(a, id => pinturaDebug.room.state.players.find(p => p.id === id).loud === 0, rival);
  assert.equal(await a.evaluate(shown, rival), 0, 'hidden while it has not fired');

  // The map is alive: it follows you when you walk and when you turn.
  const picture = () => { const c = document.getElementById('minimap'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 8) h = (h * 31 + d[i]) | 0; return h; };
  const still = await a.evaluate(picture), at = await a.evaluate(() => { const p = pinturaDebug.room.state.players.find(q => q.id === pinturaDebug.room.id); return { x: p.x, z: p.z }; });
  await a.mouse.click(640, 400); await a.keyboard.down('w');
  await waitFor(a, at => { const p = pinturaDebug.room.state.players.find(q => q.id === pinturaDebug.room.id); return Math.hypot(p.x - at.x, p.z - at.z) > 1; }, at);
  await a.keyboard.up('w');
  const walked = await a.evaluate(picture); assert.notEqual(walked, still, 'walking moves the map');
  await a.evaluate(() => pinturaDebug.world.look(1.2, 0));
  await waitFor(a, ({ src, walked }) => eval(src)() !== walked, { src: picture.toString(), walked });

  await b.evaluate(() => { const p = pinturaDebug.room; p.input({ fire: true, ax: 0, az: -1 }); });
  await waitFor(a, id => { const p = pinturaDebug.room.state.players.find(p => p.id === id); return p.loud > 0 && p.fired > 0; }, rival);
  await waitFor(a, shown, rival);
  await b.evaluate(() => pinturaDebug.room.input({ fire: false }));
  await waitFor(a, id => pinturaDebug.minimap.reveal.amount(id, performance.now() / 1000) === 0, rival);
  assert.deepEqual([...a.errors, ...b.errors], []);
  console.log('ok: a rival shows on the other client after a shot, then hides again');
} finally { await browser.close(); }
