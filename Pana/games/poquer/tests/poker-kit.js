// Shared by the poker browser suites (browser.mjs, seats.browser.mjs,
// mobile.browser.mjs): real panas in their own browser contexts, in ?untimed
// debug rooms, on the cheapest picture.
//
// Under software WebGL (CI) a table frame costs hundreds of milliseconds and
// blocks the page, so every Playwright call waits about one frame. Shadows off
// and 75 % resolution cut that frame; the suites stay split so each one fits
// the runner's per-suite limit with every check kept.
import assert from 'node:assert/strict';
import { launch, base, qaDir } from '../../../tests/browser-kit.js';

export function pokerSuite(metaUrl) {
  const errors = [], out = qaDir(metaUrl), browserReady = launch();
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 60000 });
  // context: an earlier page's, to come back from the same device (its localStorage).
  async function open(name, room, mobile = false, context = null) {
    const browser = await browserReady;
    context ??= await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await context.addInitScript(name => {
      localStorage.setItem('pana:name', name);
      localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja', shadows: 'off', resolution: .75, autoScale: false }));
      localStorage.setItem('pana:avatar', JSON.stringify({ outfit: 'hoodie', outfitColor: '#3775cc', hat: 'gorra' }));
    }, name);
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    // ?untimed (debug rooms only): the clock never plays a human's turn or
    // cacho, so a slow software-rendered screen is never overtaken between two checks.
    await p.goto(`${base}/g/poquer/?room=${room}&debug&untimed`, { waitUntil: 'domcontentloaded' });
    await wait(p, () => window.poquerDebug?.room.connected && poquerDebug.room.id); return p;
  }
  // Both screens on the same revision, board, pot and turn. Either one may
  // still be a message behind (a page busy drawing a frame reads it late), so
  // each waits for the newest revision the other has, never for an older one.
  async function same(a, b) {
    let state = await a.evaluate(() => poquerDebug.room.state);
    await wait(b, revision => poquerDebug.room.state.revision >= revision, state.revision);
    const other = await b.evaluate(() => poquerDebug.room.state);
    if (other.revision > state.revision) {
      await wait(a, revision => poquerDebug.room.state.revision >= revision, other.revision);
      state = await a.evaluate(() => poquerDebug.room.state);
    }
    assert.equal(other.revision, state.revision);
    assert.deepEqual(other.board, state.board); assert.equal(other.pot, state.pot); assert.equal(other.turn, state.turn);
  }
  // The deal and the cachos can hold the buttons after the turn arrives: wait
  // until it is this pana's turn and the button is live, never assume it.
  async function act(p, selector) {
    await wait(p, sel => poquerDebug.room.state.turn === poquerDebug.room.id && !document.querySelector(sel)?.disabled, selector);
    const rev = await p.evaluate(() => poquerDebug.room.state.revision); await p.locator(selector).click(); await wait(p, rev => poquerDebug.room.state.revision > rev, rev);
  }
  const close = async () => (await browserReady).close();
  return { errors, out, wait, open, same, act, close };
}
