import test from 'node:test';
import assert from 'node:assert/strict';
import { TrifulcaRoom } from '../public/network.js';

test('a stalled host publishes the windup instead of skipping straight to damage',()=>{
  const room=new TrifulcaRoom({name:'Ana',avatar:{}});room.practice();
  room.game.startTutorial(1);room.game.tutorial.step=5;
  const [me,profe]=room.game.bodies;
  Object.assign(me,{x:-.5});Object.assign(profe,{x:.5,act:'wind',at:0});
  room.tick(1,{});
  assert.equal(room.state.bodies[1].act,'wind');
  assert.ok(Math.abs(room.state.bodies[1].at-.1)<1e-8);
  assert.equal(room.state.bodies[0].mareo,0);
  assert.ok(Math.abs(room.state.tutorial.clock-.1)<1e-8);
});
