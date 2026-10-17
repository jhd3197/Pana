import test from 'node:test';
import assert from 'node:assert/strict';
import { rainWave, chancletaSpeed } from '../public/item-rules.js';
import { isGhost, recordImpact, stepProtection } from '../public/recovery-rules.js';
import { resolveContact } from '../public/rules.js';
import { packPose, FLAG, POSE_LENGTH } from '../public/online-rules.js';
import { CAR_DEFINITIONS as cars } from '../public/car-definitions.js';
import { composeTune, wheelById } from '../public/wheel-definitions.js';
import { applyRaceQuality } from '../public/quality.js';

test('rain ripples from the caller toward first place, with longer leader exposure', () => {
  const racers = Array.from({length:8},(_,i)=>({id:i}));
  const wave = rainWave(racers,racers[6]);
  assert.deepEqual(wave.map(w=>w.target.id),[5,4,3,2,1,0]);
  assert.equal(wave[0].delay,0.75);
  for(let i=1;i<wave.length;i++) {
    assert.ok(Math.abs(wave[i].delay-wave[i-1].delay-1.8)<1e-8);
    assert.ok(wave[i].time>wave[i-1].time);
  }
  assert.deepEqual(rainWave(racers,racers[0]),[]);
  assert.deepEqual(rainWave(racers,{}),[]);
  racers[2].done=true;
  assert.ok(!rainWave(racers,racers[6]).some(w=>w.target.id===2));
});

test('chancleta can close a full circuit on a turboing leader', () => {
  for(const speed of [0,40,65,90]) for(const gap of [40,1300,2700]) {
    assert.ok(chancletaSpeed(gap,speed)-speed>=65);
    assert.ok(gap/(chancletaSpeed(gap,speed)-speed)<=7.01);
  }
});

test('repeated distinct impacts protect the driver; expiry waits for separation', () => {
  const c={x:0,y:0,z:0}, other={x:1,y:0,z:0};
  recordImpact(c,1); recordImpact(c,1.01);
  assert.equal(isGhost(c),false,'one collision over several ticks is not a pileup');
  recordImpact(c,2);
  assert.equal(isGhost(c),true);
  for(let i=0;i<300;i++)stepProtection(c,[c,other],1/60);
  assert.ok(c.phaseT>0,'cannot become solid inside a rival');
  other.x=10;
  for(let i=0;i<30;i++)stepProtection(c,[c,other],1/60);
  assert.equal(isGhost(c),false);
  c.ghost=true;stepProtection(c,[c],1);
  assert.equal(isGhost(c),true,'connection ghosts do not time out');
  const weapons={};recordImpact(weapons,1,true);recordImpact(weapons,1,true);
  assert.equal(isGhost(weapons),true,'two separate weapons in one tick still grant protection');
});

test('ordinary contact and maximum speed head-on impacts remain bounded', () => {
  const car=(fields)=>({x:0,y:0,z:0,h:0,vx:0,vz:0,def:{tune:{mass:1}},...fields});
  const a=car({vx:9}), b=car({x:3});
  assert.equal(resolveContact(a,b).kind,'bump');
  const fast=car({vx:70}), opposite=car({x:3,vx:-70});
  const hit=resolveContact(fast,opposite);
  assert.ok(Math.abs(fast.vx-70)<11 && hit.a.power<=10);
  const same=car();resolveContact(same,car());
  assert.ok(Number.isFinite(same.x) && Math.abs(same.x)>0,'coincident cars separate');
});

test('timed ghost fits the existing pose without increasing the packet', () => {
  const p=packPose({x:0,y:0,z:0,h:0,pitch:0,roll:0,vf:0,steer:0,spin:0,boost:0,lap:0,prog:0,lost:0,phaseT:3});
  assert.equal(p.length,POSE_LENGTH);
  assert.ok(p[10]&FLAG.phase);
});

test('car talents and wheel choices reward different driving skills', () => {
  const tune=(id,wheel)=>composeTune(cars.find(c=>c.id===id).tune,wheelById(wheel).profile);
  const rumbera=tune('rumbera','palo'), bala=tune('bala','slick');
  assert.ok(bala.top>rumbera.top && bala.top/rumbera.top<1.16);
  assert.ok(rumbera.driftCharge/bala.driftCharge>1.8);
  assert.ok(rumbera.driftBoost/bala.driftBoost>1.7);
  assert.ok(tune('chamo','calle').accel>tune('chamo','slick').accel*1.15);
  assert.ok(tune('machito','barro').offroadResist>0.87);
  const wetTop=t=>t.top*(1-0.4*t.wetDrag);
  assert.ok(wetTop(tune('bala','lluvia'))>wetTop(bala)*1.2);
  assert.ok(tune('montanero','calle').trickBoost>1.6);
});

test('quality handles both single and multi-material scenery and restores detail', () => {
  const road={material:{userData:{roadDetail:{value:1}}}}, flags={userData:{detailLevel:2}};
  road.userData={};
  const objects=[road,flags,{userData:{},material:[{userData:{}},{userData:{}}]}];
  const renderer={shadowMap:{enabled:true}};
  const race={trackGroup:{traverse:fn=>objects.forEach(fn)}};
  applyRaceQuality(renderer,race,'baja');
  assert.equal(road.material.userData.roadDetail.value,0);
  assert.equal(flags.visible,false);assert.equal(renderer.shadowMap.enabled,false);
  applyRaceQuality(renderer,race,'alta');
  assert.equal(road.material.userData.roadDetail.value,1);
  assert.equal(flags.visible,true);assert.equal(renderer.shadowMap.enabled,true);
});
