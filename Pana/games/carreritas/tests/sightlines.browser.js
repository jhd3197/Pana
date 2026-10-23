// Authored scenery must exist, clear all driving lanes and the chase camera,
// stay within a small incremental render budget, and remain solid off road.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser=await launch();
try {
  const page=await openGame(browser,'carreritas',{query:'debug&manual&track=plaza'});
  await waitFor(page,()=>window.getActiveTrack&&garage.car);
  for(const id of ['plaza','selva','paramo','bululu','sabana']) {
    const result=await page.evaluate(async id=>{
      const THREE=await import('three');
      toGarage();buildTrack(id);await startRace(0);
      const T=getActiveTrack(),root=T.group.getObjectByName('authored-sightlines');
      T.group.updateMatrixWorld(true);
      const sites=root.userData.sites,failures=[],ray=new THREE.Raycaster(),hits=[];
      let triangles=0,meshes=0,finite=true;
      root.traverse(o=>{
        if(!o.isMesh)return;meshes++;
        triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
        for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;
      });
      for(const site of sites) {
        for(const p of site.placements)if(p.roadDistance-p.radius<T.HW+4.9)failures.push(site.id);
        // Probe the actual submitted geometry rather than only centre bounds.
        for(let s=(site.u-.006)*T.TOTAL;s<(site.u+.045)*T.TOTAL;s+=3) {
          const a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y);
          for(const off of [-T.HW+1,0,T.HW-1]) {
            const x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off;
            ray.set(new THREE.Vector3(x,T.surfaceAt(x,z)+4,z),new THREE.Vector3(0,-1,0));ray.far=3.9;
            if(ray.intersectObject(root,true).length)hits.push(`${site.id}:lane`);
          }
          const ground=T.heightAtS(s),target=new THREE.Vector3(a.x,ground+1.4,a.y);
          const camera=new THREE.Vector3(a.x-Math.sin(h)*11,ground+5,a.y-Math.cos(h)*11);
          ray.set(camera,target.clone().sub(camera).normalize());ray.far=camera.distanceTo(target);
          if(ray.intersectObject(root,true).length)hits.push(`${site.id}:camera`);
        }
      }
      const collisions=[];
      for(const p of root.userData.colliders) {
        const previous={x:p.x+p.r+3,z:p.z};
        const car={x:p.x+p.r*.5,z:p.z,y:p.base+1,vx:-10,vz:0};
        T.constrainMotion(car,previous);
        collisions.push(Math.hypot(car.x-p.x,car.z-p.z)>=p.r+1.49);
      }
      return {id,sites:sites.map(s=>({id:s.id,count:s.placements.length})),failures,hits,finite,triangles,meshes,collisions};
    },id);
    console.log(JSON.stringify(result));
    assert.equal(result.sites.length,4);
    assert.ok(result.sites.every(s=>s.count>=2),`${id}: every authored place is built`);
    assert.deepEqual(result.failures,[],`${id}: full crown and prop road clearance`);
    assert.deepEqual(result.hits,[],`${id}: real geometry clears lanes and chase camera`);
    assert.ok(result.finite);
    assert.ok(result.triangles<180000,`${id}: incremental triangle budget`);
    assert.ok(result.meshes<90,`${id}: static batch budget`);
    if(id==='selva')assert.ok(result.collisions.length>0&&result.collisions.every(Boolean),'new off-road scenery blocks entry');
  }
  assert.deepEqual(page.errors,[]);
} finally {await browser.close();}
