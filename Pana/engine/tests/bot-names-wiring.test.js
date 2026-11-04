// The rest of the host-run games: start one alone with friends known and read the
// names back off the bots, then again with none.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setFriendNames } from '../bot-names.js';
import { Race as Lancha } from '../../games/lancha/public/rules.js';
import { Race as Curiara } from '../../games/curiara/public/rules.js';
import { Race as Galope } from '../../games/galope/public/rules.js';
import { Race as Parapente } from '../../games/parapente/public/rules.js';
import { buildCourse } from '../../games/parapente/public/course.js';
import * as chapita from '../../games/chapita/public/rules.js';
import * as qqsmp from '../../games/qqsmp/public/rules.js';
import * as stop from '../../games/stop/public/rules.js';
import * as ludo from '../../games/ludo/public/rules.js';
import * as domino from '../../games/domino/public/rules.js';
import * as caida from '../../games/caida/public/rules.js';
import * as criollas from '../../games/criollas/public/rules.js';
import * as bochinche from '../../games/bochinche/public/rules.js';
import * as escondidas from '../../games/escondidas/public/rules.js';
import * as billar from '../../games/billar/public/rules.js';

const FRIENDS = ['Valentina', 'Mateo', 'Sofi'];
afterEach(() => setFriendNames());
const classOf = (mod) => Object.values(mod).find(v => typeof v === 'function' && /^class /.test(String(v)) && typeof v.prototype.start === 'function');

const seated = (Game) => () => {
  const game = new Game(5);
  if (game.addPlayer) game.addPlayer(1, 'Ana', {}); else game.add?.(1, { name: 'Ana', avatar: {} });
  game.start();
  return game.players.filter(p => p.id === null || p.bot);
};
const GAMES = {
  lancha() { const g = new Lancha(); g.addPlayer(1, 'Ana', {}); g.start(7); return g.boats.map(b => b.driver).filter(d => d.bot); },
  curiara() { const g = new Curiara(); g.addPlayer(1, 'Ana', {}); g.start(true, 7); return g.boats.flatMap(b => b.crew).filter(c => c.bot); },
  galope() { const g = new Galope(); g.addPlayer(1, 'Ana', {}); g.start(true); return g.players.filter(p => p.bot); },
  parapente() { const g = new Parapente(buildCourse(() => 0), 7); g.options.rivals = 'normal'; g.addPlayer(1, 'Ana', {}); g.start(); return g.pilots.filter(p => p.bot); },
  chapita: seated(classOf(chapita)),
  qqsmp: seated(classOf(qqsmp)),
  stop: seated(classOf(stop)),
  ludo: seated(classOf(ludo)),
  domino: seated(classOf(domino)),
  caida: seated(classOf(caida)),
  bochinche: seated(classOf(bochinche)),
  escondidas() { const g = new (classOf(escondidas))(5); g.addPlayer(1, 'Ana', {}); g.start(1); return g.players.filter(p => p.bot); },
  criollas() {
    const g = criollas.createGame(); g.players[0] = { id: 1, name: 'Ana', avatar: {} };
    criollas.acceptAction(g, 1, { action: 'start', seed: 5, revision: g.revision }, 1);
    return g.players.filter(p => p.id === null);
  },
  billar() { const g = billar.createGame(false, { bot: true }); return [g.players[1]]; },
};

for (const [name, start] of Object.entries(GAMES)) {
  test(`${name}: friends on the top bots, and untouched without friends`, () => {
    setFriendNames([]);
    const plain = start().map(b => b.name);
    assert.ok(plain.length, 'has bots');
    assert.ok(!plain.some(n => FRIENDS.includes(n)));

    setFriendNames(FRIENDS);
    const bots = start(), named = bots.filter(b => FRIENDS.includes(b.name));
    const expected = bots.length === 1 ? 1 : Math.min(3, bots.length - 1);
    // Chapita can seat El Abuelo, who keeps his name: at most one fewer there.
    assert.ok(named.length === expected || (name === 'chapita' && named.length >= expected - 1), `${named.length} of ${bots.length}`);
    assert.ok(bots.length === 1 || bots.some(b => !FRIENDS.includes(b.name)), 'one bot keeps its own name');
  });
}
