import test from 'node:test';
import assert from 'node:assert/strict';

// Just enough element for the toast: no `hidden` attribute or class, so it
// wears `.show` while shown (see hud.js).
function fakeEl() {
  const classes = new Set();
  return {
    textContent: '', hidden: false,
    hasAttribute: () => false,
    classList: { contains: (c) => classes.has(c), toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); } },
    shown: () => classes.has('show'),
  };
}

const { createFeats } = await import('../feats.js');

test('a feat shows its text on the toast', () => {
  const el = fakeEl(), feat = createFeats(el, { now: () => 0 });
  assert.equal(feat('doble', '¡Doble pintada!'), true);
  assert.equal(el.textContent, '¡Doble pintada!');
  assert.equal(el.shown(), true);
  feat.dispose();
});

test('the same id stays quiet during the cooldown, another id does not', () => {
  let t = 0;
  const el = fakeEl(), feat = createFeats(el, { cooldownMs: 6000, now: () => t });
  feat('hit', '¡Pintaste a Ana!');
  t += 2000;
  assert.equal(feat('hit', '¡Pintaste a Ana!'), false);
  assert.equal(el.textContent, '¡Pintaste a Ana!');
  assert.equal(feat('doble', '¡Doble pintada!'), true);   // a different feat cuts through
  t += 4000;   // 6 s since 'hit'
  assert.equal(feat('hit', '¡Pintaste a Ana!'), true);
  feat.dispose();
});

test('empty text never shows and does not start the cooldown', () => {
  let t = 0;
  const el = fakeEl(), feat = createFeats(el, { now: () => t });
  assert.equal(feat('hit', ''), false);
  assert.equal(el.shown(), false);
  assert.equal(feat('hit', '¡Pintaste a Ana!'), true);
  feat.dispose();
});

test('reset lets a feat fire again at once', () => {
  const el = fakeEl(), feat = createFeats(el, { now: () => 0 });
  feat('derrapon', '¡Derrapón!');
  assert.equal(feat('derrapon', '¡Derrapón!'), false);
  feat.reset();
  assert.equal(feat('derrapon', '¡Derrapón!'), true);
  feat.dispose();
});

test('a meter fires each step once, in order, even in one big add', () => {
  const el = fakeEl(), feat = createFeats(el, { now: () => 0 });
  const meter = feat.meter([{ at: 500, text: 'quinientos' }, { at: 900, text: 'novecientos' }]);
  const texts = [];
  meter.add(400); texts.push(el.textContent);
  meter.add(100); texts.push(el.textContent);   // 500: first step
  meter.add(500); texts.push(el.textContent);   // 1000: second step already crossed
  assert.deepEqual(texts, ['', 'quinientos', 'novecientos']);
  assert.equal(meter.total, 1000);
  meter.add(100);   // past both: nothing new
  assert.equal(el.textContent, 'novecientos');
  feat.dispose();
});

test('a meter with `every` fires at each multiple after the steps', () => {
  const el = fakeEl(), feat = createFeats(el, { now: () => 0 });
  const km = feat.meter([{ at: 500, text: '¡500 m!' }], { every: 1000, text: (m) => `¡${m / 1000} km!` });
  km.add(600);
  assert.equal(el.textContent, '¡500 m!');
  km.add(500);   // 1100: crosses the first km
  assert.equal(el.textContent, '¡1 km!');
  km.add(1800);  // 2900: crosses 2 km
  assert.equal(el.textContent, '¡2 km!');
  km.reset();
  assert.equal(km.total, 0);
  km.add(1000);  // after a reset the 500 step and the 1 km multiple both fire; the newest shows
  assert.equal(el.textContent, '¡1 km!');
  feat.dispose();
});
