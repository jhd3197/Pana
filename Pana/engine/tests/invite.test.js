import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoomCode, roomFromUrl, inviteUrl, playUrl } from '../invite.js';

test('room codes are six unambiguous characters', () => {
  for (let i = 0; i < 200; i++) assert.match(newRoomCode(), /^[a-hj-km-np-z2-9]{6}$/);
});

test('roomFromUrl cleans the code and returns empty without one', () => {
  assert.equal(roomFromUrl('?room=abc123&name=Juan'), 'abc123');
  assert.equal(roomFromUrl('?room=a%20b<c>'), 'abc');
  assert.equal(roomFromUrl('?room=' + 'x'.repeat(40)).length, 24);
  assert.equal(roomFromUrl('?name=Juan'), '');
  assert.equal(roomFromUrl('?room=K3XQPT'), 'k3xqpt', 'the lobby shows codes in capitals; typing them must reach the same room');
});

test('an invite carries only the room code', () => {
  assert.equal(inviteUrl('abc', '/g/cocina/', 'https://pana.sh'), 'https://pana.sh/g/cocina/?room=abc');
  assert.equal(inviteUrl('a b', '/g/domino/', 'http://localhost:8461'), 'http://localhost:8461/g/domino/?room=a+b');
});

test('the hub play link adds the name', () => {
  assert.equal(playUrl('/g/galope/', 'abc', 'Juan José', 'http://x'), '/g/galope/?room=abc&name=Juan+Jos%C3%A9');
  assert.equal(playUrl('/g/galope/', 'abc', '', 'http://x'), '/g/galope/?room=abc');
});
