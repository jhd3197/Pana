import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../public/rules.js';
import { ctfStep } from '../public/ctf.js';
import { FIELDS, MENU_FIELDS, DEFAULT_OPTIONS, MODE_DEFAULTS, menuPatch, menuValues, playOf } from '../public/options.js';
import { isRoomFieldVisible } from '../../../engine/room-option-fields.js';
const game = options => { const g = new Arena('plaza', 'normal', { toughness: 1, ...options }); for (let id = 1; id <= 4; id++) g.add(id, { name: `Pana ${id}` }); g.start(); g.go(); return g; };
function shoot(g, a, b) { Object.assign(a, { x: -3, z: -4, shield: 0, cooldown: 0 }); Object.assign(b, { x: 3, z: -4, shield: 0 }); g.step(.05, new Map([[a.id, { ax: 1, az: 0, fire: true }]])); for (let i = 0; i < 5; i++) g.step(.05); }
test('teams prevent friendly hits unless enabled; finite lives eliminate and sticky paint slows respawns', () => {
  const g = game({ mode: 'teams', lives: 1, paint: 'sticky' }), [a, b, c] = g.players;
  shoot(g, a, c); assert.equal(c.hits, 0); Object.assign(c, { x: -14, z: 14 }); shoot(g, a, b); assert.equal(b.eliminated, true); assert.ok(b.slow > 0); assert.equal(g.teamScores[0], 1);
  const friendly = game({ mode: 'teams', friendlyFire: true }); shoot(friendly, friendly.players[0], friendly.players[2]); assert.equal(friendly.players[2].hits, 1); assert.equal(friendly.teamScores[0], 0);
});
test('weapons and fast reload change shots; active rounds lock configuration', () => {
  const g = game({ weapons: 'all', fastReload: true, lives: 0, duration: 300 });
  g.step(.05, new Map([[1, { fire: true, weapon: 'scatter' }]])); assert.equal(g.balls.length, 3);
  g.step(.05, new Map([[1, { reload: true }]])); assert.ok(Math.abs(g.players[0].reload - 1.8 * .55 / 1.3) < 1e-9); assert.ok(g.time > 299);
  assert.equal(g.configure({ lives: 3 }), false); assert.equal(new Arena().configure({ duration: -1 }), false);
  const pistol = game({ weapons: 'pistol' }); pistol.step(.05, new Map([[1, { fire: true, weapon: 'scatter' }]])); assert.equal(pistol.balls.length, 1);
});

test('elimination awards the surviving team even when the eliminated team scored more', () => {
  const g = game({ mode: 'teams', lives: 1 }); g.teamScores = [0, 9];
  g.players[1].eliminated = true; g.players[3].eliminated = true; g.step(.05);
  assert.equal(g.phase, 'finished'); assert.deepEqual(g.winners(), [1, 3]);
});
test('carried flags drop on paint hits and captures score for a team, never for friendly fire', () => {
  const g = game({ mode: 'ctf', lives: 0 }), p = g.players[0], flag = g.flags[1];
  Object.assign(p, { x: flag.x, z: flag.z }); ctfStep(g, 0); assert.equal(flag.carrier, p.id);
  shoot(g, g.players[1], p); assert.equal(flag.carrier, null); assert.equal(flag.x, p.x); assert.equal(g.teamScores[1], 0);
  p.respawn = 0; ctfStep(g, 0); assert.equal(flag.carrier, p.id);
  Object.assign(p, { x: g.flags[0].homeX, z: g.flags[0].homeZ }); ctfStep(g, 0); assert.equal(g.teamScores[0], 1); assert.equal(flag.carrier, null); assert.equal(flag.x, flag.homeX);
  g.teamScores[0] = 3; g.step(.05); assert.equal(g.phase, 'finished'); assert.deepEqual(g.winners(), [1, 3]);
});

test('team cards preserve eight stable positions through swaps, disconnects, start and rematch', () => {
 const g=new Arena('plaza','normal',{mode:'teams'});for(let id=1;id<=8;id++)g.add(id,{name:`P${id}`});
 assert.equal(g.moveSeat(2,0,2,1),false);assert.equal(g.moveSeat(99,0,2,99),false);assert.equal(g.moveSeat(2,1,0,1),true);
 assert.equal(g.players.find(p=>p.id===2).team,0);assert.equal(g.players.find(p=>p.id===1).team,1);
 assert.equal(g.moveSeat(1,2,5,1),true);const order=g.players.map(p=>[p.id,p.seat,p.team]);
 assert(g.start());assert.deepEqual(g.players.map(p=>[p.id,p.seat,p.team]),order);assert.equal(g.moveSeat(2,0,1,1),false);
 g.phase='finished';assert(g.toLobby());assert(g.start());assert.deepEqual(g.players.map(p=>[p.id,p.seat,p.team]),order);
 const old=g.players[7];old.connected=false;g.add(9,{name:'Nueva'});g.add(8,{name:'Vuelve'});
 assert.equal(old.connected,false,'a full round does not duplicate an occupied seat');assert.equal(new Set(g.players.filter(p=>p.connected).map(p=>p.seat)).size,8);
});
test('team changes require an opposing player when friends start, with empty positions available to join', () => {
 const g=new Arena('plaza','normal',{mode:'ctf'});g.add(1,{name:'A'});g.add(2,{name:'B'});
 assert(g.moveSeat(2,1,2,1));assert.equal(g.canStart(),false);assert.equal(g.start(),false);
 assert(g.moveSeat(2,2,3,1));assert(g.canStart());assert(g.start());
});

test('team and flag options update lobby paint colors before the round starts',()=>{
 const g=new Arena();for(let id=1;id<=4;id++)g.add(id,{name:`P${id}`});const original=g.players.map(p=>p.color);
 assert(g.configure({mode:'teams'}));assert.equal(g.players[0].color,g.players[2].color);assert.equal(g.players[1].color,g.players[3].color);
 assert(g.configure({mode:'ffa'}));assert.deepEqual(g.players.map(p=>p.color),original);
 assert(g.configure({mode:'ctf'}));assert.equal(g.players[0].color,g.players[2].color);
});

test('the lobby shows only Partida and Modo; everything else is in Más ajustes', () => {
  const primary = MENU_FIELDS.filter(f => !f.advanced).map(f => f.id);
  assert.deepEqual(primary, ['sides', 'teamMode', 'ffaMode']);
  assert.equal(FIELDS.some(f => f.id === 'toughness'), false, 'Aguante is gone: Hardcore replaces it');
  const teams = menuValues({ ...DEFAULT_OPTIONS, mode: 'teams' }), ffa = menuValues(DEFAULT_OPTIONS);
  assert.deepEqual(MENU_FIELDS.filter(f => !f.advanced && isRoomFieldVisible(f, teams)).map(f => f.id), ['sides', 'teamMode']);
  assert.deepEqual(MENU_FIELDS.filter(f => !f.advanced && isRoomFieldVisible(f, ffa)).map(f => f.id), ['sides', 'ffaMode']);
  assert.deepEqual(MENU_FIELDS.find(f => f.id === 'teamMode').choices.map(([v]) => v), ['teams', 'ctf', 'dom', 'hardcore']);
  assert.deepEqual(MENU_FIELDS.find(f => f.id === 'ffaMode').choices.map(([v]) => v), ['ffa', 'hardcore']);
});

test('Modo and Partida map to mode + hardcore, and each mode brings its own defaults', () => {
  const options = { ...DEFAULT_OPTIONS };
  assert.deepEqual(menuPatch({ teamMode: 'hardcore' }, options), { mode: 'teams', hardcore: true });
  assert.deepEqual(menuPatch({ ffaMode: 'hardcore' }, options), { mode: 'ffa', hardcore: true });
  assert.deepEqual(menuPatch({ sides: 'teams' }, { ...options, hardcore: true }), { mode: 'teams', hardcore: true }, 'Hardcore survives the side switch');
  assert.deepEqual(menuPatch({ sides: 'ffa' }, { ...options, mode: 'ctf' }), { mode: 'ffa', hardcore: false });
  assert.equal(playOf({ mode: 'ctf', hardcore: true }), 'ctf', 'objective rounds are never hardcore');
  const g = new Arena(); g.add(1, { name: 'A' });
  assert(g.configure({ duration: 300, lives: 1 }));
  assert(g.configure(menuPatch({ teamMode: 'ctf' }, g.options))); assert.equal(g.options.flagTime, 600); assert.equal(g.options.flagGoal, 3);
  assert(g.configure({ flagTime: 900 })); assert(g.configure(menuPatch({ teamMode: 'dom' }, g.options)));
  assert.equal(g.options.flagTime, 600, 'switching mode resets its clock'); assert.equal(g.options.domGoal, 200);
  assert(g.configure(menuPatch({ teamMode: 'hardcore' }, g.options)));
  assert.equal(g.options.hardcore, true); assert.equal(g.options.lives, MODE_DEFAULTS.hardcore.lives); assert.equal(g.options.duration, 180);
  assert(g.configure(menuPatch({ teamMode: 'teams' }, g.options))); assert.equal(g.options.hardcore, false); assert.equal(g.options.lives, 3);
  assert(g.configure({ mode: 'ffa', lives: 1 })); assert.equal(g.options.lives, 1, 'a patch that names a value keeps it');
  assert(g.configure({ bots: 2 })); assert.equal(g.options.lives, 1, 'other settings leave the mode values alone');
  const lives = MENU_FIELDS.find(f => f.id === 'lives');
  assert.equal(lives.defaultOf({ ...DEFAULT_OPTIONS, hardcore: true }), 0); assert.equal(lives.defaultOf(DEFAULT_OPTIONS), 3);
});

test('legacy Aguante options never break a room', () => {
  const g = new Arena(); g.add(1, { name: 'A' });
  assert.equal(g.configure({ toughness: 5, mode: 'teams' }), true); assert.equal(g.options.mode, 'teams'); assert.equal('toughness' in g.options, false);
  assert.equal(g.configure({ toughness: 1 }), false);
  const saved = new Arena('plaza', 'normal', { mode: 'ctf', flagGoal: 5 }); assert.equal(saved.options.flagGoal, 5);
});

test('Hardcore: one pepazo knocks out, in teams and in todos contra todos', () => {
  for (const mode of ['teams', 'ffa']) {
    const g = new Arena('plaza', 'normal', { mode, hardcore: true, lives: 0 });
    for (let id = 1; id <= 4; id++) g.add(id, { name: `Pana ${id}` }); g.start(); g.go();
    const [a, b] = g.players; shoot(g, a, b);
    assert.equal(b.hits, 1, `${mode}: one hit is a knockout`); assert.ok(b.respawn > 0 && b.respawn <= 1.5); assert.equal(b.eliminated, false);
  }
  const normal = new Arena('plaza', 'normal', { mode: 'ffa', lives: 0 }); for (let id = 1; id <= 2; id++) normal.add(id, { name: `P${id}` }); normal.start(); normal.go();
  shoot(normal, normal.players[0], normal.players[1]); assert.equal(normal.players[1].hits, 0, 'normal rounds still take 3 pepazos'); assert.equal(normal.players[1].paint, 1);
});
