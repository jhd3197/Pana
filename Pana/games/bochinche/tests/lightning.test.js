import test from 'node:test';
import assert from 'node:assert/strict';
import { LightningTrial } from '../public/lightning-trial.js';
const impact=t=>{for(let i=0;i<30&&!t.impact;i++)t.step(1/60);assert(t.impact);};
test('lightning trial applies one real hit and releases combat hit-stop',()=>{
  const t=new LightningTrial();t.cast();impact(t);
  const f=t.combat.fighters[1], pos={...f.position};
  assert.equal(f.percent,12);assert(t.frozen);assert.equal(t.impacts,1);
  for(let i=0;i<5;i++){t.step(1/60);assert.deepEqual(f.position,pos);}
  for(let i=0;i<20;i++)t.step(1/60);
  assert(!t.frozen);assert.notDeepEqual(f.position,pos);
  for(let i=0;i<100;i++)t.step(1/60);
  assert.equal(t.phase,'done');assert.equal(t.impacts,1);assert.equal(f.percent,12);
});
test('baseline removes hit-stop but preserves damage; reset cancels pending cast',()=>{
  const t=new LightningTrial();t.settings.stop=false;t.cast();impact(t);
  assert(!t.frozen);assert.equal(t.combat.fighters[1].percent,12);
  t.reset();t.cast();t.step(.1);t.reset();
  for(let i=0;i<50;i++)t.step(1/60);
  assert.equal(t.phase,'ready');assert.equal(t.combat.fighters[1].percent,0);assert.equal(t.impacts,1);
});
test('settings latch per cast, spam cannot restart charge, and slow motion preserves result',()=>{
  const t=new LightningTrial();t.settings.slow=true;assert(t.cast());assert(!t.cast());
  t.settings.stop=false;
  for(let i=0;i<30;i++)t.step(1/60);
  assert.equal(t.phase,'charge');
  for(let i=0;i<40&&!t.impact;i++)t.step(1/60);
  assert(t.impact);assert(t.frozen);assert.equal(t.combat.fighters[1].percent,12);
});
