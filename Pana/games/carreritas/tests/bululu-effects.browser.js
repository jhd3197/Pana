import assert from 'node:assert/strict';
import {launch,openGame,waitFor} from '../../../tests/browser-kit.js';

const browser=await launch();
try{
  const page=await openGame(browser,'carreritas',{query:'debug&manual&track=bululu'});
  await waitFor(page,()=>window.getActiveTrack&&garage.car);
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),{updateDrivingEffects}=await import('/g/carreritas/driving-effects.js');
    await startRace(0);race.state='audit';
    const T=getActiveTrack(),p=race.player,cam=race.camera,dir=T.def.palette.sunDirection;
    const land=T.group.getObjectByName('world-terrain'),surface=land.geometry.userData.coastalSurface;
    const a=race.items.pads.find(a=>a.zone),strip=a.m.geometry.attributes.position;
    let gap=0;
    for(let i=0;i<strip.count;i++)gap=Math.max(gap,Math.abs(strip.getY(i)-T.groundAt(strip.getX(i),strip.getZ(i))-.16));
    const triggers=[];
    for(const [side,fwd,air] of [[0,0,0],[6,7,0],[-6,-7,0],[9,0,0],[0,12,0],[0,0,5]]){
      p.x=a.x+Math.cos(a.h)*side+Math.sin(a.h)*fwd;p.z=a.z-Math.sin(a.h)*side+Math.cos(a.h)*fwd;
      p.y=T.groundAt(p.x,p.z)+air;p.boost=0;p.onGround=air===0;
      race.items.update(1/60,[p],true);triggers.push(p.boost>0);
    }
    cam.position.set(0,100,0);cam.lookAt(cam.position.clone().add(dir));cam.updateMatrixWorld();
    const sample=(speed,boost,comfort=false,look=false)=>{
      p.vf=speed;p.boost=boost;
      for(let i=0;i<120;i++)updateDrivingEffects(T,cam,p,race,comfort,look,1/60);
      renderer.render(race.scene,cam);return {...cam.userData.drivingEffects};
    };
    const idle=sample(0,0),fast=sample(60,0),boost=sample(60,1),comfort=sample(60,1,true),look=sample(60,1,false,true);
    const cam2=cam.clone();cam2.lookAt(cam2.position.clone().sub(dir));
    for(let i=0;i<120;i++)updateDrivingEffects(T,cam2,p,race,false,false,1/60);
    renderer.render(race.scene,cam2);
    const other={...cam2.userData.drivingEffects};
    // Find a real exterior shaded foothill, not an invalid camera under terrain.
    const probe=new THREE.Raycaster(),shaded=[];
    T.group.updateMatrixWorld(true);
    for(let x=235;x<320;x+=5)for(let z=20;z<90;z+=5){
      const at=new THREE.Vector3(x,T.groundAt(x,z)+1,z);
      probe.set(at,dir);probe.near=.5;probe.far=1200;
      if(probe.intersectObject(land,false).length)shaded.push(at);
    }
    if(!shaded.length)throw Error('No shaded foothill found');
    cam.position.copy(shaded[0]);cam.lookAt(cam.position.clone().add(dir));
    const hidden=sample(0,0);
    race.mirror=true;race.scene.scale.x=-1;cam.position.set(0,100,0);
    cam.lookAt(cam.position.clone().add(new THREE.Vector3(-dir.x,dir.y,dir.z)));
    const mirrored=sample(60,1);race.mirror=false;race.scene.scale.x=1;
    const original=a.zone;race.items.dispose();const disposed=!original.parent&&!a.m.parent;
    toGarage();buildTrack('plaza');await startRace(0);updateRace(1/60,true);renderer.render(race.scene,race.camera);
    return {surface,gap,triggers,idle,fast,boost,comfort,look,other,hidden,mirrored,disposed,
      otherMap:!!getActiveTrack().group.getObjectByName('bululu-driving-effects')};
  });
  console.log(JSON.stringify(result));
  assert.ok(result.surface.rocks>100&&result.surface.caps>30,'exposed rock and green caps exist');
  assert.ok(result.gap<.001,'boost strip follows the actual banked terrain');
  assert.deepEqual(result.triggers,[true,true,true,false,false,false],'boost matches strip footprint and rejects airborne cars');
  assert.equal(result.idle.speed,0);assert.ok(result.fast.speed>0&&result.boost.speed>result.fast.speed);
  assert.ok(result.boost.glare>.5,'sun-facing glow');
  assert.equal(result.comfort.speed,0);assert.equal(result.comfort.glare,0);assert.equal(result.look.speed,0);
  assert.ok(result.other.glare<.001,'each viewport has its own sun direction');
  assert.ok(result.hidden.blocked&&result.hidden.glare<.001,'terrain screens glare');
  assert.ok(result.mirrored.glare>.5&&result.mirrored.speed>.5,'mirrored sun and speed cues');
  assert.ok(result.disposed&&!result.otherMap,'dispose markers and preserve other maps');
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(async()=>{
    toGarage();buildTrack('bululu');await startRace(0);race.state='audit';
    race.player.vf=60;race.player.boost=1;
    for(let i=0;i<120;i++)presentRace(1/60);
    renderer.render(race.scene,race.camera);return race.camera.userData.drivingEffects;
  });
  assert.equal(reduced.speed,0);assert.equal(reduced.glare,0);
  assert.deepEqual(page.errors,[]);
}finally{await browser.close();}
