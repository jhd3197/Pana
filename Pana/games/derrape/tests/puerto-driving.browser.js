// Real moving cars on both gate levels and over the castle's full-width jump.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {menuStep} from './menu-helpers.js';
const base=process.env.PANA_TEST_URL||'http://localhost:8461',out='art/studio/puerto';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/g/derrape/?debug&manual&track=puerto`);await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
 await menuStep(page,'ready');
 assert.equal(await page.evaluate(()=>setup.laps),1,'Puerto starts as one adventure lap');
 assert.match(await page.locator('#ready-route').textContent(),/3:00.*4:00.*1 vuelta/,'full-race estimate is visible before playing');
 await page.locator('[data-laps="3"]').click();assert.equal(await page.evaluate(()=>setup.laps),3,'explicit lap choice remains available');
 assert.match(await page.locator('#ready-route').textContent(),/3 vueltas/);
 await menuStep(page,'track');await page.locator('[data-circuit="estadio"]').click();
 assert.equal(await page.evaluate(()=>setup.laps),3,'ordinary tracks retain three laps');
 await page.locator('[data-circuit="puerto"]').click();assert.equal(await page.evaluate(()=>setup.laps),1);
 const metrics=await page.evaluate(async()=>{
  const {placeOnTrack}=await import('/g/derrape/track-kit.js');await startRace(0);race.state='go';race.count=0;
  const T=getActiveTrack(),c=race.player,wrap=d=>Math.atan2(Math.sin(d),Math.cos(d));
  function reset(s,speed=28){const p=placeOnTrack(T,s,0);Object.assign(c,{x:p.x,z:p.z,y:p.y,h:p.h,vx:Math.sin(p.h)*speed,vz:Math.cos(p.h)*speed,vf:speed,vr:0,vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost:0,spin:0,coins:0,lap:1,prog:(s-T.LINE+T.TOTAL)%T.TOTAL,drift:0,driftHeld:false,cloud:0,stall:0,rescueT:0,stuckT:0,outT:0,phaseT:0});}
  function drive(s,frames=360,speed=28){reset(s,speed);let previous=s,maxStep=0,minY=Infinity,maxY=-Infinity,maxOffset=0,maxAir=0,airTime=0;
    for(let i=0;i<frames;i++){
      const along=T.paramOf(c.x,c.z,c.y),aim=placeOnTrack(T,along+13+Math.abs(c.vf)*.18,0),diff=wrap(Math.atan2(aim.x-c.x,aim.z-c.z)-c.h);
      stepCar(c,{throttle:1,steer:Math.max(-1,Math.min(1,diff*3))},1/60);
      const next=T.paramOf(c.x,c.z,c.y);maxStep=Math.max(maxStep,Math.abs(next-previous));previous=next;
      minY=Math.min(minY,c.y);maxY=Math.max(maxY,c.y);maxOffset=Math.max(maxOffset,Math.abs(T.offsetOf(c.x,c.z,c.y)));
      maxAir=Math.max(maxAir,c.y-T.groundAt(c.x,c.z,c.y));if(!c.onGround)airTime+=1/60;
    }return {minY,maxY,maxOffset,maxStep,maxAir,airTime,end:previous,travel:previous-s,landed:c.onGround,speed:Math.hypot(c.vx,c.vz)};
  }
  const lower=T.paramOf(-50,-640,142.2),upper=T.paramOf(-50,-640,190.2);
  const low=drive(lower-45,180),high=drive(upper-45,180),jump=drive(T.ramps[0].s0-35,420,33);
  const asphalt=drive(T.TOTAL*.19,240,0),mud=drive(T.TOTAL*.34,240,0);
  return {lower,upper,low,high,jump,asphalt,mud};
 });
 await writeFile(`${out}/driving.json`,JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics));
 assert.ok(Math.abs(metrics.upper-metrics.lower)>700);
 for(const [name,run,height] of [['gate',metrics.low,142.2],['battlements',metrics.high,190.2]]){
  assert.ok(run.maxStep<2,`${name}: continuous progress, no level switch`);assert.ok(run.travel>70,`${name}: drives through crossing`);
  assert.ok(Math.abs(run.minY-height)<.2&&Math.abs(run.maxY-height)<.2,`${name}: correct deck height`);assert.ok(run.maxOffset<6);
 }
 assert.ok(metrics.jump.airTime>.3&&metrics.jump.maxAir>3,'castle exit launches a moving kart');assert.ok(metrics.jump.landed&&metrics.jump.travel>150,'jump lands and continues');
 assert.ok(metrics.jump.maxStep<2&&metrics.jump.maxOffset<6,'airborne progress stays continuous and lands inside the lane');
 assert.ok(metrics.mud.speed<metrics.asphalt.speed,'mud changes actual driving response');assert.deepEqual(errors,[]);
}finally{await browser.close();}
