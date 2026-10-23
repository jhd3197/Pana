import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraGuidance } from '../public/camera-guidance.js';

const circle={id:'circle',TOTAL:Math.PI*200,HW:9,
  pointAt:s=>({x:100*Math.cos(s/100),y:100*Math.sin(s/100)}),
  paramOf:(x,z)=>((Math.atan2(z,x)*100)%(Math.PI*200)+Math.PI*200)%(Math.PI*200),
  heightAtS:()=>0};
const car=s=>({x:circle.pointAt(s).x,z:circle.pointAt(s).y,y:0,h:-s/100,vf:40,onGround:true});
const settle=(T,p,state={},options={})=>{let result;for(let i=0;i<120;i++)result=cameraGuidance(T,p,state,1/60,options);return result;};

test('camera anticipates a bend within bounded yaw and roll',()=>{
  const p=car(30),g=settle(circle,p);
  assert.ok(g.heading<p.h-.02,'camera looks into the bend');
  assert.ok(Math.abs(g.heading-p.h)<=.38);
  assert.ok(Math.abs(g.roll)>0&&Math.abs(g.roll)<=.025);
});
test('camera preserves route continuity across the lap seam',()=>{
  const state={};cameraGuidance(circle,car(circle.TOTAL-.2),state,1/60);
  assert.equal(cameraGuidance(circle,car(.2),state,1/60).continuous,true);
});
test('camera rejects a nearby wrong branch and supplies height to projection',()=>{
  let branch=0,seenHeight;
  const T={...circle,paramOf:(x,z,y)=>{seenHeight=y;return branch;}};
  const p={...car(0),y:35},state={};cameraGuidance(T,p,state,1/60);
  branch=200;
  assert.equal(cameraGuidance(T,p,state,1/60).continuous,false);
  assert.equal(state.s,0);assert.equal(seenHeight,35);
});
test('teleport reacquires a branch without retained corner tilt',()=>{
  const state={};settle(circle,car(0),state);
  const p=car(200),g=cameraGuidance(circle,p,state,0);
  assert.equal(g.continuous,true);assert.equal(g.heading,p.h);assert.equal(g.roll,0);
});
test('comfort removes roll immediately while retaining anticipation',()=>{
  const p=car(20),state={};settle(circle,p,state);
  const g=cameraGuidance(circle,p,state,1/60,{comfort:true});
  assert.equal(g.roll,0);assert.ok(g.heading<p.h);
});
test('reverse view, reversing and off-route driving receive no route pull',()=>{
  const p=car(0);
  for(const [c,opts] of [[p,{look:true}],[{...p,vf:-20},{}],[{...p,h:Math.PI},{}],[{...p,x:140},{}]]){
    const g=settle(circle,c,{},opts);assert.ok(Math.abs(g.heading-c.h)<1e-9);assert.equal(g.roll,0);
  }
});
test('vertical anticipation is bounded and absent for boats and flight',()=>{
  const T={...circle,heightAtS:s=>s*.3},p=car(0);
  assert.ok(settle(T,p).rise>0);assert.ok(settle(T,p).rise<=1.2);
  assert.equal(settle(T,{...p,boat:true}).rise,0);
  assert.equal(settle(T,{...p,flyLift:3}).rise,0);
});
test('long frame delays cannot overshoot or produce invalid guidance',()=>{
  const p=car(0),state={},g=cameraGuidance(circle,p,state,10);
  assert.ok(Object.values(g).every(v=>typeof v==='boolean'||Number.isFinite(v)));
  assert.ok(Math.abs(g.heading-p.h)<=.38);assert.ok(Math.abs(g.roll)<=.025);
});
