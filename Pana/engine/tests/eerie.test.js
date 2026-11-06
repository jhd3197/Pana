import test from 'node:test';
import assert from 'node:assert/strict';
import { createEerie, eerieIntensity, EERIE_EVENTS, scareSound } from '../eerie.js';

// Runs a scheduler for `seconds` at 10 Hz and returns [time, event] pairs.
function run(eerie, seconds, context = {}, from = 0) {
  const out = [];
  for (let t = from; t < from + seconds; t += .1) for (const e of eerie.update(.1, { active: true, time: t, ...context })) out.push([t, e]);
  return out;
}

test('the same seed gives the same events; another seed differs', () => {
  const a = run(createEerie({ seed: 7 }), 600, { codicia: 60, depth: 3 });
  const b = run(createEerie({ seed: 7 }), 600, { codicia: 60, depth: 3 });
  const c = run(createEerie({ seed: 8 }), 600, { codicia: 60, depth: 3 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map(([t, e]) => e.kind), c.map(([t, e]) => e.kind));
  assert.ok(a.length > 20, `something happens: ${a.length}`);
});

test('nothing happens while inactive, and the clocks wait', () => {
  const eerie = createEerie({ seed: 3 });
  for (let i = 0; i < 6000; i++) assert.deepEqual(eerie.update(.1, { active: false, time: i / 10 }), []);
  assert.equal(eerie.clock, 0);
});

test('jump scares: never in the first 20 s, never two in a row, at least 80 s apart', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const events = run(createEerie({ seed }), 1800, { codicia: 100, depth: 6, alone: true, hp: .2, theme: 'biblioteca' });
    const scares = events.filter(([, e]) => e.kind === 'jumpscare');
    assert.ok(scares.length >= 3, `seed ${seed}: some scares in 30 min (${scares.length})`);
    assert.ok(scares.every(([t]) => t >= 20), `seed ${seed}: grace`);
    for (let i = 1; i < scares.length; i++) assert.ok(scares[i][0] - scares[i - 1][0] >= 80, `seed ${seed}: cooldown`);
    for (let i = 1; i < events.length; i++) assert.ok(!(events[i][1].kind === 'jumpscare' && events[i - 1][1].kind === 'jumpscare'), `seed ${seed}: two in a row`);
  }
});

test('per-event cooldowns hold and the theme filters events', () => {
  const events = run(createEerie({ seed: 11 }), 3000, { codicia: 80, depth: 4, theme: 'mina' });
  assert.ok(!events.some(([, e]) => EERIE_EVENTS[e.kind]?.themes && !EERIE_EVENTS[e.kind].themes.includes('mina')), 'no library-only event in the mine');
  const last = {};
  for (const [t, e] of events) {
    if (e.kind === 'jumpscare') continue;
    if (last[e.kind] != null) assert.ok(t - last[e.kind] >= EERIE_EVENTS[e.kind].cooldown - .11, `${e.kind} cooldown`);
    last[e.kind] = t;
  }
  const library = run(createEerie({ seed: 11 }), 3000, { codicia: 80, depth: 4, theme: 'biblioteca' });
  assert.ok(library.some(([, e]) => e.kind === 'bookFall'), 'books fall in the library');
});

test('intensity rises with la codicia, depth, being alone and low health', () => {
  const calm = eerieIntensity({ codicia: 0, depth: 1, hp: 1 });
  assert.ok(eerieIntensity({ codicia: 100, depth: 1 }) > calm);
  assert.ok(eerieIntensity({ depth: 5 }) > calm);
  assert.ok(eerieIntensity({ alone: true }) > calm);
  assert.ok(eerieIntensity({ hp: .1 }) > calm);
  assert.ok(eerieIntensity({ codicia: 100, depth: 9, alone: true, hp: 0, theme: 'biblioteca' }) <= 1);
  // More greed, more events.
  const quiet = run(createEerie({ seed: 5 }), 1200, { codicia: 0 }).length, busy = run(createEerie({ seed: 5 }), 1200, { codicia: 100, alone: true }).length;
  assert.ok(busy > quiet, `${busy} > ${quiet}`);
});

test('the Sustos setting: suaves softens, apagados drops scares, flicker and shake', () => {
  const ctx = { codicia: 100, depth: 6, alone: true, theme: 'biblioteca' };
  const off = run(createEerie({ seed: 9 }), 3000, { ...ctx, mode: 'apagados' });
  assert.ok(off.length > 0, 'quiet events remain');
  assert.ok(off.every(([, e]) => e.kind !== 'jumpscare' && !EERIE_EVENTS[e.kind].flicker && !EERIE_EVENTS[e.kind].shake));
  const soft = run(createEerie({ seed: 9 }), 3000, { ...ctx, mode: 'suaves' }), normal = run(createEerie({ seed: 9 }), 3000, ctx);
  const strength = (list, kind) => Math.max(0, ...list.filter(([, e]) => e.kind === kind).map(([, e]) => e.strength));
  assert.ok(strength(soft, 'flicker') > 0 && strength(soft, 'flicker') < strength(normal, 'flicker') * .5, 'softer flicker');
  assert.ok(soft.filter(([, e]) => e.kind === 'jumpscare').every(([, e]) => e.mode === 'suaves'));
});

test('reset starts a new level: grace again and a fresh sequence', () => {
  const eerie = createEerie({ seed: 2 });
  run(eerie, 500, { codicia: 100 });
  eerie.reset(99);
  assert.equal(eerie.clock, 0);
  const again = run(eerie, 25, { codicia: 100 });
  assert.ok(!again.some(([, e]) => e.kind === 'jumpscare'));
});

test('scare sounds follow Sustos: full, a quieter far half, or none', () => {
  for (let roll = 0; roll < 1; roll += .05) {
    assert.deepEqual(scareSound('normal', roll), { gain: 1, far: false });
    assert.equal(scareSound('apagados', roll), null);
    const soft = scareSound('suaves', roll);
    if (roll < .5) { assert.ok(soft.far && soft.gain < 1); } else assert.equal(soft, null);
  }
});
