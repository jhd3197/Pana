// The camp wardrobe in the lobby: with some trims earned and some not, the row
// shows, locked trims are disabled and titled with their rank, a pick goes on your
// own pana at once and survives a reload, and nothing covers the start buttons.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const check = text => console.log(`ok  ${text}`);
const shots = process.env.PANA_ROPERO_SHOTS;
const browser = await launch();
// 400 XP: Farolero. Franja, Remiendo and Ámbar earned; Capataz, Leyenda and every casco not.
const SEED = { xp: 400, dives: 4, receipts: [] };
const open = async ({ room, mobile = false }) => {
  const p = await openGame(browser, 'reliquia', { name: 'Juan', room, mobile, query: 'debug' });
  p.setDefaultTimeout(90_000);
  await p.evaluate(seed => { localStorage.setItem('pana:progress:reliquia', JSON.stringify(seed)); localStorage.removeItem('pana:reliquia:look'); }, SEED);
  await p.reload(); await ready(p);
  return p;
};
const ready = async p => { await waitFor(p, () => window.reliquia?.room.connected && document.getElementById('ropero-traje-plain')); };
const look = p => p.evaluate(() => ({ ...reliquia.view.ownLook }));
const buttons = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#ropero button')].map(b => [b.id, { disabled: b.disabled, pressed: b.getAttribute('aria-pressed'), title: b.title }])));
const visible = (p, id) => p.evaluate(i => { const e = document.getElementById(i); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; }, id);
// No wardrobe button overlaps the start buttons, and each one sits on the page.
const clear = p => p.evaluate(() => {
  const boxes = ['start', 'daily-start'].map(id => document.getElementById(id)).filter(e => e && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
  const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  return [...document.querySelectorAll('#ropero button')].every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + .5 && boxes.every(s => apart(r, s)); });
});
const radius = p => p.evaluate(() => getComputedStyle(document.getElementById('ropero-traje-franja')).borderTopLeftRadius);
try {
  const a = await open({ room: `fosa-ropero-${Date.now().toString(36)}` });
  await a.setViewportSize({ width: 1280, height: 720 });
  assert.equal(await visible(a, 'ropero'), true, 'the wardrobe shows in the lobby');
  assert.deepEqual(await look(a), { traje: 'remiendo', casco: null, farol: 'ambar' }, 'no pick: the highest earned, as before');
  const seen = await buttons(a);
  for (const id of ['ropero-traje-plain', 'ropero-traje-franja', 'ropero-traje-remiendo', 'ropero-casco-plain', 'ropero-farol-plain', 'ropero-farol-ambar']) assert.equal(seen[id].disabled, false, id);
  for (const id of ['ropero-traje-capataz', 'ropero-traje-leyenda', 'ropero-casco-cobre', 'ropero-casco-plata', 'ropero-casco-oro']) assert.equal(seen[id].disabled, true, id);
  assert.match(seen['ropero-casco-cobre'].title, /Veterano/); assert.match(seen['ropero-traje-leyenda'].title, /Leyenda/);
  assert.equal(seen['ropero-traje-remiendo'].pressed, 'true'); assert.equal(seen['ropero-casco-plain'].pressed, 'true');
  assert.equal(await radius(a), '0px', 'square corners');
  check('earned trims are selectable, the rest greyed with their rank, the default is the highest earned');

  await a.click('#ropero-traje-franja'); await a.click('#ropero-farol-plain');
  await waitFor(a, () => reliquia.view.ownLook.traje === 'franja' && reliquia.view.ownLook.farol === null);
  assert.deepEqual(await a.evaluate(() => JSON.parse(localStorage.getItem('pana:reliquia:look'))), { traje: 'franja', farol: null });
  // The locked one does nothing even if forced.
  await a.evaluate(() => document.getElementById('ropero-casco-oro').click());
  assert.equal((await look(a)).casco, null);
  const after = await buttons(a);
  assert.equal(after['ropero-traje-franja'].pressed, 'true'); assert.equal(after['ropero-traje-remiendo'].pressed, 'false'); assert.equal(after['ropero-farol-plain'].pressed, 'true');
  check('picking an earned trim dresses your pana at once and saves the pick');

  assert.equal(await clear(a), true, 'nothing overlaps the start buttons at 1280x720');
  if (shots) await a.screenshot({ path: `${shots}/ropero-lobby.png` });
  await a.reload(); await ready(a);
  await waitFor(a, () => reliquia.view.ownLook.traje === 'franja');
  assert.deepEqual(await look(a), { traje: 'franja', casco: null, farol: null });
  assert.equal((await buttons(a))['ropero-traje-franja'].pressed, 'true');
  check('the pick survives a reload');

  // A saved pick that is no longer earned falls back to the highest earned.
  await a.evaluate(() => localStorage.setItem('pana:reliquia:look', JSON.stringify({ traje: 'leyenda', casco: 'oro', farol: 'violeta' })));
  await a.reload(); await ready(a);
  await waitFor(a, () => reliquia.view.ownLook.traje === 'remiendo');
  assert.deepEqual(await look(a), { traje: 'remiendo', casco: null, farol: 'ambar' });
  check('an unearned or unknown saved pick falls back to the highest earned');
  await a.context().close();

  const phone = await open({ room: `fosa-ropero-m-${Date.now().toString(36)}`, mobile: true });
  await phone.locator('#ropero').scrollIntoViewIfNeeded();
  assert.equal(await visible(phone, 'ropero'), true);
  assert.equal(await clear(phone), true, 'nothing overlaps the start buttons at 390x844');
  check('on a phone the row fits and stays clear of the start buttons');
} finally { await browser.close(); }
