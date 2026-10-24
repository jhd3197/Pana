import assert from 'node:assert/strict';
import test from 'node:test';
import { LudoGame } from '../public/rules.js';
import { automaticMoveDelay, createLudoToss, RESULT_HOLD } from '../public/dice-timing.js';
import { moveHint } from '../public/hud-model.js';

test('automatic entry always leaves a readable result after the strongest bounce',()=>{
  for(const power of [0,.2,.5,1]){
    const g=new LudoGame(1);g.phase='playing';g.entryMisses[0]=g.entryLimits[0]=3;g.roll(power);
    const toss=createLudoToss({from:[-2,2.35,2],to:[1,1.835,0],power});
    assert.equal(g.lastDie,6);assert.equal(g.autoMove.remaining,automaticMoveDelay(power));
    assert.equal(g.stepAutomatic(toss.duration+RESULT_HOLD-.05),false);
    assert.equal(g.players[0].pieces[0],-1);assert.equal(g.stepAutomatic(.06),true);
  }
});
test('move hints describe entry, safe cells, captures and exact finishes from real rules',()=>{
  const g=new LudoGame(1);g.phase='playing';g.die=6;
  assert.equal(moveHint(g,0,0).label,'Sale al camino');
  g.die=2;assert.equal(moveHint(g,0,0).legal,false);
  g.players[0].pieces[0]=6;assert.match(moveHint(g,0,0).label,/segura/);
  g.players[0].pieces[0]=14;g.players[1].pieces[0]=5;g.die=4;
  assert.equal(moveHint(g,0,0).kind,'capture');g.move(0);assert.equal(g.captures[0],1);
  const restored=LudoGame.restore(g.snapshot(),new Map());assert.equal(restored.captures[0],1);
  g.turn=0;g.players[0].pieces[0]=55;g.die=2;assert.match(moveHint(g,0,0).label,/exacto/);
  g.die=1;assert.equal(moveHint(g,0,0).kind,'home');
});
