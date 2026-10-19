import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarToWardrobe, wardrobeToAvatar, normalizeAvatar, DEFAULT_AVATAR } from '../avatar.js';
import { WARDROBE, normalizeWardrobe, wardrobeItem } from '../wardrobe.js';
import { avatarJson } from '../../server/src/room-kit.js';

test('legacy avatars retain clothing, accessories and independent colors', () => {
  const legacy = { ...DEFAULT_AVATAR, outfit: 'hawaiana', outfitColor: '#123456', hat: 'band', hatColor: '#abcdef', extra: 'cadena', glasses: 'sol' };
  const look = avatarToWardrobe(legacy, 'Ana');
  assert.equal(look.top, 'tropical'); assert.equal(look.hat, 'cinta'); assert.equal(look.neck, 'cadena');
  assert.deepEqual({ ...wardrobeToAvatar(look), wardrobe: undefined }, { ...legacy, wardrobe: undefined });
  assert.deepEqual(normalizeAvatar(legacy), legacy);
});

test('all wardrobe items survive normalization and the multiplayer envelope', () => {
  for (const [slot, items] of Object.entries(WARDROBE)) for (const [id] of items) {
    const look = avatarToWardrobe(DEFAULT_AVATAR);
    if (slot === 'extras') look.extras[id] = true; else look[slot] = id;
    const avatar = wardrobeToAvatar(look), wire = avatarJson(avatar);
    assert.ok(wire.length < 2048);
    assert.deepEqual(JSON.parse(wire), avatar);
    assert.deepEqual(avatarToWardrobe(avatar), normalizeWardrobe(look));
  }
});

test('imported codes bound colors and reject unknown values without truncating JSON', () => {
  assert.equal(wardrobeItem('__proto__', 'hat'), undefined);
  assert.equal(wardrobeItem('constructor', 'hat'), undefined);
  const colors = Object.fromEntries(Array.from({ length: 10000 }, (_, i) => [`unknown:${i}:main`, '#123456']));
  colors['top:shirt:main'] = '#AbCdEf';
  const avatar = wardrobeToAvatar({ top: 'shirt', hat: '<script>', colors, extras: { bigote: true, unknown: true } });
  assert.deepEqual(avatar.wardrobe.colors, { 'top:shirt:main': '#abcdef' });
  assert.equal(avatar.wardrobe.hat, 'none'); assert.equal(avatar.wardrobe.extras.unknown, undefined);
  assert.deepEqual(JSON.parse(avatarJson(avatar)), avatar);
  assert.equal(normalizeWardrobe({ top: 'chef', print: 'rayo' }).print, 'none');
});

test('editor remembers item colors while saved game avatars stay compact', () => {
  const look = normalizeWardrobe({ top: 'shirt', colors: {
    'top:shirt:main': '#123456', 'top:hoodie:main': '#abcdef', 'unknown:any:main': '#ffffff',
  } }, { history: true });
  assert.equal(look.colors['top:hoodie:main'], '#abcdef');
  assert.equal(look.colors['unknown:any:main'], undefined);
  assert.deepEqual(wardrobeToAvatar(look).wardrobe.colors, { 'top:shirt:main': '#123456' });
});
