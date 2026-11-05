// Who may change the map, and that changing it again always works: the host
// online or the lone player with no room; a guest never.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canChangeMap, createMapPicker } from '../play/map-picker.js';
import { HostRoom } from '../net.js';

// Just enough DOM for the picker: elements that keep children and listeners.
function element(tag) {
  const node = { tag, dataset: {}, children: [], listeners: {}, disabled: false, value: '', textContent: '',
    setAttribute() {}, append(...kids) { node.children.push(...kids); },
    addEventListener(type, fn) { node.listeners[type] = fn; } };
  return node;
}
function picker(options) {
  globalThis.document = { createElement: element };
  const parent = element('div'), sent = [];
  const control = createMapPicker(parent, mapId => sent.push(mapId), options);
  const select = parent.children[0].children[1], description = parent.children[0].children[2];
  return { control, select, description, sent, choose(id) { select.value = id; select.listeners.change(); } };
}

test('in the lobby the online host can change the map, again and again', () => {
  const room = { connected: true, isHost: true, state: { mapId: 'plaza' }, onState() {} };
  const { control, select, sent, choose } = picker({ room });
  for (const id of ['puerto', 'hato', 'plaza']) {
    choose(id); control.update(id, canChangeMap(room, 'lobby'));
    assert.equal(select.disabled, false, `still open after ${id}`);
  }
  assert.deepEqual(sent, ['puerto', 'hato', 'plaza']);
  assert.equal(room.state.mapId, 'plaza', 'online, the room owns the state');
});

test('a connected guest stays read-only and still follows the host', () => {
  const guest = { connected: true, isHost: false, solo: false };
  assert.equal(canChangeMap(guest, 'lobby'), false);
  const { control, select, description } = picker();
  control.update('hato', canChangeMap(guest, 'lobby'));
  assert.equal(select.disabled, true);
  assert.equal(select.value, 'hato');
  assert.equal(select.dataset.map, 'hato', 'an attribute changes, so the sala arrows repaint their name');
  assert.ok(description.textContent, 'the map says what it is');
});

test('with no room the lone player changes the map locally, again and again', () => {
  const seen = [];
  const room = { connected: false, isHost: false, solo: true, state: { mapId: 'plaza' }, onState: state => seen.push(state.mapId) };
  const { control, select, sent, choose } = picker({ room });
  for (const id of ['puerto', 'ruinas']) {
    choose(id); control.update(room.state.mapId, canChangeMap(room, 'lobby'));
    assert.equal(select.disabled, false);
  }
  assert.deepEqual(seen, ['puerto', 'ruinas']);
  assert.deepEqual(sent, [], 'nothing goes to a room that is not there');
  assert.equal(room.state.mapId, 'ruinas', 'practice starts from this');
});

test('local practice is a connected host, so its map stays open', () => {
  assert.equal(canChangeMap({ connected: true, isHost: true, solo: false }, 'lobby'), true);
});

test('nobody changes the map outside the lobby or while a room may still answer', () => {
  for (const phase of ['playing', 'finished', 'results']) assert.equal(canChangeMap({ connected: true, isHost: true }, phase), false);
  assert.equal(canChangeMap({ connected: false, isHost: false, solo: false }, 'lobby'), false, 'still connecting: this may be a guest');
  assert.equal(canChangeMap({ connected: false, isHost: true, solo: false }, 'lobby'), false, 'reconnecting: the room still decides');
});

test('a shared room is solo until it dials and again once it gives up', () => {
  const room = new HostRoom({ game: 'domino', protocol: 'test', code: 'x' });
  assert.equal(room.solo, true, 'not dialed yet');
  room.solo = false; room.attempts = 3; room.retryLater();
  assert.equal(room.solo, true, 'every retry failed');
  room.solo = false; room.attempts = 0; room.retryLater(); clearTimeout(room.retry);
  assert.equal(room.solo, false, 'still retrying: a guest stays locked');
});

test('the games read the one rule', async () => {
  const { readFileSync } = await import('node:fs');
  for (const game of ['billar', 'caida', 'criollas', 'domino', 'escondidas', 'pintura', 'poquer']) {
    const source = readFileSync(new URL(`../../games/${game}/public/game.js`, import.meta.url), 'utf8');
    assert.match(source, /mapPicker\.update\([^\n]*canChangeMap\(room, \w+\.phase\)\)/, game);
  }
});
