import test from 'node:test';
import assert from 'node:assert/strict';
import { helmetSwap, punchLength, ARM_GUARD, HEAD_SIZE } from '../public/fighter-look.js';

const part = (name, visible = true) => ({ name, visible });
function head() {
  const bare = ['Sculpted head', 'Animated smile', 'Broad cocoa muzzle', 'eyeL', 'eyeR', 'face:bigote'].map(n => part(n));
  const stars = part('Dizzy stars', false);
  const ears = [part('Cupped ear', false), part('Cupped ear', false)]; // a hat that hides them
  const worn = [part('hat:llanero'), part('outfit:backward-cap'), part('outfit:chef-hat', false), part('accessory:glasses'), part('glasses:piloto'), part(''), part('some:future-hat')];
  const helmet = part('hat:casco', false);
  return { bare, stars, ears, worn, helmet, children: [...bare, stars, ...ears, ...worn, helmet] };
}

test('the helmet goes on alone: everything worn comes off, the face stays', () => {
  const h = head(), swap = helmetSwap(h, h.helmet);
  swap.on();
  assert.equal(h.helmet.visible, true);
  for (const p of [...h.worn, ...h.ears]) assert.equal(p.visible, false, p.name);
  for (const p of h.bare) assert.equal(p.visible, true, p.name);
});

test('taking the helmet off puts back exactly what was worn', () => {
  const h = head(), before = h.children.map(p => p.visible), swap = helmetSwap(h, h.helmet);
  swap.on(); swap.on(); // a second call (a new corner) must not record the bare head
  swap.off();
  assert.deepEqual(h.children.map(p => p.visible), before);
  swap.off(); // the crowd asks every frame
  assert.deepEqual(h.children.map(p => p.visible), before);
});

test('a new round hides what the last one restored', () => {
  const h = head(), swap = helmetSwap(h, h.helmet);
  swap.on(); swap.off(); swap.on();
  assert.ok(h.worn.every(p => !p.visible) && h.helmet.visible);
});

test('fighters stay near the classic pana', () => {
  assert.ok(HEAD_SIZE > .45 && HEAD_SIZE <= .58);
  assert.equal(punchLength(.2), ARM_GUARD, 'never shorter than the guard');
  assert.equal(punchLength(9), 2.1, 'and bounded at the end of the reach');
});
