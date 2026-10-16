// Real car simulation: grass penalties, recovery and natural obstacles.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/selva';
await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/g/derrape/?debug&manual&track=selva`);await page.waitForFunction(()=>window.garage?.car);
  const metrics=await page.evaluate(async()=>{
    const {placeOnTrack}=await import('/g/derrape/track-kit.js'),{roughnessAt}=await import('/g/derrape/offroad.js');
    const {RIVER_SAMPLES}=await import('/g/derrape/tracks/selva-layout.js');
    await startRace(0);race.state='go';race.count=0;const T=getActiveTrack(),c=race.player;
    function reset(off,speed=0,boost=0,u=0.19) {
      const p=placeOnTrack(T,u*T.TOTAL,off);
      Object.assign(c,{x:p.x,z:p.z,y:T.groundAt(p.x,p.z),h:p.h,vx:Math.sin(p.h)*speed,vz:Math.cos(p.h)*speed,
        vf:speed,vr:0,vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost,spin:0,coins:0,lap:1});
      return p;
    }
    const p=reset(13);stepCar(c,{throttle:0,steer:0},1/60);
    const noSnap={distance:Math.hypot(c.x-p.x,c.z-p.z),offset:Math.abs(T.offsetOf(c.x,c.z))};
    const drive=(off,boost=0)=>{
      const p=reset(off,33,boost);let minRough=1;
      // Hold a lane with actual steering while the road bends. Driving straight
      // would accidentally swap the road/grass samples during this comparison.
      for(let i=0;i<120;i++) {
        const target=placeOnTrack(T,T.paramOf(c.x,c.z)+8+Math.abs(c.vf)*0.16,off);
        const angle=Math.atan2(target.x-c.x,target.z-c.z)-c.h,diff=Math.atan2(Math.sin(angle),Math.cos(angle));
        minRough=Math.min(minRough,roughnessAt(T,c.x,c.z));stepCar(c,{throttle:1,steer:Math.max(-1,Math.min(1,diff*3.8))},1/60);
      }
      return {speed:Math.hypot(c.vx,c.vz),distance:Math.hypot(c.x-p.x,c.z-p.z),minRough,offset:Math.abs(T.offsetOf(c.x,c.z))};
    };
    const road=drive(0),grass=drive(14),boostedGrass=drive(14,3);
    const recoveryStart=reset(13,5),center=placeOnTrack(T,0.19*T.TOTAL);c.h=Math.atan2(center.x-c.x,center.z-c.z);
    c.vx=Math.sin(c.h)*5;c.vz=Math.cos(c.h)*5;
    for(let i=0;i<60;i++)stepCar(c,{throttle:0.4,steer:0},1/60);
    const recovery={start:Math.abs(T.offsetOf(recoveryStart.x,recoveryStart.z)),end:Math.abs(T.offsetOf(c.x,c.z)),groundError:Math.abs(c.y-T.groundAt(c.x,c.z))};
    // Run actual collision responses against authored trunks from multiple sides.
    const trunks=T.group.getObjectByName('track-environment').userData.jungle.colliders.filter(p=>['ceiba','jungleGiant'].includes(p.kind)&&
      [[4,0],[-4,0],[0,4],[0,-4]].every(([x,z])=>Math.abs(T.terrainAt(p.x+x,p.z+z)-p.base-0.12)<1.8)).sort((a,b)=>(b.kind==='jungleGiant')-(a.kind==='jungleGiant')),trunkFailures=[];
    if(!trunks.some(p=>p.kind==='jungleGiant'))throw Error('No giant-tree trunk collision case');
    for(const tree of trunks.slice(0,15))for(const direction of [0,Math.PI/2]) {
      const dx=Math.cos(direction),dz=Math.sin(direction),previous={x:tree.x+dx*(tree.radius+1.7),z:tree.z+dz*(tree.radius+1.7)};
      const car={x:tree.x+dx*(tree.radius+0.9),z:tree.z+dz*(tree.radius+0.9),y:tree.base+0.1,vx:-dx*10,vz:-dz*10};
      T.constrainMotion(car,previous);
      if(Math.hypot(car.x-tree.x,car.z-tree.z)<tree.radius+1.49)trunkFailures.push({...tree,phase:'entry'});
      // Starting close to a trunk must not prevent reversing out of it.
      const overlap={x:tree.x+dx*(tree.radius+1.1),z:tree.z+dz*(tree.radius+1.1)};
      Object.assign(car,{x:previous.x,z:previous.z,vx:dx*5,vz:dz*5});T.constrainMotion(car,overlap);
      if(Math.hypot(car.x-tree.x,car.z-tree.z)<tree.radius+1.6)trunkFailures.push({...tree,phase:'escape'});
    }
    const tunnelFailures=[];
    for(const u of [0.45,0.47,0.5])for(const side of [-1,1]) {
      const previous=placeOnTrack(T,u*T.TOTAL,side*10.6),next=placeOnTrack(T,u*T.TOTAL,side*11.8);
      const car={...next,y:previous.y,vx:(next.x-previous.x)*10,vz:(next.z-previous.z)*10};T.constrainMotion(car,previous);
      if(Math.abs(T.offsetOf(car.x,car.z))>11.11)tunnelFailures.push({u,side});
    }
    let waterCases=0;const waterFailures=[];
    for(let i=30;i<140;i+=10)for(const side of [-1,1]) {
      const p=RIVER_SAMPLES[i],q=RIVER_SAMPLES[i+1],length=Math.hypot(q.x-p.x,q.z-p.z),nx=-(q.z-p.z)/length*side,nz=(q.x-p.x)/length*side;
      const bank={x:p.x+nx*3,z:p.z+nz*3},deep={x:p.x+nx*2,z:p.z+nz*2};
      if(Math.abs(T.offsetOf(bank.x,bank.z))<T.HW+5||T.terrainAt(bank.x,bank.z)>-1.5)continue;
      waterCases++;
      const car={...deep,y:-1.6,vx:-nx*5,vz:-nz*5};T.constrainMotion(car,bank);
      if(Math.hypot(car.x-bank.x,car.z-bank.z)>0.5)waterFailures.push({i,side,phase:'deeper'});
      Object.assign(car,{...bank,vx:nx*5,vz:nz*5});T.constrainMotion(car,deep);
      if(Math.hypot(car.x-bank.x,car.z-bank.z)>0.001)waterFailures.push({i,side,phase:'escape'});
    }
    const surfaceCases=[];
    for(let u=0.08;u<0.9;u+=0.02)for(const side of [-1,1])for(let offset=15;offset<40;offset+=2) {
      const a=placeOnTrack(T,u*T.TOTAL,side*offset),b=placeOnTrack(T,u*T.TOTAL,side*(offset+0.7));
      const from=T.terrainAt(a.x,a.z),to=T.terrainAt(b.x,b.z);
      if((to-from<0.8||from<0)||Math.abs(T.offsetOf(a.x,a.z))<T.HW+3)continue;
      const car={x:b.x,z:b.z,y:from,vx:(b.x-a.x)*10,vz:(b.z-a.z)*10};T.constrainMotion(car,a);
      surfaceCases.push({travel:Math.hypot(car.x-a.x,car.z-a.z),requested:Math.hypot(b.x-a.x,b.z-a.z)});
    }
    reset(0);return {noSnap,road,grass,boostedGrass,recovery,trunksTested:Math.min(15,trunks.length),trunkFailures,tunnelFailures,waterCases,waterFailures,blockedBanks:surfaceCases.filter(p=>p.travel<p.requested*0.9).length,bankCases:surfaceCases.length};
  });
  console.log(JSON.stringify(metrics,null,2));await writeFile(`${output}/driving-metrics.json`,JSON.stringify(metrics,null,2));
  assert.ok(metrics.noSnap.distance<0.001&&metrics.noSnap.offset>12.9,'shoulder leaves position under player control');
  assert.ok(metrics.grass.minRough>0.75,'grass speed sample stays off road');
  assert.ok(metrics.grass.speed<metrics.road.speed*0.6,'rough ground slows full-throttle driving');
  assert.ok(metrics.boostedGrass.speed<metrics.road.speed*0.8,'turbo cannot erase the grass penalty');
  assert.ok(metrics.recovery.end<8&&metrics.recovery.groundError<0.05,'driver can steer back onto the road');
  assert.deepEqual(metrics.trunkFailures,[],'trunks block entry while allowing escape');
  assert.ok(metrics.trunksTested>=8,'sample multiple actual tree trunks on passable ground');
  assert.deepEqual(metrics.tunnelFailures,[],'tunnel masonry blocks cars outside the passage');
  assert.ok(metrics.waterCases>=4,'sample both banks of the river');
  assert.deepEqual(metrics.waterFailures,[],'river blocks driving deeper while allowing escape to shore');
  assert.ok(metrics.blockedBanks>20,'steep rock banks obstruct driving');
  assert.deepEqual(errors,[]);console.log('PASS: Selva off-road speed, shoulder control, steering recovery, trunk and bank collisions');
}finally{await browser.close();}
