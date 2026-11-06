import assert from 'node:assert/strict';
import test from 'node:test';
import { LudoGame } from '../public/rules.js';
import { automaticMoveDelay, presentedState, pauseTick, hostTick, createLandingGate, rollKey, LANDING_WAIT, RESULT_HOLD, BEAT_TICK, HOP, FLIGHT, motionDuration } from '../public/dice-timing.js';

test('missed throws retain the acting seat and reject the next player until the result settles',()=>{
  for(const power of [0,.5,1]){
    const g=new LudoGame(1);g.addPlayer('a','A');g.addPlayer('b','B');g.phase='playing';
    g.roll(power);assert.equal(g.die,0);assert.equal(g.turn,1);
    assert.equal(presentedState(g).turn,0);
    const restored=LudoGame.restore(g.snapshot(),new Map([['a',{id:'a',name:'A'}],['b',{id:'b',name:'B'}]]));
    assert.equal(restored.accept('b',{seq:1,revision:restored.revision,action:'roll'},'a'),false);
    assert.equal(restored.stepPause(automaticMoveDelay(power)-.01),false);
    assert.equal(restored.stepPause(.02),true);assert.equal(presentedState(restored).turn,1);
    assert.equal(restored.accept('b',{seq:1,revision:restored.revision,action:'roll'},'a'),true);
  }
});

test('a pause tracks the wall clock at any tick spacing and always keeps its closing beat',()=>{
  const run=spacing=>{
    const g=new LudoGame(1);g.addPlayer('a','A');g.addPlayer('b','B');g.phase='playing';g.roll(.5);
    const delay=g.turnPause.remaining;let ticks=0,afterBeat=0;
    while(g.turnPause){
      if(g.turnPause.remaining<=RESULT_HOLD)afterBeat++;
      g.stepPause(pauseTick(g.turnPause.remaining,spacing));ticks++;
    }
    return {delay,ticks,afterBeat,elapsed:ticks*spacing};
  };
  // A healthy host: real time, give or take a tick.
  const fast=run(.1);
  assert.ok(Math.abs(fast.elapsed-fast.delay)<=.2,`${fast.delay}s pause took ${fast.elapsed}s`);
  // A loaded host: the landing tick, then the beat in ticks, never a stretched flight.
  const beatTicks=Math.ceil(RESULT_HOLD/BEAT_TICK);
  for(const spacing of [1,4,23]){
    const slow=run(spacing);
    assert.ok(slow.elapsed>=slow.delay,'a pause never ends early');
    assert.ok(slow.ticks<=Math.ceil((slow.delay-RESULT_HOLD)/spacing)+beatTicks,`${slow.ticks} ticks at ${spacing}s`);
    assert.equal(slow.afterBeat,beatTicks,'the result stays up for several ticks after the landing');
  }
  assert.equal(hostTick(.1),.1);assert.equal(hostTick(60),.75);
});

test('a missed roll holds its result after the last client lands, however late',()=>{
  // Seconds after the roll that each client's die lands; the guest's toss starts late.
  const hold=({lands,spacing,members=Object.keys(lands)})=>{
    const g=new LudoGame(1);g.addPlayer('a','A');g.addPlayer('b','B');g.phase='playing';g.roll(.5);
    const gate=createLandingGate(),roll=rollKey(g);let now=0;
    while(g.turnPause){
      now+=spacing;
      for(const [id,at] of Object.entries(lands))if(at<=now)gate.land(roll,id);
      g.stepPause(gate.spend(roll,g.turnPause,members,spacing));
    }
    return now;
  };
  const delay=automaticMoveDelay(.5),flight=delay-RESULT_HOLD;
  for(const spacing of [.05,.1,.5,2,4]){
    for(const late of [0,1,2.7,5]){
      const last=flight+late;
      const over=hold({lands:{a:flight,b:last},spacing});
      assert.ok(over-last>=RESULT_HOLD-spacing,`${spacing}s ticks, ${late}s late: held ${over-last}s`);
    }
  }
  // Nothing late, nothing added: a healthy table keeps its real length.
  assert.ok(Math.abs(hold({lands:{a:flight,b:flight},spacing:.05})-delay)<=.15);
  // A client that never reports costs the wait and then lets go.
  const frozen=hold({lands:{a:flight},members:['a','b'],spacing:.1});
  assert.ok(frozen>=flight+LANDING_WAIT&&frozen<=flight+LANDING_WAIT+RESULT_HOLD+.5,`frozen client: ${frozen}s`);
});

test('the landing gate leaves other pauses alone and forgets the previous roll',()=>{
  const gate=createLandingGate();
  assert.equal(gate.spend('1:1',{kind:'move',remaining:1},['a'],.1),.1);
  assert.equal(gate.spend('1:1',{kind:'roll',remaining:3},['a'],.1),.1);
  assert.equal(gate.spend('1:1',{kind:'roll',remaining:1},['a'],.1),0);
  gate.land('1:1','a');
  assert.equal(gate.spend('1:1',{kind:'roll',remaining:1},['a'],.1),.1);
  assert.equal(gate.spend('1:2',{kind:'roll',remaining:1},['a'],.1),0);
});

test('capture pauses cover every hop and the full return; bonus throws also wait',()=>{
  const g=new LudoGame(1);g.addPlayer('a','A');g.phase='playing';g.options.captureBonus=true;
  g.players[0].pieces[0]=14;g.players[1].pieces[0]=5;g.die=4;g.move(0);
  assert.equal(g.players[1].pieces[0],-1);assert.equal(g.turn,0);
  assert.ok(g.turnPause.remaining>4*HOP+FLIGHT);
  assert.ok(g.turnPause.remaining>motionDuration(4));
  assert.equal(g.accept('a',{seq:1,revision:g.revision,action:'roll'},'a'),false);
  g.stepPause(10);assert.equal(g.accept('a',{seq:1,revision:g.revision,action:'roll'},'a'),true);
  g.phase='finished';g.start();assert.equal(g.turnPause,null);
});

test('third six forfeits hold the throwing seat before handing over',()=>{
  const g=new LudoGame(1);g.phase='playing';g.sixes=2;g.entryMisses[0]=g.entryLimits[0]=3;
  g.roll(1);assert.equal(g.lastDie,6);assert.equal(g.turn,1);
  assert.equal(presentedState(g).turn,0);assert.equal(g.autoMove,null);
  assert.equal(g.turnPause.remaining,automaticMoveDelay(1));
});
