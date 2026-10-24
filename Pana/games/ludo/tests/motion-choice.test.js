import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMINO, chooseMotion } from '../public/motion-choice.js';

test('cosmetic choices replay without changing RNG or requiring missing partners',()=>{
  const seen=new Set();
  for(let revision=0;revision<300;revision++){
    const state=Object.freeze({rng:123456,revision,seat:revision%4,piece:revision%4,steps:5});
    const style=chooseMotion(state);assert.equal(style,chooseMotion({...state}));
    assert.ok(!['highfive','piggy','dodge'].includes(style));
    seen.add(chooseMotion({...state,friend:true,rival:true}));
    assert.equal(chooseMotion({...state,capture:true}),'hop');
    assert.equal(chooseMotion({...state,steps:1}),'hop');
  }
  assert.deepEqual([...seen].sort(),[...CAMINO].sort());
});
