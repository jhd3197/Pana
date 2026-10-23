import assert from 'node:assert/strict';
import {launch,openGame,waitFor} from '../../../tests/browser-kit.js';

const browser=await launch();
try{
  const page=await openGame(browser,'carreritas',{query:'debug&manual&track=bululu'});
  await waitFor(page,()=>window.getActiveTrack&&garage.car);
  const result=await page.evaluate(async()=>{
    const THREE=await import('three');await startRace(0);race.state='audit';
    const T=getActiveTrack(),road=T.group.getObjectByName('track-road'),land=T.group.getObjectByName('world-terrain');
    T.group.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
    let agreement=0,grade=0;
    for(let s=0;s<T.TOTAL;s+=3.7){
      const p=T.pointAt(s),q=T.pointAt(s+.3),h=Math.atan2(q.x-p.x,q.y-p.y);
      for(const off of [-8,0,8]){
        const x=p.x-Math.cos(h)*off,z=p.y+Math.sin(h)*off;
        ray.ray.origin.set(x,200,z);const hit=ray.intersectObject(road)[0];
        if(!hit)throw Error('Missing road support');
        agreement=Math.max(agreement,Math.abs(hit.point.y-.12-T.groundAt(x,z)));
        const at=s=>T.heightAtS(s)+T.def.crossfall(s,off,T);
        grade=Math.max(grade,Math.abs(at(s+.25)-at(s-.25))/.5);
      }
    }
    const records=T.group.getObjectByName('bululu-coastal-composition').userData.placements;
    const clearance=records.every(p=>Math.abs(T.offsetOf(p.x,p.z))>T.HW+p.r+4);
    let tower=null;T.group.traverse(o=>{if(o.userData.assetId==='coastal-lighthouse')tower=new THREE.Box3().setFromObject(o);});
    const screens=[];
    for(const from of [.08,.10,.12,.15,.18,.20]){
      const a=T.pointAt(T.TOTAL*from),b=T.pointAt(T.TOTAL*.23),q=T.pointAt(T.TOTAL*from+.3),h=Math.atan2(q.x-a.x,q.y-a.y);
      const origin=new THREE.Vector3(a.x-Math.sin(h)*11,T.surfaceAt(a.x,a.y)+T.def.cameraHeight,a.y-Math.cos(h)*11);
      const target=new THREE.Vector3(b.x,T.surfaceAt(b.x,b.y)+1,b.y),distance=origin.distanceTo(target);
      const r=new THREE.Raycaster(origin,target.clone().sub(origin).normalize(),1,distance-1);
      screens.push({from,hidden:r.intersectObjects([road,land],false).length>0});
    }
    return {agreement,grade,clearance,placements:records.length,palms:records.filter(p=>p.kind==='palm').length,
      towerHeight:tower?.max.y-tower?.min.y,stone:[...road.geometry.attributes.roadSurface.array].some(v=>v===2),
      sand:[...road.geometry.attributes.roadSurface.array].some(v=>v===0),screens,
      tidalBank:[.665,.7,.75,.805].map(u=>T.def.crossfall(u*T.TOTAL,8,T))};
  });
  console.log(JSON.stringify(result));
  assert.ok(result.agreement<.06,'rendered road matches tyre support across the lane');
  assert.ok(result.grade<.4,'bank transitions remain drivable');
  assert.ok(result.clearance&&result.palms>=12,'accepted palm groups preserve the driving corridor');
  assert.ok(result.towerHeight>18,'the lighthouse is a legible landmark');
  assert.ok(result.stone&&result.sand,'distinct village/lookout and beach surfaces');
  assert.ok(result.screens.filter(s=>s.from<=.12).every(s=>s.hidden),'the first crest screens the distant beach approach');
  assert.ok(result.screens.filter(s=>s.from>=.15).every(s=>!s.hidden),'the beach approach is revealed after the crest');
  assert.deepEqual(result.tidalBank,[0,0,0,0],'the tidal chapter remains level');
  assert.deepEqual(page.errors,[]);
}finally{await browser.close();}
