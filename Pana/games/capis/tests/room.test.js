// Two real CapisRooms (network.js) over a stand-in for the room server: the
// kit's seats, host and relay routing (messages cross as JSON, in order),
// without Colyseus. The guest plays its turn, both see the same ground, and
// when the host leaves the guest carries the match on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CapisRoom } from '../public/network.js';

// The relay room: seats in arrival order, the first is host, `dest` routing.
function relay() {
  const players = [], rooms = new Map(), queue = [];
  let host = null;
  const state = () => ({ players: players.map(p => ({ ...p })), host });
  const syncAll = () => { for (const room of rooms.values()) room.sync(state()); };
  function join(room) {
    const seat = players.length + 1, id = `c${seat}`;
    players.push({ id, seat, name: room.name, avatar: '{}', connected: true });
    room.link = { id, state: state(), send: (type, v) => queue.push({ from: seat, v: JSON.parse(JSON.stringify(v)) }), leave() {} };
    room.connected = true; rooms.set(seat, room); host ??= id;
    syncAll(); flush();
  }
  function leave(room) {
    const seat = [...rooms].find(([, r]) => r === room)[0];
    rooms.delete(seat); players.splice(players.findIndex(p => p.seat === seat), 1);
    if (host === `c${seat}`) host = players[0]?.id ?? null;
    syncAll(); flush();
  }
  function flush() {
    for (let n = 0; queue.length && n < 10000; n++) {
      const { from, v } = queue.shift(), hostSeat = players.find(p => p.id === host)?.seat;
      for (const [seat, room] of rooms) {
        if (seat === from || (v.dest === 'host' && seat !== hostSeat) || (typeof v.dest === 'number' && v.dest !== seat)) continue;
        if (v.game !== room.protocol || !room.members.has(from)) continue;
        if (v.kind === 'hello') room.hello_(from, v); else room.receive(from, v);
      }
    }
  }
  return { join, leave, flush };
}

const newRoom = name => new CapisRoom({ code: 'test', name, avatar: {} });
// Both clients' timers, 50 ms each, until `done`.
function play(net, rooms, done, input = () => ({}), seconds = 120) {
  for (let s = 0; s < seconds && !done(); s += .05) { for (const r of rooms) r.tick(.05, input(r)); net.flush(); }
  return done();
}
const sameGround = (a, b) => a.mask.solid.every((v, i) => v === b.mask.solid[i]) && a.mask.stain.every((v, i) => v === b.mask.stain[i]);

test('two panas: teams, settings from the host, a turn each, the same ground, and a host who leaves', () => {
  const net = relay(), ana = newRoom('Ana'), beto = newRoom('Beto');
  net.join(ana); net.join(beto);
  assert.ok(ana.isHost); assert.ok(!beto.isHost);
  assert.deepEqual(beto.state.players.map(p => [p.name, p.team]), [['Ana', 0], ['Beto', 1]], 'one pana a team');

  // Only the host sets the match up; a guest's settings are ignored.
  beto.action('options', { options: { seconds: 45 } }); net.flush();
  assert.equal(beto.state.options.seconds, 35);
  ana.action('options', { options: { size: 'small', seconds: 30 } }); ana.action('seed', { seed: 6 }); net.flush();
  assert.deepEqual([beto.state.options.size, beto.state.options.seconds, beto.state.seed], ['small', 30, 6]);
  beto.action('start'); net.flush();
  assert.equal(beto.state.phase, 'lobby', 'only the host starts');
  ana.action('start'); net.flush();
  assert.equal(beto.state.phase, 'play');
  assert.equal(beto.match.map.seed, 6, 'the guest built the same map from the seed');
  assert.equal(beto.state.controller, ana.id, 'Ana opens');

  // Ana fires on her turn; Beto's shot on her turn does nothing.
  beto.action('fire', { power: 1 }); ana.action('fire', { power: .75, aim: .7, face: 1 }); net.flush();
  assert.ok(play(net, [ana, beto], () => beto.state.events.some(e => e.type === 'fire')));
  assert.equal(beto.state.events.find(e => e.type === 'fire').team, 0);

  // Beto's turn: his keys walk his capi on the host, then his shot flies.
  assert.ok(play(net, [ana, beto], () => beto.state.controller === beto.id && beto.match.phase === 'aim'));
  const capi = () => ana.match.capys.find(c => c.id === ana.match.turn.capy), from = capi().x;
  play(net, [ana, beto], () => Math.abs(capi().x - from) > .5, r => r === beto ? { x: -1 } : {}, 3);
  assert.ok(capi().x < from - .5, 'the guest walked its capi on the host');
  beto.action('fire', { power: .8, aim: .5, face: -1 }); net.flush();
  assert.ok(play(net, [ana, beto], () => ana.state.events.some(e => e.type === 'fire' && e.team === 1)));
  assert.ok(play(net, [ana, beto], () => ana.match.turn.team === 0 && ana.match.phase === 'aim'));
  assert.ok(ana.match.edits.length >= 1, 'the shots changed the ground');
  assert.equal(beto.match.edits.length, ana.match.edits.length);
  assert.ok(sameGround(beto.match, ana.match), 'both see the same craters');
  assert.deepEqual(beto.match.capys.map(c => [c.paint, c.out]), ana.match.capys.map(c => [c.paint, c.out]));

  // Ana leaves mid-match: Beto hosts from his own copy and the machine plays Ana's capis.
  const turn = ana.match.turn.n;
  net.leave(ana);
  assert.ok(beto.isHost);
  assert.equal(beto.state.phase, 'play');
  assert.ok(beto.match.turn.n >= turn);
  assert.deepEqual(beto.state.players.map(p => p.name), ['Beto']);
  assert.ok(play(net, [beto], () => beto.state.events.some(e => e.type === 'fire' && e.team === 0 && e.n > 0) && beto.match.turn.n > turn));

  // Results, then the host takes everyone back to a lobby with a new map.
  beto.game.match.phase = 'finished';
  beto.action('lobby'); net.flush();
  assert.equal(beto.state.phase, 'lobby');
  assert.notEqual(beto.state.seed, 6);
  for (const r of [beto]) r.dispose();
});

test('a third and fourth pana join a team each; the fifth finds no capi', () => {
  const net = relay(), rooms = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].map(newRoom);
  rooms.forEach(r => net.join(r));
  const [ana, , caro] = rooms;
  assert.deepEqual(ana.state.players.map(p => p.team), [0, 1, 0, 1]);
  // Caro moves herself to the other team; a full team refuses nobody here (two of three).
  caro.action('team', { team: 1 }); net.flush();
  assert.deepEqual(ana.state.players.map(p => p.team), [0, 1, 1, 1]);
  // The host moves Caro back.
  ana.action('team', { id: caro.id, team: 0 }); net.flush();
  assert.deepEqual(caro.state.players.map(p => p.team), [0, 1, 0, 1]);
  rooms.forEach(r => r.dispose());
});
