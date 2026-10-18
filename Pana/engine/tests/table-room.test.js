import test from 'node:test';
import assert from 'node:assert/strict';
import { TableRoom } from '../table-room.js';

// A two-seat counter: an action adds one; a bot adds ten on its turn.
const freshState = () => ({ revision: 0, total: 0, turn: 0, ledger: {}, players: [{ id: null }, { id: null }] });
class CounterRoom extends TableRoom {
  constructor(options = {}) {
    super({ game: 'test', protocol: 'test-v1', code: 'x', name: 'Ana', avatar: {}, ...options }, {
      fresh: freshState,
      restore: (state) => structuredClone(state),
      snapshot: (game) => structuredClone(game),
      accept: (game, id, data) => {
        if (data.revision !== game.revision || data.seq <= (game.ledger[id] || 0)) return false;
        game.ledger[id] = data.seq; game.total++; game.revision++; return true;
      },
    });
    this.sent = [];
  }
  seatMembers() { [...this.members.keys()].forEach((id, i) => { this.game.players[i].id = id; }); }
  step(dt) {
    if (!this.botReady(dt, this.game.players[this.game.turn].id === null, 1)) return false;
    this.game.total += 10; this.game.revision++; return true;
  }
  send(data) { this.sent.push(data); }
}

test('practice seats you as host and applies your actions with a rising seq', () => {
  const room = new CounterRoom();
  room.practice();
  assert.equal(room.isHost, true);
  assert.equal(room.seat, 0);
  assert.equal(room.action('add'), true);
  assert.equal(room.action('add'), true);
  assert.equal(room.state.total, 2);
  assert.equal(room.state.ledger[1], 2);
});

test('bots wait their delay, and pausing resets the wait', () => {
  const room = new CounterRoom();
  room.practice();
  room.game.turn = 1; room.publish();
  room.tick(.6); room.tick(.6, true); room.tick(.6);
  assert.equal(room.state.total, 0, 'the pause restarted the bot clock');
  room.tick(.6);
  assert.equal(room.state.total, 10);
});

test('guests take snapshots only from the host and never go back in time with one host', () => {
  const room = new CounterRoom();
  room.id = 2; room.hostId = 1; room.connected = true;
  const states = [];
  room.onState = (s) => states.push(s.revision);
  const snap = (revision) => ({ kind: 'snapshot', state: { ...freshState(), revision } });
  room.receive(1, snap(5));
  room.receive(3, snap(9));            // not the host
  room.receive(1, snap(4));            // older, same host
  assert.deepEqual(states, [5]);
  room.hostId = 3;
  room.receive(3, snap(2));            // a new host may restart the count
  assert.deepEqual(states, [5, 2]);
});

test('offline guests are told to reconnect instead of acting', () => {
  const notices = [];
  const room = new CounterRoom({ onNotice: (text) => notices.push(text) });
  assert.equal(room.action('add'), false);
  assert.equal(notices.length, 1);
});
