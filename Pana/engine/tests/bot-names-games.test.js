// Games that fill seats with bots, in one place: with friends known the top bots
// wear their names, some bot keeps its own, and with no friends the names are
// exactly what they were.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setFriendNames } from '../bot-names.js';
import { Trifulca } from '../../games/trifulca/public/rules.js';
import { Rueda } from '../../games/tambor/public/rules.js';
import { Arena } from '../../games/pintura/public/rules.js';
import { fillBots } from '../../server/src/room-kit.js';

const FRIENDS = ['Valentina', 'Mateo', 'Sofi'];
afterEach(() => setFriendNames());
const friendsIn = (list) => list.map(p => p.name).filter(n => FRIENDS.includes(n)).sort();

function trifulcaLadder() {
  const game = new Trifulca(3); game.addPlayer(1, 'Ana'); game.start();
  return game.players.filter(p => p.bot);
}

test('Trifulca: the toughest rivals of the ladder wear the friends names', () => {
  setFriendNames(FRIENDS);
  const bots = trifulcaLadder(), byLevel = [...bots].sort((a, b) => b.level - a.level);
  assert.equal(bots.length, 5);
  assert.equal(byLevel[0].name, 'Valentina', 'the last rival, the hardest');
  assert.deepEqual(friendsIn(bots), [...FRIENDS].sort());
  assert.ok(byLevel.slice(0, 3).every(b => FRIENDS.includes(b.name)));
  assert.ok(bots.filter(b => b.level === 0).every(b => !FRIENDS.includes(b.name)), 'the first rivals keep their names');
});

test('Trifulca: no friends, the same night as before', () => {
  setFriendNames([]);
  assert.deepEqual(trifulcaLadder().map(b => b.name), ['Cheo', 'Lola', 'Toño', 'Nena', 'Pepe']);
});

test('Trifulca: a friend in the room is not also a bot, and a rematch keeps the names', () => {
  setFriendNames(FRIENDS);
  const game = new Trifulca(3); game.configure({ rivales: 4 });
  game.addPlayer(1, 'Valentina'); game.addPlayer(2, 'Ana'); game.start();
  const first = game.players.filter(p => p.bot).map(p => [p.id, p.name]);
  assert.ok(!first.some(([, name]) => name === 'Valentina'));
  assert.deepEqual(first.map(([, n]) => n).filter(n => FRIENDS.includes(n)), ['Mateo', 'Sofi']);
  game.phase = 'finished'; game.toLobby(); game.start();
  assert.deepEqual(game.players.filter(p => p.bot).map(p => [p.id, p.name]), first);
});

test('Trifulca: the tutorial keeps its Profe', () => {
  setFriendNames(FRIENDS);
  const game = new Trifulca(3); game.addPlayer(1, 'Ana'); game.startTutorial(1);
  assert.equal(game.player(game.tutorial.profe).name, 'Profe Cheo');
});

test('Tambor: the most skilled bots', () => {
  setFriendNames(FRIENDS);
  const game = new Rueda(3); game.addPlayer(1, 'Ana'); game.start();
  const bots = game.players.filter(p => p.bot), top = Math.max(...bots.map(b => b.skill));
  assert.equal(friendsIn(bots).length, 3);
  assert.ok(FRIENDS.includes(bots.find(b => b.skill === top).name));
});

test('Pepazo: seatBots takes the list the room hands it', () => {
  const lobby = () => { const game = new Arena(); game.add(1, { name: 'Ana', avatar: {} }); return game; };
  const make = i => ({ name: `Bot${i}`, avatar: {} });
  const named = lobby(); named.seatBots(make, FRIENDS);
  assert.equal(friendsIn(named.players.filter(p => p.bot)).length, 2, 'three bots: one keeps its name');
  const plain = lobby(); plain.seatBots(make);
  assert.deepEqual(plain.players.filter(p => p.bot).map(p => p.name), ['Bot0', 'Bot1', 'Bot2']);
});

test('fillBots itself is unchanged', () => {
  const seen = []; fillBots(2, (seat, info) => seen.push([seat, info.name]));
  assert.deepEqual(seen, [[1000, 'Coco'], [1001, 'Lola']]);
});
