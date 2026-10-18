import test from 'node:test';
import assert from 'node:assert/strict';
import { DominoGame, deck, chooseMove, legalMoves } from '../public/rules.js';
import { maxPip } from '../public/options.js';
import { PIPS, chainLayout } from '../public/tiles.js';

test('a fifth lobby member expands to six; a smaller table never drops a human',()=>{
 const g=new DominoGame();for(let id=1;id<=6;id++)assert.equal(g.addPlayer(id,`P${id}`),true);
 assert.equal(g.options.seats,6);assert.equal(g.configure({seats:4}),false);g.start();
 assert.equal(g.players.filter(p=>p.id!==null).length,6);assert.ok(g.players.every(p=>p.hand.length===7));assert.equal(maxPip(g.options),9);
});
test('six hands of ten use double twelve; undealt tiles stay out of play',()=>{
 const g=new DominoGame(27);g.configure({seats:6,handSize:10});g.start();
 const tiles=[...g.players.flatMap(p=>p.hand),...g.reserve];assert.equal(tiles.length,91);assert.equal(new Set(tiles.map(t=>t.id)).size,91);assert.equal(g.reserve.length,31);
 assert.deepEqual(legalMoves(g),[{tile:'6-6',end:'right'}]);for(let n=0;n<=12;n++)assert.equal(PIPS[n].length,n);
});
test('individual scoring rewards only the winner; six-player teams alternate',()=>{
 for(const mode of ['individual','teams']){
  const g=new DominoGame();g.configure({mode,seats:6});g.players.forEach((p,i)=>p.hand=[{id:`${i}-${i}`,a:i,b:i}]);
  g.finish(0,'out',0);assert.equal(g.scores.length,mode==='teams'?2:6);assert.equal(g.scores[0],mode==='teams'?18:30);assert.ok(g.scores.slice(1).every(n=>n===0));
 }
});
test('all opener choices are playable and double six applies every chosen hand',()=>{
 const random=new DominoGame(4);random.configure({opener:'random'});random.start();assert.equal(legalMoves(random).length,7);
 const double=new DominoGame(6);double.configure({opener:'double6'});double.start();double.finish(0,'out',0);double.start();assert.deepEqual(legalMoves(double),[{tile:'6-6',end:'right'}]);
 const winner=new DominoGame();winner.start();winner.finish(1,'out',3);winner.start();assert.equal(winner.turn,3);assert.equal(legalMoves(winner).length,7);
});
function blocked(options){const g=new DominoGame();g.configure(options);g.phase='playing';g.round=2;g.chain=[{id:'6-6',a:6,b:6}];g.players.forEach((p,i)=>p.hand=[{id:`${i}-${i}`,a:i,b:i}]);return g;}
test('passes award ten to the previous opponent; redeal blocks skip hand points',()=>{
 const scored=blocked({passScore:true});scored.pass(0);assert.equal(scored.scores[1],10);
 const split=blocked({blocked:'redeal'});for(let i=0;i<4;i++)split.pass(i);assert.deepEqual(split.scores,[0,0]);assert.equal(split.result.reason,'redeal');assert.equal(split.result.winner,null);
});
test('a match won through pass points reports the score leader, not the last hand winner',()=>{
 const g=blocked({passScore:true});g.scores=[0,100];g.finish(0,'out',0);
 assert.equal(g.phase,'finished');assert.equal(g.result.winner,0);assert.equal(g.result.matchWinner,1);
});
test('capicúa options add 25, double hand points, or leave normal scoring',()=>{
 for(const [capicua,points]of [['25',33],['double',16],['normal',8]]){
  const g=blocked({capicua});g.chain=[{id:'2-4',a:2,b:4},{id:'4-5',a:4,b:5}];g.players[0].hand=[{id:'2-5',a:2,b:5}];
  g.play(0,'2-5','left');assert.equal(g.result.capicua,true);assert.equal(g.result.points,points);
 }
});
test('turn deadline plays a valid tile and the remaining time survives migration',()=>{
 const g=new DominoGame(11);g.configure({turnSeconds:15,target:200});g.addPlayer(1,'Ana');g.start();
 for(let i=0;i<10;i++)g.clock(1);assert.equal(g.turnRemaining,5);
 const copy=DominoGame.restore(g.snapshot(),new Map([[1,{id:1,name:'Ana'}]]));assert.equal(copy.turnRemaining,5);
 const before=copy.chain.length;for(let i=0;i<5;i++)copy.clock(1);assert.equal(copy.chain.length,before+1);assert.equal(copy.turnRemaining,15);
 copy.scores=[100,0];copy.finish(0,'out',0);assert.notEqual(copy.phase,'finished');
});
test('options and quick chat use host authority, revision and sequence protection',()=>{
 const g=new DominoGame();g.addPlayer(1,'Ana');g.addPlayer(2,'Luis');const apply=(id,action,extra={})=>g.accept(id,{seq:(g.ledger[id]||0)+1,revision:g.revision,action,...extra},1);
 assert.equal(apply(2,'options',{patch:{target:200}}),false);assert.equal(apply(1,'options',{patch:{target:200,handSize:8}}),false);
 assert.equal(apply(1,'options',{patch:{target:200}}),true);assert.equal(apply(2,'chat',{message:0}),true);assert.equal(g.chat[0].name,'Luis');
 assert.equal(apply(1,'options',{patch:{quickChat:false}}),true);assert.equal(apply(2,'chat',{message:1}),false);
 apply(1,'start');assert.equal(apply(1,'options',{patch:{target:100}}),false);
});
test('expanded bot rounds conserve full decks and finish in teams and individually',()=>{
 for(const mode of ['teams','individual'])for(let seed=1;seed<=80;seed++){
  const g=new DominoGame(seed);g.configure({seats:6,handSize:seed%2?7:10,mode,opener:'random'});g.start();let steps=0;
  while(g.phase==='playing'&&steps++<400){const m=chooseMove(g);m?g.play(g.turn,m.tile,m.end):g.pass(g.turn);}
  assert.notEqual(g.phase,'playing');const all=[...g.chain,...g.reserve,...g.players.flatMap(p=>p.hand)];assert.equal(all.length,deck(maxPip(g.options)).length);assert.equal(new Set(all.map(t=>t.id)).size,all.length);
 }
 assert.equal(chainLayout(60).length,60);
});

test('host reset restores map and rules in one revision while retaining occupied extra seats',()=>{
 const g=new DominoGame();for(let id=1;id<=6;id++)g.addPlayer(id,`P${id}`);g.configure({handSize:10});g.mapId='hato';
 const patch={...g.options,handSize:7}, revision=g.revision;
 assert.equal(g.accept(2,{action:'options',patch,resetMap:true,seq:1,revision},1),false);assert.equal(g.mapId,'hato');
 assert(g.accept(1,{action:'options',patch,resetMap:true,seq:1,revision},1));assert.equal(g.mapId,'plaza');assert.equal(g.options.handSize,7);assert.equal(g.players.filter(p=>p.id!==null).length,6);assert.equal(g.revision,revision+1);
});
