import assert from 'node:assert/strict';
import test from 'node:test';
import { LudoGame } from '../public/rules.js';
import { automaticMoveDelay, presentedState, HOP, FLIGHT, motionDuration } from '../public/dice-timing.js';

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
