import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  const proof=await page.evaluate(async()=>{
    const {placeOnTrack}=await import('./track-kit.js'),{roadWaterAt,roadGripAt}=await import('./offroad.js');
    buildTrack('salinas');await startRace(0);race.state='go';race.count=0;
    const T=getActiveTrack();let wetSections=0,noDryLine=0,deckError=0;
    for(let i=0;i<1000;i++){
      const samples=[-10,-6,0,6,10].map(off=>{const p=placeOnTrack(T,T.TOTAL*i/1000,off);return roadWaterAt(T,p.x,p.z);});
      if(Math.max(...samples)>.1){wetSections++;if(Math.min(...samples)>.01)noDryLine++;}
    }
    const mesh=T.group.getObjectByName('track-road'),positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)deckError=Math.max(deckError,Math.abs(positions.getY(i)-T.surfaceAt(positions.getX(i),positions.getZ(i))));
    const trials=[];
    for(const index of [0,2,3])for(const wheel of ['calle','lluvia']){
      const c=makeRacer(index,false,'Prueba',wheel);c.skill=1;
      function run(offset){
        const p=placeOnTrack(T,T.TOTAL*.283,offset);
        Object.assign(c,{x:p.x,z:p.z,y:T.groundAt(p.x,p.z),h:p.h,vx:Math.sin(p.h)*20-Math.cos(p.h)*4,vz:Math.cos(p.h)*20+Math.sin(p.h)*4,
          vf:20,vr:4,vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost:0,spin:0,coins:0,lap:1,cloud:0,stall:0,drift:0});
        const wet=roadWaterAt(T,p.x,p.z),grip=roadGripAt(T,p.x,p.z);
        for(let i=0;i<12;i++)stepCar(c,{throttle:1,steer:0},1/60);
        return {wet,grip,speed:c.vf,slide:Math.abs(c.vr),ground:c.y-T.groundAt(c.x,c.z)};
      }
      trials.push({index,wheel,wet:run(-7),dry:run(9)});disposeRacer(c);
    }
    return {wetSections,noDryLine,deckError,trials};
  });
  assert.ok(proof.wetSections>10);assert.equal(proof.noDryLine,0);assert.ok(proof.deckError<.01);
  for(const t of proof.trials){assert.ok(t.wet.wet>.5&&t.dry.wet===0);assert.ok(t.wet.grip<t.dry.grip);assert.ok(t.wet.speed<t.dry.speed);assert.ok(Math.abs(t.wet.ground)<.1&&Math.abs(t.dry.ground)<.1);}
  assert.deepEqual(errors,[]);await mkdir('art/water-worlds/salinas',{recursive:true});await writeFile('art/water-worlds/salinas/crossing.json',JSON.stringify(proof,null,2));console.log('Salt crossing: rendered deck agrees with physics; dry lane throughout; three cars, two tire sets verified');
}finally{await browser.close();}
