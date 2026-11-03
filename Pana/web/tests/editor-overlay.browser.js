// "Editar pana" opens over the page (engine/pana-editor.js): from a game lobby
// the room socket stays open and the seat stays taken however often the
// editor opens, a saved look reaches the other pana in the room, and the
// editor itself opens on every visit (reload, back/forward, the hub).
import assert from 'node:assert/strict';
import { launch, base, waitFor } from '../../tests/browser-kit.js';

const browser = await launch();
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
};
// Counts every socket the page opens and closes, and keeps the room link.
const spy = () => {
  window.__sockets = { open: 0, closed: 0 };
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) { super(...args); window.__sockets.open++; this.addEventListener('close', () => window.__sockets.closed++); }
  };
  document.addEventListener('pana:room-link', e => { window.__link = e.detail; });
};
const frameOf = page => page.frameLocator('dialog.pk-editor-frame iframe');
async function editorReady(page) {
  await page.locator('dialog.pk-editor-frame[open]').waitFor();
  const handle = await page.locator('dialog.pk-editor-frame iframe').elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => window.PANA_PREPARED === true, null, { timeout: 120_000 });
  return frame;
}
const closed = page => page.waitForFunction(() => !document.querySelector('dialog.pk-editor-frame'));

try {
  const room = 'editor-' + Date.now().toString(36);
  const join = async name => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(name => {
      localStorage.setItem('pana:name', name);
      localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'baja', autoScale: false }));
    }, name);
    await context.addInitScript(spy);
    const page = await context.newPage(); watch(page);
    await page.goto(`${base}/g/ludo/?room=${room}`);
    return page;
  };
  const ana = await join('Ana');
  await waitFor(ana, () => window.__link?.state.players.length >= 1 && window.PANA_PREPARED === true, null, 120_000);
  const bruno = await join('Bruno');
  await waitFor(bruno, () => window.__link?.state.players.length === 2 && window.PANA_PREPARED === true, null, 120_000);
  const sockets = await bruno.evaluate(() => ({ ...window.__sockets }));
  const url = bruno.url();

  // Three times in a row: open, wait for the 3D editor, close with its own button.
  for (let i = 0; i < 3; i++) {
    await bruno.locator('#pana-lobby-change').click();
    await editorReady(bruno);
    await frameOf(bruno).locator('header .back').click();
    await closed(bruno);
  }
  // Escape closes it too.
  await bruno.locator('#pana-lobby-change').click();
  await editorReady(bruno);
  await bruno.keyboard.press('Escape');
  await closed(bruno);

  // Saving closes the editor and the room hears the new look.
  await bruno.locator('#pana-lobby-change').click();
  const editor = await editorReady(bruno);
  await frameOf(bruno).locator('[data-slot="hat"][data-item="casco"]').click();
  await frameOf(bruno).locator('#save').click();
  await closed(bruno);
  assert.equal(await editor.isDetached(), true, 'the editor frame is gone');
  for (const page of [ana, bruno]) {
    await waitFor(page, () => { const p = window.__link.state.players.find(p => p.name === 'Bruno'); try { return JSON.parse(p.avatar).wardrobe?.hat === 'casco'; } catch { return false; } });
  }

  assert.equal(bruno.url(), url, 'the lobby page never left');
  assert.deepEqual(await bruno.evaluate(() => ({ ...window.__sockets })), sockets, 'no socket closed or reopened');
  assert.equal(await ana.evaluate(() => window.__link.state.players.filter(p => p.connected !== false).length), 2, 'both panas still in the room');
  await ana.context().close(); await bruno.context().close();

  // The editor page itself opens on every visit, and the hub opens it in place.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('pana:name', 'Ana'));
  const page = await context.newPage(); watch(page);
  const prepared = () => page.waitForFunction(() => window.PANA_PREPARED === true, null, { timeout: 120_000 });
  await page.goto(base + '/personaje'); await prepared();
  await page.reload(); await prepared();
  await page.goto(base + '/'); await page.goBack(); await prepared();
  await page.goForward();
  await page.goto(base + '/');
  for (const link of ['.nav [data-view="mi-pana"]', 'header .me']) {
    await page.locator(link).click();
    await editorReady(page);
    await frameOf(page).locator('header .back').click();
    await closed(page);
  }
  await page.goto(base + '/#mi-pana');
  await editorReady(page);
  assert.equal(new URL(page.url()).hash, '', 'the old #mi-pana link opens the editor over the hub');
  assert.deepEqual(errors, []);
  console.log('PASS Editar pana: opens over the lobby 5 times with the room socket open, Escape and save close it, the other pana sees the new look, and the editor opens on reload, back/forward and from the hub.');
} finally { await browser.close(); }
