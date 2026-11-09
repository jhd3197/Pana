// A phone practising with bots: the cachos by touch, the shared pause, the
// action buttons inside the screen and the landscape layout.
import assert from 'node:assert/strict';
import { pokerSuite } from './poker-kit.js';
const { errors, out, wait, open, close } = pokerSuite(import.meta.url), code = `poker-mobile-${Date.now()}`;
try {
  const m = await open('Móvil', code, true); await m.screenshot({ path: `${out}/mobile-lobby.png` });
  // Practice opens with the cachos too: a finger on the table shakes, lifting it slams.
  await m.locator('#practice').tap(); await m.locator('#pana-starter-shake').waitFor();
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await m.screenshot({ path: `${out}/mobile-starter.png` });
  await m.locator('#world').tap(); await wait(m, () => 0 in (poquerDebug.room.state.starter?.slammed || { 0: 1 }));
  await wait(m, () => poquerDebug.room.local && poquerDebug.room.state.hand === 1);
  await m.locator('#menu').tap(); const revision = await m.evaluate(() => poquerDebug.room.state.revision); await m.waitForTimeout(1400); assert.equal(await m.evaluate(() => poquerDebug.room.state.revision), revision);
  await m.locator('#pana-resume').tap(); await wait(m, () => !!poquerDebug.room.state.legal);
  await m.screenshot({ path: `${out}/mobile-playing.png` }); assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const id of ['fold', 'call', 'raise']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391); assert.ok(box.y + box.height <= 844); }
  await m.locator('#call').tap(); await m.setViewportSize({ width: 844, height: 390 }); await m.screenshot({ path: `${out}/mobile-landscape.png` });
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('ok: mobile cards/actions, shared pause, bot practice and landscape layout');
  assert.deepEqual(errors, []); console.log('Poker mobile proof passed.');
} finally { await close(); }
