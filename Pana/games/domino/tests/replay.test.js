import test from 'node:test';
import assert from 'node:assert/strict';
import { DominoGame, chooseMove } from '../public/rules.js';
import { journalGame, verifyPacket, plainState } from '../public/replay.js';
import { botDelay } from '../public/bot-personas.js';
const members = new Map([[1,{id:1,name:'Ana'}],[2,{id:2,name:'Luis'}]]);
function room() {
  const journal=journalGame(new DominoGame(13).snapshot(),'a');
  journal.game.addPlayer(1,'Ana');journal.game.addPlayer(2,'Luis');
  return journal;
}
const action=(j,id,action,extra={})=>j.game.accept(id,{action,seq:(j.game.ledger[id]||0)+1,revision:j.game.revision,...extra},1);
test('replay reconstructs a deal and verifies only the new legal tail',()=>{
  const j=room();let verified=verifyPacket(null,j.packet(),1,members,true);assert.ok(verified);
  action(j,1,'start');verified=verifyPacket(verified,j.packet(),1,members);assert.ok(verified);
  for(let i=0;i<12 && j.game.phase==='playing';i++){
    const move=chooseMove(j.game),id=j.game.players[j.game.turn].id;
    if(id!==null)action(j,id,move?'play':'pass',move||{});
    else move?j.game.play(j.game.turn,move.tile,move.end):j.game.pass(j.game.turn);
    verified=verifyPacket(verified,j.packet(),1,members);assert.ok(verified);
  }
  assert.deepEqual(verified.state,plainState(j.packet()));
  assert.deepEqual(verifyPacket(null,j.packet(),1,members,true).state,verified.state);
});
test('forged scores, illegal moves, human bot moves, skipped and reversed events are refused',()=>{
  const j=room();action(j,1,'start');const original=j.packet();
  for(const mutate of [p=>p.scores[0]++,p=>p.audit.events.at(-1).args[1].action='nonsense',p=>p.audit.events.at(-1).seq++,p=>p.audit.events.reverse()]){
    const packet=structuredClone(original);mutate(packet);assert.equal(verifyPacket(null,packet,1,members,true),null);
  }
  const verified=verifyPacket(null,original,1,members,true);
  j.game.removePlayer(1);
  assert.equal(verifyPacket(verified,j.packet(),1,members),null,'cannot remove a connected member');
});
test('new host continues from the verified checkpoint with bot takeover',()=>{
  const j=room();action(j,1,'start');const previous=verifyPacket(null,j.packet(),1,members,true);
  const next=journalGame(previous.state,'b');next.game.removePlayer(1);
  const verified=verifyPacket(previous,next.packet(),2,new Map([[2,members.get(2)]]));assert.ok(verified);
  assert.deepEqual(verified.state.players[0].hand,previous.state.players[0].hand);
  const forged=next.packet();forged.audit.checkpoint.scores[0]++;assert.equal(verifyPacket(previous,forged,2,members),null);
});
test('bot pacing is deterministic through restore and remains human readable',()=>{
  const g=new DominoGame(42);g.start();const delay=botDelay(g);
  assert.equal(delay,botDelay(g.snapshot()));assert.ok(delay>=.7 && delay<=1.4);
});
test('recovery replays a transient member and a returning seat in order',()=>{
  const j=room(),previous=verifyPacket(null,j.packet(),1,members,true);
  j.game.addPlayer(3,'Visitante');j.game.removePlayer(3);
  j.game.removePlayer(2);j.game.addPlayer(2,'Luis');
  assert.ok(verifyPacket(previous,j.packet(),1,members));
});
test('a peer behind a checkpoint verifies the retained replay without trusting a new base',()=>{
  const j=room();action(j,1,'options',{patch:{turnSeconds:30}});action(j,1,'start');
  const previous=verifyPacket(null,j.packet(),1,members,true);assert.ok(previous);
  for(let i=0;i<300;i++)j.game.clock(.05);
  assert.equal(verifyPacket(previous,j.packet(),1,members),null);
  const recovered=verifyPacket(previous,j.packet(true),1,members);assert.ok(recovered);
  assert.deepEqual(recovered.state,plainState(j.packet()));
});
test('10,000 seeded bot hands conserve tiles, finish and avoid a dominant team',()=>{
  const wins=[0,0];let ties=0;
  for(let seed=1;seed<=10000;seed++) {
    const g=new DominoGame(seed);g.start();let turns=0;
    while(g.phase==='playing' && turns++<120) {const m=chooseMove(g);assert.ok(m?g.play(g.turn,m.tile,m.end):g.pass(g.turn));}
    assert.notEqual(g.phase,'playing');
    const tiles=[...g.chain,...g.players.flatMap(p=>p.hand),...g.reserve];
    assert.equal(tiles.length,28);assert.equal(new Set(tiles.map(t=>t.id)).size,28);
    if(g.scores[0]===g.scores[1])ties++;else wins[g.scores[0]>g.scores[1]?0:1]++;
  }
  const rate=wins[0]/(wins[0]+wins[1]);assert.ok(rate>.4 && rate<.6,`team win rate ${rate}`);
  console.log(`10,000 hands: team wins ${wins.join('/')}, ties ${ties}`);
});
