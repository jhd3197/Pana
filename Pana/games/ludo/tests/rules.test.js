import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoGame, HOME, RING, SAFE, cellFor, rotateCell, ringIndex, legalMoves, chooseMove } from '../public/rules.js';
const game = () => { const g=new LudoGame(123);g.addPlayer(1,'Juan',{hat:'gorra'});g.addPlayer(2,'Ana',{});g.start();return g; };
test('52 distinct ring cells, rotated starts and private home lanes match the board',()=>{
  assert.equal(RING.length,52);assert.equal(new Set(RING.map(c=>c.join(','))).size,52);
  for(let s=0;s<4;s++){
    assert.deepEqual(cellFor(s,0),rotateCell(RING[0],s));
    for(let p=0;p<=50;p++)assert.deepEqual(cellFor(s,p),RING[ringIndex(s,p)]);
    for(let p=51;p<=HOME;p++)assert.ok(!RING.some(c=>c.join(',')===cellFor(s,p).join(',')));
  }
});
test('yard requires six; entry consumes the roll and grants another roll',()=>{
  const g=game();g.die=5;assert.deepEqual(legalMoves(g),[]);assert.equal(g.move(0),false);
  g.die=6;assert.deepEqual(legalMoves(g),[0,1,2,3]);assert.equal(g.move(0),true);
  assert.equal(g.players[0].pieces[0],0);assert.equal(g.turn,0);assert.equal(g.die,0);
});
test('captures every rival on an unsafe square, preserving friendly pieces',()=>{
  const g=game();g.players[0].pieces=[14,18,-1,-1];g.players[1].pieces=[5,5,-1,-1];g.die=4;
  g.move(0);assert.deepEqual(g.players[1].pieces,[-1,-1,-1,-1]);assert.deepEqual(g.players[0].pieces,[18,18,-1,-1]);assert.equal(g.turn,1);
});
test('safe squares allow opponents to share without capture',()=>{
  for(const target of SAFE){
    const g=game();g.players[0].pieces[0]=target===0?-1:target-1;g.die=target===0?6:1;
    const rival=target<13?3:1,progress=(target-rival*13+52)%52;
    g.players[rival].pieces[0]=progress;g.move(0);assert.equal(g.players[rival].pieces[0],progress);
  }
});
test('private home lane cannot be captured; home needs an exact roll',()=>{
  const g=game();g.players[0].pieces=[55,56,53,-1];g.die=2;
  assert.deepEqual(legalMoves(g),[2]);assert.equal(g.move(0),false);g.die=1;g.move(0);assert.equal(g.players[0].pieces[0],HOME);
  g.turn=1;g.players[1].pieces[0]=37;g.die=1;g.move(0);assert.equal(g.players[0].pieces[2],53);
});
test('no move advances automatically and a third six forfeits only its roll',()=>{
  const g=game();g.rng=1;g.roll();assert.equal(g.lastDie,2);assert.equal(g.turn,1);assert.equal(g.die,0);
  let seed=1;while(true){const probe=new LudoGame(seed);probe.start();probe.roll();if(probe.lastDie===6)break;seed++;}
  g.turn=0;g.rng=seed;g.sixes=2;g.players[0].pieces[0]=10;g.roll();
  assert.equal(g.lastDie,6);assert.equal(g.turn,1);assert.equal(g.sixes,0);assert.equal(g.players[0].pieces[0],10);
});
test('four finished pieces win; rematch resets board without resetting revision or ledger',()=>{
  const g=game();g.players[0].pieces=[56,56,56,55];g.die=1;g.move(3);
  assert.equal(g.phase,'finished');assert.equal(g.winner,0);assert.equal(g.roll(),false);
  const revision=g.revision;g.ledger[1]=9;assert.ok(g.start());assert.equal(g.round,2);assert.ok(g.revision>revision);assert.equal(g.ledger[1],9);
  assert.ok(g.players.every(p=>p.pieces.every(v=>v===-1)));
});
test('only host starts; turns, revisions, sequences and piece indices are validated',()=>{
  const g=new LudoGame(1);g.addPlayer(1,'Juan');g.addPlayer(2,'Ana');
  const action=(id,action,extra={})=>g.accept(id,{action,seq:1,revision:g.revision,...extra},1);
  assert.equal(action(2,'start'),false);assert.equal(action(1,'start'),true);
  assert.equal(action(1,'roll'),false);assert.equal(action(2,'roll'),false);
  assert.equal(action(1,'roll',{seq:2,revision:g.revision-1}),false);
  assert.equal(action(1,'roll',{seq:2}),true);
  g.turn=0;g.die=6;const before=g.snapshot();
  for(const piece of [-1,4,NaN,'0',null])assert.equal(action(1,'move',{seq:3,piece}),false);
  assert.deepEqual(g.snapshot(),before);
});
test('late join and migration preserve pieces, pending dice and seeded future rolls',()=>{
  const g=game();g.players[0].pieces[0]=27;g.die=4;g.removePlayer(2);g.addPlayer(7,'María',{hat:'llanero'});
  const members=new Map([[7,{id:7,name:'María',avatar:{hat:'llanero'}}]]);
  const restored=LudoGame.restore(g.snapshot(),members);
  assert.equal(restored.players[0].id,null);assert.equal(restored.players[0].pieces[0],27);assert.equal(restored.players[1].id,7);
  assert.equal(restored.die,4);assert.equal(restored.rng,g.rng);assert.equal(restored.turn,g.turn);
  assert.equal(restored.move(0),true);assert.equal(restored.players[0].pieces[0],31);
});
test('200 seeded bot matches finish and preserve all sixteen pieces at every action',()=>{
  for(let seed=1;seed<=200;seed++){
    const g=new LudoGame(seed);g.start();let steps=0;
    while(g.phase==='playing'&&steps++<15000){
      assert.ok(g.die?g.move(chooseMove(g)):g.roll());
      for(const p of g.players){assert.equal(p.pieces.length,4);assert.ok(p.pieces.every(v=>Number.isInteger(v)&&v>=-1&&v<=HOME));}
      assert.ok(g.turn>=0&&g.turn<4);
    }
    assert.equal(g.phase,'finished',`seed ${seed}`);assert.ok(g.players[g.winner].pieces.every(v=>v===HOME));
  }
});
