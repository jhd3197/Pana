import test from 'node:test';
import assert from 'node:assert/strict';
import { attackExtension, analyseImpact, ATTACK_TIMING } from '../public/attack-timing.js';
import { newBody, arenaOf, stepBodies, control, T } from '../public/fight-rules.js';
test('authored punch extension peaks inside its authoritative contact window', () => {
  for(const kind of Object.keys(ATTACK_TIMING)) {
    const hit=analyseImpact(t=>[{x:0,z:attackExtension(kind,t)}],T[kind].total,1000);
    assert.ok(hit.time>=T[kind].active[0]-.001 && hit.time<=T[kind].active[1]);
    assert.equal(attackExtension(kind,T[kind].total),0);
  }
});
test('heavy punch waits for glove extension and hits exactly once', () => {
  const arena=arenaOf('toldo'),a=newBody(1,'red',arena),b=newBody(2,'blue',arena),events=[];
  Object.assign(a,{x:-.5,h:Math.PI/2,act:'trompon'});Object.assign(b,{x:.5,h:-Math.PI/2});
  const step=()=>stepBodies([a,b],arena,.05,new Map(),e=>events.push(e));
  step();step();assert.equal(b.mareo,0);step();assert.ok(b.mareo>0);
  for(let i=0;i<12;i++)step();assert.equal(events.filter(e=>e.type==='trompon').length,1);
});
test('a late combo tap survives recovery and is consumed once',()=>{
  const arena=arenaOf('toldo'),a=newBody(1,'red',arena),b=newBody(2,'blue',arena),events=[];
  Object.assign(a,{act:'jab',at:.3});
  const emit=e=>events.push(e),released={g:false,b:false},none={gp:0,e:0,a:0,t:0};
  control(a,released,{...none,gp:1},emit);
  for(let i=0;i<4;i++){stepBodies([a,b],arena,.05,new Map(),emit);control(a,released,none,emit);}
  assert.equal(events.filter(e=>e.type==='jab').length,1);
  assert.equal(a.buffer,0);assert.equal(a.act,'jab');
});
test('windup keeps sub-tick time so contact does not slip past a dodge',()=>{
  const arena=arenaOf('toldo'),a=newBody(1,'red',arena),b=newBody(2,'blue',arena),events=[];
  Object.assign(a,{x:-.5,h:Math.PI/2,act:'wind',at:.4});
  Object.assign(b,{x:.5,h:-Math.PI/2,act:'dodge',at:.175});
  for(let i=0;i<3;i++)stepBodies([a,b],arena,.05,new Map(),e=>events.push(e));
  assert.ok(events.some(e=>e.type==='dodged'));
  assert.equal(b.mareo,0);assert.ok(b.contra>0);
});
