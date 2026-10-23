import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser=await launch();
try {
  const page=await openGame(browser,'carreritas',{query:'debug&manual&track=plaza'});
  await waitFor(page,()=>window.getActiveTrack&&garage.car);
  const results=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {createChaseCamera}=await import('/g/carreritas/chase-camera.js');
    let preference='dinamica';
    const failures=[],records=[];
    for(const id of ['plaza','puerto','sarisarinama','galipan']){
      toGarage();buildTrack(id);await startRace(0);
      const T=getActiveTrack(),p=race.player;
      const solids=[];
      T.group.traverseVisible(o=>{if(o.isMesh&&[].concat(o.material).every(m=>!m.transparent))solids.push(o);});
      // Test the same renderer helper used by the game, with isolated camera
      // state so split, mirror and narrow-view scenarios cannot contaminate it.
      const state={mode:'race',mirror:false,shake:1,slowMo:{punch:4}};
      const follow=createChaseCamera(state,()=>T,(a,b)=>(a+b)/2,()=>preference);
      const cam=new THREE.PerspectiveCamera(60,390/844,.1,1800);
      for(const u of [.05,.2,.35,.5,.65,.8,.95]){
        placeRacer(p,0,(T.LINE-9-u*T.TOTAL)/8);p.vf=40;p.onGround=true;
        state.first=null;
        for(let i=0;i<90;i++)follow(cam,'first',p,false,1/60);
        cam.updateMatrixWorld();
        const car=new THREE.Vector3(p.x,p.y+(p.flyLift||0)+1.4,p.z).project(cam);
        const values=[...cam.position.toArray(),...cam.quaternion.toArray(),cam.fov];
        if(!values.every(Number.isFinite)||Math.abs(car.x)>.7||Math.abs(car.y)>.8||car.z<0||car.z>1)failures.push(`${id}:${u}:car framing`);
        T.group.updateMatrixWorld(true);
        const target=new THREE.Vector3(p.x,p.y+(p.flyLift||0)+1.4,p.z);
        const ray=new THREE.Raycaster(cam.position,target.clone().sub(cam.position).normalize(),0,cam.position.distanceTo(target)-.2);
        if(ray.intersectObjects(solids,false).length)failures.push(`${id}:${u}:camera corridor`);
        const normal=cam.position.clone(),q=cam.quaternion.clone();
        state.mirror=true;state.first=null;
        for(let i=0;i<90;i++)follow(cam,'first',p,false,1/60);
        if(Math.abs(cam.position.x+normal.x)>1e-6||Math.abs(cam.position.y-normal.y)>1e-6||Math.abs(cam.position.z-normal.z)>1e-6)failures.push(`${id}:${u}:mirror`);
        state.mirror=false;state.first=null;
        for(let i=0;i<90;i++)follow(cam,'first',p,false,1/60);
        const first=state.first.clone();
        const other={...p,x:p.x+70,z:p.z+70};
        follow(new THREE.PerspectiveCamera(),'second',other,false,1/60);
        if(state.first.distanceTo(first)>1e-9)failures.push(`${id}:${u}:split state`);
        follow(cam,'first',p,true,1/60);
        const forward=new THREE.Vector3(Math.sin(p.h),0,Math.cos(p.h));
        if(cam.position.clone().sub(new THREE.Vector3(p.x,p.y,p.z)).dot(forward)<8)failures.push(`${id}:${u}:look back`);
        records.push({id,u,position:normal.toArray(),quaternion:q.toArray()});
      }
      preference='suave';p.boost=1;
      follow(cam,'first',p,false,1/60);
      const right=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion);
      if(Math.abs(right.y)>1e-8)failures.push(`${id}:comfort roll`);
      for(let i=0;i<120;i++)follow(cam,'first',p,false,1/60);
      if(Math.abs(cam.fov-60)>.1)failures.push(`${id}:comfort zoom`);
      preference='dinamica';
    }
    return {failures,samples:records.length};
  });
  console.log(JSON.stringify(results));assert.deepEqual(results.failures,[]);
  assert.equal(results.samples,28);assert.deepEqual(page.errors,[]);
  // Exercise the real settings surface and the game's presentation wiring.
  await page.evaluate(()=>menu.open('settings'));
  await page.locator('.pana-settings-nav [aria-controls="pana-settings-game"]').click();
  await page.locator('#pana-opt-camera [data-value="suave"]').click();
  assert.equal(await page.locator('#pana-opt-camera [data-value="suave"]').getAttribute('aria-checked'),'true');
  const comfort=await page.evaluate(async()=>{
    menu.close();const THREE=await import('three');race.state='audit';race.player.boost=1;race.shake=1;
    for(let i=0;i<120;i++)presentRace(1/60);
    return {saved:localStorage.getItem('carreritas:camera'),fov:race.camera.fov,
      roll:new THREE.Vector3(1,0,0).applyQuaternion(race.camera.quaternion).y};
  });
  assert.equal(comfort.saved,'suave');assert.ok(Math.abs(comfort.fov-60)<.1);assert.ok(Math.abs(comfort.roll)<1e-8);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>menu.open('settings'));
  await page.locator('.pana-settings-nav [aria-controls="pana-settings-game"]').click();
  await page.locator('#pana-opt-camera [data-value="dinamica"]').click();
  const reduced=await page.evaluate(async()=>{
    menu.close();const THREE=await import('three');
    for(let i=0;i<120;i++)presentRace(1/60);
    return {fov:race.camera.fov,roll:new THREE.Vector3(1,0,0).applyQuaternion(race.camera.quaternion).y};
  });
  assert.ok(Math.abs(reduced.fov-60)<.1);assert.ok(Math.abs(reduced.roll)<1e-8);
  assert.deepEqual(page.errors,[]);
}finally{await browser.close();}
