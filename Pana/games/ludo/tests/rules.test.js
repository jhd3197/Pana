import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoGame, HOME, RING, SAFE, SEAT_CHOICES, cellFor, rotateCell, ringIndex, ludoTrack, legalMoves, chooseMove, eventText } from '../public/rules.js';
import { starterResult } from '../../../engine/play/quien-empieza-rules.js';
// Skips ¿Quién empieza?: seat 0 starts.
const game = (seats=4) => { const g=new LudoGame(123,seats);g.addPlayer(1,'Juan',{hat:'gorra'});g.addPlayer(2,'Ana',{});g.start();g.phase='playing';g.starter=null;return g; };
const cachos = (g, bots) => { for (let i = 0; i < 400 && g.phase === 'starter'; i++) g.stepStarter(.1, bots); };
// A seed whose next throws are exactly these values.
function seedFor(values){
  for(let seed=1;;seed++){
    let rng=seed;const out=values.map(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return 1+Math.floor(rng/4294967296*6);});
    if(out.every((v,i)=>v===values[i]))return seed;
  }
}
test('a match opens with the cachos; the highest starts and nobody moves yet',()=>{
  const g=new LudoGame(1);g.addPlayer(1,'Juan');g.start();
  assert.equal(g.phase,'starter');assert.deepEqual(g.starter.contenders,[0,1,2,3]);assert.equal(g.roll(),false);
  assert.ok(g.accept(1,{action:'starter',cacho:'shake',seq:1,revision:-1},1),'a cacho never waits for the latest revision');
  assert.ok(g.accept(1,{action:'starter',cacho:'slam',power:.8,seq:2,revision:-1},1));
  assert.equal(g.accept(1,{action:'starter',cacho:'slam',power:.8,seq:3,revision:g.revision},1),false,'one slam a round');
  cachos(g);
  const { order, rolls }=starterResult(g.starter);
  assert.equal(g.phase,'playing');assert.equal(g.turn,order[0]);assert.equal(g.starter.slammed[0]??.8,.8);
  assert.match(eventText(g.event),new RegExp(`Empieza ${g.players[order[0]].name} con ${rolls[order[0]]}`));
  assert.ok(g.players.every(p=>p.pieces.every(v=>v===-1)));
});
test('room option: al azar starts at once, revancha puts the last place first',()=>{
  const g=new LudoGame(4);g.options.starter='azar';g.start();
  assert.equal(g.phase,'playing');assert.match(eventText(g.event),/^Orden al azar: ¡Empieza/);
  g.options.starter='revancha';g.players[0].pieces=[56,56,56,55];g.players[2].pieces=[40,-1,-1,-1];g.die=1;g.turn=0;g.move(3);
  assert.equal(g.phase,'finished');assert.equal(g.lastPlace,3,'Beto never left the yard');
  g.start();cachos(g);assert.equal(g.turn,3);
});
test('throw power is clamped and only changes the look of the roll',()=>{
  const a=game(),b=game();a.roll(9);b.roll('fuerte');
  assert.equal(a.toss.power,1);assert.ok(b.toss.power>=0&&b.toss.power<=1);assert.equal(a.lastDie,b.lastDie);
});
test('52 distinct ring cells, rotated starts and private home lanes match the board',()=>{
  assert.equal(RING.length,52);assert.equal(new Set(RING.map(c=>c.join(','))).size,52);
  for(let s=0;s<4;s++){
    assert.deepEqual(cellFor(s,0),rotateCell(RING[0],s));
    for(let p=0;p<=50;p++)assert.deepEqual(cellFor(s,p),RING[ringIndex(s,p)]);
    for(let p=51;p<=HOME;p++)assert.ok(!RING.some(c=>c.join(',')===cellFor(s,p).join(',')));
  }
});
const key=cell=>cell.map(v=>v.toFixed(3)).join(',');
test('five and six seats: a star of distinct ring cells, private lanes and safe starts',()=>{
  for(const seats of [5,6]){
    const {ring,lap,home,safe,cells}=ludoTrack(seats);
    assert.equal(ring,13*seats);assert.equal(lap,13*seats-2);assert.equal(home,lap+6);
    assert.equal(new Set(cells.map(key)).size,ring,'ring cells are unique');
    assert.deepEqual(safe,Array.from({length:seats},(_,s)=>[13*s,13*s+8]).flat());
    const lanes=new Set(),yards=new Set();
    for(let s=0;s<seats;s++){
      assert.deepEqual(cellFor(s,0,0,seats),cells[13*s],'a seat enters on its own start');
      for(let p=0;p<=lap;p++)assert.deepEqual(cellFor(s,p,0,seats),cells[ringIndex(s,p,seats)]);
      for(let p=lap+1;p<home;p++){const c=key(cellFor(s,p,0,seats));assert.ok(!cells.some(r=>key(r)===c));lanes.add(c);}
      for(let piece=0;piece<4;piece++)yards.add(key(cellFor(s,-1,piece,seats)));
      // The last ring cell is the arm's tip, right next to the lane's first cell.
      const [tx,tz]=cellFor(s,lap,0,seats),[lx,lz]=cellFor(s,lap+1,0,seats);assert.ok(Math.abs(Math.hypot(tx-lx,tz-lz)-1)<1e-9);
    }
    assert.equal(lanes.size,5*seats,'lanes never share a cell');assert.equal(yards.size,4*seats);
    // Neighbouring ring cells stay one step apart all the way round.
    for(let i=0;i<ring;i++){const [ax,az]=cells[i],[bx,bz]=cells[(i+1)%ring];assert.ok(Math.hypot(ax-bx,az-bz)<1.5,`step ${i}`);}
    for(const index of cells.keys())assert.equal(ringIndex(Math.floor(index/13),index%13,seats),index,'round trip');
  }
  assert.equal(ludoTrack(4).cells,RING);assert.deepEqual([...ludoTrack(4).safe].sort((a,b)=>a-b),SAFE);assert.equal(ludoTrack(4).home,HOME);
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
  for(const seats of [5,6])for(const target of ludoTrack(seats).safe){
    const g=game(seats),ring=13*seats;g.players[0].pieces[0]=target===0?-1:target-1;g.die=target===0?6:1;
    const rival=target<13?seats-1:1,progress=(target-rival*13+ring)%ring;
    g.players[rival].pieces[0]=progress;g.move(0);assert.equal(g.players[rival].pieces[0],progress);
  }
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
  let seed=1;while(true){const probe=new LudoGame(seed);probe.start();probe.phase='playing';probe.roll();if(probe.lastDie===6)break;seed++;}
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
  assert.equal(action(1,'roll'),false,'no dice during the cachos');
  assert.equal(action(1,'starter',{seq:2,cacho:'slam',power:.7}),true);assert.equal(g.starter.slammed[0],.7);
  assert.equal(action(1,'starter',{seq:2,cacho:'shake'}),false,'a repeated seq');
  g.phase='playing';g.turn=0;g.die=0;
  assert.equal(action(1,'roll',{seq:3,revision:g.revision-1}),false);
  assert.equal(action(1,'roll',{seq:3,power:.7}),true);assert.equal(g.toss.power,.7);
  g.turn=0;g.die=6;const before=g.snapshot();
  for(const piece of [-1,4,NaN,'0',null])assert.equal(action(1,'move',{seq:4,piece}),false);
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
for(const seats of SEAT_CHOICES)test(`200 seeded ${seats}-seat bot matches finish and keep every piece at every action`,()=>{
  const {home}=ludoTrack(seats);
  for(let seed=1;seed<=200;seed++){
    const g=new LudoGame(seed,seats);g.start();
    assert.deepEqual(g.starter.contenders,Array.from({length:seats},(_,s)=>s));
    cachos(g);let steps=0;
    while(g.phase!=='finished'&&steps++<20000){
      assert.ok(g.die?g.move(chooseMove(g)):g.roll());
      assert.equal(g.players.length,seats);
      for(const p of g.players){assert.equal(p.pieces.length,4);assert.ok(p.pieces.every(v=>Number.isInteger(v)&&v>=-1&&v<=home));}
      assert.ok(g.turn>=0&&g.turn<seats);
    }
    assert.equal(g.phase,'finished',`seed ${seed}`);assert.ok(g.players[g.winner].pieces.every(v=>v===home));
  }
});
test('four seats replay the same seeded match as before five and six existed',()=>{
  // Fingerprint of seed 7's whole bot match, recorded on the four-seat-only rules
  // (before extraOnOne existed, so it is switched off here).
  const g=new LudoGame(7);g.options.extraOnOne=false;g.start();cachos(g);const log=[];
  while(g.phase!=='finished'){if(g.die){const m=chooseMove(g);log.push(m);g.move(m);}else{g.roll();log.push(g.lastDie);}}
  assert.deepEqual([g.winner,log.length,g.rng],[0,732,4111943361]);
});


test('forced moves wait for the die, survive migration and execute only once',()=>{
  const g=game();g.players[0].pieces=[8,-1,-1,-1];g.rng=seedFor([2]);g.roll();
  assert.equal(g.autoMove.piece,0);assert.equal(g.stepAutomatic(.5),false);
  const restored=LudoGame.restore(g.snapshot(),new Map());
  assert.equal(restored.stepAutomatic(.7),false);
  assert.equal(restored.stepAutomatic(restored.autoMove.remaining+.01),true);assert.equal(restored.players[0].pieces[0],10);
  assert.equal(restored.stepAutomatic(2),false);assert.equal(restored.turn,1);
  g.move(0);assert.equal(g.autoMove,null);assert.equal(g.stepAutomatic(2),false);
});

test('entry is automatic but a six with a moving piece preserves the choice',()=>{
  const g=game();g.rng=seedFor([6]);g.roll();assert.equal(g.autoMove.piece,0);
  g.stepAutomatic(g.autoMove.remaining+.01);assert.equal(g.players[0].pieces[0],0);
  g.rng=seedFor([6]);g.roll();assert.equal(g.autoMove,null);assert.equal(legalMoves(g).length,4);
});

test('assisted entry bounds droughts equally for every seat, including late-game yards',()=>{
  for(let seat=0;seat<4;seat++){
    const g=game();g.players[seat].pieces=[HOME,HOME,-1,-1];
    g.entryLimits[seat]=3+seat%3;
    for(let attempt=0;attempt<g.entryLimits[seat];attempt++){
      g.turn=seat;g.rng=seedFor([2]);g.roll();assert.equal(g.lastDie,2);
      assert.equal(g.entryMisses[seat],attempt+1);
    }
    const restored=LudoGame.restore(g.snapshot(),new Map());restored.turn=seat;restored.rng=seedFor([2]);restored.roll();
    assert.equal(restored.lastDie,6);assert.match(eventText(restored.event),/Salida asistida/);
    restored.stepAutomatic(restored.autoMove.remaining+.01);assert.equal(restored.players[seat].pieces[2],0);
    assert.equal(restored.entryMisses[seat],0);
    restored.phase='finished';restored.start();assert.deepEqual(restored.entryMisses,[0,0,0,0]);
  }
});

test('classic dice are unchanged and entry help does not alter moving or finishing rolls',()=>{
  const g=game();g.options.assistedEntry=false;
  for(let n=0;n<8;n++){g.turn=0;g.rng=seedFor([2]);g.roll();assert.equal(g.lastDie,2);}
  g.options.assistedEntry=true;g.players[0].pieces=[55,HOME,HOME,HOME];g.turn=0;g.rng=seedFor([2]);g.roll();assert.equal(g.lastDie,2);
  g.players[0].pieces=[5,-1,-1,-1];g.turn=0;g.rng=seedFor([2]);g.roll();assert.equal(g.lastDie,2);assert.equal(g.entryMisses[0],0);
});


test('entry assistance uses varied thresholds without changing ordinary random rolls',()=>{
 const limits=new Set();
 for(let seed=1;seed<=300;seed++){
  const g=game();g.rng=seed;g.roll();
  if(g.entryLimits[0])limits.add(g.entryLimits[0]);
  const classic=game();classic.options.assistedEntry=false;classic.rng=seed;classic.roll();
  assert.equal(g.lastDie,classic.lastDie,'no adjustment before a drought');
 }
 assert.deepEqual([...limits].sort(),[3,4,5]);
});


test('each yard has a centered symmetric two-by-two set of pieces', async () => {
  const {cellFor,rotateCell}=await import('../public/rules.js');
  for(let seat=0;seat<4;seat++) {
    const points=Array.from({length:4},(_,piece)=>cellFor(seat,-1,piece));
    const center=rotateCell([2.5,11.5],seat);
    for(let axis=0;axis<2;axis++) {
      assert.equal(points.reduce((sum,p)=>sum+p[axis],0)/4,center[axis]);
      assert.deepEqual([...new Set(points.map(p=>p[axis]-center[axis]))].sort(),[-1,1]);
    }
  }
});

test('an idle pana gets the bot move once their turn time runs out', () => {
  const g = new LudoGame(7);
  g.addPlayer(1, 'Ana');
  Object.assign(g, { phase: 'playing', turn: 0, die: 0 });
  assert.equal(g.options.turnSeconds, 60);
  assert.equal(g.stepIdle(59), false);
  assert.equal(g.die, 0, 'still waiting on Ana');
  assert.equal(g.stepIdle(1.5), true);
  assert.ok(g.lastDie > 0, 'the die was rolled for her');
  g.options.turnSeconds = 0; Object.assign(g, { turn: 0, die: 0, turnPause: null, autoMove: null });
  assert.equal(g.stepIdle(999), false, 'no limit: the table waits');
});
